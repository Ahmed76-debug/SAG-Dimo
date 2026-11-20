'use strict';
/* ============================================================
   Auto Car — مكتبة Excel/CSV (بدون مكتبات خارجية)
   كتابة ملفات xlsx حقيقية (ZIP + deflate) وقراءتها، وتحليل CSV.
   ============================================================ */
const zlib = require('zlib');

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- بناء ملف ZIP ---------- */
function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);            // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
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

/* ---------- فك ZIP ---------- */
function unzip(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    let data;
    try { data = method === 8 ? zlib.inflateRawSync(comp) : Buffer.from(comp); } catch { data = Buffer.alloc(0); }
    out[name] = data;
    i = dataStart + compSize;
  }
  return out;
}

/* ---------- أدوات XML ---------- */
function escXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function colLetter(n) {
  let s = '';
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function xmlUnescape(s) {
  return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');
}

/* ---------- كتابة xlsx ---------- */
function writeXlsx(sheets) {
  const sheetDefs = sheets.map((s, idx) => ({ name: (s.name || `Sheet${idx + 1}`).slice(0, 31).replace(/[\\/?*\[\]:]/g, '_'), rows: s.rows || [], idx }));
  const sheetXml = (rows) => {
    const rowsXml = rows.map((row, r) => {
      const cells = row.map((val, c) => {
        const ref = colLetter(c) + (r + 1);
        if (val === null || val === undefined || val === '') return `<c r="${ref}"/>`;
        if (typeof val === 'number' && Number.isFinite(val)) return `<c r="${ref}"><v>${val}</v></c>`;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(val)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  };
  const files = [];
  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetDefs.map((s) => `<Override PartName="/xl/worksheets/sheet${s.idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetDefs.map((s) => `<sheet name="${escXml(s.name)}" sheetId="${s.idx + 1}" r:id="rId${s.idx + 1}"/>`).join('')}</sheets></workbook>` });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetDefs.map((s) => `<Relationship Id="rId${s.idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.idx + 1}.xml"/>`).join('')}</Relationships>` });
  sheetDefs.forEach((s) => files.push({ name: `xl/worksheets/sheet${s.idx + 1}.xml`, data: sheetXml(s.rows) }));
  return zip(files);
}

/* ---------- قراءة xlsx ---------- */
function readXlsx(buf) {
  const entries = unzip(buf);
  const parseShared = () => {
    const xml = entries['xl/sharedStrings.xml'];
    if (!xml) return [];
    const text = xml.toString('utf8');
    const out = [];
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(text))) {
      const inner = m[1];
      let s = '';
      const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let tm;
      while ((tm = tRe.exec(inner))) s += tm[1];
      out.push(xmlUnescape(s));
    }
    return out;
  };
  const shared = parseShared();
  const parseSheet = (xml) => {
    const text = xml.toString('utf8');
    const rows = [];
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(text))) {
      const cells = [];
      const cellRe = /<c\s+([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
      let cm;
      while ((cm = cellRe.exec(rm[1]))) {
        const attrs = cm[1];
        const inner = cm[3] || '';
        const refMatch = attrs.match(/r="([A-Z]+)\d+"/);
        const typeMatch = attrs.match(/t="([^"]+)"/);
        const col = refMatch ? colToIndex(refMatch[1]) : cells.length;
        let val = '';
        const t = typeMatch ? typeMatch[1] : 'n';
        if (t === 'inlineStr') {
          const isMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          val = isMatch ? xmlUnescape(isMatch[1]) : '';
        } else {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          const raw = vMatch ? vMatch[1] : '';
          if (t === 's') val = shared[Number(raw)] ?? '';
          else val = xmlUnescape(raw);
        }
        while (cells.length < col) cells.push('');
        cells[col] = val;
      }
      rows.push(cells);
    }
    return rows;
  };
  const sheetNames = [];
  const wb = entries['xl/workbook.xml'];
  if (wb) {
    const re = /<sheet[^>]*name="([^"]*)"/g;
    let m;
    while ((m = re.exec(wb.toString('utf8')))) sheetNames.push(xmlUnescape(m[1]));
  }
  const sheets = [];
  for (let i = 1; ; i++) {
    const key = `xl/worksheets/sheet${i}.xml`;
    if (!entries[key]) break;
    sheets.push({ name: sheetNames[i - 1] || `Sheet${i}`, rows: parseSheet(entries[key]) });
  }
  if (!sheets.length) {
    // احتياطي: أي ورقة موجودة
    for (const key of Object.keys(entries)) if (/xl\/worksheets\/.*\.xml$/.test(key)) sheets.push({ name: 'Sheet1', rows: parseSheet(entries[key]) });
  }
  return { sheets };
}
function colToIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/* ---------- CSV ---------- */
function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
function toCsv(rows) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

module.exports = { writeXlsx, readXlsx, parseCsv, toCsv, crc32 };
