// 소식 게시판 (공지 + 자료실 + 앨범 + 가정통신문) — 폰 앱·관리자 공용
// 글은 Firestore notices 컬렉션 (예전 공지는 cat 없음 = 공지)
// 첨부파일은 Cloudflare R2 (push 서버 /file) — 로그인한 앱 사용자만 열 수 있어요
import { PUSH_URL } from './push.js';

export const CATS = [['notice', '📢 공지'], ['data', '📂 자료실'], ['album', '📸 앨범'], ['letter', '📰 가정통신문']];
export const catOf = n => (n && n.cat) || 'notice';
export const catLabel = c => (CATS.find(x => x[0] === c) || CATS[0])[1];
export const catPush = c => ({ notice: '새 공지', data: '새 자료', album: '새 앨범', letter: '가정통신문' })[c] || '새 소식';
export const MAX_FILE = 50 * 1024 * 1024;

/* ---------- 로그인 토큰 (첨부 보기용) ---------- */
let TOK = '', TOKAT = 0;
export async function freshToken(auth, force) {
  if (!auth || !auth.currentUser) { TOK = ''; return ''; }
  if (force || !TOK || Date.now() - TOKAT > 40 * 60e3) { TOK = await auth.currentUser.getIdToken(!!force); TOKAT = Date.now(); }
  return TOK;
}
export const fileUrl = (k, dl) => PUSH_URL + '/file/' + k + '?a=' + encodeURIComponent(TOK) + (dl ? '&dl=1' : '');

/* ---------- 사진 줄이기 (긴 변 1600px, JPEG) ---------- */
export async function shrinkImage(file, max = 1600, q = 0.82) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '')) return null;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)); const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    if (s === 1 && file.size < 500 * 1024 && /jpeg/i.test(file.type)) { bmp.close && bmp.close(); return { blob: file, w, h }; }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (!blob) return null;
    return { blob, w, h };
  } catch (e) { return null; }
}

