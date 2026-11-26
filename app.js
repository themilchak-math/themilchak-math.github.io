// 더밀착수학 앱 - 실제 버전 (Firebase 연결)
// 개발 노트는 개발노트.md 참고
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, writeBatch, arrayUnion, arrayRemove, deleteField, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { PUSH_URL, pushState, enablePush, sendPush, pushErrorText, isIOS as pushIOS } from './push.js';

const APP_VERSION = '1.2.3';
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const MAIL = '@themilchak-math.app';
const pad=n=>String(n).padStart(2,'0');
const ds=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const off=k=>{const d=new Date();d.setDate(d.getDate()+k);return ds(d)};
const TODAY=off(0);
const WD='일월화수목금토';
const fmtD=s=>{const d=new Date(s+'T00:00');return (d.getMonth()+1)+'/'+d.getDate()+' ('+WD[d.getDay()]+')'};
const hm=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())};
const stamp=()=>TODAY+' '+hm();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const ST=['출석','지각','결석'];
const CUR={
 '중1-1':['소인수분해','정수와 유리수','문자의 사용과 식의 계산','일차방정식','좌표평면과 그래프'],
 '중1-2':['기본 도형','작도와 합동','평면도형의 성질','입체도형의 성질','자료의 정리와 해석'],
 '중2-1':['유리수와 순환소수','식의 계산','일차부등식','연립일차방정식','일차함수와 그래프','일차함수와 일차방정식의 관계'],
 '중2-2':['삼각형의 성질','사각형의 성질','도형의 닮음','피타고라스 정리','확률'],
 '중3-1':['제곱근과 실수','근호를 포함한 식의 계산','다항식의 곱셈','인수분해','이차방정식','이차함수와 그래프'],
 '중3-2':['삼각비','원의 성질','대푯값과 산포도','상관관계'],
 '공통수학1':['다항식의 연산','항등식과 나머지정리','인수분해','복소수','이차방정식','이차방정식과 이차함수','여러 가지 방정식','여러 가지 부등식','경우의 수','순열과 조합','행렬과 그 연산'],
 '공통수학2':['평면좌표','직선의 방정식','원의 방정식','도형의 이동','집합','명제','함수','합성함수와 역함수','유리함수','무리함수'],
 '대수':['지수와 로그','지수함수와 로그함수','삼각함수','삼각함수의 그래프','사인법칙과 코사인법칙','등차수열과 등비수열','수열의 합','수학적 귀납법'],
 '미적분Ⅰ':['함수의 극한','함수의 연속','미분계수와 도함수','도함수의 활용','부정적분','정적분','정적분의 활용'],
 '확률과 통계':['순열과 조합','이항정리','확률의 뜻과 활용','조건부확률','이산확률분포','연속확률분포','통계적 추정']
};
const CGROUP=[['중학교',['중1-1','중1-2','중2-1','중2-2','중3-1','중3-2']],['고등학교',['공통수학1','공통수학2','대수','미적분Ⅰ','확률과 통계']]];
const PCT=[0,10,20,30,40,50,60,70,80,90,100];

const stu=id=>D.students.find(s=>s.id===id);
const thread=k=>D.threads[k]||(D.threads[k]=[]);
const myKey=()=>U.me+'|'+U.role;

const IC={
  home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  att:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M8.5 13l2.5 2.5 4.5-5"/>',
  hw:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  log:'<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
  comm:'<path d="M4 5h16v11H9l-5 4z"/>',
  note:'<path d="M5 4h14v16H5zM9 9h6M9 13h6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.6 3.5 6"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24">'+IC[n]+'</svg>';

const unreadTeacher=()=>Object.values(D.threads).reduce((a,t)=>a+t.filter(m=>m.f==='o'&&!m.r).length,0);
const unreadMine=()=>thread(myKey()).filter(m=>(m.f==='t'||m.f==='s')&&!m.r).length;
const unreadNotice=()=>U.role==='teacher'?0:D.notices.filter(n=>!(n.reads||[]).includes(ME.uid)).length;

function tabsFor(){
  const c=U.role==='teacher'?unreadTeacher():unreadMine()+unreadNotice();
  const t={teacher:[['home','홈'],['att','출결'],['hw','숙제'],['log','학습기록'],['comm','소통']],
    student:[['home','홈'],['hw','숙제'],['log','내 진도'],['comm','소통']],
    parent:[['home','홈'],['att','출결'],['log','학습기록'],['comm','소통']]}[U.role];
  return t.map(([k,l])=>'<button data-tab="'+k+'" class="'+(U.tab===k?'on':'')+'">'+ic(k)+l+(k==='comm'&&c?'<span class="dot">'+c+'</span>':'')+(k==='att'&&U.role==='teacher'&&pending().length?'<span class="dot">'+pending().length+'</span>':'')+'</button>').join('');
}


const hwChip=h=>h.st==='checked'?'<span class="chip c-ok">확인 완료</span>':h.st==='done'?'<span class="chip c-pri">제출함</span>':(h.due<TODAY?'<span class="chip c-bad">기한 지남</span>':'<span class="chip c-warn">진행 중</span>');
const attChip=a=>!a?'<span class="chip">미등원</span>':'<span style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end"><span class="chip '+(a.st==='출석'?'c-ok':a.st==='지각'?'c-warn':'c-bad')+'">'+a.st+(a.at?' '+a.at:'')+'</span>'+(a.out?'<span class="chip c-pri">하원 '+a.out+'</span>':'')+'</span>';
const qrCode=(t=Date.now())=>String((Math.floor(t/30000)*7919+13)%900000+100000);
const qrLeft=()=>30-Math.floor(Date.now()/1000)%30;
function qrSvg(code){let z=+code||1;const r=()=>(z=z*16807%2147483647)/2147483647;const N=25;let d='';
  const inF=(x,y)=>(x<8&&y<8)||(x>N-9&&y<8)||(x<8&&y>N-9);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!inF(x,y)&&r()<.5)d+='M'+x+' '+y+'h1v1h-1z';
  const f=(x,y)=>'M'+x+' '+y+'h7v7h-7zM'+(x+1)+' '+(y+1)+'h5v5h-5zM'+(x+2)+' '+(y+2)+'h3v3h-3z';
  return '<svg viewBox="-2 -2 29 29" style="width:100%;height:100%;display:block" role="img" aria-label="등원 QR"><rect x="-2" y="-2" width="29" height="29" rx="1.5" fill="#fff"/><path fill="#11152b" fill-rule="evenodd" d="'+f(0,0)+f(N-7,0)+f(0,N-7)+d+'"/></svg>'}
const REL={student:'학생',father:'아버님',mother:'어머님'};
const digits=x=>String(x||'').replace(/\D/g,'');
const fmtP=d=>d.length===11?d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7):d;
const maskP=d=>d.length===11?d.slice(0,3)+'-****-'+d.slice(7):d;
const mPending=()=>(D.members||[]).filter(m=>m.st==='pending');
const mLabel=m=>{const s=stu(m.sid);return (s?s.name:(m.name||''))+' '+REL[m.rel]};
const mChip=m=>m.st==='ok'?'<span class="chip c-ok">연결됨</span>':m.st==='pending'?'<span class="chip c-warn">승인 대기</span>':m.st==='block'?'<span class="chip c-bad">차단</span>':'<span class="chip">미가입</span>';
function mReqRows(){const l=mPending();if(!l.length)return '<div class="empty">가입 승인 대기가 없어요</div>';return l.map(m=>'<div class="row" style="flex-wrap:wrap"><div class="av'+(m.rel!=='student'?' p':'')+'">'+(m.rel==='student'?'학생':REL[m.rel].slice(0,2))+'</div><div class="grow"><div class="nm">'+esc(mLabel(m))+'</div><div class="sub">'+esc(maskP(m.phone))+' · 등록 번호 일치</div></div><div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="mRej" data-id="'+m.id+'">거절</button><button class="btn sm" data-act="mOk" data-id="'+m.id+'">승인</button></div></div>').join('')}
function inviteText(m){const s=stu(m.sid);const nm=s?s.name:(m.name||'');const who=m.rel==='student'?nm+' 학생':nm+' '+REL[m.rel];const tn=(D.cfg&&D.cfg.teacher)||'';
  return '[더밀착수학] 안녕하세요, '+who+'. '+(tn?tn+' 선생님':'더밀착수학')+'입니다.\n'+(m.rel==='student'?'출결·숙제·수업 기록':'출결·수업 기록·숙제·공지')+'을 확인하는 교습소 앱 안내드려요.\n\n1) 아래 주소 열기 (아이폰은 사파리, 갤럭시는 삼성 인터넷)\nhttps://themilchak-math.github.io\n2) [처음이에요 · 가입하기] → 이 번호('+fmtP(m.phone)+')와 원하는 비밀번호 입력\n3) 선생님 승인 후 이용 가능\n4) 홈 화면에 추가(설치) → 앱에서 [알림 받기] 누르기'+(m.rel==='student'&&m.grade==='중1'?'\n※ 부모님이 먼저 가입해 주셔야 학생 가입이 열려요.':'')}
const smsHref=m=>'sms:'+m.phone+(pushIOS()?'&':'?')+'body='+encodeURIComponent(inviteText(m));
function mngView(){
  return header('학생·학부모 관리','등록한 번호로만 가입할 수 있어요',true)+'<div class="body">'+
  '<div class="card"><h3>가입 승인 대기 <small>'+mPending().length+'건</small></h3>'+mReqRows()+'</div>'+
  '<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="stu">+ 학생 등록</button>'+
  D.students.map(s=>'<div class="card"><h3>'+esc(s.name)+' <small>'+esc(s.grade)+' · 수업 '+esc(s.time)+'</small></h3>'+['student','father','mother'].map(rel=>{const m=(D.members||[]).find(x=>x.sid===s.id&&x.rel===rel);return '<div class="row"><div class="grow"><div class="nm" style="font-weight:500">'+REL[rel]+'</div><div class="sub">'+(m?esc(fmtP(m.phone)):'번호 미등록')+'</div></div>'+(m?mChip(m):'<span class="chip">없음</span>')+(m&&m.st==='ok'?'<button class="btn sm ghost" data-act="mReset" data-id="'+m.id+'">비번 분실</button><button class="btn sm ghost" data-act="mBlock" data-id="'+m.id+'">차단</button>':m&&m.st==='block'?'<button class="btn sm ghost" data-act="mUnblock" data-id="'+m.id+'">해제</button>':m&&m.st==='pending'?'<button class="btn sm" data-act="mOk" data-id="'+m.id+'">승인</button>':m&&m.st==='none'?'<a class="btn sm" style="display:inline-flex;align-items:center;text-decoration:none" href="'+esc(smsHref(m))+'">안내 문자</a>':'')+'</div>'}).join('')+'</div>').join('')+'</div>';
}
const pending=()=>(D.req||[]).filter(q=>q.st==='pending');
const myReq=sid=>pending().find(q=>q.sid===sid);
function reqRows(){const l=pending();if(!l.length)return '<div class="empty">승인 대기 중인 등원 요청이 없어요</div>';return l.map(q=>{const s=stu(q.sid)||{name:'?',time:''};return '<div class="row" style="flex-wrap:wrap"><div class="av">'+esc(s.name.slice(-2))+'</div><div class="grow"><div class="nm">'+esc(s.name)+' 등원 요청</div><div class="sub">'+esc(q.at)+' QR 확인 · 수업 '+esc(s.time)+(q.at>s.time?' · 지각':'')+'</div></div><div style="display:flex;gap:6px"><button class="btn sm ghost" data-act="rej" data-id="'+q.id+'">거절</button><button class="btn sm" data-act="ok" data-id="'+q.id+'">승인</button></div></div>'}).join('')}
const loggedOn=(sid,d)=>D.logs.some(l=>l.sid===sid&&l.date===d);
const fmtDist=m=>m>=1000?(m/1000).toFixed(1)+'km':m+'m';
const stars=n=>'<span class="stars" aria-label="이해도 '+n+'/5">'+'★'.repeat(n)+'<span style="opacity:.25">'+'★'.repeat(5-n)+'</span></span>';

