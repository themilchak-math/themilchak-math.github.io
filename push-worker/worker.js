// 더밀착수학 푸시 알림 서버 (Cloudflare Workers 무료)
// - GET  /vapid : 알림 구독용 공개키 (처음 호출 때 키를 만들어 KV에 저장)
// - POST /send  : { subs:[구독...], title, body, url } + Authorization: Bearer <Firebase 로그인 토큰>
// - POST /file?name=&type=  : 소식 첨부 올리기 (원장·부원장만) → { k, size }
// - GET  /file/<k>?a=<토큰> : 첨부 보기 (로그인한 앱 사용자만)
// - POST /file-del { keys }  : 첨부 삭제 (원장·부원장만)
// - GET  /usage              : 저장소 사용량 (원장·부원장만)
// - POST /remind { id, uid, at(ms), subs, title, body, url, tag } : 예약 알림 (원장·부원장만) — 상담 10분 전 알림
// - POST /remind-del { id }  : 예약 취소 (원장·부원장, 또는 그 상담을 요청한 학부모)
// - 1분마다(cron) 시간이 된 예약 알림을 보내요. 필요한 설정: 트리거 → Cron "* * * * *"
// 필요한 설정: KV 네임스페이스를 변수 이름 KV 로, R2 버킷 themilchak-files 를 변수 이름 FILES 로 연결
const PROJECT = 'themilchak-math';
const ORIGINS = ['https://themilchak-math.github.io', 'http://localhost:8765'];
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const SUBJECT = 'https://themilchak-math.github.io';

const enc = new TextEncoder();
const b64u = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ub64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const cat = (...arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0); const o = new Uint8Array(n); let p = 0; for (const x of arrs) { o.set(x, p); p += x.length; } return o; };

/* ---------- VAPID 키 ---------- */
async function vapidKeys(env) {
  let saved = await env.KV.get('vapid', 'json');
  if (!saved) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    saved = { jwk, pub: b64u(pub) };
    await env.KV.put('vapid', JSON.stringify(saved));
  }
  return saved;
}
async function vapidAuth(keys, endpoint) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + keys.pub;
}

/* ---------- 내용 암호화 (RFC 8291, aes128gcm) ---------- */
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
export async function encryptPayload(sub, text, asKeyPair, salt) {
  const uaPub = ub64u(sub.keys.p256dh), authSecret = ub64u(sub.keys.auth);
  const as = asKeyPair || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, secret, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/* ---------- Firebase 로그인 토큰 확인 ---------- */
let jwkCache = null, jwkAt = 0;
export async function verifyIdToken(token, fetchJwks) {
  const parts = (token || '').split('.'); if (parts.length !== 3) throw new Error('bad token');
  const head = JSON.parse(new TextDecoder().decode(ub64u(parts[0])));
  const body = JSON.parse(new TextDecoder().decode(ub64u(parts[1])));
  if (head.alg !== 'RS256') throw new Error('alg');
  if (!jwkCache || Date.now() - jwkAt > 3600e3) { jwkCache = await (fetchJwks ? fetchJwks() : fetch(JWK_URL).then(r => r.json())); jwkAt = Date.now(); }
  const jwk = (jwkCache.keys || []).find(k => k.kid === head.kid); if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, ub64u(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  const t = Math.floor(Date.now() / 1000);
  if (!ok || body.aud !== PROJECT || body.iss !== 'https://securetoken.google.com/' + PROJECT || body.exp < t || !body.sub) throw new Error('invalid');
  return body;
}

/* ---------- 원장·부원장 확인 ----------
   원장·부원장만 읽을 수 있는 Firestore 문서(config/qr)를 그 사람 토큰으로 읽어 봐서
   막히면(403) 선생님이 아님. 결과는 10분 동안 기억 */
const tCache = new Map();
async function requireTeacher(req) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const u = await verifyIdToken(tok); const c = tCache.get(u.sub);
  if (c && Date.now() - c < 600e3) return u;
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/config/qr', { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 401 || r.status === 403) throw new Error('not teacher');
  tCache.set(u.sub, Date.now()); return u;
}
const MAX_FILE = 50 * 1024 * 1024;
const extOf = n => { const m = /\.([a-z0-9]{1,6})$/i.exec(n || ''); return m ? '.' + m[1].toLowerCase() : ''; };
const rid = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return b64u(a); };

