// 상담 서류 작성 화면 (교습소 태블릿 또는 학부모님 폰) — consult.html?t=<상담 링크 코드>&w=hub|parent|student|apply
// 로그인 없이, 원장님이 만든 상담 링크(추측할 수 없는 긴 코드)로만 열려요. 상담이 끝나 링크를 닫으면 더는 열리지 않아요.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { PARENT, STUDENT, CLASSES, RULES, CONSENT, DAYS5, priceOf, isHigh, progress } from './forms.js';

const db = getFirestore(initializeApp(firebaseConfig));
const P = new URLSearchParams(location.search); const TOK = P.get('t') || '';
const S = { w: P.get('w') || 'hub', f: null, a: {}, page: 0, err: '', busy: false };
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = s => String(s || '').replace(/\D/g, '');
const fmtP = d => { d = digits(d); return d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : d; };
const won = n => (+n || 0).toLocaleString('ko-KR');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const DEF = { parent: PARENT, student: STUDENT };
const TITLE = { parent: '학부모 사전 진단 설문', student: '학생 설문', apply: '입학신청서' };
const narrow = () => window.innerWidth < 700;

function top(sub, pct) {
  return '<div class="top"><div class="in"><img src="./icon-192.png?v=2" alt=""><div><b>더(The)밀착수학교습소</b><small>' + esc(sub || '무료 정밀진단 · 1:1 상담') + '</small></div>' + (pct != null ? '<span class="pg">' + Math.round(pct) + '%</span>' : '') + '</div>' + (pct != null ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
}
function go(w) { S.w = w; S.page = 0; S.err = ''; S.a = JSON.parse(JSON.stringify((S.f || {})[w] || {})); if (w === 'apply') prefillApply(); const u = new URL(location.href); u.searchParams.set('w', w); history.replaceState(null, '', u); render(); scrollTo(0, 0); }

/* ---------- 첫 화면 (교습소 태블릿) ---------- */
function hub() {
  const f = S.f; const pP = progress(PARENT, f.parent), pS = progress(STUDENT, f.student);
  const card = (w, n, title, desc, done, off) => '<button class="step' + (done ? ' done' : '') + (off ? ' off' : '') + '"' + (off ? '' : ' data-go="' + w + '"') + '><span class="n">STEP ' + n + '</span><b>' + title + '</b><span>' + desc + '</span>' + (done ? '<span class="st">✓ 작성 완료</span>' : off ? '' : '<span class="st">작성하기 ›</span>') + '</button>';
  return top() + '<main><h1>' + esc(f.name || '') + ' 학생 · 학부모님,<br>환영합니다 😊</h1><p class="lead">오늘은 아래 순서로 진행해요. 진단 테스트(약 1시간) 동안 어머님은 설문을 작성해 주세요.</p>' +
    '<div class="steps">' +
    card('student', 1, '학생 설문', '5분 · 시험이 아니에요, 솔직하게!', f.student) +
    card('parent', 2, '학부모 사전 진단 설문', '10분 · 아이의 진도·성향·목표', f.parent) +
    card('', 3, '진단 테스트', '학생 · 약 1시간 · 원장님과 함께', false, true) +
    card('', 4, '1:1 결과 브리핑', '풀이 과정·취약 영역 분석과 맞춤 처방', false, true) +
    card('apply', 5, '입학신청서', '브리핑 후 · 설문 내용이 미리 채워져 있어요', f.apply) +
    '</div><p class="mut center" style="margin-top:22px">작성하신 내용은 상담과 수업 설계에만 쓰여요 · <a href="./privacy.html" target="_blank">개인정보 처리방침</a></p></main>';
}

/* ---------- 설문 (한 화면에: 폰은 한 문항, 태블릿은 한 영역) ---------- */
function pagesOf(def) {
  const vis = i => !i.when || S.a[i.when[0]] === i.when[1];
  if (!narrow()) return def.map(s => ({ sec: s.sec, items: s.items.filter(vis) }));
  return def.flatMap(s => s.items.filter(vis).map(i => ({ sec: s.sec, items: [i] })));
}
function itemHtml(i) {
  const v = S.a[i.k]; const sub = i.sub ? '<span class="sub">' + esc(i.sub) + '</span>' : i.opt ? '<span class="sub">(선택)</span>' : '';
  let h = '<div class="q"><span class="ql">' + esc(i.q) + sub + '</span>';
  if (i.t === 'r' || i.t === 'm') {
    h += '<div class="opts">' + i.o.map(o => { const on = i.t === 'r' ? v === o : (v || []).includes(o); return '<button type="button" class="opt' + (i.t === 'm' ? ' m' : '') + (on ? ' on' : '') + '" data-k="' + i.k + '" data-v="' + esc(o) + '" data-t="' + i.t + '"' + (i.max ? ' data-max="' + i.max + '"' : '') + '>' + esc(o) + '</button>'; }).join('') + '</div>';
    if (i.etc && (v || []).includes(i.etc)) h += '<input type="text" data-in="' + i.k + 'Etc" value="' + esc(S.a[i.k + 'Etc'] || '') + '" placeholder="기타 내용을 적어 주세요" style="margin-top:8px">';
  } else if (i.t === 'a') h += '<textarea data-in="' + i.k + '" placeholder="' + esc(i.ph || '') + '">' + esc(v || '') + '</textarea>';
  else h += '<input type="text" data-in="' + i.k + '" value="' + esc(v || '') + '" placeholder="' + esc(i.ph || '') + '">';
  return h + '</div>';
}
function survey(w) {
  const pages = pagesOf(DEF[w]); if (S.page >= pages.length) S.page = pages.length - 1;
  const pg = pages[S.page]; const pct = (S.page / pages.length) * 100;
  return top(TITLE[w], pct) + '<main>' + (S.page === 0 ? '<h1>' + TITLE[w] + '</h1><p class="lead">' + (w === 'student' ? '시험이 아니에요! 정답이 없으니 솔직하게 골라 주세요.' : '아시는 만큼만 적어 주세요. 모르는 항목은 비워 두셔도 돼요. 테스트 후 1:1 브리핑과 맞춤 처방에 그대로 반영해요.') + '</p>' : '') +
    '<div class="card"><h2>' + esc(pg.sec) + (narrow() ? '' : '') + '</h2>' + pg.items.map(itemHtml).join('') + (S.err ? '<p class="err">' + esc(S.err) + '</p>' : '') + '</div></main>' +
    '<div class="foot"><div class="in">' + (S.page > 0 ? '<button class="btn ghost" data-act="prev">‹ 이전</button>' : '<button class="btn ghost" data-act="hub">처음으로</button>') + '<button class="btn grow" data-act="next"' + (S.busy ? ' disabled' : '') + '>' + (S.page === pages.length - 1 ? '제출하기' : '다음 ›') + '</button></div></div>';
}
function missing(items) { const m = items.find(i => !i.opt && !i.when && !(Array.isArray(S.a[i.k]) ? S.a[i.k].length : S.a[i.k])); return m ? m.q.replace(/^[①-⑦★Q\d. ]+/, '') + ' 항목을 골라 주세요' : ''; }

/* ---------- 입학신청서 ---------- */
function prefillApply() {
  const f = S.f, p = f.parent || {}, a = S.a;
  const set = (k, v) => { if (a[k] == null || a[k] === '') a[k] = v; };
  set('name', f.name); set('school', f.school); set('grade', f.grade); set('pStudent', fmtP(f.pStudent));
  const rel = p.writer === '아버님' ? '부' : p.writer === '기타' ? '기타' : (f.pMother ? '모' : f.pFather ? '부' : '모');
  set('gRel', rel); set('gPhone', fmtP(rel === '부' ? f.pFather || f.pMother : f.pMother || f.pFather));
  const c = { 'A반 (주 2회)': 'A', 'B반 (주 3회)': 'B', 'C반 (주 4회)': 'C', '초등 고학년반': 'E' }[p.cls]; if (c) set('cls', c);
  if (!a.days && p.days) a.days = p.days.slice();
  set('cur', p.cur); set('score', p.score); set('src', { '네이버 예약': '온라인', '블로그·검색': '온라인', '지인 소개': '지인', '전단·현수막': '간판' }[f.src] || '');
  set('date', today());
}
function applyForm() {
  const a = S.a; const g = a.grade || ''; const radio = (k, opts) => '<div class="opts sm">' + opts.map(o => '<button type="button" class="opt' + (a[k] === o ? ' on' : '') + '" data-k="' + k + '" data-v="' + esc(o) + '" data-t="r">' + esc(o) + '</button>').join('') + '</div>';
  const inp = (k, ph, type) => '<input type="' + (type || 'text') + '" data-in="' + k + '" value="' + esc(a[k] || '') + '" placeholder="' + esc(ph || '') + '"' + (type === 'tel' ? ' inputmode="numeric"' : '') + '>';
  const grades = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
  return top('입학신청서') + '<main><h1>입학신청서</h1><p class="lead">설문에 적어 주신 내용을 미리 채워 두었어요. 확인하고 비어 있는 곳만 적어 주세요.</p>' +
    '<div class="card"><h2>01 학생 · 보호자 정보</h2>' +
    '<div class="row2"><div class="q"><span class="ql">학생 성명</span>' + inp('name') + '</div><div class="q"><span class="ql">생년월일</span>' + inp('birth', '', 'date') + '</div></div>' +
    '<div class="row2"><div class="q"><span class="ql">학교</span>' + inp('school', '예: 치동중') + '</div><div class="q"><span class="ql">학년</span><select data-in="grade">' + grades.map(x => '<option' + (x === g ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div></div>' +
    '<div class="row2"><div class="q"><span class="ql">학생 연락처 <span class="sub">(선택)</span></span>' + inp('pStudent', '010-0000-0000', 'tel') + '</div><div class="q"><span class="ql">입학 희망일</span>' + inp('start', '', 'date') + '</div></div>' +
    '<div class="row2"><div class="q"><span class="ql">보호자 성명</span>' + inp('gName', '예: 홍길순') + '</div><div class="q"><span class="ql">관계</span>' + radio('gRel', ['모', '부', '기타']) + '</div></div>' +
    '<div class="q"><span class="ql">보호자 연락처</span>' + inp('gPhone', '010-0000-0000', 'tel') + '</div>' +
    '<div class="q"><span class="ql">주소</span>' + inp('addr', '예: 동탄구 영천동 ○○아파트') + '</div>' +
    '<div class="row2"><div class="q"><span class="ql">귀가 방법</span>' + radio('back', ['보호자 픽업', '도보', '대중교통']) + '</div><div class="q"><span class="ql">등록 경로</span>' + radio('src', ['지인', '온라인', '간판', '기타']) + '</div></div></div>' +
    '<div class="card"><h2>02 수강 과정 <span class="sub" style="font-weight:400;color:var(--mut);font-size:14px">4주 기준 교습비 · ' + (isHigh(g) ? '고등부' : '중등부') + '</span></h2><div class="cls">' +
    CLASSES.map(c => '<button type="button" class="opt' + (a.cls === c.k ? ' on' : '') + '" data-k="cls" data-v="' + c.k + '" data-t="r"><b>' + c.label + '</b>' + (c.hours ? '<small>' + c.hours + '시간 (일 4시간)</small><span class="p">' + won(priceOf(c.k, g)) + '원</span>' : '<small>원비는 상담 후 안내</small>') + '</button>').join('') + '</div>' +
    '<div class="q" style="margin-top:16px"><span class="ql">희망 요일</span><div class="opts" style="grid-template-columns:repeat(5,1fr)">' + DAYS5.map(d => '<button type="button" class="opt m' + ((a.days || []).includes(d) ? ' on' : '') + '" data-k="days" data-v="' + d + '" data-t="m">' + d + '</button>').join('') + '</div></div>' +
    '<div class="q"><span class="ql">등원 가능 시각</span>' + inp('at', '', 'time') + '</div>' +
    '<p class="mut" style="margin:0">※ 4주 단위 선납 · 교재비 별도 · 보충 추가 비용 없음 · 교습 시간: 하교 직후 ~ 밤 10시</p></div>' +
    '<div class="card"><h2>03 상담 기초 조사</h2><div class="q"><span class="ql">최근 성적 <span class="sub">(선택)</span></span>' + inp('score', '예: 내신 80점(3등급) / 모의고사 3등급') + '</div><div class="q"><span class="ql">현재 진도 · 교재 <span class="sub">(선택)</span></span>' + inp('cur') + '</div><div class="q"><span class="ql">전달 사항 <span class="sub">(선택)</span></span><textarea data-in="note" placeholder="학습 성향, 다른 학원 시간표 등">' + esc(a.note || '') + '</textarea></div></div>' +
    '<div class="card"><h2>04 운영 원칙 안내 및 개인정보 동의</h2>' + RULES.map((r, i) => '<p class="rule"><b>' + (i + 1) + '. ' + r[0] + '</b><span>' + r[1] + '</span></p>').join('') +
    '<p class="rule"><b>4. 개인정보</b><span class="mut">' + esc(CONSENT) + ' <a href="./privacy.html" target="_blank">처리방침 전문</a></span></p>' + radio('agree', ['동의합니다', '동의하지 않습니다']) +
    '<div class="row2" style="margin-top:16px"><div class="q"><span class="ql">보호자 서명</span><div class="sigw"><canvas class="sig" id="sigP"></canvas><span class="ph">여기에 손가락으로 서명</span><button type="button" class="clr" data-clr="sigP">지우기</button></div></div><div class="q"><span class="ql">학생 서명</span><div class="sigw"><canvas class="sig" id="sigS"></canvas><span class="ph">여기에 손가락으로 서명</span><button type="button" class="clr" data-clr="sigS">지우기</button></div></div></div>' +
    '<p class="mut">위 운영 원칙을 확인하고 입학을 신청합니다. · 신청일 ' + esc(a.date || today()) + '</p>' + (S.err ? '<p class="err">' + esc(S.err) + '</p>' : '') + '</div></main>' +
    '<div class="foot"><div class="in"><button class="btn ghost" data-act="hub">처음으로</button><button class="btn grow" data-act="applyGo"' + (S.busy ? ' disabled' : '') + '>입학 신청하기</button></div></div>';
}
const sigs = {};
function setupSig(id) {
  const c = document.getElementById(id); if (!c) return; const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = r.width * dpr; c.height = r.height * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr); x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#11152b';
  const st = sigs[id] = sigs[id] || { strokes: [] }; st.c = c;
  const redraw = () => { x.clearRect(0, 0, r.width, r.height); st.strokes.forEach(s => { x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }); c.parentNode.querySelector('.ph').style.display = st.strokes.length ? 'none' : ''; };
  redraw(); let cur = null;
  const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.onpointerdown = e => { c.setPointerCapture(e.pointerId); cur = [pt(e)]; st.strokes.push(cur); redraw(); };
  c.onpointermove = e => { if (!cur) return; cur.push(pt(e)); redraw(); };
  c.onpointerup = c.onpointercancel = () => { cur = null; };
  st.redraw = redraw;
}
function sigData(id) { const st = sigs[id]; if (!st || !st.strokes.length) return ''; const c = st.c; const o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * c.height / c.width); const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/jpeg', 0.7); }

/* ---------- 완료 ---------- */
function done(w) {
  const qrBox = w === 'apply' ? '<p style="margin:22px 0 4px"><b>지금 휴대폰으로 교습소 앱을 설치해 주세요</b></p><p class="mut" style="margin:0">출결·수업 기록·알림을 받는 재원생·학부모 전용 앱이에요. 휴대폰 카메라로 찍으세요.</p><div class="qr" id="qrBox"></div>' : '';
  return top() + '<main><div class="card done"><div class="ic">' + (w === 'apply' ? '🎉' : '✅') + '</div><h1>' + (w === 'apply' ? '입학 신청이 완료됐어요' : '감사합니다!') + '</h1><p class="lead">' + (w === 'apply' ? '원장님이 확인 후 첫 등원 일정과 앱 가입 안내를 보내 드려요.' : TITLE[w] + '를 원장님께 전달했어요.' + (w === 'parent' ? ' 테스트가 끝나면 1:1 결과 브리핑에서 함께 보실 거예요.' : '')) + '</p>' + qrBox + '<div style="margin-top:14px"><button class="btn" data-act="hub">처음 화면으로</button></div></div></main>';
}

function render() {
  if (!S.f) return;
  let h = '';
  if (S.w === 'done-parent' || S.w === 'done-student' || S.w === 'done-apply') h = done(S.w.slice(5));
  else if (S.w === 'parent' || S.w === 'student') h = survey(S.w);
  else if (S.w === 'apply') h = applyForm();
  else h = hub();
  app.innerHTML = h;
  if (S.w === 'apply') { setupSig('sigP'); setupSig('sigS'); }
  if (S.w === 'done-apply') { const box = document.getElementById('qrBox'); if (box && window.qrcode) { const q = window.qrcode(0, 'M'); q.addData('https://themilchak-math.github.io/install.html'); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: false }); } }
}
async function save(w, extra) { await updateDoc(doc(db, 'forms', TOK), { [w]: { ...S.a, ...(extra || {}), savedAt: Date.now() }, up: Date.now() }); S.f[w] = { ...S.a, ...(extra || {}) }; }

