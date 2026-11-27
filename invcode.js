// 가입 코드: 원장님이 보내는 가입 안내에 6자리 코드를 넣어, 번호 + 코드를 아는 사람만 가입되게 해요.
// - members(st:'none')마다 code, inv/{코드} = { phone, mids:[members id...] }  (같은 번호는 코드 하나)
// - 가입하는 사람은 inv/{코드}를 자기 번호일 때만 읽을 수 있고(보안 규칙), 거기 적힌 members만 '승인 대기'로 바꿔요.
// - 아직 가입 안 한 번호의 members(학생 이름·학년)는 그 번호로 로그인해도 보이지 않아요.
import { doc, writeBatch, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const rand6 = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + a[0] % 900000); };
let busy = false;

// 원장님 화면에서만 호출: 코드 없는 미가입 번호에 코드를 만들고 inv 문서를 맞춰요
export async function ensureCodes(db, members, inv) {
  if (busy || !inv) return;
  const byPhone = {};
  members.filter(m => m.st === 'none' && m.phone).forEach(m => (byPhone[m.phone] = byPhone[m.phone] || []).push(m));
  const used = new Set(Object.keys(inv)); const b = writeBatch(db); let n = 0;
  for (const [ph, ms] of Object.entries(byPhone)) {
    let code = (ms.find(m => m.code && inv[m.code] && inv[m.code].phone === ph) || {}).code;
    if (!code) { do { code = rand6(); } while (used.has(code)); used.add(code); }
    const mids = ms.map(m => m.id).sort(); const cur = inv[code];
    if (!cur || cur.phone !== ph || JSON.stringify([...(cur.mids || [])].sort()) !== JSON.stringify(mids)) { b.set(doc(db, 'inv', code), { phone: ph, mids }); n++; }
    ms.forEach(m => { if (m.code !== code) { b.update(doc(db, 'members', m.id), { code }); n++; } });
  }
  if (!n) return;
  busy = true; try { await b.commit(); } catch (e) { console.warn('가입 코드', e); } busy = false;
}

// 가입하는 사람: 코드로 자기 번호의 등록을 '승인 대기'로. 성공한 개수를 돌려줘요 (코드가 틀리면 오류)
export async function claimByCode(db, code, uid, at) {
  let s; try { s = await getDoc(doc(db, 'inv', String(code))); } catch (e) { throw new Error('nocode'); }
  if (!s.exists()) throw new Error('nocode');
  let ok = 0; for (const id of s.data().mids || []) { try { await updateDoc(doc(db, 'members', id), { st: 'pending', uid, at }); ok++; } catch (e) { } }
  return ok;
}