/* ---------- 요청 처리 ---------- */
function cors(req) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Name', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

/* ---------- 알림 보내기 (공용) ---------- */
async function sendAll(env, subs, msg) {
  const payload = JSON.stringify({ title: String(msg.title || '더밀착수학').slice(0, 60), body: String(msg.body || '').slice(0, 300), url: String(msg.url || '/').slice(0, 200), tag: String(msg.tag || '').slice(0, 60) });
  const keys = await vapidKeys(env);
  const list = (subs || []).slice(0, 60).filter(s => s && s.endpoint && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth);
  const gone = []; let sent = 0;
  await Promise.all(list.map(async s => {
    try {
      const r = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(keys, s.endpoint), TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body: await encryptPayload(s, payload) });
      if (r.status === 404 || r.status === 410) gone.push(s.endpoint); else if (r.ok) sent++;
    } catch (e) { }
  }));
  return { sent, gone };
}
/* ---------- 예약 알림 (KV 'rems' 한 곳에 목록으로 저장) ---------- */
async function runReminders(env) {
  const rems = (await env.KV.get('rems', 'json')) || []; if (!rems.length) return 0;
  const now = Date.now(); const due = rems.filter(r => r.at <= now); if (!due.length) return 0;
  await env.KV.put('rems', JSON.stringify(rems.filter(r => r.at > now)));
  for (const r of due) if (now - r.at < 6 * 3600e3) await sendAll(env, r.subs, r);
  return due.length;
}
/* ---------- 안 읽은 메시지·알림 다시 알림 (30분 뒤 · 60분 뒤, 최대 2번 · 밤 10시~아침 8시는 안 보냄) ---------- */
const FSB = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/';
const fromFs = v => !v ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
  : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)])) : 'arrayValue' in v ? (v.arrayValue.values || []).map(fromFs) : null;