/* ---------- 올리기·지우기·용량 ---------- */
export async function uploadFile(auth, file) {
  const tok = await freshToken(auth);
  let body = file, type = file.type || 'application/octet-stream', name = file.name || 'file', w = 0, h = 0, img = /^image\//.test(type);
  if (img) { const s = await shrinkImage(file); if (s) { body = s.blob; w = s.w; h = s.h; if (s.blob !== file) { type = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; } } }
  if (body.size > MAX_FILE) throw new Error(name + ': 50MB가 넘어요. 큰 파일은 구글 드라이브 링크로 붙여 주세요');
  const r = await fetch(PUSH_URL + '/file', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': type, 'X-Name': encodeURIComponent(name) }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.k) throw new Error(name + ': 올리지 못했어요' + (j.error ? ' (' + j.error + ')' : ''));
  return { k: j.k, name, size: j.size || body.size, type, img, w, h };
}
export async function deleteFiles(auth, keys) {
  if (!keys || !keys.length) return;
  const tok = await freshToken(auth);
  await fetch(PUSH_URL + '/file-del', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) }).catch(() => { });
}
export async function storageUsage(auth) {
  const tok = await freshToken(auth);
  const r = await fetch(PUSH_URL + '/usage', { headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('usage');
  return r.json();
}
export const fmtSize = b => b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + 'GB' : b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';

/* ---------- 누구에게 보이나 ---------- */
// to: { t:'all' } 모두 | { t:'student' } 학생만 | { t:'parent' } 학부모만
// (예전 글: { t:'grade', v } / { t:'sid', v } 도 그대로 보여요)
export const TO_OPTS = [['all', '모두'], ['student', '학생만'], ['parent', '학부모만']];
export const parseTo = v => ({ t: v === 'student' || v === 'parent' ? v : 'all' });
export const visibleTo = (n, sids, gradeOf, role) => { const to = n.to || { t: 'all' }; if (to.t === 'student' || to.t === 'parent') return to.t === role; if (to.t === 'grade') return sids.some(s => gradeOf(s) === to.v); if (to.t === 'sid') return sids.includes(to.v); return true; };
export const toLabel = (n, nameOf) => { const to = n.to || { t: 'all' }; return to.t === 'student' ? '학생만' : to.t === 'parent' ? '학부모만' : to.t === 'grade' ? to.v + ' 전체' : to.t === 'sid' ? (nameOf(to.v) || '학생') + ' 학생 가족' : '모두'; };
// 알림 보낼 곳: 재원생마다 학생함·학부모함
export const pushKeys = (to, students) => students.filter(s => !s.left).flatMap(s => to && to.t === 'student' ? [s.id + '|student'] : to && to.t === 'parent' ? [s.id + '|parent'] : [s.id + '|student', s.id + '|parent']);

/* ---------- 첨부 보여 주기 ---------- */
const extIcon = n => /\.pdf$/i.test(n) ? '📕' : /\.(hwp|hwpx)$/i.test(n) ? '📘' : /\.(docx?|txt)$/i.test(n) ? '📄' : /\.(xlsx?|csv)$/i.test(n) ? '📗' : /\.(pptx?)$/i.test(n) ? '📙' : /\.(zip)$/i.test(n) ? '🗜️' : '📎';
const MAXT = 8; // 목록에서는 사진을 작게 8장까지, 나머지는 '+N'
export function filesHtml(n, esc, compact) {
  const fs = n.files || [], imgs = fs.filter(f => f.img), docs = fs.filter(f => !f.img), links = n.links || [];
  if (!fs.length && !links.length) return '';
  const ks = esc(imgs.map(f => f.k).join(','));
  const th = (f, i, more) => '<span class="bth" data-lb="' + esc(f.k) + '" data-g="' + ks + '"><img loading="lazy" src="' + esc(fileUrl(f.k)) + '" alt="">' + (more ? '<b>+' + more + '</b>' : '') + '</span>';
  if (compact) {
    const bits = []; if (imgs.length) bits.push('📸 사진 ' + imgs.length + '장'); if (docs.length) bits.push('📎 파일 ' + docs.length + '개'); if (links.length) bits.push('🔗 링크 ' + links.length + '개');
    return (imgs.length ? '<div class="bimgs">' + imgs.slice(0, 4).map((f, i) => th(f, i, i === 3 && imgs.length > 4 ? imgs.length - 4 : 0)).join('') + '</div>' : '') + '<div class="sub" style="margin-top:4px">' + bits.join(' · ') + '</div>';
  }
  return (imgs.length ? '<div class="bimgs">' + imgs.slice(0, MAXT).map((f, i) => th(f, i, i === MAXT - 1 && imgs.length > MAXT ? imgs.length - MAXT : 0)).join('') + '</div>' + (imgs.length > 1 ? '<div class="sub" style="margin:-4px 0 6px">사진 ' + imgs.length + '장 · 누르면 크게 넘겨 볼 수 있어요</div>' : '') : '') +
    (docs.length || links.length ? '<div class="bfiles">' + docs.map(f => '<a href="' + esc(fileUrl(f.k)) + '" target="_blank" rel="noopener">' + extIcon(f.name) + ' <span>' + esc(f.name) + '</span><small>' + fmtSize(f.size || 0) + '</small></a>').join('') +
      links.map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">🔗 <span>' + esc(l.name || '구글 드라이브') + '</span><small>링크</small></a>').join('') + '</div>' : '');
}
// 사진 크게 보기: 좌우로 넘기기(화살표·화면 왼쪽/오른쪽 누르기·밀기), 가운데 누르거나 ✕ 로 닫기
export function lightbox(k, group) {
  const list = (group && group.length ? group : [k]); let i = Math.max(0, list.indexOf(k));
  const d = document.createElement('div'); d.className = 'blb';
  const q = s => s.replace(/"/g, '&quot;');
  const draw = () => { d.innerHTML = '<img src="' + q(fileUrl(list[i])) + '" alt="">' + (list.length > 1 ? '<button class="bnv l" aria-label="이전">‹</button><button class="bnv r" aria-label="다음">›</button><span class="bct">' + (i + 1) + ' / ' + list.length + '</span>' : '') + '<button class="bx" aria-label="닫기">✕</button><a class="bdl" href="' + q(fileUrl(list[i], 1)) + '" target="_blank" rel="noopener">저장</a>'; };
  const go = s => { if (list.length < 2) return; i = (i + s + list.length) % list.length; draw(); };
  const close = () => { d.remove(); document.removeEventListener('keydown', kd); };
  const kd = e => { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'Escape') close(); };
  let sx = null; d.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  d.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); d.dataset.sw = '1'; } }, { passive: true });
  d.addEventListener('click', e => {
    if (d.dataset.sw) { delete d.dataset.sw; return; }
    if (e.target.closest('.bdl')) return; if (e.target.closest('.bx')) return close();
    if (e.target.closest('.bnv')) return go(e.target.closest('.bnv').classList.contains('l') ? -1 : 1);
    if (list.length > 1 && e.target.tagName !== 'IMG') { const x = e.clientX / window.innerWidth; if (x < 0.3) return go(-1); if (x > 0.7) return go(1); }
    close();
  });
  document.addEventListener('keydown', kd); draw(); document.body.appendChild(d);
}
// 드라이브 링크 확인
export const okLink = u => /^https:\/\/(drive|docs)\.google\.com\//.test(u || '') || /^https:\/\//.test(u || '');
export const BOARD_CSS = '.bimgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:4px;margin:8px 0;max-width:420px}.bth{position:relative;display:block;cursor:zoom-in}.bth img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;display:block;background:var(--soft,#eee)}.bth b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);color:#fff;font-size:18px;border-radius:8px}' +
  '.bfiles{display:flex;flex-direction:column;gap:6px;margin:8px 0}.bfiles a{display:flex;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--line,#ddd);border-radius:10px;text-decoration:none;color:inherit;background:var(--soft,#f6f7fb)}.bfiles a span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.bfiles a small{opacity:.6}' +
  '.blb{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;user-select:none}.blb img{max-width:96vw;max-height:86vh;border-radius:6px}.blb .bnv{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:10px;background:rgba(255,255,255,.18);color:#fff;font-size:34px;cursor:pointer}.blb .bnv.l{left:10px}.blb .bnv.r{right:10px}.blb .bct{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(26px + env(safe-area-inset-bottom));color:#fff;font-weight:700}.blb .bx{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:20px;cursor:pointer}.blb .bdl{position:absolute;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));background:#fff;color:#111;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700}' +
  '.bcat{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--soft,#eef);margin-right:4px}';
