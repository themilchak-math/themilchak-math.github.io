// 전화 상담 요청 (학부모 → 원장님) · 폰 앱·관리자 공용
// calls/{id} = { sid, uid, rel, who, phone, date, from, to, memo, st:'new'|'ok'|'done'|'cancel', at:'15:00', ts }
// 원장님이 정각 하나를 골라 확정하면 학부모님께 알림, 상담 10분 전에 원장님 기기로 알림(알림 서버 예약)
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { PUSH_URL } from './push.js';

export const CALL_HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9시 ~ 22시
export const REMIND_MIN = 10;
export const callOpen = c => c && (c.st === 'new' || c.st === 'ok');
export const hh = h => String(h).padStart(2, '0') + ':00';
export const rangeTxt = c => c.from + '시~' + c.to + '시';
export const callHours = c => { const l = []; for (let h = c.from; h < Math.max(c.to, c.from + 1); h++) l.push(h); return l; };
export const callSort = (a, b) => (a.date + (a.at || hh(a.from))).localeCompare(b.date + (b.at || hh(b.from)));
const remindAt = c => new Date(c.date + 'T' + c.at + ':00+09:00').getTime() - REMIND_MIN * 60e3;

// 원장님 기기들로 '상담 10분 전' 알림 예약 (알림 서버가 1분마다 확인해서 보내요)
export async function scheduleRemind(db, auth, c, label) {
  if (!PUSH_URL || !auth.currentUser) return false;
  try {
    const d = await getDoc(doc(db, 'push', 'teacher')); const subs = d.exists() ? (d.data().subs || []) : [];
    if (!subs.length) return false;
    const tok = await auth.currentUser.getIdToken();
    const r = await fetch(PUSH_URL + '/remind', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ id: c.id, uid: c.uid, at: remindAt(c), subs, title: '📞 ' + REMIND_MIN + '분 뒤 상담 전화', body: label + ' · ' + c.at + (c.phone ? ' · ' + c.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3') : ''), url: './', tag: 'call' + c.id }) });
    return r.ok;
  } catch (e) { console.warn('상담 알림 예약 실패', e); return false; }
}
export async function cancelRemind(auth, id) {
  if (!PUSH_URL || !auth.currentUser) return;
  try { const tok = await auth.currentUser.getIdToken(); await fetch(PUSH_URL + '/remind-del', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ id }) }); } catch (e) { }
}

// 원장님 화면의 상담 요청 목록 (폰 앱은 data-act, 관리자는 data-a)
export function callsHtml(list, h) {
  const A = h.attr;
  if (!list.length) return '<p class="sub" style="margin:0">들어온 상담 요청이 없어요</p>';
  return list.slice().sort(callSort).map(c => {
    const tel = c.phone ? '<a class="btn ' + h.sm + ' ghost" href="tel:' + h.esc(c.phone) + '">📞 ' + h.esc(h.fmtP(c.phone)) + '</a>' : '';
    const head = '<div class="grow"><div class="nm">' + h.esc(c.who || '') + '</div><div class="sub">' + h.fmtD(c.date) + ' · ' + (c.st === 'ok' ? '<b style="color:var(--ok)">' + c.at + ' 확정</b>' : rangeTxt(c) + ' 가능') + (c.memo ? '<br>' + h.esc(c.memo) : '') + '</div></div>';
    const acts = c.st === 'new'
      ? '<select id="ch_' + c.id + '" style="width:auto;min-width:86px">' + callHours(c).map(x => '<option value="' + hh(x) + '">' + hh(x) + '</option>').join('') + '</select><button class="btn ' + h.sm + '" ' + A + '="callOk" data-id="' + c.id + '">확정</button><button class="btn ' + h.sm + ' ghost" ' + A + '="callNo" data-id="' + c.id + '">어려워요</button>'
      : '<button class="btn ' + h.sm + '" ' + A + '="callDone" data-id="' + c.id + '">통화 완료</button><button class="btn ' + h.sm + ' ghost" ' + A + '="callNo" data-id="' + c.id + '">취소</button>';
    return '<div class="row" style="flex-wrap:wrap;gap:6px">' + head + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + tel + acts + '</div></div>';
  }).join('');
}
