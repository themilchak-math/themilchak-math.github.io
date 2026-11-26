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
  if (Notification.permission === 'granted') { try { if (localStorage.getItem('tmm-push-' + uid) === '1') return 'on'; } catch (e) { } }
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
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ub64u(await vapidKey()) });
  const j = sub.toJSON(); const s = { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
  for (const t of targets) await setDoc(doc(db, 'push', t), { subs: arrayUnion(s) }, { merge: true });
  try { localStorage.setItem('tmm-push-' + uid, '1'); } catch (e) { }
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