function noticeList(limit){
  const list=[...D.notices].sort((a,b)=>(b.pin-a.pin)||(b.at>a.at?1:-1)).slice(0,limit||99);
  if(!list.length)return '<div class="empty">등록된 공지가 없어요</div>';
  const total=D.students.length*2;
  return list.map(n=>{
    const read=(n.reads||[]).includes(ME.uid);
    return '<div class="notice"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+(n.pin?'<span class="chip c-bad">고정</span>':'')+'<b>'+esc(n.title)+'</b></div><div class="sub">'+fmtD(n.at)+(U.role==='teacher'?' · 읽음 '+(n.reads||[]).length+'명':(read?' · 읽음':''))+'</div><p>'+esc(n.body)+'</p>'+(U.role!=='teacher'&&!read?'<button class="btn sm ghost" style="margin-top:8px" data-act="readN" data-id="'+n.id+'">확인했어요</button>':'')+(U.role==='teacher'?'<button class="btn sm ghost" style="margin-top:8px" data-act="delN" data-id="'+n.id+'">삭제</button>':'')+'</div>';
  }).join('');
}

const sortLogs=l=>[...l].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
const lastOf=(sid,course,unit)=>sortLogs(D.logs.filter(l=>l.sid===sid&&l.course===course&&l.unit===unit)).pop();
const unitsOf=(sid,course)=>{const base=CUR[course]||[];const extra=[...new Set(D.logs.filter(l=>l.sid===sid&&l.course===course&&!base.includes(l.unit)).map(l=>l.unit))];return base.concat(extra)};
const latest=sid=>sortLogs(D.logs.filter(l=>l.sid===sid)).pop();
const curUnit=s=>{const l=latest(s.id);return l?l.unit+' (개념 '+l.c+'% · 문제 '+l.p+'%)':'기록 없음'};
function coursePct(sid,course){const us=unitsOf(sid,course);if(!us.length)return 0;let t=0;us.forEach(u=>{const l=lastOf(sid,course,u);if(l)t+=(l.c+l.p)/2});return Math.round(t/us.length)}
const mini=(lab,v,col)=>'<div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><span style="width:52px;color:var(--mut)">'+lab+'</span><div class="bar" style="flex:1;margin:0;height:7px"><i style="width:'+v+'%;background:'+col+'"></i></div><span style="width:34px;text-align:right;font-variant-numeric:tabular-nums">'+v+'%</span></div>';

function progressCard(s){
  const courses=[...new Set([s.course,...D.logs.filter(l=>l.sid===s.id).map(l=>l.course)])];
  const cur=courses.includes(U.pc[s.id])?U.pc[s.id]:s.course;
  const pct=coursePct(s.id,cur);const us=unitsOf(s.id,cur);
  const done=us.filter(u=>{const l=lastOf(s.id,cur,u);return l&&l.c===100&&l.p===100}).length;
  return '<div class="card"><h3>'+esc(s.name)+' 진도 <small>'+esc(s.grade)+'</small></h3>'+(courses.length>1?'<div class="pills">'+courses.map(c=>'<button data-act="pc" data-id="'+s.id+'" data-v="'+esc(c)+'" class="'+(c===cur?'on':'')+'">'+esc(c)+'</button>').join('')+'</div>':'')+'<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="big">'+pct+'%</span><span class="sub">'+esc(cur)+' · 완료 '+done+' / '+us.length+' 단원</span></div><div class="bar"><i style="width:'+pct+'%"></i></div><div class="units">'+us.map((u,i)=>{const l=lastOf(s.id,cur,u);const fin=l&&l.c===100&&l.p===100;return '<div class="'+(fin?'d':l?'n':'')+'" style="flex-wrap:wrap"><b>'+(fin?'✓':i+1)+'</b><span style="flex:1">'+esc(u)+'</span>'+(l&&!fin?'<span class="sub" style="font-size:12px">개념 '+l.c+'% · 문제 '+l.p+'%</span>':'')+'</div>'}).join('')+'</div></div>';
}

