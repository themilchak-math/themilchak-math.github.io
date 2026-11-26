// 더밀착수학 푸시 알림 (폰 앱·관리자 공용)
// 알림 서버 주소: Cloudflare Worker (push-worker/worker.js)
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const PUSH_URL = 'https://themilchak-push.djkim0075.workers.dev';

const ub64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// 'off' 서버 미설정 | 'ios-install' 아이폰 설치 필요 | 'unsupported' | 'denied' | 'default' 아직 안 물어봄 | 'on' 켜짐
export function pushState(uid) {
  if (!PUSH_URL) return 'off';
  if (!supported()) return isIOS() && !standalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'on'; // 허용돼 있으면 앱이 조용히 자동 등록
  return 'default';
}

async function vapidKey() {
  try { const k = localStorage.getItem('tmm-vapid'); if (k) return k; } catch (e) { }
  const r = await fetch(PUSH_URL + '/vapid'); const { key } = await r.json();
  try { localStorage.setItem('tmm-vapid', key); } catch (e) { }
  return key;
}
async function mySub() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('./');
  return reg ? reg.pushManager.getSubscription() : null;
}

// 이 기기에서 알림 켜기. targets: 이 사람이 받을 알림함 이름들 (원장님 'teacher', 가족 '학생id|parent' 등)
export async function enablePush(db, uid, targets) {
  const step = (p, ms, name) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout:' + name)), ms))]);
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await step(Notification.requestPermission(), 25000, 'permission');
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed');
  let reg;
  try { reg = await step(navigator.serviceWorker.register('./sw.js'), 15000, 'sw'); await step(navigator.serviceWorker.ready, 15000, 'ready'); }
  catch (e) { throw new Error(String(e.message).startsWith('timeout') ? e.message : 'sw:' + e.message); }
  let key; try { key = await step(vapidKey(), 15000, 'server'); } catch (e) { throw new Error(String(e.message).startsWith('timeout') ? e.message : 'server:' + e.message); }
  let sub = await reg.pushManager.getSubscription();
  if (!sub) { try { sub = await step(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ub64u(key) }), 25000, 'subscribe'); } catch (e) { throw new Error(String(e.message).startsWith('timeout') ? e.message : 'subscribe:' + (e.name || '') + ' ' + e.message); } }
  const j = sub.toJSON(); const s = { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
  try { for (const t of targets) await setDoc(doc(db, 'push', t), { subs: arrayUnion(s) }, { merge: true }); } catch (e) { throw new Error('save:' + (e.code || e.message)); }
  try { localStorage.setItem('tmm-push-' + uid, '1'); } catch (e) { }
}
// 알림 켜기 실패 이유를 사람이 읽을 문장으로
export function pushErrorText(e) {
  const m = String((e && e.message) || e || '');
  if (m === 'denied') return '알림이 차단돼 있어요. 삼성 인터넷은 메뉴(≡) → 설정 → 사이트 및 다운로드 → 사이트 알림, 크롬은 주소창 자물쇠 → 권한 → 알림에서 허용으로 바꿔 주세요.';
  if (m === 'dismissed') return '알림 허용 창이 닫혔어요. 다시 누르고 [허용]을 눌러 주세요.';
  if (m === 'timeout:permission') return '허용 창이 뜨지 않았어요. 아래 안내대로 알림을 허용한 뒤 다시 눌러 주세요.';
  if (m.startsWith('timeout:sw') || m.startsWith('timeout:ready') || m.startsWith('sw:')) return '앱을 완전히 닫았다가 다시 열고 눌러 주세요. (' + m + ')';
  if (m.startsWith('timeout:server') || m.startsWith('server:')) return '알림 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. (' + m + ')';
  if (m.startsWith('timeout:subscribe') || m.startsWith('subscribe:')) return '이 브라우저에서 알림 등록이 안 돼요. 삼성 인터넷(또는 크롬)을 최신으로 업데이트한 뒤 다시 해 주세요. (' + m + ')';
  if (m.startsWith('save:')) return '알림 정보를 저장하지 못했어요. (' + m + ')';
  return '알림을 켜지 못했어요. (' + m + ')';
}

// 알림 보내기 (실패해도 앱 동작에는 영향 없음). text가 "[제목] 내용" 꼴이면 제목을 떼어 씀
export async function sendPush(db, auth, targets, text, opts = {}) {
  if (!PUSH_URL || !auth.currentUser || !targets || !targets.length) return;
  try {
    let title = opts.title || '더밀착수학', body = text;
    const m = /^\[(.+?)\]\s*([\s\S]*)$/.exec(text || ''); if (m && !opts.title) { title = m[1]; body = m[2]; }
    const subs = [], from = {};
    for (const t of [...new Set(targets)]) {
      try { const d = await getDoc(doc(db, 'push', t)); if (d.exists()) (d.data().subs || []).forEach(s => { if (!subs.some(x => x.endpoint === s.endpoint)) { subs.push(s); from[s.endpoint] = { t, s }; } }); } catch (e) { }
    }
    let mine = null; try { const ms = await mySub(); mine = ms && ms.endpoint; } catch (e) { }
    const list = subs.filter(s => s.endpoint !== mine); if (!list.length) return;
    const tok = await auth.currentUser.getIdToken();
    const r = await fetch(PUSH_URL + '/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ subs: list, title, body, url: opts.url || './', tag: opts.tag || '' }) });
    const res = await r.json().catch(() => ({}));
    if (opts.prune && res.gone && res.gone.length) for (const e of res.gone) { const f = from[e]; if (f) setDoc(doc(db, 'push', f.t), { subs: arrayRemove(f.s) }, { merge: true }).catch(() => { }); }
  } catch (e) { console.warn('알림 전송 실패', e); }
}
