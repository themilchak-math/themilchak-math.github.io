// 무료 정밀진단·상담 관리 (원장님 전용, 관리자 페이지)
// leads/{id} = { name, school, grade, pMother, pFather, pStudent, src, date, time, st:'booked'|'done'|'enrolled'|'lost',
//                level, strong, weak, rec, react, memo, next, sid, ts, up }
export const LEAD_SRC = ['네이버 예약', '지인 소개', '블로그·검색', '전단·현수막', '온라인 신청', '기타'];
export const LEAD_ST = [['booked', '진단 예약'], ['done', '진단 완료 · 연락 대기'], ['enrolled', '등록함'], ['lost', '등록 안 함']];
export const LEAD_REACT = ['', '긍정적', '고민 중', '부정적'];
export const stLabel = st => (LEAD_ST.find(x => x[0] === st) || [, st])[1];
export const leadPhone = l => l.pMother || l.pFather || l.pStudent || '';
// 대시보드용: 오늘·내일 진단 예약, 연락할 날이 된 상담
export function leadTodo(leads, today, tomorrow) {
  const soon = leads.filter(l => l.st === 'booked' && (l.date === today || l.date === tomorrow)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const call = leads.filter(l => l.st === 'done' && l.next && l.next <= today).sort((a, b) => a.next.localeCompare(b.next));
  const late = leads.filter(l => l.st === 'booked' && !l.remote && l.date && l.date < today); // 진단일 지났는데 결과 기록 안 함
  const remote = leads.filter(l => l.remote && (l.st === 'booked' || l.st === 'done')); // 비대면 입학신청서 접수 → 등록 처리 대기
  return { soon, call, late, remote, n: soon.length + call.length + late.length + remote.length };
}
// 진단 결과를 학생명부 메모로 넘길 한 줄 요약
export const leadSummary = l => ['정밀진단 ' + (l.date || ''), l.level && '수준: ' + l.level, l.strong && '강점: ' + l.strong, l.weak && '약점: ' + l.weak, l.rec && '추천: ' + l.rec].filter(Boolean).join(' / ');
