// 정밀진단 결과 브리핑 · 입학신청서 출력 (원장님 전용) — brief.html?id=<진단 기록 id>&doc=brief|apply|all
// 모니터에 그대로 띄우고, [인쇄]를 누르면 A4 한 장으로 나와요.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { PARENT, STUDENT, COMPARE, CLASSES, RULES, CONSENT, ans } from './forms.js';

const fb = initializeApp(firebaseConfig); const auth = getAuth(fb); const db = getFirestore(fb);
const P = new URLSearchParams(location.search); const ID = P.get('id') || ''; let VIEW = P.get('doc') || 'brief';
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtP = d => { d = String(d || '').replace(/\D/g, ''); return d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d; };
const fmtD = d => d ? d.replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, da) => y + '. ' + (+mo) + '. ' + (+da) + '.') : '';
const won = n => (+n || 0).toLocaleString('ko-KR');
const v = x => { const t = ans(x); return t ? esc(t) : '<span class="empty">—</span>'; };
let L = null, F = null;

const head = (title, sub) => '<div class="hd"><img src="./icon-192.png?v=2" alt=""><div><h1>' + title + '</h1><small>더(The)밀착수학교습소 · 소수정예 1:1 밀착 수학</small></div><div class="r"><div class="who">' + esc(L.name) + '<span>' + esc([(F && F.apply && F.apply.school) || L.school, (F && F.apply && F.apply.grade) || L.grade].filter(Boolean).join(' ')) + '</span></div>' + esc(sub || '') + '</div></div>';
const foot = () => '<div class="foot"><span>더(The)밀착수학교습소 · 화성시 동탄구 영천동 · 010-4318-0075</span><span>원장 김동진</span></div>';

/* ---------- 결과 브리핑 ---------- */
function brief() {
  const p = (F && F.parent) || {}, s = (F && F.student) || {};
  const pts = L.pts !== '' && L.pts != null ? esc(L.pts) : '—';
  const LOGIC = ['체계적', '식 생략 많음', '개념 적용 흔들림', '속도 느림'], STUCK = ['끝까지 시도', '조건 해석 부족', '포기·찍기'];
  const cmp = COMPARE.map(([t, pk, sk]) => { const a = ans(p[pk]), b = ans(s[sk]); return { t, a, b }; });
  const hasAns = F && (F.parent || F.student);
  const first = ans(p.first), want = ans(s.want);
  return '<div class="page">' + head('정밀진단 결과 브리핑', '진단일 ' + fmtD(L.date)) +
    '<div class="sec"><h2><span class="no">1</span>진단 테스트 결과</h2><div class="score"><div class="big"><b>' + pts + '<small>점</small></b><span>' + esc(L.course || '진단 테스트') + '</span></div><div><div class="kv"><div><small>맞힌 문항</small><b>' + v(L.score) + '</b></div><div><small>소요 시간</small><b>' + (L.mins ? esc(L.mins) + '분 / 60분' : '<span class="empty">—</span>') + '</b></div><div><small>현재 수준·진도</small><b>' + v(L.level) + '</b></div></div>' +
    '<div class="tags"><span class="mut" style="font-size:13px;margin-right:2px">풀이 논리</span>' + LOGIC.map(x => '<span class="tag' + ((L.logic || []).includes(x) ? ' on' : '') + '">' + x + '</span>').join('') + '</div>' +
    '<div class="tags"><span class="mut" style="font-size:13px;margin-right:2px">막힐 때</span>' + STUCK.map(x => '<span class="tag' + (L.stuck === x ? ' on' : '') + '">' + x + '</span>').join('') + '</div></div></div></div>' +
    (hasAns ? '<div class="sec"><h2><span class="no">2</span>어머님이 보신 모습 · 아이가 말한 모습</h2><table><thead><tr><th>주제</th><th>어머님 설문</th><th>학생 설문</th></tr></thead><tbody>' + cmp.map(r => '<tr><td class="t">' + r.t + '</td><td>' + (r.a ? esc(r.a) : '<span class="empty">—</span>') + '</td><td>' + (r.b ? esc(r.b) : '<span class="empty">—</span>') + '</td></tr>').join('') +
      '</tbody></table><p class="legend">같은 주제를 어머님과 학생이 각각 답했어요. 서로 다르게 본 부분이 상담의 출발점이에요.</p></div>' : '') +
    '<div class="sec"><h2><span class="no">' + (hasAns ? 3 : 2) + '</span>진단 소견</h2><div class="grid2"><div class="box"><small>강점</small>' + v(L.strong) + '</div><div class="box"><small>보완 우선</small>' + v(L.weak) + '</div></div>' +
    (L.sum ? '<div class="box hl sum" style="margin-top:8px"><small>종합</small>' + esc(L.sum).replace(/\n/g, '<br>') + '</div>' : '') + '</div>' +
    '<div class="sec"><h2><span class="no">' + (hasAns ? 4 : 3) + '</span>맞춤 처방</h2><div class="rx"><div class="box hl"><small>추천 반 · 요일</small><b>' + v(L.rec) + '</b></div><div class="box"><small>배정 교재</small><b>' + v(L.book) + '</b></div><div class="box"><small>보충 포인트</small><b>' + v(L.fix) + '</b></div></div>' +
    (first || want || p.goal || s.goal ? '<div class="grid2" style="margin-top:8px"><div class="box"><small>어머님 · 가장 먼저 보완하고 싶은 것</small>' + v(first) + (p.goal ? '<div class="mut" style="font-size:13px;margin-top:3px">목표: ' + esc(p.goal) + '</div>' : '') + '</div><div class="box"><small>학생 · 바라는 수업</small>' + v(want) + (s.goal ? '<div class="mut" style="font-size:13px;margin-top:3px">목표: ' + esc(s.goal) + '</div>' : '') + '</div></div>' : '') + '</div>' +
    '<div class="sec"><h2><span class="no">' + (hasAns ? 5 : 4) + '</span>더밀착수학의 수업 방식</h2><div class="grid2">' + RULES.slice(0, 2).map(r => '<div class="box"><small>' + r[0] + '</small>' + esc(r[1]) + '</div>').join('') + '</div></div>' +
    foot() + '</div>';
}

