// 더밀착수학 PC 관리자 페이지 (원장님 전용) - 폰 앱(app.js)과 같은 Firebase 데이터를 씀
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { SUBJS, CUR, BY_SUBJ, GROUPS, subjOf, defCourse, courseLabel, lessonSummary, ACT, ACT_UNITS, isAct } from './subjects.js';
import { pushState, enablePush, sendPush, pushErrorText, announceUpdate } from './push.js';
import { readXlsx, writeXlsx, xlDate, download } from './xlsx.js';
import { buildItems, calHtml } from './calendar.js';

const ADMIN_VERSION = '2.5.6';
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const MAIL = '@themilchak-math.app';

/* ---------- 도우미 ---------- */
const pad = n => String(n).padStart(2, '0');
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
// 하루의 경계 = 새벽 3시 (새벽 3시 전 하원은 전날 등원에 대한 하원)
const DAY_CUT = 3;
const off = k => { const d = new Date(Date.now() - DAY_CUT * 36e5); d.setDate(d.getDate() + k); return ds(d); };
const lateLabel = t => t && t < '0' + DAY_CUT + ':00' ? '새벽 ' + t : t;
const tMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return (h < DAY_CUT ? h + 24 : h) * 60 + m; };
const TODAY = off(0);
const WD = '일월화수목금토';
const fmtD = s => { const d = new Date(s + 'T00:00'); return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + WD[d.getDay()] + ')'; };
const hm = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const stamp = () => ds(new Date()) + ' ' + hm();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = x => String(x || '').replace(/\D/g, '');
const fmtP = d => d && d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d && d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : (d || '');
const hyP = v => { const d = String(v || '').replace(/\D/g, '').slice(0, 11); return d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.length < 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : fmtP(d); };
const isTelInput = t => t && t.tagName === 'INPUT' && /^(p_|lP$|sfP$)|_p_/.test(t.id || '');
const now = () => Date.now();
const ST = ['출석', '지각', '결석'];
const REL = { student: '학생', father: '아버님', mother: '어머님' };
const GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const DEF_COURSE = { 초4: '중1-1', 초5: '중1-1', 초6: '중1-1', 중1: '중1-2', 중2: '중2-2', 중3: '중3-2', 고1: '공통수학2', 고2: '대수', 고3: '미적분Ⅰ' };
const COURSES = Object.keys(BY_SUBJ['수학']);
const PCT = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/* ---------- 상태 ---------- */
const D = { students: [], att: {}, threads: {}, hw: [], logs: [], notices: [], req: [], members: [], exams: [], staff: [], abs: [], extra: {}, apply: [], fin: {}, finSet: null, sinfo: {}, cfg: null };
const V = { screen: 'loading', page: 'dash', msg: '', busy: false, calM: TODAY.slice(0, 7), chat: null, hwF: 'all', modal: null, bulk: null, toast: '' };
const app = document.getElementById('app');
const docs = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
const stu = id => D.students.find(s => s.id === id);
const active = () => D.students.filter(s => !s.left);
const thread = k => D.threads[k] || [];
// 형제: 같은 학부모 번호로 연결된 학생들 → 학부모 대화는 하나로 묶어 "김승효/우현 학부모님"
const famSids = sid => { const ph = new Set(D.members.filter(m => m.sid === sid && m.rel !== 'student' && m.phone).map(m => m.phone)); const l = [...new Set([sid, ...D.members.filter(m => m.rel !== 'student' && ph.has(m.phone)).map(m => m.sid)])].filter(x => stu(x)); return l.sort((a, b) => stu(a).name.localeCompare(stu(b).name, 'ko')); };
const famLabel = (sid, suf) => { suf = ' ' + (suf || '학부모님'); const l = famSids(sid).map(x => stu(x).name); if (l.length < 2) return (l[0] || (stu(sid) || {}).name || '') + suf; return l[0] + '/' + l.slice(1).map(n => n[0] === l[0][0] ? n.slice(1) : n).join('/') + suf; };
// 대화: 아버님·어머님 각자 따로(|father, |mother). |parent 는 자동 알림 공용함 → 두 분 대화에 모두 보여요
const PREL = ['father', 'mother'];
const famKeys = k => { const [sid, r] = k.split('|'); return PREL.includes(r) ? famSids(sid).flatMap(x => [x + '|' + r, x + '|parent']) : r === 'parent' ? famSids(sid).map(x => x + '|parent') : [k]; };
// 대화방은 앱에 가입(승인 대기 포함)한 사람만. 미가입·차단은 목록에서 빼요
const joined = m => m && m.uid && (m.st === 'ok' || m.st === 'pending');
const parKeys = sid => { const f = famSids(sid); return PREL.filter(r => D.members.some(m => f.includes(m.sid) && m.rel === r && joined(m))).map(r => sid + '|' + r); };
const stuKey = sid => joined(D.members.find(m => m.sid === sid && m.rel === 'student')) ? [sid + '|student'] : [];
const fthread = k => famKeys(k).flatMap(x => thread(x)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
const mPending = () => D.members.filter(m => m.st === 'pending');
const pending = () => D.req.filter(q => q.st === 'pending' && q.date === TODAY);
const mLabel = m => { const s = stu(m.sid); return (s ? s.name : (m.name || '')) + ' ' + REL[m.rel]; };
const memberOf = (sid, rel) => D.members.find(m => m.sid === sid && m.rel === rel);
const sortLogs = l => [...l].sort((a, b) => (a.date + (a.ts || 0)) < (b.date + (b.ts || 0)) ? -1 : 1);
const lastOf = (sid, course, unit) => sortLogs(D.logs.filter(l => l.sid === sid && l.course === course && l.unit === unit)).pop();
const latest = sid => sortLogs(D.logs.filter(l => l.sid === sid && !isAct(l))).pop();
const latestIn = (sid, sj) => sortLogs(D.logs.filter(l => l.sid === sid && subjOf(l) === sj)).pop();
const courseOpts = (sj, cur) => GROUPS[sj].map(([g, cs]) => '<optgroup label="' + g + '">' + cs.map(c => opt(c, cur)).join('') + '</optgroup>').join('');
const unitsOf = (sid, course) => { const base = CUR[course] || []; const extra = [...new Set(D.logs.filter(l => l.sid === sid && l.course === course && !base.includes(l.unit)).map(l => l.unit).filter(Boolean))]; return base.concat(extra); };
const unreadAll = () => Object.values(D.threads).reduce((a, t) => a + t.filter(m => m.f === 'o' && !m.r).length, 0);
const TNAME = () => V.staff && V.staff.name ? V.staff.name + ' 부원장님' : ((D.cfg && D.cfg.teacher) ? D.cfg.teacher + ' 원장님' : '원장님');
const isOwnerMe = () => !!(D.cfg && auth.currentUser && D.cfg.owner === auth.currentUser.uid);
const APP_URL = 'https://themilchak-math.github.io';
const isIOSdev = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function inviteText(m) {
  const s = stu(m.sid); const nm = s ? s.name : (m.name || '');
  const who = m.rel === 'student' ? nm + ' 학생' : nm + ' ' + REL[m.rel];
  const tn = (D.cfg && D.cfg.teacher) || '';
  return '[더밀착수학] 안녕하세요, ' + who + '. ' + (tn ? '더밀착수학 ' + tn + ' 원장' : '더밀착수학') + '입니다.\n' + (m.rel === 'student' ? '출결·숙제·수업 기록' : '출결·수업 기록·숙제·공지') + '을 확인하는 교습소 앱 안내드려요.\n\n'
    + '▶ 설치 안내 (아이폰·갤럭시 따로 정리돼 있어요)\n' + APP_URL + '/install.html\n\n'
    + '가입할 때 이 번호(' + fmtP(m.phone) + ')와 원하는 비밀번호를 넣어 주세요. 선생님 승인 후 바로 이용할 수 있어요.\n'
    + '설치 후 앱에서 [알림 받기]를 꼭 눌러 주세요.' + (m.rel === 'student' && m.grade === '중1' ? '\n※ 부모님이 먼저 가입해 주셔야 학생 가입이 열려요.' : '');
}
const shortInvite = m => '[더밀착수학] ' + mLabel(m) + ' 앱 안내\n설치: https://themilchak-math.github.io/install.html\n가입 번호: ' + fmtP(m.phone) + ' (비밀번호는 원하는 걸로)';
const KAKAO_JS_KEY = '1a4da179bbea2afbb606a5d77bf4caf4';
function kakaoReady() {
  if (window.Kakao && Kakao.isInitialized && Kakao.isInitialized()) return Promise.resolve(true);
  return new Promise(res => {
    const go = () => { try { if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY); res(true); } catch (e) { res(false); } };
    if (window.Kakao) return go();
    const sc = document.createElement('script'); sc.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'; sc.crossOrigin = 'anonymous';
    sc.onload = go; sc.onerror = () => res(false); document.head.appendChild(sc);
  });
}
async function kakaoInvite(m) {
  if (!(await kakaoReady())) return toast('카카오톡 공유를 불러오지 못했어요. [문구 복사]를 써 주세요');
  const inst = APP_URL + '/install.html';
  try {
    Kakao.Share.sendDefault({ objectType: 'feed',
      content: { title: '[더밀착수학] ' + mLabel(m) + ' 앱 설치 안내', description: '가입 번호: ' + fmtP(m.phone) + ' (비밀번호는 원하는 걸로) · 설치 후 [알림 받기]를 꼭 눌러 주세요',
        imageUrl: APP_URL + '/icon-512.png?v=2', imageWidth: 512, imageHeight: 512, link: { mobileWebUrl: inst, webUrl: inst } },
      buttons: [{ title: '설치 안내 보기', link: { mobileWebUrl: inst, webUrl: inst } }] });
  } catch (e) { toast('카카오톡 공유를 열지 못했어요: ' + (e.message || e)); }
}
const smsHref = (m) => 'sms:' + m.phone + (isIOSdev() ? '&' : '?') + 'body=' + encodeURIComponent(inviteText(m));
const thOf = (sid, rel) => sid + '|' + (rel === 'student' ? 'student' : 'parent');
const thsOf = (sid, rel) => rel === 'student' ? [sid + '|student'] : [sid + '|parent', sid + '|' + rel];

/* ---------- 화면 조각 ---------- */
// 미등원 안내: 오늘 이미 보냈으면 보낸 시각
const noshowAt = sid => { const m = thread(sid + '|parent').filter(x => /^\[미등원 안내\]/.test(x.t || '') && (x.at || '').startsWith(TODAY)).pop(); return m ? (m.at || '').slice(11, 16) : ''; };
const noshowTxt = s => '[미등원 안내] ' + s.name + ' 학생이 아직 등원하지 않았어요. 혹시 늦거나 못 오게 되면 원장님께 알려 주세요.';
const noshowBtn = (x, day) => day !== TODAY ? '' : (noshowAt(x.id) ? ' <span class="chip ok" title="부모님께 미등원 안내를 보냈어요">안내 ' + noshowAt(x.id) + '</span>' : ' <button class="btn xs ghost" data-a="noshow" data-id="' + x.id + '">미등원 안내</button>');
const chip = (t, c) => '<span class="chip ' + (c || '') + '">' + esc(t) + '</span>';
const isIn = r => !!r && r.st !== '결석';
const attChip = a => !a ? chip('미등원') : a.st === '결석' ? chip('결석', 'bad') : chip('등원' + (a.at ? ' ' + a.at : ''), 'ok') + (a.out ? ' ' + chip('하원 ' + lateLabel(a.out), 'pri') : '');
const memChip = m => !m ? '<span class="sub">번호 없음</span>' : m.st === 'ok' ? chip('연결됨', 'ok') : m.st === 'pending' ? chip('승인 대기', 'warn') : m.st === 'block' ? chip('차단', 'bad') : chip('미가입');
const hwChip = h => h.st === 'checked' ? chip('확인 완료', 'ok') : h.st === 'done' ? chip('제출함', 'pri') : h.due < TODAY ? chip('기한 지남', 'bad') : chip('진행 중', 'warn');

const absOf = (sid, d) => D.abs.find(x => x.sid === sid && x.date === d);
const clsChip = (r, e, ab) => r && r.st === '결석' ? chip('결석', 'bad') : r && r.out ? chip('완료', 'pri') : r ? chip('수업중', 'ok') : ab ? chip('결석 통보', 'bad') : e ? chip('예정', 'warn') : chip('없음');

const NAV0 = [['dash', '대시보드'], ['att', '출결'], ['log', '수업 기록'], ['hw', '숙제'], ['students', '학생 관리'], ['fin', '정산'], ['exam', '일정 등록'], ['notice', '공지'], ['msg', '메시지'], ['staff', '부원장']];
const STAFF_PAGES = ['dash', 'att', 'log', 'hw', 'notice', 'msg']; // 부원장이 쓸 수 있는 메뉴
const navList = () => NAV0.filter(([k]) => isOwnerMe() || STAFF_PAGES.includes(k));
function navBadge(k) {
  const n = k === 'dash' ? mPending().length + pending().length + D.apply.length : k === 'students' ? mPending().length + D.apply.length : k === 'msg' ? unreadAll() : k === 'hw' ? D.hw.filter(h => h.st === 'done').length : k === 'staff' ? D.staff.filter(x => x.st === 'pending').length : k === 'school' ? active().filter(s => !s.school).length : 0;
  return n ? '<span class="badge">' + n + '</span>' : '';
}

function joinRows() {
  const l = mPending(); if (!l.length) return '<p class="empty">가입 승인 대기가 없어요</p>';
  return '<table><tbody>' + l.map(m => '<tr><td><b>' + esc(mLabel(m)) + '</b></td><td>' + esc(fmtP(m.phone)) + '</td><td class="sub">' + esc(m.at || '') + ' 요청</td><td class="r"><button class="btn sm ghost" data-a="mRej" data-id="' + m.id + '">거절</button> <button class="btn sm" data-a="mOk" data-id="' + m.id + '">승인</button></td></tr>').join('') + '</tbody></table>';
}
function reqRows() {
  const l = pending(); if (!l.length) return '<p class="empty">승인 대기 중인 등원 요청이 없어요</p>';
  return '<table><tbody>' + l.map(q => { const s = stu(q.sid) || { name: '?' }; return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(q.at) + ' 등원 요청</td><td class="r"><button class="btn sm ghost" data-a="rej" data-id="' + q.id + '">거절</button> <button class="btn sm" data-a="ok" data-id="' + q.id + '">승인</button></td></tr>'; }).join('') + '</tbody></table>';
}