function logBody(x){
  const prev=sortLogs(D.logs.filter(l=>l.sid===x.sid&&l.course===x.course&&l.unit===x.unit&&(l.date<x.date||(l.date===x.date&&D.logs.indexOf(l)<D.logs.indexOf(x))))).pop();
  const d=(a,b)=>a===b?' 유지':' +'+(a-b)+'%';
  return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>'+fmtD(x.date)+' · '+esc(x.unit)+'</b><span class="chip">'+esc(x.course)+'</span></div><div style="margin-top:6px;display:grid;gap:4px">'+mini('개념',x.c,'var(--pri)')+mini('문제풀이',x.p,'var(--acc)')+'</div>'+((prev&&(x.c>prev.c||x.p>prev.p))?'<div class="sub" style="margin-top:4px">지난 수업 대비 개념'+d(x.c,prev.c)+' · 문제풀이'+d(x.p,prev.p)+'</div>':'')+(x.cm?'<p class="sub" style="margin-top:6px">선생님 메모: '+esc(x.cm)+'</p>':'');
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

/* ---------- screens ---------- */
function tHome(){
  const a=D.att[TODAY]||{};
  const present=D.students.filter(s=>a[s.id]&&a[s.id].st!=='결석').length;
  const toCheck=D.hw.filter(h=>h.st==='done');
  return header(TNAME(),'오늘 '+fmtD(TODAY))+'<div class="body">'+pushCard()+
  '<div class="quick"><button data-act="sheet" data-s="qr">'+ic('att')+'등원 QR</button><button data-act="sheet" data-s="hw">'+ic('hw')+'숙제 내기</button><button data-act="sheet" data-s="log">'+ic('log')+'기록 쓰기</button><button data-act="sheet" data-s="notice">'+ic('note')+'공지 쓰기</button><button data-act="page" data-v="mng">'+ic('users')+'학생 관리</button></div>'+
  (mPending().length?'<div class="card" style="border-color:var(--warn)"><h3>가입 승인 대기 <small>'+mPending().length+'건</small></h3>'+mReqRows()+'</div>':'')+
  (pending().length?'<div class="card" style="border-color:var(--acc)"><h3>등원 승인 대기 <small>'+pending().length+'건</small></h3>'+reqRows()+'</div>':'')+
  '<div class="stats"><div><b>'+present+'/'+D.students.length+'</b><span>오늘 등원</span></div><div><b>'+toCheck.length+'</b><span>확인할 숙제</span></div><div><b>'+unreadTeacher()+'</b><span>새 메시지</span></div></div>'+
  '<div class="card"><h3>오늘 출결 <small>'+fmtD(TODAY)+'</small></h3>'+D.students.map(s=>'<div class="row"><div class="av">'+esc(s.name.slice(-2))+'</div><div class="grow"><div class="nm">'+esc(s.name)+'</div><div class="sub">'+esc(s.grade)+' · '+esc(curUnit(s))+'</div></div>'+attChip(a[s.id])+'</div>').join('')+'</div>'+
  '<div class="card"><h3>확인할 숙제</h3>'+hwList(toCheck,'teacher')+'</div>'+
  '<div class="card"><h3>최근 공지 <button class="btn sm ghost" data-act="go" data-tab="comm" data-comm="notice">전체</button></h3>'+noticeList(1)+'</div></div>';
}

function calCard(sid,teacher){
  const [y,m]=U.calM.split('-').map(Number);const lead=new Date(y,m-1,1).getDay();const nd=new Date(y,m,0).getDate();
  const cnt=[0,0,0];let cells=WD.split('').map((w,i)=>'<div class="wd'+(i===0?' sun':'')+'">'+w+'</div>').join('');
  for(let i=0;i<lead;i++)cells+='<div></div>';
  for(let d=1;d<=nd;d++){
    const ds=y+'-'+pad(m)+'-'+pad(d);const day=D.att[ds]||{};let cls='',sub='';
    if(sid!=='all'){const r=day[sid];if(r){const k=ST.indexOf(r.st);cnt[k]++;cls=' k'+k}}
    else{const rs=Object.values(day);if(rs.length){rs.forEach(r=>cnt[ST.indexOf(r.st)]++);const n=rs.filter(r=>r.st!=='결석').length;cls=rs.some(r=>r.st==='결석')?' k2':rs.some(r=>r.st==='지각')?' k1':' k0';sub='<small>'+n+'명</small>'}}
    cells+='<button data-act="calD" data-v="'+ds+'" class="'+cls+(ds===TODAY?' td':'')+(ds===U.calD?' sel':'')+(ds>TODAY?' fu':'')+'" aria-label="'+m+'월 '+d+'일">'+d+sub+'</button>';
  }
  const dd=U.calD;let det='';
  if(dd.slice(0,7)===U.calM){
    const day=D.att[dd]||{};
    const line=x=>{const r=day[x.id];const lg=D.logs.filter(l=>l.sid===x.id&&l.date===dd&&(teacher||l.sh)).pop();return '<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+esc(x.name)+'</div><div class="sub">'+(r?(r.st==='결석'?'결석':'등원 '+esc(r.at)+(r.out?' · 하원 '+esc(r.out):dd===TODAY?' · 수업 중':' · 하원 기록 없음')):(dd>TODAY?'예정':'기록 없음'))+(lg?'<br>수업: '+esc(lg.course+' '+lg.unit)+' · 개념 '+lg.c+'% · 문제 '+lg.p+'%':'')+'</div></div>'+attChip(r)+'</div>'};
    det='<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px"><b>'+fmtD(dd)+'</b>'+(sid==='all'?D.students.map(line).join(''):line(stu(sid)))+'</div>';
  }
  return '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><button class="btn sm ghost" data-act="calM" data-v="-1" aria-label="이전 달">‹</button><h3 style="margin:0">'+y+'년 '+m+'월 출결</h3><button class="btn sm ghost" data-act="calM" data-v="1" aria-label="다음 달">›</button></div>'+
  (teacher?'<div class="pills"><button data-act="calS" data-v="all" class="'+(sid==='all'?'on':'')+'">전체</button>'+D.students.map(x=>'<button data-act="calS" data-v="'+x.id+'" class="'+(sid===x.id?'on':'')+'">'+esc(x.name)+'</button>').join('')+'</div>':'')+
  '<div class="cal">'+cells+'</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"><span class="chip c-ok">출석 '+cnt[0]+'</span><span class="chip c-warn">지각 '+cnt[1]+'</span><span class="chip c-bad">결석 '+cnt[2]+'</span>'+(sid==='all'?'<span class="sub" style="font-size:13px">숫자는 그날 등원 인원</span>':'')+'</div>'+det+'</div>';
}

function tAtt(){
  const isT=U.attDate===TODAY;const a=D.att[U.attDate]||{};
  return header('출결 관리',fmtD(U.attDate)+(isT?' · 오늘':''))+'<div class="body">'+
  '<button class="btn" style="width:100%;min-height:56px;font-size:17px;margin-bottom:12px" data-act="sheet" data-s="qr">등원 QR 띄우기</button>'+
  '<div class="card"><h3>등원 승인 대기 <small>'+pending().length+'건</small></h3>'+reqRows()+'</div>'+
  '<div class="card"><h3>출결 규칙</h3><p class="sub" style="margin:0">학생이 선생님 폰의 등원 QR(30초마다 바뀜)을 찍으면 선생님께 승인 요청이 가요. 승인해야 등원이 기록되고, 요청 시각이 수업 시작 이후면 지각이에요. 하원은 그날 학습 정리를 올린 뒤에만 열려요.</p></div>'+
  '<div class="card"><label class="f"><span>날짜</span><input type="date" id="attDate" value="'+U.attDate+'"></label><div class="sw" style="margin:0"><span>등·하원 시 학부모님께 알림 자동 발송</span><input type="checkbox" id="autoN" '+(D.autoNotify?'checked':'')+'></div></div>'+
  '<div class="card"><h3>학생별 등·하원</h3>'+D.students.map(s=>{
    const r=a[s.id];const lg=loggedOn(s.id,U.attDate);
    const line=!r?'등원 전 · 수업 '+s.time:r.st==='결석'?'결석 처리됨':'등원 '+r.at+(r.out?' · 하원 '+r.out:lg?' · 학습 정리 완료, 하원 대기':' · 수업 중');
    let act='';
    if(r&&r.st!=='결석'&&!r.out&&!lg&&isT)act='<button class="btn sm" data-act="logFor" data-id="'+s.id+'">오늘 학습 정리 올리기</button>';
    else if(!r)act='<button class="btn sm ghost" data-act="absent" data-id="'+s.id+'">결석 처리</button>';
    else if(r.st==='결석')act='<button class="btn sm ghost" data-act="unabsent" data-id="'+s.id+'">결석 취소</button>';
    return '<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">'+esc(s.name)+'</div><div class="sub">'+esc(line)+'</div></div>'+attChip(r)+(act?'<div style="width:100%;display:flex;justify-content:flex-end">'+act+'</div>':'')+'</div>'}).join('')+'</div>'+
  calCard(D.students.some(x=>x.id===U.calS)?U.calS:'all',true)+
  '<div class="card"><h3>최근 2주 출결 요약</h3>'+D.students.map(s=>{let c=[0,0,0];Object.keys(D.att).filter(d=>d>=off(-14)).forEach(d=>{const r=D.att[d][s.id];if(r)c[ST.indexOf(r.st)]++});return '<div class="row" style="flex-wrap:wrap"><div class="grow nm">'+esc(s.name)+'</div><span class="chip c-ok">출석 '+c[0]+'</span><span class="chip c-warn">지각 '+c[1]+'</span><span class="chip c-bad">결석 '+c[2]+'</span></div>'}).join('')+'</div></div>';
}

function checkCard(s){
  const r=(D.att[TODAY]||{})[s.id];const lg=!!(r&&r.logged)||loggedOn(s.id,TODAY);
  let m;
  const q=myReq(s.id);
  if(!r&&q)m='<p style="margin:0 0 6px;font-weight:700">선생님 승인 대기 중</p><p class="sub" style="margin:0 0 10px">'+esc(q.at)+'에 등원 요청을 보냈어요. 선생님이 승인하면 등원이 기록돼요.</p><button class="btn ghost" style="width:100%" data-act="cancelReq" data-id="'+q.id+'">요청 취소</button>';
  else if(!r)m='<p class="sub" style="margin:0 0 10px">수업 '+esc(s.time)+' 시작 · 교습소에 도착하면 선생님 폰의 등원 QR을 찍어주세요</p><button class="btn" style="width:100%;min-height:52px;font-size:17px" data-act="sheet" data-s="scan">QR 찍고 등원하기</button>';
  else if(r.st==='결석')m='<p style="margin:0">오늘은 결석으로 처리되었어요.</p>';
  else if(r.out)m='<p style="margin:0">오늘 수업 끝! 수고했어요.</p>';
  else m='<p class="sub" style="margin:0 0 10px">'+(lg?'선생님이 오늘 학습 정리를 올렸어요. 하원 체크를 해주세요.':'선생님이 오늘 학습 정리를 올리면 하원할 수 있어요.')+'</p><button class="btn" style="width:100%;min-height:52px;font-size:17px" data-act="checkout"'+(lg?'':' disabled')+'>'+(lg?'하원 체크':'하원 잠김 · 학습 정리 대기')+'</button>';
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

function commTabs(){return '<div class="pills"><button data-act="comm" data-v="msg" class="'+(U.comm==='msg'?'on':'')+'">메시지</button><button data-act="comm" data-v="notice" class="'+(U.comm==='notice'?'on':'')+'">공지사항'+(unreadNotice()?' · '+unreadNotice():'')+'</button></div>'}

function tComm(){
  let inner;
  if(U.comm==='notice'){inner='<button class="btn" style="width:100%;margin-bottom:12px" data-act="sheet" data-s="notice">+ 공지 쓰기</button><div class="card">'+noticeList()+'</div>'}
  else{
    const keys=[];D.students.forEach(s=>{keys.push(s.id+'|student',s.id+'|parent')});
    const items=keys.map(k=>{const t=thread(k);const last=t[t.length-1];return {k,last,un:t.filter(m=>m.f==='o'&&!m.r).length}}).sort((a,b)=>((b.last?b.last.at:'')>(a.last?a.last.at:'')?1:-1));
    inner='<div class="card">'+items.map(i=>{const [sid,r]=i.k.split('|');const s=stu(sid);return '<button class="thr" data-act="open" data-k="'+i.k+'"><div class="av'+(r==='parent'?' p':'')+'">'+(r==='parent'?'학부':esc(s.name.slice(-2)))+'</div><div class="grow" style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><span class="nm">'+esc(s.name)+(r==='parent'?' 학부모님':' 학생')+'</span><span class="sub">'+(i.last?esc(i.last.at.slice(5)):'')+'</span></div><div class="sub ell">'+(i.last?esc(i.last.t):'대화를 시작해 보세요')+'</div></div>'+(i.un?'<span class="dot" style="position:static">'+i.un+'</span>':'')+'</button>'}).join('')+'</div>';
  }
  return header('소통','학생·학부모 메시지와 공지')+'<div class="body">'+commTabs()+inner+'</div>';
}

function chatView(){
  const [sid,r]=U.chat.split('|');const s=stu(sid);
  const t=thread(U.chat);
  const mine=U.role==='teacher'?'t':'o';
  const title=U.role==='teacher'?s.name+(r==='parent'?' 학부모님':' 학생'):TNAME();
  const body=t.length?t.map(m=>m.f==='s'?'<div class="msg sys">'+esc(m.t)+'</div>':'<div class="msg '+(m.f===mine?'me':'you')+'">'+esc(m.t)+'</div><div class="mt'+(m.f===mine?'':' l')+'">'+esc(m.at.slice(5))+(m.f===mine&&m.r?' · 읽음':'')+'</div>').join(''):'<div class="empty">첫 메시지를 보내보세요</div>';
  return header(title,r==='parent'?'학부모 상담':'학생 질문·안내',true)+'<div class="body" id="chatBody"><div class="chat">'+body+'</div></div><form class="send" id="sendF"><input id="msgIn" placeholder="메시지 입력" autocomplete="off" aria-label="메시지"><button class="btn" type="submit">전송</button></form>';
}

function sHome(){
  const s=stu(U.me);
  const todo=D.hw.filter(h=>h.sid===s.id&&h.st==='todo');
  const last=sortLogs(D.logs.filter(x=>x.sid===s.id&&x.sh)).pop();
  return header(s.name+' 학생',s.grade+' · '+s.course)+'<div class="body">'+pushCard()+checkCard(s)+
  '<div class="stats"><div><b>'+todo.length+'</b><span>남은 숙제</span></div><div><b>'+coursePct(s.id,s.course)+'%</b><span>진도율</span></div><div><b>'+unreadMine()+'</b><span>새 메시지</span></div></div>'+
  '<div class="card"><h3>해야 할 숙제</h3>'+hwList(todo,'student')+'</div>'+
  (last?'<div class="card"><h3>최근 수업</h3><div class="log">'+logBody(last)+'</div></div>':'')+
  '<div class="card"><h3>공지사항</h3>'+noticeList(2)+'</div></div>';
}
function sHw(){const s=stu(U.me);const l=D.hw.filter(h=>h.sid===s.id).sort((a,b)=>(a.st!=='todo')-(b.st!=='todo')||(a.due>b.due?1:-1));return header('내 숙제','완료하면 선생님께 바로 알려져요')+'<div class="body"><div class="card">'+hwList(l,'student')+'</div></div>'}
function myLog(){const s=stu(U.me);return header(U.role==='student'?'내 진도':s.name+' 학습기록',s.course)+'<div class="body">'+progressCard(s)+'<div class="card"><h3>수업 기록</h3>'+logList(s.id,true)+'</div></div>'}
function pHome(){
  const s=stu(U.me);const a=(D.att[TODAY]||{})[s.id];
  const hs=D.hw.filter(h=>h.sid===s.id);const doneRate=hs.length?Math.round(hs.filter(h=>h.st!=='todo').length/hs.length*100):0;
  const last=sortLogs(D.logs.filter(x=>x.sid===s.id&&x.sh)).pop();
  return header(s.name+' 학부모님',s.grade+' · '+s.course)+'<div class="body">'+pushCard()+
  '<div class="card"><h3>오늘 출결 <small>'+fmtD(TODAY)+'</small></h3><div class="row"><div class="grow nm">'+esc(s.name)+'</div>'+attChip(a)+'</div></div>'+
  '<div class="stats"><div><b>'+coursePct(s.id,s.course)+'%</b><span>진도율</span></div><div><b>'+doneRate+'%</b><span>숙제 수행</span></div><div><b>'+unreadMine()+'</b><span>새 메시지</span></div></div>'+
  (last?'<div class="card"><h3>최근 수업</h3><div class="log">'+logBody(last)+'</div></div>':'')+
  '<div class="card"><h3>숙제 현황</h3>'+hwList(hs.slice(0,3),'parent')+'</div>'+
  '<div class="card"><h3>공지사항</h3>'+noticeList(2)+'</div></div>';
}
function pAtt(){const s=stu(U.me);return header('출결 달력',s.name)+'<div class="body">'+calCard(s.id,false)+'</div>'}
function oComm(){
  let inner;
  if(U.comm==='notice')inner='<div class="card">'+noticeList()+'</div>';
  else{const t=thread(myKey());const last=t[t.length-1];const un=unreadMine();inner='<div class="card"><button class="thr" data-act="open" data-k="'+myKey()+'"><div class="av">'+esc(TNAME().slice(0,1))+'</div><div style="flex:1;min-width:0"><div class="nm">'+esc(TNAME())+'</div><div class="sub ell">'+(last?esc(last.t):'궁금한 점을 보내보세요')+'</div></div>'+(un?'<span class="dot" style="position:static">'+un+'</span>':'')+'</button></div>'}
  return header('소통','선생님과 메시지·공지')+'<div class="body">'+commTabs()+inner+'</div>';
}

function sheetHtml(){
  const t=U.sheet;
  const opts=D.students.map(s=>'<option value="'+s.id+'"'+(s.id===U.logS?' selected':'')+'>'+esc(s.name)+' ('+esc(s.grade)+')</option>').join('');
  let h='';
  if(t==='hw')h='<h3>숙제 내기</h3><div class="f"><span>받을 학생</span><div class="ck">'+D.students.map(s=>'<label><input type="checkbox" name="hwS" value="'+s.id+'"'+((U.hwF===s.id)?' checked':'')+'>'+esc(s.name)+'</label>').join('')+'</div></div><label class="f"><span>숙제 제목</span><input id="hwT" placeholder="예: 쎈 B단계 유형 3"></label><label class="f"><span>범위</span><input id="hwR" placeholder="예: p.40~45 짝수"></label><label class="f"><span>마감일</span><input type="date" id="hwD" value="'+off(2)+'"></label>';
  if(t==='stu')h='<h3>학생 등록</h3><label class="f"><span>학생 이름</span><input id="stN" autocomplete="off"></label><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px"><label class="f"><span>학년</span><select id="stG">'+['중1','중2','중3','고1','고2','고3'].map(g=>'<option>'+g+'</option>').join('')+'</select></label><label class="f"><span>수업 시작</span><input type="time" id="stT" value="16:00"></label></div><label class="f"><span>학생 휴대폰</span><input id="pS" inputmode="numeric" placeholder="010-0000-0000"></label><label class="f"><span>아버님 휴대폰</span><input id="pF" inputmode="numeric" placeholder="없으면 비워두세요"></label><label class="f"><span>어머님 휴대폰</span><input id="pM" inputmode="numeric" placeholder="없으면 비워두세요"></label><p class="sub" style="margin:0 0 10px">가족이 이 번호로 가입하면 원장님께 승인 요청이 와요. 형제는 같은 부모 번호로 등록하면 한 번 가입으로 함께 연결돼요.</p>';
  if(t==='notice')h='<h3>공지 쓰기</h3><label class="f"><span>제목</span><input id="nT"></label><label class="f"><span>내용</span><textarea id="nB"></textarea></label><label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="nP">상단 고정</label>';
  if(t==='log'){
    const f=U.lf;const s=stu(f.sid);const us=unitsOf(f.sid,f.course);
    const chips=(act,val)=>'<div class="pg">'+PCT.map(v=>'<button type="button" data-act="'+act+'" data-v="'+v+'" class="'+(val===v?'on':'')+'">'+v+'</button>').join('')+'</div>';
    const prev=f.unit&&f.unit!=='__x'?lastOf(f.sid,f.course,f.unit):null;
    h='<h3>수업 기록 <small class="sub" style="font-weight:400">'+fmtD(TODAY)+'</small></h3>'+
    '<div class="f"><span>학생</span><div class="pills" style="margin:0">'+D.students.map(x=>'<button type="button" data-act="lfS" data-v="'+x.id+'" class="'+(x.id===f.sid?'on':'')+'">'+esc(x.name)+'</button>').join('')+'</div></div>'+
    '<label class="f"><span>① 진도 학년·학기 <small class="sub" style="font-weight:400">'+esc(s.grade)+' 학생</small></span><select id="lfCourse">'+CGROUP.map(([g,cs])=>'<optgroup label="'+g+'">'+cs.map(c=>'<option'+(c===f.course?' selected':'')+'>'+c+'</option>').join('')+'</optgroup>').join('')+'</select></label>'+
    '<div class="f"><span>② 단원</span><div class="ck">'+us.map(u=>{const l=lastOf(f.sid,f.course,u);const fin=l&&l.c===100&&l.p===100;return '<button type="button" class="uc'+(f.unit===u?' on':'')+'" data-act="lfU" data-v="'+esc(u)+'">'+(fin?'✓ ':'')+esc(u)+'</button>'}).join('')+'<button type="button" class="uc'+(f.unit==='__x'?' on':'')+'" data-act="lfU" data-v="__x">+ 직접 입력</button></div>'+(f.unit==='__x'?'<input id="lfUx" style="margin-top:8px" placeholder="단원명 입력" value="'+esc(f.ux||'')+'">':'')+'</div>'+
    (f.unit?'<div class="f"><span>③ 개념 진행률'+(prev?' <small class="sub" style="font-weight:400">지난번 '+prev.c+'%</small>':'')+'</span>'+chips('lfC',f.c)+'</div><div class="f"><span>④ 문제풀이 진행률'+(prev?' <small class="sub" style="font-weight:400">지난번 '+prev.p+'%</small>':'')+'</span>'+chips('lfP',f.p)+'</div>':'<p class="sub" style="margin:0 0 12px">단원을 고르면 진행률을 선택할 수 있어요.</p>')+
    (f.showCm?'<label class="f"><span>특별 메모 (선택)</span><textarea id="lgM" placeholder="결석 보충, 컨디션, 시험 대비 등 특별한 일만">'+esc(f.cm||'')+'</textarea></label>':'<button type="button" class="btn sm ghost" style="margin-bottom:12px" data-act="lfCm">+ 특별한 일이 있으면 메모 추가</button>')+
    '<label class="sw" style="justify-content:flex-start;gap:8px"><input type="checkbox" id="lgSh" '+(f.sh?'checked':'')+'>학부모·학생에게 공유</label>';
  }
  return '<div class="sheetbg" data-act="close"><form class="sheet" id="sheetF">'+h+'<div class="acts"><button type="button" class="btn ghost" data-act="close">취소</button><button class="btn" type="submit">저장</button></div></form></div>';
}


const app=document.getElementById('app');
/* ================= 상태 ================= */
const D={students:[],att:{},threads:{},hw:[],logs:[],notices:[],req:[],members:[],autoNotify:true,cfg:null};
const ME={uid:null,phone:'',sids:[],rels:{},ths:[]};
const U={screen:'loading',authMsg:'',authTab:'login',busy:false,wait:[],update:null,
  calM:TODAY.slice(0,7),calS:'all',calD:TODAY,page:null,pc:{},lf:null,pushX:{},
  role:'teacher',me:null,tab:'home',chat:null,sheet:null,comm:'msg',hwF:'all',logS:null,attDate:TODAY,toast:''};
const TNAME=()=>((D.cfg&&D.cfg.teacher)||'원장')+' 선생님';
const docs=s=>s.docs.map(d=>({id:d.id,...d.data()}));
const now=()=>Date.now();
const phoneOf=u=>(u&&u.email||'').split('@')[0];
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

/* ================= 화면 그리기 ================= */
function header(title,sub,back){
  const sel=(U.role!=='teacher'&&ME.sids.length>1)?'<select id="whoSel" class="who-sel" aria-label="자녀 선택">'+ME.sids.map(id=>{const s=stu(id);return '<option value="'+esc(id)+'"'+(id===U.me?' selected':'')+'>'+esc(s?s.name:'...')+'</option>'}).join('')+'</select>':'';
  return '<div class="hdr"><div class="sb"><span>더밀착수학</span><button class="lo" data-act="logout">로그아웃</button></div>'+(back?'<button class="back" data-act="back">‹ 뒤로</button>':'')+'<h2>'+esc(title)+'</h2>'+(sub?'<div class="who">'+esc(sub)+'</div>':'')+sel+'</div>';
}
function authHeader(t,s){return '<div class="hdr"><div class="sb"><span>더밀착수학</span><span>v'+APP_VERSION+'</span></div><h2>'+esc(t)+'</h2>'+(s?'<div class="who">'+esc(s)+'</div>':'')+'</div>'}
const isSamsung=()=>/SamsungBrowser/i.test(navigator.userAgent);
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const shareIco='<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
function installSteps(){
  if(isIOS()){const chrome=/CriOS/i.test(navigator.userAgent);return '<ol class="ist"><li>'+(chrome?'오른쪽 위 공유 버튼 '+shareIco+' 누르기':'화면 아래 가운데 공유 버튼 '+shareIco+' 누르기')+'</li><li>목록을 조금 올려서 <b>홈 화면에 추가</b> 누르기</li><li>오른쪽 위 <b>추가</b> 누르기</li></ol>'}
  const sam='<ol class="ist"><li>화면 오른쪽 아래 <b>메뉴(≡)</b> 누르기</li><li><b>현재 페이지 추가</b> 누르기</li><li><b>홈 화면</b> 선택 → <b>추가</b> 누르기</li></ol><p class="sub" style="margin:6px 0 0">주소창에 <b>설치(⬇) 아이콘</b>이 보이면 그걸 눌러도 돼요.</p>';
  const chr='<ol class="ist"><li>오른쪽 위 <b>⋮</b> 누르기</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b> 누르기</li></ol>';
  if(isSamsung())return sam;
  if(/Chrome/i.test(navigator.userAgent))return chr;
  return '<p style="margin:0 0 4px;font-weight:700">삼성 인터넷</p>'+sam+'<p style="margin:10px 0 4px;font-weight:700">크롬</p>'+chr;
}
const installTip=()=>isStandalone()?'':'<div class="card" style="border-color:var(--pri)"><h3>홈 화면에 앱 설치하기</h3>'+(U.bip?'<button class="btn" style="width:100%" data-act="install">앱 설치하기 (한 번만 누르면 돼요)</button>':installSteps())+'</div>';
function installBar(){if(isStandalone()||U.noInstall)return '';return '<div class="upd ib"><span>홈 화면에 앱으로 설치할 수 있어요</span><span style="display:flex;gap:6px"><button class="btn sm" data-act="'+(U.bip?'install':'instHow')+'">설치</button><button class="btn sm ghost" data-act="instX" aria-label="닫기">✕</button></span></div>'}
function instSheet(){return '<div class="sheetbg" data-act="close"><div class="sheet"><h3>홈 화면에 앱 설치하기</h3>'+installSteps()+'<p class="sub">설치하면 앱처럼 바로 열리고 로그인도 유지돼요.</p><button type="button" class="btn ghost" style="width:100%" data-act="close">닫기</button></div></div>'}
const msgBox=()=>U.authMsg?'<div class="card" style="border-color:var(--acc)"><p style="margin:0;color:var(--acc);font-weight:700">'+esc(U.authMsg)+'</p></div>':'';

function authView(){
  const t=U.authTab;
  if(t==='setup')return authHeader('원장님 처음 설정','이 화면은 처음 한 번만 사용해요')+'<div class="body">'+msgBox()+
    '<form id="setupF" class="card"><label class="f"><span>원장님 이름</span><input id="sN" placeholder="예: 김동진" autocomplete="name"></label><label class="f"><span>원장님 휴대폰번호 (로그인 아이디)</span><input id="sP" inputmode="numeric" placeholder="010-0000-0000" autocomplete="tel"></label><label class="f"><span>비밀번호 (6자리 이상)</span><input id="sW" type="password" autocomplete="new-password"></label><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>원장님 계정 만들기</button></form>'+
    '<button class="btn ghost" style="width:100%" data-act="authTab" data-v="login">로그인 화면으로</button></div>';
  if(t==='signup')return authHeader('가입하기','선생님께 등록된 휴대폰번호로 가입해요')+'<div class="body">'+msgBox()+
    '<form id="signupF" class="card"><label class="f"><span>휴대폰번호</span><input id="jP" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000"></label><label class="f"><span>비밀번호 (6자리 이상)</span><input id="jW" type="password" autocomplete="new-password"></label><label class="f"><span>비밀번호 확인</span><input id="jW2" type="password" autocomplete="new-password"></label><label class="sw" style="justify-content:flex-start;gap:8px;color:var(--ink)"><input type="checkbox" id="jA">[필수] 개인정보 수집·이용에 동의합니다</label><details class="sub" style="margin:-4px 0 14px"><summary>동의 내용 보기</summary>수집 항목: 이름, 휴대폰번호, 출결·숙제·학습 기록, 메시지 · 목적: 수업 관리와 학부모 안내 · 보관: 퇴원 후 1년까지 보관 뒤 삭제 · 동의하지 않을 수 있으나 앱을 이용할 수 없어요.</details><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>가입하기</button></form>'+
    '<button class="btn ghost" style="width:100%" data-act="authTab" data-v="login">이미 가입했어요 · 로그인</button>'+installTip()+'</div>';
  return authHeader('더밀착수학','학생·학부모·선생님 로그인')+'<div class="body">'+msgBox()+
    installTip()+'<form id="loginF" class="card"><label class="f"><span>휴대폰번호</span><input id="lP" inputmode="numeric" autocomplete="username" placeholder="010-0000-0000"></label><label class="f"><span>비밀번호</span><input id="lW" type="password" autocomplete="current-password"></label><button class="btn" style="width:100%" type="submit"'+(U.busy?' disabled':'')+'>로그인</button></form>'+
    '<button class="btn ghost" style="width:100%;margin-bottom:12px" data-act="authTab" data-v="signup">처음이에요 · 가입하기</button>'+
    '<p class="sub" style="text-align:center;margin:0 0 12px">비밀번호를 잊으셨으면 선생님께 말씀해 주세요.</p>'+
    '<p style="text-align:center"><button class="lnk" data-act="authTab" data-v="setup">원장님 처음 설정</button></p></div>';
}
function waitView(){
  const rows=U.wait.map(m=>{const nm=(m.name||'')+' '+REL[m.rel];
    const st=m.st==='pending'?'<span class="chip c-warn">선생님 승인 대기</span>':m.st==='block'?'<span class="chip c-bad">이용 제한</span>':m.st==='ok'?'<span class="chip c-ok">연결됨</span>':(m.rel==='student'&&m.grade==='중1'&&!m.guardianOk)?'<span class="chip c-bad">보호자 가입 먼저</span>':'<button class="btn sm" data-act="reclaim">다시 요청</button>';
    return '<div class="row"><div class="grow nm">'+esc(nm)+'</div>'+st+'</div>'}).join('');
  const needG=U.wait.some(m=>m.rel==='student'&&m.grade==='중1'&&!m.guardianOk&&m.st==='none');
  return authHeader('번호가 확인됐어요','선생님이 승인하면 바로 이용할 수 있어요')+'<div class="body"><div class="card"><h3>'+esc(fmtP(ME.phone))+'</h3>'+(rows||'<div class="empty">확인 중...</div>')+'</div>'+
    (needG?'<div class="card"><p style="margin:0" class="sub">만 14세 미만일 수 있어 부모님이 먼저 가입해 승인받으셔야 학생 가입이 열려요. 부모님 승인 뒤 <b>다시 요청</b>을 눌러 주세요.</p></div>':'')+
    '<div class="card"><p class="sub" style="margin:0">이 화면을 닫아도 괜찮아요. 승인되면 다음에 열 때 바로 들어가져요.</p></div>'+installTip()+
    '<button class="btn ghost" style="width:100%" data-act="logout">로그아웃</button></div>';
}

function qrSheet(){
  const q=U.qr||{};const left=q.exp?Math.max(0,Math.ceil((q.exp-5000-now())/1000)):0;
  return '<div class="sheetbg" data-act="close"><div class="sheet" style="text-align:center"><h3>등원 QR</h3><p class="sub" style="margin:0 0 12px">학생이 앱으로 이 화면을 찍으면 승인 요청이 와요</p><div id="qrBox" style="width:min(240px,70%);aspect-ratio:1;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;place-items:center"></div><p style="margin:10px 0 2px;font:700 24px/1.2 \'IBM Plex Sans KR\',sans-serif;letter-spacing:.12em">'+(q.code?q.code.slice(0,3)+' '+q.code.slice(3):'...')+'</p><p class="sub" style="margin:0 0 6px"><b id="qrLeft">'+left+'</b>초 후 새 코드로 바뀌어요 · 카메라가 안 되면 숫자를 입력해도 돼요</p><div style="text-align:left;margin-top:12px" class="card"><h3>승인 대기 <small>'+pending().length+'건</small></h3>'+reqRows()+'</div><button type="button" class="btn ghost" style="width:100%" data-act="close">닫기</button></div></div>';
}
function scanSheet(){
  return '<div class="sheetbg" data-act="close"><div class="sheet" style="text-align:center"><h3>등원 QR 찍기</h3><div id="reader" style="width:min(280px,82%);margin:0 auto 12px;border-radius:16px;overflow:hidden;background:#0b0d1c;min-height:200px"></div><p class="sub" id="scanMsg" style="margin:0 0 12px">선생님 폰 화면의 QR을 네모 안에 맞춰주세요</p><form id="codeF" style="display:flex;gap:8px;margin-bottom:10px"><input id="codeIn" inputmode="numeric" maxlength="7" placeholder="숫자 6자리 직접 입력" style="flex:1;height:46px;border-radius:12px;border:1px solid var(--line);padding:0 12px;font-size:18px;background:var(--soft);letter-spacing:.1em"><button class="btn" type="submit">요청</button></form><button type="button" class="btn ghost" style="width:100%" data-act="close">닫기</button></div></div>';
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
  if(U.page==='mng')return mngView();
  const map={teacher:{home:tHome,att:tAtt,hw:tHw,log:tLog,comm:tComm},student:{home:sHome,hw:sHw,log:myLog,comm:oComm},parent:{home:pHome,att:pAtt,log:myLog,comm:oComm}}[U.role];
  return (map[U.tab]||map.home)()+'<nav class="tabs">'+tabsFor()+'</nav>';
}

let dirty=false;
function render(){
  if(U.sheet==='scan'&&document.getElementById('reader')){dirty=true;return}
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
    else{
      html=appView();
      if(U.role==='teacher'&&!U.sheet)html+=pushBanner();
      if(U.sheet==='qr')html+=qrSheet();else if(U.sheet==='scan')html+=scanSheet();else if(U.sheet==='inst')html+=instSheet();else if(U.sheet)html+=sheetHtml();
      if(!U.sheet&&!U.chat&&!U.update)html+=installBar();
    }
  }catch(err){console.error(err);html=authHeader('잠시 문제가 생겼어요','')+'<div class="body"><div class="card"><p>화면을 그리다 오류가 났어요. 새로고침해 주세요.</p><p class="sub">'+esc(err.message)+'</p><button class="btn" data-act="reload">새로고침</button></div></div>'}
  html+=updBar();
  if(U.toast)html+='<div class="toast" role="status">'+esc(U.toast)+'</div>';
  const sameView=app.dataset.v===(U.screen+U.tab+U.chat+U.page+U.role+U.me);
  app.innerHTML=html;app.dataset.v=U.screen+U.tab+U.chat+U.page+U.role+U.me;
  Object.entries(keep).forEach(([id,k])=>{const el=document.getElementById(id);if(!el)return;if('c' in k){if(el.type==='checkbox'&&id!=='autoN'&&id!=='lgSh')el.checked=k.c}else if(el.tagName!=='SELECT'&&id!=='attDate')el.value=k.v});
  app.querySelectorAll('input[name=hwS]').forEach(el=>{if(el.value in checks)el.checked=checks[el.value]});
  if(focusId){const el=document.getElementById(focusId);if(el){el.focus();try{if(selS!=null)el.setSelectionRange(selS,selE)}catch(e){}}}
  const nb=app.querySelector('.body');
  if(U.chat){const b=document.getElementById('chatBody');if(b)b.scrollTop=b.scrollHeight}
  else if(nb&&sameView)nb.scrollTop=scroll;
  if(U.sheet==='qr')drawQR();
  if(U.sheet==='scan')startScan();
  dirty=false;
}
let rT=null;const sr=()=>{if(rT)return;rT=requestAnimationFrame(()=>{rT=null;render()})};
let tt;
const toast=m=>{U.toast=m;clearTimeout(tt);tt=setTimeout(()=>{U.toast='';render()},2800);render()};
const fail=(e,m)=>{console.error(e);toast(m||('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'))};

/* ================= QR ================= */
let qrTimer=null,qrCountT=null;
function rand6(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+a[0]%900000)}
async function qrRotate(){
  const code=rand6();const exp=now()+35000;U.qr={code,exp};
  try{await setDoc(doc(db,'config','qr'),{code,exp})}catch(e){fail(e,'QR을 만들지 못했어요')}
  if(U.sheet==='qr')render();
}
function qrStart(){qrStop();qrRotate();qrTimer=setInterval(qrRotate,30000);qrCountT=setInterval(()=>{const el=document.getElementById('qrLeft');if(el&&U.qr)el.textContent=Math.max(0,Math.ceil((U.qr.exp-5000-now())/1000))},1000)}
function qrStop(){clearInterval(qrTimer);clearInterval(qrCountT);qrTimer=null;if(U.qr){U.qr=null;setDoc(doc(db,'config','qr'),{code:'',exp:0}).catch(()=>{})}}
function drawQR(){const box=document.getElementById('qrBox');if(!box||!U.qr||!window.QRCode)return;box.innerHTML='';new window.QRCode(box,{text:'TMM'+U.qr.code,width:200,height:200,correctLevel:window.QRCode.CorrectLevel.M})}

let scanner=null;
function startScan(){
  if(scanner||!window.Html5Qrcode){if(!window.Html5Qrcode){const m=document.getElementById('scanMsg');if(m)m.textContent='카메라를 쓸 수 없어요. 선생님 화면의 숫자 6자리를 입력해 주세요.'}return}
  scanner=new window.Html5Qrcode('reader');
  scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:200,height:200}},txt=>{const c=digits(txt).slice(-6);if(c.length===6){stopScan();sendCode(c)}},()=>{})
    .catch(()=>{const m=document.getElementById('scanMsg');if(m)m.textContent='카메라 권한이 없어요. 선생님 화면의 숫자 6자리를 입력해 주세요.';scanner=null});
}
function stopScan(){if(scanner){const s=scanner;scanner=null;s.stop().catch(()=>{}).finally(()=>{try{s.clear()}catch(e){}})}}
async function sendCode(code){
  const s=stu(U.me);U.sheet=null;
  try{await addDoc(collection(db,'reqs'),{sid:s.id,uid:ME.uid,at:hm(),date:TODAY,code,st:'pending',ts:now()});push(['teacher'],'[등원 요청] '+s.name+' 학생이 등원 QR을 찍었어요 ('+hm()+'). 승인해 주세요.',{tag:'req'});toast('선생님께 등원 승인 요청을 보냈어요')}
  catch(e){fail(e,'코드가 맞지 않거나 만료됐어요. 선생님 화면을 다시 찍어주세요.')}
}

