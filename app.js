// 더밀착수학 앱 - 실제 버전 (Firebase 연결)
// 개발 노트는 개발노트.md 참고
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser, RecaptchaVerifier, linkWithPhoneNumber, signInWithPhoneNumber, updatePassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SUBJS, CUR, GROUPS, subjOf, defCourse, courseLabel, lessonSummary, ACT, isAct } from './subjects.js';
import { firebaseConfig } from './firebase-config.js';
import { buildItems, calHtml } from './calendar.js';
import { CATS, catOf, catLabel, catPush, freshToken, uploadFile, deleteFiles, fmtSize, filesHtml, lightbox, visibleTo, toLabel, TO_OPTS, parseTo, pushKeys, okLink, BOARD_CSS } from './board.js';
{const st=document.createElement('style');st.textContent=BOARD_CSS+TYPING_CSS+'.msg.deld,.m.deld{border:1.5px dashed #f0a3a5!important;background:#fff7f7!important;color:#6b6f86!important}.delt{display:block;font-size:11px;color:#e5484d;font-weight:700;margin-bottom:3px}'+'.notice p{white-space:pre-wrap}.bq{list-style:none;padding:0;margin:6px 0;display:flex;flex-direction:column;gap:4px}.bq li{display:flex;gap:6px;align-items:center;padding:6px 10px;border:1px solid var(--line);border-radius:10px;font-size:14px}.bq li span.n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';document.head.appendChild(st)}
import { syncSched, plannedOn } from './sched.js';
import { createTyping, TYPING_CSS, typingHtml } from './typing.js';
import { CALL_HOURS, callOpen, hh, rangeTxt, callsHtml, scheduleRemind, cancelRemind } from './calls.js';
import { PUSH_URL, pushState, enablePush, sendPush, pushErrorText, announceUpdate, isIOS as pushIOS, syncTeacherSubs, remindLater, remindCancel } from './push.js';

const APP_VERSION = '2.9.1';
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const MAIL = '@themilchak-math.app';
const pad=n=>String(n).padStart(2,'0');
const ds=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
// 하루의 경계 = 새벽 3시 (새벽 3시 전 하원은 전날 등원에 대한 하원)
const DAY_CUT=3;
const off=k=>{const d=new Date(Date.now()-DAY_CUT*36e5);d.setDate(d.getDate()+k);return ds(d)};
const lateLabel=t=>t&&t<'0'+DAY_CUT+':00'?'새벽 '+t:t;
const TODAY=off(0);
const WD='일월화수목금토';
const fmtD=s=>{const d=new Date(s+'T00:00');return (d.getMonth()+1)+'/'+d.getDate()+' ('+WD[d.getDay()]+')'};
const hm=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())};
const stamp=()=>ds(new Date())+' '+hm();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const ST=['출석','지각','결석'];
const PCT=[0,10,20,30,40,50,60,70,80,90,100];

const stu=id=>D.students.find(s=>s.id===id);
const thread=k=>D.threads[k]||(D.threads[k]=[]);
const noshowAt=sid=>{const m=[sid+'|parent',sid+'|mother',sid+'|father'].flatMap(k=>thread(k)).sort((a,b)=>(a.ts||0)-(b.ts||0)).filter(x=>/^\[미등원 안내\]/.test(x.t||'')&&(x.at||'').startsWith(TODAY)).pop();return m?(m.at||'').slice(11,16):''};
const noshowTxt=s=>'[미등원 안내] '+s.name+' 학생이 아직 등원하지 않았어요. 혹시 늦거나 못 오게 되면 원장님께 알려 주세요.';
const noshowBtn=(x,day)=>day!==TODAY?'':(noshowAt(x.id)?' <span class="chip c-ok">안내 '+noshowAt(x.id)+'</span>':' <button class="btn sm ghost" style="padding:2px 8px" data-act="noshow" data-id="'+x.id+'">미등원 안내</button>');
// 형제: 같은 학부모 번호로 연결된 학생들 → 학부모 대화는 하나로 묶어 보여요 ("홍길동/길순 학부모님")
const famSids=sid=>{let l;if(U.role==='teacher'){const ph=new Set((D.members||[]).filter(m=>m.sid===sid&&m.rel!=='student'&&m.phone).map(m=>m.phone));l=[...new Set([sid,...(D.members||[]).filter(m=>m.rel!=='student'&&ph.has(m.phone)).map(m=>m.sid)])]}else l=U.role==='parent'&&ME&&ME.sids?ME.sids.filter(x=>ME.rels[x]!=='student'):[sid];l=l.filter(x=>stu(x));if(!l.includes(sid)&&stu(sid))l.push(sid);return l.sort((a,b)=>stu(a).name.localeCompare(stu(b).name,'ko'))};
const famLabel=(sid,suf)=>{suf=' '+(suf||'학부모님');const l=famSids(sid).map(x=>stu(x).name);if(l.length<2)return (l[0]||(stu(sid)||{}).name||'')+suf;return l[0]+'/'+l.slice(1).map(n=>n[0]===l[0][0]?n.slice(1):n).join('/')+suf};
const myRel=()=>(typeof ME!=='undefined'&&ME&&ME.rels&&REL[ME.rels[U.me]]&&ME.rels[U.me]!=='student')?REL[ME.rels[U.me]]:'학부모님';
// 대화: 아버님·어머님은 각자 따로(학생id|father / |mother). 학생id|parent 는 자동 알림 공용함 → 두 분 대화에 모두 보여요
const PREL=['father','mother'];
const famKeys=k=>{const [sid,r]=k.split('|');return PREL.includes(r)?famSids(sid).flatMap(x=>[x+'|'+r,x+'|parent']):r==='parent'?famSids(sid).map(x=>x+'|parent'):[k]};
const joinedM=m=>m&&m.uid&&(m.st==='ok'||m.st==='pending');
const parKeys=sid=>{const f=famSids(sid);return PREL.filter(r=>(D.members||[]).some(m=>f.includes(m.sid)&&m.rel===r&&joinedM(m))).map(r=>sid+'|'+r)};
const stuKey=sid=>joinedM((D.members||[]).find(m=>m.sid===sid&&m.rel==='student'))?[sid+'|student']:[];
// 학생·학부모가 지운 메시지(del)는 가족 화면에선 완전히 안 보이고, 원장님·부원장 화면에만 '삭제한 메시지'로 남아요
const fthread=k=>famKeys(k).flatMap(x=>thread(x)).filter(m=>U.role==='teacher'||!m.del).sort((a,b)=>(a.ts||0)-(b.ts||0));
const myKey=()=>U.me+'|'+(U.role==='parent'&&ME&&ME.rels&&PREL.includes(ME.rels[U.me])?ME.rels[U.me]:U.role);

const IC={
  home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  att:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M8.5 13l2.5 2.5 4.5-5"/>',
  hw:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  log:'<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
  comm:'<path d="M4 5h16v11H9l-5 4z"/>',
  note:'<path d="M5 4h14v16H5zM9 9h6M9 13h6"/>',
  exam:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.6 3.5 6"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24">'+IC[n]+'</svg>';

const unreadTeacher=()=>Object.values(D.threads).reduce((a,t)=>a+t.filter(m=>m.f==='o'&&!m.r).length,0);
const unreadMine=()=>fthread(myKey()).filter(m=>(m.f==='t'||m.f==='s')&&!m.r).length;
const mySids=()=>U.role==='student'?[U.me]:U.role==='parent'?famSids(U.me):[];
const seenPosts=()=>U.role==='teacher'?D.notices:D.notices.filter(n=>visibleTo(n,mySids(),x=>(stu(x)||{}).grade,U.role));
const canDelPost=n=>isOwnerMe()||(U.role==='teacher'&&catOf(n)!=='notice');
const unreadNotice=()=>U.role==='teacher'?0:seenPosts().filter(n=>!(n.reads||[]).includes(ME.uid)).length;

function tabsFor(){
  const c=U.role==='teacher'?unreadTeacher():unreadMine()+unreadNotice();
  const t={teacher:[['home','홈'],['att','출결'],['hw','숙제'],['log','학습기록'],['comm','소통']],
    student:[['home','홈'],['hw','숙제'],['log','내 진도'],['comm','소통']],
    parent:[['home','홈'],['att','출결'],['hw','숙제'],['log','학습기록'],['comm','소통']]}[U.role];
  return t.map(([k,l])=>'<button data-tab="'+k+'" class="'+(U.tab===k?'on':'')+'">'+ic(k)+l+(k==='comm'&&c?'<span class="dot">'+c+'</span>':'')+(k==='att'&&U.role==='teacher'&&pending().length?'<span class="dot">'+pending().length+'</span>':'')+'</button>').join('');
}


const hwChip=h=>h.st==='checked'?'<span class="chip c-ok">확인 완료</span>':h.st==='done'?'<span class="chip c-pri">제출함</span>':(h.due<TODAY?'<span class="chip c-bad">기한 지남</span>':'<span class="chip c-warn">진행 중</span>');
const isIn=r=>!!r&&r.st!=='결석';
const attChip=a=>!a?'<span class="chip">미등원</span>':a.st==='결석'?'<span class="chip c-bad">결석</span>':'<span style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end"><span class="chip c-ok">등원'+(a.at?' '+a.at:'')+'</span>'+(a.out?'<span class="chip c-pri">하원 '+lateLabel(a.out)+'</span>':'')+'</span>';
const REL={student:'학생',father:'아버님',mother:'어머님'};
const digits=x=>String(x||'').replace(/\D/g,'');
const fmtP=d=>d.length===11?d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7):d;
const maskP=d=>d.length===11?d.slice(0,3)+'-****-'+d.slice(7):d;
const mPending=()=>(D.members||[]).filter(m=>m.st==='pending');
const mLabel=m=>{const s=stu(m.sid);return (s?s.name:(m.name||''))+' '+REL[m.rel]};
const mChip=m=>m.st==='ok'?'<span class="chip c-ok">연결됨</span>':m.st==='pending'?'<span class="chip c-warn">승인 대기</span>':m.st==='block'?'<span class="chip c-bad">차단</span>':'<span class="chip">미가입</span>';
function mReqRows(){const l=mPending();if(!l.length)return '<div class="empty">가입 승인 대기가 없어요</div>';return l.map(m=>'<div class="row" style="flex-wrap:wrap"><div class="av'+(m.rel!=='student'?' p':'')+'">'+(m.rel==='student'?'학생':REL[m.rel].slice(0,2))+'</div><div class="grow"><div class="nm">'+esc(mLabel(m))+'</div><div class="sub">'+esc(maskP(m.phone))+' · 등록 번호 일치</div></div><div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="mRej" data-id="'+m.id+'">거절</button><button class="btn sm" data-act="mOk" data-id="'+m.id+'">승인</button></div></div>').join('')}
function inviteText(m){const s=stu(m.sid);const nm=s?s.name:(m.name||'');const who=m.rel==='student'?nm+' 학생':nm+' '+REL[m.rel];const tn=(D.cfg&&D.cfg.teacher)||'';
  return '[더밀착수학] 안녕하세요, '+who+'. '+(tn?'더밀착수학 '+tn+' 원장':'더밀착수학')+'입니다.\n'+(m.rel==='student'?'출결·숙제·수업 기록':'출결·수업 기록·숙제·공지')+'을 확인하는 교습소 앱 안내드려요.\n\n▶ 설치 안내 (아이폰·갤럭시 따로 정리돼 있어요)\nhttps://themilchak-math.github.io/install.html\n\n가입할 때 이 번호('+fmtP(m.phone)+')와 원하는 비밀번호를 넣고, 문자로 오는 인증번호 6자리를 입력해 주세요. 인증하면 바로 이용할 수 있어요.\n'+'설치 후 앱에서 [알림 받기]를 꼭 눌러 주세요.'}