async function fsDoc(path, tok) { const r = await fetch(FSB + path, { headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) return null; const j = await r.json(); return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromFs(v)])); }
const RE_GAP = 30 * 60e3, RE_MAX = 2;
const quietKST = t => { const h = (new Date(t).getUTCHours() + 9) % 24; return h >= 22 || h < 8; };
async function runMsgReminders(env) {
  const l = (await env.KV.get('mrems', 'json')) || []; if (!l.length) return 0;
  const now = Date.now(); const due = l.filter(r => r.at <= now); if (!due.length) return 0;
  const keep = l.filter(r => r.at > now);
  for (const r of due) {
    if (now - r.at > 20 * 60e3 || quietKST(now)) continue; // 너무 늦었거나 밤(10시~8시)이면 건너뜀
    await sendAll(env, r.subs, { title: r.f === 't' ? '💬 원장님 메시지를 아직 확인하지 않으셨어요' : '🔔 확인하지 않은 알림이 있어요', body: r.body, url: './', tag: 're' + r.id });
    if (r.n + 1 < RE_MAX) keep.push({ ...r, n: r.n + 1, at: r.at + RE_GAP });
  }
  await env.KV.put('mrems', JSON.stringify(keep)); return due.length;
}
async function isTeacherReq(req) { try { await requireTeacher(req); return true; } catch (e) { return false; } }

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(Promise.all([runReminders(env), runMsgReminders(env)])); },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    try {
      if (url.pathname === '/vapid') { const k = await vapidKeys(env); return json(req, { key: k.pub }); }
      if (url.pathname === '/send' && req.method === 'POST') {
        await verifyIdToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''));
        const m = await req.json();
        if (!Array.isArray(m.subs) || !m.subs.length) return json(req, { sent: 0, gone: [] });
        return json(req, await sendAll(env, m.subs, m));
      }
      if (url.pathname === '/remind' && req.method === 'POST') {
        await requireTeacher(req); const m = await req.json();
        if (!m.id || !(m.at > 0) || !Array.isArray(m.subs)) return json(req, { error: 'bad' }, 400);
        const rems = ((await env.KV.get('rems', 'json')) || []).filter(r => r.id !== m.id && r.at > Date.now() - 864e5);
        rems.push({ id: String(m.id).slice(0, 40), uid: String(m.uid || '').slice(0, 60), at: +m.at, subs: m.subs.slice(0, 20), title: m.title, body: m.body, url: m.url, tag: m.tag });
        await env.KV.put('rems', JSON.stringify(rems.slice(-200))); return json(req, { ok: true, n: rems.length });
      }
      if (url.pathname === '/remind-del' && req.method === 'POST') {
        const u = await verifyIdToken((req.headers.get('Authorization') || '').replace(/^Bearer /, '')); const { id } = await req.json();
        const rems = (await env.KV.get('rems', 'json')) || []; const r = rems.find(x => x.id === id);
        if (!r) return json(req, { ok: true, n: 0 });
        if (r.uid !== u.sub && !(await isTeacherReq(req))) return json(req, { error: 'not allowed' }, 403);
        await env.KV.put('rems', JSON.stringify(rems.filter(x => x.id !== id))); return json(req, { ok: true, n: 1 });
      }
      // 메시지·알림을 보낸 기기가 부르면: 받는 사람이 30분 안에 안 읽으면 다시 알림 예약 (보낸 사람이 그 메시지를 읽을 수 있어야 함)
      if (url.pathname === '/mremind' && req.method === 'POST') {
        const tok = (req.headers.get('Authorization') || '').replace(/^Bearer /, ''); await verifyIdToken(tok);
        const { ids } = await req.json(); const add = [];
        for (const id of (Array.isArray(ids) ? ids : []).slice(0, 10)) {
          if (!/^[A-Za-z0-9]{10,40}$/.test(String(id))) continue;
          const m = await fsDoc('msgs/' + id, tok); if (!m || m.f === 'o' || m.r) continue;
          const pd = await fsDoc('push/' + encodeURIComponent(m.th), tok); const subs = ((pd && pd.subs) || []).filter(x => x && x.endpoint).slice(0, 10);
          if (!subs.length) continue;
          add.push({ id, f: m.f, at: Date.now() + RE_GAP, n: 0, subs, body: String(m.t || '').slice(0, 140) });
        }
        if (!add.length) return json(req, { ok: true, n: 0 });
        const l = ((await env.KV.get('mrems', 'json')) || []).filter(r => !add.some(a => a.id === r.id));
        await env.KV.put('mrems', JSON.stringify(l.concat(add).slice(-300))); return json(req, { ok: true, n: add.length });
      }
      // 받는 사람이 읽었거나 원장님이 지우면 다시 알림 취소 (그 메시지를 읽을 수 있는 사람만)
      if (url.pathname === '/mremind-del' && req.method === 'POST') {
        const tok = (req.headers.get('Authorization') || '').replace(/^Bearer /, ''); await verifyIdToken(tok);
        const { ids } = await req.json(); const want = new Set((Array.isArray(ids) ? ids : []).slice(0, 40).map(String));
        const l = (await env.KV.get('mrems', 'json')) || []; const hit = l.filter(r => want.has(r.id)); if (!hit.length) return json(req, { ok: true, n: 0 });
        const teacher = await isTeacherReq(req); const ok = new Set();
        for (const r of hit) { if (teacher || await fsDoc('msgs/' + r.id, tok)) ok.add(r.id); }
        if (ok.size) await env.KV.put('mrems', JSON.stringify(l.filter(r => !ok.has(r.id))));
        return json(req, { ok: true, n: ok.size });
      }
      // 원장님·부원장 기기 목록을 KV에 복사 (로그인 없는 상담 화면에서 원장님께 알림을 보내려고)
      if (url.pathname === '/tsubs' && req.method === 'POST') {
        await requireTeacher(req); const { subs } = await req.json();
        if (Array.isArray(subs) && subs.length) await env.KV.put('tsubs', JSON.stringify(subs.filter(x => x && x.endpoint).slice(0, 30)));
        return json(req, { ok: true });
      }
      // 학부모님 진단 예약 신청·비대면 입학신청서가 들어오면 원장님 폰으로 알림 (로그인 없음 → 시간당 20건 제한, 같은 신청 1번만)
      if (url.pathname === '/notify-form' && req.method === 'POST') {
        const { tok, kind } = await req.json().catch(() => ({}));
        const hk = 'nfc:' + Math.floor(Date.now() / 3600e3); const n = +(await env.KV.get(hk) || 0);
        if (n >= 20) return json(req, { ok: false, why: 'limit' });
        let title = '더밀착수학', body = '';
        if (kind === 'remote') { body = '📝 비대면 입학신청서가 들어왔어요 · 관리자 [진단·상담]에서 확인해 주세요'; }
        else {
          if (!/^[A-Za-z0-9]{20,40}$/.test(String(tok || ''))) return json(req, { ok: false });
          if (await env.KV.get('nf:' + tok)) return json(req, { ok: true, dup: true });
          const r = await fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/forms/' + tok);
          if (!r.ok) return json(req, { ok: false });
          const f = (await r.json()).fields || {}; const sv = k => (f[k] && (f[k].stringValue ?? f[k].integerValue)) || '';
          if (sv('self') !== 'book' || Date.now() - +sv('ts') > 15 * 60e3) return json(req, { ok: false });
          await env.KV.put('nf:' + tok, '1', { expirationTtl: 86400 });
          body = '📅 진단 예약 신청 · ' + sv('name') + ' ' + sv('grade') + (sv('wantDate') ? ' · 희망 ' + sv('wantDate').slice(5).replace('-', '/') + (sv('wantTime') ? ' ' + sv('wantTime') : '') : '');
        }
        await env.KV.put(hk, String(n + 1), { expirationTtl: 7200 });
        const subs = (await env.KV.get('tsubs', 'json')) || [];
        return json(req, { ok: true, ...(await sendAll(env, subs, { title, body, url: '/admin.html', tag: 'lead' })) });
      }
      if (url.pathname === '/run-reminders' && req.method === 'POST') { await requireTeacher(req); return json(req, { sent: await runReminders(env) }); }
      // 소식 첨부파일
      if (url.pathname === '/file' && req.method === 'POST') {
        await requireTeacher(req);
        const len = +(req.headers.get('Content-Length') || 0); if (len > MAX_FILE) return json(req, { error: '파일이 너무 커요 (50MB까지)' }, 413);
        const name = decodeURIComponent(req.headers.get('X-Name') || 'file').slice(0, 120); const type = (req.headers.get('Content-Type') || 'application/octet-stream').slice(0, 100);
        const d = new Date(); const k = 'b/' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + rid() + extOf(name);
        const obj = await env.FILES.put(k, req.body, { httpMetadata: { contentType: type }, customMetadata: { name } });
        return json(req, { k, size: obj.size });
      }
      if (url.pathname.startsWith('/file/b/') && req.method === 'GET') {
        await verifyIdToken(url.searchParams.get('a') || '');
        const k = decodeURIComponent(url.pathname.slice(6)); const obj = await env.FILES.get(k);
        if (!obj) return new Response('없는 파일이에요', { status: 404, headers: cors(req) });
        const name = (obj.customMetadata && obj.customMetadata.name) || k.split('/').pop();
        const h = new Headers(cors(req)); obj.writeHttpMetadata(h); h.set('Cache-Control', 'private, max-age=86400'); h.set('ETag', obj.httpEtag);
        h.set('Content-Disposition', (url.searchParams.get('dl') ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(name));
        return new Response(obj.body, { headers: h });
      }
      if (url.pathname === '/file-del' && req.method === 'POST') {
        await requireTeacher(req); const { keys } = await req.json();
        const ks = (Array.isArray(keys) ? keys : []).filter(k => typeof k === 'string' && k.startsWith('b/')).slice(0, 100);
        if (ks.length) await env.FILES.delete(ks); return json(req, { deleted: ks.length });
      }
      if (url.pathname === '/usage') {
        await requireTeacher(req); let bytes = 0, n = 0, cur;
        do { const l = await env.FILES.list({ prefix: 'b/', cursor: cur, limit: 1000 }); l.objects.forEach(o => { bytes += o.size; n++; }); cur = l.truncated ? l.cursor : null; } while (cur);
        return json(req, { bytes, n, free: 10 * 1024 ** 3 });
      }
      return json(req, { ok: true, service: 'themilchak push', files: !!env.FILES });
    } catch (e) {
      const m = String(e.message || e); return json(req, { error: m }, /token|kid|alg|invalid|teacher/.test(m) ? 401 : 500);
    }
  }
};
