// 더밀착수학 PC 관리자 페이지 (원장님 전용) - 폰 앱(app.js)과 같은 Firebase 데이터를 씀
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { pushState, enablePush, sendPush, pushErrorText, announceUpdate } from './push.js';

const ADMIN_VERSION = '1.3.1';
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const MAIL = '@themilchak-math.app';

/* ---------- 도우미 ---------- */
const pad = n => String(n).padStart(2, '0');
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const off = k => { const d = new Date(); d.setDate(d.getDate() + k); return ds(d); };
const TODAY = off(0);
const WD = '일월화수목금토';
const fmtD = s => { const d = new Date(s + 'T00:00'); return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + WD[d.getDay()] + ')'; };
const hm = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const stamp = () => TODAY + ' ' + hm();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = x => String(x || '').replace(/\D/g, '');
const fmtP = d => d && d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : (d || '');
const now = () => Date.now();
const ST = ['출석', '지각', '결석'];
const REL = { student: '학생', father: '아버님', mother: '어머님' };
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];
const DEF_COURSE = { 중1: '중1-2', 중2: '중2-2', 중3: '중3-2', 고1: '공통수학2', 고2: '대수', 고3: '미적분Ⅰ' };
const CUR = {
  '중1-1': ['소인수분해', '정수와 유리수', '문자의 사용과 식의 계산', '일차방정식', '좌표평면과 그래프'],
  '중1-2': ['기본 도형', '작도와 합동', '평면도형의 성질', '입체도형의 성질', '자료의 정리와 해석'],
  '중2-1': ['유리수와 순환소수', '식의 계산', '일차부등식', '연립일차방정식', '일차함수와 그래프', '일차함수와 일차방정식의 관계'],
  '중2-2': ['삼각형의 성질', '사각형의 성질', '도형의 닮음', '피타고라스 정리', '확률'],
  '중3-1': ['제곱근과 실수', '근호를 포함한 식의 계산', '다항식의 곱셈', '인수분해', '이차방정식', '이차함수와 그래프'],
  '중3-2': ['삼각비', '원의 성질', '대푯값과 산포도', '상관관계'],
  '공통수학1': ['다항식의 연산', '항등식과 나머지정리', '인수분해', '복소수', '이차방정식', '이차방정식과 이차함수', '여러 가지 방정식', '여러 가지 부등식', '경우의 수', '순열과 조합', '행렬과 그 연산'],
  '공통수학2': ['평면좌표', '직선의 방정식', '원의 방정식', '도형의 이동', '집합', '명제', '함수', '합성함수와 역함수', '유리함수', '무리함수'],
  '대수': ['지수와 로그', '지수함수와 로그함수', '삼각함수', '삼각함수의 그래프', '사인법칙과 코사인법칙', '등차수열과 등비수열', '수열의 합', '수학적 귀납법'],
  '미적분Ⅰ': ['함수의 극한', '함수의 연속', '미분계수와 도함수', '도함수의 활용', '부정적분', '정적분', '정적분의 활용'],
  '확률과 통계': ['순열과 조합', '이항정리', '확률의 뜻과 활용', '조건부확률', '이산확률분포', '연속확률분포', '통계적 추정']
};
const COURSES = Object.keys(CUR);
const PCT = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/* ---------- 상태 ---------- */
const D = { students: [], att: {}, threads: {}, hw: [], logs: [], notices: [], req: [], members: [], cfg: null };
const V = { screen: 'loading', page: 'dash', msg: '', busy: false, calM: TODAY.slice(0, 7), chat: null, hwF: 'all', modal: null, bulk: null, qr: null, toast: '' };
const app = document.getElementById('app');
const docs = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
const stu = id => D.students.find(s => s.id === id);
const active = () => D.students.filter(s => !s.left);
const thread = k => D.threads[k] || [];
const mPending = () => D.members.filter(m => m.st === 'pending');
const pending = () => D.req.filter(q => q.st === 'pending' && q.date === TODAY);
const mLabel = m => { const s = stu(m.sid); return (s ? s.name : (m.name || '')) + ' ' + REL[m.rel]; };
const memberOf = (sid, rel) => D.members.find(m => m.sid === sid && m.rel === rel);
const sortLogs = l => [...l].sort((a, b) => (a.date + (a.ts || 0)) < (b.date + (b.ts || 0)) ? -1 : 1);
const lastOf = (sid, course, unit) => sortLogs(D.logs.filter(l => l.sid === sid && l.course === course && l.unit === unit)).pop();
const latest = sid => sortLogs(D.logs.filter(l => l.sid === sid)).pop();
const unitsOf = (sid, course) => { const base = CUR[course] || []; const extra = [...new Set(D.logs.filter(l => l.sid === sid && l.course === course && !base.includes(l.unit)).map(l => l.unit))]; return base.concat(extra); };
const unreadAll = () => Object.values(D.threads).reduce((a, t) => a + t.filter(m => m.f === 'o' && !m.r).length, 0);
const TNAME = () => ((D.cfg && D.cfg.teacher) || '원장') + ' 선생님';
const APP_URL = 'https://themilchak-math.github.io';
const isIOSdev = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function inviteText(m) {
  const s = stu(m.sid); const nm = s ? s.name : (m.name || '');
  const who = m.rel === 'student' ? nm + ' 학생' : nm + ' ' + REL[m.rel];
  const tn = (D.cfg && D.cfg.teacher) || '';
  return '[더밀착수학] 안녕하세요, ' + who + '. ' + (tn ? tn + ' 선생님' : '더밀착수학') + '입니다.\n' + (m.rel === 'student' ? '출결·숙제·수업 기록' : '출결·수업 기록·숙제·공지') + '을 확인하는 교습소 앱 안내드려요.\n\n'
    + '1) 아래 주소 열기 (아이폰은 사파리, 갤럭시는 크롬)\n' + APP_URL + '\n'
    + '2) [처음이에요 · 가입하기] → 이 번호(' + fmtP(m.phone) + ')와 원하는 비밀번호 입력\n'
    + '3) 선생님 승인 후 이용 가능\n'
    + '4) 홈 화면에 추가(설치) → 앱에서 [알림 받기] 누르기' + (m.rel === 'student' && m.grade === '중1' ? '\n※ 부모님이 먼저 가입해 주셔야 학생 가입이 열려요.' : '');
}
const smsHref = (m) => 'sms:' + m.phone + (isIOSdev() ? '&' : '?') + 'body=' + encodeURIComponent(inviteText(m));
const thOf = (sid, rel) => sid + '|' + (rel === 'student' ? 'student' : 'parent');

/* ---------- 화면 조각 ---------- */
const chip = (t, c) => '<span class="chip ' + (c || '') + '">' + esc(t) + '</span>';
const attChip = a => !a ? chip('미등원') : chip(a.st + (a.at ? ' ' + a.at : ''), a.st === '출석' ? 'ok' : a.st === '지각' ? 'warn' : 'bad') + (a.out ? ' ' + chip('하원 ' + a.out, 'pri') : '');
const memChip = m => !m ? '<span class="sub">번호 없음</span>' : m.st === 'ok' ? chip('연결됨', 'ok') : m.st === 'pending' ? chip('승인 대기', 'warn') : m.st === 'block' ? chip('차단', 'bad') : chip('미가입');
const hwChip = h => h.st === 'checked' ? chip('확인 완료', 'ok') : h.st === 'done' ? chip('제출함', 'pri') : h.due < TODAY ? chip('기한 지남', 'bad') : chip('진행 중', 'warn');

const NAV = [['dash', '대시보드'], ['qr', '등원 QR'], ['students', '학생·학부모'], ['att', '출결'], ['log', '수업 기록'], ['hw', '숙제'], ['notice', '공지'], ['msg', '메시지']];
function navBadge(k) {
  const n = k === 'dash' ? mPending().length + pending().length : k === 'qr' ? pending().length : k === 'students' ? mPending().length : k === 'msg' ? unreadAll() : k === 'hw' ? D.hw.filter(h => h.st === 'done').length : 0;
  return n ? '<span class="badge">' + n + '</span>' : '';
}