/* ---------- 입학신청서 출력 ---------- */
function applyDoc() {
  const a = F && F.apply; if (!a) return '<div class="msg">아직 입학신청서를 작성하지 않았어요.</div>';
  const ck = (o, cur) => '<span class="ck' + (o === cur ? ' on' : '') + '">' + esc(o) + '</span>';
  const cls = CLASSES.find(c => c.k === a.cls);
  return '<div class="page ap">' + head('입학신청서', '신청일 ' + fmtD(a.date)) +
    '<div class="sec"><h2><span class="no">1</span>학생 · 보호자 정보</h2><table><tbody>' +
    '<tr><th>학생 성명</th><td>' + v(a.name) + '</td><th>생년월일</th><td>' + v(fmtD(a.birth)) + '</td></tr>' +
    '<tr><th>학교 · 학년</th><td>' + v([a.school, a.grade].filter(Boolean).join(' ')) + '</td><th>학생 연락처</th><td>' + v(fmtP(a.pStudent)) + '</td></tr>' +
    '<tr><th>보호자 성명</th><td>' + v(a.gName) + ' &nbsp; ' + ['모', '부', '기타'].map(x => ck(x, a.gRel)).join('') + '</td><th>보호자 연락처</th><td>' + v(fmtP(a.gPhone)) + '</td></tr>' +
    '<tr><th>주소</th><td colspan="3">' + v(a.addr) + '</td></tr>' +
    '<tr><th>귀가 방법</th><td>' + ['보호자 픽업', '도보', '대중교통'].map(x => ck(x, a.back)).join('') + '</td><th>입학 희망일</th><td>' + v(fmtD(a.start)) + '</td></tr>' +
    '<tr><th>등록 경로</th><td colspan="3">' + ['지인', '온라인', '간판', '기타'].map(x => ck(x, a.src)).join('') + '</td></tr></tbody></table></div>' +
    '<div class="sec"><h2><span class="no">2</span>수강 과정</h2><table><tbody><tr><th>과정</th><td>' + CLASSES.map(c => ck(c.label, cls && cls.label)).join('') + '</td></tr>' +
    '<tr><th>교습비 (4주)</th><td>' + (a.price ? won(a.price) + '원' : '상담 후 안내') + ' <span class="mut">· 4주 단위 선납 · 교재비 별도 · 보충 추가 비용 없음</span></td></tr>' +
    '<tr><th>희망 요일</th><td>' + ['월', '화', '수', '목', '금'].map(d => '<span class="ck' + ((a.days || []).includes(d) ? ' on' : '') + '">' + d + '</span>').join('') + ' &nbsp; 등원 가능 시각 ' + v(a.at) + '</td></tr></tbody></table></div>' +
    '<div class="sec"><h2><span class="no">3</span>상담 기초 조사</h2><table><tbody><tr><th>최근 성적</th><td>' + v(a.score) + '</td></tr><tr><th>현재 진도·교재</th><td>' + v(a.cur) + '</td></tr><tr><th>전달 사항</th><td>' + v(a.note) + '</td></tr></tbody></table></div>' +
    '<div class="sec rules"><h2><span class="no">4</span>운영 원칙 및 개인정보 동의</h2>' + RULES.map((r, i) => '<p><b>' + (i + 1) + '. ' + r[0] + '</b> — ' + esc(r[1]) + '</p>').join('') + '<p class="mut" style="font-size:12px">' + esc(CONSENT) + '</p><p>' + ck('동의합니다', a.agree) + ck('동의하지 않습니다', a.agree) + '</p></div>' +
    '<div class="sec"><p style="margin:0 0 6px">위 운영 원칙을 확인하고 입학을 신청합니다. &nbsp; ' + fmtD(a.date) + '</p><table><tbody><tr><th>보호자 서명</th><td>' + (a.signP ? '<img class="sig" src="' + esc(a.signP) + '">' : '') + '</td><th>학생 서명</th><td>' + (a.signS ? '<img class="sig" src="' + esc(a.signS) + '">' : '') + '</td></tr></tbody></table></div>' +
    '<div class="sec"><h2><span class="no">5</span>교습소 확인</h2><table><tbody><tr><th>담당</th><td>' + ['원장', '부원장'].map(x => ck(x, '원장')).join('') + '</td><th>배정 교재</th><td>' + v(L.book) + '</td><th>첫 등원</th><td>' + v(fmtD(a.start)) + '</td></tr></tbody></table></div>' +
    foot() + '</div>';
}

