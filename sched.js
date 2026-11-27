// 학생별 수업 예정 (학부모 앱이 "오늘 수업 있는 날인지" 알 수 있게)
// sched/{sid} = { days:[월~토 6칸 true/false], ym:'2026-11', extra:['2026-11-29', ...] }
// - days: 원장님 정산의 등원 요일(이번 달, 없으면 가장 최근 달) → 원장님 기기가 맞춰 둠
// - extra: 보충 배정 날짜(어제 이후) → 원장님·부원장 기기가 맞춰 둠
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function daysFor(sid, name, fin, ym) {
  const yms = Object.keys(fin || {}).filter(k => k <= ym && ((fin[k] || {}).rows || []).length).sort();
  const use = yms.pop(); if (!use) return null;
  const r = fin[use].rows.find(x => x.sid === sid || (!x.sid && x.name === name));
  return { ym: use, days: [0, 1, 2, 3, 4, 5].map(i => !!(r && (r.d || [])[i])) };
}
let busy = false;
export async function syncSched(db, { students, fin, extra, sched, owner, today }) {
  if (busy || !students || !sched) return; busy = true;
  try {
    const ym = today.slice(0, 7); const y = new Date(new Date(today + 'T00:00').getTime() - 864e5); const from = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    for (const s of students) {
      if (s.left) continue;
      const cur = sched[s.id] || {}; const upd = {};
      if (owner && fin) { const d = daysFor(s.id, s.name, fin, ym); if (d && (JSON.stringify(d.days) !== JSON.stringify(cur.days) || d.ym !== cur.ym)) { upd.days = d.days; upd.ym = d.ym; } }
      const ex = Object.keys(extra || {}).filter(d => d >= from && ((extra[d] || {}).sids || []).includes(s.id)).sort();
      if (JSON.stringify(ex) !== JSON.stringify(cur.extra || [])) upd.extra = ex;
      if (Object.keys(upd).length) await setDoc(doc(db, 'sched', s.id), upd, { merge: true });
    }
  } catch (e) { console.warn('sched', e); } finally { busy = false; }
}
// 그날 수업이 있는지: true(정규) / 'extra'(보충) / false(수업 없음) / null(모름)
export function plannedOn(sc, day, offDay) {
  if (sc && (sc.extra || []).includes(day)) return 'extra';
  if (offDay) return false;
  const w = new Date(day + 'T00:00').getDay(); if (w === 0) return false;
  if (!sc || !sc.days) return null;
  return sc.days[w - 1] ? true : false;
}