function joinRows() {
  const l = mPending(); if (!l.length) return '<p class="empty">가입 승인 대기가 없어요</p>';
  return '<table><tbody>' + l.map(m => '<tr><td><b>' + esc(mLabel(m)) + '</b></td><td>' + esc(fmtP(m.phone)) + '</td><td class="sub">' + esc(m.at || '') + ' 요청</td><td class="r"><button class="btn sm ghost" data-a="mRej" data-id="' + m.id + '">거절</button> <button class="btn sm" data-a="mOk" data-id="' + m.id + '">승인</button></td></tr>').join('') + '</tbody></table>';
}
function reqRows() {
  const l = pending(); if (!l.length) return '<p class="empty">승인 대기 중인 등원 요청이 없어요</p>';
  return '<table><tbody>' + l.map(q => { const s = stu(q.sid) || { name: '?', time: '' }; return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(q.at) + ' QR 확인</td><td>' + (q.at > s.time ? chip('지각 (수업 ' + s.time + ')', 'warn') : chip('정시', 'ok')) + '</td><td class="r"><button class="btn sm ghost" data-a="rej" data-id="' + q.id + '">거절</button> <button class="btn sm" data-a="ok" data-id="' + q.id + '">승인</button></td></tr>'; }).join('') + '</tbody></table>';
}

function pDash() {
  const a = D.att[TODAY] || {}; const st = active();
  const present = st.filter(s => a[s.id] && a[s.id].st !== '결석').length;
  const toCheck = D.hw.filter(h => h.st === 'done');
  return '<h1>' + esc(TNAME()) + ' <span class="sub">오늘 ' + fmtD(TODAY) + '</span></h1>' +
    pushCard() + '<div class="kpis"><div><b>' + present + '/' + st.length + '</b><span>오늘 등원</span></div><div><b>' + (mPending().length + pending().length) + '</b><span>승인 대기</span></div><div><b>' + toCheck.length + '</b><span>확인할 숙제</span></div><div><b>' + unreadAll() + '</b><span>새 메시지</span></div></div>' +
    '<div class="grid2"><section class="card"><h2>등원 승인 대기</h2>' + reqRows() + '</section><section class="card"><h2>가입 승인 대기</h2>' + joinRows() + '</section></div>' +
    '<section class="card"><h2>오늘 출결 <span class="sub">' + fmtD(TODAY) + '</span></h2><table><thead><tr><th>학생</th><th>학년</th><th>수업</th><th>상태</th><th>오늘 기록</th></tr></thead><tbody>' +
    st.map(s => { const lg = D.logs.filter(l => l.sid === s.id && l.date === TODAY).pop(); return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.grade) + '</td><td>' + esc(s.time) + '</td><td>' + attChip(a[s.id]) + '</td><td>' + (lg ? esc(lg.unit) + ' · 개념 ' + lg.c + '% · 문제 ' + lg.p + '%' : '<span class="sub">없음</span>') + '</td></tr>'; }).join('') + '</tbody></table></section>' +
    '<section class="card"><h2>확인할 숙제</h2>' + hwTable(toCheck) + '</section>';
}

function pQR() {
  const q = V.qr || {}; const left = q.exp ? Math.max(0, Math.ceil((q.exp - 5000 - now()) / 1000)) : 0;
  return '<h1>등원 QR <span class="sub">학생이 폰 앱으로 이 화면을 찍으면 승인 요청이 와요</span></h1><div class="grid2"><section class="card qrcard"><div id="qrBox"></div><p class="code">' + (q.code ? q.code.slice(0, 3) + ' ' + q.code.slice(3) : '...') + '</p><p class="sub"><b id="qrLeft">' + left + '</b>초 후 새 코드로 바뀌어요 · 카메라가 안 되면 학생이 숫자를 입력해도 돼요</p><p class="sub">이 화면을 열어 둔 동안만 등원 요청을 받을 수 있어요.</p></section><section class="card"><h2>등원 승인 대기</h2>' + reqRows() + '<h2 style="margin-top:20px">오늘 출결</h2><table><tbody>' + active().map(s => '<tr><td><b>' + esc(s.name) + '</b></td><td>수업 ' + esc(s.time) + '</td><td>' + attChip((D.att[TODAY] || {})[s.id]) + '</td></tr>').join('') + '</tbody></table></section></div>';
}