/* ================= 데이터 구독 ================= */
let baseUnsubs=[],dataUnsubs=[];
const stopData=()=>{dataUnsubs.forEach(f=>f());dataUnsubs=[]};
const stopAll=()=>{stopData();baseUnsubs.forEach(f=>f());baseUnsubs=[]};
const L=(q,fn)=>dataUnsubs.push(onSnapshot(q,fn,e=>console.warn('구독 오류',e.code)));
const B=(q,fn)=>baseUnsubs.push(onSnapshot(q,fn,e=>console.warn('구독 오류',e.code)));
const sortMsgs=l=>l.sort((a,b)=>(a.ts||0)-(b.ts||0));
const sortStu=()=>D.students.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
function resetD(){Object.assign(D,{students:[],att:{},threads:{},hw:[],logs:[],notices:[],req:[],members:[]})}

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
}
function subFamily(){
  resetD();const attBy={};
  const rebuildAtt=()=>{D.att={};Object.values(attBy).flat().forEach(x=>{(D.att[x.date]||(D.att[x.date]={}))[x.sid]=x})};
  ME.sids.forEach(sid=>{
    L(doc(db,'students',sid),d=>{D.students=D.students.filter(x=>x.id!==sid);if(d.exists())D.students.push({id:d.id,...d.data()});sortStu();sr()});
    L(query(collection(db,'att'),where('sid','==',sid)),s=>{attBy[sid]=docs(s);rebuildAtt();sr()});
    L(query(collection(db,'hw'),where('sid','==',sid)),s=>{D.hw=D.hw.filter(h=>h.sid!==sid).concat(docs(s));sr()});
    L(query(collection(db,'logs'),where('sid','==',sid),where('sh','==',true)),s=>{D.logs=D.logs.filter(h=>h.sid!==sid).concat(docs(s));sr()});
    L(query(collection(db,'reqs'),where('sid','==',sid),where('st','==','pending')),s=>{D.req=D.req.filter(h=>h.sid!==sid).concat(docs(s).filter(q=>q.date===TODAY));sr()});
  });
  ME.ths.forEach(th=>L(query(collection(db,'msgs'),where('th','==',th)),s=>{D.threads[th]=sortMsgs(docs(s));if(U.chat===th)markRead(th);sr()}));
  L(collection(db,'notices'),s=>{D.notices=docs(s);sr()});
}
function famRole(){U.role=ME.rels[U.me]==='student'?'student':'parent'}

