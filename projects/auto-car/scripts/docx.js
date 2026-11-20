'use strict';
/* ============================================================
   Auto Car — مولّد ملفات Word (.docx) بدون أي مكتبات خارجية
   ينشئ أرشيف ZIP صالحًا (deflate) يحتوي على XML بصيغة OOXML
   مع دعم كامل للنص العربي (RTL) والعناوين والقوائم والجداول.
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

/* ---------- CRC32 (مطلوب لصيغة ZIP) ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

/* ---------- كتابة أرشيف ZIP ---------- */
function zip(files) {
  const chunks = []; const central = []; let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const comp = zlib.deflateRawSync(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    chunks.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, end]);
}

/* ---------- أدوات XML ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
const AR_FONT = 'Arial';
const MONO_FONT = 'Consolas';

function rpr(o = {}) {
  const font = o.mono ? MONO_FONT : AR_FONT;
  return `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
    (o.bold ? '<w:b/>' : '') + (o.italic ? '<w:i/>' : '') +
    (o.color ? `<w:color w:val="${o.color}"/>` : '') +
    (o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : '') +
    `<w:sz w:val="${o.size || 22}"/><w:szCs w:val="${o.size || 22}"/>` +
    (o.mono ? '' : '<w:rtl/>') + '<w:cs/></w:rPr>';
}
function runs(text, base = {}) {
  const parts = String(text == null ? '' : text).split('`');
  return parts.map((p, i) => {
    const mono = i % 2 === 1;
    return `<w:r>${rpr({ ...base, mono })}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`;
  }).join('');
}
function para(text, o = {}) {
  const ppr = `<w:pPr>${o.bidi !== false ? '<w:bidi/>' : ''}` +
    (o.align ? `<w:jc w:val="${o.align}"/>` : '') +
    (o.border ? `<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="${o.border}"/><w:left w:val="single" w:sz="6" w:space="4" w:color="${o.border}"/><w:bottom w:val="single" w:sz="6" w:space="4" w:color="${o.border}"/><w:right w:val="single" w:sz="6" w:space="4" w:color="${o.border}"/></w:pBdr>` : '') +
    (o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : '') +
    (o.indent ? `<w:ind w:left="${o.indent}" w:right="${o.indent}"/>` : '') +
    `<w:spacing w:before="${o.before != null ? o.before : 40}" w:after="${o.after != null ? o.after : 100}" w:line="288" w:lineRule="auto"/>` +
    (o.keep ? '<w:keepLines/><w:keepNext/>' : '') + '</w:pPr>';
  return `<w:p>${ppr}${runs(text, o)}</w:p>`;
}
function emptyP() { return '<w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="200" w:lineRule="auto"/></w:pPr></w:p>'; }
function hr() { return '<w:p><w:pPr><w:bidi/><w:pBdr><w:bottom w:val="single" w:sz="10" w:space="1" w:color="CBD5E1"/></w:pBdr><w:spacing w:before="40" w:after="120"/></w:pPr></w:p>'; }
function pageBreak() { return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }

function heading(text, level) {
  const map = {
    title: { size: 48, color: '1D3A6B', align: 'center', before: 120, after: 80 },
    h1: { size: 34, color: '1D4E89', before: 320, after: 140 },
    h2: { size: 28, color: '2563EB', before: 260, after: 110 },
    h3: { size: 24, color: '334155', before: 200, after: 90 },
  };
  const o = map[level] || map.h3;
  return para(text, { bold: true, size: o.size, color: o.color, align: o.align, before: o.before, after: o.after, keep: true });
}

function bullets(items, marker = '•') {
  return items.map((it) => para(`${marker}  ${it}`, { indent: 360, after: 60 })).join('');
}
function numbers(items) {
  return items.map((it, i) => para(`${i + 1})  ${it}`, { indent: 360, after: 60 })).join('');
}
function note(text) {
  return para(text, { fill: 'FFF6E5', border: 'F0B429', indent: 140, before: 120, after: 140 });
}
function code(text) {
  const lines = String(text).split('\n');
  return lines.map((ln, i) => `<w:p><w:pPr><w:bidi w:val="0"/><w:shd w:val="clear" w:color="auto" w:fill="F3F5F9"/>${i === 0 ? '<w:spacing w:before="120" w:after="0" w:line="240" w:lineRule="auto"/>' : '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'}${i === lines.length - 1 ? '<w:spacing w:after="140"/>' : ''}<w:ind w:left="180" w:right="180"/></w:pPr><w:r>${rpr({ mono: true, size: 18, color: '0F3D91' })}<w:t xml:space="preserve">${esc(ln || ' ')}</w:t></w:r></w:p>`).join('');
}
function table(head, rows, widths) {
  const cols = head.length;
  const w = widths || Array(cols).fill(Math.floor(9000 / cols));
  const borders = '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="C7D2E0"/><w:left w:val="single" w:sz="6" w:color="C7D2E0"/><w:bottom w:val="single" w:sz="6" w:color="C7D2E0"/><w:right w:val="single" w:sz="6" w:color="C7D2E0"/><w:insideH w:val="single" w:sz="6" w:color="DCE3EC"/><w:insideV w:val="single" w:sz="6" w:color="DCE3EC"/></w:tblBorders>';
  const grid = w.map((x) => `<w:gridCol w:w="${x}"/>`).join('');
  const cell = (text, isHead) => `<w:tc><w:tcPr><w:tcW w:w="${w[0]}" w:type="dxa"/>${isHead ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF7"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${para(text, { bold: !!isHead, size: 19, after: 20, before: 20 })}</w:tc>`;
  const headRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h) => cell(h, true)).join('')}</w:tr>`;
  const bodyRows = rows.map((r) => `<w:tr>${r.map((c) => cell(c, false)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:bidiVisual/>${borders}<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headRow}${bodyRows}</w:tbl>${emptyP()}`;
}

function renderBlocks(blocks) {
  let out = '';
  for (const b of blocks) {
    if (b == null) continue;
    switch (b.t) {
      case 'title': out += heading(b.text, 'title'); if (b.sub) out += para(b.sub, { align: 'center', color: '64748B', size: 22, after: 160 }); out += hr(); break;
      case 'h1': out += heading(b.text, 'h1'); break;
      case 'h2': out += heading(b.text, 'h2'); break;
      case 'h3': out += heading(b.text, 'h3'); break;
      case 'p': out += para(b.text, b.opts || {}); break;
      case 'bullets': out += bullets(b.items, b.marker); break;
      case 'numbers': out += numbers(b.items); break;
      case 'code': out += code(b.text); break;
      case 'note': out += note(b.text); break;
      case 'table': out += table(b.head, b.rows, b.widths); break;
      case 'hr': out += hr(); break;
      case 'pagebreak': out += pageBreak(); break;
      case 'space': out += emptyP(); break;
      default: out += para(String(b.text || ''), {});
    }
  }
  return out;
}

function buildDocx(blocks, meta = {}) {
  const body = renderBlocks(blocks);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/><w:cs/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title || 'Auto Car')}</dc:title><dc:creator>${esc(meta.author || 'Auto Car')}</dc:creator><cp:lastModifiedBy>${esc(meta.author || 'Auto Car')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Auto Car</Application><Company>Auto Car Motors</Company></Properties>`;

  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'docProps/core.xml', data: coreXml },
    { name: 'docProps/app.xml', data: appXml },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/_rels/document.xml.rels', data: docRels },
  ]);
}

function writeDocx(filePath, blocks, meta = {}) {
  const buf = buildDocx(blocks, meta);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return { path: filePath, bytes: buf.length };
}

module.exports = { buildDocx, writeDocx, zip, crc32 };