app.addEventListener('click', async e => {
  const o = e.target.closest('.opt'); if (o) {
    const k = o.dataset.k, v = o.dataset.v;
    if (o.dataset.t === 'r') S.a[k] = v;
    else { const l = S.a[k] = (S.a[k] || []).slice(); const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else { if (o.dataset.max && l.length >= +o.dataset.max) l.shift(); l.push(v); } }
    S.err = ''; const y = scrollY; render(); scrollTo(0, y); return;
  }
  const gw = e.target.closest('[data-go]'); if (gw) return go(gw.dataset.go);
  const cl = e.target.closest('[data-clr]'); if (cl) { const st = sigs[cl.dataset.clr]; if (st) { st.strokes = []; st.redraw(); } return; }
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'hub') { S.w = 'hub'; const u = new URL(location.href); u.searchParams.set('w', 'hub'); history.replaceState(null, '', u); try { const d = await getDoc(doc(db, 'forms', TOK)); if (d.exists()) S.f = d.data(); } catch (er) { } render(); return scrollTo(0, 0); }
  if (a === 'prev') { S.page--; S.err = ''; render(); return scrollTo(0, 0); }
  if (a === 'next') {
    const pages = pagesOf(DEF[S.w]); const m = missing(pages[S.page].items); if (m) { S.err = m; return render(); }
    if (S.page < pages.length - 1) { S.page++; S.err = ''; render(); scrollTo(0, 0); if (S.page % 3 === 0) save(S.w).catch(() => { }); return; }
    S.busy = true; render();
    try { await save(S.w); S.busy = false; S.w = 'done-' + S.w; render(); scrollTo(0, 0); } catch (er) { S.busy = false; S.err = '저장하지 못했어요. 인터넷 연결을 확인해 주세요.'; render(); }
    return;
  }
  if (a === 'applyGo') {
    const A = S.a; const need = [['name', '학생 성명'], ['birth', '생년월일'], ['school', '학교'], ['gName', '보호자 성명'], ['gPhone', '보호자 연락처'], ['cls', '수강 과정']].find(([k]) => !A[k]);
    if (need) { S.err = need[1] + '을(를) 적어 주세요'; return render(); }
    if (!/^01\d{8,9}$/.test(digits(A.gPhone)) || (A.pStudent && !/^01\d{8,9}$/.test(digits(A.pStudent)))) { S.err = '휴대폰 번호를 확인해 주세요'; return render(); }
    if (A.cls !== 'E' && !(A.days || []).length) { S.err = '희망 요일을 골라 주세요'; return render(); }
    if (A.agree !== '동의합니다') { S.err = '개인정보 수집·이용에 동의해 주셔야 신청할 수 있어요'; return render(); }
    const sp = sigData('sigP'); if (!sp) { S.err = '보호자 서명을 해 주세요'; return render(); }
    S.busy = true; render();
    try { await save('apply', { signP: sp, signS: sigData('sigS'), price: priceOf(A.cls, A.grade), date: A.date || today() }); S.busy = false; S.w = 'done-apply'; render(); scrollTo(0, 0); }
    catch (er) { S.busy = false; S.err = '저장하지 못했어요. 인터넷 연결을 확인해 주세요.'; render(); }
  }
});
app.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.in; if (!k) return;
  let v = e.target.value; if (e.target.type === 'tel') { const d = digits(v).slice(0, 11); v = fmtP(d); if (v !== e.target.value) e.target.value = v; }
  S.a[k] = v; if (k === 'grade' && S.w === 'apply') { const y = scrollY; render(); scrollTo(0, y); }
});
app.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.in; if (k && e.target.tagName === 'SELECT') { S.a[k] = e.target.value; const y = scrollY; render(); scrollTo(0, y); } });
let lastNarrow = narrow(); addEventListener('resize', () => { if (narrow() !== lastNarrow) { lastNarrow = narrow(); S.page = 0; if (S.w === 'parent' || S.w === 'student') render(); } });

(async () => {
  if (!TOK || TOK.length < 20) { app.innerHTML = top() + '<main><div class="card done"><div class="ic">🔗</div><h1>상담 링크가 필요해요</h1><p class="lead">교습소에서 받은 링크로 열어 주세요.</p></div></main>'; return; }
  try { const d = await getDoc(doc(db, 'forms', TOK)); if (!d.exists()) throw new Error('none'); S.f = d.data(); }
  catch (e) { app.innerHTML = top() + '<main><div class="card done"><div class="ic">⏰</div><h1>링크가 만료됐어요</h1><p class="lead">상담이 끝난 링크이거나 주소가 잘못됐어요. 교습소(010-4318-0075)로 문의해 주세요.</p></div></main>'; return; }
  if (S.w !== 'hub' && DEF[S.w] || S.w === 'apply') go(S.w); else { S.w = 'hub'; render(); }
})();