/* ================= 로그인 흐름 ================= */
onAuthStateChanged(auth,user=>{
  stopAll();U.famStarted=false;U.famSig=null;U.claimed=false;U.comm='msg';U.hwF='all';U.calS='all';U.pushX={};U.me=null;U.logS=null;U.ret=null;U.lf=null;qrStop();ME.uid=null;U.sheet=null;U.chat=null;U.page=null;U.tab='home';
  if(!user){U.screen='auth';render();return}
  ME.uid=user.uid;ME.phone=phoneOf(user);U.screen='loading';render();
  B(doc(db,'config','main'),d=>{
    D.cfg=d.exists()?d.data():null;D.autoNotify=D.cfg?D.cfg.autoNotify!==false:true;
    if(!D.cfg){if(U.pendingSetup)return;U.screen='auth';U.authMsg='아직 원장님 설정이 안 된 앱이에요.';render();return}
    if(D.cfg.owner===ME.uid){if(U.role!=='teacher'||U.screen!=='app'){U.role='teacher';U.screen='app';stopData();subTeacher()}sr();return}
    if(!U.famStarted){U.famStarted=true;startFamily()}
    sr();
  });
});
function startFamily(){
  B(doc(db,'users',ME.uid),d=>{
    const p=d.exists()?d.data():{};const sids=p.sids||[];
    const sig=JSON.stringify([sids,p.ths||[]]);
    if(sids.length){
      if(sig!==U.famSig){U.famSig=sig;ME.sids=sids;ME.rels=p.rels||{};ME.ths=p.ths||[];if(!sids.includes(U.me))U.me=sids[0];famRole();U.screen='app';stopData();subFamily()}
      sr();
    }else{U.famSig=null;ME.sids=[];stopData();U.screen='wait';watchMembers()}
  });
}
let memUnsub=null;
function watchMembers(){
  if(memUnsub)return;
  memUnsub=onSnapshot(query(collection(db,'members'),where('phone','==',ME.phone)),async s=>{
    const ms=docs(s);U.wait=ms;
    if(!ms.length){memUnsub();memUnsub=null;const u=auth.currentUser;U.authMsg='등록되지 않은 번호예요. 선생님께 번호 등록을 요청해 주세요.';U.authTab='login';try{await deleteUser(u)}catch(e){await signOut(auth)}return}
    if(!U.claimed){U.claimed=true;await claim(ms)}
    sr();
  },e=>console.warn(e));
  baseUnsubs.push(()=>{if(memUnsub){memUnsub();memUnsub=null}});
}
async function claim(ms){
  const go=ms.filter(m=>m.st==='none'&&!(m.rel==='student'&&m.grade==='중1'&&!m.guardianOk));
  const done=[];for(const m of go){try{await updateDoc(doc(db,'members',m.id),{st:'pending',uid:ME.uid,at:hm()});done.push(m)}catch(e){console.warn(e)}}
  if(done.length)push(['teacher'],'[가입 요청] '+done.map(m=>(m.name||'')+' '+REL[m.rel]).join(', ')+' 가입을 승인해 주세요.',{tag:'join'});
}