// 정산 메뉴의 등원 요일(이번 달)로 오늘 올 학생 계산. 정산 자료가 없으면 null
function expectedToday(day) {
  day = day || TODAY;
  if (D.exams.some(e => evKind(e) === 'off' && onDay(e, day))) return [];
  const w = new Date(day + 'T00:00').getDay(); const m = (D.fin || {})[ymOf(day)]; if (!m || !(m.rows || []).length) return null;
  if (w === 0) return [];
  return active().filter(s => (m.rows || []).some(r => (r.sid === s.id || (!r.sid && r.name === s.name)) && (r.d || [])[w - 1])).map(s => s.id);
}
function absSection() {
  const l = D.abs.filter(x => x.date >= TODAY).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0); if (!l.length) return '';
  const n = l.filter(x => !x.ok).length;
  return '<section class="card' + (n ? ' hl' : '') + '"><h2>결석 통보 <span class="sub">학부모님이 미리 알린 결석' + (n ? ' · 확인 안 한 ' + n + '건' : '') + '</span></h2><table><tbody>' + l.map(x => { const s = stu(x.sid) || { name: '?' }; return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + fmtD(x.date) + (x.date === TODAY ? ' ' + chip('오늘', 'bad') : '') + '</td><td>' + esc(x.reason) + '</td><td class="sub">' + esc(x.who || '') + '</td><td class="r">' + (x.ok ? chip('확인함', 'ok') : '<button class="btn sm" data-a="absOk" data-id="' + x.id + '">확인</button>') + '</td></tr>'; }).join('') + '</tbody></table></section>';
}
// 대시보드 기본 날짜: 영업일(새벽 3시 기준). 단, 자정이 지났고 그날 등원한 학생이 모두 하원했으면 달력상 오늘로
function dashDefault() {
  const biz = off(0), cal = ds(new Date()); if (cal === biz) return biz;
  const rs = Object.values(D.att[biz] || {}).filter(r => r.st !== '결석');
  return rs.every(r => r.out) ? cal : biz;
}
const curDay = () => V.dashD || dashDefault();
function dayBar(day, isT) {
  return '<div class="bar"><button class="btn sm ghost" data-a="dashM" data-v="-1">‹ 전날</button><input type="date" id="dashD" value="' + day + '" style="width:auto"><button class="btn sm ghost" data-a="dashM" data-v="1">다음날 ›</button>' + (V.dashD ? '<button class="btn sm" data-a="dashT">오늘로</button>' : '') + '<span class="sub">' + (isT ? '오늘' : day < off(0) ? '지난 날짜' : '앞 날짜') + ' 기준 · 대시보드·출결·수업 기록 공통' + (!V.dashD && day !== off(0) ? ' · 모두 하원해서 다음 날로 넘어왔어요' : '') + '</span></div>';
}
function pDash() {
  const day = curDay(); const isT = day === off(0) || day === ds(new Date()); const dayLbl = isT ? '오늘' : fmtD(day);
  const a = D.att[day] || {}; const st = active(); const exB = expectedToday(day); const ex = ((D.extra[day] || {}).sids || []).filter(id => st.some(x => x.id === id) && !(exB || []).includes(id)); const exSet = new Set(ex); const exp0 = exB || ex.length ? [...(exB || []), ...ex] : null; const absT = new Set(D.abs.filter(x => x.date === day).map(x => x.sid));
  const exp = exp0 ? exp0.filter(id => !absT.has(id) || a[id]) : null; const expSet = new Set(exp || []); const absN = exp0 ? exp0.filter(id => absT.has(id) && !a[id]).length : 0;
  const isIn = s => a[s.id] && a[s.id].st !== '결석';
  const present = st.filter(isIn).length; const expIn = exp ? st.filter(s => expSet.has(s.id) && isIn(s)).length : 0;
  const notYet = exp ? [...st.filter(s => expSet.has(s.id) && !exSet.has(s.id) && !a[s.id]), ...ex.map(id => stu(id)).filter(s => s && expSet.has(s.id) && !a[s.id])] : [];
  const toCheck = D.hw.filter(h => h.st === 'done');
  const kpi = exp ? '<div><b>' + expIn + '/' + exp.length + '</b><span>' + dayLbl + ' 등원 (' + WD[new Date(day + 'T00:00').getDay()] + '요일 예정 ' + exp.length + '명' + (ex.length ? ' · 보충 ' + ex.length + '명 포함' : '') + (absN ? ' · 결석 통보 ' + absN + '명 제외' : '') + (present > expIn ? ' · 예정 외 ' + (present - expIn) + '명' : '') + ')</span></div>' : '<div><b>' + present + '/' + st.length + '</b><span>' + dayLbl + ' 등원 (정산에 요일을 넣으면 예정 인원 기준)</span></div>';
  const rk = x => exSet.has(x.id) ? 2 : expSet.has(x.id) ? 3 : absT.has(x.id) ? 1 : 0; const order = exp ? [...st].sort((x, y) => (rk(y) - rk(x)) || (exSet.has(x.id) && exSet.has(y.id) ? ex.indexOf(x.id) - ex.indexOf(y.id) : x.name.localeCompare(y.name, 'ko'))) : st;
  return '<h1>' + esc(TNAME()) + ' </h1>' +
    dayBar(day, isT) + (() => { const l = D.exams.filter(e => onDay(e, day)); return l.length ? '<section class="card' + (l.some(e => evKind(e) === 'off') ? ' hl' : '') + '"><h2>' + dayLbl + ' 일정</h2><p>' + l.map(e => kindChip(e) + ' <b>' + esc((evKind(e) !== 'off' && e.school ? e.school + ' ' : '') + e.title) + '</b>' + (e.memo ? ' <span class="sub">' + esc(e.memo) + '</span>' : '')).join(' &nbsp; ') + '</p></section>' : ''; })() +
    pushCard() + '<div class="kpis">' + kpi + '<div><b>' + (mPending().length + pending().length) + '</b><span>승인 대기</span></div><div><b>' + toCheck.length + '</b><span>확인할 숙제</span></div><div><b>' + unreadAll() + '</b><span>새 메시지</span></div></div>' +
    (() => { const cand = st.filter(x => !expSet.has(x.id) && !(exB || []).includes(x.id) && !(a[x.id] && a[x.id].st !== '결석'));
      return '<section class="card' + (notYet.length ? ' hl' : '') + '"><h2>' + (day < off(0) ? '오지 않은 학생' : '아직 안 온 학생') + ' <span class="sub">' + dayLbl + ' 수업 예정' + (ex.length ? ' · 보충 ' + ex.length + '명' : '') + '</span></h2>' +
        '<p>' + (notYet.length ? (() => { const rg = notYet.filter(x => !exSet.has(x.id)), sp = notYet.filter(x => exSet.has(x.id)); return rg.map(x => '<b>' + esc(x.name) + '</b>' + noshowBtn(x, day)).join(' · ') + (sp.length ? (rg.length ? '<span style="margin:0 10px"></span>' : '') + chip('보충', 'pri') + ' ' + sp.map(x => '<b>' + esc(x.name) + '</b>' + noshowBtn(x, day) + ' <button class="btn xs ghost" data-a="exDel" data-id="' + x.id + '" title="보충 취소">×</button>').join(' · ') : ''); })() : '<span class="sub">' + (exp ? (D.exams.some(e => evKind(e) === 'off' && onDay(e, day)) ? '교습소 휴무일이에요' : '예정된 학생이 모두 왔어요') : '정산 메뉴에 등원 요일을 넣으면 예정 학생이 보여요') + '</span>') + '</p>' +
        (cand.length ? '<div class="bar" style="margin:10px 0 0"><select id="exSel" style="width:auto"><option value="">보충 올 학생 선택</option>' + cand.map(x => '<option value="' + x.id + '">' + esc(x.name) + ' (' + esc(x.grade) + ')</option>').join('') + '</select><button class="btn sm" data-a="exAdd">+ 보충 학생 추가</button></div>' : '') + '</section>'; })() +
    (isOwnerMe() && D.staff.some(x => x.st === 'pending') ? '<section class="card hl"><h2>부원장 가입 승인</h2><table><tbody>' + D.staff.filter(x => x.st === 'pending').map(x => '<tr><td><b>' + esc(x.name || '') + ' 부원장</b></td><td>' + esc(fmtP(x.phone)) + '</td><td class="r"><button class="btn sm ghost" data-a="stRej" data-id="' + x.id + '">거절</button> <button class="btn sm" data-a="stOk" data-id="' + x.id + '">승인</button></td></tr>').join('') + '</tbody></table></section>' : '') +
    applyCard(false) + absSection() +
    '<div class="grid2"><section class="card"><h2>등원 승인 대기</h2>' + reqRows() + '</section><section class="card"><h2>가입 승인 대기</h2>' + joinRows() + '</section></div>' +
    '<section class="card"><h2>' + dayLbl + ' 출결 <span class="sub">' + fmtD(day) + '</span></h2><table><thead><tr><th>학생</th><th>학년</th>' + (exp ? '<th>수업</th>' : '') + '<th>상태</th><th>수업 기록</th></tr></thead><tbody>' +
    order.map(s => { const lg = D.logs.filter(l => l.sid === s.id && l.date === day).pop(); const e = expSet.has(s.id); const ab = absT.has(s.id) && !a[s.id] ? absOf(s.id, day) : null; return '<tr' + (exp && !e && !a[s.id] && !ab ? ' style="opacity:.5"' : '') + '><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.grade) + '</td>' + (exp ? '<td>' + (exSet.has(s.id) ? (!a[s.id] ? chip('보충 예정', 'pri') : a[s.id].st === '결석' ? chip('결석', 'bad') : a[s.id].out ? chip('완료', 'pri') : chip('학습중', 'ok')) : clsChip(a[s.id], e, ab)) + '</td>' : '') + '<td>' + attChip(a[s.id]) + '</td><td>' + (ab ? '<span class="sub">결석 사유: ' + esc(ab.reason) + '</span>' : lg ? esc(lg.unit || subjOf(lg) + ' (메모 기록)') + ' · 개념 ' + lg.c + '% · 문제 ' + lg.p + '%' : '<span class="sub">없음</span>') + '</td></tr>'; }).join('') + '</tbody></table></section>' +
    '<section class="card"><h2>확인할 숙제</h2>' + hwTable(toCheck) + '</section>';
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
/* ---------- 학생 관리 (연락처·앱 연결 / 학생명부 / 재학 학교 통합) ---------- */
/* ---------- 신규 등록 신청 (join.html) ---------- */
const JOIN_URL = 'https://themilchak-math.github.io/join.html';
const joinText = () => { const tn = (D.cfg && D.cfg.teacher) || '';
  return '[더밀착수학교습소] 입학 등록 안내\n\n안녕하세요, 더밀착수학교습소' + (tn ? ' 원장 ' + tn : '') + '입니다.\n저희 교습소와 함께해 주셔서 감사합니다.\n\n'
    + '아래 링크에서 입학 등록 신청서를 작성해 주세요. (2~3분이면 끝나요)\n▶ ' + JOIN_URL + '\n\n'
    + '📝 적어 주실 내용\n· 학생 이름, 학교, 학년, 생년월일\n· 학생 휴대폰, 어머님 또는 아버님 휴대폰\n· 희망 등원 요일 (2일 이상)\n\n'
    + '신청서를 확인하고 등록이 완료되면, 출결·수업 기록·숙제를 확인하실 수 있는 교습소 앱 설치 안내를 보내 드릴게요.\n'
    + '궁금하신 점은 언제든 편하게 연락 주세요. 감사합니다.'; };
function applyCard(withLink) {
  const l = D.apply; if (!l.length && !withLink) return '';
  const dd = a => (a.days || []).map((x, i) => x ? DAYS6[i] : '').filter(Boolean).join('·') || '-';
  return '<section class="card' + (l.length ? ' hl' : '') + '"><h2>신규 등록 신청 <span class="sub">' + (l.length ? l.length + '건 · [승인]을 누르면 학생 등록·앱 연결 번호·학생명부·정산 줄이 한 번에 만들어져요' : '학부모님께 아래 신청 링크를 보내면 여기로 들어와요') + '</span></h2>' +
    (l.length ? '<table><thead><tr><th>학생</th><th>학교·학년</th><th>생년월일</th><th>연락처</th><th>희망 요일</th><th>남긴 말</th><th></th></tr></thead><tbody>' + l.map(a => '<tr><td><b>' + esc(a.name) + '</b>' + (D.students.some(s => s.name === a.name) ? ' ' + chip('같은 이름 있음', 'warn') : '') + '</td><td>' + esc(a.school) + ' ' + esc(a.grade) + '</td><td>' + esc(a.birth || '-') + '</td><td class="sub">' + [['모', a.pMother], ['부', a.pFather], ['학생', a.pStudent]].filter(x => x[1]).map(x => x[0] + ' ' + fmtP(x[1])).join('<br>') + '</td><td>' + dd(a) + '</td><td class="sub" style="max-width:260px;white-space:normal">' + esc(a.memo || '') + '</td><td class="r" style="white-space:nowrap"><button class="btn sm" data-a="apOk" data-id="' + a.id + '">승인</button> <button class="btn xs ghost" data-a="apDel" data-id="' + a.id + '">삭제</button></td></tr>').join('') + '</tbody></table>' : '') +
    (withLink ? '<div class="bar" style="margin-top:8px"><input readonly value="' + JOIN_URL + '" style="flex:1;min-width:0"><button class="btn sm ghost" data-a="apCopy">안내 문구 복사</button></div><details style="margin-top:6px"><summary class="sub">복사되는 안내 문구 미리보기</summary><pre style="white-space:pre-wrap;font:inherit;background:var(--soft);padding:10px;border-radius:10px;margin:6px 0 0">' + esc(joinText()) + '</pre></details>' : '') + '</section>';
}
async function approveApply(a) {
  const ph = { student: a.pStudent || '', father: a.pFather || '', mother: a.pMother || '' };
  const b = writeBatch(db); const ref = doc(collection(db, 'students')); const sid = ref.id; const grade = GRADES.includes(a.grade) ? a.grade : '중1';
  b.set(ref, { name: a.name, grade, school: a.school || '', course: DEF_COURSE[grade], ts: now() });
  let auto = false; Object.entries(ph).forEach(([rel, p]) => { if (p) auto = addMember(b, sid, rel, p, a.name, grade) || auto; });
  const phones = {}; Object.entries(ph).forEach(([rel, p]) => { if (p) phones[rel] = p; });
  b.set(doc(db, 'sinfo', sid), { birth: a.birth || '', joined: TODAY, memo: a.memo ? '신청서: ' + a.memo : '', phones }, { merge: true });
  b.update(doc(db, 'apply', a.id), { st: 'ok', sid });
  await b.commit();
  // 이번 달 정산에 희망 요일로 줄 추가
  const ym = TODAY.slice(0, 7); const m = D.fin[ym];
  if (m && !(m.rows || []).some(r => r.sid === sid)) { const rows = [...(m.rows || []), { ...blankRow({ id: sid, name: a.name }), d: (a.days || [0, 0, 0, 0, 0, 0]).map(x => x ? 1 : 0) }]; await updateDoc(doc(db, 'fin', 'm_' + ym), { rows }); if (V.finEdit && V.finEdit.ym === ym) V.finEdit.rows = rows; }
  return { sid, auto };
}
function pPeople() {
  const v = V.stuV || 'list'; const noSc = active().filter(s => !s.school).length;
  const tabs = [['list', '연락처·앱 연결'], ['roster', '학생명부 (상세)'], ['school', '재학 학교' + (noSc ? ' · 미입력 ' + noSc : '')]];
  return '<h1>학생 관리 <span class="sub">재원 ' + active().length + '명' + (D.students.length - active().length ? ' · 퇴원 ' + (D.students.length - active().length) + '명' : '') + '</span></h1>' +
    '<div class="bar"><button class="btn" data-a="modal" data-v="stu">+ 학생 등록</button><button class="btn ghost" data-a="modal" data-v="bulk">여러 명 붙여넣기</button><span style="flex:1"></span><label class="btn ghost" style="cursor:pointer">엑셀 불러오기<input type="file" id="xlIn" accept=".xlsx" hidden></label> <button class="btn ghost" data-a="xlOut">엑셀로 내보내기</button></div>' +
    applyCard(true) + (mPending().length ? '<section class="card hl"><h2>가입 승인 대기</h2>' + joinRows() + '</section>' : '') +
    '<div class="bar" style="margin:4px 0 12px">' + tabs.map(([k, l]) => '<button class="btn sm ' + (v === k ? '' : 'ghost') + '" data-a="stuV" data-v="' + k + '">' + l + '</button>').join(' ') + '</div>' +
    (v === 'roster' ? pRoster() : v === 'school' ? pSchool() : pStudents());
}
function pStudents() {
  const left = D.students.filter(s => s.left);
  return '<p class="sub" style="margin:0 0 10px">학생·학부모 번호와 앱 연결 상태 · 번호 수정은 [수정] · 등록한 번호로만 가입할 수 있어요</p>' +
    '<section class="card"><table class="stu"><thead><tr><th>이름</th><th>학년</th><th>학교</th><th>현재 과정</th><th>학생</th><th>아버님</th><th>어머님</th><th></th></tr></thead><tbody>' +
    (active().length ? active().map(s => '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.grade) + '</td><td>' + (s.school ? esc(s.school) : '<span class="sub">-</span>') + '</td><td>' + esc(s.course) + '</td><td>' + memCell(s, 'student') + '</td><td>' + memCell(s, 'father') + '</td><td>' + memCell(s, 'mother') + '</td><td class="r">' + (D.members.some(m => m.sid === s.id && m.st === 'none') ? '<button class="btn xs" data-a="invite" data-id="' + s.id + '">안내 문자</button> ' : '') + '<button class="btn xs ghost" data-a="modal" data-v="stu" data-id="' + s.id + '">수정</button></td></tr>').join('') : '<tr><td colspan="9" class="empty">아직 등록된 학생이 없어요</td></tr>') +
    '</tbody></table></section>' +
    (left.length ? '<details class="card"><summary>퇴원한 학생 ' + left.length + '명</summary><table><tbody>' + left.map(s => '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.grade) + '</td><td class="r"><button class="btn xs ghost" data-a="rejoin" data-id="' + s.id + '">복귀</button></td></tr>').join('') + '</tbody></table></details>' : '');
}

function pAtt() {
  const day = curDay(); const isT = day === off(0) || day === ds(new Date()); const dayLbl = isT ? '오늘' : fmtD(day);
  const [y, m] = V.calM.split('-').map(Number); const nd = new Date(y, m, 0).getDate();
  const days = Array.from({ length: nd }, (_, i) => y + '-' + pad(m) + '-' + pad(i + 1));
  const head = days.map(d => { const w = new Date(d + 'T00:00').getDay(); return '<th class="' + (w === 0 ? 'sun' : w === 6 ? 'sat' : '') + (d === TODAY ? ' tdy' : '') + (d === day && d !== TODAY ? ' tdy' : '') + '">' + (+d.slice(8)) + '<br><small>' + WD[w] + '</small></th>'; }).join('');
  const rows = active().map(s => {
    const c = [0, 0];
    const cells = days.map(d => {
      const r = (D.att[d] || {})[s.id]; if (r) c[isIn(r) ? 0 : 1]++;
      const ab = !r && absOf(s.id, d);
      const k = !r ? (ab ? 'bad' : '') : !isIn(r) ? 'bad' : (r.out || d === TODAY ? 'ok' : 'warn');
      const t = !r && ab ? '결석 통보: ' + ab.reason + (ab.ok ? '' : ' (확인 전)') + ' · 눌러서 등·하원 입력' : r ? (isIn(r) ? '등원 ' + (r.at || '') + (r.out ? ' / 하원 ' + lateLabel(r.out) : ' / 하원 기록 없음') : '결석') + ' · 눌러서 수정' : '눌러서 등·하원 입력';
      return '<td class="c ' + k + (d === TODAY ? ' tdy' : '') + (d === day && d !== TODAY ? ' tdy' : '') + '" title="' + esc(t) + '" data-a="attEdit" data-id="' + s.id + '" data-v="' + d + '">' + (r ? (isIn(r) ? '●' : '결') : ab ? '통' : '') + '</td>';
    }).join('');
    return '<tr><th class="nm">' + esc(s.name) + '</th>' + cells + '<td class="sum">' + c[0] + '</td><td class="sum">' + c[1] + '</td></tr>';
  }).join('');
  const today = D.att[day] || {};
  const exB = expectedToday(day), st = active(); const ex = ((D.extra[day] || {}).sids || []).filter(id => st.some(x => x.id === id) && !(exB || []).includes(id)); const exSet = new Set(ex); const regSet = new Set(exB || []);
  const absD = new Set(D.abs.filter(x => x.date === day).map(x => x.sid));
  const rk = x => regSet.has(x.id) && !(absD.has(x.id) && !today[x.id]) ? 3 : exSet.has(x.id) ? 2 : absD.has(x.id) ? 1 : 0;
  const ord = [...st].sort((x, y) => (rk(y) - rk(x)) || (exSet.has(x.id) && exSet.has(y.id) ? ex.indexOf(x.id) - ex.indexOf(y.id) : x.name.localeCompare(y.name, 'ko')));
  const plan = exB || ex.length;
  const tag = s => { const r = today[s.id]; if (exSet.has(s.id)) return !r ? chip('보충 예정', 'pri') : r.st === '결석' ? chip('결석', 'bad') : r.out ? chip('완료', 'pri') : chip('학습중', 'ok'); const e = regSet.has(s.id); const ab = !r && absD.has(s.id); return clsChip(r, e, ab); };
  let prevG = null;
  const todayRows = ord.map(s => { const r = today[s.id]; const ab = !r && absOf(s.id, day); const g = rk(s); const dim = plan && g === 0 && !r;
    const sep = plan && g !== prevG && (g === 2 || (g === 0 && prevG !== null)) ? '<tr><td colspan="4" class="sub" style="padding-top:10px;font-weight:700">' + (g === 2 ? '보충' : '그 외 학생') + '</td></tr>' : ''; prevG = g;
    return sep + '<tr' + (dim ? ' style="opacity:.5"' : '') + '><td><b>' + esc(s.name) + '</b></td>' + (plan ? '<td>' + tag(s) + '</td>' : '') + '<td>' + (ab ? chip('결석 통보', 'bad') + ' <span class="sub">' + esc(ab.reason) + '</span>' : attChip(r)) + '</td><td class="r"><button class="btn xs ghost" data-a="attEdit" data-id="' + s.id + '" data-v="' + day + '">' + (r ? '수정' : '입력') + '</button></td></tr>'; }).join('');
  return '<h1>출결 <span class="sub">칸을 누르면 등원·하원 시각을 직접 입력·수정·삭제할 수 있어요</span></h1>' + dayBar(day, isT) +
    '<div class="grid2"><section class="card"><h2>' + dayLbl + ' 등·하원 <span class="sub">' + fmtD(day) + '</span></h2><table><tbody>' + (todayRows || '<tr><td class="empty">학생이 없어요</td></tr>') + '</tbody></table></section><section class="card"><h2>등원 승인 대기</h2>' + reqRows() + '</section></div>' +
    wifiSection() +
    '<div class="bar"><button class="btn sm ghost" data-a="calM" data-v="-1">‹ 이전 달</button><b class="mon">' + y + '년 ' + m + '월</b><button class="btn sm ghost" data-a="calM" data-v="1">다음 달 ›</button>' + (isOwnerMe() ? '<label class="sw"><input type="checkbox" id="autoN" ' + (D.cfg && D.cfg.autoNotify !== false ? 'checked' : '') + '> 등·하원 시 학부모님께 알림 자동 발송</label>' : '') + '</div>' +
    '<section class="card scroll"><table class="att"><thead><tr><th class="nm">학생</th>' + head + '<th>등원</th><th>결석</th></tr></thead><tbody>' + (rows || '<tr><td class="empty">학생이 없어요</td></tr>') + '</tbody></table><p class="sub legend">' + chip('● 등원·하원', 'ok') + ' ' + chip('● 하원 기록 없음', 'warn') + ' ' + chip('결 결석', 'bad') + ' ' + chip('통 결석 통보', 'bad') + ' 칸에 마우스를 올리면 시각이 보여요.</p></section>';
}
async function myIp() {
  const t = (u, ms) => Promise.race([fetch(u, { cache: 'no-store' }), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), ms))]);
  try { const r = await t('https://api.ipify.org?format=json', 5000); const j = await r.json(); if (j && j.ip) return j.ip; } catch (e) { }
  try { const r = await t('https://ipv4.icanhazip.com', 5000); return (await r.text()).trim(); } catch (e) { }
  return '';
}
const isAcademyPc = () => { try { return localStorage.getItem('tmm-academy-pc') === '1'; } catch (e) { return false; } };
let wifiSyncAt = 0;
async function wifiAutoSync(force) {
  if (!isOwnerMe() || !isAcademyPc() || !D.cfg || D.cfg.wifiAuto === false && (D.cfg.wifiIps || []).length) return;
  if (!force && Date.now() - wifiSyncAt < 10 * 60 * 1000) return; wifiSyncAt = Date.now();
  const ip = await myIp(); if (!ip) return; const cur = D.cfg.wifiIps || []; if (cur.includes(ip) && D.cfg.wifiAuto) return;
  const l = cur.filter(x => x !== ip).concat(ip).slice(-6);
  try { await updateDoc(doc(db, 'config', 'main'), { wifiIps: l, wifiAuto: true }); toast('교습소 인터넷 주소를 자동으로 갱신했어요 (' + ip + ')'); } catch (e) { console.warn('wifiAutoSync', e); }
}
setInterval(() => wifiAutoSync(false), 15 * 60 * 1000);
function wifiSection() {
  if (!isOwnerMe()) return ''; const c = D.cfg || {}; const ips = c.wifiIps || []; const on = !!(c.wifiAuto && ips.length);
  return '<section class="card"><h2>와이파이 자동 등원 ' + (on ? chip('켜짐', 'ok') : chip('꺼짐')) + '</h2><p class="sub">학생이 교습소 와이파이에 연결된 상태로 앱을 열면 승인 없이 바로 등원돼요 (원장님께 알림). 와이파이가 아니면 지금처럼 [등원하기] → 승인. 하원은 기존 방식 그대로예요.</p>' +
    (ips.length ? '<p>등록된 교습소 인터넷 주소: <b>' + ips.map(esc).join(', ') + '</b></p>' : '') +
    '<div class="bar"><button class="btn sm" data-a="wifiReg">이 PC가 연결된 인터넷을 교습소로 등록</button>' + (ips.length ? '<button class="btn sm ghost" data-a="wifiTog">' + (c.wifiAuto ? '끄기' : '켜기') + '</button><button class="btn sm ghost" data-a="wifiClr">등록 지우기</button>' : '') + '</div>' +
    '<label class="sw" style="justify-content:flex-start;gap:8px;margin-top:6px"><input type="checkbox" id="wifiPc"' + (isAcademyPc() ? ' checked' : '') + '> <b>이 PC는 교습소 PC</b> — 관리자 페이지를 열어 두면 교습소 인터넷 주소를 자동으로 갱신해요</label>' +
    '<p class="sub">교습소 PC마다 한 번씩 체크해 두세요 (여러 대 가능, 1층·2층 인터넷이 달라도 모두 등록돼요). 집 PC에서는 체크하지 마세요. 최근 주소 6개까지 기억해요.</p></section>';
}
function attModal() {
  const s = stu(V.attSid) || {}; const d = V.attDate; const r = (D.att[d] || {})[V.attSid];
  const st = r ? (isIn(r) ? 'in' : 'abs') : 'in';
  return '<div class="mbg" data-a="close"><form class="modal" id="attF"><h2>' + esc(s.name || '') + ' · ' + fmtD(d) + '</h2>' +
    '<label>상태<select id="atSt">' + opt('in', st, '등원') + opt('abs', st, '결석') + '</select></label>' +
    '<div class="row2"><label>등원 시각<input type="time" id="atIn" value="' + esc(r && r.at ? r.at : '') + '"></label><label>하원 시각<input type="time" id="atOut" value="' + esc(r && r.out ? r.out : '') + '"></label></div>' +
    '<label class="sw" style="justify-content:flex-start;gap:8px;margin:4px 0 8px"><input type="checkbox" id="atNoti"' + (d === TODAY ? ' checked' : '') + '> 학부모님께 알림 보내기</label>' +
    '<p class="sub">하원이 자정을 넘기면 그대로 01:30처럼 넣으세요 (새벽 3시까지는 이 날 하원으로 기록). 하원 시각을 비우면 하원 전 상태로 남아요. 알림을 끄고 저장하면 기록만 조용히 고쳐져요.</p>' +
    '<div class="mf">' + (r ? '<button type="button" class="btn ghost danger" data-a="attDel">기록 삭제</button>' : '') + '<span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn" type="submit">저장</button></div></form></div>';
}

const ratioOf = l => { const c = +l.c || 0, p = +l.p || 0, t = c + p; return t ? Math.round(c / t * 100) : 50; };
function defaultsFor(s, sj) {
  if (!sj) { const l0 = latest(s.id); sj = l0 ? subjOf(l0) : '수학'; }
  const l = sortLogs(D.logs.filter(x => x.sid === s.id && subjOf(x) === sj && x.unit)).pop() || latestIn(s.id, sj); const course = l ? l.course : (sj === '수학' ? s.course : defCourse(s.grade, sj));
  const unit = (l && l.unit) || (unitsOf(s.id, course)[0] || null); const c = l ? Math.round(ratioOf(l) / 10) * 10 : 50;
  return { subj: sj, course, unit, c, pp: 100 - c };
}
const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label ?? v) + '</option>';
const realSid = k => String(k).split('-')[0];
const logKeys = sid => Array.from({ length: (V.logN && V.logN[sid]) || 1 }, (_, k) => k ? sid + '-' + k : sid);
function pLog() {
  const day = curDay(); const isT = day === off(0) || day === ds(new Date());
  const a = D.att[day] || {};
  const inT = s => (a[s.id] && a[s.id].st !== '결석') || D.logs.some(l => l.sid === s.id && l.date === day);
  const shown = active().filter(s => V.logAll || inT(s)); const hidden = active().length - active().filter(inT).length;
  const rows = shown.map(s => {
    const done = D.logs.filter(l => l.sid === s.id && l.date === day); const came = a[s.id] && a[s.id].st !== '결석'; const keys = logKeys(s.id);
    const nK = keys.length, wb = Math.floor(100 / nK / 10) * 10;
    return keys.map((key, k) => {
      const wDef = k === nK - 1 ? 100 - wb * (nK - 1) : wb;
      const kv = id => V.keep && V.keep[id + key] && V.keep[id + key].v;
      const kj = kv('lj_'); const d = defaultsFor(s, SUBJS.includes(kj) ? kj : null); const kc = kv('lc_'); if (kc && CUR[kc] !== undefined && kc !== d.course && Object.keys(BY_SUBJ[d.subj]).includes(kc)) { d.course = kc; d.unit = null; }
      const first = k === 0;
      return '<tr class="' + (came ? 'came' : '') + (first ? '' : ' sub2') + '"><td>' + (first ? '<input type="checkbox" id="lk_' + s.id + '" ' + (came && !done.length ? 'checked' : '') + '>' : '') + '</td><td>' + (first ? '<b>' + esc(s.name) + '</b><div class="sub">' + esc(s.grade) + ' · ' + (a[s.id] ? (a[s.id].st === '결석' ? '결석' : '등원') : '미등원') + '</div><button class="btn xs ghost" style="margin-top:4px" data-a="logAdd" data-id="' + s.id + '">+ 단원·과목</button>' : '<span class="sub">↳ ' + (k + 1) + '번째</span>' + (k === keys.length - 1 ? ' <button class="btn xs ghost" data-a="logDelRow" data-id="' + s.id + '" title="이 줄 빼기">✕</button>' : '')) + '</td>' +
        '<td><select id="lj_' + key + '" data-sid="' + key + '" class="lj" style="min-width:78px">' + SUBJS.map(x => opt(x, d.subj)).join('') + '</select></td>' +
        '<td><select id="lc_' + key + '" data-sid="' + key + '" class="lc">' + courseOpts(d.subj, d.course) + '</select></td>' +
        '<td><select id="lu_' + key + '" data-sid="' + key + '" class="lu">' + unitsOf(s.id, d.course).map(u => { const x = lastOf(s.id, d.course, u); return opt(u, d.unit, (x ? '• ' : '') + u); }).join('') + opt('', null, '단원 없이 (메모 필수)') + '</select></td>' +
        '<td>' + (nK > 1 ? '<select id="lw_' + key + '" data-sid="' + key + '" class="lw" style="min-width:76px">' + [10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => opt(String(v), String(wDef), v + '%')).join('') + '</select>' : '<span class="sub">100%</span>') + '</td>' +
        '<td><select id="lpc_' + key + '"' + (d.subj === ACT ? ' disabled' : '') + '>' + PCT.map(v => opt(String(v), String(d.c), v + '%')).join('') + '</select></td>' +
        '<td><select id="lpp_' + key + '"' + (d.subj === ACT ? ' disabled' : '') + '>' + PCT.map(v => opt(String(v), String(d.pp), v + '%')).join('') + '</select></td>' +
        '<td>' + (first ? '<input id="lm_' + s.id + '" placeholder="특별한 일만 (단원 없이 기록하면 필수)">' : '') + '</td>' +
        '<td class="cen">' + (first ? '<input type="checkbox" id="ls_' + s.id + '" checked>' : '') + '</td>' +
        '<td>' + (first && done.length ? chip('오늘 ' + done.length + '건 저장됨', 'ok') : '') + '</td>' +
        '<td class="r">' + (first ? '<button class="btn xs" data-a="saveLog" data-id="' + s.id + '">저장</button>' : '') + '</td></tr>';
    }).join('');
  }).join('');
  return '<h1>수업 기록 <span class="sub">' + fmtD(day) + ' · ' + (isT ? '오늘' : '그날') + ' 등원한 학생만 보여요 · 두 단원·과목 이상 했으면 [+ 단원·과목] · 개념 비중을 고르면 문제풀이는 자동(합 100%)</span></h1>' + dayBar(day, isT) +
    '<div class="bar"><button class="btn" data-a="saveChecked">체크한 학생 한꺼번에 저장</button><button class="btn ghost" data-a="modal" data-v="act">🎬 다 같이 특별활동</button><span class="sub">저장하면 그 학생의 하원 버튼이 열리고, 공유를 켜 둔 기록은 학부모님께 알림이 가요</span>' + (hidden ? '<button class="btn sm ghost" style="margin-left:auto" data-a="logAll">' + (V.logAll ? '오늘 등원한 학생만 보기' : '등원 안 한 학생도 보기 (' + hidden + '명)') + '</button>' : '') + '</div>' +
    '<section class="card scroll"><table class="log"><thead><tr><th></th><th>학생</th><th>과목</th><th>진도 과정</th><th>단원</th><th>항목 비중</th><th>오늘 개념 비중</th><th>문제풀이 비중</th><th>특별 메모</th><th>공유</th><th></th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="12" class="empty">아직 오늘 등원한 학생이 없어요</td></tr>') + '</tbody></table></section>' +
    '<section class="card"><h2>최근 기록</h2>' + recentLogs() + '</section>';
}
function recentLogs() {
  const l = sortLogs(D.logs).reverse().slice(0, 30);
  if (!l.length) return '<p class="empty">기록이 없어요</p>';
  return '<table><thead><tr><th>날짜</th><th>학생</th><th>과목</th><th>과정</th><th>단원</th><th>개념</th><th>문제</th><th>메모</th><th>공유</th><th></th></tr></thead><tbody>' + l.map(x => { const s = stu(x.sid); return '<tr><td>' + fmtD(x.date) + '</td><td>' + esc(s ? s.name : '?') + '</td><td>' + esc(subjOf(x)) + '</td><td>' + esc(x.course) + '</td><td>' + esc(x.unit) + (x.w && x.w < 100 ? ' <span class="sub">(' + x.w + '%)</span>' : '') + '</td><td>' + x.c + '%</td><td>' + x.p + '%</td><td>' + esc(x.cm || '') + '</td><td><button class="btn xs ghost" data-a="togSh" data-id="' + x.id + '">' + (x.sh ? '공유 중' : '비공개') + '</button></td><td class="r"><button class="btn xs ghost" data-a="delLog" data-id="' + x.id + '">삭제</button></td></tr>'; }).join('') + '</tbody></table>';
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

/* ---------- 학교별 시험기간 ---------- */
const EXAM_T = ['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사'];
const schools = () => [...new Set(D.students.filter(s => !s.left).map(s => (s.school || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
const examLive = e => (e.end || e.start) >= TODAY;
const dday = e => { if (e.start <= TODAY) return evKind(e) === 'exam' ? '시험 중' : evKind(e) === 'off' ? '휴무 중' : '오늘'; return 'D-' + Math.round((new Date(e.start + 'T00:00') - new Date(TODAY + 'T00:00')) / 864e5); };
const KIND = { exam: '시험기간', off: '교습소 휴무', event: '특수 일정' };
const evKind = e => e.kind || 'exam';
const kindChip = e => { const k = evKind(e); return chip(KIND[k], k === 'off' ? 'bad' : k === 'event' ? 'pri' : 'warn'); };
const KIND_T = { exam: EXAM_T, off: ['교습소 휴무', '명절 연휴 휴무', '원장님 연수 휴무', '여름 휴가', '겨울 휴가'], event: ['소풍', '체험학습', '수학여행', '학교 축제', '개교기념일', '방학식', '개학식'] };
const onDay = (e, d) => e.start <= d && (e.end || e.start) >= d;
function pExam() {
  const sc = schools(); const noSc = active().filter(s => !s.school); const k = V.exK || 'exam';
  const all = [...D.exams].sort((a, b) => (examLive(b) - examLive(a)) || (a.start < b.start ? -1 : 1));
  const bySchool = sc.map(x => [x, active().filter(s => (s.school || '').trim() === x)]);
  const tgt = e => evKind(e) === 'off' ? '교습소 전체' : (e.school || '전체');
  const ym = V.schM || TODAY.slice(0, 7); const [yy, mm] = ym.split('-').map(Number);
  const items = buildItems(ym, { exams: D.exams, students: active(), birthOf: s => (D.sinfo[s.id] || {}).birth, onReady: () => render() });
  return '<h1>일정 등록 <span class="sub">시험기간·교습소 휴무·소풍 같은 특수 일정을 등록하면 해당 학생·학부모 앱 홈에 보이고 알림이 가요</span></h1>' +
    '<section class="card"><h2>' + yy + '년 ' + mm + '월 <span class="sub">공휴일 · 등록한 일정 · 학생 생일</span></h2><div class="bar"><button class="btn sm ghost" data-a="schM" data-v="-1">‹ 이전 달</button><button class="btn sm ghost" data-a="schM" data-v="0">이번 달</button><button class="btn sm ghost" data-a="schM" data-v="1">다음 달 ›</button></div>' + calHtml(ym, items, TODAY) + '</section><div class="grid2"><section class="card"><h2>일정 등록</h2>' +
    '<div class="bar" style="margin-bottom:10px">' + Object.entries(KIND).map(([kk, l]) => '<button class="btn sm ' + (k === kk ? '' : 'ghost') + '" data-a="exK" data-v="' + kk + '">' + l + '</button>').join(' ') + '</div><form id="examF" class="form">' +
    (k === 'off' ? '<p class="sub" style="margin:0 0 8px">교습소 전체가 쉬는 날이에요. 모든 가족에게 알림이 가고, 그날은 대시보드 예정 인원이 0명이 돼요.</p>' :
      '<label>' + (k === 'exam' ? '학교' : '대상 학교 <span class="sub">비우면 전체 학생</span>') + '<input id="exS" list="exSL" placeholder="예: 동탄중" autocomplete="off"><datalist id="exSL">' + sc.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label>') +
    '<label>' + (k === 'exam' ? '시험' : '일정 이름') + '<input id="exT" list="exTL" placeholder="' + (k === 'exam' ? '예: 2학기 기말고사' : k === 'off' ? '예: 추석 연휴 휴무' : '예: 소풍') + '" autocomplete="off"><datalist id="exTL">' + KIND_T[k].map(x => '<option value="' + x + '">').join('') + '</datalist></label>' +
    '<div class="row2"><label>시작일<input type="date" id="exA"></label><label>끝나는 날<input type="date" id="exB"></label></div><label>메모 (선택)<input id="exM" placeholder="' + (k === 'exam' ? '예: 수학 12/3(수) 2교시' : k === 'off' ? '예: 보충은 따로 안내드려요' : '예: 그날은 오후 6시 등원') + '"></label><button class="btn" type="submit">등록하고 알림 보내기</button></form>' +
    (k === 'exam' && noSc.length ? '<p class="sub">학교 미입력: ' + noSc.map(s => esc(s.name)).join(', ') + ' → 학생 관리 › 재학 학교에서 넣어 주세요.</p>' : '') + '</section>' +
    '<section class="card"><h2>학교별 학생</h2>' + (bySchool.length ? '<table><tbody>' + bySchool.map(([x, l]) => { const nx = D.exams.filter(e => evKind(e) === 'exam' && e.school === x && examLive(e)).sort((a, b) => a.start < b.start ? -1 : 1)[0]; return '<tr><td><b>' + esc(x) + '</b></td><td>' + l.map(s => esc(s.name)).join(', ') + '</td><td class="r">' + (nx ? chip(esc(nx.title) + ' ' + dday(nx), 'warn') : '<span class="sub">시험 일정 없음</span>') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="empty">학교가 입력된 학생이 없어요</p>') + '</section></div>' +
    '<section class="card"><h2>등록된 일정 <span class="sub">' + all.length + '건</span></h2>' + (all.length ? '<table><thead><tr><th>종류</th><th>대상</th><th>일정</th><th>기간</th><th>메모</th><th>상태</th><th></th></tr></thead><tbody>' + all.map(e => '<tr><td>' + kindChip(e) + '</td><td><b>' + esc(tgt(e)) + '</b></td><td>' + esc(e.title) + '</td><td>' + fmtD(e.start) + (e.end && e.end !== e.start ? ' ~ ' + fmtD(e.end) : '') + '</td><td>' + esc(e.memo || '') + '</td><td>' + (examLive(e) ? chip(dday(e), 'warn') : chip('끝남')) + '</td><td class="r"><button class="btn xs ghost" data-a="exDel" data-id="' + e.id + '">삭제</button></td></tr>').join('') + '</tbody></table>' : '<p class="empty">아직 등록된 일정이 없어요</p>') + '</section>';
}
/* ---------- 재학 학교 일괄 등록 ---------- */
function pSchool() {
  const st = active(); const sc = schools(); const no = st.filter(s => !s.school);
  const f = V.schF || 'all'; const list = f === 'none' ? no : f === 'all' ? st : st.filter(s => (s.school || '') === f);
  const dl = '<datalist id="scAll">' + sc.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
  return '<p class="sub" style="margin:0 0 10px">학생별 학교를 넣고 [저장] · 여러 명을 골라 한 번에 넣을 수도 있어요</p>' + dl +
    '<div class="grid2"><section class="card"><h2>학교별 인원</h2><table><tbody>' + sc.map(x => '<tr><td><b>' + esc(x) + '</b></td><td>' + st.filter(s => s.school === x).length + '명</td><td class="sub">' + st.filter(s => s.school === x).map(s => esc(s.name)).join(', ') + '</td></tr>').join('') + '<tr><td><b>미입력</b></td><td>' + no.length + '명</td><td class="sub">' + no.map(s => esc(s.name)).join(', ') + '</td></tr></tbody></table></section>' +
    '<section class="card"><h2>선택한 학생에게 한 번에 넣기</h2><form id="schBulkF" class="form"><label>학교 이름<input id="schBulk" list="scAll" placeholder="예: 동탄중" autocomplete="off"></label><p class="sub">아래 표에서 학생을 체크한 뒤 [선택 학생에게 적용]을 누르세요.</p><button class="btn" type="submit">선택 학생에게 적용</button></form></section></div>' +
    '<section class="card"><div class="bar" style="margin-bottom:10px"><b>보기</b> ' + [['all', '전체 ' + st.length], ['none', '미입력 ' + no.length]].concat(sc.map(x => [x, x])).map(([k, l]) => '<button class="btn xs ' + (f === k ? '' : 'ghost') + '" data-a="schF" data-v="' + esc(k) + '">' + esc(l) + '</button>').join(' ') + '</div>' +
    '<form id="schF"><table><thead><tr><th style="width:36px"><input type="checkbox" id="schAllCk" title="모두 선택"></th><th>이름</th><th>학년</th><th>학교</th></tr></thead><tbody>' +
    (list.length ? list.map(s => '<tr><td><input type="checkbox" name="schCk" value="' + s.id + '"></td><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.grade) + '</td><td><input id="sc_' + s.id + '" data-sid="' + s.id + '" list="scAll" value="' + esc(s.school || '') + '" placeholder="학교 이름" autocomplete="off" style="max-width:260px"></td></tr>').join('') : '<tr><td colspan="4" class="empty">해당하는 학생이 없어요</td></tr>') +
    '</tbody></table><div class="mf"><span style="flex:1"></span><button class="btn" type="submit">변경 내용 저장</button></div></form></section>';
}
/* ---------- 정산 (원장님만) : 월별 원비 · 식대 ---------- */
const DAYS6 = ['월', '화', '수', '목', '금', '토'];
const FIN_MAX = 20; // 기존 엑셀과 같은 한 달 최대 학생 줄 수
const won = n => (n === '' || n == null) ? '' : Number(n).toLocaleString('ko-KR');
const finSet = () => Object.assign({ meal: 8000, cap1: 6, cap2: 9 }, D.finSet || {});
const ymOf = d => d.slice(0, 7);
const ymLabel = ym => ym.replace('-', '.');
const daysIn = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
const dateOf = (ym, d) => ym + '-' + pad(d);
const finMonths = () => Object.keys(D.fin || {}).sort().reverse();
const clone = o => JSON.parse(JSON.stringify(o || {}));
const numOr = v => (v === '' || v == null || isNaN(+v)) ? '' : +v;
function calcRow(r, meals, set) {
  const wk = (r.d || []).filter(Boolean).length;
  const fee = (r.price === '' || r.price == null) && (r.disc === '' || r.disc == null) ? '' : (+r.price || 0) - (+r.disc || 0);
  const mealN = r.name ? ((meals || {})[r.name] || []).length : 0;
  const mealAmt = mealN * set.meal; return { wk, fee, mealN, mealAmt, total: (+fee || 0) + mealAmt };
}
// 식대는 후불: ○월 정산에는 전월(○-1월) 식대 출석표의 횟수가 청구돼요 (원비는 선불로 그달 것)
const prevYm = ym => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const billMeals = m => (m && m.ym && D.fin[prevYm(m.ym)] && D.fin[prevYm(m.ym)].meals) || {};
const monL = ym => +ym.slice(5) + '월';
function calcMonth(m, set) {
  set = set || finSet(); const rows = (m.rows || []).filter(r => r.name || r.price);
  const bm = billMeals(m); const cs = rows.map(r => calcRow(r, bm, set));
  const sum = k => cs.reduce((a, c) => a + (+c[k] || 0), 0);
  const staff = ((bm['원장'] || []).length + (bm['부원장'] || []).length) * set.meal;
  const perDay = DAYS6.map((_, k) => rows.filter(r => (r.d || [])[k]).length);
  return { n: rows.filter(r => r.name).length, fee: sum('fee'), disc: rows.reduce((a, r) => a + (+r.disc || 0), 0), price: rows.reduce((a, r) => a + (+r.price || 0), 0), meal: sum('mealAmt'), mealN: sum('mealN'), total: sum('total'), staff, wk: sum('wk'), perDay };
}
const finCur = () => V.finEdit && V.finEdit.ym === V.ym ? V.finEdit : null;
function finOpen(ym) { V.ym = ym; V.finEdit = D.fin[ym] ? clone(D.fin[ym]) : null; V.finDirty = false; }
let finT = null;
function finTouch() {
  V.finDirty = true; V.finSaving = 'pending'; clearTimeout(finT);
  finT = setTimeout(async () => {
    const m = V.finEdit; if (!m) return; V.finSaving = 'saving'; sr();
    try { await setDoc(doc(db, 'fin', 'm_' + m.ym), m); V.finDirty = false; V.finSaving = 'saved'; } catch (e) { V.finSaving = 'error'; fail(e, '정산을 저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); }
    sr();
  }, 700);
}
const saveBadge = () => V.finSaving === 'saving' || V.finSaving === 'pending' ? chip('저장 중...', 'warn') : V.finSaving === 'error' ? chip('저장 실패', 'bad') : chip('자동 저장됨', 'ok');
const rowStu = r => r.sid ? stu(r.sid) : D.students.find(x => x.name === r.name);
const blankRow = s => ({ name: s.name, sid: s.id, course: '', d: [0, 0, 0, 0, 0, 0], price: '', disc: '', extra: '', book: '', memo: '' });
// 이번 달·다음 달 정산에는 재원생이 자동으로 들어가요 (학생은 학생명부에서만 추가)
// 정산 줄 자동 맞춤: 학생명부의 첫 등록일이 그달 말일 이전인 재원생만 들어와요 (다음 달 1일 시작이면 그 달부터)
const joinedOf = s => (D.sinfo[s.id] || {}).joined || '';
const inMonth = (s, ym) => { const j = joinedOf(s); return !j || j.slice(0, 7) <= ym; };
const blankFinRow = r => !r.price && !r.disc && !r.extra && !r.book && !r.memo && !(r.d || []).some(Boolean);
function finSync(m) {
  if (!m || m.ym < ymOf(TODAY)) return false; m.rows = m.rows || []; let ch = false;
  for (const s of active()) { const r = m.rows.find(x => x.sid === s.id || (!x.sid && x.name === s.name));
    if (!inMonth(s, m.ym)) { if (r && blankFinRow(r) && !((m.meals || {})[r.name] || []).length) { m.rows.splice(m.rows.indexOf(r), 1); ch = true; } continue; }
    if (!r) { if (m.rows.length < FIN_MAX) { m.rows.push(blankRow(s)); ch = true; } } else if (!r.sid || r.name !== s.name) { if (r.name !== s.name && m.meals && m.meals[r.name]) { m.meals[s.name] = m.meals[r.name]; delete m.meals[r.name]; } r.sid = s.id; r.name = s.name; ch = true; } }
  return ch;
}
function pFin() {
  if (!isOwnerMe()) return '<h1>정산</h1><section class="card"><p class="empty">원장님만 볼 수 있어요</p></section>';
  const ms = finMonths(); const set = finSet();
  if (!V.ym || (!D.fin[V.ym] && !finCur())) { if (ms.length) finOpen(ms.includes(ymOf(TODAY)) ? ymOf(TODAY) : ms[0]); }
  const m = finCur(); if (m && finSync(m)) finTouch();
  const head = '<h1>정산 <span class="sub">원비 = 정가 − 할인 (교습소 수입) · 식대는 별도 사업자 청구 · 학부모 총 납부액 = 이번 달 원비(선불) + 전월 식대(후불)</span></h1>' +
    '<div class="bar">' + ms.map(ym => '<button class="btn sm ' + (ym === V.ym ? '' : 'ghost') + '" data-a="finYm" data-v="' + ym + '">' + ymLabel(ym) + '</button>').join(' ') +
    ' <button class="btn sm" data-a="finNew">+ 새 달 만들기</button><span style="flex:1"></span><label class="btn sm ghost" style="cursor:pointer">엑셀 불러오기<input type="file" id="xlIn" accept=".xlsx" hidden></label> <button class="btn sm ghost" data-a="xlOut">엑셀로 내보내기</button></div>';
  if (!m) return head + '<section class="card"><p class="empty">아직 정산 자료가 없어요. [엑셀 불러오기]로 기존 파일을 가져오거나 [+ 새 달 만들기]를 누르세요.</p></section>' + finSummary() + finSettings(set);
  const C = calcMonth(m, set); const ym = m.ym; const P = 'fn_' + ym.replace('-', '') + '_';
  const studs = D.students.filter(s => !s.left).map(s => s.name);
  const rows = (m.rows || []).map((r, i) => {
    const c = calcRow(r, billMeals(m), set); const s = rowStu(r);
    return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.name || '') + '</b>' + (s && s.left ? ' <span class="sub">퇴원</span>' : !s ? ' <span class="sub">앱에 없음</span>' : '') + '</td>' +
      '<td class="sub">' + esc(s ? (s.school || '') : (r.name ? '명부에 없음' : '')) + '</td><td class="sub">' + esc(s ? s.grade : '') + '</td>' +
      '<td><input id="' + P + i + '_course" data-fi="' + i + '" data-k="course" value="' + esc(r.course ?? '') + '" style="width:44px"></td>' +
      DAYS6.map((_, k) => '<td class="cen"><input type="checkbox" id="' + P + i + '_d' + k + '" data-fi="' + i + '" data-k="d" data-day="' + k + '"' + ((r.d || [])[k] ? ' checked' : '') + '></td>').join('') +
      '<td class="cen"><b>' + (r.name ? c.wk : '') + '</b></td>' +
      '<td><input id="' + P + i + '_price" data-fi="' + i + '" data-k="price" inputmode="numeric" value="' + esc(r.price ?? '') + '" style="width:80px;text-align:right"></td>' +
      '<td><input id="' + P + i + '_disc" data-fi="' + i + '" data-k="disc" inputmode="numeric" value="' + esc(r.disc ?? '') + '" style="width:66px;text-align:right"></td>' +
      '<td class="r"><b>' + won(c.fee) + '</b></td>' +
      '<td><input id="' + P + i + '_extra" data-fi="' + i + '" data-k="extra" value="' + esc(r.extra || '') + '" style="width:120px"></td>' +
      '<td><input id="' + P + i + '_book" data-fi="' + i + '" data-k="book" value="' + esc(r.book || '') + '" style="width:100px"></td>' +
      '<td class="cen">' + (r.name ? c.mealN : '') + '</td><td class="r">' + (r.name ? won(c.mealAmt) : '') + '</td><td class="r"><b>' + (r.name ? won(c.total) : '') + '</b></td>' +
      '<td><input id="' + P + i + '_memo" data-fi="' + i + '" data-k="memo" value="' + esc(r.memo || '') + '" style="width:120px"></td>' +
      '<td>' + (!s || s.left ? '<button class="btn xs ghost" data-a="finDel" data-v="' + i + '" title="이 달에서 빼기">✕</button>' : '') + '</td></tr>';
  }).join('');
  const over = k => C.perDay[k] > set.cap1;
  const table = '<section class="card scroll"><h2>① 원비 · 수강 정보 <span class="sub">' + ymLabel(ym) + ' · 학생 ' + C.n + '명</span> ' + saveBadge() + '</h2>' +
    '<table class="fin"><thead><tr><th>No</th><th>이름</th><th>학교</th><th>학년</th><th>Course</th>' + DAYS6.map(d => '<th class="cen">' + d + '</th>').join('') + '<th>주 횟수</th><th>정가</th><th>할인</th><th>원비 (교습소)</th><th>보충과목 (과외 별도)</th><th>교재</th><th>전월 식대 횟수<br><small class="sub">' + monL(prevYm(ym)) + '분</small></th><th>전월 식대 (별도)</th><th>학부모 총 납부액</th><th>메모</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="23" class="empty">학생 줄이 없어요</td></tr>') +
    '<tr class="tot"><td></td><td><b>합계</b></td><td colspan="3">' + C.n + '명</td>' + C.perDay.map((n, k) => '<td class="cen"' + (over(k) ? ' style="color:var(--bad);font-weight:700"' : '') + '>' + n + '</td>').join('') + '<td class="cen"><b>' + C.wk + '</b></td><td class="r">' + won(C.price) + '</td><td class="r">' + won(C.disc) + '</td><td class="r"><b>' + won(C.fee) + '</b></td><td></td><td></td><td class="cen">' + C.mealN + '</td><td class="r">' + won(C.meal) + '</td><td class="r"><b>' + won(C.total) + '</b></td><td colspan="2"></td></tr>' +
    '<tr class="sub"><td></td><td>1층 정원</td><td colspan="3">하루 최대 ' + set.cap1 + '명</td>' + DAYS6.map((_, k) => '<td class="cen">' + (over(k) ? '<b style="color:var(--bad)">초과</b>' : set.cap1 - C.perDay[k]) + '</td>').join('') + '<td colspan="12"></td></tr>' +
    '</tbody></table><div class="bar" style="margin-top:10px"><span class="sub">학생은 [학생명부]의 첫 등록일이 속한 달부터 정산에 자동으로 들어와요 · 여기서는 Course·요일·원비·보충과목·교재·메모만 입력 · 퇴원생 줄만 ✕로 뺄 수 있어요</span><span style="flex:1"></span><button class="btn sm ghost danger" data-a="finDelMonth">이 달 삭제</button></div></section>';
  const wkCap1 = set.cap1 * 6, wkCap2 = set.cap2 * 6;
  const sumCard = '<div class="grid2"><section class="card"><h2>② 이번 달 요약</h2><table><tbody>' +
    [['교습소 원비 수입', C.fee], ['장기수강 할인 합계', C.disc], ['식대 청구 (' + monL(prevYm(ym)) + '분 · 별도 사업자)', C.meal], ['학부모 총 납부액 (원비+전월 식대)', C.total], ['원장 · 부원장 식대 (' + monL(prevYm(ym)) + '분)', C.staff]].map(([l, v]) => '<tr><td>' + l + '</td><td class="r"><b>' + won(v) + '원</b></td></tr>').join('') + '</tbody></table></section>' +
    '<section class="card"><h2>③ 주간 정원 (최대 인원)</h2><table><tbody><tr><td>1층 교습소</td><td class="r">' + wkCap1 + '명</td><td class="sub">평일 ' + set.cap1 * 5 + ' / 토 ' + set.cap1 + '</td></tr><tr><td>2층 공부방</td><td class="r">' + wkCap2 + '명</td><td class="sub">평일 ' + set.cap2 * 5 + ' / 토 ' + set.cap2 + '</td></tr><tr><td>합계</td><td class="r">' + (wkCap1 + wkCap2) + '명</td><td></td></tr><tr><td>1층 현재 주간 등원</td><td class="r"><b>' + C.wk + '명</b></td><td></td></tr><tr><td>1층 남은 자리 (주간)</td><td class="r"><b' + (wkCap1 - C.wk < 0 ? ' style="color:var(--bad)"' : '') + '>' + (wkCap1 - C.wk) + '명</b></td><td></td></tr></tbody></table></section></div>';
  return head + table + sumCard + finMeals(m, set) + finSummary() + finSettings(set);
}
function finMeals(m, set) {
  // 가로형: 사람이 줄, 날짜가 칸 (한 달이 한 화면에)
  const ym = m.ym; const n = daysIn(ym); const people = ['원장', '부원장', ...(m.rows || []).map(r => r.name).filter(Boolean)];
  const has = (k, d) => ((m.meals || {})[k] || []).includes(d);
  const cnt = p => ((m.meals || {})[p] || []).length;
  const days = Array.from({ length: n }, (_, i) => { const d = i + 1; return { d, w: new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, d).getDay() }; });
  const wc = w => w === 0 ? ' sun' : w === 6 ? ' sat' : '';
  const head = '<tr><th class="nm">이름</th>' + days.map(x => '<th class="cen' + wc(x.w) + '">' + x.d + '<br><small>' + WD[x.w] + '</small></th>').join('') + '<th class="cen">횟수</th><th class="r">금액</th></tr>';
  const body = people.map((p, i) => '<tr' + (i === 2 ? ' class="gap"' : '') + '><td class="nm"><b>' + esc(p) + '</b></td>' + days.map(x => '<td class="cen meal' + wc(x.w) + (has(p, x.d) ? ' on' : '') + '" data-a="meal" data-v="' + esc(p) + '|' + x.d + '">' + (has(p, x.d) ? '1' : '') + '</td>').join('') + '<td class="cen"><b>' + cnt(p) + '</b></td><td class="r">' + won(cnt(p) * set.meal) + '</td></tr>').join('');
  const dayTot = '<tr class="tot"><td class="nm"><b>그날 합계</b></td>' + days.map(x => { const k = people.filter(p => has(p, x.d)).length; return '<td class="cen' + wc(x.w) + '">' + (k || '') + '</td>'; }).join('') + '<td class="cen"><b>' + people.reduce((a, p) => a + cnt(p), 0) + '</b></td><td class="r"><b>' + won(people.reduce((a, p) => a + cnt(p), 0) * set.meal) + '</b></td></tr>';
  return '<section class="card scroll"><h2>④ 식대 출석표 <span class="sub">이번 달 먹은 날 → 다음 달 정산에 청구 · 칸을 누르면 1 ↔ 빈칸 · 1회 ' + won(set.meal) + '원</span></h2><div class="bar"><button class="btn sm ghost" data-a="mealAtt">등원 기록으로 채우기</button><span class="sub">앱 출결에서 그날 등원한 학생 칸에 1을 넣어요 (이미 있는 1은 그대로)</span></div>' +
    '<table class="mealt mealh"><thead>' + head + '</thead><tbody>' + body + dayTot + '</tbody></table></section>';
}
function finSummary() {
  const ms = finMonths().slice().reverse(); if (!ms.length) return '';
  const set = finSet(); const cs = ms.map(ym => [ym, calcMonth(D.fin[ym], set)]);
  const t = k => cs.reduce((a, [, c]) => a + c[k], 0);
  return '<section class="card"><h2>월별 요약</h2><table><thead><tr><th>월</th><th class="r">학생 수</th><th class="r">교습소 원비 수입</th><th class="r">장기수강 할인</th><th class="r">식대 청구 (전월분)</th><th class="r">학부모 총 납부액</th><th class="r">원장단 식대 (전월분)</th></tr></thead><tbody>' +
    cs.map(([ym, c]) => '<tr><td><a href="#" data-a="finYm" data-v="' + ym + '">' + ymLabel(ym) + '</a></td><td class="r">' + c.n + '</td><td class="r">' + won(c.fee) + '</td><td class="r">' + won(c.disc) + '</td><td class="r">' + won(c.meal) + '</td><td class="r">' + won(c.total) + '</td><td class="r">' + won(c.staff) + '</td></tr>').join('') +
    '<tr class="tot"><td><b>합계</b></td><td></td><td class="r"><b>' + won(t('fee')) + '</b></td><td class="r"><b>' + won(t('disc')) + '</b></td><td class="r"><b>' + won(t('meal')) + '</b></td><td class="r"><b>' + won(t('total')) + '</b></td><td class="r"><b>' + won(t('staff')) + '</b></td></tr></tbody></table></section>';
}
function finSettings(set) {
  return '<section class="card"><h2>설정</h2><form id="finSetF" class="form"><div class="row2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><label>식대 단가 (1회, 원)<input id="fsMeal" inputmode="numeric" value="' + set.meal + '"></label><label>1층 교습소 하루 최대 인원<input id="fsCap1" inputmode="numeric" value="' + set.cap1 + '"></label><label>2층 공부방 하루 최대 인원<input id="fsCap2" inputmode="numeric" value="' + set.cap2 + '"></label></div><button class="btn" type="submit">설정 저장</button><p class="sub">식대 단가를 바꾸면 모든 달의 식대 금액이 새 단가로 다시 계산돼요 (기존 엑셀과 같은 방식).</p></form></section>';
}
function finNewMonth() {
  const ms = finMonths(); let ym;
  if (!ms.length) ym = ymOf(TODAY); else { const [y, mo] = ms[0].split('-').map(Number); ym = mo === 12 ? (y + 1) + '-01' : y + '-' + pad(mo + 1); }
  const prev = ms.length ? D.fin[ms[0]] : null;
  const rows = prev ? clone(prev.rows).filter(r => { const s = r.sid ? stu(r.sid) : D.students.find(x => x.name === r.name); return !s || !s.left; }) : D.students.filter(s => !s.left).slice(0, FIN_MAX).map(s => ({ name: s.name, sid: s.id, course: '', d: [0, 0, 0, 0, 0, 0], price: '', disc: '', extra: '', book: '', memo: '' }));
  return { ym, rows, meals: {} };
}

/* ---------- 학생명부 ---------- */
const kindOf = g => /^고/.test(g || '') ? '고등' : /^중/.test(g || '') ? '중등' : /^초/.test(g || '') ? '초등' : '';
const phoneOf = (s, rel) => { const m = memberOf(s.id, rel); if (m && m.phone) return m.phone; const si = D.sinfo[s.id] || {}; return ((si.phones || {})[rel]) || ''; };
function pRoster() {
  const list = [...D.students].sort((a, b) => (!!a.left - !!b.left) || a.name.localeCompare(b.name, 'ko'));
  const sc = schools();
  return '<p class="sub" style="margin:0 0 10px">재원·퇴원 학생 상세 정보(생년월일·첫 등록일·메모·학교·학년·재원 상태) · 연락처도 여기서 바로 추가·수정 (🔒 = 앱 가입 완료된 로그인 번호라 못 바꿈)</p>' +
    '<datalist id="rsSc">' + sc.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' +
    '<section class="card scroll"><form id="rosterF"><table class="fin"><thead><tr><th>No</th><th>이름</th><th>생년월일</th><th>학생 연락처</th><th>모 연락처</th><th>부 연락처</th><th>학교</th><th>학년</th><th>구분</th><th>첫 등록일</th><th>상태</th><th>메모</th></tr></thead><tbody>' +
    (list.length ? list.map((s, i) => { const si = D.sinfo[s.id] || {}; const P = 'rs_' + s.id + '_';
      const nL = list.filter(x => x.left).length; const sep = s.left && (i === 0 || !list[i - 1].left) ? '<tr class="lefthd"><td colspan="12"><button type="button" class="btn sm ghost" data-a="showLeft">' + (V.showLeft ? '▾ 퇴원생 ' + nL + '명 접기' : '▸ 퇴원생 ' + nL + '명 펼치기') + '</button></td></tr>' : '';
      return sep + '<tr' + (s.left ? ' class="left"' + (V.showLeft ? '' : ' style="display:none"') : '') + '><td>' + (s.left ? '' : i + 1) + '</td><td><b>' + esc(s.name) + '</b></td><td><input type="date" id="' + P + 'birth" data-rs="' + s.id + '" value="' + esc(si.birth || '') + '"></td>' +
        ['student', 'mother', 'father'].map(rel => { const m = memberOf(s.id, rel); return m && m.st !== 'none' ? '<td class="sub" title="앱 가입 완료 · 로그인 번호라 여기서 못 바꿔요">' + esc(fmtP(m.phone)) + ' 🔒</td>' : '<td><input id="' + P + 'p_' + rel + '" data-rs="' + s.id + '" inputmode="numeric" placeholder="010-" value="' + esc(fmtP(phoneOf(s, rel))) + '" style="width:118px"></td>'; }).join('') +
        '<td><input id="' + P + 'school" data-rs="' + s.id + '" list="rsSc" value="' + esc(s.school || '') + '" style="width:90px"></td><td><select id="' + P + 'grade" data-rs="' + s.id + '">' + GRADES.map(g => opt(g, s.grade)).join('') + '</select></td><td class="sub">' + kindOf(s.grade) + '</td>' +
        '<td><input type="date" id="' + P + 'joined" data-rs="' + s.id + '" value="' + esc(si.joined || '') + '"></td><td><select id="' + P + 'st" data-rs="' + s.id + '">' + opt('재원', s.left ? '퇴원' : '재원') + opt('퇴원', s.left ? '퇴원' : '재원') + '</select></td>' +
        '<td><input id="' + P + 'memo" data-rs="' + s.id + '" value="' + esc(si.memo || '') + '" style="width:160px"></td></tr>'; }).join('') : '<tr><td colspan="12" class="empty">학생이 없어요</td></tr>') +
    '</tbody></table><div class="mf"><span class="sub">퇴원으로 바꾸면 앱 목록·정산 새 달에서 빠져요 (기록은 남아요)</span><span style="flex:1"></span><button class="btn" type="submit">변경 내용 저장</button></div></form></section>';
}

/* ---------- 엑셀 불러오기 / 내보내기 ---------- */
const truthy = v => v !== null && v !== undefined && v !== '' && v !== 0 && v !== '0';
function parseWorkbook(wb) {
  const S = wb.sheets; const out = { settings: null, roster: [], months: [] };
  if (S['설정']) out.settings = { meal: +S['설정'].C4 || 8000, cap1: +S['설정'].C5 || 6, cap2: +S['설정'].C6 || 9 };
  const R = S['학생명부'];
  if (R) for (let r = 5; r < 400; r++) { const name = R['B' + r]; if (!name) continue;
    const g = R['H' + r], kind = R['I' + r] || '';
    const grade = typeof g === 'string' && /^[초중고]\d$/.test(g) ? g : g ? ((/고/.test(kind) ? '고' : /초/.test(kind) ? '초' : '중') + g) : '';
    out.roster.push({ name: String(name).trim(), birth: xlDate(R['C' + r]), phones: { student: digits(R['D' + r]), mother: digits(R['E' + r]), father: digits(R['F' + r]) }, school: R['G' + r] ? String(R['G' + r]).trim() : '', grade, kind, joined: xlDate(R['J' + r]), status: R['K' + r] || '재원', memo: R['L' + r] ? String(R['L' + r]) : '' }); }
  for (const name of wb.order) { const mm = /^(\d{4})\.(\d{1,2})$/.exec(name); if (!mm) continue;
    const M = S[name]; const ym = mm[1] + '-' + mm[2].padStart(2, '0'); const rows = [], idx = {};
    for (let r = 5; r <= 24; r++) { const nm = M['C' + r] ? String(M['C' + r]).trim() : ''; const price = M['N' + r];
      if (!nm && price == null) continue; idx[r - 5] = nm;
      rows.push({ name: nm, course: M['F' + r] != null ? String(M['F' + r]) : '', d: 'GHIJKL'.split('').map(c => truthy(M[c + r]) ? 1 : 0), price: numOr(price), disc: numOr(M['O' + r]), extra: M['Q' + r] ? String(M['Q' + r]) : '', book: M['R' + r] ? String(M['R' + r]) : '', memo: M['V' + r] ? String(M['V' + r]) : '' }); }
    const meals = {}; const nd = daysIn(ym);
    for (let r = 37; r < 37 + nd; r++) { const d = r - 36;
      if (truthy(M['D' + r])) (meals['원장'] || (meals['원장'] = [])).push(d);
      if (truthy(M['E' + r])) (meals['부원장'] || (meals['부원장'] = [])).push(d);
      for (let k = 0; k < 20; k++) { const nm = idx[k]; if (nm && truthy(M[colL(5 + k) + r])) (meals[nm] || (meals[nm] = [])).push(d); } }
    out.months.push({ ym, rows, meals }); }
  return out;
}
const colL = n => String.fromCharCode(65 + n); // 0→A (A~Z 범위만)
async function importXlsx(file) {
  try { const wb = await readXlsx(file); const p = parseWorkbook(wb);
    if (!p.roster.length && !p.months.length) return toast('학생명부나 월별(예: 2026.12) 시트를 찾지 못했어요');
    V.xl = p; V.xlName = file.name; V.modal = 'xl'; render(); }
  catch (e) { fail(e, '엑셀을 읽지 못했어요: ' + e.message); }
}
function xlModal() {
  const p = V.xl; const byName = n => D.students.find(s => s.name === n);
  const newOnes = p.roster.filter(r => !byName(r.name));
  const set = p.settings || finSet();
  return '<div class="mbg" data-a="close"><div class="modal wide"><h2>엑셀 불러오기 <span class="sub">' + esc(V.xlName || '') + '</span></h2>' +
    '<table><tbody><tr><td>설정</td><td>' + (p.settings ? '식대 ' + won(p.settings.meal) + '원 · 1층 ' + p.settings.cap1 + '명 · 2층 ' + p.settings.cap2 + '명' : '<span class="sub">없음</span>') + '</td></tr>' +
    '<tr><td>학생명부</td><td>' + p.roster.length + '명 (앱에 이미 있는 학생 ' + (p.roster.length - newOnes.length) + '명은 정보 갱신, 새로 추가 ' + newOnes.length + '명' + (newOnes.length ? ': ' + newOnes.map(r => esc(r.name) + (r.status === '퇴원' ? '(퇴원)' : '')).join(', ') : '') + ')</td></tr>' +
    '<tr><td>월별 정산</td><td>' + (p.months.length ? p.months.map(m => { const c = calcMonth(m, set); return '<div>' + ymLabel(m.ym) + ' · ' + c.n + '명 · 원비 ' + won(c.fee) + ' · 식대 ' + won(c.meal) + ' · 총 ' + won(c.total) + (D.fin[m.ym] ? ' <span class="chip warn">앱에 있는 이 달을 덮어써요</span>' : '') + '</div>'; }).join('') : '<span class="sub">없음</span>') + '</td></tr></tbody></table>' +
    '<p class="sub">새로 추가되는 재원 학생은 학생·학부모 번호도 함께 등록돼요(가입 안내 문자는 따로 보내세요). 위 금액이 기존 엑셀의 월별요약과 같은지 확인한 뒤 [가져오기]를 누르세요.</p>' +
    '<div class="mf"><span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn" data-a="xlGo">가져오기</button></div></div></div>';
}
async function xlCommit() {
  const p = V.xl; if (!p) return; const b = writeBatch(db); let ops = 0; const nameToSid = {};
  D.students.forEach(s => { nameToSid[s.name] = s.id; });
  if (p.settings) { b.set(doc(db, 'fin', 'settings'), p.settings); ops++; }
  for (const r of p.roster) {
    let sid = nameToSid[r.name]; const left = r.status === '퇴원'; const grade = r.grade || (stu(sid) || {}).grade || '중2';
    if (!sid) { const ref = doc(collection(db, 'students')); sid = ref.id; nameToSid[r.name] = sid;
      b.set(ref, { name: r.name, grade, school: r.school, course: DEF_COURSE[grade] || '중2-2', left, ts: now() }); ops++;
      if (!left) for (const rel of ['student', 'mother', 'father']) { const ph = r.phones[rel]; if (ph && ph.length >= 10) { addMember(b, sid, rel, ph, r.name, grade); ops += 2; } } }
    else { const upd = { left }; if (r.school) upd.school = r.school; if (r.grade) upd.grade = r.grade; b.update(doc(db, 'students', sid), upd); ops++; }
    b.set(doc(db, 'sinfo', sid), { birth: r.birth, joined: r.joined, kind: r.kind, memo: r.memo, phones: r.phones }, { merge: true }); ops++;
  }
  for (const m of p.months) { m.rows.forEach(r => { if (r.name && nameToSid[r.name]) r.sid = nameToSid[r.name]; }); b.set(doc(db, 'fin', 'm_' + m.ym), m); ops++; }
  if (ops > 480) return toast('한 번에 가져오기엔 내용이 너무 많아요. 시트를 나눠서 가져와 주세요.');
  await b.commit(); V.xl = null; V.modal = null; V.ym = null; V.finEdit = null;
  toast('엑셀을 가져왔어요 · 학생 ' + p.roster.length + '명 · ' + p.months.length + '개월');
}
function exportXlsx() {
  const set = finSet(); const sheets = []; const ms = finMonths();
  sheets.push({ name: '사용법', cols: [2, 110], cells: { B1: { v: '더(The)밀착수학교습소  원비 · 식대 통합 관리', s: 5 }, B3: '관리자 페이지(themilchak-math.github.io/admin.html)에서 내려받은 파일이에요. ' + fmtD(TODAY) + ' 기준.', B4: '파란 글씨 = 입력값 / 검정 = 자동 계산. 이 파일을 고쳐서 관리자 페이지 [엑셀 불러오기]로 다시 올리면 앱에 반영돼요.', B5: '시트: 설정 · 월별요약 · 학생명부 · 달마다 시트 1장 (위 = 원비·수강 정보, 아래 = 식대 출석표)' } });
  sheets.push({ name: '설정', cols: [2, 28, 12, 50], cells: { B2: { v: '설정', s: 5 }, B4: '식대 단가 (1회)', C4: { v: set.meal, s: 2 }, B5: '1층 교습소 하루 최대 인원', C5: set.cap1, B6: '2층 공부방 하루 최대 인원', C6: set.cap2 } });
  const sum = { B1: { v: '월별 요약', s: 5 } }; ['월 (시트 이름)', '학생 수', '교습소 원비 수입', '장기수강 할인', '식대 청구 (별도 사업자)', '학부모 총 납부액', '원장단 식대'].forEach((h, i) => { sum[colL(1 + i) + '4'] = { v: h, s: 6 }; });
  ms.slice().reverse().forEach((ym, i) => { const r = 5 + i, sh = "'" + ymLabel(ym) + "'!"; sum['B' + r] = ymLabel(ym); sum['C' + r] = { f: 'COUNTA(' + sh + 'C5:C24)' }; sum['D' + r] = { f: sh + 'P25', s: 2 }; sum['E' + r] = { f: sh + 'O25', s: 2 }; sum['F' + r] = { f: sh + 'T25', s: 2 }; sum['G' + r] = { f: sh + 'U25', s: 2 }; sum['H' + r] = { f: sh + 'E32', s: 2 }; });
  const lr = 5 + ms.length; sum['B' + lr] = { v: '합계', s: 1 }; 'DEFGH'.split('').forEach(c => { sum[c + lr] = { f: 'SUM(' + c + '5:' + c + (lr - 1) + ')', s: 4 }; });
  sheets.push({ name: '월별요약', cols: [2, 16, 9, 16, 14, 20, 18, 14], cells: sum });
  const ro = { B1: { v: '학생명부', s: 5 } }; ['No', '이름', '생년월일', '학생 연락처', '모 연락처', '부 연락처', '학교', '학년', '구분', '첫 등록일', '상태', '메모'].forEach((h, i) => { ro[colL(i) + '4'] = { v: h, s: 6 }; });
  [...D.students].sort((a, b) => (!!a.left - !!b.left) || a.name.localeCompare(b.name, 'ko')).forEach((s, i) => { const r = 5 + i, si = D.sinfo[s.id] || {};
    Object.assign(ro, { ['A' + r]: i + 1, ['B' + r]: { v: s.name, s: 7 }, ['C' + r]: si.birth ? { v: si.birth, date: true } : null, ['D' + r]: fmtP(phoneOf(s, 'student')), ['E' + r]: fmtP(phoneOf(s, 'mother')), ['F' + r]: fmtP(phoneOf(s, 'father')), ['G' + r]: s.school || '', ['H' + r]: +String(s.grade || '').slice(1) || s.grade, ['I' + r]: kindOf(s.grade), ['J' + r]: si.joined ? { v: si.joined, date: true } : null, ['K' + r]: s.left ? '퇴원' : '재원', ['L' + r]: si.memo || '' }); });
  sheets.push({ name: '학생명부', cols: [5, 10, 12, 15, 15, 15, 10, 6, 6, 12, 6, 24], cells: ro });
  for (const ym of ms) sheets.push(monthSheet(D.fin[ym], set));
  download(writeXlsx(sheets), '더밀착수학_원비식대_' + TODAY.replace(/-/g, '') + '.xlsx');
  toast('엑셀 파일을 내려받았어요');
}
function monthSheet(m, set) {
  const c = {}; const ym = m.ym; const [y, mo] = ym.split('-').map(Number);
  c.B1 = { v: y + '년 ' + mo + '월  원비 · 식대 정산', s: 5 }; c.B2 = '기준월'; c.C2 = { v: ym + '-01', date: true }; c.B3 = { v: '① 원비 · 수강 정보', s: 1 };
  ['No', '이름', '학교', '학년', 'Course', '월', '화', '수', '목', '금', '토', '주 횟수', '정가', '할인', '원비 (교습소)', '보충과목 (과외 별도)', '교재', '식대 횟수', '식대 (별도 사업자)', '학부모 총 납부액', '메모'].forEach((h, i) => { c[colL(1 + i) + '4'] = { v: h, s: 6 }; });
  const rows = (m.rows || []).slice(0, FIN_MAX);
  for (let i = 0; i < FIN_MAX; i++) { const r = 5 + i, x = rows[i]; c['B' + r] = i + 1; const mc = colL(5 + i);
    c['M' + r] = { f: 'IF(C' + r + '="","",SUM(G' + r + ':L' + r + '))' }; c['P' + r] = { f: 'IF(AND(N' + r + '="",O' + r + '=""),"",N(N' + r + ')-N(O' + r + '))', s: 2 };
    c['S' + r] = { f: 'IF(C' + r + '="","",' + mc + '68)' }; c['T' + r] = { f: 'IF(C' + r + '="","",S' + r + '*설정!$C$4)', s: 2 }; c['U' + r] = { f: 'IF(C' + r + '="","",N(P' + r + ')+N(T' + r + '))', s: 2 };
    if (!x) continue; const s = x.sid ? stu(x.sid) : D.students.find(z => z.name === x.name);
    c['C' + r] = { v: x.name, s: 7 }; c['D' + r] = s ? s.school || '' : ''; c['E' + r] = s ? (+String(s.grade).slice(1) || s.grade) : '';
    if (x.course !== '' && x.course != null) c['F' + r] = isNaN(+x.course) ? x.course : +x.course;
    (x.d || []).forEach((v, k) => { if (v) c[colL(6 + k) + r] = 1; });
    if (x.price !== '' && x.price != null) c['N' + r] = { v: +x.price, s: 2 }; if (x.disc !== '' && x.disc != null) c['O' + r] = { v: +x.disc, s: 2 };
    if (x.extra) c['Q' + r] = x.extra; if (x.book) c['R' + r] = x.book; if (x.memo) c['V' + r] = x.memo; }
  c.B25 = { v: '합계', s: 1 }; c.C25 = { f: 'COUNTA(C5:C24)&"명"', str: true }; 'GHIJKLMNOPSTU'.split('').forEach(k => { c[k + '25'] = { f: 'SUM(' + k + '5:' + k + '24)', s: 4 }; });
  c.B27 = { v: '② 이번 달 요약', s: 1 }; [['교습소 원비 수입', 'P25'], ['장기수강 할인 합계', 'O25'], ['식대 청구 (별도 사업자)', 'T25'], ['학부모 총 납부액 (원비+식대)', 'U25'], ['원장 · 부원장 식대', '(D68+E68)*설정!$C$4']].forEach(([l, f], i) => { c['B' + (28 + i)] = l; c['E' + (28 + i)] = { f, s: 4 }; });
  c.B34 = { v: '③ 식대 출석표', s: 1 }; c.D34 = '먹은 날 1 입력 · 학생 순서는 ① 표와 같음';
  c.B36 = { v: '날짜', s: 6 }; c.C36 = { v: '요일', s: 6 }; c.D36 = { v: '원장', s: 6 }; c.E36 = { v: '부원장', s: 6 };
  rows.forEach((x, i) => { c[colL(5 + i) + '36'] = { v: x.name || '', s: 6 }; });
  const nd = daysIn(ym); const has = (k, d) => ((m.meals || {})[k] || []).includes(d);
  for (let d = 1; d <= nd; d++) { const r = 36 + d; c['B' + r] = { v: dateOf(ym, d), date: true }; c['C' + r] = WD[new Date(y, mo - 1, d).getDay()];
    if (has('원장', d)) c['D' + r] = 1; if (has('부원장', d)) c['E' + r] = 1; rows.forEach((x, i) => { if (x.name && has(x.name, d)) c[colL(5 + i) + r] = 1; }); }
  c.B68 = { v: '횟수', s: 1 }; c.B69 = { v: '금액', s: 1 };
  for (let k = 3; k < 25; k++) { const L2 = colL(k); c[L2 + '68'] = { f: 'SUM(' + L2 + '37:' + L2 + '67)' }; c[L2 + '69'] = { f: L2 + '68*설정!$C$4', s: 2 }; }
  return { name: ymLabel(ym), cols: [2, 6, 9, 9, 5, 7, 4, 4, 4, 4, 4, 4, 7, 10, 9, 12, 20, 14, 8, 12, 14, 18], cells: c };
}

/* ---------- 부원장 (원장님만) ---------- */
const staffInvite = x => '[더밀착수학] ' + (x.name || '') + ' 선생님, 더밀착수학 관리 앱 부원장 계정 안내드려요.\n\n▶ 설치 안내: https://themilchak-math.github.io/install.html\n가입할 때 이 번호(' + fmtP(x.phone) + ')와 원하는 비밀번호 입력 → 원장님 승인 후 이용\nPC 관리자 페이지: https://themilchak-math.github.io/admin.html';
function pStaff() {
  if (!isOwnerMe()) return '<h1>부원장</h1><section class="card"><p class="empty">원장님만 볼 수 있어요</p></section>';
  const l = D.staff;
  return '<h1>부원장 관리 <span class="sub">승인된 부원장은 학생 관리·출결·숙제·기록·시험기간·공지·메시지를 원장님과 똑같이 써요 (부원장 등록·앱 설정은 원장님만)</span></h1><div class="grid2"><section class="card"><h2>부원장 등록</h2><form id="staffF" class="form"><label>이름<input id="sfN" placeholder="예: 홍길동" autocomplete="off"></label><label>휴대폰 (로그인 아이디)<input id="sfP" inputmode="numeric" placeholder="010-0000-0000"></label><button class="btn" type="submit">등록</button></form><p class="sub">등록 → [문자 앱 열기]로 안내 → 부원장님이 이 번호로 가입 → 여기서 [승인]</p></section>' +
    '<section class="card"><h2>부원장 목록</h2>' + (l.length ? '<table><tbody>' + l.map(x => '<tr><td><b>' + esc(x.name || '') + '</b><div class="sub">' + esc(fmtP(x.phone)) + '</div></td><td>' + (x.st === 'ok' ? chip('사용 중', 'ok') : x.st === 'pending' ? chip('승인 대기', 'warn') : chip('미가입')) + '</td><td class="r">' + (x.st === 'pending' ? '<button class="btn xs ghost" data-a="stRej" data-id="' + x.id + '">거절</button> <button class="btn xs" data-a="stOk" data-id="' + x.id + '">승인</button> ' : '') + (x.st === 'none' ? '<a class="btn xs" href="' + esc('sms:' + x.phone + (isIOSdev() ? '&' : '?') + 'body=' + encodeURIComponent(staffInvite(x))) + '">문자 앱 열기</a> <button class="btn xs ghost" data-a="stCopy" data-id="' + x.id + '">문구 복사</button> ' : '') + '<button class="btn xs ghost danger" data-a="stDel" data-id="' + x.id + '">삭제</button></td></tr>').join('') + '</tbody></table>' : '<p class="empty">등록된 부원장이 없어요</p>') + '</section></div>';
}
function pNotice() {
  const list = [...D.notices].sort((a, b) => (b.pin - a.pin) || ((b.ts || 0) - (a.ts || 0)));
  const own = isOwnerMe();
  return '<h1>공지' + (own ? '' : ' <span class="sub">공지 작성·삭제는 원장님만 할 수 있어요</span>') + '</h1><div class="' + (own ? 'grid2' : '') + '">' + (own ? '<section class="card"><h2>공지 쓰기</h2><form id="ntF" class="form"><input id="nT" placeholder="제목"><textarea id="nB" rows="8" placeholder="내용"></textarea><label class="sw"><input type="checkbox" id="nP"> 상단 고정</label><button class="btn" type="submit">올리기</button></form></section>' : '') +
    '<section class="card"><h2>공지 목록</h2>' + (list.length ? list.map(n => '<div class="notice"><div>' + (n.pin ? chip('고정', 'bad') + ' ' : '') + '<b>' + esc(n.title) + '</b> <span class="sub">' + fmtD(n.at) + ' · 읽음 ' + (n.reads || []).length + '명</span></div><p>' + esc(n.body) + '</p>' + (own ? '<button class="btn xs ghost" data-a="delN" data-id="' + n.id + '">삭제</button>' : '') + '</div>').join('') : '<p class="empty">공지가 없어요</p>') + '</section></div>';
}

// 시스템 자동 알림 말풍선 (원장님이 직접 보낸 메시지와 구분)
function sysHtml(m) { const x = /^\[([^\]]+)\]\s*/.exec(m.t || ''); const ttl = x ? x[1] : '알림'; const body = x ? m.t.slice(x[0].length) : (m.t || '');
  return '<div class="m sys"><span class="sl">🔔 더밀착수학 자동 알림</span><b>' + esc(ttl) + '</b>' + esc(body) + '<small>' + esc((m.at || '').slice(5)) + '</small></div>'; }
function pMsg() {
  const keys = []; active().forEach(s => { keys.push(...stuKey(s.id)); if (famSids(s.id)[0] === s.id) keys.push(...parKeys(s.id)); });
  const items = keys.map(k => { const t = fthread(k); const last = t[t.length - 1]; return { k, last, un: t.filter(m => m.f === 'o' && !m.r).length }; }).sort((a, b) => ((b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0)));
  const nameK = k => { const [sd, rr] = k.split('|'); return rr !== 'student' ? famLabel(sd, REL[rr]) : stu(sd).name + ' 학생'; };
  const empty = items.filter(i => !i.last && i.k !== V.chat);
  const newSel = empty.length ? '<select id="newChat" style="width:100%;margin-bottom:6px"><option value="">+ 새 대화 시작…</option>' + empty.map(i => '<option value="' + esc(i.k) + '">' + esc(nameK(i.k)) + '</option>').join('') + '</select>' : '';
  const list = items.filter(i => i.last || i.k === V.chat).map(i => { const [sid, r] = i.k.split('|'); const s = stu(sid); return '<button class="th' + (V.chat === i.k ? ' on' : '') + '" data-a="open" data-v="' + esc(i.k) + '"><b>' + esc(r !== 'student' ? famLabel(sid, REL[r]) : s.name + ' 학생') + '</b>' + (i.un ? '<span class="badge">' + i.un + '</span>' : '') + '<span class="sub ell">' + (i.last ? esc(i.last.t) : '새 대화') + '</span></button>'; }).join('');
  let chat = '<p class="empty">왼쪽에서 대화를 고르세요</p>';
  if (V.chat) {
    const [sid, r] = V.chat.split('|'); const s = stu(sid); const t = fthread(V.chat);
    const mx = m => m.id ? '<button class="mx" data-a="msgDel" data-id="' + m.id + '" title="이 메시지 삭제 (상대방 화면에서도 사라져요)">×</button>' : '';
    chat = '<h2 style="display:flex;align-items:center;gap:8px">' + esc(r !== 'student' ? famLabel(sid, REL[r]) : (s ? s.name : '') + ' 학생') + (t.length ? '<button class="btn xs ghost" style="margin-left:auto" data-a="chatDel">대화 삭제</button>' : '') + '</h2><div class="chat" id="chatBody">' + (t.length ? t.map(m => m.f === 's' ? sysHtml(m).replace('<div class="m sys">', '<div class="m sys">' + mx(m)) : '<div class="m ' + (m.f === 't' ? 'me' : 'you') + '">' + mx(m) + esc(m.t) + '<small>' + esc((m.at || '').slice(5)) + (m.f === 't' && m.r ? ' · 읽음' : '') + '</small></div>').join('') : '<p class="empty">첫 메시지를 보내보세요</p>') + '</div><form id="sendF" class="send"><input id="msgIn" placeholder="메시지 입력 후 Enter" autocomplete="off"><button class="btn" type="submit">전송</button></form>';
  }
  return '<h1>메시지</h1><div class="msgs"><section class="card tl">' + newSel + (list || '<p class="empty">아직 대화가 없어요</p>') + '</section><section class="card cv">' + chat + '</section></div>';
}

function modalHtml() {
  if (V.modal === 'xl' && V.xl) return xlModal();
  if (V.modal === 'att') return attModal();
  if (V.modal === 'stu') {
    const s = V.editId ? stu(V.editId) : null;
    const ph = rel => { const m = s && memberOf(s.id, rel); const lock = m && m.st !== 'none'; return '<label>' + REL[rel] + ' 휴대폰' + (lock ? ' <span class="sub">(' + (m.st === 'ok' ? '연결됨' : m.st === 'pending' ? '승인 대기' : '차단') + ' · 바꾸려면 차단 후 새로 등록)</span>' : '') + '<input id="p_' + rel + '" inputmode="numeric" placeholder="없으면 비워두세요" value="' + esc(m ? fmtP(m.phone) : '') + '"' + (lock ? ' disabled' : '') + '></label>'; };
    return '<div class="mbg" data-a="close"><form class="modal" id="stuF"><h2>' + (s ? esc(s.name) + ' 정보 수정' : '학생 등록') + '</h2><label>학생 이름<input id="sN" value="' + esc(s ? s.name : '') + '"></label><div class="row2"><label>학년<select id="sG">' + GRADES.map(g => opt(g, s ? s.grade : '중2')).join('') + '</select></label></div><label>학교 (선택)<input id="sSc" list="sScL" value="' + esc(s ? (s.school || '') : '') + '" placeholder="예: 동탄중" autocomplete="off"><datalist id="sScL">' + schools().map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' + (s ? '<label>현재 과정<select id="sC">' + COURSES.map(c => opt(c, s.course)).join('') + '</select></label>' : '') + ph('student') + ph('father') + ph('mother') +
      '<p class="sub">가족이 이 번호로 가입하면 승인 요청이 와요. 형제는 같은 부모 번호로 등록하면 이미 가입한 부모님 계정에 자동 연결돼요.</p><div class="mf">' + (s ? '<button type="button" class="btn ghost danger" data-a="leave" data-id="' + s.id + '">퇴원 처리</button>' : '') + '<span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn" type="submit">저장</button></div></form></div>';
  }
  if (V.modal === 'act') {
    const day = curDay(); const at = D.att[day] || {}; const came = x => at[x.id] && at[x.id].st !== '결석'; const l = [...active()].sort((x, y) => (came(y) - came(x)) || x.name.localeCompare(y.name, 'ko'));
    return '<div class="mbg" data-a="close"><div class="modal"><h2>🎬 다 같이 특별활동 <span class="sub">' + fmtD(day) + '</span></h2><p class="sub">영화 관람·소풍처럼 수업 대신 한 날, 고른 학생 모두에게 한 번에 기록해요. 진도·비중은 따로 안 적어요.</p>' +
      '<label>오늘 한 활동<select id="actU">' + ACT_UNITS.map(u => opt(u, ACT_UNITS[0])).join('') + opt('__x', null, '직접 입력…') + '</select></label><input id="actX" placeholder="직접 입력할 때만 (예: 과학관 견학)" style="margin-top:6px">' +
      '<label>메모 (선택)<input id="actM" placeholder="예: 시험 끝나고 다 같이 영화 \'위키드\' 봤어요"></label>' +
      '<div style="margin:8px 0"><b>학생</b> <span class="sub">오늘 등원한 학생이 미리 체크돼 있어요</span><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px">' + l.map(x => '<label class="sw" style="gap:6px;margin:0"><input type="checkbox" name="actS" value="' + x.id + '"' + (came(x) ? ' checked' : '') + '>' + esc(x.name) + '</label>').join('') + '</div></div>' +
      '<label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="actSh" checked> 학부모·학생에게 공유 (하원 알림에 함께 가요)</label>' +
      '<div class="mf"><span style="flex:1"></span><button type="button" class="btn ghost" data-a="close">닫기</button><button type="button" class="btn" data-a="actSave">기록 저장</button></div></div></div>';
  }
  if (V.modal === 'invite') {
    const list = D.members.filter(m => (V.inviteSids || []).includes(m.sid) && m.phone).sort((a, b) => (V.inviteSids.indexOf(a.sid) - V.inviteSids.indexOf(b.sid)) || ['student', 'father', 'mother'].indexOf(a.rel) - ['student', 'father', 'mother'].indexOf(b.rel));
    return '<div class="mbg" data-a="close"><div class="modal wide"><h2>가입 안내 문자 보내기</h2><p class="sub"><b>[카톡으로 보내기]</b>를 누르면 카카오톡 공유 창이 열려요 → 받을 사람(친구·채팅방)을 고르고 보내기. 처음 한 번은 카카오 계정 로그인이 필요해요. 문자로 보내려면 [QR]을 폰 카메라로 찍거나, 폰에서 [문자 앱 열기]를 누르세요.</p>' +
      (list.length ? '<table><tbody>' + list.map(m => '<tr><td><b>' + esc(mLabel(m)) + '</b><div class="sub">' + esc(fmtP(m.phone)) + '</div></td><td>' + memChip(m) + '</td><td class="r"><button class="btn xs" data-a="invKakao" data-id="' + m.id + '" style="background:#FEE500;color:#191919;border-color:#FEE500">카톡으로 보내기</button> <a class="btn xs ghost" href="' + esc(smsHref(m)) + '">문자 앱 열기</a> <button class="btn xs ghost" data-a="invQR" data-id="' + m.id + '">' + (V.invQR === m.id ? 'QR 닫기' : 'QR') + '</button> <button class="btn xs ghost" data-a="invCopy" data-id="' + m.id + '">문구 복사</button></td></tr>' + (V.invQR === m.id ? '<tr><td colspan="3" style="text-align:center"><div id="invQRBox" style="display:inline-block;padding:14px;background:#fff;border:1px solid var(--line);border-radius:14px"></div><p class="sub">폰 기본 카메라로 찍으세요 → 뜨는 알림을 누르면 문자 화면이 열려요</p></td></tr>' : '')).join('') + '</tbody></table>' : '<p class="empty">보낼 번호가 없어요</p>') +
      '<details style="margin-top:8px"><summary class="sub">보낼 문구 미리보기</summary><pre style="white-space:pre-wrap;font:inherit;background:var(--soft);padding:10px;border-radius:10px">' + esc(list[0] ? inviteText(list[0]) : '') + '</pre></details><div class="mf"><span style="flex:1"></span><button type="button" class="btn" data-a="close">닫기</button></div></div></div>';
  }
  if (V.modal === 'bulk') {
    const b = V.bulk;
    return '<div class="mbg" data-a="close"><form class="modal wide" id="bulkF"><h2>엑셀에서 여러 명 붙여넣기</h2><p class="sub">엑셀에서 아래 순서로 열을 맞춰 복사(Ctrl+C)한 뒤 아래 칸에 붙여넣기(Ctrl+V) 하세요. 첫 줄이 제목이면 자동으로 건너뛰어요.<br><b>이름 · 학년(초4~고3) · 학생 번호 · 아버님 번호 · 어머님 번호 · 학교(선택)</b></p><textarea id="bulkIn" rows="7" placeholder="홍길동	중2	010-1111-2222	010-3333-4444	010-5555-6666"></textarea><button type="button" class="btn ghost" data-a="bulkCheck">미리보기</button>' +
      (b ? '<table><thead><tr><th>이름</th><th>학년</th><th>학생</th><th>아버님</th><th>어머님</th><th>학교</th><th>확인</th></tr></thead><tbody>' + b.map(r => '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.grade) + '</td><td>' + esc(fmtP(r.student)) + '</td><td>' + esc(fmtP(r.father)) + '</td><td>' + esc(fmtP(r.mother)) + '</td><td>' + esc(r.school || '') + '</td><td>' + (r.err ? chip(r.err, 'bad') : chip('등록 가능', 'ok')) + '</td></tr>').join('') + '</tbody></table>' : '') +
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
  const hw = {}; app.querySelectorAll('input[name=hwS],input[name=schCk]').forEach(el => hw[el.value] = el.checked);
  V.keep = keep;
  const ae = document.activeElement; if (ae && ae.id && app.contains(ae)) focusId = ae.id;
  const main = app.querySelector('main'); const sc = main ? main.scrollTop : 0;
  let html;
  if (V.screen === 'loading') html = '<div class="login"><div class="card"><h1>더밀착수학 관리자</h1><p class="sub">불러오는 중...</p></div></div>';
  else if (V.screen === 'login') html = loginView();
  else {
    let page = '';
    if (!isOwnerMe() && !STAFF_PAGES.includes(V.page)) V.page = 'dash';
    try { page = ({ dash: pDash, qr: pAtt, students: pPeople, att: pAtt, log: pLog, hw: pHw, exam: pExam, school: pPeople, fin: pFin, roster: pPeople, notice: pNotice, msg: pMsg, staff: pStaff }[V.page] || pDash)(); }
    catch (e) { console.error(e); page = '<section class="card"><p class="err">화면 오류: ' + esc(e.message) + '</p></section>'; }
    html = '<aside><div class="brand">더밀착수학<small>관리자</small></div><nav>' + navList().map(([k, l]) => '<button data-a="go" data-v="' + k + '" class="' + (V.page === k ? 'on' : '') + '">' + l + navBadge(k) + '</button>').join('') + '</nav><div class="foot"><a href="./" target="_blank">폰 앱 열기</a><a href="./install.html" target="_blank">설치 안내 페이지</a><button data-a="logout">로그아웃</button><small>v' + ADMIN_VERSION + '</small></div></aside><main>' + page + '</main>' + modalHtml();
  }
  if (V.toast) html += '<div class="toast">' + esc(V.toast) + '</div>';
  const same = app.dataset.p === V.page + V.screen;
  app.innerHTML = html; app.dataset.p = V.page + V.screen;
  Object.entries(keep).forEach(([id, k]) => { const el = document.getElementById(id); if (!el || el.disabled || id.startsWith('fn_') || id === 'dashD' || id === 'exSel') return; if ('c' in k) { if (id !== 'autoN') el.checked = k.c; } else { el.value = k.v; if (el.tagName === 'SELECT' && el.selectedIndex < 0 && el.options.length) el.selectedIndex = 0; } });
  app.querySelectorAll('input[name=hwS],input[name=schCk]').forEach(el => { if (el.value in hw) el.checked = hw[el.value]; });
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  const nm = app.querySelector('main'); if (nm && same) nm.scrollTop = sc;
  const cb = document.getElementById('chatBody'); if (cb) cb.scrollTop = cb.scrollHeight;
  if (V.modal === 'invite' && V.invQR) { const box = document.getElementById('invQRBox'); const m = D.members.find(x => x.id === V.invQR); if (box && m && window.QRCode) { const mk = t => { const txt = 'SMSTO:' + m.phone + ':' + t; box.innerHTML = '';
      if (window.qrcode && window.qrcode.stringToBytesFuncs) { // 한글(UTF-8)을 정확히 계산하는 QR 라이브러리
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8']; const q = window.qrcode(0, 'L'); q.addData(txt, 'Byte'); q.make();
        const n = q.getModuleCount(); box.innerHTML = q.createImgTag(Math.max(2, Math.floor(340 / (n + 8))), 4); return; }
      new window.QRCode(box, { text: txt, width: 300, height: 300, correctLevel: window.QRCode.CorrectLevel.L }); };
    // 한글이 많으면 QR 용량을 넘어요 → 넘으면 짧은 안내문으로
    try { mk(inviteText(m)); } catch (e) { try { mk(shortInvite(m)); } catch (e2) { box.innerHTML = '<p class="sub">QR을 만들 수 없어요. [문구 복사]를 써 주세요.</p>'; } } } }
}
let rT = null; const sr = () => { if (rT) return; rT = requestAnimationFrame(() => { rT = null; render(); }); };
let tt; const toast = m => { V.toast = m; clearTimeout(tt); tt = setTimeout(() => { V.toast = ''; render(); }, 3000); render(); };
const fail = (e, m) => { console.error(e); toast(m || '저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); };

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
  L(collection(db, 'exams'), s => { D.exams = docs(s); sr(); });
  L(collection(db, 'staff'), s => { D.staff = docs(s); sr(); });
  L(query(collection(db, 'abs'), where('date', '>=', off(-400))), s => { D.abs = docs(s); sr(); });
  L(query(collection(db, 'extra'), where('date', '>=', off(-400))), s => { D.extra = {}; s.docs.forEach(d => { D.extra[d.id] = d.data(); }); sr(); });
  if (isOwnerMe()) L(collection(db, 'apply'), s => { D.apply = docs(s).filter(x => x.st === 'new').sort((a, b) => ((a.ts && a.ts.seconds) || 0) - ((b.ts && b.ts.seconds) || 0)); sr(); });
  if (isOwnerMe()) L(collection(db, 'sinfo'), s => { D.sinfo = {}; s.docs.forEach(d => { D.sinfo[d.id] = d.data(); }); sr(); });
  if (isOwnerMe()) L(collection(db, 'fin'), s => { D.fin = {}; D.finSet = null; s.docs.forEach(d => { if (d.id === 'settings') D.finSet = d.data(); else if (d.id.startsWith('m_')) D.fin[d.id.slice(2)] = d.data(); }); if (V.ym && !V.finDirty) V.finEdit = D.fin[V.ym] ? clone(D.fin[V.ym]) : (V.finEdit && V.finEdit.ym === V.ym ? V.finEdit : null); sr(); });
}
onAuthStateChanged(auth, user => {
  unsubs.forEach(f => f()); unsubs = [];
  if (!user) { V.screen = 'login'; render(); return; }
  V.screen = 'loading'; render();
  const u = onSnapshot(doc(db, 'config', 'main'), async d => {
    u();
    if (!d.exists()) { V.msg = '원장님 계정만 관리자 페이지를 쓸 수 있어요.'; signOut(auth); return; }
    V.staff = null;
    if (d.data().owner !== user.uid) {
      const ph = (user.email || '').split('@')[0];
      try { const sd = await getDoc(doc(db, 'staff', ph)); const x = sd.exists() ? sd.data() : null; if (!x || x.st !== 'ok' || x.uid !== user.uid) throw 0; V.staff = x; }
      catch (e) { V.msg = '원장님·승인된 부원장만 관리자 페이지를 쓸 수 있어요.'; signOut(auth); return; }
    }
    D.cfg = d.data(); V.screen = 'app'; V.msg = ''; subscribe(); render(); setTimeout(() => wifiAutoSync(true), 1500);
    if (!V.staff) announceUpdate(db, auth);
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
function markRead(k) { if (document.visibilityState !== 'visible') return; const l = fthread(k).filter(m => m.f === 'o' && !m.r); if (!l.length) return; const b = writeBatch(db); l.forEach(m => { m.r = true; b.update(doc(db, 'msgs', m.id), { r: true }); }); b.commit().catch(e => console.warn(e)); }
function linkUser(b, m) {
  b.update(doc(db, 'members', m.id), { st: 'ok' });
  b.set(doc(db, 'users', m.uid), { phone: m.phone, sids: arrayUnion(m.sid), rels: { [m.sid]: m.rel }, ths: arrayUnion(...thsOf(m.sid, m.rel)) }, { merge: true });
  if (m.rel !== 'student') { const kid = memberOf(m.sid, 'student'); if (kid) b.update(doc(db, 'members', kid.id), { guardianOk: true }); }
}
function addMember(b, sid, rel, phone, name, grade) {
  const ex = rel !== 'student' && D.members.find(m => m.phone === phone && m.st === 'ok' && m.uid);
  const m = { sid, rel, phone, st: ex ? 'ok' : 'none', name, grade, guardianOk: false };
  if (ex) { m.uid = ex.uid; b.set(doc(db, 'users', ex.uid), { sids: arrayUnion(sid), rels: { [sid]: rel }, ths: arrayUnion(...thsOf(sid, rel)) }, { merge: true }); }
  b.set(doc(collection(db, 'members')), m); return !!ex;
}
async function saveLogFor(sid, b, ovr) {
  const day = curDay();
  const s = stu(sid); const g = id => (document.getElementById(id) || {}).value || '';
  const cm = ovr ? ovr.cm : g('lm_' + sid).trim(), sh = ovr ? ovr.sh : !!(document.getElementById('ls_' + sid) || {}).checked; const items = [];
  if (ovr) items.push({ subj: ACT, course: ACT, unit: ovr.unit, c: null, p: null, w: 100 });
  else { const ks = logKeys(sid); ks.forEach(key => { const subj = g('lj_' + key) || '수학', course = g('lc_' + key), unit = g('lu_' + key), act = subj === ACT, c = act ? null : +g('lpc_' + key), p = act ? null : +g('lpp_' + key), w = ks.length > 1 ? +g('lw_' + key) : 100; items.push({ subj, course, unit, c, p, w }); }); }
  if (items.some(it => !it.unit) && !cm) throw new Error(s.name + ': 단원을 고르지 않았으면 특별 메모에 오늘 한 내용을 꼭 적어 주세요');
  if (items.length > 1 && items.reduce((a, it) => a + it.w, 0) !== 100) throw new Error(s.name + ': 항목 비중 합이 100%가 되게 맞춰 주세요');
  const r = (D.att[day] || {})[sid]; const open = r && r.st !== '결석' && !r.out && day === off(0); const ts = now();
  items.forEach((it, k) => b.set(doc(collection(db, 'logs')), { sid, date: day, subj: it.subj, course: it.course, unit: it.unit, c: it.c, p: it.p, w: it.w, cm: k ? '' : cm, sh, ts: ts + k }));
  const math = items.filter(it => it.subj === '수학').pop(); if (math && s.course !== math.course) b.update(doc(db, 'students', sid), { course: math.course });
  if (r) b.update(doc(db, 'att', day + '_' + sid), { logged: true });
  if (open) b.set(doc(collection(db, 'msgs')), { th: sid + '|student', sid, f: 's', t: '[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.', at: stamp(), ts: now(), r: false });
  // 학부모님께는 수업 중간에 보내지 않고, 하원 알림에 수업 내용을 함께 보내요. 이미 하원한 뒤에 기록을 올린 경우에만 따로 보내요.
  const late = sh && r && r.out && r.st !== '결석' && !(D.cfg && D.cfg.autoNotify === false);
  const sumTxt = late ? '[수업 내용] ' + s.name + ' 학생 ' + fmtD(day) + '\n' + lessonSummary(items.map((it, i) => ({ ...it, sh: true, cm: i ? '' : cm }))) : '';
  if (late) b.set(doc(collection(db, 'msgs')), { th: sid + '|parent', sid, f: 's', t: sumTxt, at: stamp(), ts: now(), r: false });
  pendingPush.push(() => { if (open) push([sid + '|student'], '[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.'); if (late) push([sid + '|parent'], sumTxt); });
  if (V.logN) delete V.logN[sid];
  return s.name + (items.length > 1 ? '(' + items.length + ')' : '');
}
let pendingPush = [];
const flushPush = () => { const l = pendingPush; pendingPush = []; l.forEach(f => f()); };
function parseBulk(txt) {
  const rows = txt.split(/\r?\n/).map(l => l.split(/\t|,/).map(x => x.trim())).filter(r => r.some(x => x));
  if (rows.length && !GRADES.includes(rows[0][1]) && /이름|학생/.test(rows[0][0])) rows.shift();
  const seen = new Set(active().map(s => s.name));
  return rows.map(r => {
    const o = { name: r[0] || '', grade: r[1] || '', student: digits(r[2]), father: digits(r[3]), mother: digits(r[4]), school: (r[5] || '').trim() };
    o.err = !o.name ? '이름 없음' : !GRADES.includes(o.grade) ? '학년은 초4~고3' : [o.student, o.father, o.mother].some(p => p && (p.length < 10 || p.length > 11)) ? '번호 확인' : ![o.student, o.father, o.mother].some(p => p) ? '번호 없음' : seen.has(o.name) ? '이미 있는 이름' : '';
    seen.add(o.name); return o;
  });
}

/* ---------- 이벤트 ---------- */
app.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.dataset.a === 'close' && e.target !== el) return;
  const a = el.dataset.a, id = el.dataset.id, v = el.dataset.v;
  try {
    if (a === 'go') { V.page = v; if (v === 'msg' && V.chat) markRead(V.chat); return render(); }
    if (a === 'pushOn') { try { await enablePush(db, auth.currentUser.uid, ['teacher']); toast('이 PC에서 알림이 켜졌어요'); } catch (e) { toast(pushErrorText(e)); } return render(); }
    if (a === 'pushHide') { V.pushHide = true; return render(); }
    if (a === 'logout') { await signOut(auth); return; }
    if (a === 'wifiReg') { const ip = await myIp(); if (!ip) return toast('인터넷 주소를 확인하지 못했어요. 잠시 후 다시 눌러 주세요'); const l = [...new Set([...((D.cfg && D.cfg.wifiIps) || []), ip])]; await updateDoc(doc(db, 'config', 'main'), { wifiIps: l, wifiAuto: true }); return toast('교습소 인터넷 주소(' + ip + ')를 등록했어요 · 자동 등원 켜짐'); }
    if (a === 'wifiTog') { const on = !(D.cfg && D.cfg.wifiAuto); await updateDoc(doc(db, 'config', 'main'), { wifiAuto: on }); return toast('와이파이 자동 등원 ' + (on ? '켬' : '끔')); }
    if (a === 'wifiClr') { if (!confirm('등록된 교습소 인터넷 주소를 지울까요?')) return; await updateDoc(doc(db, 'config', 'main'), { wifiIps: [], wifiAuto: false }); return toast('지웠어요'); }
    if (a === 'attEdit') { V.attSid = id; V.attDate = v; V.modal = 'att'; return render(); }
    if (a === 'attDel') { if (!confirm('이 날 출결 기록을 삭제할까요?')) return; await deleteDoc(doc(db, 'att', V.attDate + '_' + V.attSid)); V.modal = null; return toast('출결 기록을 삭제했어요'); }
    if (a === 'finYm') { e.preventDefault(); if (V.finDirty) return toast('저장 중이에요. 잠시 후 다시 눌러 주세요'); finOpen(v); return render(); }
    if (a === 'finNew') { const m = finNewMonth(); if (D.fin[m.ym]) return toast(ymLabel(m.ym) + '은(는) 이미 있어요'); V.ym = m.ym; V.finEdit = m; finTouch(); return toast(ymLabel(m.ym) + ' 정산을 만들었어요 (지난달 학생·원비 복사, 식대는 비움)'); }
    if (a === 'finDel') { const m = finCur(); if (!m) return; const r = m.rows[+v]; if (r && (r.name || r.price) && !confirm((r.name || (+v + 1) + '번 줄') + ' 줄을 삭제할까요? (그 학생 식대 표시도 함께 지워져요)')) return; m.rows.splice(+v, 1); if (r && r.name && m.meals) delete m.meals[r.name]; finTouch(); return render(); }
    if (a === 'finDelMonth') { const m = finCur(); if (!m || !confirm(ymLabel(m.ym) + ' 정산을 통째로 삭제할까요? 되돌릴 수 없어요.')) return; clearTimeout(finT); V.finDirty = false; await deleteDoc(doc(db, 'fin', 'm_' + m.ym)); V.ym = null; V.finEdit = null; return toast('삭제했어요'); }
    if (a === 'meal') { const m = finCur(); if (!m) return; const i = v.lastIndexOf('|'); const k = v.slice(0, i), d = +v.slice(i + 1); m.meals = m.meals || {}; const l = m.meals[k] || (m.meals[k] = []); const j = l.indexOf(d); if (j >= 0) l.splice(j, 1); else { l.push(d); l.sort((x, y) => x - y); } finTouch(); return render(); }
    if (a === 'mealAtt') { const m = finCur(); if (!m) return; m.meals = m.meals || {}; let n = 0; const nd = daysIn(m.ym);
      (m.rows || []).forEach(r => { if (!r.name) return; const s = r.sid ? stu(r.sid) : D.students.find(x => x.name === r.name); if (!s) return; for (let d = 1; d <= nd; d++) { const at = (D.att[dateOf(m.ym, d)] || {})[s.id]; if (at && at.st !== '결석') { const l = m.meals[r.name] || (m.meals[r.name] = []); if (!l.includes(d)) { l.push(d); n++; } } } (m.meals[r.name] || []).sort((x, y) => x - y); });
      if (!n) return toast('채울 등원 기록이 없어요'); finTouch(); return toast('등원 기록으로 ' + n + '칸을 채웠어요'); }
    if (a === 'xlGo') { el.disabled = true; try { await xlCommit(); } finally { el.disabled = false; } return; }
    if (a === 'xlOut') { exportXlsx(); return; }
    if (a === 'stOk') { await updateDoc(doc(db, 'staff', id), { st: 'ok' }); return toast('부원장 승인 완료'); }
    if (a === 'stRej') { await updateDoc(doc(db, 'staff', id), { st: 'none', uid: deleteField() }); return toast('거절했어요'); }
    if (a === 'stDel') { const x = D.staff.find(y => y.id === id); if (!x || !confirm((x.name || '') + ' 부원장을 삭제할까요? 그 번호로는 더 이상 관리 기능을 쓸 수 없어요.')) return; await deleteDoc(doc(db, 'staff', id)); return toast('삭제했어요'); }
    if (a === 'stCopy') { const x = D.staff.find(y => y.id === id); try { await navigator.clipboard.writeText(staffInvite(x)); toast('문구를 복사했어요'); } catch (e) { toast('복사하지 못했어요'); } return; }
    if (a === 'schF') { V.schF = v; return render(); }
    if (a === 'exDel') { if (!confirm('이 일정을 삭제할까요?')) return; await deleteDoc(doc(db, 'exams', id)); return toast('일정을 삭제했어요'); }
    if (a === 'msgDel') { if (!confirm('이 메시지를 삭제할까요?\n학생·학부모님 화면에서도 처음부터 없었던 것처럼 사라져요.')) return; await deleteDoc(doc(db, 'msgs', id)); return toast('메시지를 삭제했어요'); }
    if (a === 'noshow') { const s = stu(id); if (!s) return; const ps = D.members.filter(m => m.sid === id && m.rel !== 'student' && m.st === 'ok').map(m => REL[m.rel]); const tx = noshowTxt(s);
      if (!confirm(s.name + ' 학생 부모님께 미등원 안내를 보낼까요?\n\n받는 분: ' + (ps.length ? ps.join('·') : '앱에 가입한 부모님이 아직 없어요 (가입하면 대화에서 볼 수 있어요)') + '\n\n' + tx)) return;
      await msg(id + '|parent', id, 's', tx); push([id + '|parent'], tx, { title: '미등원 안내', tag: 'ns' + id }); return toast(s.name + ' 부모님께 미등원 안내를 보냈어요'); }
    if (a === 'chatDel') { const pr = PREL.includes(V.chat.split('|')[1]); const l = fthread(V.chat).filter(m => m.id && !(pr && /\|parent$/.test(m.th))); if (!l.length || !confirm('이 대화 전체(' + l.length + '개)를 삭제할까요?\n학생·학부모님 화면에서도 모두 사라지고 되돌릴 수 없어요.')) return; for (let i = 0; i < l.length; i += 400) { const b = writeBatch(db); l.slice(i, i + 400).forEach(m => b.delete(doc(db, 'msgs', m.id))); await b.commit(); } V.chat = null; return toast('대화를 삭제했어요'); }
    if (a === 'apCopy') { try { await navigator.clipboard.writeText(joinText()); toast('입학 안내 문구와 신청 링크를 복사했어요 · 카톡이나 문자에 붙여넣으세요'); } catch (e) { toast('복사하지 못했어요. 미리보기의 문구를 직접 복사해 주세요'); } return; }
    if (a === 'apDel') { const x = D.apply.find(y => y.id === id); if (!x || !confirm(x.name + ' 학생 신청서를 삭제할까요?')) return; await deleteDoc(doc(db, 'apply', id)); return toast('신청서를 삭제했어요'); }
    if (a === 'apOk') { const x = D.apply.find(y => y.id === id); if (!x) return; if (D.students.some(s => s.name === x.name) && !confirm('이미 ' + x.name + ' 학생이 있어요. 그래도 새로 등록할까요?')) return;
      const r = await approveApply(x); V.page = 'students'; V.modal = 'invite'; V.inviteSids = [r.sid]; V.invQR = null; render(); return toast(x.name + ' 등록 완료' + (r.auto ? ' · 형제 부모님 계정에 자동 연결' : '') + ' · 설치 안내 문자를 보내 주세요'); }
    if (a === 'showLeft') { V.showLeft = !V.showLeft; return render(); }
    if (a === 'stuV') { V.stuV = v; return render(); }
    if (a === 'schM') { if (+v === 0) V.schM = null; else { const [y, m] = (V.schM || TODAY.slice(0, 7)).split('-').map(Number); const d = new Date(y, m - 1 + +v, 1); V.schM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); } return render(); }
    if (a === 'exK') { V.exK = v; return render(); }
    if (a === 'modal') { V.modal = v; V.editId = id || null; V.bulk = null; return render(); }
    if (a === 'invite') { V.modal = 'invite'; V.inviteSids = [id]; V.invQR = null; return render(); }
    if (a === 'invQR') { V.invQR = V.invQR === id ? null : id; return render(); }
    if (a === 'invKakao') { const m = D.members.find(x => x.id === id); if (m) kakaoInvite(m); return; }
    if (a === 'invCopy') { const m = D.members.find(x => x.id === id); try { await navigator.clipboard.writeText(inviteText(m)); toast('문구를 복사했어요. 카톡·문자에 붙여넣으세요'); } catch (e) { toast('복사하지 못했어요'); } return; }
    if (a === 'close') { V.modal = null; V.editId = null; V.bulk = null; return render(); }
    if (a === 'calM') { let [y, m] = V.calM.split('-').map(Number); m += +v; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } V.calM = y + '-' + pad(m); return render(); }
    if (a === 'open') { const [sd, rr] = v.split('|'); V.chat = rr !== 'student' ? famSids(sd)[0] + '|' + rr : v; markRead(V.chat); return render(); }
    if (a === 'bulkCheck') { V.bulk = parseBulk(document.getElementById('bulkIn').value); return render(); }
    if (a === 'mOk') { const m = D.members.find(x => x.id === id); if (!m || !m.uid) return; const all = D.members.filter(x => x.uid === m.uid && x.st === 'pending'); const b = writeBatch(db); all.forEach(x => linkUser(b, x)); await b.commit(); for (const x of all) if (x.rel !== 'student') await msg(thsOf(x.sid, x.rel).pop(), x.sid, 's', '[가입 승인] ' + mLabel(x) + '으로 연결되었어요. 환영합니다!'); push([...new Set(all.flatMap(x => thsOf(x.sid, x.rel)))], '[가입 승인] 더밀착수학 앱 이용이 승인됐어요. 앱을 열어 주세요.'); return toast(all.map(mLabel).join(', ') + ' 승인 완료'); }
    if (a === 'mRej') { const m = D.members.find(x => x.id === id); const all = D.members.filter(x => x.uid && x.uid === m.uid && x.st === 'pending'); const b = writeBatch(db); all.forEach(x => b.update(doc(db, 'members', x.id), { st: 'none', uid: deleteField() })); await b.commit(); return toast(mLabel(m) + ' 가입을 거절했어요'); }
    if (a === 'mBlock' || a === 'mReset') { const m = D.members.find(x => x.id === id); const b = writeBatch(db); b.update(doc(db, 'members', m.id), a === 'mBlock' ? { st: 'block' } : { st: 'none', uid: deleteField() }); if (m.uid) b.set(doc(db, 'users', m.uid), { sids: arrayRemove(m.sid), ths: arrayRemove(...thsOf(m.sid, m.rel)) }, { merge: true }); await b.commit(); return toast(a === 'mBlock' ? mLabel(m) + ' 접속을 차단했어요' : '재가입 가능 상태예요. Firebase 콘솔 Authentication에서 ' + fmtP(m.phone) + ' 계정을 삭제해 주세요.'); }
    if (a === 'mUnblock') { const m = D.members.find(x => x.id === id); if (!m.uid) return; const b = writeBatch(db); linkUser(b, m); await b.commit(); return toast('차단을 해제했어요'); }
    if (a === 'leave') {
      const s = stu(id); if (V.confirmLeave !== id) { V.confirmLeave = id; el.textContent = '한 번 더 누르면 퇴원 처리'; setTimeout(() => { V.confirmLeave = null; }, 4000); return; }
      const b = writeBatch(db); b.update(doc(db, 'students', id), { left: true, leftAt: TODAY });
      D.members.filter(m => m.sid === id && m.st !== 'none' && m.st !== 'block').forEach(m => { b.update(doc(db, 'members', m.id), { st: 'block' }); if (m.uid) b.set(doc(db, 'users', m.uid), { sids: arrayRemove(id), ths: arrayRemove(...thsOf(id, m.rel)) }, { merge: true }); });
      await b.commit(); V.modal = null; V.editId = null; V.confirmLeave = null; return toast(s.name + ' 퇴원 처리했어요. 가족 계정의 이 학생 연결도 끊었어요.');
    }
    if (a === 'rejoin') { await updateDoc(doc(db, 'students', id), { left: false }); return toast('복귀 처리했어요. 가족 연결은 학생 관리에서 차단 해제해 주세요.'); }
    if (a === 'exAdd' || a === 'exDel') { const day = V.dashD || dashDefault(); const sid = a === 'exAdd' ? (document.getElementById('exSel') || {}).value : id; if (!sid) return toast('보충 올 학생을 골라 주세요'); await setDoc(doc(db, 'extra', day), { date: day, sids: a === 'exAdd' ? arrayUnion(sid) : arrayRemove(sid) }, { merge: true }); return toast((stu(sid) || {}).name + (a === 'exAdd' ? ' 보충 추가 (' + fmtD(day) + ')' : ' 보충 취소')); }
    if (a === 'dashM') { const d = new Date((V.dashD || dashDefault()) + 'T00:00'); d.setDate(d.getDate() + +v); V.dashD = ds(d) === dashDefault() ? null : ds(d); V.calM = curDay().slice(0, 7); return render(); }
    if (a === 'dashT') { V.dashD = null; V.calM = curDay().slice(0, 7); return render(); }
    if (a === 'logAll') { V.logAll = !V.logAll; return render(); }
    if (a === 'absOk') { const x = D.abs.find(y => y.id === id); if (!x) return; const s = stu(x.sid) || { name: '' }; await updateDoc(doc(db, 'abs', id), { ok: true, okBy: TNAME() }); const tx = '[결석 확인] ' + s.name + ' 학생 ' + fmtD(x.date) + ' 결석 통보를 확인했어요.'; push([x.sid + '|parent'], tx, { tag: 'abs' }); await msg(x.sid + '|parent', x.sid, 's', tx).catch(() => { }); return toast(s.name + ' 결석 확인 · 학부모님께 알렸어요'); }
    if (a === 'ok' || a === 'rej') {
      const q = D.req.find(x => x.id === id); if (!q) return; const s = stu(q.sid);
      if (a === 'rej') { await updateDoc(doc(db, 'reqs', q.id), { st: 'rej' }); await msg(q.sid + '|student', q.sid, 's', '[등원 요청 반려] 선생님께 직접 말씀드려 주세요.'); push([q.sid + '|student'], '[등원 요청 반려] 선생님께 직접 말씀드려 주세요.'); return toast(s.name + ' 등원 요청을 거절했어요'); }
      const st = '출석'; const b = writeBatch(db);
      b.update(doc(db, 'reqs', q.id), { st: 'ok' });
      b.set(doc(db, 'att', TODAY + '_' + q.sid), { sid: q.sid, date: TODAY, st, at: q.at, by: 'app', logged: D.logs.some(l => l.sid === q.sid && l.date === TODAY) });
      await b.commit();
      await notifyParent(q.sid, '[등원 알림] ' + s.name + ' 학생이 ' + q.at + '에 등원했습니다.');
      return toast(s.name + ' ' + st + ' 승인');
    }
    if (a === 'cellAbs') {
      const r = (D.att[v] || {})[id]; const s = stu(id);
      if (r && r.st === '결석') { await deleteDoc(doc(db, 'att', v + '_' + id)); return toast(s.name + ' ' + fmtD(v) + ' 결석 취소'); }
      await setDoc(doc(db, 'att', v + '_' + id), { sid: id, date: v, st: '결석', at: '', by: 'teacher' });
      if (v === TODAY) await notifyParent(id, '[출결 알림] ' + s.name + ' 학생이 오늘 결석으로 처리되었습니다.');
      return toast(s.name + ' ' + fmtD(v) + ' 결석 처리');
    }
    if (a === 'logAdd' || a === 'logDelRow') document.querySelectorAll('select.lw').forEach(x => { if (realSid(x.dataset.sid) === id) x.remove(); });
    if (a === 'logAdd') { V.logN = V.logN || {}; V.logN[id] = ((V.logN[id]) || 1) + 1; const ck = document.getElementById('lk_' + id); if (ck) ck.checked = true; return render(); }
    if (a === 'logDelRow') { V.logN = V.logN || {}; V.logN[id] = Math.max(1, ((V.logN[id]) || 1) - 1); return render(); }
    if (a === 'saveLog') { const b = writeBatch(db); pendingPush = []; const n = await saveLogFor(id, b); await b.commit(); flushPush(); return toast(n + ' 수업 기록 저장'); }
    if (a === 'actSave') {
      const ids = [...document.querySelectorAll('input[name=actS]:checked')].map(x => x.value); const unit = (document.getElementById('actU') || {}).value === '__x' ? (document.getElementById('actX').value || '').trim() : (document.getElementById('actU') || {}).value;
      if (!unit) return toast('활동 이름을 적어 주세요'); if (!ids.length) return toast('학생을 골라 주세요');
      const cm = (document.getElementById('actM').value || '').trim(), sh = document.getElementById('actSh').checked;
      const b = writeBatch(db); const names = []; pendingPush = []; for (const sid of ids) names.push(await saveLogFor(sid, b, { unit, cm, sh })); await b.commit(); flushPush(); V.modal = null;
      return toast(names.length + '명 특별활동(' + unit + ') 기록 저장: ' + names.join(', '));
    }
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
    if (a === 'delN' && !isOwnerMe()) return toast('공지는 원장님만 삭제할 수 있어요');
    if (a === 'delN') { await deleteDoc(doc(db, 'notices', id)); return toast('공지를 삭제했어요'); }
  } catch (err) { fail(err, err.message && !err.code ? err.message : undefined); }
});

app.addEventListener('change', async e => {
  if (e.target.id === 'newChat' && e.target.value) { V.chat = e.target.value; return render(); }
  if (e.target.id === 'dashD') { V.dashD = e.target.value && e.target.value !== dashDefault() ? e.target.value : null; V.calM = curDay().slice(0, 7); return render(); }
  if (e.target.id === 'wifiPc') { try { localStorage.setItem('tmm-academy-pc', e.target.checked ? '1' : '0'); } catch (x) { } if (e.target.checked) { await wifiAutoSync(true); toast('이 PC를 교습소 PC로 지정했어요'); } else toast('교습소 PC 지정을 해제했어요'); return render(); }
  if (e.target.id === 'xlIn' && e.target.files && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; return importXlsx(f); }
  if (e.target.dataset && e.target.dataset.fi !== undefined) { finField(e.target); return render(); }
  if (e.target.id === 'schAllCk') { document.querySelectorAll('input[name=schCk]').forEach(x => x.checked = e.target.checked); return; }
  const t = e.target;
  try {
    if (t.id === 'autoN') { await updateDoc(doc(db, 'config', 'main'), { autoNotify: t.checked }); return toast(t.checked ? '자동 알림 켬' : '자동 알림 끔'); }
    if (t.id === 'hwFilter') { V.hwF = t.value; return render(); }
    if (t.classList.contains('lw')) {
      const key = t.dataset.sid, sid = realSid(key); const ks = logKeys(sid); const i = ks.indexOf(key); const tgt = i === ks.length - 1 ? 0 : ks.length - 1;
      const others = ks.reduce((a, k2, j) => j === i || j === tgt ? a : a + (+(document.getElementById('lw_' + k2) || {}).value || 0), 0); const rest = 100 - (+t.value) - others;
      if (rest < 10) { toast('비중 합이 100%를 넘어요. 다른 줄 비중을 먼저 줄여 주세요'); } else { const el = document.getElementById('lw_' + ks[tgt]); if (el) el.value = String(rest); }
      const ck = document.getElementById('lk_' + sid); if (ck) ck.checked = true; return;
    }
    if (t.classList.contains('lj')) {
      const sid = t.dataset.sid; const d = defaultsFor(stu(realSid(sid)), t.value); const lc = document.getElementById('lc_' + sid);
      lc.innerHTML = courseOpts(t.value, d.course); lc.value = d.course; ['lpc_', 'lpp_'].forEach(x => { const e2 = document.getElementById(x + t.dataset.sid); if (e2) e2.disabled = t.value === ACT; }); lc.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if (t.classList.contains('lc')) {
      const sid = t.dataset.sid, rs = realSid(sid); const us = unitsOf(rs, t.value); const sel = document.getElementById('lu_' + sid);
      sel.innerHTML = us.map(u => opt(u, '', u)).join('') + opt('', null, '단원 없이 (메모 필수)'); const lt = sortLogs(D.logs.filter(l => l.sid === rs && l.course === t.value && l.unit)).pop(); const nx = lt ? lt.unit : us[0]; if (nx) sel.value = nx;
      const ck = document.getElementById('lk_' + rs); if (ck) ck.checked = true; return;
    }
    if (t.classList.contains('lu')) { const sid = realSid(t.dataset.sid); const ck = document.getElementById('lk_' + sid); if (ck) ck.checked = true; return; }
    if (/^l(pc|pp)_/.test(t.id)) { const sid = t.id.split('_')[1]; const other = document.getElementById((t.id.startsWith('lpc') ? 'lpp_' : 'lpc_') + sid); if (other) other.value = String(100 - +t.value); }
    if (/^l(pc|pp|m)_/.test(t.id)) { const ck = document.getElementById('lk_' + realSid(t.id.split('_')[1])); if (ck) ck.checked = true; }
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
      await b.commit(); push(ids.map(x => x + '|student'), '[새 숙제] ' + title + ' · 마감 ' + fmtD(due)); ids.forEach(x => push([x + '|parent'], '[새 숙제] ' + ((stu(x) || {}).name || '') + ' · ' + title + ' · 마감 ' + fmtD(due))); ['hwT', 'hwR'].forEach(i => document.getElementById(i).value = ''); document.querySelectorAll('input[name=hwS]').forEach(x => x.checked = false);
      return toast(ids.length + '명에게 숙제를 냈어요');
    }
    if (f === 'ntF' && !isOwnerMe()) return toast('공지는 원장님만 쓸 수 있어요');
    if (f === 'ntF') { if (!g('nT').trim()) return toast('제목을 입력해 주세요'); await addDoc(collection(db, 'notices'), { title: g('nT').trim(), body: g('nB').trim(), at: TODAY, pin: document.getElementById('nP').checked, reads: [], ts: now() }); push(active().flatMap(x => [x.id + '|student', x.id + '|parent']), g('nT').trim(), { title: '새 공지', tag: 'notice' }); document.getElementById('nT').value = ''; document.getElementById('nB').value = ''; return toast('공지를 올렸어요'); }
    if (f === 'attF') {
      const sid = V.attSid, d = V.attDate, isAbs = g('atSt') === 'abs', at = g('atIn'), out = g('atOut');
      if (!isAbs && !at) return toast('등원 시각을 넣어 주세요'); if (!isAbs && out && tMin(out) < tMin(at)) return toast('하원 시각이 등원보다 빨라요 (새벽 3시 전까지는 다음 날 새벽으로 봐요)');
      const rec = isAbs ? { sid, date: d, st: '결석', at: '', by: 'admin' } : { sid, date: d, st: '출석', at, by: 'admin', logged: D.logs.some(l => l.sid === sid && l.date === d) };
      if (!isAbs && out) rec.out = out;
      await setDoc(doc(db, 'att', d + '_' + sid), rec);
      const q = D.req.find(x => x.sid === sid && x.st === 'pending' && x.date === d); if (q && !isAbs) await updateDoc(doc(db, 'reqs', q.id), { st: 'ok' });
      const noti = !!(document.getElementById('atNoti') || {}).checked; const nm = (stu(sid) || {}).name || '';
      if (noti) { const t = isAbs ? '[출결 알림] ' + nm + ' 학생이 ' + fmtD(d) + ' 결석으로 처리되었습니다.' : '[등·하원 알림] ' + nm + ' 학생 ' + fmtD(d) + ' 등원 ' + at + (out ? ' · 하원 ' + out : '') + (out ? (sm => sm ? '\n' + sm : '')(lessonSummary(D.logs.filter(l => l.sid === sid && l.date === d && l.sh))) : ''); push([sid + '|parent'], t); await msg(sid + '|parent', sid, 's', t).catch(e => console.warn(e)); }
      V.modal = null; return toast(nm + ' ' + fmtD(d) + ' 출결을 저장했어요' + (noti ? ' · 학부모 알림 발송' : ''));
    }
    if (f === 'finSetF') { const meal = +digits(g('fsMeal')), cap1 = +digits(g('fsCap1')), cap2 = +digits(g('fsCap2')); if (!meal || !cap1) return toast('숫자를 확인해 주세요'); await setDoc(doc(db, 'fin', 'settings'), { meal, cap1, cap2: cap2 || 0 }); return toast('설정을 저장했어요'); }
    if (f === 'rosterF') {
      const b = writeBatch(db); let n = 0, auto = false;
      for (const s of D.students) { const P = 'rs_' + s.id + '_'; const el = id => document.getElementById(P + id); if (!el('birth')) continue; const si = D.sinfo[s.id] || {};
        const phones = { ...(si.phones || {}) }; let pch = false;
        for (const rel of ['student', 'mother', 'father']) { const inp = el('p_' + rel); if (!inp) continue; const p = digits(inp.value);
          if (p && (p.length < 10 || p.length > 11)) return toast(s.name + ' ' + REL[rel] + ' 휴대폰번호를 확인해 주세요');
          if (p === digits(phoneOf(s, rel))) continue;
          const m = memberOf(s.id, rel);
          if (!s.left) { if (m && !p) b.delete(doc(db, 'members', m.id)); else if (m) b.update(doc(db, 'members', m.id), { phone: p }); else if (p) auto = addMember(b, s.id, rel, p, s.name, s.grade) || auto; }
          if (p) phones[rel] = p; else delete phones[rel]; pch = true; n++; }
        if (pch) b.set(doc(db, 'sinfo', s.id), { phones }, { mergeFields: ['phones'] });
        const birth = el('birth').value, joined = el('joined').value, memo = el('memo').value.trim(), school = el('school').value.trim(), grade = el('grade').value, left = el('st').value === '퇴원';
        if ((si.birth || '') !== birth || (si.joined || '') !== joined || (si.memo || '') !== memo) { b.set(doc(db, 'sinfo', s.id), { birth, joined, memo, kind: kindOf(grade) }, { merge: true }); n++; }
        if ((s.school || '') !== school || s.grade !== grade || !!s.left !== left) { b.update(doc(db, 'students', s.id), { school, grade, left }); n++; } }
      if (!n) return toast('바뀐 내용이 없어요'); await b.commit(); return toast('학생명부를 저장했어요' + (auto ? ' · 형제 부모님 계정에 자동 연결' : ''));
    }
    if (f === 'schF') {
      const b = writeBatch(db); let n = 0;
      document.querySelectorAll('input[data-sid]').forEach(el => { const s = stu(el.dataset.sid); const v = el.value.trim(); if (s && (s.school || '') !== v) { b.update(doc(db, 'students', s.id), { school: v }); n++; } });
      if (!n) return toast('바뀐 내용이 없어요'); await b.commit(); return toast(n + '명 학교를 저장했어요');
    }
    if (f === 'schBulkF') {
      const v = g('schBulk').trim(); const ids = [...document.querySelectorAll('input[name=schCk]:checked')].map(x => x.value);
      if (!v) return toast('학교 이름을 입력해 주세요'); if (!ids.length) return toast('아래 표에서 학생을 선택해 주세요');
      ids.forEach(id => { const el = document.getElementById('sc_' + id); if (el) el.value = v; const ck = document.querySelector('input[name=schCk][value="' + id + '"]'); if (ck) ck.checked = false; }); const b = writeBatch(db); ids.forEach(id => b.update(doc(db, 'students', id), { school: v })); await b.commit();
      document.getElementById('schBulk').value = ''; return toast(ids.length + '명을 ' + v + '(으)로 저장했어요');
    }
    if (f === 'examF') {
      const kind = V.exK || 'exam', school = kind === 'off' ? '' : g('exS').trim(), title = g('exT').trim(), start = g('exA'), end = g('exB') || g('exA'), memo = g('exM').trim();
      if ((kind === 'exam' && !school) || !title || !start) return toast(kind === 'exam' ? '학교·시험·시작일을 입력해 주세요' : '일정 이름·시작일을 입력해 주세요');
      if (end < start) return toast('끝나는 날이 시작일보다 빨라요');
      await addDoc(collection(db, 'exams'), { kind, school, title, start, end, memo, ts: now() });
      const kids = school ? active().filter(x => (x.school || '').trim() === school) : active();
      const body = (school ? school + ' ' : '') + title + ' · ' + fmtD(start) + (end !== start ? ' ~ ' + fmtD(end) : '') + (memo ? ' · ' + memo : '');
      if (kids.length) push(kids.flatMap(x => [x.id + '|student', x.id + '|parent']), body, { title: kind === 'exam' ? '시험 일정 등록' : kind === 'off' ? '교습소 휴무 안내' : '일정 안내', tag: 'exam' });
      ['exS', 'exT', 'exA', 'exB', 'exM'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
      return toast(title + ' 등록' + (kids.length ? ' · ' + kids.length + '명 가족에게 알림' : ' (이 학교 학생이 아직 없어요)'));
    }
    if (f === 'staffF') {
      const name = g('sfN').trim(), ph = digits(g('sfP'));
      if (!name) return toast('이름을 입력해 주세요'); if (ph.length < 10 || ph.length > 11) return toast('휴대폰번호를 확인해 주세요');
      if (D.cfg && ph === D.cfg.phone) return toast('원장님 번호예요'); if (D.staff.some(x => x.id === ph)) return toast('이미 등록된 번호예요');
      await setDoc(doc(db, 'staff', ph), { name, phone: ph, st: 'none', ts: now() }); ['sfN', 'sfP'].forEach(i => document.getElementById(i).value = '');
      return toast(name + ' 부원장 등록 · [문자 앱 열기]로 가입 안내를 보내세요');
    }
    if (f === 'stuF') {
      const name = g('sN').trim(); if (!name) return toast('이름을 입력해 주세요');
      const grade = g('sG'); const ph = { student: digits(g('p_student')), father: digits(g('p_father')), mother: digits(g('p_mother')) };
      if (Object.values(ph).some(x => x && (x.length < 10 || x.length > 11))) return toast('휴대폰번호를 확인해 주세요');
      const b = writeBatch(db); let auto = false; let newSid = null;
      if (V.editId) {
        const sid = V.editId; b.update(doc(db, 'students', sid), { name, grade, school: g('sSc').trim(), course: g('sC') || stu(sid).course });
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
        const ref = doc(collection(db, 'students')); newSid = ref.id; b.set(ref, { name, grade, school: g('sSc').trim(), course: DEF_COURSE[grade], ts: now() });
        Object.entries(ph).forEach(([rel, p]) => { if (p) auto = addMember(b, ref.id, rel, p, name, grade) || auto; });
      }
      await b.commit(); V.modal = null; const ed = V.editId; V.editId = null;
      if (!ed && newSid) { V.modal = 'invite'; V.inviteSids = [newSid]; V.invQR = null; }
      return toast(name + (ed ? ' 정보를 저장했어요' : ' 등록 완료') + (auto ? ' · 형제 부모님 계정에 자동 연결' : ''));
    }
    if (f === 'bulkF') {
      const ok = (V.bulk || []).filter(r => !r.err); if (!ok.length) return;
      const b = writeBatch(db);
      const sids = []; ok.forEach(r => { const ref = doc(collection(db, 'students')); sids.push(ref.id); b.set(ref, { name: r.name, grade: r.grade, school: r.school || '', course: DEF_COURSE[r.grade], ts: now() }); ['student', 'father', 'mother'].forEach(rel => { if (r[rel]) addMember(b, ref.id, rel, r[rel], r.name, r.grade); }); });
      await b.commit(); V.bulk = null; V.modal = 'invite'; V.inviteSids = sids; V.invQR = null; return toast(ok.length + '명 등록 완료 · 가입 안내 문자를 보내 주세요');
    }
  } catch (err) { fail(err); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && V.modal) { V.modal = null; V.editId = null; render(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && off(0) !== TODAY) return location.reload(); if (document.visibilityState === 'visible' && V.chat && V.page === 'msg') markRead(V.chat); if (document.visibilityState === 'visible') wifiAutoSync(false); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { });
render();

function finField(t) {
  const m = finCur(); if (!m) return; const r = m.rows[+t.dataset.fi]; if (!r) return; const k = t.dataset.k;
  if (k === 'd') { r.d = r.d || [0, 0, 0, 0, 0, 0]; r.d[+t.dataset.day] = t.checked ? 1 : 0; }
  else if (k === 'price' || k === 'disc') r[k] = numOr(digits(t.value) === '' ? '' : digits(t.value));
  else if (k === 'name') { const nv = t.value.trim(); if (nv !== r.name) { if (r.name && m.meals && m.meals[r.name]) { if (nv) m.meals[nv] = m.meals[r.name]; delete m.meals[r.name]; } r.name = nv; const s = D.students.find(x => x.name === nv); if (s) r.sid = s.id; else delete r.sid; } }
  else r[k] = t.value;
  finTouch();
}
app.addEventListener('input', e => { const t = e.target; if (isTelInput(t)) { const v = hyP(t.value); if (v !== t.value) t.value = v; return; } if (t.dataset && t.dataset.fi !== undefined && t.type !== 'checkbox' && t.dataset.k !== 'name') { const m = finCur(); const r = m && m.rows[+t.dataset.fi]; if (r) { r[t.dataset.k] = (t.dataset.k === 'price' || t.dataset.k === 'disc') ? numOr(digits(t.value)) : t.value; V.finDirty = true; } } });
