// 일정 달력: 공휴일(대한민국) · 등록 일정(시험·휴무·특수) · 학생 생일을 한 달 달력에 표시
// 공휴일: 우주항공청 월력요항 기준으로 2026·2027년은 앱에 내장, 그 밖의 해는 공개 공휴일 API(date.nager.at)에서 받아와요.

const BUILTIN = {
  2026: {
    '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-01': '노동절', '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일',
    '2026-07-17': '제헌절', '2026-08-15': '광복절', '2026-08-17': '대체공휴일',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절'
  },
  2027: {
    '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일',
    '2027-03-01': '삼일절', '2027-05-01': '노동절', '2027-05-03': '대체공휴일', '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-07-17': '제헌절', '2027-07-19': '대체공휴일',
    '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절', '2027-10-04': '대체공휴일', '2027-10-09': '한글날', '2027-10-11': '대체공휴일',
    '2027-12-25': '성탄절', '2027-12-27': '대체공휴일'
  }
};
const cache = {}; const loading = {};
// 공휴일 목록(동기). 내장 자료가 없는 해는 처음 부를 때 받아오고, 받아오면 onReady를 불러 화면을 다시 그려요.
export function holidays(year, onReady) {
  if (BUILTIN[year]) return BUILTIN[year];
  if (cache[year]) return cache[year];
  try { const s = localStorage.getItem('tmm-holi-' + year); if (s) { cache[year] = JSON.parse(s); return cache[year]; } } catch (e) { }
  if (!loading[year]) {
    loading[year] = true;
    fetch('https://date.nager.at/api/v3/PublicHolidays/' + year + '/KR').then(r => r.ok ? r.json() : []).then(l => {
      const m = {}; (l || []).forEach(h => { m[h.date] = h.localName || h.name; }); cache[year] = m;
      try { localStorage.setItem('tmm-holi-' + year, JSON.stringify(m)); } catch (e) { }
      if (onReady) onReady();
    }).catch(() => { cache[year] = {}; });
  }
  return {};
}

const pad = n => String(n).padStart(2, '0');
const KIND = { exam: ['시험', 'ex'], off: ['휴무', 'off'], event: ['일정', 'ev'] };

// items: [{date:'YYYY-MM-DD', text, cls}] — cls: hol / ex / off / ev / bd
export function buildItems(ym, { exams = [], students = [], birthOf = null, onReady } = {}) {
  const [y, m] = ym.split('-').map(Number); const nd = new Date(y, m, 0).getDate(); const out = [];
  const H = holidays(y, onReady);
  for (const [d, n] of Object.entries(H)) if (d.startsWith(ym)) out.push({ date: d, text: n, cls: 'hol' });
  for (const e of exams) {
    const k = KIND[e.kind || 'exam']; const a = e.start, b = e.end || e.start;
    for (let d = 1; d <= nd; d++) { const ds = ym + '-' + pad(d); if (ds >= a && ds <= b) out.push({ date: ds, text: ((e.kind || 'exam') !== 'off' && e.school ? e.school + ' ' : '') + e.title, cls: k[1], first: ds === a || d === 1 }); }
  }
  if (birthOf) for (const s of students) { const b = birthOf(s); if (!b || b.length < 10) continue; if (b.slice(5, 7) === pad(m)) out.push({ date: ym + '-' + b.slice(8, 10), text: s.name + ' 생일', cls: 'bd' }); }
  return out;
}

const CSS = `.mcal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}
.mcal>div{border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-height:84px;padding:4px;overflow:hidden;min-width:0}
.mcal .wd{min-height:0;text-align:center;font-size:12px;font-weight:700;color:var(--mut);padding:6px 0;background:var(--soft)}
.mcal .dn{font-size:12px;font-weight:700;margin-bottom:2px}
.mcal .sun .dn,.mcal .hd .dn,.mcal .wd.sun{color:#e5484d}.mcal .sat .dn,.mcal .wd.sat{color:#3b6cf6}
.mcal .out{background:var(--soft);opacity:.45}.mcal .tdy{box-shadow:inset 0 0 0 2px var(--pri)}
.ci{font-size:11px;line-height:1.35;border-radius:5px;padding:1px 4px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci.hol{color:#e5484d;background:rgba(229,72,77,.1)}.ci.ex{color:#b86e00;background:rgba(240,180,64,.18)}
.ci.off{color:#fff;background:#e5484d}.ci.ev{color:var(--pri);background:rgba(43,68,255,.12)}.ci.bd{color:#c2410c;background:rgba(249,115,22,.14)}
.mcal-lg{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;font-size:12px}.mcal-lg .ci{display:inline-block;margin:0}
@media(max-width:600px){.mcal>div{min-height:62px;padding:2px}.ci{font-size:9.5px;padding:0 2px}.mcal .dn{font-size:11px}}`;
let styled = false;
export function calHtml(ym, items, today) {
  if (!styled && typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  const [y, m] = ym.split('-').map(Number); const first = new Date(y, m - 1, 1).getDay(); const nd = new Date(y, m, 0).getDate();
  const by = {}; items.forEach(i => (by[i.date] || (by[i.date] = [])).push(i));
  const ord = { off: 0, hol: 1, ex: 2, ev: 3, bd: 4 };
  let h = '<div class="mcal">' + '일월화수목금토'.split('').map((w, i) => '<div class="wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>').join('');
  for (let i = 0; i < first; i++) h += '<div class="out"></div>';
  for (let d = 1; d <= nd; d++) {
    const ds = ym + '-' + pad(d); const w = (first + d - 1) % 7; const l = (by[ds] || []).sort((a, b) => ord[a.cls] - ord[b.cls]);
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    h += '<div class="' + (w === 0 ? 'sun' : w === 6 ? 'sat' : '') + (l.some(x => x.cls === 'hol') ? ' hd' : '') + (ds === today ? ' tdy' : '') + '"><div class="dn">' + d + '</div>' + l.map(x => '<div class="ci ' + x.cls + '" title="' + esc(x.text) + '">' + (x.cls === 'bd' ? '🎂 ' : '') + esc(x.text) + '</div>').join('') + '</div>';
  }
  const tail = (7 - (first + nd) % 7) % 7; for (let i = 0; i < tail; i++) h += '<div class="out"></div>';
  return h + '</div><div class="mcal-lg"><span class="ci hol">공휴일</span><span class="ci off">교습소 휴무</span><span class="ci ex">시험기간</span><span class="ci ev">특수 일정</span><span class="ci bd">🎂 생일</span></div>';
}
