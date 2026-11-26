// 더밀착수학 푸시 알림 서버 (Cloudflare Workers 무료)
// - GET  /vapid : 알림 구독용 공개키 (처음 호출 때 키를 만들어 KV에 저장)
// - POST /send  : { subs:[구독...], title, body, url } + Authorization: Bearer <Firebase 로그인 토큰>
// 필요한 설정: KV 네임스페이스를 변수 이름 KV 로 연결
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

/* ---------- 요청 처리 ---------- */
function cors(req) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    try {
      if (url.pathname === '/vapid') { const k = await vapidKeys(env); return json(req, { key: k.pub }); }
      if (url.pathname === '/send' && req.method === 'POST') {
        await verifyIdToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''));
        const { subs, title, body, url: link, tag } = await req.json();
        if (!Array.isArray(subs) || !subs.length) return json(req, { sent: 0, gone: [] });
        const payload = JSON.stringify({ title: String(title || '더밀착수학').slice(0, 60), body: String(body || '').slice(0, 300), url: String(link || '/').slice(0, 200), tag: String(tag || '').slice(0, 60) });
        const keys = await vapidKeys(env);
        const list = subs.slice(0, 60).filter(s => s && s.endpoint && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth);
        const gone = []; let sent = 0;
        await Promise.all(list.map(async s => {
          try {
            const r = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(keys, s.endpoint), TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }, body: await encryptPayload(s, payload) });
            if (r.status === 404 || r.status === 410) gone.push(s.endpoint); else if (r.ok) sent++;
          } catch (e) { }
        }));
        return json(req, { sent, gone });
      }
      return json(req, { ok: true, service: 'themilchak push' });
    } catch (e) {
      return json(req, { error: String(e.message || e) }, 401);
    }
  }
};
