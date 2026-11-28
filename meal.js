// 저녁 식대 확인 (원장님 폰 앱·관리자 공용)
// 월~금, 저녁 7시 전에 등원한 학생 + 원장·부원장 = 식사 대상. 저녁 8시에 원장님께 알림 → 안 먹은 사람만 빼고 [저장]
// → 정산 식대 출석표(fin/m_YYYY-MM.meals[이름])에 그날이 자동으로 체크돼요. 확인한 날은 mealOk에 남아요.
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, FieldPath } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const MEAL_CUT = '19:00';
export const isMealDay = day => { const w = new Date(day + 'T00:00').getDay(); return w >= 1 && w <= 5; };
// 식사 대상: 원장·부원장 + 그날 7시 전에 등원한(결석 아님) 재원생
export function mealPeople(students, attDay) {
  const l = students.filter(s => !s.left).filter(s => { const a = attDay[s.id]; return a && a.st !== '결석' && a.at && a.at < MEAL_CUT; })
    .sort((x, y) => (attDay[x.id].at < attDay[y.id].at ? -1 : 1)).map(s => ({ key: s.name, label: s.name, sub: attDay[s.id].at + ' 등원' }));
  return [{ key: '원장', label: '원장', sub: '' }, { key: '부원장', label: '부원장', sub: '' }].concat(l);
}
export const mealDone = (fin, day) => !!fin && (fin.mealOk || []).includes(+day.slice(8));
export const mealAte = (fin, day, key) => !!fin && ((fin.meals || {})[key] || []).includes(+day.slice(8));
// 저장: 대상 중 '안 먹음'으로 뺀 사람은 그날 체크를 지우고, 나머지는 체크해요
export async function saveMeal(db, day, people, noSet) {
  const ym = day.slice(0, 7), d = +day.slice(8); const ref = doc(db, 'fin', 'm_' + ym);
  const s = await getDoc(ref); if (!s.exists()) await setDoc(ref, { ym, rows: [], meals: {} }, { merge: true });
  const args = []; people.forEach(p => { args.push(new FieldPath('meals', p.key), noSet.has(p.key) ? arrayRemove(d) : arrayUnion(d)); });
  args.push('mealOk', arrayUnion(d));
  await updateDoc(ref, ...args);
  return people.length - [...noSet].filter(k => people.some(p => p.key === k)).length;
}
// 카드 HTML (data 속성 이름만 앱/관리자에 맞춰 넘겨요)
export function mealCardHtml({ day, people, no, done, fin, attr, esc, fmtD, busy }) {
  const chips = people.map(p => { const off = no.has(p.key); return '<button type="button" ' + attr + '="mealT" data-k="' + esc(p.key) + '" style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;margin:0 6px 6px 0;padding:7px 12px;border-radius:12px;border:1.5px solid ' + (off ? '#e3e5ef;background:#f4f5f9;color:#9aa0b8;text-decoration:line-through' : '#2b44ff;background:#eef1ff;color:#2b44ff') + ';font-weight:700;cursor:pointer"><span>' + (off ? '✕ ' : '🍚 ') + esc(p.label) + '</span>' + (p.sub ? '<small style="font-weight:400;font-size:11px;opacity:.8">' + esc(p.sub) + '</small>' : '') + '</button>'; }).join('');
  const n = people.length - [...no].filter(k => people.some(p => p.key === k)).length;
  return '<div class="card' + (done ? '' : ' hl') + '" id="mealCard"><h3 style="margin:0 0 4px">🍚 ' + esc(fmtD(day)) + ' 저녁 식대 ' + (done ? '<small style="color:#1f9d55">✓ 저장됨 · ' + people.filter(p => mealAte(fin, day, p.key)).length + '명</small>' : '<small>확인 전</small>') + '</h3>' +
    '<p style="margin:0 0 10px;font-size:13px;color:#5b6180">저녁 7시 전에 등원한 학생과 원장·부원장이에요. <b>저녁을 안 먹은 사람만 눌러서 빼고</b> 저장하세요. 나머지는 먹은 것으로 정산 식대에 체크돼요.</p>' +
    '<div>' + chips + '</div><button type="button" ' + attr + '="mealSave" class="btn" style="width:100%;margin-top:6px"' + (busy ? ' disabled' : '') + '>' + (done ? '다시 저장 (' + n + '명 식사)' : n + '명 식사로 저장') + '</button></div>';
}
