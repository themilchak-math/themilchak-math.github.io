// "입력 중…" 표시 (카톡의 점점점) — 대화방에서 상대가 글을 쓰고 있으면 말풍선 자리에 ● ● ● 이 보여요
// typing/{대화방} 문서 하나에 {f: 't'(원장님·부원장) | 'o'(학생·학부모), on: true/false, at} 만 써요. 2초에 한 번만 저장해요. 받는 쪽은 3.5초 동안 새 신호가 없으면 숨겨요.
export function createTyping({ db, doc, setDoc, onSnapshot, myF, writeKeys }) {
  let unsub = null, key = null, until = 0, lastPing = 0, hideT = null;
  const el = () => document.getElementById('typ');
  const show = () => {
    const e = el(); if (!e) return;
    const on = Date.now() < until; if (e.hidden === !on) return;
    const box = e.closest('.chat') || e.parentNode; const sc = document.scrollingElement;
    const near = box && box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const nearPage = sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
    e.hidden = !on;
    if (on) { if (near) box.scrollTop = box.scrollHeight; if (nearPage) sc.scrollTop = sc.scrollHeight; }
  };
  const write = (k, on) => Promise.all(writeKeys(k).map(id => setDoc(doc(db, 'typing', id), { f: myF(), on, at: Date.now() }).catch(() => { })));
  return {
    // 화면을 그린 뒤 매번 불러요: 열린 대화방이 바뀌면 듣는 문서도 바꿔요
    sync(k) {
      if (k !== key) {
        if (unsub) { unsub(); unsub = null; } if (key && lastPing) write(key, false);
        key = k; until = 0; lastPing = 0;
        if (k) unsub = onSnapshot(doc(db, 'typing', k), d => {
          if (d.metadata && d.metadata.hasPendingWrites) return;
          const x = d.exists() ? d.data() : null;
          if (x && x.f !== myF() && x.on && Math.abs(Date.now() - (x.at || 0)) < 60000) until = Date.now() + 3500; else until = 0;
          show(); clearTimeout(hideT); hideT = setTimeout(show, 3600);
        }, () => { });
      }
      show();
    },
    // 입력창에 글을 쓸 때
    ping() { if (!key) return; const n = Date.now(); if (n - lastPing < 2000) return; lastPing = n; write(key, true); },
    // 보냈거나 입력창을 비웠을 때
    stop() { if (!key || !lastPing) return; lastPing = 0; write(key, false); },
  };
}
export const TYPING_CSS = '.typ{display:inline-flex!important;gap:4px;align-items:center;padding:12px 14px!important;width:auto!important}.typ[hidden]{display:none!important}.typ i{width:7px;height:7px;border-radius:50%;background:#9aa0b8;animation:typb 1.2s infinite}.typ i:nth-child(2){animation-delay:.2s}.typ i:nth-child(3){animation-delay:.4s}@keyframes typb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}';
export const typingHtml = cls => '<div class="' + cls + ' you typ" id="typ" hidden aria-label="상대가 입력 중"><i></i><i></i><i></i></div>';