function memCell(s, rel) {
  const m = memberOf(s.id, rel);
  if (!m) return '<span class="sub">-</span>';
  let act = '';
  if (m.st === 'pending') act = '<button class="btn xs" data-a="mOk" data-id="' + m.id + '">승인</button>';
  else if (m.st === 'ok') act = '<button class="btn xs ghost" data-a="mReset" data-id="' + m.id + '" title="비밀번호 분실 시 재가입 허용">비번분실</button><button class="btn xs ghost" data-a="mBlock" data-id="' + m.id + '">차단</button>';
  else if (m.st === 'block') act = '<button class="btn xs ghost" data-a="mUnblock" data-id="' + m.id + '">해제</button>';
  return '<div class="mem"><span>' + esc(fmtP(m.phone)) + '</span> ' + memChip(m) + '<span class="acts">' + act + '</span></div>';
}
function pStudents() {
  const left = D.students.filter(s => s.left);
  return '<h1>학생·학부모 관리 <span class="sub">등록한 번호로만 가입할 수 있어요</span></h1>' +
    '<div class="bar"><button class="btn" data-a="modal" data-v="stu">+ 학생 한 명 등록</button><button class="btn ghost" data-a="modal" data-v="bulk">엑셀에서 여러 명 붙여넣기</button></div>' +
    (mPending().length ? '<section class="card hl"><h2>가입 승인 대기</h2>' + joinRows() + '</section>' : '') +
    '<section class="card"><table class="stu"><thead><tr><th>이름</th><th>학년</th><th>수업</th><th>현재 과정</th><th>학생</th><th>아버님</th><th>어머님</th><th></th></tr></thead><tbody>' +
    (active().length ? active().map(s => '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.grade) + '</td><td>' + esc(s.time) + '</td><td>' + esc(s.course) + '</td><td>' + memCell(s, 'student') + '</td><td>' + memCell(s, 'father') + '</td><td>' + memCell(s, 'mother') + '</td><td class="r">' + (D.members.some(m => m.sid === s.id && m.st === 'none') ? '<button class="btn xs" data-a="invite" data-id="' + s.id + '">안내 문자</button> ' : '') + '<button class="btn xs ghost" data-a="modal" data-v="stu" data-id="' + s.id + '">수정</button></td></tr>').join('') : '<tr><td colspan="8" class="empty">아직 등록된 학생이 없어요</td></tr>') +
    '</tbody></table></section>' +
    (left.length ? '<details class="card"><summary>퇴원한 학생 ' + left.length + '명</summary><table><tbody>' + left.map(s => '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.grade) + '</td><td class="r"><button class="btn xs ghost" data-a="rejoin" data-id="' + s.id + '">복귀</button></td></tr>').join('') + '</tbody></table></details>' : '');
}

function pAtt() {
  const [y, m] = V.calM.split('-').map(Number); const nd = new Date(y, m, 0).getDate();
  const days = Array.from({ length: nd }, (_, i) => y + '-' + pad(m) + '-' + pad(i + 1));
  const head = days.map(d => { const w = new Date(d + 'T00:00').getDay(); return '<th class="' + (w === 0 ? 'sun' : w === 6 ? 'sat' : '') + (d === TODAY ? ' tdy' : '') + '">' + (+d.slice(8)) + '<br><small>' + WD[w] + '</small></th>'; }).join('');
  const rows = active().map(s => {
    const c = [0, 0, 0];
    const cells = days.map(d => {
      const r = (D.att[d] || {})[s.id]; if (r) c[ST.indexOf(r.st)]++;
      const k = r ? (r.st === '출석' ? 'ok' : r.st === '지각' ? 'warn' : 'bad') : '';
      const t = r ? (r.st + (r.at ? ' ' + r.at : '') + (r.out ? ' / 하원 ' + r.out : '')) : (d <= TODAY ? '클릭하면 결석 처리' : '');
      return '<td class="c ' + k + (d === TODAY ? ' tdy' : '') + '" title="' + esc(t) + '"' + (d <= TODAY && (!r || r.st === '결석') ? ' data-a="cellAbs" data-id="' + s.id + '" data-v="' + d + '"' : '') + '>' + (r ? r.st[0] : '') + '</td>';
    }).join('');
    return '<tr><th class="nm">' + esc(s.name) + '</th>' + cells + '<td class="sum">' + c[0] + '</td><td class="sum">' + c[1] + '</td><td class="sum">' + c[2] + '</td></tr>';
  }).join('');
  return '<h1>출결 <span class="sub">칸에 마우스를 올리면 시각이 보여요 · 빈 칸을 누르면 결석 처리, 결석 칸을 누르면 취소</span></h1>' +
    '<div class="bar"><button class="btn sm ghost" data-a="calM" data-v="-1">‹ 이전 달</button><b class="mon">' + y + '년 ' + m + '월</b><button class="btn sm ghost" data-a="calM" data-v="1">다음 달 ›</button><label class="sw"><input type="checkbox" id="autoN" ' + (D.cfg && D.cfg.autoNotify !== false ? 'checked' : '') + '> 등·하원 시 학부모님께 알림 자동 발송</label></div>' +
    '<section class="card scroll"><table class="att"><thead><tr><th class="nm">학생</th>' + head + '<th>출</th><th>지</th><th>결</th></tr></thead><tbody>' + (rows || '<tr><td class="empty">학생이 없어요</td></tr>') + '</tbody></table><p class="sub legend">' + chip('출 출석', 'ok') + ' ' + chip('지 지각', 'warn') + ' ' + chip('결 결석', 'bad') + ' 출석·지각은 학생이 등원 QR을 찍고 원장님이 승인해야 기록돼요.</p></section>';
}

function defaultsFor(s) {
  const l = latest(s.id); const course = l ? l.course : s.course;
  let unit = null;
  if (l && !(l.c === 100 && l.p === 100)) unit = l.unit;
  else unit = unitsOf(s.id, course).find(u => { const x = lastOf(s.id, course, u); return !x || x.c < 100 || x.p < 100; }) || unitsOf(s.id, course)[0];
  const p = unit ? lastOf(s.id, course, unit) : null;
  return { course, unit, c: p ? p.c : 0, pp: p ? p.p : 0 };
}
const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label ?? v) + '</option>';
function pLog() {
  const a = D.att[TODAY] || {};
  const rows = active().map(s => {
    const d = defaultsFor(s); const kc = V.keep && V.keep['lc_' + s.id] && V.keep['lc_' + s.id].v; if (kc && CUR[kc] !== undefined && kc !== d.course) { d.course = kc; d.unit = null; } const done = D.logs.filter(l => l.sid === s.id && l.date === TODAY);
    const came = a[s.id] && a[s.id].st !== '결석';
    return '<tr class="' + (came ? 'came' : '') + '"><td><input type="checkbox" id="lk_' + s.id + '" ' + (came && !done.length ? 'checked' : '') + '></td><td><b>' + esc(s.name) + '</b><div class="sub">' + esc(s.grade) + ' · ' + (a[s.id] ? esc(a[s.id].st) : '미등원') + '</div></td>' +
      '<td><select id="lc_' + s.id + '" data-sid="' + s.id + '" class="lc">' + COURSES.map(c => opt(c, d.course)).join('') + '</select></td>' +
      '<td><select id="lu_' + s.id + '" data-sid="' + s.id + '" class="lu">' + unitsOf(s.id, d.course).map(u => { const x = lastOf(s.id, d.course, u); return opt(u, d.unit, (x && x.c === 100 && x.p === 100 ? '✓ ' : '') + u); }).join('') + '</select></td>' +
      '<td><select id="lpc_' + s.id + '">' + PCT.map(v => opt(String(v), String(d.c), v + '%')).join('') + '</select></td>' +
      '<td><select id="lpp_' + s.id + '">' + PCT.map(v => opt(String(v), String(d.pp), v + '%')).join('') + '</select></td>' +
      '<td><input id="lm_' + s.id + '" placeholder="특별한 일만"></td>' +
      '<td class="cen"><input type="checkbox" id="ls_' + s.id + '" checked></td>' +
      '<td>' + (done.length ? chip('오늘 ' + done.length + '건 저장됨', 'ok') : '') + '</td>' +
      '<td class="r"><button class="btn xs" data-a="saveLog" data-id="' + s.id + '">저장</button></td></tr>';
  }).join('');
  return '<h1>수업 기록 <span class="sub">' + fmtD(TODAY) + ' · 등원한 학생은 미리 체크돼 있어요</span></h1>' +
    '<div class="bar"><button class="btn" data-a="saveChecked">체크한 학생 한꺼번에 저장</button><span class="sub">저장하면 그 학생의 하원 버튼이 열리고, 공유를 켜 둔 기록은 학부모님께 알림이 가요</span></div>' +
    '<section class="card scroll"><table class="log"><thead><tr><th></th><th>학생</th><th>진도 학년·학기</th><th>단원</th><th>개념</th><th>문제풀이</th><th>특별 메모</th><th>공유</th><th></th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="10" class="empty">학생이 없어요</td></tr>') + '</tbody></table></section>' +
    '<section class="card"><h2>최근 기록</h2>' + recentLogs() + '</section>';
}
function recentLogs() {
  const l = sortLogs(D.logs).reverse().slice(0, 30);
  if (!l.length) return '<p class="empty">기록이 없어요</p>';
  return '<table><thead><tr><th>날짜</th><th>학생</th><th>과정</th><th>단원</th><th>개념</th><th>문제</th><th>메모</th><th>공유</th><th></th></tr></thead><tbody>' + l.map(x => { const s = stu(x.sid); return '<tr><td>' + fmtD(x.date) + '</td><td>' + esc(s ? s.name : '?') + '</td><td>' + esc(x.course) + '</td><td>' + esc(x.unit) + '</td><td>' + x.c + '%</td><td>' + x.p + '%</td><td>' + esc(x.cm || '') + '</td><td><button class="btn xs ghost" data-a="togSh" data-id="' + x.id + '">' + (x.sh ? '공유 중' : '비공개') + '</button></td><td class="r"><button class="btn xs ghost" data-a="delLog" data-id="' + x.id + '">삭제</button></td></tr>'; }).join('') + '</tbody></table>';
}

function hwTable(list) {
  if (!list.length) return '<p class="empty">숙제가 없어요</p>';
  return '<table><thead><tr><th>학생</th><th>숙제</th><th>범위</th><th>마감</th><th>상태</th><th>학생 메모</th><th></th></tr></thead><tbody>' + list.map(h => { const s = stu(h.sid); return '<tr><td><b>' + esc(s ? s.name : '?') + '</b></td><td>' + esc(h.title) + '</td><td>' + esc(h.range) + '</td><td>' + fmtD(h.due) + '</td><td>' + hwChip(h) + '</td><td>' + esc(h.note || '') + '</td><td class="r">' + (h.st === 'done' ? '<button class="btn xs" data-a="hwCheck" data-id="' + h.id + '">확인</button> ' : '') + '<button class="btn xs ghost" data-a="hwDel" data-id="' + h.id + '">삭제</button></td></tr>'; }).join('') + '</tbody></table>';
}
function pHw() {
  const f = V.hwF; const list = D.hw.filter(h => f === 'all' || h.sid === f).sort((a, b) => (a.st === 'checked') - (b.st === 'checked') || (a.due > b.due ? 1 : -1));
  return '<h1>숙제</h1><section class="card"><h2>숙제 내기</h2><form id="hwF" class="form"><div class="ck">' + active().map(s => '<label><input type="checkbox" name="hwS" value="' + s.id + '"> ' + esc(s.name) + '</label>').join('') + '</div><div class="row3"><input id="hwT" placeholder="숙제 제목 (예: 쎈 B단계 유형 3)"><input id="hwR" placeholder="범위 (예: p.40~45 짝수)"><input type="date" id="hwD" value="' + off(2) + '"><button class="btn" type="submit">숙제 내기</button></div></form></section>' +
    '<section class="card"><div class="bar"><b>숙제 목록</b><select id="hwFilter">' + opt('all', f, '전체 학생') + active().map(s => opt(s.id, f, s.name)).join('') + '</select></div>' + hwTable(list) + '</section>';
}

function pNotice() {
  const list = [...D.notices].sort((a, b) => (b.pin - a.pin) || ((b.ts || 0) - (a.ts || 0)));
  return '<h1>공지</h1><div class="grid2"><section class="card"><h2>공지 쓰기</h2><form id="ntF" class="form"><input id="nT" placeholder="제목"><textarea id="nB" rows="8" placeholder="내용"></textarea><label class="sw"><input type="checkbox" id="nP"> 상단 고정</label><button class="btn" type="submit">올리기</button></form></section>' +
    '<section class="card"><h2>공지 목록</h2>' + (list.length ? list.map(n => '<div class="notice"><div>' + (n.pin ? chip('고정', 'bad') + ' ' : '') + '<b>' + esc(n.title) + '</b> <span class="sub">' + fmtD(n.at) + ' · 읽음 ' + (n.reads || []).length + '명</span></div><p>' + esc(n.body) + '</p><button class="btn xs ghost" data-a="delN" data-id="' + n.id + '">삭제</button></div>').join('') : '<p class="empty">공지가 없어요</p>') + '</section></div>';
}

function pMsg() {
  const keys = []; active().forEach(s => keys.push(s.id + '|student', s.id + '|parent'));
  const items = keys.map(k => { const t = thread(k); const last = t[t.length - 1]; return { k, last, un: t.filter(m => m.f === 'o' && !m.r).length }; }).sort((a, b) => ((b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0)));
  const list = items.map(i => { const [sid, r] = i.k.split('|'); const s = stu(sid); return '<button class="th' + (V.chat === i.k ? ' on' : '') + '" data-a="open" data-v="' + esc(i.k) + '"><b>' + esc(s.name) + (r === 'parent' ? ' 학부모님' : ' 학생') + '</b>' + (i.un ? '<span class="badge">' + i.un + '</span>' : '') + '<span class="sub ell">' + (i.last ? esc(i.last.t) : '대화 없음') + '</span></button>'; }).join('');
  let chat = '<p class="empty">왼쪽에서 대화를 고르세요</p>';
  if (V.chat) {
    const [sid, r] = V.chat.split('|'); const s = stu(sid); const t = thread(V.chat);
    chat = '<h2>' + esc(s ? s.name : '') + (r === 'parent' ? ' 학부모님' : ' 학생') + '</h2><div class="chat" id="chatBody">' + (t.length ? t.map(m => m.f === 's' ? '<div class="m sys">' + esc(m.t) + '</div>' : '<div class="m ' + (m.f === 't' ? 'me' : 'you') + '">' + esc(m.t) + '<small>' + esc((m.at || '').slice(5)) + (m.f === 't' && m.r ? ' · 읽음' : '') + '</small></div>').join('') : '<p class="empty">첫 메시지를 보내보세요</p>') + '</div><form id="sendF" class="send"><input id="msgIn" placeholder="메시지 입력 후 Enter" autocomplete="off"><button class="btn" type="submit">전송</button></form>';
  }
  return '<h1>메시지</h1><div class="msgs"><section class="card tl">' + (list || '<p class="empty">학생이 없어요</p>') + '</section><section class="card cv">' + chat + '</section></div>';
}

function modalHtml() {
  if (V.modal === 'stu') {
    const s = V.editId ? stu(V.editId) : null;
    const ph = rel => { const m = s && memberOf(s.id, rel); const lock = m && m.st !== 'none'; return '<label>' + REL[rel] + ' 휴대폰' + (lock ? ' <span class="sub">(' + (m.st === 'ok' ? '연결됨' : m.st === 'pending' ? '승인 대기' : '차단') + ' · 바꾸려면 차단 후 새로 등록)</span>' : '') + '<input id="p_' + rel + '" inputmode="numeric" placeholder="없으면 비워두세요" value="' + esc(m ? fmtP(m.phone) : '') + '"' + (lock ? ' disabled' : '') + '></label>'; };
    return '<div class="mbg" data-a="close"><form class="modal" id="stuF"><h2>' + (s ? esc(s.name) + ' 정보 수정' : '학생 등록') + '</h2><label>학생 이름<input id="sN" value="' + esc(s ? s.name : '') + '"></label><div class="row2"><label>학년<select id="sG">' + GRADES.map(g => opt(g, s ? s.grade : '중2')).join('') + '</select></label><label>수업 시작<input type="time" id="sT" value="' + esc(s ? s.time : '16:00') + '"></label></div>' + (s ? '<label>현재 과정<select id="sC">' + COURSES.map(c => opt(c, s.course)).join('') + '</select></label>' : '') + ph('student') + ph('father') + ph('mother') +
      '<p class="sub">가족이 이 번호로 가입하면 승인 요청이 와요. 형제는 같은 부모 번호로 등록하면 이미 가입한 부모님 계정에 자동 연결돼요.</p><div class="mf">' + (s ? '<button type="button" class="btn ghost danger" data-a="leave" data-id="' + s.id + '">퇴원 처리</button>' : '') + '<span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn" type="submit">저장</button></div></form></div>';
  }
  if (V.modal === 'invite') {
    const list = D.members.filter(m => (V.inviteSids || []).includes(m.sid) && m.phone).sort((a, b) => (V.inviteSids.indexOf(a.sid) - V.inviteSids.indexOf(b.sid)) || ['student', 'father', 'mother'].indexOf(a.rel) - ['student', 'father', 'mother'].indexOf(b.rel));
    return '<div class="mbg" data-a="close"><div class="modal wide"><h2>가입 안내 문자 보내기</h2><p class="sub">원장님 휴대폰 문자로 보내요 (무료, 원장님 요금제). <b>PC에서는</b> QR을 폰 카메라로 찍으면 받는 사람과 문구가 채워진 문자 화면이 열려요 → 전송만 누르세요. <b>폰에서는</b> [문자 앱 열기]를 누르면 돼요.</p>' +
      (list.length ? '<table><tbody>' + list.map(m => '<tr><td><b>' + esc(mLabel(m)) + '</b><div class="sub">' + esc(fmtP(m.phone)) + '</div></td><td>' + memChip(m) + '</td><td class="r"><a class="btn xs" href="' + esc(smsHref(m)) + '">문자 앱 열기</a> <button class="btn xs ghost" data-a="invQR" data-id="' + m.id + '">' + (V.invQR === m.id ? 'QR 닫기' : 'QR') + '</button> <button class="btn xs ghost" data-a="invCopy" data-id="' + m.id + '">문구 복사</button></td></tr>' + (V.invQR === m.id ? '<tr><td colspan="3" style="text-align:center"><div id="invQRBox" style="display:inline-block;padding:14px;background:#fff;border:1px solid var(--line);border-radius:14px"></div><p class="sub">폰 기본 카메라로 찍으세요 → 뜨는 알림을 누르면 문자 화면이 열려요</p></td></tr>' : '')).join('') + '</tbody></table>' : '<p class="empty">보낼 번호가 없어요</p>') +
      '<details style="margin-top:8px"><summary class="sub">보낼 문구 미리보기</summary><pre style="white-space:pre-wrap;font:inherit;background:var(--soft);padding:10px;border-radius:10px">' + esc(list[0] ? inviteText(list[0]) : '') + '</pre></details><div class="mf"><span style="flex:1"></span><button type="button" class="btn" data-a="close">닫기</button></div></div></div>';
  }
  if (V.modal === 'bulk') {
    const b = V.bulk;
    return '<div class="mbg" data-a="close"><form class="modal wide" id="bulkF"><h2>엑셀에서 여러 명 붙여넣기</h2><p class="sub">엑셀에서 아래 순서로 열을 맞춰 복사(Ctrl+C)한 뒤 아래 칸에 붙여넣기(Ctrl+V) 하세요. 첫 줄이 제목이면 자동으로 건너뛰어요.<br><b>이름 · 학년(중1~고3) · 수업 시작(16:00) · 학생 번호 · 아버님 번호 · 어머님 번호</b></p><textarea id="bulkIn" rows="7" placeholder="홍길동	중2	16:00	010-1111-2222	010-3333-4444	010-5555-6666"></textarea><button type="button" class="btn ghost" data-a="bulkCheck">미리보기</button>' +
      (b ? '<table><thead><tr><th>이름</th><th>학년</th><th>수업</th><th>학생</th><th>아버님</th><th>어머님</th><th>확인</th></tr></thead><tbody>' + b.map(r => '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.grade) + '</td><td>' + esc(r.time) + '</td><td>' + esc(fmtP(r.student)) + '</td><td>' + esc(fmtP(r.father)) + '</td><td>' + esc(fmtP(r.mother)) + '</td><td>' + (r.err ? chip(r.err, 'bad') : chip('등록 가능', 'ok')) + '</td></tr>').join('') + '</tbody></table>' : '') +
      '<div class="mf"><span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn" type="submit"' + (b && b.some(r => !r.err) ? '' : ' disabled') + '>' + (b ? b.filter(r => !r.err).length + '명 등록' : '등록') + '</button></div></form></div>';
  }
  return '';
}

/* ---------- 그리기 ---------- */
function loginView() {
  return '<div class="login"><form id="loginF" class="card"><h1>더밀착수학 관리자</h1><p class="sub">원장님 계정(폰 앱과 같은 번호·비밀번호)으로 로그인하세요</p>' + (V.msg ? '<p class="err">' + esc(V.msg) + '</p>' : '') + '<label>휴대폰번호<input id="lP" inputmode="numeric" autocomplete="username"></label><label>비밀번호<input id="lW" type="password" autocomplete="current-password"></label><button class="btn" type="submit"' + (V.busy ? ' disabled' : '') + '>로그인</button><p class="sub">관리자 v' + ADMIN_VERSION + ' · <a href="./">폰 앱으로 가기</a></p></form></div>';
}
function render() {
  const keep = {}; let focusId = null;
  app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { keep[el.id] = el.type === 'checkbox' ? { c: el.checked } : { v: el.value }; });
  const hw = {}; app.querySelectorAll('input[name=hwS]').forEach(el => hw[el.value] = el.checked);
  V.keep = keep;
  const ae = document.activeElement; if (ae && ae.id && app.contains(ae)) focusId = ae.id;
  const main = app.querySelector('main'); const sc = main ? main.scrollTop : 0;
  let html;
  if (V.screen === 'loading') html = '<div class="login"><div class="card"><h1>더밀착수학 관리자</h1><p class="sub">불러오는 중...</p></div></div>';
  else if (V.screen === 'login') html = loginView();
  else {
    let page = '';
    try { page = ({ dash: pDash, qr: pQR, students: pStudents, att: pAtt, log: pLog, hw: pHw, notice: pNotice, msg: pMsg }[V.page] || pDash)(); }
    catch (e) { console.error(e); page = '<section class="card"><p class="err">화면 오류: ' + esc(e.message) + '</p></section>'; }
    html = '<aside><div class="brand">더밀착수학<small>관리자</small></div><nav>' + NAV.map(([k, l]) => '<button data-a="go" data-v="' + k + '" class="' + (V.page === k ? 'on' : '') + '">' + l + navBadge(k) + '</button>').join('') + '</nav><div class="foot"><a href="./" target="_blank">폰 앱 열기</a><button data-a="logout">로그아웃</button><small>v' + ADMIN_VERSION + '</small></div></aside><main>' + page + '</main>' + modalHtml();
  }
  if (V.toast) html += '<div class="toast">' + esc(V.toast) + '</div>';
  const same = app.dataset.p === V.page + V.screen;
  app.innerHTML = html; app.dataset.p = V.page + V.screen;
  Object.entries(keep).forEach(([id, k]) => { const el = document.getElementById(id); if (!el || el.disabled) return; if ('c' in k) { if (id !== 'autoN') el.checked = k.c; } else { el.value = k.v; if (el.tagName === 'SELECT' && el.value === '' && el.options.length) el.selectedIndex = 0; } });
  app.querySelectorAll('input[name=hwS]').forEach(el => { if (el.value in hw) el.checked = hw[el.value]; });
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  const nm = app.querySelector('main'); if (nm && same) nm.scrollTop = sc;
  const cb = document.getElementById('chatBody'); if (cb) cb.scrollTop = cb.scrollHeight;
  if (V.page === 'qr' && V.screen === 'app') drawQR();
  if (V.modal === 'invite' && V.invQR) { const box = document.getElementById('invQRBox'); const m = D.members.find(x => x.id === V.invQR); if (box && m && window.QRCode) { box.innerHTML = ''; new window.QRCode(box, { text: 'SMSTO:' + m.phone + ':' + inviteText(m), width: 300, height: 300, correctLevel: window.QRCode.CorrectLevel.L }); } }
}
let rT = null; const sr = () => { if (rT) return; rT = requestAnimationFrame(() => { rT = null; render(); }); };
let tt; const toast = m => { V.toast = m; clearTimeout(tt); tt = setTimeout(() => { V.toast = ''; render(); }, 3000); render(); };
const fail = (e, m) => { console.error(e); toast(m || '저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); };

/* ---------- 등원 QR ---------- */
let qrT = null, qrC = null;
function rand6() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + a[0] % 900000); }
async function qrRotate() { const code = rand6(); const exp = now() + 35000; V.qr = { code, exp }; try { await setDoc(doc(db, 'config', 'qr'), { code, exp }); } catch (e) { fail(e, 'QR을 만들지 못했어요'); } if (V.page === 'qr') render(); }
function qrStart() { if (qrT) return; qrRotate(); qrT = setInterval(qrRotate, 30000); qrC = setInterval(() => { const el = document.getElementById('qrLeft'); if (el && V.qr) el.textContent = Math.max(0, Math.ceil((V.qr.exp - 5000 - now()) / 1000)); }, 1000); }
function qrStop() { clearInterval(qrT); clearInterval(qrC); qrT = null; if (V.qr) { V.qr = null; setDoc(doc(db, 'config', 'qr'), { code: '', exp: 0 }).catch(() => { }); } }
function drawQR() { const box = document.getElementById('qrBox'); if (!box || !V.qr || !window.QRCode) return; box.innerHTML = ''; new window.QRCode(box, { text: 'TMM' + V.qr.code, width: 280, height: 280, correctLevel: window.QRCode.CorrectLevel.M }); }
window.addEventListener('beforeunload', () => qrStop());

/* ---------- 데이터 ---------- */
let unsubs = [];
const L = (q, fn) => unsubs.push(onSnapshot(q, fn, e => console.warn('구독 오류', e.code)));
function subscribe() {
  L(doc(db, 'config', 'main'), d => { D.cfg = d.exists() ? d.data() : null; sr(); });
  L(collection(db, 'students'), s => { D.students = docs(s).sort((a, b) => a.name.localeCompare(b.name, 'ko')); sr(); });
  L(query(collection(db, 'att'), where('date', '>=', off(-400))), s => { D.att = {}; docs(s).forEach(x => { (D.att[x.date] || (D.att[x.date] = {}))[x.sid] = x; }); sr(); });
  L(query(collection(db, 'msgs'), where('ts', '>=', now() - 150 * 864e5)), s => { D.threads = {}; docs(s).forEach(m => (D.threads[m.th] || (D.threads[m.th] = [])).push(m)); Object.values(D.threads).forEach(t => t.sort((a, b) => (a.ts || 0) - (b.ts || 0))); if (V.chat && V.page === 'msg') markRead(V.chat); sr(); });
  L(collection(db, 'hw'), s => { D.hw = docs(s); sr(); });
  L(collection(db, 'logs'), s => { D.logs = docs(s); sr(); });
  L(collection(db, 'notices'), s => { D.notices = docs(s); sr(); });
  L(query(collection(db, 'reqs'), where('st', '==', 'pending')), s => { D.req = docs(s); sr(); });
  L(collection(db, 'members'), s => { D.members = docs(s); sr(); });
}
onAuthStateChanged(auth, user => {
  unsubs.forEach(f => f()); unsubs = []; qrStop();
  if (!user) { V.screen = 'login'; render(); return; }
  V.screen = 'loading'; render();
  const u = onSnapshot(doc(db, 'config', 'main'), d => {
    u();
    if (!d.exists() || d.data().owner !== user.uid) { V.msg = '원장님 계정만 관리자 페이지를 쓸 수 있어요.'; signOut(auth); return; }
    V.screen = 'app'; V.msg = ''; subscribe(); if (V.page === 'qr') qrStart(); render();
    announceUpdate(db, auth);
    try { if ('Notification' in window && Notification.permission === 'granted') enablePush(db, user.uid, ['teacher']).catch(e => console.warn('autoPush', e)); } catch (e) { }
  }, () => { V.msg = '원장님 계정만 관리자 페이지를 쓸 수 있어요.'; signOut(auth); });
});

/* ---------- 쓰기 ---------- */
const msg = (th, sid, f, t) => addDoc(collection(db, 'msgs'), { th, sid, f, t, at: stamp(), ts: now(), r: false });
const push = (targets, text, opts) => { sendPush(db, auth, targets, text, Object.assign({ prune: true }, opts || {})); };
const notifyParent = (sid, t) => { if (D.cfg && D.cfg.autoNotify === false) return Promise.resolve(); push([sid + '|parent'], t); return msg(sid + '|parent', sid, 's', t).catch(e => console.warn(e)); };
function pushCard() {
  const st = pushState(auth.currentUser && auth.currentUser.uid); if (st === 'off' || st === 'on' || V.pushHide) return '';
  const inner = st === 'denied' ? '<p class="sub">이 PC 브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 → 사이트 설정 → 알림 → 허용으로 바꿔 주세요.</p>' : st === 'unsupported' ? '<p class="sub">이 브라우저는 알림을 지원하지 않아요. 크롬이나 엣지에서 열어 주세요.</p>' : '<p class="sub">등원·가입 요청, 숙제 완료, 학생·학부모 메시지가 오면 이 PC에도 알림이 떠요. (폰 앱에서도 따로 켜 주세요)</p><button class="btn" data-a="pushOn">이 PC에서 알림 받기</button>';
  return '<section class="card hl"><h2>알림 받기 <button class="btn xs ghost" data-a="pushHide">나중에</button></h2>' + inner + '</section>';
}
function markRead(k) { if (document.visibilityState !== 'visible') return; const l = thread(k).filter(m => m.f === 'o' && !m.r); if (!l.length) return; const b = writeBatch(db); l.forEach(m => { m.r = true; b.update(doc(db, 'msgs', m.id), { r: true }); }); b.commit().catch(e => console.warn(e)); }
function linkUser(b, m) {
  b.update(doc(db, 'members', m.id), { st: 'ok' });
  b.set(doc(db, 'users', m.uid), { phone: m.phone, sids: arrayUnion(m.sid), rels: { [m.sid]: m.rel }, ths: arrayUnion(thOf(m.sid, m.rel)) }, { merge: true });
  if (m.rel !== 'student') { const kid = memberOf(m.sid, 'student'); if (kid) b.update(doc(db, 'members', kid.id), { guardianOk: true }); }
}
function addMember(b, sid, rel, phone, name, grade) {
  const ex = rel !== 'student' && D.members.find(m => m.phone === phone && m.st === 'ok' && m.uid);
  const m = { sid, rel, phone, st: ex ? 'ok' : 'none', name, grade, guardianOk: false };
  if (ex) { m.uid = ex.uid; b.set(doc(db, 'users', ex.uid), { sids: arrayUnion(sid), rels: { [sid]: rel }, ths: arrayUnion(thOf(sid, rel)) }, { merge: true }); }
  b.set(doc(collection(db, 'members')), m); return !!ex;
}
async function saveLogFor(sid, b) {
  const s = stu(sid); const g = id => (document.getElementById(id) || {}).value || '';
  const course = g('lc_' + sid), unit = g('lu_' + sid), c = +g('lpc_' + sid), p = +g('lpp_' + sid), cm = g('lm_' + sid).trim(), sh = !!(document.getElementById('ls_' + sid) || {}).checked;
  if (!unit) throw new Error(s.name + ': 단원을 골라 주세요');
  const r = (D.att[TODAY] || {})[sid]; const open = r && r.st !== '결석' && !r.out;
  b.set(doc(collection(db, 'logs')), { sid, date: TODAY, course, unit, c, p, cm, sh, ts: now() });
  if (s.course !== course) b.update(doc(db, 'students', sid), { course });
  if (r) b.update(doc(db, 'att', TODAY + '_' + sid), { logged: true });
  if (open) b.set(doc(collection(db, 'msgs')), { th: sid + '|student', sid, f: 's', t: '[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.', at: stamp(), ts: now(), r: false });
  if (sh && !(D.cfg && D.cfg.autoNotify === false)) b.set(doc(collection(db, 'msgs')), { th: sid + '|parent', sid, f: 's', t: '[수업 기록] ' + fmtD(TODAY) + ' ' + course + ' ' + unit + ' · 개념 ' + c + '% · 문제풀이 ' + p + '%', at: stamp(), ts: now(), r: false });
  pendingPush.push(() => { if (open) push([sid + '|student'], '[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.'); if (sh && !(D.cfg && D.cfg.autoNotify === false)) push([sid + '|parent'], '[수업 기록] ' + fmtD(TODAY) + ' ' + course + ' ' + unit + ' · 개념 ' + c + '% · 문제풀이 ' + p + '%'); });
  return s.name;
}
let pendingPush = [];
const flushPush = () => { const l = pendingPush; pendingPush = []; l.forEach(f => f()); };
function parseBulk(txt) {
  const rows = txt.split(/\r?\n/).map(l => l.split(/\t|,/).map(x => x.trim())).filter(r => r.some(x => x));
  if (rows.length && !GRADES.includes(rows[0][1]) && /이름|학생/.test(rows[0][0])) rows.shift();
  const seen = new Set(active().map(s => s.name));
  return rows.map(r => {
    const o = { name: r[0] || '', grade: r[1] || '', time: (r[2] || '16:00').replace(/^(\d):/, '0$1:'), student: digits(r[3]), father: digits(r[4]), mother: digits(r[5]) };
    o.err = !o.name ? '이름 없음' : !GRADES.includes(o.grade) ? '학년은 중1~고3' : !/^\d\d:\d\d$/.test(o.time) ? '시간 형식(16:00)' : [o.student, o.father, o.mother].some(p => p && (p.length < 10 || p.length > 11)) ? '번호 확인' : ![o.student, o.father, o.mother].some(p => p) ? '번호 없음' : seen.has(o.name) ? '이미 있는 이름' : '';
    seen.add(o.name); return o;
  });
}

/* ---------- 이벤트 ---------- */
app.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.dataset.a === 'close' && e.target !== el) return;
  const a = el.dataset.a, id = el.dataset.id, v = el.dataset.v;
  try {
    if (a === 'go') { if (V.page === 'qr' && v !== 'qr') qrStop(); V.page = v; if (v === 'qr') qrStart(); if (v === 'msg' && V.chat) markRead(V.chat); return render(); }
    if (a === 'pushOn') { try { await enablePush(db, auth.currentUser.uid, ['teacher']); toast('이 PC에서 알림이 켜졌어요'); } catch (e) { toast(pushErrorText(e)); } return render(); }
    if (a === 'pushHide') { V.pushHide = true; return render(); }
    if (a === 'logout') { qrStop(); await signOut(auth); return; }
    if (a === 'modal') { V.modal = v; V.editId = id || null; V.bulk = null; return render(); }
    if (a === 'invite') { V.modal = 'invite'; V.inviteSids = [id]; V.invQR = null; return render(); }
    if (a === 'invQR') { V.invQR = V.invQR === id ? null : id; return render(); }
    if (a === 'invCopy') { const m = D.members.find(x => x.id === id); try { await navigator.clipboard.writeText(inviteText(m)); toast('문구를 복사했어요. 카톡·문자에 붙여넣으세요'); } catch (e) { toast('복사하지 못했어요'); } return; }
    if (a === 'close') { V.modal = null; V.editId = null; V.bulk = null; return render(); }
    if (a === 'calM') { let [y, m] = V.calM.split('-').map(Number); m += +v; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } V.calM = y + '-' + pad(m); return render(); }
    if (a === 'open') { V.chat = v; markRead(v); return render(); }
    if (a === 'bulkCheck') { V.bulk = parseBulk(document.getElementById('bulkIn').value); return render(); }
    if (a === 'mOk') { const m = D.members.find(x => x.id === id); if (!m || !m.uid) return; const all = D.members.filter(x => x.uid === m.uid && x.st === 'pending'); const b = writeBatch(db); all.forEach(x => linkUser(b, x)); await b.commit(); for (const x of all) if (x.rel !== 'student') await msg(thOf(x.sid, x.rel), x.sid, 's', '[가입 승인] ' + mLabel(x) + '으로 연결되었어요. 환영합니다!'); push([...new Set(all.map(x => thOf(x.sid, x.rel)))], '[가입 승인] 더밀착수학 앱 이용이 승인됐어요. 앱을 열어 주세요.'); return toast(all.map(mLabel).join(', ') + ' 승인 완료'); }
    if (a === 'mRej') { const m = D.members.find(x => x.id === id); const all = D.members.filter(x => x.uid && x.uid === m.uid && x.st === 'pending'); const b = writeBatch(db); all.forEach(x => b.update(doc(db, 'members', x.id), { st: 'none', uid: deleteField() })); await b.commit(); return toast(mLabel(m) + ' 가입을 거절했어요'); }
    if (a === 'mBlock' || a === 'mReset') { const m = D.members.find(x => x.id === id); const b = writeBatch(db); b.update(doc(db, 'members', m.id), a === 'mBlock' ? { st: 'block' } : { st: 'none', uid: deleteField() }); if (m.uid) b.set(doc(db, 'users', m.uid), { sids: arrayRemove(m.sid), ths: arrayRemove(thOf(m.sid, m.rel)) }, { merge: true }); await b.commit(); return toast(a === 'mBlock' ? mLabel(m) + ' 접속을 차단했어요' : '재가입 가능 상태예요. Firebase 콘솔 Authentication에서 ' + fmtP(m.phone) + ' 계정을 삭제해 주세요.'); }
    if (a === 'mUnblock') { const m = D.members.find(x => x.id === id); if (!m.uid) return; const b = writeBatch(db); linkUser(b, m); await b.commit(); return toast('차단을 해제했어요'); }
    if (a === 'leave') {
      const s = stu(id); if (V.confirmLeave !== id) { V.confirmLeave = id; el.textContent = '한 번 더 누르면 퇴원 처리'; setTimeout(() => { V.confirmLeave = null; }, 4000); return; }
      const b = writeBatch(db); b.update(doc(db, 'students', id), { left: true, leftAt: TODAY });
      D.members.filter(m => m.sid === id && m.st !== 'none' && m.st !== 'block').forEach(m => { b.update(doc(db, 'members', m.id), { st: 'block' }); if (m.uid) b.set(doc(db, 'users', m.uid), { sids: arrayRemove(id), ths: arrayRemove(thOf(id, m.rel)) }, { merge: true }); });
      await b.commit(); V.modal = null; V.editId = null; V.confirmLeave = null; return toast(s.name + ' 퇴원 처리했어요. 가족 계정의 이 학생 연결도 끊었어요.');
    }
    if (a === 'rejoin') { await updateDoc(doc(db, 'students', id), { left: false }); return toast('복귀 처리했어요. 가족 연결은 학생 관리에서 차단 해제해 주세요.'); }
    if (a === 'ok' || a === 'rej') {
      const q = D.req.find(x => x.id === id); if (!q) return; const s = stu(q.sid);
      if (a === 'rej') { await updateDoc(doc(db, 'reqs', q.id), { st: 'rej' }); await msg(q.sid + '|student', q.sid, 's', '[등원 요청 반려] 선생님께 직접 말씀드려 주세요.'); push([q.sid + '|student'], '[등원 요청 반려] 선생님께 직접 말씀드려 주세요.'); return toast(s.name + ' 등원 요청을 거절했어요'); }
      const st = q.at > s.time ? '지각' : '출석'; const b = writeBatch(db);
      b.update(doc(db, 'reqs', q.id), { st: 'ok' });
      b.set(doc(db, 'att', TODAY + '_' + q.sid), { sid: q.sid, date: TODAY, st, at: q.at, by: 'qr', logged: D.logs.some(l => l.sid === q.sid && l.date === TODAY) });
      await b.commit();
      await notifyParent(q.sid, '[등원 알림] ' + s.name + ' 학생이 ' + q.at + '에 등원했습니다. (QR 확인 · 선생님 승인' + (st === '지각' ? ' · 수업 ' + s.time + ' 시작, 지각' : '') + ')');
      return toast(s.name + ' ' + st + ' 승인');
    }
    if (a === 'cellAbs') {
      const r = (D.att[v] || {})[id]; const s = stu(id);
      if (r && r.st === '결석') { await deleteDoc(doc(db, 'att', v + '_' + id)); return toast(s.name + ' ' + fmtD(v) + ' 결석 취소'); }
      await setDoc(doc(db, 'att', v + '_' + id), { sid: id, date: v, st: '결석', at: '', by: 'teacher' });
      if (v === TODAY) await notifyParent(id, '[출결 알림] ' + s.name + ' 학생이 오늘 결석으로 처리되었습니다.');
      return toast(s.name + ' ' + fmtD(v) + ' 결석 처리');
    }
    if (a === 'saveLog') { const b = writeBatch(db); pendingPush = []; const n = await saveLogFor(id, b); await b.commit(); flushPush(); return toast(n + ' 수업 기록 저장'); }
    if (a === 'saveChecked') {
      const ids = active().filter(s => (document.getElementById('lk_' + s.id) || {}).checked).map(s => s.id);
      if (!ids.length) return toast('저장할 학생을 체크해 주세요');
      const b = writeBatch(db); const names = []; pendingPush = []; for (const sid of ids) names.push(await saveLogFor(sid, b)); await b.commit(); flushPush();
      return toast(names.length + '명 수업 기록 저장: ' + names.join(', '));
    }
    if (a === 'togSh') { const x = D.logs.find(l => l.id === id); await updateDoc(doc(db, 'logs', id), { sh: !x.sh }); return; }
    if (a === 'delLog') { await deleteDoc(doc(db, 'logs', id)); return toast('기록을 삭제했어요'); }
    if (a === 'hwCheck') { await updateDoc(doc(db, 'hw', id), { st: 'checked' }); return toast('숙제 확인 완료'); }
    if (a === 'hwDel') { await deleteDoc(doc(db, 'hw', id)); return toast('숙제를 삭제했어요'); }
    if (a === 'delN') { await deleteDoc(doc(db, 'notices', id)); return toast('공지를 삭제했어요'); }
  } catch (err) { fail(err, err.message && !err.code ? err.message : undefined); }
});