/* ================= 쓰기 도우미 ================= */
const msg=(th,sid,f,t)=>addDoc(collection(db,'msgs'),{th,sid,f,t,at:stamp(),ts:now(),r:false});
const isTeacher=()=>U.role==='teacher'&&D.cfg&&D.cfg.owner===ME.uid;
const push=(targets,text,opts)=>{sendPush(db,auth,targets,text,Object.assign({prune:isTeacher()},opts||{}))};
const famName=()=>{const s=stu(U.me);return (s?s.name:'')+(U.role==='student'?' 학생':' 학부모님')};
function notifyParent(sid,text){if(!D.autoNotify)return Promise.resolve();push([sid+'|parent'],text);return msg(sid+'|parent',sid,'s',text).catch(e=>console.warn(e))}
function pushHelp(){
  const android=/Android/i.test(navigator.userAgent);
  const sysPath='휴대폰 <b>설정 → 애플리케이션 → '+(isSamsung()?'삼성 인터넷':'사용 중인 인터넷 앱')+' → 알림 → 알림 허용</b>이 켜져 있는지도 확인해 주세요.';
  const samPath='삼성 인터넷 <b>메뉴(≡) → 설정 → 사이트 및 다운로드 → 사이트 알림</b>에서 알림을 켜고, 오른쪽 위 <b>⋮ → 허용 또는 차단된 사이트</b>에 더밀착수학이 차단돼 있으면 허용으로 바꿔 주세요.';
  const chrPath='크롬은 주소창 왼쪽 <b>자물쇠(또는 종) → 권한 → 알림 → 허용</b>.';
  if(android&&isStandalone())return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>아래 버튼으로 인터넷 앱(삼성 인터넷)에서 열어 [알림 받기]를 누르면 이 앱에도 적용돼요.<a class="btn" style="display:flex;align-items:center;justify-content:center;margin-top:8px;text-decoration:none" href="intent://themilchak-math.github.io/#Intent;scheme=https;end">인터넷 앱에서 열어 알림 켜기</a><span class="sub" style="display:block;margin-top:6px">'+samPath+' '+sysPath+'</span></div>';
  if(android)return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>'+(isSamsung()?samPath:(/Chrome/i.test(navigator.userAgent)?chrPath+' ⋮ → 설정 → 사이트 설정 → 알림에서 <b>조용한 메시지 사용</b>을 끄면 다음부터 창이 떠요.':samPath+' '+chrPath))+'<br>'+sysPath+' 바꾼 뒤 이 화면을 새로고침하고 다시 눌러 주세요.</div>';
  return '<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14px"><b>허용 창이 안 보이나요?</b><br>아이폰 <b>설정 → 알림 → 더밀착수학</b>에서 알림 허용을 켠 뒤 앱을 다시 열어 눌러 주세요.</div>';
}
function pushCard(){
  const st=pushState(ME.uid);if(st==='off'||st==='on'||U.pushHide)return '';
  let inner;
  if(st==='ios-install')inner='<p class="sub" style="margin:0">아이폰은 <b>홈 화면에 설치한 앱</b>에서만 알림을 받을 수 있어요. 공유 버튼 → 홈 화면에 추가 후, 설치된 앱에서 다시 열어 주세요.</p>';
  else if(st==='unsupported')inner='<p class="sub" style="margin:0">이 브라우저는 알림을 지원하지 않아요. '+(pushIOS()?'iOS 16.4 이상으로 업데이트해 주세요.':'삼성 인터넷 또는 크롬을 최신으로 업데이트해 주세요.')+'</p>';
  else if(st==='denied')inner='<p class="sub" style="margin:0">알림이 차단돼 있어요. 휴대폰 <b>설정 → 알림</b>(또는 브라우저 사이트 설정)에서 더밀착수학 알림을 허용해 주세요.</p>';
  else inner='<p class="sub" style="margin:0 0 10px">'+(U.role==='teacher'?'등원·가입 요청, 숙제 완료, 메시지가 오면':U.role==='student'?'새 숙제, 하원 가능, 메시지·공지가 오면':'등·하원, 수업 기록, 메시지·공지가 오면')+' 앱이 꺼져 있어도 알려 드려요.</p><button class="btn" style="width:100%" data-act="pushOn"'+(U.pushBusy?' disabled':'')+'>'+(U.pushBusy?'알림 켜는 중... (허용 창이 뜨면 [허용])':'알림 받기')+'</button>'+(U.pushErr?'<p style="margin:10px 0 0;color:var(--acc);font-size:14px;font-weight:700">'+esc(U.pushErr)+'</p>':'')+(U.pushHint?pushHelp():'')+'';
  return '<div class="card" style="border-color:var(--pri)"><h3>알림 받기 <button class="btn sm ghost" data-act="pushHide" aria-label="닫기">나중에</button></h3>'+inner+'</div>';
}
function markRead(k){
  const other=U.role==='teacher'?['o']:['t','s'];const l=thread(k).filter(m=>other.includes(m.f)&&!m.r&&m.id);
  if(!l.length)return;const b=writeBatch(db);l.forEach(m=>{m.r=true;b.update(doc(db,'msgs',m.id),{r:true})});b.commit().catch(e=>console.warn(e));
}
const thOf=(sid,rel)=>sid+'|'+(rel==='student'?'student':'parent');
async function linkUser(b,m){
  b.update(doc(db,'members',m.id),{st:'ok'});
  b.set(doc(db,'users',m.uid),{phone:m.phone,sids:arrayUnion(m.sid),rels:{[m.sid]:m.rel},ths:arrayUnion(thOf(m.sid,m.rel))},{merge:true});
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
  if(a==='instX'){U.noInstall=true;try{localStorage.setItem('tmm-noinst','1')}catch(e){}return render()}
  if(a==='pushOn'){if(U.pushBusy)return;U.pushBusy=true;U.pushErr='';U.pushHint=false;render();const hintT=setTimeout(()=>{if(U.pushBusy){U.pushHint=true;render()}},5000);try{await enablePush(db,ME.uid,U.role==='teacher'?['teacher']:ME.ths);clearTimeout(hintT);U.pushBusy=false;U.pushHint=false;toast('알림이 켜졌어요')}catch(e){clearTimeout(hintT);U.pushBusy=false;U.pushErr=pushErrorText(e);U.pushHint=/permission|dismissed|denied/.test(String(e.message));render()}return render()}
  if(a==='pushHide'){U.pushHide=true;return render()}
  if(a==='authTab'){U.authTab=v;U.authMsg='';return render()}
  if(a==='logout'){qrStop();stopScan();U.famStarted=false;U.claimed=false;U.famSig=null;U.authMsg='';U.authTab='login';await signOut(auth);return}
  if(a==='reclaim'){await claim(U.wait);return toast('다시 요청했어요')}
  if(a==='go'){U.tab=el.dataset.tab;if(el.dataset.comm)U.comm=el.dataset.comm;U.chat=null;U.page=null;return render()}
  if(a==='back'){U.chat=null;U.page=null;return render()}
  if(a==='page'){U.page=v;return render()}
  if(a==='calM'){let [y,m]=U.calM.split('-').map(Number);m+=+v;if(m<1){m=12;y--}if(m>12){m=1;y++}U.calM=y+'-'+pad(m);return render()}
  if(a==='calD'){U.calD=v;return render()}
  if(a==='calS'){U.calS=v;return render()}
  if(a==='open'){U.chat=el.dataset.k;markRead(U.chat);return render()}
  if(a==='sheet'){
    if(el.dataset.s==='log'||el.dataset.s==='hw'){if(!D.students.length)return toast('학생을 먼저 등록해 주세요');}
    U.sheet=el.dataset.s;if(U.sheet==='log')initLf(U.logS||D.students[0].id);if(U.sheet==='qr')qrStart();return render()}
  if(a==='close'){if(U.sheet==='qr')qrStop();if(U.sheet==='scan')stopScan();U.sheet=null;U.ret=null;U.lf=null;return render()}
  if(a==='comm'){U.comm=v;return render()}
  if(a==='hwF'){U.hwF=v;return render()}
  if(a==='logS'){U.logS=v;return render()}
  if(a==='pc'){U.pc[id]=v;return render()}
  if(a==='pushX'){U.pushX[id]=1;return render()}
  if(a==='lfS'){initLf(v);return render()}
  if(a==='lfU'){U.lf.unit=v;if(v!=='__x'){const l=lastOf(U.lf.sid,U.lf.course,v);U.lf.c=l?l.c:null;U.lf.p=l?l.p:null}return render()}
  if(a==='lfC'){U.lf.c=+v;return render()}
  if(a==='lfP'){U.lf.p=+v;return render()}
  if(a==='lfCm'){U.lf.showCm=true;return render()}
  if(a==='logFor'){U.logS=id;U.sheet='log';U.ret='att';initLf(id);return render()}

  // 가입 승인·관리
  if(a==='mOk'){const m=D.members.find(x=>x.id===id);if(!m||!m.uid)return;const all=D.members.filter(x=>x.uid===m.uid&&x.st==='pending');const b=writeBatch(db);all.forEach(x=>linkUser(b,x));await b.commit();
    for(const x of all){if(x.rel!=='student')await msg(thOf(x.sid,x.rel),x.sid,'s','[가입 승인] '+mLabel(x)+'으로 연결되었어요. 환영합니다!')}
    push([...new Set(all.map(x=>thOf(x.sid,x.rel)))],'[가입 승인] 더밀착수학 앱 이용이 승인됐어요. 앱을 열어 주세요.');
    return toast(all.map(mLabel).join(', ')+' 승인 완료')}
  if(a==='mRej'){const m=D.members.find(x=>x.id===id);const all=D.members.filter(x=>x.uid&&x.uid===m.uid&&x.st==='pending');const b=writeBatch(db);all.forEach(x=>b.update(doc(db,'members',x.id),{st:'none',uid:deleteField()}));await b.commit();return toast(mLabel(m)+' 가입을 거절했어요')}
  if(a==='mBlock'||a==='mReset'){const m=D.members.find(x=>x.id===id);const b=writeBatch(db);
    b.update(doc(db,'members',m.id),a==='mBlock'?{st:'block'}:{st:'none',uid:deleteField()});
    if(m.uid)b.set(doc(db,'users',m.uid),{sids:arrayRemove(m.sid),ths:arrayRemove(thOf(m.sid,m.rel))},{merge:true});await b.commit();
    return toast(a==='mBlock'?mLabel(m)+' 접속을 차단했어요':'재가입 가능 상태로 바꿨어요. Firebase 콘솔 Authentication에서 '+fmtP(m.phone)+' 계정을 삭제해 주세요.')}
  if(a==='mUnblock'){const m=D.members.find(x=>x.id===id);if(!m.uid)return;const b=writeBatch(db);linkUser(b,m);await b.commit();return toast('차단을 해제했어요')}

  // 등원
  if(a==='ok'||a==='rej'){
    const q=D.req.find(x=>x.id===id);if(!q)return;const s=stu(q.sid);
    if(a==='rej'){await updateDoc(doc(db,'reqs',q.id),{st:'rej'});await msg(q.sid+'|student',q.sid,'s','[등원 요청 반려] 선생님께 직접 말씀드려 주세요.');push([q.sid+'|student'],'[등원 요청 반려] 선생님께 직접 말씀드려 주세요.');return toast(s.name+' 등원 요청을 거절했어요')}
    const st=q.at>s.time?'지각':'출석';const b=writeBatch(db);
    b.update(doc(db,'reqs',q.id),{st:'ok'});
    b.set(doc(db,'att',TODAY+'_'+q.sid),{sid:q.sid,date:TODAY,st,at:q.at,by:'qr',logged:loggedOn(q.sid,TODAY)});
    await b.commit();
    await notifyParent(q.sid,'[등원 알림] '+s.name+' 학생이 '+q.at+'에 등원했습니다. (QR 확인 · 선생님 승인'+(st==='지각'?' · 수업 '+s.time+' 시작, 지각':'')+')');
    return toast(s.name+' '+st+' 승인'+(D.autoNotify?' · 학부모 알림 발송':''));
  }
  if(a==='cancelReq'){await deleteDoc(doc(db,'reqs',id));return toast('요청을 취소했어요')}
  if(a==='checkout'){
    const s=stu(U.me);const r=(D.att[TODAY]||{})[s.id];if(!r||!r.logged)return toast('아직 하원할 수 없어요');
    const out=hm();await updateDoc(doc(db,'att',TODAY+'_'+s.id),{out});const lg=D.logs.filter(l=>l.sid===s.id&&l.date===TODAY).pop();
    await notifyParent(s.id,'[하원 알림] '+s.name+' 학생이 '+out+'에 하원했습니다.'+(lg?' 오늘 수업: '+lg.course+' '+lg.unit:''));
    return toast('하원 완료! 수고했어요');
  }
  if(a==='absent'){const s=stu(id);await setDoc(doc(db,'att',U.attDate+'_'+id),{sid:id,date:U.attDate,st:'결석',at:'',by:'teacher'});if(U.attDate===TODAY)await notifyParent(id,'[출결 알림] '+s.name+' 학생이 오늘 결석으로 처리되었습니다.');return toast('결석 처리했어요')}
  if(a==='unabsent'){await deleteDoc(doc(db,'att',U.attDate+'_'+id));return toast('결석을 취소했어요')}

  // 숙제·기록·공지
  if(a==='hwCheck'){await updateDoc(doc(db,'hw',id),{st:'checked'});return toast('숙제 확인 완료')}
  if(a==='hwDel'){await deleteDoc(doc(db,'hw',id));return toast('숙제를 삭제했어요')}
  if(a==='hwDone'){const h=D.hw.find(x=>x.id===id);await updateDoc(doc(db,'hw',id),{st:'done'});await msg(h.sid+'|student',h.sid,'o','[숙제 완료] '+h.title);push(['teacher'],'[숙제 완료] '+(stu(h.sid)||{}).name+': '+h.title);return toast('선생님께 완료를 알렸어요')}
  if(a==='togSh'){const x=D.logs.find(l=>l.id===id);await updateDoc(doc(db,'logs',id),{sh:!x.sh});return toast(x.sh?'비공개로 바꿨어요':'공유했어요')}
  if(a==='delLog'){await deleteDoc(doc(db,'logs',id));return toast('기록을 삭제했어요')}
  if(a==='readN'){await updateDoc(doc(db,'notices',id),{reads:arrayUnion(ME.uid)});return}
  if(a==='delN'){await deleteDoc(doc(db,'notices',id));return toast('공지를 삭제했어요')}
  }catch(err){fail(err)}
});

