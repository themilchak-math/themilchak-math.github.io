// 엑셀(.xlsx) 읽기·쓰기 - 외부 라이브러리 없이 브라우저에서 직접 처리 (관리자 PC용)
// readXlsx(file|ArrayBuffer) → { sheets: { 시트이름: { 'A1': 값, ... } } }  (수식 칸은 저장된 결과값만, 없으면 빈칸)
// writeXlsx([{ name, cells: { 'B2': 값 | { v, f, s } }, cols: [너비...] }]) → Blob

/* ---------- ZIP ---------- */
const td = new TextDecoder();
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
async function unzip(ab) {
  const u8 = new Uint8Array(ab), dv = new DataView(ab);
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('엑셀(.xlsx) 파일이 아니에요');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    const ls = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = u8.subarray(ls, ls + csize);
    out[name] = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
  }
  return out;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) { // 압축 없이 저장 (엑셀이 정상적으로 엽니다)
  const te = new TextEncoder(); const parts = [], central = []; let off = 0;
  for (const [name, str] of files) {
    const nm = te.encode(name), data = te.encode(str), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0); const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------- 읽기 ---------- */
const xml = u8 => new DOMParser().parseFromString(td.decode(u8), 'application/xml');
const kids = (el, tag) => [...el.getElementsByTagName(tag)];
export async function readXlsx(src) {
  const ab = src instanceof ArrayBuffer ? src : await src.arrayBuffer();
  const z = await unzip(ab);
  const ss = z['xl/sharedStrings.xml'] ? kids(xml(z['xl/sharedStrings.xml']), 'si').map(si => kids(si, 't').filter(t => t.parentNode.tagName !== 'rPh').map(t => t.textContent).join('')) : [];
  const rels = {}; if (z['xl/_rels/workbook.xml.rels']) kids(xml(z['xl/_rels/workbook.xml.rels']), 'Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const sheets = {}; const order = [];
  for (const s of kids(xml(z['xl/workbook.xml']), 'sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let t = rels[rid] || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    const d = z[t]; if (!d) continue; const cells = {};
    for (const c of kids(xml(d), 'c')) {
      const r = c.getAttribute('r'), ty = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0];
      let val = null;
      if (ty === 'inlineStr') val = kids(c, 't').map(x => x.textContent).join('');
      else if (v) { const x = v.textContent; val = ty === 's' ? ss[+x] : ty === 'str' || ty === 'e' ? x : ty === 'b' ? x === '1' : x === '' ? null : +x; }
      if (val !== null && val !== '') cells[r] = val;
    }
    sheets[s.getAttribute('name')] = cells; order.push(s.getAttribute('name'));
  }
  return { sheets, order };
}
// 엑셀 날짜 숫자(또는 문자) → 'YYYY-MM-DD'
export function xlDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 864e5)); return d.toISOString().slice(0, 10); }
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(v)); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : String(v);
}

/* ---------- 쓰기 ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }; // 0 → A
const toSerial = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5;
// 스타일 번호: 0 기본, 1 굵게, 2 #,##0, 3 날짜, 4 굵게+#,##0, 5 제목(크게 굵게), 6 머리글(굵게+회색 바탕), 7 입력칸(파란 글씨)
const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>' +
  '<fonts count="4"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="14"/><name val="맑은 고딕"/></font><font><sz val="10"/><color rgb="FF1F4EC8"/><name val="맑은 고딕"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9ECF5"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function sheetXml(sh) {
  const rows = {};
  for (const [ref, raw] of Object.entries(sh.cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m) continue;
    const o = raw !== null && typeof raw === 'object' ? raw : { v: raw };
    if ((o.v == null || o.v === '') && !o.f) continue;
    (rows[+m[2]] || (rows[+m[2]] = [])).push([m[1], o]);
  }
  const cidx = s => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const body = Object.keys(rows).map(Number).sort((a, b) => a - b).map(r => '<row r="' + r + '">' + rows[r].sort((a, b) => cidx(a[0]) - cidx(b[0])).map(([c, o]) => {
    const s = o.s ? ' s="' + o.s + '"' : ''; const ref = c + r;
    if (o.f) return '<c r="' + ref + '"' + s + (o.str ? ' t="str"' : '') + '><f>' + esc(o.f) + '</f></c>';
    if (o.date) return '<c r="' + ref + '" s="3"><v>' + toSerial(o.v) + '</v></c>';
    if (typeof o.v === 'number') return '<c r="' + ref + '"' + s + '><v>' + o.v + '</v></c>';
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(o.v) + '</t></is></c>';
  }).join('') + '</row>').join('');
  const cols = sh.cols ? '<cols>' + sh.cols.map((w, i) => w ? '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>' : '').join('') + '</cols>' : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + body + '</sheetData></worksheet>';
}
export function writeXlsx(sheets) {
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s)])
  ];
  return zip(files);
}
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