/* ---------- 설문 전체 답변 ---------- */
function allAns() {
  const sec = (title, def, a) => '<h2 style="margin-top:6px">' + title + (a ? '' : ' <span class="mut" style="font-weight:400">· 아직 작성 안 함</span>') + '</h2>' + (a ? def.map(s => '<h3>' + esc(s.sec) + '</h3><table><tbody>' + s.items.filter(i => !i.when || a[i.when[0]] === i.when[1]).map(i => '<tr><td>' + esc(i.q) + '</td><td>' + v(a[i.k]) + (a[i.k + 'Etc'] ? ' (' + esc(a[i.k + 'Etc']) + ')' : '') + '</td></tr>').join('') + '</tbody></table>').join('') : '');
  return '<div class="page long ans">' + head('상담 설문 전체 답변', '원장님 보관용') + sec('학부모 사전 진단 설문', PARENT, F && F.parent) + '<div style="height:10px"></div>' + sec('학생 설문', STUDENT, F && F.student) + foot() + '</div>';
}

function render() {
  if (!L) return;
  const t = [['brief', '결과 브리핑'], ['all', '설문 전체 답변'], ['apply', '입학신청서']];
  app.innerHTML = '<div class="tool"><b>' + esc(L.name) + ' · 상담 자료</b>' + t.map(([k, n]) => '<button data-v="' + k + '" class="' + (VIEW === k ? 'on' : '') + '">' + n + '</button>').join('') + '<button class="pr" data-v="print">🖨 인쇄 · PDF</button></div>' +
    (VIEW === 'apply' ? applyDoc() : VIEW === 'all' ? allAns() : brief());
}
app.addEventListener('click', e => { const b = e.target.closest('.tool button'); if (!b) return; if (b.dataset.v === 'print') return print(); VIEW = b.dataset.v; const u = new URL(location.href); u.searchParams.set('doc', VIEW); history.replaceState(null, '', u); render(); scrollTo(0, 0); });

const msg = t => { app.innerHTML = '<div class="msg">' + t + '</div>'; };
onAuthStateChanged(auth, u => {
  if (!u) return msg('관리자 페이지에서 원장님 계정으로 로그인한 뒤 열어 주세요.<br><br><a href="./admin.html">관리자 페이지로</a>');
  if (!ID) return msg('진단 기록을 찾을 수 없어요.');
  let unF = null;
  onSnapshot(doc(db, 'leads', ID), d => {
    if (!d.exists()) return msg('진단 기록을 찾을 수 없어요.');
    L = d.data();
    if (L.tok && !unF) unF = onSnapshot(doc(db, 'forms', L.tok), f => { F = f.exists() ? f.data() : null; render(); }, () => render());
    render();
  }, () => msg('원장님 계정만 볼 수 있어요.'));
});