app.addEventListener('change',async e=>{
  const t=e.target;
  try{
  if(t.id==='whoSel'){U.me=t.value;famRole();U.chat=null;U.tab='home';return render()}
  if(t.id==='attDate'&&t.value){U.attDate=t.value;return render()}
  if(t.id==='autoN'){await updateDoc(doc(db,'config','main'),{autoNotify:t.checked});return toast(t.checked?'자동 알림 켬':'자동 알림 끔')}
  if(t.id==='lfCourse'){U.lf.course=t.value;U.lf.unit=null;U.lf.c=null;U.lf.p=null;return render()}
  if(t.id==='lgSh'&&U.lf)U.lf.sh=t.checked;
  }catch(err){fail(err)}
});
app.addEventListener('input',e=>{if(!U.lf)return;if(e.target.id==='lgM')U.lf.cm=e.target.value;if(e.target.id==='lfUx')U.lf.ux=e.target.value});
function initLf(sid){const s=stu(sid);const l=latest(sid);const course=l?l.course:s.course;let unit=null,c=null,p=null;if(l&&!(l.c===100&&l.p===100)){unit=l.unit;c=l.c;p=l.p}else if(l){const nx=unitsOf(sid,course).find(u=>{const x=lastOf(sid,course,u);return !x||x.c<100||x.p<100});if(nx){unit=nx;const x=lastOf(sid,course,nx);c=x?x.c:null;p=x?x.p:null}}U.lf={sid,course,unit,c,p,cm:'',ux:'',showCm:false,sh:true};U.logS=sid}