app.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.id === 'autoN') { await updateDoc(doc(db, 'config', 'main'), { autoNotify: t.checked }); return toast(t.checked ? '자동 알림 켬' : '자동 알림 끔'); }
    if (t.id === 'hwFilter') { V.hwF = t.value; return render(); }
    if (t.classList.contains('lc')) {
      const sid = t.dataset.sid; const us = unitsOf(sid, t.value); const sel = document.getElementById('lu_' + sid);
      sel.innerHTML = us.map(u => opt(u, '', u)).join(''); const nx = us.find(u => { const x = lastOf(sid, t.value, u); return !x || x.c < 100 || x.p < 100; }) || us[0]; if (nx) sel.value = nx; setPrev(sid, t.value, sel.value);
      const ck = document.getElementById('lk_' + sid); if (ck) ck.checked = true; return;
    }
    if (t.classList.contains('lu')) { const sid = t.dataset.sid; setPrev(sid, document.getElementById('lc_' + sid).value, t.value); const ck = document.getElementById('lk_' + sid); if (ck) ck.checked = true; return; }
    if (/^l(pc|pp|m)_/.test(t.id)) { const ck = document.getElementById('lk_' + t.id.split('_')[1]); if (ck) ck.checked = true; }
  } catch (err) { fail(err); }
});
function setPrev(sid, course, unit) { const x = lastOf(sid, course, unit); document.getElementById('lpc_' + sid).value = String(x ? x.c : 0); document.getElementById('lpp_' + sid).value = String(x ? x.p : 0); }