const smsHref=m=>'sms:'+m.phone+(pushIOS()?'&':'?')+'body='+encodeURIComponent(inviteText(m));
/* ===== 일정(시험기간·휴무·특수 일정) ===== */
const EXAM_T=['1학기 중간고사','1학기 기말고사','2학기 중간고사','2학기 기말고사'];
const schools=()=>[...new Set(D.students.map(s=>(s.school||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
const KIND={exam:'시험기간',off:'교습소 휴무',event:'특수 일정'};const kindOf=e=>e.kind||'exam';
const KIND_T={exam:EXAM_T,off:['교습소 휴무','명절 연휴 휴무','원장님 연수 휴무','여름 휴가','겨울 휴가'],event:['소풍','체험학습','수학여행','학교 축제','개교기념일','방학식','개학식']};
const examsFor=sc=>(D.exams||[]).filter(e=>(kindOf(e)==='off'||!e.school||e.school===sc)&&(e.end||e.start)>=TODAY).sort((a,b)=>a.start<b.start?-1:1);
const dday=e=>{if(e.start<=TODAY)return kindOf(e)==='exam'?'시험 중':kindOf(e)==='off'?'휴무 중':'오늘';const n=Math.round((new Date(e.start+'T00:00')-new Date(TODAY+'T00:00'))/864e5);return 'D-'+n};
const kChip=e=>{const k=kindOf(e);return '<span class="chip '+(k==='off'?'c-bad':k==='event'?'c-pri':'c-warn')+'">'+KIND[k]+'</span> '};
const examRow=(e,del)=>'<div class="row"><div class="grow"><div class="nm">'+kChip(e)+(kindOf(e)!=='off'&&e.school&&(del||kindOf(e)==='event')?esc(e.school)+' · ':'')+esc(e.title)+'</div><div class="sub">'+fmtD(e.start)+(e.end&&e.end!==e.start?' ~ '+fmtD(e.end):'')+(e.memo?' · '+esc(e.memo):'')+'</div></div>'+((e.end||e.start)>=TODAY?'<span class="chip c-warn">'+dday(e)+'</span>':'<span class="chip">끝남</span>')+(del?'<button class="btn sm ghost" data-act="exDel" data-id="'+e.id+'">삭제</button>':'')+'</div>';
function examCard(s){if(!s)return '';const l=examsFor(s.school||'__none').filter(e=>kindOf(e)!=='exam'||s.school);if(!l.length)return '';return '<div class="card" style="border-color:var(--warn)"><h3>일정 <small>'+esc(s.school||'')+'</small></h3>'+l.map(e=>examRow(e,false)).join('')+'</div>'}
function examView(){
  const sc=schools();const noSc=D.students.filter(s=>!s.school).length;const k=U.exK||'exam';
  const all=[...(D.exams||[])].sort((a,b)=>((b.end||b.start)>=TODAY)-((a.end||a.start)>=TODAY)||(a.start<b.start?-1:1));
  const ym=U.schM||TODAY.slice(0,7);const [yy,mm]=ym.split('-').map(Number);const items=buildItems(ym,{exams:D.exams||[],students:D.students,birthOf:isOwnerMe()?(s=>(D.sinfo[s.id]||{}).birth):null,onReady:()=>render()});
  return header('일정 등록','시험기간·휴무·특수 일정을 등록하면 해당 가족 앱에 바로 보여요',true)+'<div class="body">'+
  '<div class="card"><h3>'+yy+'년 '+mm+'월</h3><div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn sm ghost" data-act="schM" data-v="-1">‹</button><button class="btn sm ghost" style="flex:1" data-act="schM" data-v="0">이번 달</button><button class="btn sm ghost" data-act="schM" data-v="1">›</button></div>'+calHtml(ym,items,TODAY)+'</div>'+
  '<form class="card" id="examF"><h3>일정 등록</h3><div class="pills" style="margin:0 0 10px">'+Object.entries(KIND).map(([kk,l])=>'<button type="button" data-act="exK" data-v="'+kk+'" class="'+(k===kk?'on':'')+'">'+l+'</button>').join('')+'</div>'+
  (k==='off'?'<p class="sub" style="margin:0 0 10px">교습소 전체가 쉬는 날이에요. 모든 가족에게 알림이 가요.</p>':'<label class="f"><span>'+(k==='exam'?'학교':'대상 학교 (비우면 전체)')+'</span><input id="exS" list="exSL" placeholder="예: 동탄중" autocomplete="off"><datalist id="exSL">'+sc.map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></label>')+
  '<label class="f"><span>'+(k==='exam'?'시험':'일정 이름')+'</span><input id="exT" list="exTL" placeholder="'+(k==='exam'?'예: 2학기 기말고사':k==='off'?'예: 추석 연휴 휴무':'예: 소풍')+'" autocomplete="off"><datalist id="exTL">'+KIND_T[k].map(x=>'<option value="'+x+'">').join('')+'</datalist></label>'+
  '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><label class="f"><span>시작일</span><input type="date" id="exA"></label><label class="f"><span>끝나는 날</span><input type="date" id="exB"></label></div>'+
  '<label class="f"><span>메모 (선택)</span><input id="exM" placeholder="예: 그날은 오후 6시 등원"></label><button class="btn" style="width:100%" type="submit">등록하고 알림 보내기</button>'+
  (k==='exam'&&noSc?'<p class="sub" style="margin:10px 0 0">학교가 입력되지 않은 학생이 '+noSc+'명 있어요. 학생 관리에서 학교를 넣어 주세요.</p>':'')+'</form>'+
  '<div class="card"><h3>등록된 일정 <small>'+all.length+'건</small></h3>'+(all.length?all.map(e=>examRow(e,true)).join(''):'<div class="empty">아직 등록된 일정이 없어요</div>')+'</div></div>';
}
/* ===== 부원장 ===== */
const isOwnerMe=()=>!!(D.cfg&&D.cfg.owner===ME.uid);
const stPending=()=>(D.staff||[]).filter(x=>x.st==='pending');
const staffInvite=x=>'[더밀착수학] '+(x.name||'')+' 선생님, 더밀착수학 관리 앱 부원장 계정 안내드려요.\n\n▶ 설치 안내: https://themilchak-math.github.io/install.html\n가입할 때 이 번호('+fmtP(x.phone)+')와 원하는 비밀번호 입력 → 원장님 승인 후 이용 (PC는 https://themilchak-math.github.io/admin.html)';
const staffChip=x=>x.st==='ok'?'<span class="chip c-ok">사용 중</span>':x.st==='pending'?'<span class="chip c-warn">승인 대기</span>':'<span class="chip">미가입</span>';
function staffRows(){const l=D.staff||[];if(!l.length)return '<div class="empty">등록된 부원장이 없어요</div>';return l.map(x=>'<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+esc(x.name||'')+' 부원장</div><div class="sub">'+esc(fmtP(x.phone))+'</div></div>'+staffChip(x)+(x.st==='pending'?'<button class="btn sm ghost" data-act="stRej" data-id="'+x.id+'">거절</button><button class="btn sm" data-act="stOk" data-id="'+x.id+'">승인</button>':x.st==='none'?'<a class="btn sm" style="display:inline-flex;align-items:center;text-decoration:none" href="'+esc('sms:'+x.phone+(pushIOS()?'&':'?')+'body='+encodeURIComponent(staffInvite(x)))+'">안내 문자</a>':'')+'<button class="btn sm ghost" data-act="stDel" data-id="'+x.id+'">삭제</button></div>').join('')}
function staffWaitView(){const x=U.staffDoc||{};return authHeader('부원장 가입 확인','원장님이 승인하면 바로 이용할 수 있어요')+'<div class="body"><div class="card"><h3>'+esc(fmtP(ME.phone))+'</h3><div class="row"><div class="grow nm">'+esc(x.name||'')+' 부원장</div><span class="chip c-warn">원장님 승인 대기</span></div></div><div class="card"><p class="sub" style="margin:0">이 화면을 닫아도 괜찮아요. 승인되면 다음에 열 때 바로 들어가져요.</p></div>'+installTip()+'<button class="btn ghost" style="width:100%" data-act="logout">로그아웃</button></div>'}
function mngView(){
  return header('학생·학부모 관리','등록한 번호로만 가입할 수 있어요',true)+'<div class="body">'+
  '<div class="card"><h3>가입 승인 대기 <small>'+mPending().length+'건</small></h3>'+mReqRows()+'</div>'+
  (isOwnerMe()?'<div class="card"><h3>부원장 <button class="btn sm" data-act="sheet" data-s="staff">+ 등록</button></h3>'+staffRows()+'</div>':'')+
  '<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="stu">+ 학생 등록</button>'+
  D.students.map(s=>'<div class="card"><h3>'+esc(s.name)+' <small>'+esc(s.grade)+' · '+(s.school?esc(s.school):'학교 미입력')+' <button class="btn sm ghost" data-act="schEdit" data-id="'+s.id+'">학교</button></small></h3>'+['student','father','mother'].map(rel=>{const m=(D.members||[]).find(x=>x.sid===s.id&&x.rel===rel);return '<div class="row"><div class="grow"><div class="nm" style="font-weight:500">'+REL[rel]+'</div><div class="sub">'+(m?esc(fmtP(m.phone)):'번호 미등록')+'</div></div>'+(m?mChip(m):'<span class="chip">없음</span>')+(m&&m.st==='ok'?'<button class="btn sm ghost" data-act="mReset" data-id="'+m.id+'">비번 분실</button><button class="btn sm ghost" data-act="mBlock" data-id="'+m.id+'">차단</button>':m&&m.st==='block'?'<button class="btn sm ghost" data-act="mUnblock" data-id="'+m.id+'">해제</button>':m&&m.st==='pending'?'<button class="btn sm" data-act="mOk" data-id="'+m.id+'">승인</button>':m&&m.st==='none'?'<a class="btn sm" style="display:inline-flex;align-items:center;text-decoration:none" href="'+esc(smsHref(m))+'">안내 문자</a>':'')+'</div>'}).join('')+'</div>').join('')+'</div>';
}
const pending=()=>(D.req||[]).filter(q=>q.st==='pending');
const myReq=sid=>pending().find(q=>q.sid===sid);
function reqRows(){const l=pending();if(!l.length)return '<div class="empty">승인 대기 중인 등원 요청이 없어요</div>';return l.map(q=>{const s=stu(q.sid)||{name:'?',time:''};return '<div class="row" style="flex-wrap:wrap"><div class="av">'+esc(s.name.slice(-2))+'</div><div class="grow"><div class="nm">'+esc(s.name)+' 등원 요청</div><div class="sub">'+esc(q.at)+' 등원 요청'+'</div></div><div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="rej" data-id="'+q.id+'">거절</button><button class="btn sm" data-act="ok" data-id="'+q.id+'">승인</button></div></div>'}).join('')}
const loggedOn=(sid,d)=>D.logs.some(l=>l.sid===sid&&l.date===d);
const fmtDist=m=>m>=1000?(m/1000).toFixed(1)+'km':m+'m';
const stars=n=>'<span class="stars" aria-label="이해도 '+n+'/5">'+'★'.repeat(n)+'<span style="opacity:.25">'+'★'.repeat(5-n)+'</span></span>';

function noticeList(limit,cat){
  const list=seenPosts().filter(n=>!cat||cat==='all'||catOf(n)===cat).sort((a,b)=>(!!b.pin-!!a.pin)||((b.at||'')>(a.at||'')?1:(b.at||'')<(a.at||'')?-1:0)||((b.ts||0)-(a.ts||0))).slice(0,limit||99);
  if(!list.length)return '<div class="empty">'+(cat&&cat!=='all'?'이 말머리 글이 아직 없어요':'아직 소식이 없어요')+'</div>';
  const T=U.role==='teacher';
  return list.map(n=>{
    const read=(n.reads||[]).includes(ME.uid);
    return '<div class="notice"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="bcat">'+catLabel(catOf(n))+'</span>'+(n.pin?'<span class="chip c-bad">고정</span>':'')+'<b>'+esc(n.title)+'</b></div><div class="sub">'+fmtD(n.at)+(n.byName?' · '+esc(n.byName):'')+(T?' · '+esc(toLabel(n,x=>(stu(x)||{}).name))+' · 읽음 '+(n.reads||[]).length+'명':(read?' · 읽음':''))+'</div>'+(n.body?'<p>'+esc(limit?(n.body.length>90?n.body.slice(0,90)+'…':n.body):n.body)+'</p>':'')+filesHtml(n,esc,!!limit)+(!T&&!read&&!limit?'<button class="btn sm ghost" style="margin-top:8px" data-act="readN" data-id="'+n.id+'">확인했어요</button>':'')+(canDelPost(n)&&!limit?'<button class="btn sm ghost" style="margin-top:8px" data-act="editN" data-id="'+n.id+'">수정</button> <button class="btn sm ghost" style="margin-top:8px" data-act="delN" data-id="'+n.id+'">삭제</button>':'')+'</div>';
  }).join('');
}
const boardPills=()=>'<div class="pills" style="flex-wrap:wrap">'+[['all','전체']].concat(CATS).map(c=>'<button data-act="bcat" data-v="'+c[0]+'" class="'+((U.bcat||'all')===c[0]?'on':'')+'">'+c[1]+'</button>').join('')+'</div>';

const sortLogs=l=>[...l].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
const lastOf=(sid,course,unit)=>sortLogs(D.logs.filter(l=>l.sid===sid&&l.course===course&&l.unit===unit)).pop();
const unitsOf=(sid,course)=>{const base=CUR[course]||[];const extra=[...new Set(D.logs.filter(l=>l.sid===sid&&l.course===course&&!base.includes(l.unit)).map(l=>l.unit).filter(Boolean))];return base.concat(extra)};
const latest=sid=>sortLogs(D.logs.filter(l=>l.sid===sid&&!isAct(l))).pop();
const latestIn=(sid,sj)=>sortLogs(D.logs.filter(l=>l.sid===sid&&subjOf(l)===sj)).pop();
const curCourse=(s,sj)=>{const l=latestIn(s.id,sj);return l?l.course:(sj==='수학'?s.course:defCourse(s.grade,sj))};
const subjsOf=s=>{const has=new Set(D.logs.filter(l=>l.sid===s.id&&!isAct(l)).map(subjOf));return SUBJS.filter(x=>has.has(x)).length?SUBJS.filter(x=>has.has(x)):['수학']};
const nowCourse=s=>{const l=latest(s.id);return l?l.course:s.course};
const nowLabel=s=>{const l=latest(s.id);return l?courseLabel(l.course,subjOf(l)):s.course};
const curUnit=s=>{const l=latest(s.id);return l?subjOf(l)+' '+(l.unit||'(메모 기록)'):'기록 없음'};
const monthLogs=(sid,shared)=>D.logs.filter(l=>l.sid===sid&&l.date.slice(0,7)===TODAY.slice(0,7)&&(!shared||l.sh));
const ratioOf=l=>{const c=+l.c||0,p=+l.p||0,t=c+p;return t?Math.round(c/t*100):50};
const unitStat=(sid,course,u)=>{const l=D.logs.filter(x=>x.sid===sid&&x.course===course&&x.unit===u);return {n:l.length,last:sortLogs(l).pop()}};
function coursePct(sid,course){const us=unitsOf(sid,course);if(!us.length)return 0;let t=0;us.forEach(u=>{const l=lastOf(sid,course,u);if(l)t+=(l.c+l.p)/2});return Math.round(t/us.length)}
const mini=(lab,v,col)=>'<div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><span style="width:52px;color:var(--mut)">'+lab+'</span><div class="bar" style="flex:1;margin:0;height:7px"><i style="width:'+v+'%;background:'+col+'"></i></div><span style="width:34px;text-align:right;font-variant-numeric:tabular-nums">'+v+'%</span></div>';

function progressCard(s){
  const sjs=subjsOf(s);const lt=latest(s.id);U.psj=U.psj||{};
  const sj=sjs.includes(U.psj[s.id])?U.psj[s.id]:(lt?subjOf(lt):sjs[0]);
  const base=curCourse(s,sj);const courses=[...new Set([base,...D.logs.filter(l=>l.sid===s.id&&subjOf(l)===sj).map(l=>l.course)])];
  const cur=courses.includes(U.pc[s.id])?U.pc[s.id]:base;
  const us=unitsOf(s.id,cur);const lastC=sortLogs(D.logs.filter(l=>l.sid===s.id&&l.course===cur)).pop();
  const ml=D.logs.filter(l=>l.sid===s.id&&subjOf(l)===sj&&l.date.slice(0,7)===TODAY.slice(0,7)&&(U.role==='teacher'||l.sh));const mr=ml.length?Math.round(ml.reduce((a,l)=>a+ratioOf(l),0)/ml.length):null;
  return '<div class="card"><h3>'+esc(s.name)+' 학습 단원 <small>'+esc(s.grade)+'</small></h3>'+(sjs.length>1?'<div class="pills">'+sjs.map(x=>'<button data-act="psj" data-id="'+s.id+'" data-v="'+x+'" class="'+(x===sj?'on':'')+'">'+x+'</button>').join('')+'</div>':'')+(courses.length>1?'<div class="pills">'+courses.map(c=>'<button data-act="pc" data-id="'+s.id+'" data-v="'+esc(c)+'" class="'+(c===cur?'on':'')+'">'+esc(c)+'</button>').join('')+'</div>':'')+
  '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-weight:700;font-size:17px">'+(lastC?'지금 '+esc(lastC.unit):'아직 수업 기록이 없어요')+'</span><span class="sub">'+esc(courseLabel(cur,sj))+'</span></div>'+
  (mr!=null?'<div style="margin-top:10px"><div class="sub" style="margin-bottom:4px">이번 달 '+sj+' 수업 '+ml.length+'회 · 평균 비중</div>'+splitBar(mr)+'</div>':'')+
  '<div class="units" style="margin-top:10px">'+us.map((u,i)=>{const st=unitStat(s.id,cur,u);const now=lastC&&lastC.unit===u;return '<div class="'+(now?'n':st.n?'d':'')+'" style="flex-wrap:wrap"><b>'+(i+1)+'</b><span style="flex:1">'+esc(u)+(now?' <span class="chip c-pri" style="font-size:11px">지금</span>':'')+'</span>'+(st.n?'<span class="sub" style="font-size:12px">'+st.n+'회 · 최근 '+fmtD(st.last.date)+'</span>':'')+'</div>'}).join('')+'</div></div>';
}

const splitBar=c=>'<div style="display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--soft)"><i style="width:'+c+'%;background:var(--pri)"></i><i style="width:'+(100-c)+'%;background:var(--acc)"></i></div><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:3px"><span style="color:var(--pri);font-weight:700">개념 '+c+'%</span><span style="color:var(--acc);font-weight:700">문제풀이 '+(100-c)+'%</span></div>';
function logBody(x){
  return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>'+fmtD(x.date)+' · '+esc(x.unit||subjOf(x)+' (메모 참고)')+'</b><span style="display:flex;gap:4px">'+(x.w&&x.w<100?'<span class="chip c-pri">그날 수업의 '+x.w+'%</span>':'')+'<span class="chip">'+esc(courseLabel(x.course,subjOf(x)))+'</span></span></div>'+(isAct(x)?'':'<div style="margin-top:8px">'+splitBar(ratioOf(x))+'</div>')+(x.cm?'<p class="sub" style="margin-top:6px">원장님 메모: '+esc(x.cm)+'</p>':'');
}

function logList(sid,onlyShared){
  const l=sortLogs(D.logs.filter(x=>x.sid===sid&&(!onlyShared||x.sh))).reverse();
  if(!l.length)return '<div class="empty">아직 기록이 없어요</div>';
  return l.map(x=>'<div class="log">'+logBody(x)+(U.role==='teacher'?'<div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">'+(x.sh?'<span class="chip c-ok">학부모·학생 공유됨</span>':'<span class="chip">비공개</span>')+'<button class="btn sm ghost" data-act="togSh" data-id="'+x.id+'">'+(x.sh?'공유 끄기':'공유하기')+'</button><button class="btn sm ghost" data-act="delLog" data-id="'+x.id+'">삭제</button></div>':'')+'</div>').join('');
}

function hwList(list,mode){
  if(!list.length)return '<div class="empty">숙제가 없어요</div>';
  return list.map(h=>{
    const s=stu(h.sid);
    let act='';
    if(mode==='teacher'){act=h.st==='done'?'<button class="btn sm" data-act="hwCheck" data-id="'+h.id+'">확인</button>':'<button class="btn sm ghost" data-act="hwDel" data-id="'+h.id+'">삭제</button>'}
    if(mode==='student'&&h.st==='todo'){act='<button class="btn sm" data-act="hwDone" data-id="'+h.id+'">완료했어요</button>'}
    return '<div class="row"><div class="grow"><div class="nm">'+esc(h.title)+'</div><div class="sub">'+(mode==='teacher'?esc(s?s.name:'')+' · ':'')+esc(h.range)+' · 마감 '+fmtD(h.due)+'</div>'+(h.note?'<div class="sub">학생 메모: '+esc(h.note)+'</div>':'')+'<div style="margin-top:4px">'+hwChip(h)+'</div></div>'+act+'</div>';
  }).join('');
}

/* ---------- 결석 미리 알리기 ---------- */
const absOf=(sid,d)=>D.abs.find(x=>x.sid===sid&&x.date===d);
const absUp=sid=>D.abs.filter(x=>x.date>=TODAY&&(!sid||x.sid===sid)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
const absChip=x=>x.ok?'<span class="chip c-ok">원장님 확인</span>':'<span class="chip c-warn">확인 대기</span>';
// 전화 상담 요청 (학부모)
function callCard(s){
  const l=(D.calls||[]).filter(c=>c.sid===s.id&&callOpen(c)&&c.date>=TODAY).sort((a,b)=>a.date<b.date?-1:1);
  return '<div class="card"><h3>📞 전화 상담 요청</h3>'+(l.length?l.map(c=>'<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+fmtD(c.date)+' · '+(c.st==='ok'?c.at:rangeTxt(c)+' 가능')+'</div><div class="sub">'+(c.st==='ok'?'원장님이 이 시간에 전화드릴게요':'원장님 확인 대기 중')+(c.memo?' · '+esc(c.memo):'')+'</div></div>'+(c.st==='ok'?'<span class="chip c-ok">확정</span>':'<span class="chip c-warn">대기</span>')+'<button class="btn sm ghost" data-act="callCancel" data-id="'+c.id+'">취소</button></div>').join(''):'<p class="sub" style="margin:0 0 10px">통화 가능한 날짜와 시간대를 보내 주시면 원장님이 시간을 정해 전화드려요.</p>')+'<button class="btn'+(l.length?' ghost':'')+'" style="width:100%;margin-top:8px" data-act="sheet" data-s="call">상담 요청하기</button></div>';
}
function absCard(s){
  const l=absUp(s.id);
  return '<div class="card"><h3>결석 미리 알리기</h3>'+(l.length?l.map(x=>'<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+fmtD(x.date)+' 결석</div><div class="sub">'+esc(x.reason)+'</div></div>'+absChip(x)+'<button class="btn sm ghost" data-act="absDel" data-id="'+x.id+'">취소</button></div>').join(''):'<p class="sub" style="margin:0 0 10px">수업에 빠지는 날이 있으면 미리 알려 주세요. 원장님께 바로 알림이 가요.</p>')+'<button class="btn" style="width:100%;margin-top:8px" data-act="sheet" data-s="abs">결석 알리기</button></div>';
}
function absTeacherCard(){
  const l=absUp();if(!l.length)return '';const n=l.filter(x=>!x.ok).length;
  return '<div class="card"'+(n?' style="border-color:var(--acc)"':'')+'><h3>결석 통보 <small>'+(n?'확인 안 한 '+n+'건':'예정 '+l.length+'건')+'</small></h3>'+l.map(x=>{const st=stu(x.sid);return '<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+esc(st?st.name:'?')+' · '+fmtD(x.date)+'</div><div class="sub">'+esc(x.reason)+(x.who?' · '+esc(x.who):'')+'</div></div>'+(x.ok?'<span class="chip c-ok">확인함</span>':'<button class="btn sm" data-act="absOk" data-id="'+x.id+'">확인</button>')+'</div>'}).join('')+'</div>';
}

/* ---------- 날짜별 수업 계획 (PC 대시보드와 같은 기준) ---------- */
const evKind=e=>e.kind||'exam';const onDay=(e,d)=>e.start<=d&&(e.end||e.start)>=d;
// 기본 날짜: 새벽 3시 기준 영업일. 자정이 지났고 그날 등원생이 모두 하원했으면 달력상 오늘
function homeDefault(){const biz=off(0),cal=ds(new Date());if(cal===biz)return biz;const rs=Object.values(D.att[biz]||{}).filter(r=>r.st!=='결석');return rs.every(r=>r.out)?cal:biz}
const curDay=()=>U.dayPick||homeDefault();
// 학부모 홈 날짜: 우리 아이가 등원해서 아직 하원 안 했으면 그 등원 날(하원하면 넘어감), 하원했거나 안 왔으면 밤 12시에 넘어감
function famDay(sid){const biz=off(0),cal=ds(new Date());if(cal===biz)return biz;const r=(D.att[biz]||{})[sid];return r&&r.st!=='결석'&&!r.out?biz:cal}
function regOf(day){ // 정산 등원 요일(원장님만) → 정규 예정 학생 id
  if((D.exams||[]).some(e=>evKind(e)==='off'&&onDay(e,day)))return [];
  const m=(D.fin||{})[day.slice(0,7)];if(!m||!(m.rows||[]).length)return null;const w=new Date(day+'T00:00').getDay();if(w===0)return [];
  return D.students.filter(s=>(m.rows||[]).some(r=>(r.sid===s.id||(!r.sid&&r.name===s.name))&&(r.d||[])[w-1])).map(s=>s.id)}
function dayPlan(day){
  const a=D.att[day]||{};const reg=regOf(day);const ex=((D.extra[day]||{}).sids||[]).filter(id=>stu(id)&&!(reg||[]).includes(id));
  const exSet=new Set(ex),regSet=new Set(reg||[]),absD=new Set(D.abs.filter(x=>x.date===day).map(x=>x.sid));
  const rk=x=>regSet.has(x.id)&&!(absD.has(x.id)&&!a[x.id])?3:exSet.has(x.id)?2:absD.has(x.id)?1:0;
  const order=[...D.students].sort((x,y)=>(rk(y)-rk(x))||(exSet.has(x.id)&&exSet.has(y.id)?ex.indexOf(x.id)-ex.indexOf(y.id):x.name.localeCompare(y.name,'ko')));
  const plan=!!(reg||ex.length);const exp=D.students.filter(x=>rk(x)>=2);
  const tag=x=>{const r=a[x.id];const C=(t,c)=>'<span class="chip '+(c||'')+'">'+t+'</span>';
    if(exSet.has(x.id))return !r?C('보충 예정','c-pri'):r.st==='결석'?C('결석','c-bad'):r.out?C('완료','c-pri'):C('학습중','c-ok');
    if(r&&r.st==='결석')return C('결석','c-bad');if(r&&r.out)return C('완료','c-pri');if(r)return C('수업중','c-ok');
    if(absD.has(x.id))return C('결석 통보','c-bad');return regSet.has(x.id)?C('예정','c-warn'):C('없음')};
  return {a,reg,ex,exSet,regSet,absD,rk,order,plan,exp,tag,ev:(D.exams||[]).filter(e=>onDay(e,day))};
}
function dayNav(day){const lbl=day===off(0)||day===ds(new Date())?'오늘':fmtD(day);return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><button class="btn sm ghost" data-act="dayM" data-v="-1">‹</button><b style="flex:1;text-align:center">'+lbl+(lbl==='오늘'?' · '+fmtD(day):'')+'</b><button class="btn sm ghost" data-act="dayM" data-v="1">›</button>'+(U.dayPick?'<button class="btn sm" data-act="dayT">오늘로</button>':'')+'</div>'}

/* ---------- screens ---------- */
function tHome(){
  const day=curDay();const P=dayPlan(day);const a=P.a;
  const present=D.students.filter(s=>a[s.id]&&a[s.id].st!=='결석').length;const expIn=P.exp.filter(x=>a[x.id]&&a[x.id].st!=='결석').length;
  const notYet=P.exp.filter(x=>!a[x.id]);const rg=notYet.filter(x=>!P.exSet.has(x.id)),sp=notYet.filter(x=>P.exSet.has(x.id));
  const cand=D.students.filter(x=>P.rk(x)<2&&!(a[x.id]&&a[x.id].st!=='결석'));
  const toCheck=D.hw.filter(h=>h.st==='done');
  return header(TNAME(),'오늘 '+fmtD(TODAY)+(day!==off(0)&&!U.dayPick?' · 모두 하원해서 다음 날 기준':''))+'<div class="body">'+pushCard()+
  ((D.calls||[]).filter(callOpen).length?'<div class="card hl"><h3>📞 전화 상담 요청 '+D.calls.filter(callOpen).length+'</h3>'+callsHtml(D.calls.filter(callOpen),{attr:'data-act',sm:'sm',esc,fmtD,fmtP})+'</div>':'')+
  '<div class="quick"><button data-act="go" data-tab="att">'+ic('att')+'등·하원</button><button data-act="sheet" data-s="hw">'+ic('hw')+'숙제 내기</button><button data-act="sheet" data-s="log">'+ic('log')+'기록 쓰기</button>'+(isOwnerMe()?'<button data-act="sheet" data-s="notice">'+ic('note')+'공지 쓰기</button>':'')+''+(isOwnerMe()?'<button data-act="page" data-v="mng">'+ic('users')+'학생 관리</button><button data-act="page" data-v="exam">'+ic('exam')+'일정 등록</button>':'')+'</div>'+
  (isOwnerMe()&&stPending().length?'<div class="card" style="border-color:var(--warn)"><h3>부원장 가입 승인 <small>'+stPending().length+'건</small></h3>'+staffRows().replace(/<div class="row"/g,'<div class="row"')+'</div>':'')+
  (mPending().length?'<div class="card" style="border-color:var(--warn)"><h3>가입 승인 대기 <small>'+mPending().length+'건</small></h3>'+mReqRows()+'</div>':'')+
  (pending().length?'<div class="card" style="border-color:var(--acc)"><h3>등원 승인 대기 <small>'+pending().length+'건</small></h3>'+reqRows()+'</div>':'')+(isOwnerMe()&&(D.apply||[]).length?'<div class="card" style="border-color:var(--acc)"><h3>신규 등록 신청 <small>'+D.apply.length+'건</small></h3>'+D.apply.map(a=>'<div class="row"><div class="grow"><div class="nm">'+esc(a.name)+' <small class="sub">'+esc(a.school)+' '+esc(a.grade)+'</small></div><div class="sub">'+esc(a.memo||'')+'</div></div></div>').join('')+'<p class="sub" style="margin:8px 0 0">PC 관리자 › 학생 관리에서 [승인]을 누르면 등록이 한 번에 끝나요.</p></div>':'')+absTeacherCard()+
  '<div class="stats"><div><b>'+(P.plan?expIn+'/'+P.exp.length:present+'/'+D.students.length)+'</b><span>'+(P.plan?'예정 등원'+(P.ex.length?' (보충 '+P.ex.length+')':''):'등원')+'</span></div><div><b>'+toCheck.length+'</b><span>확인할 숙제</span></div><div><b>'+unreadTeacher()+'</b><span>새 메시지</span></div></div>'+
  (P.ev.length?'<div class="card"'+(P.ev.some(e=>evKind(e)==='off')?' style="border-color:var(--acc)"':'')+'><h3>일정</h3>'+P.ev.map(e=>examRow(e,false)).join('')+'</div>':'')+
  '<div class="card"><h3>출결</h3>'+dayNav(day)+
  (P.plan||P.ex.length?'<div style="margin:0 0 10px;padding:10px;border-radius:12px;background:var(--soft);border:1px solid var(--line)"><div class="sub" style="font-weight:700;margin-bottom:4px">아직 안 온 학생</div>'+(notYet.length?rg.map(x=>'<b>'+esc(x.name)+'</b>'+noshowBtn(x,day)).join(' · ')+(sp.length?(rg.length?' &nbsp; ':'')+'<span class="chip c-pri">보충</span> '+sp.map(x=>'<b>'+esc(x.name)+'</b>'+noshowBtn(x,day)+' <button class="btn sm ghost" style="padding:2px 8px" data-act="exDel" data-id="'+x.id+'">×</button>').join(' · '):''):'<span class="sub">'+(P.reg&&!P.reg.length&&P.ev.some(e=>evKind(e)==='off')?'교습소 휴무일이에요':'예정된 학생이 모두 왔어요')+'</span>')+'</div>':'')+
  (cand.length?'<div style="display:flex;gap:6px;margin-bottom:10px"><select id="exSel" style="flex:1;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--soft);color:var(--ink);min-height:40px"><option value="">보충 올 학생 선택</option>'+cand.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select><button class="btn sm" data-act="exAdd">+ 보충</button></div>':'')+
  P.order.map(s=>{const g=P.rk(s);return '<div class="row"'+(P.plan&&g===0&&!a[s.id]?' style="opacity:.5"':'')+'><div class="av">'+esc(s.name.slice(-2))+'</div><div class="grow"><div class="nm">'+esc(s.name)+'</div><div class="sub">'+esc(s.grade)+' · '+esc(curUnit(s))+'</div></div>'+(P.plan?P.tag(s)+' ':'')+attChip(a[s.id])+'</div>'}).join('')+'</div>'+
  '<div class="card"><h3>확인할 숙제</h3>'+hwList(toCheck,'teacher')+'</div>'+
  '<div class="card"><h3>최근 소식 <button class="btn sm ghost" data-act="go" data-tab="comm" data-comm="notice">전체</button></h3>'+noticeList(1)+'</div></div>';
}

function calCard(sid,teacher){
  const [y,m]=U.calM.split('-').map(Number);const lead=new Date(y,m-1,1).getDay();const nd=new Date(y,m,0).getDate();
  const cnt=[0,0,0];let cells=WD.split('').map((w,i)=>'<div class="wd'+(i===0?' sun':'')+'">'+w+'</div>').join('');
  for(let i=0;i<lead;i++)cells+='<div></div>';
  for(let d=1;d<=nd;d++){
    const ds=y+'-'+pad(m)+'-'+pad(d);const day=D.att[ds]||{};let cls='',sub='';
    if(sid!=='all'){const r=day[sid];if(r){const k=isIn(r)?0:2;cnt[k]++;cls=' k'+k}else if(absOf(sid,ds)&&ds>=TODAY){sub='<small>결석</small>'}}
    else{const rs=Object.values(day);if(rs.length){rs.forEach(r=>cnt[isIn(r)?0:2]++);const n=rs.filter(isIn).length;cls=n?' k0':' k2';sub='<small>'+n+'명</small>'}}
    cells+='<button data-act="calD" data-v="'+ds+'" class="'+cls+(ds===TODAY?' td':'')+(ds===U.calD?' sel':'')+(ds>TODAY?' fu':'')+'" aria-label="'+m+'월 '+d+'일">'+d+sub+'</button>';
  }
  const dd=U.calD;let det='';
  if(dd.slice(0,7)===U.calM){
    const day=D.att[dd]||{};
    const line=x=>{const r=day[x.id];const lg=D.logs.filter(l=>l.sid===x.id&&l.date===dd&&(teacher||l.sh)).pop();return '<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+esc(x.name)+'</div><div class="sub">'+(r?(r.st==='결석'?'결석':'등원 '+esc(r.at)+(r.out?' · 하원 '+esc(lateLabel(r.out)):dd===TODAY?' · 수업 중':' · 하원 기록 없음')):(absOf(x.id,dd)?'결석 통보 · '+esc(absOf(x.id,dd).reason):dd>TODAY?'예정':'기록 없음'))+(lg?'<br>수업: '+esc(lg.course+' '+lg.unit)+' · 개념 '+lg.c+'% · 문제 '+lg.p+'%':'')+'</div></div>'+attChip(r)+'</div>'};
    det='<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px"><b>'+fmtD(dd)+'</b>'+(sid==='all'?D.students.map(line).join(''):line(stu(sid)))+'</div>';
  }
  return '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><button class="btn sm ghost" data-act="calM" data-v="-1" aria-label="이전 달">‹</button><h3 style="margin:0">'+y+'년 '+m+'월 출결</h3><button class="btn sm ghost" data-act="calM" data-v="1" aria-label="다음 달">›</button></div>'+
  (teacher?'<div class="pills"><button data-act="calS" data-v="all" class="'+(sid==='all'?'on':'')+'">전체</button>'+D.students.map(x=>'<button data-act="calS" data-v="'+x.id+'" class="'+(sid===x.id?'on':'')+'">'+esc(x.name)+'</button>').join('')+'</div>':'')+
  '<div class="cal">'+cells+'</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"><span class="chip c-ok">등원 '+cnt[0]+'일</span><span class="chip c-bad">결석 '+cnt[2]+'일</span>'+(sid==='all'?'<span class="sub" style="font-size:13px">숫자는 그날 등원 인원</span>':'')+'</div>'+det+'</div>';
}

function tAtt(){
  const isT=curDay()===TODAY;const a=D.att[curDay()]||{};
  return header('출결 관리',fmtD(curDay())+(isT?' · 오늘':''))+'<div class="body">'+
  '<div class="card"><h3>등원 승인 대기 <small>'+pending().length+'건</small></h3>'+reqRows()+'</div>'+
  '<div class="card"><h3>출결 규칙</h3><p class="sub" style="margin:0">학생이 앱에서 [등원하기]를 누르면 원장님께 승인 요청이 와요. 승인해야 등원이 기록되고, 하원은 그날 학습 정리를 올린 뒤에만 열려요. 시각 수정·삭제는 PC 관리자 [출결]에서 할 수 있어요.</p></div>'+wifiCard()+
  (()=>{const P=dayPlan(curDay());return '<div class="card"><h3>학생별 등·하원</h3>'+dayNav(curDay())+P.order.map(s=>{const g=P.rk(s);
    const r=a[s.id];const lg=loggedOn(s.id,curDay());
    const ab=absOf(s.id,curDay());const line=!r&&ab?'결석 통보 · '+ab.reason+(ab.ok?'':' (확인 전)'):!r?'등원 전':r.st==='결석'?'결석 처리됨':'등원 '+r.at+(r.out?' · 하원 '+lateLabel(r.out):lg?' · 학습 정리 완료, 하원 대기':' · 수업 중');
    let act='';
    if(r&&r.st!=='결석'&&!r.out&&!lg&&isT)act='<button class="btn sm" data-act="logFor" data-id="'+s.id+'">오늘 학습 정리 올리기</button>';
    else if(!r)act='<button class="btn sm" data-act="forceIn" data-id="'+s.id+'">등원 처리</button><button class="btn sm ghost" data-act="absent" data-id="'+s.id+'">결석 처리</button>';
    else if(r.st==='결석')act='<button class="btn sm ghost" data-act="unabsent" data-id="'+s.id+'">결석 취소</button>';
    if(r&&r.st!=='결석')act+='<button class="btn sm ghost" style="color:var(--acc)" data-act="attDel" data-id="'+s.id+'">'+(U.attDelArm===s.id?'한 번 더 누르면 삭제':'기록 삭제')+'</button>';
    return '<div class="row" style="flex-wrap:wrap'+(P.plan&&g===0&&!r?';opacity:.5':'')+'"><div class="grow"><div class="nm">'+esc(s.name)+'</div><div class="sub">'+esc(line)+'</div></div>'+(P.plan?P.tag(s)+' ':'')+attChip(r)+(act?'<div style="width:100%;display:flex;justify-content:flex-end">'+act+'</div>':'')+'</div>'}).join('')+'</div>'})()+
  calCard(D.students.some(x=>x.id===U.calS)?U.calS:'all',true)+
  '<div class="card"><h3>최근 2주 출결 요약</h3>'+D.students.map(s=>{let c=[0,0];Object.keys(D.att).filter(d=>d>=off(-14)).forEach(d=>{const r=D.att[d][s.id];if(r)c[isIn(r)?0:1]++});return '<div class="row" style="flex-wrap:wrap"><div class="grow nm">'+esc(s.name)+'</div><span class="chip c-ok">등원 '+c[0]+'</span><span class="chip c-bad">결석 '+c[1]+'</span></div>'}).join('')+'</div></div>';
}

function checkCard(s){
  const r=(D.att[TODAY]||{})[s.id];const lg=!!(r&&r.logged)||loggedOn(s.id,TODAY);
  let m;
  const q=myReq(s.id);
  if(!r&&q)m='<p style="margin:0 0 6px;font-weight:700">원장님 승인 대기 중</p><p class="sub" style="margin:0 0 10px">'+esc(q.at)+'에 등원 요청을 보냈어요. 원장님이 승인하면 등원이 기록돼요.</p><button class="btn ghost" style="width:100%" data-act="cancelReq" data-id="'+q.id+'">요청 취소</button>';
  else if(!r&&U.wifiState==='checking')m='<p style="margin:0">교습소 와이파이 확인 중...</p>';
  else if(!r)m='<p class="sub" style="margin:0 0 10px">'+(wifiOn()?'교습소 와이파이에 연결돼 있으면 앱을 열거나 버튼을 누를 때 바로 등원돼요. 와이파이가 아니면 원장님 승인 요청으로 가요.':'교습소에 도착하면 눌러 주세요 · 원장님이 승인하면 등원이 기록돼요')+'</p><button class="btn" style="width:100%;min-height:52px;font-size:17px" data-act="checkin">등원하기</button>';
  else if(r.st==='결석')m='<p style="margin:0">오늘은 결석으로 처리되었어요.</p>';
  else if(r.out)m='<p style="margin:0">오늘 수업 끝! 수고했어요.</p>';
  else m='<p class="sub" style="margin:0 0 10px">'+(lg?'원장님이 오늘 학습 정리를 올렸어요. 하원 체크를 해주세요.':'원장님이 오늘 학습 정리를 올리면 하원할 수 있어요.')+'</p><button class="btn" style="width:100%;min-height:52px;font-size:17px" data-act="checkout"'+(lg?'':' disabled')+'>'+(lg?'하원 체크':'하원 잠김 · 학습 정리 대기')+'</button>';
  return '<div class="card"><h3>오늘 등·하원 '+attChip(r)+'</h3>'+m+'</div>';
}

function tHw(){
  const f=U.hwF;
  const list=D.hw.filter(h=>f==='all'||h.sid===f).sort((a,b)=>(a.st==='checked')-(b.st==='checked')||(a.due>b.due?1:-1));
  return header('숙제 관리','학생별로 숙제를 내고 제출을 확인해요')+'<div class="body">'+
  '<div class="pills"><button data-act="hwF" data-v="all" class="'+(f==='all'?'on':'')+'">전체</button>'+D.students.map(s=>'<button data-act="hwF" data-v="'+s.id+'" class="'+(f===s.id?'on':'')+'">'+esc(s.name)+'</button>').join('')+'</div>'+
  '<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="hw">+ 숙제 내기</button>'+
  '<div class="card">'+hwList(list,'teacher')+'</div></div>';
}

function tLog(){
  const s=stu(U.logS);if(!s)return header('학습기록','')+'<div class="body"><div class="empty">학생 관리에서 학생을 먼저 등록해 주세요</div></div>';
  return header('학습기록','진도와 수업 내용을 기록하고 공유해요')+'<div class="body">'+
  '<div class="pills">'+D.students.map(x=>'<button data-act="logS" data-v="'+x.id+'" class="'+(U.logS===x.id?'on':'')+'">'+esc(x.name)+'</button>').join('')+'</div>'+
  progressCard(s)+
  '<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="log">+ 오늘 수업 기록하기</button>'+
  '<div class="card"><h3>수업 기록</h3>'+logList(s.id,false)+'</div></div>';
}

function commTabs(){return '<div class="pills"><button data-act="comm" data-v="msg" class="'+(U.comm==='msg'?'on':'')+'">메시지</button><button data-act="comm" data-v="notice" class="'+(U.comm==='notice'?'on':'')+'">소식'+(unreadNotice()?' · '+unreadNotice():'')+'</button></div>'}

function tComm(){
  let inner;
  if(U.comm==='notice'){inner='<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="notice">+ 글쓰기 (사진·파일 첨부)</button>'+boardPills()+'<div class="card">'+noticeList(0,U.bcat)+'</div>'}
  else{
    const keys=[];D.students.forEach(s=>{keys.push(...stuKey(s.id));if(famSids(s.id)[0]===s.id)keys.push(...parKeys(s.id))});
    const items=keys.map(k=>{const t=fthread(k);const last=t[t.length-1];return {k,last,un:t.filter(m=>m.f==='o'&&!m.r).length}}).sort((a,b)=>((b.last?b.last.at:'')>(a.last?a.last.at:'')?1:-1));
    // 닫은 대화: 목록에서만 숨겨요(내용은 그대로). [+ 새 대화 시작]에서 다시 열거나, 상대가 새 메시지를 보내면 다시 나타나요
    const hidT=k=>(D.hid||{})[k]||0;const isHid=i=>hidT(i.k)&&!fthread(i.k).some(m=>m.f==='o'&&(m.ts||0)>hidT(i.k));
    const nameK=k=>{const [sd,rr]=k.split('|');return rr!=='student'?famLabel(sd,REL[rr]):stu(sd).name+' 학생'};const empty=items.filter(i=>!i.last||isHid(i));const isP=i=>i.k.split('|')[1]!=='student';const mf=U.mf||'all';const allS=items.filter(i=>i.last&&!isHid(i));const pL=allS.filter(isP),sL=allS.filter(i=>!isP(i));const shown=mf==='parent'?pL:mf==='student'?sL:allS;const unOf=l=>l.reduce((a,i)=>a+i.un,0);const og=(lab,l)=>l.length?'<optgroup label="'+lab+'">'+l.map(i=>'<option value="'+esc(i.k)+'">'+esc(nameK(i.k))+'</option>').join('')+'</optgroup>':'';
    inner=(empty.length?'<select id="newChat" style="width:100%;margin-bottom:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--soft);color:var(--ink);font-size:15px"><option value="">+ 새 대화 시작…</option>'+og('학부모',empty.filter(isP))+og('학생',empty.filter(i=>!isP(i)))+'</select>':'')+(allS.length?'<div class="pills">'+[['all','전체',allS],['parent','👪 학부모',pL],['student','🎒 학생',sL]].map(([v,lab,l])=>'<button data-act="mf" data-v="'+v+'" class="'+(mf===v?'on':'')+'">'+lab+' '+l.length+(unOf(l)?' · '+unOf(l):'')+'</button>').join('')+'</div>':'')+(shown.length?'':'<div class="empty">'+(allS.length?'이쪽 대화가 없어요':'아직 대화가 없어요')+'</div>')+'<div class="card"'+(shown.length?'':' hidden')+'>'+shown.map(i=>{const [sid,r]=i.k.split('|');const s=stu(sid);return '<button class="thr" data-act="open" data-k="'+i.k+'"><div class="av'+(r!=='student'?' p':'')+'">'+(r!=='student'?esc(REL[r]?REL[r].slice(0,2):'학부'):esc(s.name.slice(-2)))+'</div><div class="grow" style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><span class="nm">'+esc(r!=='student'?famLabel(sid,REL[r]):s.name+' 학생')+'</span><span class="sub">'+(i.last?esc(i.last.at.slice(5)):'')+'</span></div><div class="sub ell">'+(i.last?esc((i.last.del?'(삭제됨) ':'')+i.last.t):'대화를 시작해 보세요')+'</div></div>'+(i.un?'<span class="dot" style="position:static">'+i.un+'</span>':'')+'<span data-act="hideTh" data-k="'+i.k+'" title="목록에서 닫기 (대화 내용은 남아요)" style="padding:6px 4px 6px 8px;color:var(--mut);font-size:18px;line-height:1">×</span></button>'}).join('')+'</div>';
  }
  return header('소통','학생·학부모 메시지와 소식')+'<div class="body">'+commTabs()+inner+'</div>';
}

// 시스템 자동 알림: 원장님이 직접 보낸 메시지와 구분되게 '자동 알림' 말풍선으로
const rdTag=m=>' <span style="display:inline-block;margin-left:4px;padding:1px 7px;border-radius:9px;background:#fff;border:1px solid '+(m.r?'#bfe5cc;color:#1f9d55':'#f5c2c3;color:#e5484d')+';font-weight:700;font-size:11px;line-height:1.5">'+(m.r?'읽음':'안 읽음')+'</span>';
function sysHtml(m,showRead){const x=/^\[([^\]]+)\]\s*/.exec(m.t||'');const ttl=x?x[1]:'알림';const body=x?m.t.slice(x[0].length):(m.t||'');
  return '<div class="msg sys"><div class="sl">🔔 더밀착수학 자동 알림</div><b>'+esc(ttl)+'</b>'+esc(body)+'</div><div class="mt l">'+esc((m.at||'').slice(5))+(showRead?rdTag(m):'')+'</div>'}
function chatView(){
  const [sid,r]=U.chat.split('|');const s=stu(sid);
  const t=fthread(U.chat);
  const mine=U.role==='teacher'?'t':'o';
  const title=U.role==='teacher'?(r!=='student'?famLabel(sid,REL[r]):s.name+' 학생'):TNAME();
  const T=U.role==='teacher';const canDel=m=>T||(m.f===mine&&!m.r&&!/[|]parent$/.test(m.th||''));const sel=m=>canDel(m)&&m.id?' data-act="msgSel" data-id="'+m.id+'"':'';const delB=m=>canDel(m)&&U.msgSel===m.id?'<button class="btn sm ghost" style="align-self:'+(m.f===mine?'flex-end':'flex-start')+';color:var(--acc);margin-top:-4px" data-act="msgDel" data-id="'+m.id+'">'+(T?'이 메시지 삭제':'삭제')+'</button>':'';
  const body=(T&&t.length?'<div style="text-align:right;margin-bottom:6px"><button class="btn sm ghost" style="color:var(--acc)" data-act="chatDel">대화 전체 삭제</button></div><p class="sub" style="margin:0 0 8px;text-align:center;font-size:12px">메시지를 누르면 하나씩 지울 수 있어요 · 지우면 상대방 화면에서도 사라져요</p>':'')+(t.length?t.map(m=>(m.f==='s'?sysHtml(m,T).replace('<div class="msg sys">','<div class="msg sys"'+sel(m)+'>'):'<div class="msg '+(m.f===mine?'me':'you')+(T&&m.del?' deld':'')+'"'+sel(m)+'>'+(T&&m.del?'<span class="delt">🗑 보낸 사람이 삭제한 메시지</span>':'')+esc(m.t)+'</div><div class="mt'+(m.f===mine?'':' l')+'">'+esc(m.at.slice(5))+(m.f===mine?rdTag(m):'')+'</div>')+delB(m)).join(''):'<div class="empty">첫 메시지를 보내보세요</div>');
  return header(title,r!=='student'?(U.role==='teacher'?REL[r]+'과 1:1 대화 (다른 보호자는 못 봐요)':'원장님과 1:1 대화'):'학생 질문·안내',true)+'<div class="body" id="chatBody"><div class="chat">'+body+typingHtml('msg')+'</div></div><form class="send" id="sendF"><input id="msgIn" placeholder="메시지 입력" autocomplete="off" aria-label="메시지"><button class="btn" type="submit">전송</button></form>';
}

function sHome(){
  const s=stu(U.me);
  const todo=D.hw.filter(h=>h.sid===s.id&&h.st==='todo');
  const last=sortLogs(D.logs.filter(x=>x.sid===s.id&&x.sh)).pop();
  return header(s.name+' 학생',s.grade+' · '+nowLabel(s))+'<div class="body">'+pushCard()+checkCard(s)+examCard(s)+
  '<div class="stats"><div><b>'+todo.length+'</b><span>남은 숙제</span></div><div><b>'+monthLogs(s.id,true).length+'회</b><span>이번 달 수업</span></div><div><b>'+unreadMine()+'</b><span>새 메시지</span></div></div>'+
  '<div class="card"><h3>해야 할 숙제</h3>'+hwList(todo,'student')+'</div>'+
  (last?'<div class="card"><h3>최근 수업</h3><div class="log">'+logBody(last)+'</div></div>':'')+
  '<div class="card"><h3>소식 <button class="btn sm ghost" style="float:right" data-act="go" data-tab="comm" data-comm="notice">전체</button></h3>'+noticeList(2)+'</div></div>';
}
function sHw(){const s=stu(U.me);const l=D.hw.filter(h=>h.sid===s.id).sort((a,b)=>(a.st!=='todo')-(b.st!=='todo')||(a.due>b.due?1:-1));return header('내 숙제','완료하면 원장님께 바로 알려져요')+'<div class="body"><div class="card">'+hwList(l,'student')+'</div></div>'}
function myLog(){const s=stu(U.me);return header(U.role==='student'?'내 진도':s.name+' 학습기록',nowLabel(s))+'<div class="body">'+progressCard(s)+'<div class="card"><h3>수업 기록</h3>'+logList(s.id,true)+'</div></div>'}
function pHome(){
  const s=stu(U.me);const fd=famDay(s.id);const a=(D.att[fd]||{})[s.id];
  const hs=D.hw.filter(h=>h.sid===s.id);const doneRate=hs.length?Math.round(hs.filter(h=>h.st!=='todo').length/hs.length*100):0;
  const last=sortLogs(D.logs.filter(x=>x.sid===s.id&&x.sh)).pop();
  return header(s.name+' '+myRel(),s.grade+' · '+nowLabel(s))+'<div class="body">'+pushCard()+examCard(s)+
  '<div class="card"><h3>오늘 출결 <small>'+fmtD(fd)+'</small></h3><div class="row"><div class="grow nm">'+esc(s.name)+'</div>'+(()=>{const pl=plannedOn((D.sched||{})[s.id],fd,(D.exams||[]).some(e=>evKind(e)==='off'&&onDay(e,fd)));return (pl==='extra'?'<span class="chip c-pri">보충</span> ':'')+(a?attChip(a):absOf(s.id,fd)?'<span class="chip c-bad">결석 통보</span>':pl===false?'<span class="chip">오늘은 수업 없는 날</span>':attChip(a))})()+'</div></div>'+
  (last?'<div class="card"><h3>최근 수업</h3><div class="log">'+logBody(last)+'</div></div>':'')+
  '<div class="stats"><div><b>'+monthLogs(s.id,true).length+'회</b><span>이번 달 수업</span></div><div><b>'+doneRate+'%</b><span>숙제 수행</span></div><div><b>'+unreadMine()+'</b><span>새 메시지</span></div></div>'+
  (absUp(s.id).length?absCard(s):'')+((D.calls||[]).some(c=>c.sid===s.id&&callOpen(c)&&c.date>=TODAY)?callCard(s):'')+
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px"><button class="btn ghost" data-act="sheet" data-s="abs">결석 알리기</button><button class="btn ghost" data-act="sheet" data-s="call">📞 전화 상담 요청</button></div>'+
  '<div class="card"><h3>숙제 현황'+(hs.length>3?' <button class="btn sm ghost" style="float:right" data-act="go" data-tab="hw">전체 보기</button>':'')+'</h3>'+hwList(hwSort(hs).slice(0,3),'parent')+'</div>'+
  '<div class="card"><h3>소식 <button class="btn sm ghost" style="float:right" data-act="go" data-tab="comm" data-comm="notice">전체</button></h3>'+noticeList(2)+'</div></div>';
}
const hwRank=h=>h.st==='todo'?(h.due<TODAY?0:1):h.st==='done'?2:3;
const hwSort=l=>[...l].sort((a,b)=>hwRank(a)-hwRank(b)||(hwRank(a)<2?(a.due>b.due?1:a.due<b.due?-1:0):(a.due<b.due?1:a.due>b.due?-1:0)));
function pHw(){const s=stu(U.me);const l=hwSort(D.hw.filter(h=>h.sid===s.id));const todo=l.filter(h=>h.st==='todo'),late=todo.filter(h=>h.due<TODAY),fin=l.filter(h=>h.st!=='todo');
  const rate=l.length?Math.round(fin.length/l.length*100):0;
  return header(s.name+' 숙제','원장님이 낸 숙제와 완료 여부')+'<div class="body"><div class="stats"><div><b>'+(todo.length-late.length)+'</b><span>진행 중</span></div><div><b'+(late.length?' style="color:var(--bad,#e5484d)"':'')+'>'+late.length+'</b><span>기한 지남</span></div><div><b>'+rate+'%</b><span>수행률</span></div></div>'+
  '<div class="card"><h3>해야 할 숙제 <small>'+todo.length+'개</small></h3>'+hwList(todo,'parent')+'</div>'+
  '<div class="card"><h3>완료한 숙제 <small>'+fin.length+'개</small></h3>'+hwList(fin.slice(0,30),'parent')+'</div></div>'}
function pAtt(){const s=stu(U.me);return header('출결 달력',s.name)+'<div class="body">'+absCard(s)+calCard(s.id,false)+'</div>'}
function oComm(){
  let inner;
  if(U.comm==='notice')inner=boardPills()+'<div class="card">'+noticeList(0,U.bcat)+'</div>';
  else{const t=fthread(myKey());const last=t[t.length-1];const un=unreadMine();inner='<div class="card"><button class="thr" data-act="open" data-k="'+myKey()+'"><div class="av">'+esc(TNAME().slice(0,1))+'</div><div style="flex:1;min-width:0"><div class="nm">'+esc(TNAME())+'</div><div class="sub ell">'+(last?esc(last.t):'궁금한 점을 보내보세요')+'</div></div>'+(un?'<span class="dot" style="position:static">'+un+'</span>':'')+'</button></div>'}
  return header('소통','원장님과 메시지·소식')+'<div class="body">'+commTabs()+inner+'</div>';
}

function sheetHtml(){
  const t=U.sheet;
  const opts=D.students.map(s=>'<option value="'+s.id+'"'+(s.id===U.logS?' selected':'')+'>'+esc(s.name)+' ('+esc(s.grade)+')</option>').join('');
  let h='';
  if(t==='hw')h='<h3>숙제 내기</h3><div class="f"><span>받을 학생</span><div class="ck">'+D.students.map(s=>'<label><input type="checkbox" name="hwS" value="'+s.id+'"'+((U.hwF===s.id)?' checked':'')+'>'+esc(s.name)+'</label>').join('')+'</div></div><label class="f"><span>숙제 제목</span><input id="hwT" placeholder="예: 쎈 B단계 유형 3"></label><label class="f"><span>범위</span><input id="hwR" placeholder="예: p.40~45 짝수"></label><label class="f"><span>마감일</span><input type="date" id="hwD" value="'+off(2)+'"></label>';
  if(t==='stu')h='<h3>학생 등록</h3><label class="f"><span>학생 이름</span><input id="stN" autocomplete="off"></label><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><label class="f"><span>학년</span><select id="stG">'+['초4','초5','초6','중1','중2','중3','고1','고2','고3'].map(g=>'<option>'+g+'</option>').join('')+'</select></label></div><label class="f"><span>학교 (선택)</span><input id="stSc" list="stScL" placeholder="예: 동탄중" autocomplete="off"><datalist id="stScL">'+schools().map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></label><label class="f"><span>학생 휴대폰</span><input id="pS" inputmode="numeric" placeholder="010-0000-0000"></label><label class="f"><span>아버님 휴대폰</span><input id="pF" inputmode="numeric" placeholder="없으면 비워두세요"></label><label class="f"><span>어머님 휴대폰</span><input id="pM" inputmode="numeric" placeholder="없으면 비워두세요"></label><p class="sub" style="margin:0 0 10px">가족이 이 번호로 가입하면 원장님께 승인 요청이 와요. 형제는 같은 부모 번호로 등록하면 한 번 가입으로 함께 연결돼요.</p>';
  if(t==='staff')h='<h3>부원장 등록</h3><label class="f"><span>이름</span><input id="sfN" autocomplete="off" placeholder="예: 홍길동"></label><label class="f"><span>휴대폰 (로그인 아이디)</span><input id="sfP" inputmode="numeric" placeholder="010-0000-0000"></label><p class="sub" style="margin:0 0 10px">부원장님이 이 번호로 가입하면 원장님께 승인 요청이 와요. 승인하면 학생 관리·출결·숙제·기록·메시지를 원장님과 똑같이 쓸 수 있어요. (부원장 등록·앱 설정은 원장님만)</p>';
  if(t==='school'){const s=stu(U.schSid)||{};h='<h3>'+esc(s.name||'')+' 학교</h3><label class="f"><span>학교</span><input id="scIn" list="scInL" value="'+esc(s.school||'')+'" placeholder="예: 동탄중" autocomplete="off"><datalist id="scInL">'+schools().map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></label>'}
  if(t==='call'){const s=stu(U.me)||{};const ho=(id,v)=>'<select id="'+id+'">'+CALL_HOURS.map(x=>'<option value="'+x+'"'+(x===v?' selected':'')+'>'+x+'시</option>').join('')+'</select>';h='<h3>'+esc(s.name||'')+' 전화 상담 요청</h3><label class="f"><span>날짜</span><input type="date" id="clD" min="'+TODAY+'" value="'+TODAY+'"></label><div class="f"><span>통화 가능한 시간대 <small class="sub" style="font-weight:400">정각 기준</small></span><div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:center">'+ho('clA',14)+'<span>부터</span>'+ho('clB',17)+'<span>까지</span></div><small class="sub">예: 14시부터 17시 → 14:00~17:00 사이에 통화 가능</small></div><label class="f"><span>상담하고 싶은 내용 (선택)</span><textarea id="clM" maxlength="200" placeholder="예: 기말고사 대비, 진도 상담"></textarea></label><p class="sub" style="margin:0 0 10px">보내면 원장님께 바로 알림이 가요. 원장님이 시간을 정하면 알림으로 알려 드려요.</p>'}
  if(t==='abs'){const s=stu(U.me)||{};h='<h3>'+esc(s.name||'')+' 결석 알리기</h3><label class="f"><span>결석하는 날</span><input type="date" id="abD" min="'+TODAY+'" value="'+TODAY+'"></label><label class="f"><span>사유</span><textarea id="abR" placeholder="예: 가족 행사, 병원 진료, 학교 행사"></textarea></label><p class="sub" style="margin:0 0 10px">저장하면 원장님·부원장님께 바로 알림이 가요. 날짜가 지나기 전에는 취소할 수 있어요.</p>'}
  if(t==='notice'){const own=isOwnerMe();const cats=own?CATS:CATS.filter(c=>c[0]!=='notice');const gs=['초4','초5','초6','중1','중2','중3','고1','고2','고3'].filter(g=>D.students.some(x=>x.grade===g));const q=U.bf||[];
    const ed=U.bEdit&&D.notices.find(n=>n.id===U.bEdit);const qk=ed?(U.bKeep||[]):[];const ql=U.bl||[];h='<h3>'+(ed?'✏️ 소식 수정':'소식 글쓰기')+'</h3><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><label class="f"><span>말머리</span><select id="bCat">'+cats.map(c=>'<option value="'+c[0]+'">'+c[1]+'</option>').join('')+'</select></label><label class="f"><span>보는 사람</span><select id="bTo">'+TO_OPTS.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('')+'</select></label></div>'+
    '<label class="f"><span>날짜 <small class="sub" style="font-weight:400">비워 두면 오늘</small></span><input type="date" id="bD"></label><label class="f"><span>제목</span><input id="nT"></label><label class="f"><span>내용</span><textarea id="nB"></textarea></label>'+
    '<label class="btn ghost" style="display:block;text-align:center;cursor:pointer;margin-bottom:6px">📷 사진·파일 고르기<input type="file" id="bFile" multiple accept="image/*,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" hidden></label><p class="sub" style="margin:0 0 6px">사진은 자동으로 줄여서 올려요 · 파일 하나 50MB까지</p>'+
    (qk.length?'<ul class="bq">'+qk.map((x,i)=>'<li>'+(x.img?'🖼️':'📎')+' <span class="n">'+esc(x.name)+'</span><span class="sub">올린 파일</span><button type="button" class="btn sm ghost" style="padding:2px 8px" data-act="bkDel" data-id="'+i+'">×</button></li>').join('')+'</ul>':'')+
    (q.length?'<ul class="bq">'+q.map((x,i)=>'<li>'+(/^image\//.test(x.type)?'🖼️':'📎')+' <span class="n">'+esc(x.name)+'</span><span class="sub">'+fmtSize(x.size)+'</span><button type="button" class="btn sm ghost" style="padding:2px 8px" data-act="bfDel" data-id="'+i+'">×</button></li>').join('')+'</ul>':'')+
    (ql.length?'<ul class="bq">'+ql.map((x,i)=>'<li>🔗 <span class="n">'+esc(x.name)+'</span><button type="button" class="btn sm ghost" style="padding:2px 8px" data-act="blDel" data-id="'+i+'">×</button></li>').join('')+'</ul>':'')+'<label class="f"><span>구글 드라이브 링크 '+(ql.length?'추가 ':'')+'(선택)</span><input id="bLu" placeholder="큰 파일·동영상은 링크로"></label>'+'<label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="bNoti" checked>🔔 알림 보내기</label>'+(own?'<label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="nP">상단 고정</label>':'')+(U.bBusy?'<p class="sub" style="color:var(--pri);font-weight:700">'+esc(U.bBusy)+'</p>':'');}
  if(t==='log'){
    const f=U.lf;const s=stu(f.sid);const us=unitsOf(f.sid,f.course);
    const chips=(act,val)=>'<div class="pg">'+PCT.map(v=>'<button type="button" data-act="'+act+'" data-v="'+v+'" class="'+(val===v?'on':'')+'">'+v+'</button>').join('')+'</div>';
    const prev=f.unit&&f.unit!=='__x'?lastOf(f.sid,f.course,f.unit):null;
    h='<h3>수업 기록 <small class="sub" style="font-weight:400">'+fmtD(curDay())+'</small></h3>'+
    '<div class="f"><span>학생 <small class="sub" style="font-weight:400">오늘 등원한 학생</small></span><div class="pills" style="margin:0">'+D.students.filter(x=>x.id===f.sid||isIn((D.att[curDay()]||{})[x.id])||D.logs.some(l=>l.sid===x.id&&l.date===curDay())).map(x=>'<button type="button" data-act="lfS" data-v="'+x.id+'" class="'+(x.id===f.sid?'on':'')+'">'+esc(x.name)+'</button>').join('')+'</div></div>'+
    (()=>{const its=f.items||[];const lab=it=>{const u=it.unit==='__x'?(it.ux||'직접 입력'):it.unit==='__none'?'단원 없음':it.unit;return it.subj+(u?' · '+u:'')};return '<div class="f"><span>오늘 한 공부 <small class="sub" style="font-weight:400">단원·과목을 여러 개 기록할 수 있어요</small></span><div class="pills" style="margin:0;flex-wrap:wrap;overflow:visible">'+its.map((it,k)=>'<button type="button" data-act="lfItem" data-v="'+k+'" class="'+(k===(f.idx||0)?'on':'')+'">'+(k+1)+'. '+esc(lab(it))+(its.length>1?' · '+(it.w||0)+'%':'')+'</button>').join('')+'<button type="button" data-act="lfAdd">+ 단원·과목 추가</button></div>'+(its.length>1?'<div style="display:flex;height:10px;border-radius:6px;overflow:hidden;margin-top:8px">'+its.map((it,k)=>'<i style="width:'+(it.w||0)+'%;background:'+['#2b44ff','#f2522e','#0f8f47','#b86e00','#7a3cff'][k%5]+'"></i>').join('')+'</div><div class="sub" style="font-size:12px;margin-top:3px">오늘 수업 비중 합계 '+its.reduce((a,it)=>a+(+it.w||0),0)+'%</div>':'')+(its.length>1?'<button type="button" class="btn sm ghost" style="margin-top:6px" data-act="lfDelItem">'+((f.idx||0)+1)+'번 항목 빼기</button>':'')+'</div>'})()+
    '<div class="f"><span>과목 <small class="sub" style="font-weight:400">'+((f.items||[]).length>1?((f.idx||0)+1)+'번 항목의 과목':'오늘 수업한 과목')+'</small></span><div class="pills" style="margin:0">'+SUBJS.map(x=>'<button type="button" data-act="lfSj" data-v="'+x+'" class="'+(x===f.subj?'on':'')+'">'+x+'</button>').join('')+'</div></div>'+
    (f.subj===ACT?'':'<label class="f"><span>① 진도 과정 <small class="sub" style="font-weight:400">'+esc(s.grade)+' 학생</small></span><select id="lfCourse">'+GROUPS[f.subj].map(([g,cs])=>'<optgroup label="'+g+'">'+cs.map(c=>'<option'+(c===f.course?' selected':'')+'>'+c+'</option>').join('')+'</optgroup>').join('')+'</select></label>')+
    '<div class="f"><span>'+(f.subj===ACT?'오늘 한 활동':'② 단원')+'</span><div class="ck">'+us.map(u=>{const l=lastOf(f.sid,f.course,u);return '<button type="button" class="uc'+(f.unit===u?' on':'')+'" data-act="lfU" data-v="'+esc(u)+'">'+(l?'• ':'')+esc(u)+'</button>'}).join('')+'<button type="button" class="uc'+(f.unit==='__x'?' on':'')+'" data-act="lfU" data-v="__x">+ 직접 입력</button><button type="button" class="uc'+(f.unit==='__none'?' on':'')+'" data-act="lfU" data-v="__none">단원 없이 (메모 필수)</button></div>'+(f.unit==='__none'?'<p class="sub" style="margin:6px 0 0;color:var(--acc)">시험 대비처럼 여러 단원을 풀었다면 아래 메모에 오늘 한 내용을 꼭 적어 주세요.</p>':'')+(f.unit==='__x'?'<input id="lfUx" style="margin-top:8px" placeholder="단원명 입력" value="'+esc(f.ux||'')+'">':'')+'</div>'+
    ((f.items||[]).length>1?'<div class="f"><span>③ 오늘 전체 수업 중 이 항목 비중 <small class="sub" style="font-weight:400">모든 항목 합 100%</small></span>'+'<div class="pg">'+[10,20,30,40,50,60,70,80,90].map(v=>'<button type="button" data-act="lfW" data-v="'+v+'" class="'+(f.w===v?'on':'')+'">'+v+'</button>').join('')+'</div></div>':'')+
    (f.unit&&f.subj!==ACT?'<div class="f"><span>'+((f.items||[]).length>1?'④':'③')+' 개념·문제풀이 비중 <small class="sub" style="font-weight:400">개념을 고르면 문제풀이는 자동</small></span>'+chips('lfC',f.c)+(f.c!=null?'<div style="margin-top:8px">'+splitBar(f.c)+'</div>':'')+'</div>':f.subj===ACT?'':'<p class="sub" style="margin:0 0 12px">단원을 고르면 오늘 개념·문제풀이 비중을 고를 수 있어요.</p>')+
    (f.showCm?'<label class="f"><span>특별 메모 '+((f.items||[]).some(it=>it.unit==='__none')?'<b style="color:var(--acc)">(필수)</b>':'(선택)')+'</span><textarea id="lgM" placeholder="결석 보충, 컨디션, 시험 대비 등 (단원 없이 기록하면 필수)">'+esc(f.cm||'')+'</textarea></label>':'<button type="button" class="btn sm ghost" style="margin-bottom:12px" data-act="lfCm">+ 특별한 일이 있으면 메모 추가</button>')+
    '<label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="lgSh" '+(f.sh?'checked':'')+'>학부모·학생에게 공유</label>';
  }
  return '<div class="sheetbg" data-act="close"><form class="sheet" id="sheetF">'+h+'<div class="acts"><button type="button" class="btn ghost" data-act="close">취소</button><button class="btn" type="submit">저장</button></div></form></div>';
}


const app=document.getElementById('app');
// 입력 중 표시: 학부모 대화는 형제가 있으면 각 형제 방 이름으로도 같이 써요 (원장님 화면은 첫째 기준 방을 보기 때문)
const TY=createTyping({db,doc,setDoc,onSnapshot,myF:()=>U.role==='teacher'?'t':'o',writeKeys:k=>{const [sid,r]=k.split('|');return r==='student'?[k]:famSids(sid).map(x=>x+'|'+r).filter(x=>U.role==='teacher'||(ME&&ME.ths||[]).includes(x))}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='msgIn'){if(e.target.value.trim())TY.ping();else TY.stop()}});
document.addEventListener('focusout',e=>{if(e.target&&e.target.id==='msgIn')setTimeout(()=>{const x=document.activeElement;if(!x||x.id!=='msgIn')TY.stop()},300)});
/* ================= 상태 ================= */
const D={apply:[],sinfo:{},students:[],att:{},threads:{},hw:[],logs:[],notices:[],req:[],members:[],exams:[],staff:[],abs:[],fin:{},extra:{},autoNotify:true,cfg:null};
const ME={uid:null,phone:'',sids:[],rels:{},ths:[]};
const U={screen:'loading',authMsg:'',authTab:'login',busy:false,wait:[],update:null,
  calM:TODAY.slice(0,7),calS:'all',calD:TODAY,page:null,pc:{},lf:null,pushX:{},
  role:'teacher',me:null,tab:'home',chat:null,sheet:null,comm:'msg',hwF:'all',logS:null,attDate:TODAY,toast:''};
const TNAME=()=>U.isStaff&&U.staffDoc&&U.staffDoc.name?U.staffDoc.name+' 부원장님':((D.cfg&&D.cfg.teacher)?D.cfg.teacher+' 원장님':'원장님');
const docs=s=>s.docs.map(d=>({id:d.id,...d.data()}));
const now=()=>Date.now();
const phoneOf=u=>(u&&u.email||'').split('@')[0];
// 카카오톡 → 사파리로 넘어온 경우(?inst=1): 안내를 바로 띄우고 주소에서 표시는 지워요(홈 화면 아이콘 주소가 깨끗하게)
if(/[?&]inst=1/.test(location.search)){U.iosGuide=true;try{history.replaceState(null,'',location.pathname+location.search.replace(/[?&]inst=1/,'').replace(/^&/,'?')+location.hash)}catch(e){}}
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

/* ================= 화면 그리기 ================= */
function header(title,sub,back){
  const sel=(U.role!=='teacher'&&ME.sids.length>1)?'<div class="who-seg" role="tablist" aria-label="자녀 선택">'+[...ME.sids].sort((a,b)=>((stu(a)||{}).name||'').localeCompare((stu(b)||{}).name||'','ko')).map(id=>{const s=stu(id);return '<button data-act="who" data-id="'+esc(id)+'" class="'+(id===U.me?'on':'')+'">'+esc(s?s.name:'...')+'</button>'}).join('')+'</div>':'';
  return '<div class="hdr"><div class="sb"><span>더밀착수학</span><button class="lo" data-act="logout">로그아웃</button></div>'+(back?'<button class="back" data-act="back">‹ 뒤로</button>':'')+(U.role==='teacher'?'<div class="h2row"><h2>'+esc(title)+'</h2><a class="adm" href="./admin.html">관리자 페이지 ›</a></div>':'<h2>'+esc(title)+'</h2>')+(sub?'<div class="who">'+esc(sub)+'</div>':'')+sel+'</div>';
}
function authHeader(t,s){return '<div class="hdr"><div class="sb"><span>더밀착수학</span><span>v'+APP_VERSION+'</span></div><h2>'+esc(t)+'</h2>'+(s?'<div class="who">'+esc(s)+'</div>':'')+'</div>'}
const isSamsung=()=>/SamsungBrowser/i.test(navigator.userAgent);
const CHROME_URL='intent://themilchak-math.github.io/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.android.chrome;end';
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const shareIco='<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
function installSteps(){
  if(isIOS()){const chrome=/CriOS/i.test(navigator.userAgent);return '<ol class="ist"><li>'+(chrome?'오른쪽 위 공유 버튼 '+shareIco+' 누르기':'화면 아래 가운데 공유 버튼 '+shareIco+' 누르기')+'</li><li>목록을 조금 올려서 <b>홈 화면에 추가</b> 누르기</li><li>오른쪽 위 <b>추가</b> 누르기</li></ol>'}
  const sam='<ol class="ist"><li>화면 오른쪽 아래 <b>메뉴(≡)</b> 누르기</li><li><b>현재 페이지 추가</b> 누르기</li><li><b>홈 화면</b> 선택 → <b>추가</b> 누르기</li></ol><p class="sub" style="margin:6px 0 0">주소창에 <b>설치(⬇) 아이콘</b>이 보이면 그걸 눌러도 돼요.</p>';
  const chr='<ol class="ist"><li>오른쪽 위 <b>⋮</b> 누르기</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b> 누르기</li></ol>';
  if(isSamsung())return '<p style="margin:0 0 8px"><b>갤럭시는 크롬으로 설치해 주세요.</b> 삼성 인터넷으로 설치하면 알림이 오지 않아요.</p><a class="btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="'+CHROME_URL+'">크롬에서 열기</a><p class="sub" style="margin:8px 0 0">크롬이 열리면 오른쪽 위 <b>⋮ → 홈 화면에 추가 → 설치</b>. 삼성 인터넷으로 만든 아이콘은 지워 주세요.</p>';
  if(/Chrome/i.test(navigator.userAgent))return chr;
  return '<p style="margin:0 0 4px;font-weight:700">삼성 인터넷</p>'+sam+'<p style="margin:10px 0 4px;font-weight:700">크롬</p>'+chr;
}
const installTip=()=>isStandalone()?'':'<div class="card" style="border-color:var(--pri)"><h3>홈 화면에 앱 설치하기</h3>'+(isIOS()?'<button class="btn" style="width:100%" data-act="iosG">홈 화면에 추가하기</button>':U.bip?'<button class="btn" style="width:100%" data-act="install">앱 설치하기 (한 번만 누르면 돼요)</button>':installSteps())+'</div>';
function installBar(){if(isStandalone()||U.noInstall)return '';return '<div class="upd ib"><span>홈 화면에 앱으로 설치할 수 있어요</span><span style="display:flex;gap:6px"><button class="btn sm" data-act="'+(U.bip?'install':isIOS()?'iosG':'instHow')+'">설치</button><button class="btn sm ghost" data-act="instX" aria-label="닫기">✕</button></span></div>'}
// 아이폰: '홈 화면에 추가'는 사파리 메뉴에서만 가능(애플 제한) → 공유 창 바로 열기 + 화살표 안내
function iosGuide(){const chrome=/CriOS/i.test(navigator.userAgent),other=/FxiOS|NAVER|KAKAOTALK|Instagram|FBAN|DaumApps/i.test(navigator.userAgent);
  const arrow='<svg viewBox="0 0 24 24" width="54" height="54" style="fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><path d="M12 3v16M5 12l7 7 7-7"/></svg>';
  // 사파리 아래 막대 모양 그림: ≡(또는 ⋯)를 빨간 원으로 표시
  const bar='<div class="iosbar"><span class="ib1">‹</span><span class="ib2"><span class="hit">≡</span><span style="flex:1;opacity:.6">themilchak-math…</span><span>↻</span></span><span class="ib1">⧉</span></div>';
  const step=(n,t)=>'<div class="iostep"><b class="no">'+n+'</b><div>'+t+'</div></div>';
  return '<div class="iosg"><div class="iosc"><h3 style="margin:0 0 4px">홈 화면에 앱 추가하기</h3><p class="sub" style="margin:0 0 12px">아이폰은 사파리 메뉴에서 직접 추가해야 해요 (애플 정책). 30초면 끝나요.</p>'+
  (other?'<p style="margin:0 0 12px;padding:10px;border-radius:12px;background:var(--soft)">지금은 사파리가 아니에요. 오른쪽 아래 <b>⋯</b> 또는 <b>나침반</b> 버튼을 눌러 <b>Safari로 열기</b>를 먼저 해 주세요.</p>':'')+
  (chrome?step(1,'오른쪽 위 공유 '+shareIco+' 누르기'):step(1,'화면 <b>맨 아래</b> 주소창 왼쪽 <b>≡</b> 누르기<br><span class="sub">≡ 대신 <b>⋯</b>나 공유 '+shareIco+'가 보이면 그걸 누르세요</span>'+bar))+
  step(2,(chrome?'':'<b>공유</b> '+shareIco+' 누르기 → ')+'목록을 위로 올려 <b>홈 화면에 추가</b>')+
  step(3,'오른쪽 위 <b>추가</b> → 홈 화면에 생긴 <b>밀착</b> 아이콘으로 열기')+
  '<button class="btn ghost" style="width:100%;margin-top:6px" data-act="iosX">확인했어요</button></div>'+(chrome||other?'':'<div class="iosa">'+arrow+'</div>')+'</div>'}
function instSheet(){return '<div class="sheetbg" data-act="close"><div class="sheet"><h3>홈 화면에 앱 설치하기</h3>'+installSteps()+'<p class="sub">설치하면 앱처럼 바로 열리고 로그인도 유지돼요.</p><button type="button" class="btn ghost" style="width:100%" data-act="close">닫기</button></div></div>'}
const msgBox=()=>U.authMsg?'<div class="card" style="border-color:var(--acc)"><p style="margin:0;color:var(--acc);font-weight:700">'+esc(U.authMsg)+'</p></div>':'';

function authView(){
  const t=U.authTab;
  if(t==='setup')return authHeader('원장님 처음 설정','이 화면은 처음 한 번만 사용해요')+'<div class="body">'+msgBox()+
    '<form id="setupF" class="card"><label class="f"><span>원장님 이름</span><input id="sN" placeholder="예: 김동진" autocomplete="name"></label><label class="f"><span>원장님 휴대폰번호 (로그인 아이디)</span><input id="sP" inputmode="numeric" placeholder="010-0000-0000" autocomplete="tel"></label><label class="f"><span>비밀번호 (6자리 이상)</span><input id="sW" type="password" autocomplete="new-password"></label><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>원장님 계정 만들기</button></form>'+
    '<button class="btn ghost" style="width:100%" data-act="authTab" data-v="login">로그인 화면으로</button></div>';
  if(t==='reset')return authHeader('비밀번호 다시 만들기','가입한 휴대폰으로 문자 인증 후 새 비밀번호를 정해요')+'<div class="body">'+msgBox()+
    '<form id="rsF" class="card"><label class="f"><span>휴대폰번호</span><input id="rsP" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000"'+(U.rsConf?' disabled':'')+' value="'+esc(U.rsPhone?fmtP(U.rsPhone):'')+'"></label>'+
    (U.rsConf?'<label class="f"><span>문자로 온 인증번호 6자리</span><input id="rsC" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label><label class="f"><span>새 비밀번호 (6자리 이상)</span><input id="rsW" type="password" autocomplete="new-password"></label><label class="f"><span>새 비밀번호 확인</span><input id="rsW2" type="password" autocomplete="new-password"></label><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>비밀번호 바꾸고 로그인</button><p style="text-align:center;margin:10px 0 0"><button type="button" class="lnk" data-act="rsAgain">인증번호 다시 받기</button></p>'
      :'<button class="btn" style="width:100%" type="button" data-act="rsSend"'+(U.busy?' disabled':'')+'>인증번호 받기</button>')+'</form>'+
    '<div class="card"><p class="sub" style="margin:0">문자 인증을 한 번도 안 한 예전 계정은 이 방법으로 바꿀 수 없어요. 그때는 원장님께 말씀해 주세요.</p></div>'+
    '<button class="btn ghost" style="width:100%" data-act="authTab" data-v="login">로그인 화면으로</button></div>';
  if(t==='signup')return authHeader('가입하기','원장님께 등록된 휴대폰번호로 가입해요')+'<div class="body">'+msgBox()+
    '<form id="signupF" class="card"><label class="f"><span>휴대폰번호</span><input id="jP" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000"></label><label class="f"><span>비밀번호 (6자리 이상)</span><input id="jW" type="password" autocomplete="new-password"></label><label class="f"><span>비밀번호 확인</span><input id="jW2" type="password" autocomplete="new-password"></label><label class="sw" style="justify-content:flex-start;gap:8px;color:var(--ink)"><input type="checkbox" id="jA">[필수] 개인정보 수집·이용에 동의합니다</label><details class="sub" style="margin:-4px 0 14px"><summary>동의 내용 보기</summary>수집 항목: 이름, 휴대폰번호, 출결·숙제·학습 기록, 메시지 · 목적: 수업 관리와 학부모 안내 · 보관: 퇴원 후 1년까지 보관 뒤 삭제 · 동의하지 않을 수 있으나 앱을 이용할 수 없어요. <a href="./privacy.html" target="_blank" style="color:var(--pri)">처리방침 전문 보기</a></details><p class="sub" style="margin:0 0 12px">가입하기를 누르면 다음 화면에서 이 번호로 <b>문자 인증번호</b>를 보내요.</p><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>가입하기</button></form>'+
    '<button class="btn ghost" style="width:100%" data-act="authTab" data-v="login">이미 가입했어요 · 로그인</button>'+installTip()+'</div>';
  return authHeader('더밀착수학','학생·학부모·선생님 로그인')+'<div class="body">'+msgBox()+
    installTip()+'<form id="loginF" class="card"><label class="f"><span>휴대폰번호</span><input id="lP" inputmode="numeric" autocomplete="username" placeholder="010-0000-0000"></label><label class="f"><span>비밀번호</span><input id="lW" type="password" autocomplete="current-password"></label><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>로그인</button></form>'+
    '<button class="btn ghost" style="width:100%;margin-bottom:12px" data-act="authTab" data-v="signup">처음이에요 · 가입하기</button>'+
    '<p style="text-align:center;margin:0 0 12px"><button class="lnk" data-act="authTab" data-v="reset">비밀번호를 잊었어요</button></p>'+
    (/[?&]setup=1/.test(location.search)?'<p style="text-align:center"><button class="lnk" data-act="authTab" data-v="setup">원장님 처음 설정</button></p>':'')+'<p style="text-align:center;margin:0"><a class="sub" href="./privacy.html" target="_blank">개인정보 처리방침</a></p></div>';
}
function waitView(){
  const outCard='<div class="card"><p class="sub" style="margin:0 0 10px">번호를 잘못 넣으셨으면 로그아웃 후 다시 가입해 주세요.</p><button class="btn ghost" style="width:100%" data-act="logout">로그아웃</button></div>';
  if((!U.wait||!U.wait.length)&&!phoneOk())return authHeader('휴대폰 문자 인증',fmtP(ME.phone||''))+'<div class="body">'+(U.smsErr?'<div class="card" style="border-color:var(--acc)"><p style="margin:0;color:var(--acc);font-weight:700">'+esc(U.smsErr)+'</p></div>':'')+
    '<div class="card"><p class="sub" style="margin:0 0 10px">본인 확인을 위해 <b>'+esc(fmtP(ME.phone||''))+'</b>로 인증번호 6자리를 보내요. 구글에서 보내는 문자라 <b>[국제발신]</b>으로 올 수 있어요.</p>'+
    '<button class="btn" style="width:100%" data-act="smsSend"'+(U.smsBusy?' disabled':'')+'>'+(U.smsBusy?'보내는 중…':U.smsConf?'인증번호 다시 받기':'인증번호 받기')+'</button>'+
    (U.smsConf?'<form id="smsF" style="margin-top:12px"><label class="f"><span>인증번호 6자리</span><input id="smsC" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="문자로 받은 숫자"></label><button class="btn" style="width:100%" type="submit"'+(U.smsBusy?' disabled':'')+'>확인</button></form>':'')+
    '</div><div class="card"><p class="sub" style="margin:0">문자가 안 오면 스팸 문자함도 확인해 주세요. 계속 안 오면 원장님께 말씀해 주세요.</p></div>'+outCard+'</div>';
  if(!U.wait||!U.wait.length)return authHeader('등록된 번호를 찾지 못했어요',fmtP(ME.phone||''))+'<div class="body"><div class="card"><p style="margin:0">이 번호는 아직 원장님께 등록되지 않았어요. 원장님께 번호 등록을 요청한 뒤 앱을 다시 열어 주세요.</p></div>'+outCard+'</div>';
  const rows=U.wait.map(m=>{const nm=(m.name||'')+' '+REL[m.rel];
    const st=m.st==='pending'?'<span class="chip c-warn">원장님 승인 대기</span>':m.st==='block'?'<span class="chip c-bad">이용 제한</span>':m.st==='ok'?'<span class="chip c-ok">연결됨</span>':'<button class="btn sm" data-act="reclaim">다시 요청</button>';
    return '<div class="row"><div class="grow nm">'+esc(nm)+'</div>'+st+'</div>'}).join('');
  const needG=false; // 14세 미만 부모님 먼저 가입 조건 해제 (원장님 요청)
  return authHeader('번호가 확인됐어요',U.wait.some(m=>m.st==='pending')?'원장님 확인 후 이용할 수 있어요':'연결하고 있어요…')+'<div class="body"><div class="card"><h3>'+esc(fmtP(ME.phone))+'</h3>'+(rows||'<div class="empty">확인 중...</div>')+'</div>'+
    (needG?'<div class="card"><p style="margin:0" class="sub">만 14세 미만일 수 있어 부모님이 먼저 가입해 승인받으셔야 학생 가입이 열려요. 부모님 승인 뒤 <b>다시 요청</b>을 눌러 주세요.</p></div>':'')+
    (U.wait.some(m=>m.st==='pending')?'<div class="card"><p class="sub" style="margin:0">이 화면을 닫아도 괜찮아요. 확인되면 다음에 열 때 바로 들어가져요.</p></div>':'')+installTip()+
    '<button class="btn ghost" style="width:100%" data-act="logout">로그아웃</button></div>';
}


function pushBanner(){
  const m0=mPending().find(x=>!U.pushX[x.id]);const q=pending().find(x=>!U.pushX[x.id]);
  const box=(id,txt,ok,rej)=>'<div class="push'+(U.lastPush!==id?' anim':'')+'" role="alert"><div class="pt"><span class="pi">더</span><b>더밀착수학</b><span class="sub" style="margin-left:auto">지금</span></div><div style="margin:4px 0 10px">'+txt+'</div><div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="pushX" data-id="'+id+'">나중에</button><button class="btn sm ghost" data-act="'+rej+'" data-id="'+id+'">거절</button><button class="btn sm" style="flex:1" data-act="'+ok+'" data-id="'+id+'">승인</button></div></div>';
  let h='';
  if(q){const st=stu(q.sid)||{name:'?'};h=box(q.id,'<b>'+esc(st.name)+'</b> 학생이 등원 QR을 찍었어요 ('+esc(q.at)+'). 승인할까요?','ok','rej');U.lastPush=q.id}
  else if(m0){h=box(m0.id,'<b>'+esc(mLabel(m0))+'</b>('+esc(maskP(m0.phone))+') 가입 요청이에요. 등록된 번호와 일치해요. 승인할까요?','mOk','mRej');U.lastPush=m0.id}
  return h;
}

function updBar(){return U.update?'<div class="upd"><span>새 버전이 있어요</span><button class="btn sm" data-act="doUpdate">업데이트</button></div>':''}

function appView(){
  if(U.role!=='teacher'&&!stu(U.me))return header('불러오는 중','')+'<div class="body"><div class="empty">잠시만요...</div></div>';
  if(U.chat)return chatView();
  if((U.page==='mng'||U.page==='exam')&&!isOwnerMe())U.page=null;
  if(U.page==='mng')return mngView();
  if(U.page==='exam')return examView();
  const map={teacher:{home:tHome,att:tAtt,hw:tHw,log:tLog,comm:tComm},student:{home:sHome,hw:sHw,log:myLog,comm:oComm},parent:{home:pHome,att:pAtt,hw:pHw,log:myLog,comm:oComm}}[U.role];
  return (map[U.tab]||map.home)()+'<nav class="tabs">'+tabsFor()+'</nav>';
}

let dirty=false;
function render(){
  document.documentElement.classList.toggle('chat-open',!!U.chat);
  // 입력 중인 값 보존
  const keep={},checks={};let focusId=null,selS=null,selE=null;
  app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el=>{if(el.type==='checkbox')keep[el.id]={c:el.checked};else keep[el.id]={v:el.value}});
  app.querySelectorAll('input[name=hwS]').forEach(el=>checks[el.value]=el.checked);
  const ae=document.activeElement;if(ae&&ae.id&&app.contains(ae)){focusId=ae.id;try{selS=ae.selectionStart;selE=ae.selectionEnd}catch(e){}}
  const bodyEl=app.querySelector('.body');const scroll=bodyEl?bodyEl.scrollTop:0;
  let html;
  try{
    if(U.screen==='loading')html=authHeader('더밀착수학','불러오는 중...')+'<div class="body"><div class="empty">잠시만요...</div></div>';
    else if(U.screen==='auth')html=authView();
    else if(U.screen==='wait')html=waitView();
    else if(U.screen==='staffWait')html=staffWaitView();
    else{
      html=appView();
      const pb=U.role==='teacher'&&!U.sheet&&!(U.tab==='home'&&!U.chat)?pushBanner():'';html+=pb;
      if(U.sheet==='inst')html+=instSheet();else if(U.sheet)html+=sheetHtml();
      if(!U.sheet&&!U.chat&&!U.update&&!pb)html+=installBar();
    }
  }catch(err){console.error(err);html=authHeader('잠시 문제가 생겼어요','')+'<div class="body"><div class="card"><p>화면을 그리다 오류가 났어요. 새로고침해 주세요.</p><p class="sub">'+esc(err.message)+'</p><button class="btn" data-act="reload">새로고침</button></div></div>'}
  html+=updBar();
  if(U.iosGuide&&isIOS()&&!isStandalone())html+=iosGuide();
  if(U.toast)html+='<div class="toast" role="status">'+esc(U.toast)+'</div>';
  const sameView=app.dataset.v===(U.screen+U.tab+U.chat+U.page+U.role+U.me);
  app.innerHTML=html;app.dataset.v=U.screen+U.tab+U.chat+U.page+U.role+U.me;
  Object.entries(keep).forEach(([id,k])=>{const el=document.getElementById(id);if(!el)return;if('c' in k){if(el.type==='checkbox'&&id!=='autoN'&&id!=='lgSh')el.checked=k.c}else if((el.tagName!=='SELECT'||id==='bCat'||id==='bTo')&&id!=='attDate')el.value=k.v});
  app.querySelectorAll('input[name=hwS]').forEach(el=>{if(el.value in checks)el.checked=checks[el.value]});
  if(focusId){const el=document.getElementById(focusId);if(el){el.focus();try{if(selS!=null)el.setSelectionRange(selS,selE)}catch(e){}}}
  TY.sync(U.chat||null);
  app.classList.toggle('bar-on',!!app.querySelector('.upd,.push'));
  const nb=app.querySelector('.body');
  if(U.chat){const b=document.getElementById('chatBody');if(b)b.scrollTop=b.scrollHeight}
  else if(nb&&sameView)nb.scrollTop=scroll;
  dirty=false;
}
let rT=null;const sr=()=>{if(rT)return;rT=requestAnimationFrame(()=>{rT=null;render()})};
let tt;
const toast=m=>{U.toast=m;clearTimeout(tt);tt=setTimeout(()=>{U.toast='';render()},2800);render()};
const fail=(e,m)=>{console.error(e);toast(m||('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'))};

/* ================= 데이터 구독 ================= */
let baseUnsubs=[],dataUnsubs=[];
const stopData=()=>{dataUnsubs.forEach(f=>f());dataUnsubs=[]};
const stopAll=()=>{stopData();baseUnsubs.forEach(f=>f());baseUnsubs=[]};
const L=(q,fn)=>dataUnsubs.push(onSnapshot(q,fn,e=>console.warn('구독 오류',e.code)));
const B=(q,fn)=>baseUnsubs.push(onSnapshot(q,fn,e=>console.warn('구독 오류',e.code)));
const sortMsgs=l=>l.sort((a,b)=>(a.ts||0)-(b.ts||0));
const sortStu=()=>D.students.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
function resetD(){Object.assign(D,{sched:{},calls:[],students:[],att:{},threads:{},hw:[],logs:[],notices:[],req:[],members:[],exams:[],staff:[],abs:[],fin:{},extra:{}})}

let schedT=null;const schedSoon=()=>{clearTimeout(schedT);schedT=setTimeout(()=>syncSched(db,{students:D.students,fin:isOwnerMe()?D.fin:null,extra:D.extra,sched:D.sched,owner:isOwnerMe()&&!!U.finLoaded,today:TODAY}),1500)};
function subTeacher(){
  resetD();
  L(collection(db,'students'),s=>{D.students=docs(s).filter(x=>!x.left);sortStu();if(!stu(U.logS))U.logS=D.students[0]?D.students[0].id:null;sr()});
  L(query(collection(db,'att'),where('date','>=',off(-200))),s=>{D.att={};docs(s).forEach(x=>{(D.att[x.date]||(D.att[x.date]={}))[x.sid]=x});sr()});
  L(query(collection(db,'msgs'),where('ts','>=',now()-150*864e5)),s=>{D.threads={};docs(s).forEach(m=>(D.threads[m.th]||(D.threads[m.th]=[])).push(m));Object.values(D.threads).forEach(sortMsgs);if(U.chat)markRead(U.chat);sr()});
  L(collection(db,'hw'),s=>{D.hw=docs(s);sr()});
  L(collection(db,'logs'),s=>{D.logs=docs(s);sr()});
  L(collection(db,'notices'),s=>{D.notices=docs(s);sr()});
  L(query(collection(db,'reqs'),where('st','==','pending')),s=>{D.req=docs(s).filter(q=>q.date===TODAY);sr()});
  L(collection(db,'members'),s=>{D.members=docs(s);sr()});
  L(collection(db,'exams'),s=>{D.exams=docs(s);sr()});
  L(collection(db,'staff'),s=>{D.staff=docs(s);sr()});
  L(query(collection(db,'abs'),where('date','>=',off(-60))),s=>{D.abs=docs(s);sr()});
  L(query(collection(db,'calls'),where('st','in',['new','ok'])),s=>{D.calls=docs(s);sr()});
  L(doc(db,'config','hid'),d=>{D.hid=d.exists()?d.data():{};sr()});
  setTimeout(()=>syncTeacherSubs(db,auth),4000);
  D.sched=null;L(collection(db,'sched'),s=>{D.sched=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));schedSoon()});
  L(query(collection(db,'extra'),where('date','>=',off(-60))),s=>{D.extra={};s.docs.forEach(d=>{D.extra[d.id]=d.data()});schedSoon();sr()});
  if(isOwnerMe())L(collection(db,'apply'),s=>{D.apply=docs(s).filter(x=>x.st==='new');sr()});
  if(isOwnerMe())L(collection(db,'sinfo'),s=>{D.sinfo={};s.docs.forEach(d=>{D.sinfo[d.id]=d.data()});sr()});
  if(isOwnerMe())L(collection(db,'fin'),s=>{D.fin={};s.docs.forEach(d=>{if(d.id.startsWith('m_'))D.fin[d.id.slice(2)]=d.data()});U.finLoaded=true;schedSoon();sr()});
}
function subFamily(){
  resetD();const attBy={};
  const rebuildAtt=()=>{D.att={};Object.values(attBy).flat().forEach(x=>{(D.att[x.date]||(D.att[x.date]={}))[x.sid]=x})};
  ME.sids.forEach(sid=>{
    L(doc(db,'students',sid),d=>{D.students=D.students.filter(x=>x.id!==sid);if(d.exists())D.students.push({id:d.id,...d.data()});sortStu();sr()});
    L(query(collection(db,'att'),where('sid','==',sid)),s=>{attBy[sid]=docs(s);rebuildAtt();U.attReady=true;sr();setTimeout(autoCheckin,300)});
    L(query(collection(db,'hw'),where('sid','==',sid)),s=>{D.hw=D.hw.filter(h=>h.sid!==sid).concat(docs(s));sr()});
    L(query(collection(db,'logs'),where('sid','==',sid),where('sh','==',true)),s=>{D.logs=D.logs.filter(h=>h.sid!==sid).concat(docs(s));sr()});
    L(query(collection(db,'abs'),where('sid','==',sid)),s=>{D.abs=D.abs.filter(x=>x.sid!==sid).concat(docs(s));sr()});
    L(doc(db,'sched',sid),d=>{D.sched=D.sched||{};D.sched[sid]=d.exists()?d.data():null;sr()});
    L(query(collection(db,'reqs'),where('sid','==',sid),where('st','==','pending')),s=>{D.req=D.req.filter(h=>h.sid!==sid).concat(docs(s).filter(q=>q.date===TODAY));sr()});
  });
  ME.ths.forEach(th=>L(query(collection(db,'msgs'),where('th','==',th)),s=>{D.threads[th]=sortMsgs(docs(s));if(U.chat===th)markRead(th);sr()}));
  L(collection(db,'notices'),s=>{D.notices=docs(s);sr()});
  L(collection(db,'exams'),s=>{D.exams=docs(s);sr()});
  L(query(collection(db,'calls'),where('uid','==',ME.uid)),s=>{D.calls=docs(s);sr()});
}
function famRole(){U.role=ME.rels[U.me]==='student'?'student':'parent'}

/* ================= 로그인 흐름 ================= */
document.addEventListener('click',e=>{const im=e.target.closest&&e.target.closest('[data-lb]');if(im){e.stopPropagation();lightbox(im.dataset.lb,(im.dataset.g||'').split(',').filter(Boolean))}},true);
setInterval(()=>{if(auth.currentUser)freshToken(auth,true).then(render).catch(()=>{})},40*60e3);
onAuthStateChanged(auth,user=>{
  if(U.resetting)return; // 비밀번호 찾기 중: 확인이 끝날 때까지 화면 전환 안 함
  if(user)freshToken(auth).then(render).catch(()=>{});
  stopAll();U.attReady=false;U.wifiState=null;U.staffSub=false;U.isStaff=false;U.staffDoc=null;U.famStarted=false;U.famSig=null;U.claimed=false;U.comm='msg';U.hwF='all';U.calS='all';U.pushX={};U.me=null;U.logS=null;U.ret=null;U.lf=null;ME.uid=null;U.sheet=null;U.chat=null;U.page=null;U.tab='home';
  if(!user){U.screen='auth';render();return}
  ME.uid=user.uid;ME.phone=phoneOf(user);U.screen='loading';render();
  B(doc(db,'config','main'),d=>{
    D.cfg=d.exists()?d.data():null;D.autoNotify=D.cfg?D.cfg.autoNotify!==false:true;
    if(!D.cfg){if(U.pendingSetup)return;U.screen='auth';U.authMsg='아직 원장님 설정이 안 된 앱이에요.';render();return}
    if(D.cfg.owner===ME.uid){if(U.role!=='teacher'||U.screen!=='app'){U.role='teacher';U.screen='app';stopData();subTeacher();autoPush();announceUpdate(db,auth)}sr();return}
    checkStaff();
    sr();
  });
});
function checkStaff(){
  if(U.staffSub)return;U.staffSub=true;
  const goFam=()=>{if(!U.famStarted){U.famStarted=true;startFamily()}};
  baseUnsubs.push(onSnapshot(doc(db,'staff',ME.phone),async d=>{
    const sd=d.exists()?d.data():null;U.staffDoc=sd;
    if(sd&&sd.st==='ok'&&sd.uid===ME.uid){U.isStaff=true;if(U.role!=='teacher'||U.screen!=='app'){U.role='teacher';U.screen='app';stopData();subTeacher();autoPush()}sr();return}
    if(U.isStaff){U.isStaff=false;U.authMsg='부원장 권한이 해제됐어요. 원장님께 문의해 주세요.';U.authTab='login';await signOut(auth);return}
    if(sd&&sd.st==='none'&&!phoneOk()){U.wait=[];U.screen='wait';sr();return}
    if(sd&&(sd.st==='none'||(sd.st==='pending'&&sd.uid===ME.uid))){
      if(phoneOk()&&!U.staffTry){U.staffTry=true;try{await updateDoc(doc(db,'staff',ME.phone),{st:'ok',uid:ME.uid,at:stamp()});push(['teacher'],'[부원장 가입 완료] '+(sd.name||'')+' 부원장님이 앱에 가입했어요.',{tag:'join'});return}catch(e){console.warn('staff self',e.code||e)}}
      if(sd.st==='none'){try{await updateDoc(doc(db,'staff',ME.phone),{st:'pending',uid:ME.uid,at:stamp()});push(['teacher'],'[부원장 가입 요청] '+(sd.name||'')+' 부원장님 가입을 승인해 주세요.',{tag:'join'})}catch(e){console.warn(e)}}
      U.screen='staffWait';sr();return}
    goFam();sr();
  },e=>{console.warn('staff',e.code);goFam();sr()}));
}
function startFamily(){
  B(doc(db,'users',ME.uid),d=>{
    const p=d.exists()?d.data():{};const sids=p.sids||[];
    const sig=JSON.stringify([sids,p.ths||[]]);
    if(sids.length){
      if(sig!==U.famSig){U.famSig=sig;ME.sids=sids;ME.rels=p.rels||{};ME.ths=p.ths||[];if(!sids.includes(U.me))U.me=sids[0];famRole();U.screen='app';stopData();subFamily();autoPush()}
      sr();
    }else{U.famSig=null;ME.sids=[];stopData();U.screen='wait';watchMembers()}
  });
}
let memUnsub=null;
function watchMembers(){
  if(memUnsub)return;
  // 문자 인증을 마친 번호만 아직 가입 안 한 등록을 보고 가입 신청할 수 있어요. 인증 전이면 이미 신청한 등록만 보여요
  const ok=phoneOk();
  memUnsub=onSnapshot(ok?query(collection(db,'members'),where('phone','==',ME.phone)):query(collection(db,'members'),where('phone','==',ME.phone),where('st','in',['pending','ok','block'])),async s=>{
    const ms=docs(s);U.wait=ms;
    if(ok&&ms.some(m=>m.st==='none'||(m.st==='pending'&&m.uid===ME.uid))&&!U.claimed){U.claimed=true;await claim(ms)}
    sr();
  },e=>console.warn(e));
  baseUnsubs.push(()=>{if(memUnsub){memUnsub();memUnsub=null}});
}
// 문자 인증: 로그인한 계정에 이 번호를 연결해요 (구글이 보내는 인증 문자)
const phoneOk=()=>{const u=auth.currentUser;return !!(u&&ME.phone&&u.phoneNumber==='+82'+ME.phone.slice(1))};
const smsErr=c=>({'auth/invalid-verification-code':'인증번호가 맞지 않아요. 다시 확인해 주세요.','auth/code-expired':'인증번호 시간이 지났어요. [인증번호 다시 받기]를 눌러 주세요.','auth/too-many-requests':'요청이 너무 많아요. 잠시 후 다시 해 주세요.','auth/credential-already-in-use':'이 번호는 다른 계정에 이미 인증돼 있어요. 원장님께 말씀해 주세요.','auth/account-exists-with-different-credential':'이 번호는 다른 계정에 이미 인증돼 있어요. 원장님께 말씀해 주세요.','auth/invalid-phone-number':'휴대폰번호 형식이 맞지 않아요.','auth/quota-exceeded':'오늘 보낼 수 있는 문자 수를 넘었어요. 원장님께 말씀해 주세요.','auth/network-request-failed':'인터넷 연결을 확인해 주세요.','auth/captcha-check-failed':'보안 확인에 실패했어요. 앱을 닫았다가 다시 열어 주세요.'}[c]||'문자 인증을 하지 못했어요 ('+c+')');
let rcv=null;
function recaptcha(){
  if(rcv)return rcv;let box=document.getElementById('rcBox');
  if(!box){box=document.createElement('div');box.id='rcBox';document.body.appendChild(box)}
  rcv=new RecaptchaVerifier(auth,box,{size:'invisible'});return rcv;
}
async function smsSend(){
  if(U.smsBusy)return;U.smsBusy=true;U.smsErr='';render();
  try{U.smsConf=await linkWithPhoneNumber(auth.currentUser,'+82'+ME.phone.slice(1),recaptcha());toast('인증번호를 보냈어요')}
  catch(e){if(e.code==='auth/provider-already-linked'){await auth.currentUser.getIdToken(true);location.reload();return}U.smsErr=smsErr(e.code);try{rcv&&rcv.clear()}catch(_){}rcv=null}
  U.smsBusy=false;render();
}
async function smsCheck(code){
  if(!U.smsConf||U.smsBusy)return;U.smsBusy=true;U.smsErr='';render();
  try{await U.smsConf.confirm(code);await auth.currentUser.getIdToken(true);toast('인증됐어요');setTimeout(()=>location.reload(),400);return}
  catch(e){U.smsErr=smsErr(e.code)}
  U.smsBusy=false;render();
}
// 문자 인증으로 본인 번호가 확인됐으니 원장님 승인 없이 바로 연결해요 (규칙: 내 번호로 등록된 가족 1명씩, members 문서와 내 users 문서를 함께 저장할 때만)
// 혹시 바로 연결이 안 되면 예전처럼 승인 요청으로 남겨요
async function claim(ms){
  const go=ms.filter(m=>m.st==='none'||(m.st==='pending'&&m.uid===ME.uid));
  const linked=[],asked=[];
  for(const m of go){
    try{const b=writeBatch(db);b.update(doc(db,'members',m.id),{st:'ok',uid:ME.uid,at:hm()});
      b.set(doc(db,'users',ME.uid),{phone:ME.phone,sids:arrayUnion(m.sid),rels:{[m.sid]:m.rel},ths:arrayUnion(...thsOf(m.sid,m.rel)),via:m.id},{merge:true});await b.commit();linked.push(m)}
    catch(e){console.warn('self-link',e.code||e);if(m.st==='none'){try{await updateDoc(doc(db,'members',m.id),{st:'pending',uid:ME.uid,at:hm()});asked.push(m)}catch(e2){console.warn(e2)}}}
  }
  if(linked.length)push(['teacher'],'[가입 완료] '+linked.map(m=>(m.name||'')+' '+REL[m.rel]).join(', ')+' 앱에 가입했어요.',{tag:'join'});
  if(asked.length)push(['teacher'],'[가입 요청] '+asked.map(m=>(m.name||'')+' '+REL[m.rel]).join(', ')+' 가입을 승인해 주세요.',{tag:'join'});
}

/* ================= 쓰기 도우미 ================= */
// 원장님이 직접 보낸 메시지만 30분 안에 안 읽으면 다시 알림(30분 간격 최대 2번) — 자동 알림은 다시 알리지 않아요
const msg=(th,sid,f,t)=>addDoc(collection(db,'msgs'),{th,sid,f,t,at:stamp(),ts:now(),r:false}).then(ref=>{if(f==='t')remindLater(auth,ref.id);return ref});
const isTeacher=()=>U.role==='teacher'&&(isOwnerMe()||U.isStaff);
const push=(targets,text,opts)=>{sendPush(db,auth,targets,text,Object.assign({prune:isTeacher()},opts||{}))};
const famName=()=>{const s=stu(U.me);return U.role==='student'?(s?s.name:'')+' 학생':famLabel(U.me,myRel())};
// 자동 알림은 어머님·아버님 대화방에 각각 따로 남겨요 → 읽음도 각자. 푸시는 예전처럼 '학생id|parent'로 한 번(두 분 기기 모두 받음)
const PTH=sid=>PREL.map(r=>sid+'|'+r);
const sysP=(sid,t)=>Promise.all(PTH(sid).map(th=>msg(th,sid,'s',t)));
function notifyParent(sid,text){if(!D.autoNotify)return Promise.resolve();push([sid+'|parent'],text);return sysP(sid,text).catch(e=>console.warn(e))}
function pushHelp(){
  const android=/Android/i.test(navigator.userAgent);
  const sysPath='휴대폰 <b>설정 → 애플리케이션 → '+(isSamsung()?'삼성 인터넷':'사용 중인 인터넷 앱')+' → 알림 → 알림 허용</b>이 켜져 있는지도 확인해 주세요.';
  const samPath='삼성 인터넷 <b>메뉴(≡) → 설정 → 사이트 및 다운로드 → 사이트 알림</b>에서 알림을 켜고, 오른쪽 위 <b>⋮ → 허용 또는 차단된 사이트</b>에 더밀착수학이 차단돼 있으면 허용으로 바꿔 주세요.';
  const chrPath='크롬은 주소창 왼쪽 <b>자물쇠(또는 종) → 권한 → 알림 → 허용</b>.';
  if(android&&isSamsung())return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>갤럭시는 크롬 앱으로 써야 알림이 와요</b><br>삼성 인터넷은 이 앱의 알림 허용 창을 띄우지 못해요.<a class="btn" style="display:flex;align-items:center;justify-content:center;margin-top:8px;text-decoration:none" href="'+CHROME_URL+'">크롬에서 열기</a><span class="sub" style="display:block;margin-top:8px">① 크롬에서 로그인 → [알림 받기] → <b>허용</b><br>② 크롬 오른쪽 위 <b>⋮ → 홈 화면에 추가 → 설치</b><br>③ 삼성 인터넷으로 만든 예전 아이콘은 길게 눌러 삭제</span></div>';
  if(android&&isStandalone())return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>설치한 앱은 앱 자체의 알림이 켜져 있어야 해요.<br>① 홈 화면의 <b>더밀착수학 아이콘을 길게 누르기</b> → <b>ⓘ 앱 정보</b><br>② <b>알림</b> → <b>알림 허용</b> 켜기<br>③ 앱을 닫았다가 다시 열고 [알림 받기] 누르기</div>';
  if(android)return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>'+(isSamsung()?samPath:(/Chrome/i.test(navigator.userAgent)?chrPath+' ⋮ → 설정 → 사이트 설정 → 알림에서 <b>조용한 메시지 사용</b>을 끄면 다음부터 창이 떠요.':samPath+' '+chrPath))+'<br>'+sysPath+' 바꾼 뒤 이 화면을 새로고침하고 다시 눌러 주세요.</div>';
  return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>아이폰 <b>설정 → 알림 → 더밀착수학</b>에서 알림 허용을 켠 뒤 앱을 다시 열어 눌러 주세요.</div>';
}
function pushCard(){
  const st0=pushState(ME.uid);const st=(st0==='on'&&U.pushAutoErr)?'default':st0;if(st==='off'||st==='on'||U.pushHide)return '';
  let inner;
  if(st==='ios-install')inner='<p class="sub" style="margin:0 0 10px">아이폰은 <b>홈 화면에 설치한 앱</b>에서만 알림을 받을 수 있어요.</p><button class="btn" style="width:100%" data-act="iosG">홈 화면에 추가하기</button>';
  else if(st==='unsupported')inner='<p class="sub" style="margin:0">이 브라우저는 알림을 지원하지 않아요. '+(pushIOS()?'iOS 16.4 이상으로 업데이트해 주세요.':'삼성 인터넷 또는 크롬을 최신으로 업데이트해 주세요.')+'</p>';
  else if(st==='denied')inner=(/Android/i.test(navigator.userAgent)&&isStandalone())?'<p class="sub" style="margin:0">이 앱의 알림이 꺼져 있어요.<br>① 홈 화면의 <b>더밀착수학 아이콘을 길게 누르기</b> → <b>ⓘ 앱 정보</b><br>② <b>알림</b> 누르기 → <b>알림 허용</b> 켜기<br>③ 앱을 닫았다가 다시 열고 [알림 받기] 누르기</p><button class="btn" style="width:100%;margin-top:10px" data-act="pushOn">다시 시도</button>':'<p class="sub" style="margin:0">알림이 차단돼 있어요. 휴대폰 <b>설정 → 알림</b>(또는 브라우저 사이트 설정)에서 더밀착수학 알림을 허용해 주세요.</p>';
  else inner='<p class="sub" style="margin:0 0 10px">'+(U.role==='teacher'?'등원·가입 요청, 숙제 완료, 메시지가 오면':U.role==='student'?'새 숙제, 메시지·공지가 오면':'등·하원, 수업 기록, 새 숙제, 메시지·공지가 오면')+' 앱이 꺼져 있어도 알려 드려요.</p><button class="btn" style="width:100%" data-act="pushOn"'+(U.pushBusy?' disabled':'')+'>'+(U.pushBusy?'알림 켜는 중... (허용 창이 뜨면 [허용])':'알림 받기')+'</button>'+(U.pushErr?'<p style="margin:10px 0 0;color:var(--acc);font-size:14px;font-weight:700">'+esc(U.pushErr)+'</p>':'')+((U.pushHint||(/Android/i.test(navigator.userAgent)&&isSamsung()))?pushHelp():'')+'';
  let pm='?';try{pm=Notification.permission}catch(e){pm='없음'}
  const ua=navigator.userAgent;const br=/SamsungBrowser\/([\d.]+)/.exec(ua);const ch=/Chrome\/(\d+)/.exec(ua);
  if(U.role==='teacher')inner+='<p style="margin:10px 0 0;font-size:12px;color:#888">진단: v'+APP_VERSION+' · 권한 '+pm+' · '+(br?'삼성인터넷 '+br[1]:ch?'크롬 '+ch[1]:'기타')+' · '+(isStandalone()?'설치앱':'브라우저')+(U.pushAutoErr?' · 자동등록 실패: '+esc(U.pushAutoErr):'')+'</p>';
  return '<div class="card" style="border-color:var(--pri)"><h3>알림 받기 <button class="btn sm ghost" data-act="pushHide" aria-label="닫기">나중에</button></h3>'+inner+'</div>';
}
// 알림이 허용돼 있으면 버튼 없이 자동 등록 (업데이트·재설치·자녀 추가 후에도 유지)
/* ===== 교습소 와이파이 자동 등원 ===== */
async function myIp(){
  const t=(u,ms)=>Promise.race([fetch(u,{cache:'no-store'}),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),ms))]);
  try{const r=await t('https://api.ipify.org?format=json',5000);const j=await r.json();if(j&&j.ip)return j.ip}catch(e){}
  try{const r=await t('https://ipv4.icanhazip.com',5000);return (await r.text()).trim()}catch(e){}
  return '';
}
// 등원 시각은 지금 남아 있는 등원 요청의 시각 (취소 후 다시 보내면 가장 최근 요청 시각)
const wifiOn=()=>!!(D.cfg&&D.cfg.wifiAuto&&(D.cfg.wifiIps||[]).length);
// 교습소 와이파이 확인됨 → 승인 없이 등원 기록 + 원장님·학부모님 알림
async function wifiIn(s){
  const q0=myReq(s.id);const t=q0&&q0.at?q0.at:hm();await setDoc(doc(db,'att',TODAY+'_'+s.id),{sid:s.id,date:TODAY,st:'출석',at:t,by:'wifi',logged:false,ts:serverTimestamp()});
  const q=myReq(s.id);if(q)deleteDoc(doc(db,'reqs',q.id)).catch(()=>{});
  push(['teacher'],'[등원] '+s.name+' 학생 '+t+' 등원 (교습소 와이파이)',{tag:'att'});
  notifyParent(s.id,'[등원 알림] '+s.name+' 학생이 '+t+'에 등원했습니다.').catch(()=>{});
  U.wifiState='ok';toast('교습소 와이파이 확인 · 등원 완료!');
}
async function autoCheckin(){
  if(U.role!=='student'||!wifiOn()||U.wifiBusy)return;const s=stu(U.me);if(!s||!U.attReady)return;
  if((D.att[TODAY]||{})[s.id])return;
  U.wifiBusy=true;U.wifiState='checking';sr();
  try{const ip=await myIp();
    if(ip&&(D.cfg.wifiIps||[]).includes(ip)&&!(D.att[TODAY]||{})[s.id]){await wifiIn(s)}else U.wifiState=ip?'no':'err';
  }catch(e){console.warn('autoCheckin',e);U.wifiState='err'}
  U.wifiBusy=false;sr();
}
async function registerWifi(){const ip=await myIp();if(!ip)return toast('인터넷 주소를 확인하지 못했어요. 잠시 후 다시 눌러 주세요');const l=[...new Set([...(D.cfg.wifiIps||[]),ip])];await updateDoc(doc(db,'config','main'),{wifiIps:l,wifiAuto:true});toast('이 와이파이('+ip+')를 교습소로 등록했어요')}
function wifiCard(){
  if(!isOwnerMe())return '';const c=D.cfg||{};const ips=c.wifiIps||[];
  return '<div class="card"><h3>와이파이 자동 등원 '+(wifiOn()?'<span class="chip c-ok">켜짐</span>':'<span class="chip">꺼짐</span>')+'</h3><p class="sub" style="margin:0 0 10px">학생이 교습소 와이파이에 연결된 상태로 앱을 열면 승인 없이 바로 등원돼요. 와이파이가 아니면 지금처럼 [등원하기] → 승인.</p>'+
  (ips.length?'<div class="sub" style="margin-bottom:8px">등록된 교습소 인터넷 주소: '+ips.map(esc).join(', ')+'</div>':'')+
  '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="wifiReg">지금 연결된 와이파이를 교습소로 등록</button>'+(ips.length?'<button class="btn sm ghost" data-act="wifiTog">'+(c.wifiAuto?'끄기':'켜기')+'</button><button class="btn sm ghost" data-act="wifiClr">등록 지우기</button>':'')+'</div><p class="sub" style="margin:8px 0 0">교습소 와이파이에 연결된 이 폰에서 눌러 주세요. 인터넷 회사 사정으로 주소가 바뀌면 자동 등원이 안 될 수 있어요 → 다시 한 번 누르면 돼요.</p></div>';
}
function autoPush(){
  try{if(!('Notification' in window)||Notification.permission!=='granted'||!ME.uid)return}catch(e){return}
  const tg=U.role==='teacher'?['teacher']:ME.ths;if(!tg||!tg.length)return;
  const key=ME.uid+'|'+tg.join(',');if(U.pushSynced===key)return;U.pushSynced=key;
  enablePush(db,ME.uid,tg).then(()=>{U.pushErr=''}).catch(e=>{U.pushSynced='';console.warn('autoPush',e);U.pushAutoErr=pushErrorText(e);render()});
}
// 화면이 실제로 보이고 그 대화방이 열려 있을 때만 읽음 처리
const seen=()=>document.visibilityState==='visible'&&(typeof document.hasFocus!=='function'||document.hasFocus());
function markRead(k){
  if(!seen())return;
  const other=U.role==='teacher'?['o']:['t','s'];const l=fthread(k).filter(m=>other.includes(m.f)&&!m.r&&m.id);
  if(!l.length)return;const b=writeBatch(db);l.forEach(m=>{m.r=true;b.update(doc(db,'msgs',m.id),{r:true})});b.commit().catch(e=>console.warn(e));
  if(U.role!=='teacher')remindCancel(auth,l.map(m=>m.id));
}
const thOf=(sid,rel)=>sid+'|'+(rel==='student'?'student':'parent');
const thsOf=(sid,rel)=>rel==='student'?[sid+'|student']:[sid+'|parent',sid+'|'+rel];
async function linkUser(b,m){
  b.update(doc(db,'members',m.id),{st:'ok'});
  b.set(doc(db,'users',m.uid),{phone:m.phone,sids:arrayUnion(m.sid),rels:{[m.sid]:m.rel},ths:arrayUnion(...thsOf(m.sid,m.rel))},{merge:true});
  if(m.rel!=='student'){const kid=D.members.find(x=>x.sid===m.sid&&x.rel==='student');if(kid)b.update(doc(db,'members',kid.id),{guardianOk:true})}
}

/* ================= 이벤트 ================= */
app.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act],[data-tab]');if(!el)return;
  if(el.dataset.act==='close'&&e.target!==el)return;
  const a=el.dataset.act||'go',id=el.dataset.id,v=el.dataset.v;
  try{
  if(a==='reload')return location.reload();
  if(a==='doUpdate'){if(U.update)U.update.postMessage('skip');return}
  if(a==='install'){if(!U.bip)return;const ev=U.bip;U.bip=null;ev.prompt();const r=await ev.userChoice.catch(()=>null);if(r&&r.outcome==='accepted')toast('설치됐어요! 홈 화면에서 열어 주세요');return render()}
  if(a==='instHow'){U.sheet='inst';return render()}
  if(a==='iosG'){U.iosGuide=true;return render()}
  if(a==='iosX'){U.iosGuide=false;return render()}
  if(a==='rsSend'){const ph=digits((document.getElementById('rsP')||{}).value);if(!/^01\d{8,9}$/.test(ph))return toast('휴대폰번호를 정확히 입력해 주세요');U.rsPhone=ph;U.busy=true;U.authMsg='';render();
    try{U.rsConf=await signInWithPhoneNumber(auth,'+82'+ph.slice(1),recaptcha());toast('인증번호를 보냈어요')}catch(e){U.authMsg=smsErr(e.code)||'문자를 보내지 못했어요. 잠시 후 다시 해 주세요.';try{rcv&&rcv.clear()}catch(_){}rcv=null}
    U.busy=false;return render()}
  if(a==='rsAgain'){U.rsConf=null;try{rcv&&rcv.clear()}catch(_){}rcv=null;return render()}
  if(a==='instX'){U.noInstall=true;try{localStorage.setItem('tmm-noinst','1')}catch(e){}return render()}
  if(a==='pushOn'){if(U.pushBusy)return;U.pushBusy=true;U.pushErr='';U.pushHint=false;render();const hintT=setTimeout(()=>{if(U.pushBusy){U.pushHint=true;render()}},5000);try{await enablePush(db,ME.uid,U.role==='teacher'?['teacher']:ME.ths);clearTimeout(hintT);U.pushBusy=false;U.pushAutoErr='';U.pushHint=false;toast('알림이 켜졌어요')}catch(e){clearTimeout(hintT);U.pushBusy=false;U.pushErr=pushErrorText(e);U.pushHint=/permission|dismissed|denied/.test(String(e.message));render()}return render()}
  if(a==='pushHide'){U.pushHide=true;return render()}
  if(a==='authTab'){U.authTab=v;U.authMsg='';return render()}
  if(a==='logout'){U.famStarted=false;U.claimed=false;U.famSig=null;U.authMsg='';U.authTab='login';await signOut(auth);return}
  if(a==='reclaim'){await claim(U.wait);return toast('다시 요청했어요')}
  if(a==='smsSend')return smsSend();
  if(a==='who'){if(id===U.me)return;U.me=id;famRole();U.chat=null;U.wifiState=null;setTimeout(autoCheckin,300);return render()}
  if(a==='go'){U.tab=el.dataset.tab;if(el.dataset.comm)U.comm=el.dataset.comm;U.chat=null;U.page=null;return render()}
  if(a==='back'){U.chat=null;U.page=null;return render()}
  if(a==='page'){if((v==='mng'||v==='exam')&&!isOwnerMe())return toast('원장님만 쓸 수 있는 메뉴예요');U.page=v;return render()}
  if(a==='calM'){let [y,m]=U.calM.split('-').map(Number);m+=+v;if(m<1){m=12;y--}if(m>12){m=1;y++}U.calM=y+'-'+pad(m);return render()}
  if(a==='calD'){U.calD=v;return render()}
  if(a==='calS'){U.calS=v;return render()}
  if(a==='hideTh'){const k=el.dataset.k;await setDoc(doc(db,'config','hid'),{[k]:now()},{merge:true});if(U.chat===k)U.chat=null;return toast('목록에서 닫았어요 · [+ 새 대화 시작]에서 다시 열 수 있어요')}
  if(a==='open'){const [sd,rr]=el.dataset.k.split('|');U.chat=rr!=='student'&&U.role==='teacher'?famSids(sd)[0]+'|'+rr:el.dataset.k;markRead(U.chat);return render()}
  if(a==='sheet'){
    if(el.dataset.s==='log'||el.dataset.s==='hw'){if(!D.students.length)return toast('학생을 먼저 등록해 주세요');}
    U.sheet=el.dataset.s;if(U.sheet==='notice'){U.bEdit=null;U.bKeep=[];U.bl=[];U.bf=[]}if(U.sheet==='log'){const c=D.students.filter(x=>isIn((D.att[curDay()]||{})[x.id]));initLf((c.find(x=>x.id===U.logS)||c[0]||stu(U.logS)||D.students[0]).id)}return render()}
  if(a==='close'){if(U.bBusy)return;U.bf=[];U.bEdit=null;U.bKeep=[];U.bl=[];U.sheet=null;U.ret=null;U.lf=null;return render()}
  if(a==='comm'){U.comm=v;return render()}
  if(a==='hwF'){U.hwF=v;return render()}
  if(a==='logS'){U.logS=v;return render()}
  if(a==='pc'){U.pc[id]=v;return render()}
  if(a==='pushX'){U.pushX[id]=1;return render()}
  if(a==='lfS'){initLf(v,U.lf&&U.lf.subj);return render()}
  if(a==='lfSj'){const f=U.lf;const st=stu(f.sid);const l=latestIn(f.sid,v);f.subj=v;f.course=l?l.course:curCourse(st,v);f.unit=l?l.unit:null;f.c=l?Math.round(ratioOf(l)/10)*10:50;f.ux='';lfStash();return render()}
  if(a==='lfItem'){lfOpen(+v);return render()}
  if(a==='lfW'){const f=U.lf;lfStash();const n=f.items.length;const i=f.idx||0;const t=i===n-1?0:n-1;const others=f.items.reduce((a,it,k)=>k===i||k===t?a:a+(+it.w||0),0);const rest=100-(+v)-others;if(rest<0)return toast('비중 합이 100%를 넘어요. 다른 항목 비중을 먼저 줄여 주세요');f.items[i].w=+v;f.items[t].w=rest;f.w=+v;return render()}
  if(a==='lfAdd'){lfStash();const f=U.lf;const it={subj:f.subj,course:f.course,unit:null,c:50,ux:'',w:0};f.items.push(it);lfOpen(f.items.length-1);lfEven();return render()}
  if(a==='lfDelItem'){const f=U.lf;lfStash();if(f.items.length<2)return;f.items.splice(f.idx,1);f.idx=Math.min(f.idx,f.items.length-1);Object.assign(f,f.items[f.idx]);lfEven();return render()}
  if(a==='psj'){U.psj=U.psj||{};U.psj[id]=v;delete U.pc[id];return render()}
  if(a==='lfU'){U.lf.unit=v;if(v==='__none')U.lf.showCm=true;lfStash();return render()}
  if(a==='lfC'){U.lf.c=+v;U.lf.p=100-(+v);lfStash();return render()}
  if(a==='lfP'){U.lf.p=+v;return render()}
  if(a==='lfCm'){U.lf.showCm=true;return render()}
  if(a==='logFor'){U.logS=id;U.sheet='log';U.ret='att';initLf(id);return render()}

  // 부원장·학교·시험
  if(a==='stOk'){await updateDoc(doc(db,'staff',id),{st:'ok'});return toast('부원장 승인 완료')}
  if(a==='stRej'){await updateDoc(doc(db,'staff',id),{st:'none',uid:deleteField()});return toast('거절했어요')}
  if(a==='stDel'){const x=(D.staff||[]).find(y=>y.id===id);if(!x)return;if(!U.stDelArm||U.stDelArm!==id){U.stDelArm=id;return toast('한 번 더 누르면 '+(x.name||'')+' 부원장을 삭제해요')}U.stDelArm=null;await deleteDoc(doc(db,'staff',id));return toast('삭제했어요. 그 번호로는 더 이상 관리 기능을 쓸 수 없어요')}
  if(a==='schEdit'){U.schSid=id;U.sheet='school';return render()}
  if(a==='exDel'){if(U.exDelArm!==id){U.exDelArm=id;return toast('한 번 더 누르면 삭제해요')}U.exDelArm=null;await deleteDoc(doc(db,'exams',id));return toast('일정을 삭제했어요')}
  if(a==='schM'){if(+v===0)U.schM=null;else{const [y,m]=(U.schM||TODAY.slice(0,7)).split('-').map(Number);const d=new Date(y,m-1+(+v),1);U.schM=d.getFullYear()+'-'+pad(d.getMonth()+1)}return render()}
  if(a==='exK'){U.exK=v;return render()}
  // 가입 승인·관리
  if(a==='mOk'){const m=D.members.find(x=>x.id===id);if(!m||!m.uid)return;const all=D.members.filter(x=>x.uid===m.uid&&x.st==='pending');const b=writeBatch(db);all.forEach(x=>linkUser(b,x));await b.commit();
    for(const x of all){if(x.rel!=='student')await msg(thsOf(x.sid,x.rel).pop(),x.sid,'s','[가입 승인] '+mLabel(x)+'으로 연결되었어요. 환영합니다!')}
    push([...new Set(all.flatMap(x=>thsOf(x.sid,x.rel)))],'[가입 승인] 더밀착수학 앱 이용이 승인됐어요. 앱을 열어 주세요.');
    return toast(all.map(mLabel).join(', ')+' 승인 완료')}
  if(a==='mRej'){const m=D.members.find(x=>x.id===id);const all=D.members.filter(x=>x.uid&&x.uid===m.uid&&x.st==='pending');const b=writeBatch(db);all.forEach(x=>b.update(doc(db,'members',x.id),{st:'none',uid:deleteField()}));await b.commit();return toast(mLabel(m)+' 가입을 거절했어요')}
  if(a==='mBlock'||a==='mReset'){const m=D.members.find(x=>x.id===id);const b=writeBatch(db);
    b.update(doc(db,'members',m.id),a==='mBlock'?{st:'block'}:{st:'none',uid:deleteField()});
    if(m.uid)b.set(doc(db,'users',m.uid),{sids:arrayRemove(m.sid),ths:arrayRemove(...thsOf(m.sid,m.rel))},{merge:true});await b.commit();
    return toast(a==='mBlock'?mLabel(m)+' 접속을 차단했어요':'재가입 가능 상태로 바꿨어요. Firebase 콘솔 Authentication에서 '+fmtP(m.phone)+' 계정을 삭제해 주세요.')}
  if(a==='mUnblock'){const m=D.members.find(x=>x.id===id);if(!m.uid)return;const b=writeBatch(db);linkUser(b,m);await b.commit();return toast('차단을 해제했어요')}

  // 등원
  if(a==='ok'||a==='rej'){
    const q=D.req.find(x=>x.id===id);if(!q)return;const s=stu(q.sid);
    if(a==='rej'){await updateDoc(doc(db,'reqs',q.id),{st:'rej'});await msg(q.sid+'|student',q.sid,'s','[등원 요청 반려] 원장님께 직접 말씀드려 주세요.');push([q.sid+'|student'],'[등원 요청 반려] 원장님께 직접 말씀드려 주세요.');return toast(s.name+' 등원 요청을 거절했어요')}
    const st='출석';const b=writeBatch(db);
    b.update(doc(db,'reqs',q.id),{st:'ok'});
    b.set(doc(db,'att',TODAY+'_'+q.sid),{sid:q.sid,date:TODAY,st,at:q.at,by:'app',logged:loggedOn(q.sid,TODAY)});
    await b.commit();
    await notifyParent(q.sid,'[등원 알림] '+s.name+' 학생이 '+q.at+'에 등원했습니다.');
    return toast(s.name+' 등원 승인'+(D.autoNotify?' · 학부모 알림 발송':''));
  }
  if(a==='wifiReg'){await registerWifi();return}
  if(a==='wifiTog'){await updateDoc(doc(db,'config','main'),{wifiAuto:!(D.cfg&&D.cfg.wifiAuto)});return toast(D.cfg&&D.cfg.wifiAuto?'와이파이 자동 등원을 껐어요':'와이파이 자동 등원을 켰어요')}
  if(a==='wifiClr'){if(!confirm('등록된 교습소 와이파이 주소를 지울까요?'))return;await updateDoc(doc(db,'config','main'),{wifiIps:[],wifiAuto:false});return toast('지웠어요')}
  if(a==='msgSel'){U.msgSel=U.msgSel===id?null:id;return render()}
  if(a==='msgDel'&&U.role!=='teacher'){const m=Object.values(D.threads).flat().find(x=>x.id===id);if(!m||m.r)return toast('이미 읽은 메시지는 지울 수 없어요');if(!confirm('이 메시지를 삭제할까요?'))return;U.msgSel=null;await updateDoc(doc(db,'msgs',id),{del:true,delAt:now()});return toast('삭제했어요')}
  if(a==='msgDel'){if(!confirm('이 메시지를 삭제할까요?\n상대방 화면에서도 처음부터 없었던 것처럼 사라져요.'))return;U.msgSel=null;remindCancel(auth,[id]);await deleteDoc(doc(db,'msgs',id));return toast('메시지를 삭제했어요')}
  if(a==='noshow'){const s=stu(id);if(!s)return;const ps=(D.members||[]).filter(m=>m.sid===id&&m.rel!=='student'&&m.st==='ok').map(m=>REL[m.rel]);const tx=noshowTxt(s);
    if(!confirm(s.name+' 학생 부모님께 미등원 안내를 보낼까요?\n\n받는 분: '+(ps.length?ps.join('·'):'앱에 가입한 부모님이 아직 없어요')+'\n\n'+tx))return;
    await sysP(id,tx);push([id+'|parent'],tx,{title:'미등원 안내',tag:'ns'+id});return toast(s.name+' 부모님께 미등원 안내를 보냈어요')}
  if(a==='chatDel'){const pr=PREL.includes(U.chat.split('|')[1]);const l=fthread(U.chat).filter(m=>m.id&&!(pr&&/\|parent$/.test(m.th)));if(!l.length||!confirm('이 대화 전체('+l.length+'개)를 삭제할까요?\n상대방 화면에서도 모두 사라지고 되돌릴 수 없어요.'))return;for(let i=0;i<l.length;i+=400){const b=writeBatch(db);l.slice(i,i+400).forEach(m=>b.delete(doc(db,'msgs',m.id)));await b.commit()}U.chat=null;return toast('대화를 삭제했어요')}
  if(a==='callCancel'){const c=(D.calls||[]).find(x=>x.id===id);if(!c||!confirm(fmtD(c.date)+' 상담 요청을 취소할까요?'))return;await updateDoc(doc(db,'calls',id),{st:'cancel'});cancelRemind(auth,id);push(['teacher'],'[상담 취소] '+fmtD(c.date)+' '+(c.st==='ok'?c.at:rangeTxt(c))+' 상담 요청을 취소했어요',{title:c.who,tag:'call'});return toast('상담 요청을 취소했어요')}
  if(a==='callOk'||a==='callNo'||a==='callDone'){const c=(D.calls||[]).find(x=>x.id===id);if(!c)return;const th=c.sid+'|'+(PREL.includes(c.rel)?c.rel:'parent');
    if(a==='callDone'){await updateDoc(doc(db,'calls',id),{st:'done'});cancelRemind(auth,id);return toast('통화 완료로 정리했어요')}
    if(a==='callNo'){if(!confirm(c.who+' 상담을 '+(c.st==='ok'?'취소':'다른 시간으로 미룰')+'까요? 학부모님께 알림이 가요.'))return;await updateDoc(doc(db,'calls',id),{st:'cancel'});cancelRemind(auth,id);const tx='[상담 안내] '+fmtD(c.date)+' 상담은 '+(c.st==='ok'?'사정이 생겨 취소됐어요':'요청하신 시간에는 통화가 어려워요')+'. 편한 시간을 메시지로 알려 주시거나 다시 요청해 주세요.';push([th],tx,{tag:'call'});await msg(th,c.sid,'s',tx).catch(()=>{});return toast('학부모님께 알렸어요')}
    const at=(document.getElementById('ch_'+id)||{}).value||hh(c.from);await updateDoc(doc(db,'calls',id),{st:'ok',at});const tx='[상담 확정] '+fmtD(c.date)+' '+at+'에 원장님이 전화드릴게요.';push([th],tx,{tag:'call'});await msg(th,c.sid,'s',tx).catch(()=>{});
    const ok=await scheduleRemind(db,auth,{...c,at},c.who);return toast(c.who+' '+at+' 상담 확정'+(ok?' · 10분 전에 알려 드릴게요':' · 알림 예약은 못 했어요'))}
  if(a==='absDel'){const x=D.abs.find(y=>y.id===id);if(!x||!confirm(fmtD(x.date)+' 결석 통보를 취소할까요?'))return;const s=stu(x.sid);await deleteDoc(doc(db,'abs',id));const tx='[결석 취소] '+s.name+' 학생 '+fmtD(x.date)+' 결석 통보를 취소했어요 (수업 참석)';push(['teacher'],tx,{tag:'abs'});msg(x.sid+'|'+(PREL.includes(ME.rels[x.sid])?ME.rels[x.sid]:'parent'),x.sid,'o',tx).catch(()=>{});return toast('결석 통보를 취소했어요')}
  if(a==='dayM'){const d=new Date(curDay()+'T00:00');d.setDate(d.getDate()+(+v));const n=ds(d);U.dayPick=n===homeDefault()?null:n;U.calM=curDay().slice(0,7);return render()}
  if(a==='dayT'){U.dayPick=null;U.calM=curDay().slice(0,7);return render()}
  if(a==='exAdd'||a==='exDel'){const day=curDay();const sid=a==='exAdd'?(document.getElementById('exSel')||{}).value:id;if(!sid)return toast('보충 올 학생을 골라 주세요');await setDoc(doc(db,'extra',day),{date:day,sids:a==='exAdd'?arrayUnion(sid):arrayRemove(sid)},{merge:true});return toast((stu(sid)||{}).name+(a==='exAdd'?' 보충 추가':' 보충 취소'))}
  if(a==='absOk'){const x=D.abs.find(y=>y.id===id);if(!x)return;const s=stu(x.sid);await updateDoc(doc(db,'abs',id),{ok:true,okBy:TNAME()});const tx='[결석 확인] '+s.name+' 학생 '+fmtD(x.date)+' 결석 통보를 확인했어요.';push([x.sid+'|parent'],tx,{tag:'abs'});sysP(x.sid,tx).catch(()=>{});return toast(s.name+' 결석 확인 · 학부모님께 알렸어요')}
  if(a==='checkin'){const s=stu(U.me);if((D.att[TODAY]||{})[s.id])return toast('이미 등원했어요');
    if(wifiOn()&&!U.wifiBusy){U.wifiBusy=true;U.wifiState='checking';render();let ok=false;try{const ip=await myIp();ok=!!(ip&&(D.cfg.wifiIps||[]).includes(ip))}catch(e){}U.wifiBusy=false;if(ok){try{await wifiIn(s)}catch(e){U.wifiState='err';toast('등원 기록에 실패했어요. 다시 눌러 주세요')}return render()}U.wifiState='no'}
    if(myReq(s.id))return toast('이미 요청했어요');const t=hm();await addDoc(collection(db,'reqs'),{sid:s.id,uid:ME.uid,at:t,date:TODAY,st:'pending',ts:now()});push(['teacher'],'[등원 요청] '+s.name+' 학생 '+t+' 등원 · 승인해 주세요',{tag:'req'});return toast('원장님께 등원 승인 요청을 보냈어요')}
  if(a==='forceIn'){const s=stu(id);const pq=(D.req||[]).find(x=>x.sid===id&&x.st==='pending'&&x.date===curDay());const t=pq&&pq.at?pq.at:curDay()===TODAY?hm():(s.time||'16:00');await setDoc(doc(db,'att',curDay()+'_'+id),{sid:id,date:curDay(),st:'출석',at:t,by:'teacher',logged:loggedOn(id,curDay())});const q=(D.req||[]).find(x=>x.sid===id&&x.st==='pending');if(q)updateDoc(doc(db,'reqs',q.id),{st:'ok'}).catch(()=>{});const noti=curDay()===TODAY&&confirm(s.name+' 학생 등원 처리했어요.\n학부모님께 등원 알림을 보낼까요?');if(noti){const tx='[등원 알림] '+s.name+' 학생이 '+t+'에 등원했습니다.';push([id+'|parent'],tx);await msg(id+'|parent',id,'s',tx).catch(()=>{})}return toast(s.name+' 등원 처리 '+t+(noti?' · 학부모 알림 발송':''))}
  if(a==='cancelReq'){await deleteDoc(doc(db,'reqs',id));return toast('요청을 취소했어요')}
  if(a==='checkout'){
    const s=stu(U.me);const r=(D.att[TODAY]||{})[s.id];if(!r||!r.logged)return toast('아직 하원할 수 없어요');
    const out=hm();await updateDoc(doc(db,'att',TODAY+'_'+s.id),{out});const sm=lessonSummary(D.logs.filter(l=>l.sid===s.id&&l.date===TODAY&&l.sh));
    await notifyParent(s.id,'[하원 알림] '+s.name+' 학생이 '+lateLabel(out)+'에 하원했습니다.'+(sm?'\n'+sm:''));
    return toast('하원 완료! 수고했어요');
  }
  if(a==='absent'){const s=stu(id);await setDoc(doc(db,'att',curDay()+'_'+id),{sid:id,date:curDay(),st:'결석',at:'',by:'teacher'});if(curDay()===TODAY)await notifyParent(id,'[출결 알림] '+s.name+' 학생이 오늘 결석으로 처리되었습니다.');return toast('결석 처리했어요')}
  if(a==='attDel'){const s0=stu(id);if(U.attDelArm!==id){U.attDelArm=id;setTimeout(()=>{if(U.attDelArm===id){U.attDelArm=null;render()}},4000);return render()}U.attDelArm=null;await deleteDoc(doc(db,'att',curDay()+'_'+id));return toast((s0?s0.name+' ':'')+fmtD(curDay())+' 등·하원 기록을 삭제했어요')}
  if(a==='unabsent'){await deleteDoc(doc(db,'att',curDay()+'_'+id));return toast('결석을 취소했어요')}

  // 숙제·기록·공지
  if(a==='hwCheck'){await updateDoc(doc(db,'hw',id),{st:'checked'});return toast('숙제 확인 완료')}
  if(a==='hwDel'){await deleteDoc(doc(db,'hw',id));return toast('숙제를 삭제했어요')}
  if(a==='hwDone'){const h=D.hw.find(x=>x.id===id);await updateDoc(doc(db,'hw',id),{st:'done'});await msg(h.sid+'|student',h.sid,'o','[숙제 완료] '+h.title);push(['teacher'],'[숙제 완료] '+(stu(h.sid)||{}).name+': '+h.title);return toast('원장님께 완료를 알렸어요')}
  if(a==='togSh'){const x=D.logs.find(l=>l.id===id);await updateDoc(doc(db,'logs',id),{sh:!x.sh});return toast(x.sh?'비공개로 바꿨어요':'공유했어요')}
  if(a==='delLog'){await deleteDoc(doc(db,'logs',id));return toast('기록을 삭제했어요')}
  if(a==='readN'){await updateDoc(doc(db,'notices',id),{reads:arrayUnion(ME.uid)});return}
  if(a==='delN'){const n=D.notices.find(x=>x.id===id);if(!n||!canDelPost(n))return;if(!confirm('"'+n.title+'" 글을 삭제할까요?'))return;await deleteFiles(auth,(n.files||[]).map(x=>x.k));await deleteDoc(doc(db,'notices',id));return toast('글을 삭제했어요')}
  if(a==='bcat'){U.bcat=v;return render()}
  if(a==='mf'){U.mf=v;return render()}
  if(a==='bfDel'){(U.bf||[]).splice(+id,1);return render()}
  if(a==='bkDel'){(U.bKeep||[]).splice(+id,1);return render()}
  if(a==='blDel'){(U.bl||[]).splice(+id,1);return render()}
  if(a==='editN'){const n=D.notices.find(x=>x.id===id);if(!n||!canDelPost(n))return;U.bEdit=id;U.bKeep=[...(n.files||[])];U.bl=[...(n.links||[])];U.bf=[];U.sheet='notice';render();
    const set=(k,v)=>{const e=document.getElementById(k);if(e){if(e.type==='checkbox')e.checked=!!v;else e.value=v}};const to=n.to||{t:'all'};
    set('bCat',catOf(n));set('bTo',['student','parent'].includes(to.t)?to.t:'all');set('nT',n.title||'');set('nB',n.body||'');set('bD',n.at||'');set('nP',n.pin);set('bNoti',false);return}
  }catch(err){fail(err)}
});

app.addEventListener('change',async e=>{
  const t=e.target;
  try{
  if(t.id==='bFile'&&t.files){(U.bf=U.bf||[]).push(...t.files);t.value='';return render()}
  if(t.id==='whoSel'){U.me=t.value;famRole();U.chat=null;U.tab='home';U.wifiState=null;setTimeout(autoCheckin,300);return render()}
  if(t.id==='newChat'&&t.value){U.chat=t.value;if((D.hid||{})[t.value])setDoc(doc(db,'config','hid'),{[t.value]:0},{merge:true}).catch(()=>{});markRead(U.chat);return render()}
  if(t.id==='attDate'&&t.value){U.dayPick=t.value===homeDefault()?null:t.value;U.calM=curDay().slice(0,7);return render()}
  if(t.id==='autoN'){await updateDoc(doc(db,'config','main'),{autoNotify:t.checked});return toast(t.checked?'자동 알림 켬':'자동 알림 끔')}
  if(t.id==='lfCourse'){U.lf.course=t.value;U.lf.unit=null;lfStash();return render()}
  if(t.id==='lgSh'&&U.lf)U.lf.sh=t.checked;
  }catch(err){fail(err)}
});
app.addEventListener('input',e=>{if(!U.lf)return;if(e.target.id==='lgM')U.lf.cm=e.target.value;if(e.target.id==='lfUx'){U.lf.ux=e.target.value;lfStash()}});
const LF_KEYS=['subj','course','unit','c','ux','w'];
function lfEven(){const f=U.lf;const n=f.items.length;const b=Math.floor(100/n/10)*10;f.items.forEach((it,k)=>it.w=b);f.items[n-1].w=100-b*(n-1);f.w=f.items[f.idx||0].w}
const lfPick=f=>{const o={};LF_KEYS.forEach(k=>o[k]=f[k]);return o};
function lfStash(){const f=U.lf;if(!f)return;f.items=f.items||[lfPick(f)];f.items[f.idx||0]=lfPick(f)}
function lfOpen(i){const f=U.lf;lfStash();f.idx=i;Object.assign(f,f.items[i])}
function initLf(sid,sj){const s=stu(sid);if(!sj){const l0=latest(sid);sj=l0?subjOf(l0):'수학'}const l=sortLogs(D.logs.filter(x=>x.sid===sid&&subjOf(x)===sj&&x.unit)).pop()||latestIn(sid,sj);const course=l?l.course:curCourse(s,sj);const unit=l&&l.unit?l.unit:null;const c=l?Math.round(ratioOf(l)/10)*10:50;const keep=U.lf&&U.lf.sid===sid?{cm:U.lf.cm,showCm:U.lf.showCm,sh:U.lf.sh}:{cm:'',showCm:false,sh:true};U.lf=Object.assign({sid,subj:sj,course,unit,c,p:100-c,ux:'',w:100,idx:0},keep);U.lf.items=[lfPick(U.lf)];U.logS=sid}

const authErr=c=>({'auth/email-already-in-use':'이미 가입된 번호예요. 로그인해 주세요.','auth/invalid-credential':'번호나 비밀번호가 맞지 않아요.','auth/wrong-password':'번호나 비밀번호가 맞지 않아요.','auth/user-not-found':'가입되지 않은 번호예요.','auth/weak-password':'비밀번호는 6자리 이상이에요.','auth/too-many-requests':'잠시 후 다시 시도해 주세요.','auth/network-request-failed':'인터넷 연결을 확인해 주세요.'}[c]||'문제가 생겼어요 ('+c+')');

app.addEventListener('submit',async e=>{
  e.preventDefault();
  const g=id=>(document.getElementById(id)||{}).value||'';
  const fid=e.target.id;
  try{
  if(fid==='loginF'){const ph=digits(g('lP'));if(ph.length<10)return toast('휴대폰번호를 정확히 입력해 주세요');U.busy=true;U.authMsg='';render();
    try{await signInWithEmailAndPassword(auth,ph+MAIL,g('lW'))}catch(err){U.authMsg=authErr(err.code)}U.busy=false;return render()}
  if(fid==='rsF'){const c=digits(g('rsC')),w=g('rsW'),w2=g('rsW2');if(c.length!==6)return toast('인증번호 6자리를 넣어 주세요');if(w.length<6)return toast('비밀번호는 6자리 이상이에요');if(w!==w2)return toast('새 비밀번호가 서로 달라요');
    U.busy=true;U.authMsg='';render();U.resetting=true;
    try{const cr=await U.rsConf.confirm(c);const u=cr.user;
      if(!u.email||u.email!==U.rsPhone+MAIL){if(!u.email){try{await deleteUser(u)}catch(e){}}else{await signOut(auth)}U.resetting=false;U.busy=false;U.rsConf=null;U.authMsg='이 번호로 문자 인증을 마친 계정이 없어요. 원장님께 말씀해 주세요.';U.screen='auth';return render()}
      await updatePassword(u,w);U.resetting=false;U.busy=false;U.rsConf=null;U.authTab='login';toast('비밀번호를 바꿨어요');location.reload();return}
    catch(e){U.resetting=false;U.busy=false;U.authMsg=smsErr(e.code)||'바꾸지 못했어요. 다시 해 주세요.';return render()}}
  if(fid==='smsF'){const c=digits(g('smsC'));if(c.length!==6)return toast('인증번호 6자리를 넣어 주세요');return smsCheck(c)}
  if(fid==='signupF'){const ph=digits(g('jP'));
    if(ph.length<10)return toast('휴대폰번호를 정확히 입력해 주세요');
    if(g('jW').length<6)return toast('비밀번호는 6자리 이상이에요');
    if(g('jW')!==g('jW2'))return toast('비밀번호 확인이 맞지 않아요');
    if(!document.getElementById('jA').checked)return toast('개인정보 수집·이용 동의가 필요해요');
    U.busy=true;U.authMsg='';U.claimed=false;U.smsConf=null;U.smsErr='';render();
    try{await createUserWithEmailAndPassword(auth,ph+MAIL,g('jW'))}catch(err){U.authMsg=authErr(err.code)}U.busy=false;return render()}
  if(fid==='setupF'){const ph=digits(g('sP'));const name=g('sN').trim();
    if(!name||ph.length<10||g('sW').length<6)return toast('이름·번호·비밀번호(6자리 이상)를 확인해 주세요');
    U.busy=true;U.pendingSetup=true;render();
    try{
      try{await createUserWithEmailAndPassword(auth,ph+MAIL,g('sW'))}catch(err){if(err.code==='auth/email-already-in-use')await signInWithEmailAndPassword(auth,ph+MAIL,g('sW'));else throw err}
      await setDoc(doc(db,'config','main'),{owner:auth.currentUser.uid,teacher:name,phone:ph,autoNotify:true,created:TODAY});
      U.pendingSetup=false;toast('원장님 계정이 만들어졌어요');
    }catch(err){U.pendingSetup=false;U.authMsg=err.code==='permission-denied'?'이미 원장님 계정이 설정된 앱이에요.':authErr(err.code);if(auth.currentUser)await signOut(auth)}
    U.busy=false;return render()}
  if(fid==='sendF'){const t=g('msgIn').trim();if(!t)return;TY.stop();const [sid]=U.chat.split('|');document.getElementById('msgIn').value='';await msg(U.chat,sid,U.role==='teacher'?'t':'o',t);if(U.role==='teacher')push([U.chat],t,{title:TNAME()+' 메시지',tag:'m'+U.chat});else push(['teacher'],t,{title:famName()+' 메시지',tag:'m'+U.chat});return}
  if(fid==='examF'){
    const kind=U.exK||'exam',school=kind==='off'?'':g('exS').trim(),title=g('exT').trim(),start=g('exA'),end=g('exB')||g('exA'),memo=g('exM').trim();
    if((kind==='exam'&&!school)||!title||!start)return toast(kind==='exam'?'학교·시험·시작일을 입력해 주세요':'일정 이름·시작일을 입력해 주세요');
    if(end<start)return toast('끝나는 날이 시작일보다 빨라요');
    await addDoc(collection(db,'exams'),{kind,school,title,start,end,memo,ts:now()});
    const kids=school?D.students.filter(x=>(x.school||'').trim()===school):D.students;
    if(kids.length)push(kids.flatMap(x=>[x.id+'|student',x.id+'|parent']),(school?school+' ':'')+title+' · '+fmtD(start)+(end!==start?' ~ '+fmtD(end):'')+(memo?' · '+memo:''),{title:kind==='exam'?'시험 일정 등록':kind==='off'?'교습소 휴무 안내':'일정 안내',tag:'exam'});
    ['exS','exT','exA','exB','exM'].forEach(i=>{const el=document.getElementById(i);if(el)el.value=''});
    return toast(title+' 등록'+(kids.length?' · '+kids.length+'명 가족에게 알림':' (이 학교 학생이 아직 없어요)'));
  }
  if(U.sheet==='staff'){
    const name=g('sfN').trim(),ph=digits(g('sfP'));
    if(!name)return toast('이름을 입력해 주세요');if(ph.length<10||ph.length>11)return toast('휴대폰번호를 확인해 주세요');
    if(ph===digits(D.cfg&&D.cfg.phone))return toast('원장님 번호예요');
    if((D.staff||[]).some(x=>x.id===ph))return toast('이미 등록된 번호예요');
    await setDoc(doc(db,'staff',ph),{name,phone:ph,st:'none',ts:now()});U.sheet=null;return toast(name+' 부원장 등록 · [안내 문자]로 가입 안내를 보내세요');
  }
  if(U.sheet==='school'){const sc=g('scIn').trim();await updateDoc(doc(db,'students',U.schSid),{school:sc});U.sheet=null;return toast('학교를 저장했어요')}
  if(U.sheet==='hw'){
    const ids=[...document.querySelectorAll('input[name=hwS]:checked')].map(x=>x.value);const title=g('hwT').trim();
    if(!ids.length||!title)return toast('학생과 제목을 입력해 주세요');
    const due=g('hwD')||TODAY;const b=writeBatch(db);
    ids.forEach(sid=>{b.set(doc(collection(db,'hw')),{sid,title,range:g('hwR').trim()||'-',due,st:'todo',note:'',ts:now()});b.set(doc(collection(db,'msgs')),{th:sid+'|student',sid,f:'s',t:'[새 숙제] '+title+' · 마감 '+fmtD(due),at:stamp(),ts:now(),r:false})});
    await b.commit();push(ids.map(x=>x+'|student'),'[새 숙제] '+title+' · 마감 '+fmtD(due));ids.forEach(x=>push([x+'|parent'],'[새 숙제] '+((stu(x)||{}).name||'')+' · '+title+' · 마감 '+fmtD(due)));U.sheet=null;return toast(ids.length+'명에게 숙제를 냈어요');
  }
  if(U.sheet==='call'){
    const s=stu(U.me);const d=g('clD'),fr=+g('clA'),to=+g('clB'),memo=g('clM').trim();
    if(!d||d<TODAY)return toast('오늘 이후 날짜를 골라 주세요');if(to<=fr)return toast('끝나는 시간을 시작 시간보다 늦게 골라 주세요');
    if(d===TODAY&&to<=new Date().getHours()+1)return toast('오늘은 지금 이후 시간대로 골라 주세요');
    const rel=ME.rels[s.id];const who=s.name+' '+(REL[rel]||'학부모님');
    await addDoc(collection(db,'calls'),{sid:s.id,uid:ME.uid,rel,who,phone:ME.phone,date:d,from:fr,to,memo,st:'new',ts:now()});
    const tx='[상담 요청] '+fmtD(d)+' '+fr+'시~'+to+'시 통화 가능'+(memo?' · '+memo:'');
    push(['teacher'],tx,{title:who,tag:'call'});msg(s.id+'|'+(PREL.includes(rel)?rel:'parent'),s.id,'o',tx).catch(()=>{});
    U.sheet=null;return toast('원장님께 상담을 요청했어요');
  }
  if(U.sheet==='abs'){
    const s=stu(U.me);const d=g('abD');const why=g('abR').trim();
    if(!d||d<TODAY)return toast('오늘 이후 날짜를 골라 주세요');if(!why)return toast('사유를 적어 주세요');
    if(absOf(s.id,d))return toast('이미 알린 날이에요. 바꾸려면 취소 후 다시 알려 주세요');
    const who=s.name+' '+(REL[ME.rels[s.id]]||'학부모님');
    await setDoc(doc(db,'abs',d+'_'+s.id),{sid:s.id,date:d,reason:why,uid:ME.uid,who,ts:now(),ok:false});
    const tx='[결석 통보] '+s.name+' 학생 '+fmtD(d)+' 결석 · 사유: '+why;
    push(['teacher'],tx,{title:who,tag:'abs'});msg(s.id+'|'+(PREL.includes(ME.rels[s.id])?ME.rels[s.id]:'parent'),s.id,'o',tx).catch(()=>{});
    U.sheet=null;return toast('원장님께 결석을 알렸어요');
  }
  if(U.sheet==='notice'){
    if(U.bBusy)return;const cat=g('bCat')||'notice',title=g('nT').trim(),body=g('nB').trim(),lu=g('bLu').trim();
    if(cat==='notice'&&!isOwnerMe())return toast('공지는 원장님만 쓸 수 있어요');
    if(!title)return toast('제목을 입력해 주세요');if(lu&&!okLink(lu))return toast('https:// 로 시작하는 링크를 넣어 주세요');
    const to=parseTo(g('bTo'));const noti=!!(document.getElementById('bNoti')||{}).checked,pin=!!(document.getElementById('nP')||{}).checked;
    const q=U.bf||[],files=[];
    try{for(let i=0;i<q.length;i++){U.bBusy='올리는 중… '+(i+1)+'/'+q.length;render();files.push(await uploadFile(auth,q[i]))}
      U.bBusy='저장 중…';render();
      const links=(U.bl||[]).concat(lu?[{name:'구글 드라이브 자료',url:lu}]:[]);
      if(U.bEdit){const old=D.notices.find(x=>x.id===U.bEdit)||{};const keep=U.bKeep||[];await updateDoc(doc(db,'notices',U.bEdit),{cat,title,body,at:g('bD')||old.at||TODAY,pin,to,files:keep.concat(files),links,edited:now()});const gone=(old.files||[]).filter(f=>!keep.some(k=>k.k===f.k)).map(f=>f.k);if(gone.length)await deleteFiles(auth,gone)}
      else await addDoc(collection(db,'notices'),{cat,title,body,at:g('bD')||TODAY,pin,reads:[],ts:now(),by:ME.uid,byName:TNAME(),to,files,links});
    }catch(err){U.bBusy='';await deleteFiles(auth,files.map(x=>x.k));render();return toast(err.message||'올리지 못했어요')}
    if(noti)push(pushKeys(to,D.students),title,{title:catPush(cat),tag:'notice'});
    const wasEdit=!!U.bEdit;U.bBusy='';U.bf=[];U.bEdit=null;U.bKeep=[];U.bl=[];U.sheet=null;U.tab='comm';U.comm='notice';U.bcat='all';return toast(catLabel(cat)+(wasEdit?' 글을 수정했어요':' 글을 올렸어요')+(noti?' · 알림 보냄':' · 알림 없이'));
  }
  if(U.sheet==='log'){
    const f=U.lf;lfStash();const LD=curDay();
    const items=f.items.map(it=>Object.assign({},it,{none:it.unit==='__none',unit:it.unit==='__x'?(it.ux||'').trim():it.unit==='__none'?'':it.unit}));
    const bad=items.findIndex(it=>!it.unit&&!it.none);if(items.length>1&&items.reduce((a,it)=>a+(+it.w||0),0)!==100)return toast('항목 비중 합이 100%가 되게 맞춰 주세요');if(bad>=0){lfOpen(bad);render();return toast((items.length>1?(bad+1)+'번 항목: ':'')+'단원을 선택해 주세요')}
    if(items.some(it=>it.none)&&!(f.cm||'').trim()){f.showCm=true;render();return toast('단원 없이 기록하려면 메모에 오늘 한 내용을 꼭 적어 주세요')}
    const sid=f.sid;const s=stu(sid);const r=(D.att[LD]||{})[sid];const open=r&&r.st!=='결석'&&!r.out&&LD===off(0);
    const b=writeBatch(db);const ts=now();
    items.forEach((it,k)=>{const c=it.subj===ACT?null:(it.c==null?50:it.c);b.set(doc(collection(db,'logs')),{sid,date:LD,subj:it.subj,course:it.course,unit:it.unit,c,p:c==null?null:100-c,w:items.length>1?(+it.w||0):100,cm:k===0?(f.cm||'').trim():'',sh:f.sh,ts:ts+k})});
    const math=items.filter(it=>it.subj==='수학').pop();if(math&&s.course!==math.course)b.update(doc(db,'students',sid),{course:math.course});
    if(r)b.update(doc(db,'att',LD+'_'+sid),{logged:true});
    // 학습 기록을 올려도 학생에게는 알림·메시지를 보내지 않아요 (원장님 요청) — 학생 앱 [하원] 버튼만 열려요
    await b.commit();

    // 학부모님께는 하원 알림에 수업 내용을 함께 보내요(중간 발송 없음). 이미 하원한 뒤 올린 기록만 따로 보내요.
    if(f.sh&&r&&r.out&&r.st!=='결석')await notifyParent(sid,'[수업 내용] '+stu(sid).name+' 학생 '+fmtD(LD)+'\n'+lessonSummary(items.map((it,i)=>({...it,sh:true,cm:i?'':(f.cm||'').trim()}))));
    const last=items[items.length-1];U.psj=U.psj||{};U.psj[sid]=last.subj;U.pc[sid]=last.course;U.logS=sid;U.sheet=null;U.lf=null;U.tab=U.ret||'log';U.ret=null;return toast((items.length>1?items.length+'개 항목 · ':'')+(open?'정리 완료 · 하원이 열렸어요':'기록을 저장했어요'));
  }

  if(U.sheet==='stu'){
    const name=g('stN').trim();const ph={student:digits(g('pS')),father:digits(g('pF')),mother:digits(g('pM'))};
    if(!name)return toast('학생 이름을 입력해 주세요');
    if(Object.values(ph).some(x=>x&&(x.length<10||x.length>11)))return toast('휴대폰번호를 확인해 주세요');
    if(!Object.values(ph).some(x=>x))return toast('번호를 하나 이상 등록해 주세요');
    const grade=g('stG');const course={초4:'중1-1',초5:'중1-1',초6:'중1-1',중1:'중1-2',중2:'중2-2',중3:'중3-2',고1:'공통수학2',고2:'대수',고3:'미적분Ⅰ'}[grade];
    const b=writeBatch(db);const sref=doc(collection(db,'students'));const sid=sref.id;
    b.set(sref,{name,grade,school:g('stSc').trim(),course,ts:now()});
    const autoLinked=[];
    Object.entries(ph).forEach(([rel,p])=>{if(!p)return;const ex=rel!=='student'&&D.members.find(m=>m.phone===p&&m.st==='ok'&&m.uid);const mref=doc(collection(db,'members'));
      const m={sid,rel,phone:p,st:ex?'ok':'none',name,grade,guardianOk:false};if(ex){m.uid=ex.uid;autoLinked.push(ex)}b.set(mref,m);
      if(ex)b.set(doc(db,'users',ex.uid),{sids:arrayUnion(sid),rels:{[sid]:rel},ths:arrayUnion(...thsOf(sid,rel))},{merge:true})});
    await b.commit();U.sheet=null;
    U.page='mng';return toast(name+' 등록 완료'+(autoLinked.length?' · 형제 부모님 계정에 자동 연결':' · [안내 문자]로 가입 안내를 보내세요'));
  }
  }catch(err){U.busy=false;fail(err)}
});

/* ================= 앱 업데이트·설치 ================= */
U.fresh=Date.now();
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    // 앱을 막 열었거나(15초 안) 업데이트 알림을 눌러 들어왔으면 바로 새 버전 적용, 쓰는 중이면 배너만
    const show=w=>{U.update=w;if(Date.now()-U.fresh<15000||/[?&]u=1/.test(location.search)){w.postMessage('skip');return}render()};
    U.reg=reg;reg.update().catch(()=>{});
    if(reg.waiting&&navigator.serviceWorker.controller)show(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)show(w)})});
    setInterval(()=>reg.update().catch(()=>{}),30*60*1000);
  }).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded)return;reloaded=true;location.reload()});
}
try{U.noInstall=localStorage.getItem('tmm-noinst')==='1'}catch(e){}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();U.bip=e;render()});
window.addEventListener('appinstalled',()=>{U.bip=null;toast('설치됐어요! 홈 화면에서 열어 주세요')});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&off(0)!==TODAY)return location.reload();if(document.visibilityState==='visible'){U.fresh=Date.now();if(U.role!=='teacher')render();U.wifiState=null;setTimeout(autoCheckin,500);if(U.reg)U.reg.update().catch(()=>{});if(U.chat)markRead(U.chat);autoPush();if(isOwnerMe())announceUpdate(db,auth)}});
window.addEventListener('focus',()=>{if(U.chat)markRead(U.chat)});
render();