const authErr=c=>({'auth/email-already-in-use':'이미 가입된 번호예요. 로그인해 주세요.','auth/invalid-credential':'번호나 비밀번호가 맞지 않아요.','auth/wrong-password':'번호나 비밀번호가 맞지 않아요.','auth/user-not-found':'가입되지 않은 번호예요.','auth/weak-password':'비밀번호는 6자리 이상이에요.','auth/too-many-requests':'잠시 후 다시 시도해 주세요.','auth/network-request-failed':'인터넷 연결을 확인해 주세요.'}[c]||'문제가 생겼어요 ('+c+')');

app.addEventListener('submit',async e=>{
  e.preventDefault();
  const g=id=>(document.getElementById(id)||{}).value||'';
  const fid=e.target.id;
  try{
  if(fid==='loginF'){const ph=digits(g('lP'));if(ph.length<10)return toast('휴대폰번호를 정확히 입력해 주세요');U.busy=true;U.authMsg='';render();
    try{await signInWithEmailAndPassword(auth,ph+MAIL,g('lW'))}catch(err){U.authMsg=authErr(err.code)}U.busy=false;return render()}
  if(fid==='signupF'){const ph=digits(g('jP'));
    if(ph.length<10)return toast('휴대폰번호를 정확히 입력해 주세요');
    if(g('jW').length<6)return toast('비밀번호는 6자리 이상이에요');
    if(g('jW')!==g('jW2'))return toast('비밀번호 확인이 맞지 않아요');
    if(!document.getElementById('jA').checked)return toast('개인정보 수집·이용 동의가 필요해요');
    U.busy=true;U.authMsg='';U.claimed=false;render();
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
  if(fid==='codeF'){const c=digits(g('codeIn'));if(c.length!==6)return toast('숫자 6자리를 입력해 주세요');stopScan();return sendCode(c)}
  if(fid==='sendF'){const t=g('msgIn').trim();if(!t)return;const [sid]=U.chat.split('|');document.getElementById('msgIn').value='';await msg(U.chat,sid,U.role==='teacher'?'t':'o',t);if(U.role==='teacher')push([U.chat],t,{title:TNAME()+' 메시지',tag:'m'+U.chat});else push(['teacher'],t,{title:famName()+' 메시지',tag:'m'+U.chat});return}
  if(U.sheet==='hw'){
    const ids=[...document.querySelectorAll('input[name=hwS]:checked')].map(x=>x.value);const title=g('hwT').trim();
    if(!ids.length||!title)return toast('학생과 제목을 입력해 주세요');
    const due=g('hwD')||TODAY;const b=writeBatch(db);
    ids.forEach(sid=>{b.set(doc(collection(db,'hw')),{sid,title,range:g('hwR').trim()||'-',due,st:'todo',note:'',ts:now()});b.set(doc(collection(db,'msgs')),{th:sid+'|student',sid,f:'s',t:'[새 숙제] '+title+' · 마감 '+fmtD(due),at:stamp(),ts:now(),r:false})});
    await b.commit();push(ids.map(x=>x+'|student'),'[새 숙제] '+title+' · 마감 '+fmtD(due));U.sheet=null;return toast(ids.length+'명에게 숙제를 냈어요');
  }
  if(U.sheet==='notice'){
    if(!g('nT').trim())return toast('제목을 입력해 주세요');
    await addDoc(collection(db,'notices'),{title:g('nT').trim(),body:g('nB').trim(),at:TODAY,pin:document.getElementById('nP').checked,reads:[],ts:now()});push(D.students.flatMap(x=>[x.id+'|student',x.id+'|parent']),g('nT').trim(),{title:'새 공지',tag:'notice'});
    U.sheet=null;U.tab='comm';U.comm='notice';return toast('공지를 올렸어요');
  }
  if(U.sheet==='log'){
    const f=U.lf;const unit=f.unit==='__x'?(f.ux||'').trim():f.unit;
    if(!unit)return toast('단원을 선택해 주세요');
    if(f.c==null||f.p==null)return toast('개념·문제풀이 진행률을 선택해 주세요');
    const sid=f.sid;const s=stu(sid);const r=(D.att[TODAY]||{})[sid];const open=r&&r.st!=='결석'&&!r.out;
    const b=writeBatch(db);
    b.set(doc(collection(db,'logs')),{sid,date:TODAY,course:f.course,unit,c:f.c,p:f.p,cm:(f.cm||'').trim(),sh:f.sh,ts:now()});
    if(s.course!==f.course)b.update(doc(db,'students',sid),{course:f.course});
    if(r)b.update(doc(db,'att',TODAY+'_'+sid),{logged:true});
    if(open)b.set(doc(collection(db,'msgs')),{th:sid+'|student',sid,f:'s',t:'[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.',at:stamp(),ts:now(),r:false});
    await b.commit();
    if(open)push([sid+'|student'],'[하원 가능] 오늘 학습 정리가 올라왔어요. 하원 체크를 해주세요.');
    if(f.sh)await notifyParent(sid,'[수업 기록] '+fmtD(TODAY)+' '+f.course+' '+unit+' · 개념 '+f.c+'% · 문제풀이 '+f.p+'%');
    U.pc[sid]=f.course;U.logS=sid;U.sheet=null;U.lf=null;U.tab=U.ret||'log';U.ret=null;return toast(open?'정리 완료 · 하원이 열렸어요':'기록을 저장했어요');
  }
  if(U.sheet==='stu'){
    const name=g('stN').trim();const ph={student:digits(g('pS')),father:digits(g('pF')),mother:digits(g('pM'))};
    if(!name)return toast('학생 이름을 입력해 주세요');
    if(Object.values(ph).some(x=>x&&(x.length<10||x.length>11)))return toast('휴대폰번호를 확인해 주세요');
    if(!Object.values(ph).some(x=>x))return toast('번호를 하나 이상 등록해 주세요');
    const grade=g('stG');const course={중1:'중1-2',중2:'중2-2',중3:'중3-2',고1:'공통수학2',고2:'대수',고3:'미적분Ⅰ'}[grade];
    const b=writeBatch(db);const sref=doc(collection(db,'students'));const sid=sref.id;
    b.set(sref,{name,grade,time:g('stT')||'16:00',course,ts:now()});
    const autoLinked=[];
    Object.entries(ph).forEach(([rel,p])=>{if(!p)return;const ex=rel!=='student'&&D.members.find(m=>m.phone===p&&m.st==='ok'&&m.uid);const mref=doc(collection(db,'members'));
      const m={sid,rel,phone:p,st:ex?'ok':'none',name,grade,guardianOk:false};if(ex){m.uid=ex.uid;autoLinked.push(ex)}b.set(mref,m);
      if(ex)b.set(doc(db,'users',ex.uid),{sids:arrayUnion(sid),rels:{[sid]:rel},ths:arrayUnion(thOf(sid,rel))},{merge:true})});
    await b.commit();U.sheet=null;
    U.page='mng';return toast(name+' 등록 완료'+(autoLinked.length?' · 형제 부모님 계정에 자동 연결':' · [안내 문자]로 가입 안내를 보내세요'));
  }
  }catch(err){U.busy=false;fail(err)}
});

/* ================= 앱 업데이트·설치 ================= */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    const show=w=>{U.update=w;render()};
    if(reg.waiting&&navigator.serviceWorker.controller)show(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)show(w)})});
    setInterval(()=>reg.update().catch(()=>{}),30*60*1000);
  }).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded)return;reloaded=true;location.reload()});
}
try{U.noInstall=localStorage.getItem('tmm-noinst')==='1'}catch(e){}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();U.bip=e;render()});
window.addEventListener('appinstalled',()=>{U.bip=null;toast('설치됐어요! 홈 화면에서 열어 주세요')});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ds(new Date())!==TODAY)location.reload()});
render();