app.addEventListener('submit', async e => {
  e.preventDefault(); const g = id => (document.getElementById(id) || {}).value || ''; const f = e.target.id;
  try {
    if (f === 'loginF') { const ph = digits(g('lP')); if (ph.length < 10) { V.msg = '휴대폰번호를 확인해 주세요'; return render(); } V.busy = true; V.msg = ''; render(); try { await signInWithEmailAndPassword(auth, ph + MAIL, g('lW')); } catch (err) { V.msg = '번호나 비밀번호가 맞지 않아요.'; } V.busy = false; return render(); }
    if (f === 'sendF') { const t = g('msgIn').trim(); if (!t || !V.chat) return; document.getElementById('msgIn').value = ''; await msg(V.chat, V.chat.split('|')[0], 't', t); push([V.chat], t, { title: TNAME() + ' 메시지', tag: 'm' + V.chat }); return; }
    if (f === 'hwF') {
      const ids = [...document.querySelectorAll('input[name=hwS]:checked')].map(x => x.value); const title = g('hwT').trim();
      if (!ids.length || !title) return toast('학생과 제목을 입력해 주세요');
      const due = g('hwD') || TODAY; const b = writeBatch(db);
      ids.forEach(sid => { b.set(doc(collection(db, 'hw')), { sid, title, range: g('hwR').trim() || '-', due, st: 'todo', note: '', ts: now() }); b.set(doc(collection(db, 'msgs')), { th: sid + '|student', sid, f: 's', t: '[새 숙제] ' + title + ' · 마감 ' + fmtD(due), at: stamp(), ts: now(), r: false }); });
      await b.commit(); push(ids.map(x => x + '|student'), '[새 숙제] ' + title + ' · 마감 ' + fmtD(due)); ['hwT', 'hwR'].forEach(i => document.getElementById(i).value = ''); document.querySelectorAll('input[name=hwS]').forEach(x => x.checked = false);
      return toast(ids.length + '명에게 숙제를 냈어요');
    }
    if (f === 'ntF') { if (!g('nT').trim()) return toast('제목을 입력해 주세요'); await addDoc(collection(db, 'notices'), { title: g('nT').trim(), body: g('nB').trim(), at: TODAY, pin: document.getElementById('nP').checked, reads: [], ts: now() }); push(active().flatMap(x => [x.id + '|student', x.id + '|parent']), g('nT').trim(), { title: '새 공지', tag: 'notice' }); document.getElementById('nT').value = ''; document.getElementById('nB').value = ''; return toast('공지를 올렸어요'); }
    if (f === 'stuF') {
      const name = g('sN').trim(); if (!name) return toast('이름을 입력해 주세요');
      const grade = g('sG'), time = g('sT') || '16:00'; const ph = { student: digits(g('p_student')), father: digits(g('p_father')), mother: digits(g('p_mother')) };
      if (Object.values(ph).some(x => x && (x.length < 10 || x.length > 11))) return toast('휴대폰번호를 확인해 주세요');
      const b = writeBatch(db); let auto = false; let newSid = null;
      if (V.editId) {
        const sid = V.editId; b.update(doc(db, 'students', sid), { name, grade, time, course: g('sC') || stu(sid).course });
        for (const rel of ['student', 'father', 'mother']) {
          const m = memberOf(sid, rel); const p = ph[rel];
          if (m && m.st !== 'none') continue;
          if (m && !p) b.delete(doc(db, 'members', m.id));
          else if (m && p !== m.phone) b.update(doc(db, 'members', m.id), { phone: p, name, grade });
          else if (m) b.update(doc(db, 'members', m.id), { name, grade });
          else if (p) auto = addMember(b, sid, rel, p, name, grade) || auto;
        }
      } else {
        if (!Object.values(ph).some(x => x)) return toast('번호를 하나 이상 등록해 주세요');
        const ref = doc(collection(db, 'students')); newSid = ref.id; b.set(ref, { name, grade, time, course: DEF_COURSE[grade], ts: now() });
        Object.entries(ph).forEach(([rel, p]) => { if (p) auto = addMember(b, ref.id, rel, p, name, grade) || auto; });
      }
      await b.commit(); V.modal = null; const ed = V.editId; V.editId = null;
      if (!ed && newSid) { V.modal = 'invite'; V.inviteSids = [newSid]; V.invQR = null; }
      return toast(name + (ed ? ' 정보를 저장했어요' : ' 등록 완료') + (auto ? ' · 형제 부모님 계정에 자동 연결' : ''));
    }
    if (f === 'bulkF') {
      const ok = (V.bulk || []).filter(r => !r.err); if (!ok.length) return;
      const b = writeBatch(db);
      const sids = []; ok.forEach(r => { const ref = doc(collection(db, 'students')); sids.push(ref.id); b.set(ref, { name: r.name, grade: r.grade, time: r.time, course: DEF_COURSE[r.grade], ts: now() }); ['student', 'father', 'mother'].forEach(rel => { if (r[rel]) addMember(b, ref.id, rel, r[rel], r.name, r.grade); }); });
      await b.commit(); V.bulk = null; V.modal = 'invite'; V.inviteSids = sids; V.invQR = null; return toast(ok.length + '명 등록 완료 · 가입 안내 문자를 보내 주세요');
    }
  } catch (err) { fail(err); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && V.modal) { V.modal = null; V.editId = null; render(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ds(new Date()) !== TODAY) return location.reload(); if (document.visibilityState === 'visible' && V.chat && V.page === 'msg') markRead(V.chat); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { });
render();
