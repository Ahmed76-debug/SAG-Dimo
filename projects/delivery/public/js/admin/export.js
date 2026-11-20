/* ============================================================
   طلباتك — التصدير والطباعة
   • إكسل حقيقي (.xlsx) يُحفظ في المكان الذي يختاره المستخدم
   • PDF حقيقي (.pdf) يُحفظ في المكان الذي يختاره المستخدم
   • طباعة منفصلة على الطابعة عبر حوار الطباعة
   لا يعتمد على أي مكتبة خارجية.
   ============================================================ */
(function () {
  "use strict";
  const TB = window.TB;
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const PDF_MIME = "application/pdf";
  const BRAND = "#FF6B35";
  const FONT = '"Segoe UI", Tahoma, "Noto Naskh Arabic", Arial, sans-serif';
  const F = (size, bold) => `${bold ? "700 " : ""}${size}px ${FONT}`;

  /* ============================================================
     1) أدوات البايتات
     ============================================================ */
  const enc = new TextEncoder();
  function concatBytes(list) {
    let total = 0;
    for (const u of list) total += u.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const u of list) { out.set(u, p); p += u.length; }
    return out;
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ============================================================
     2) CRC32 + ZIP (بدون ضغط) لبناء ملفات .xlsx
     ============================================================ */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function ByteWriter() { this.buf = new Uint8Array(4096); this.len = 0; }
  ByteWriter.prototype._grow = function (n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  };
  ByteWriter.prototype.u8 = function (v) { this._grow(1); this.buf[this.len++] = v & 0xff; };
  ByteWriter.prototype.u16 = function (v) { this._grow(2); this.buf[this.len++] = v & 0xff; this.buf[this.len++] = (v >>> 8) & 0xff; };
  ByteWriter.prototype.u32 = function (v) { this._grow(4); for (let i = 0; i < 4; i++) this.buf[this.len++] = (v >>> (8 * i)) & 0xff; };
  ByteWriter.prototype.raw = function (a) { this._grow(a.length); this.buf.set(a, this.len); this.len += a.length; };
  ByteWriter.prototype.done = function () { return this.buf.subarray(0, this.len); };

  function zipStore(files) {
    const w = new ByteWriter();
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = ((((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    const entries = [];
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const offset = w.len;
      w.u32(0x04034b50); w.u16(20); w.u16(0); w.u16(0);
      w.u16(dosTime); w.u16(dosDate);
      w.u32(crc); w.u32(data.length); w.u32(data.length);
      w.u16(name.length); w.u16(0);
      w.raw(name); w.raw(data);
      entries.push({ name, crc, size: data.length, offset });
    }
    const cdStart = w.len;
    for (const e of entries) {
      w.u32(0x02014b50); w.u16(20); w.u16(20); w.u16(0); w.u16(0);
      w.u16(dosTime); w.u16(dosDate);
      w.u32(e.crc); w.u32(e.size); w.u32(e.size);
      w.u16(e.name.length); w.u16(0); w.u16(0); w.u16(0); w.u16(0); w.u32(0); w.u32(e.offset);
      w.raw(e.name);
    }
    const cdSize = w.len - cdStart;
    w.u32(0x06054b50); w.u16(0); w.u16(0);
    w.u16(entries.length); w.u16(entries.length);
    w.u32(cdSize); w.u32(cdStart); w.u16(0);
    return w.done();
  }

  /* ============================================================
     3) بناء ملف Excel حقيقي (.xlsx)
     ============================================================ */
  function colLetter(n) {
    let s = "";
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  const xmlEsc = s => String(s === null || s === undefined ? "" : s)
    .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]))
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  function cellText(c, r) {
    if (!c) return "";
    if (c.type === "money") return TB.money(r[c.key]);
    if (c.type === "date") return TB.date(r[c.key]);
    if (c.type === "dt") return TB.dt(r[c.key]);
    if (c.type === "bool") return Number(r[c.key]) ? "نعم" : "لا";
    let v = c.csv ? c.csv(r) : r[c.key];
    if (v === null || v === undefined) return "";
    return String(v).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function cellNumber(c, r) {
    if (c.type !== "money" && c.type !== "number") return null;
    const v = r[c.key];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function xlsxBlob(d) {
    const cols = (d.columns || []).filter(Boolean);
    const rows = d.rows || [];
    const sheetName = String(d.sheet || d.title || "التقرير").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet1";
    const colDefs = cols.map((c, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(12, String(c.label || "").length + 6), 42)}" customWidth="1"/>`).join("");

    const sheetRows = [];
    sheetRows.push("<row r=\"1\">" + cols.map((c, i) =>
      `<c r="${colLetter(i + 1)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.label)}</t></is></c>`).join("") + "</row>");

    rows.forEach((r, ri) => {
      const rn = ri + 2;
      const cells = cols.map((c, ci) => {
        const ref = colLetter(ci + 1) + rn;
        const num = cellNumber(c, r);
        if (num !== null) return `<c r="${ref}"${c.type === "money" ? " s=\"2\"" : ""}><v>${num}</v></c>`;
        const s = cellText(c, r);
        if (s === "") return "";
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(s)}</t></is></c>`;
      }).join("");
      if (cells) sheetRows.push(`<row r="${rn}">${cells}</row>`);
    });

    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colDefs}</cols><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF6B35"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDDDDDD"/></left><right style="thin"><color rgb="FFDDDDDD"/></right><top style="thin"><color rgb="FFDDDDDD"/></top><bottom style="thin"><color rgb="FFDDDDDD"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" readingOrder="2"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;

    const files = [
      { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
      { name: "_rels/.rels", data: enc.encode(rootRels) },
      { name: "xl/workbook.xml", data: enc.encode(workbook) },
      { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRels) },
      { name: "xl/styles.xml", data: enc.encode(styles) },
      { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) },
    ];
    return new Blob([zipStore(files)], { type: XLSX_MIME });
  }

  /* ============================================================
     4) بناء ملف PDF من صور JPEG (بدون مكتبات)
     ============================================================ */
  function buildPdf(images) {
    const chunks = [];
    let offset = 0;
    const put = a => { chunks.push(a); offset += a.length; };
    const putStr = s => put(enc.encode(s));
    putStr("%PDF-1.4\n");
    const n = images.length;
    const objCount = 2 + n * 3;
    const objOff = new Array(objCount + 1).fill(0);
    const begin = num => { objOff[num] = offset; putStr(num + " 0 obj\n"); };
    const end = () => putStr("\nendobj\n");

    begin(1); putStr("<< /Type /Catalog /Pages 2 0 R >>"); end();
    const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
    begin(2); putStr(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`); end();

    images.forEach((im, i) => {
      const pageObj = 3 + i * 3, imgObj = 4 + i * 3, contObj = 5 + i * 3;
      begin(pageObj);
      putStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${im.pageW} ${im.pageH}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contObj} 0 R >>`);
      end();
      begin(imgObj);
      putStr(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
      put(im.bytes);
      putStr("\nendstream");
      end();
      const cs = `q\n${im.pageW} 0 0 ${im.pageH} 0 0 cm\n/Im0 Do\nQ`;
      begin(contObj);
      putStr(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
      end();
    });

    const xref = offset;
    putStr(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= objCount; i++) putStr(String(objOff[i]).padStart(10, "0") + " 00000 n \n");
    putStr(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return concatBytes(chunks);
  }

  /* ============================================================
     5) رسم التقرير على كانفاس (عربي سليم عبر محرّك النص في المتصفح)
     ============================================================ */
  const PAGE_W = 794, PAGE_H = 1123, MARGIN = 40, SCALE = 2;
  const CW = PAGE_W - MARGIN * 2;

  function wrapText(ctx, text, maxW, maxLines) {
    const t = String(text === null || text === undefined ? "" : text);
    if (!t) return [""];
    const words = t.split(/\s+/);
    const out = [];
    let cur = "";
    const flush = () => { if (cur !== "") { out.push(cur); cur = ""; } };
    for (const w of words) {
      if (out.length > maxLines) break;
      const cand = cur ? cur + " " + w : w;
      if (ctx.measureText(cand).width <= maxW) { cur = cand; continue; }
      flush();
      if (ctx.measureText(w).width <= maxW) { cur = w; continue; }
      let chunk = "";
      for (const ch of w) {
        if (chunk && ctx.measureText(chunk + ch).width > maxW) { out.push(chunk); chunk = ch; }
        else chunk += ch;
      }
      cur = chunk;
    }
    flush();
    if (out.length > maxLines) {
      out.length = maxLines;
      out[maxLines - 1] = out[maxLines - 1].slice(0, Math.max(0, out[maxLines - 1].length - 1)) + "…";
    }
    return out.length ? out : [""];
  }

  function layoutReport(d) {
    const cols = (d.columns || []).filter(Boolean);
    const rows = d.rows || [];
    const probe = document.createElement("canvas").getContext("2d");
    probe.direction = "rtl";
    const metaPairs = Object.entries(d.meta || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined);
    const metaStr = metaPairs.map(([k, v]) => `${k}: ${v}`).join("   ·   ");
    const hasSub = !!d.subtitle;

    probe.font = F(10.5);
    const texts = rows.map(r => cols.map(c => cellText(c, r)));

    const MINW = 48, PADX = 7;
    const raw = cols.map((c, i) => {
      probe.font = F(11, true);
      let mx = probe.measureText(c.label || "").width;
      probe.font = F(10.5);
      const sample = Math.min(rows.length, 150);
      for (let r = 0; r < sample; r++) mx = Math.max(mx, probe.measureText(texts[r][i]).width);
      return Math.max(MINW, Math.min(mx + PADX * 2 + 6, CW * 0.62));
    });
    const total = raw.reduce((a, b) => a + b, 0) || 1;
    const widths = raw.map(x => (x / total) * CW);

    const LINE = 14.5, PADY = 6.5, MAXLINES = 6;
    probe.font = F(10.5);
    const rowLines = texts.map(row => row.map((t, i) => wrapText(probe, t, Math.max(20, widths[i] - PADX * 2), MAXLINES)));
    const rowHeights = rowLines.map(lines => Math.max.apply(null, lines.map(l => Math.max(1, l.length))) * LINE + PADY * 2);

    const metaLines = metaStr ? wrapText(probe, metaStr, CW, 3) : [];
    const TITLE_BASE = 74;
    const SUB_BASE = TITLE_BASE + 17;
    let last = hasSub ? SUB_BASE : TITLE_BASE;
    if (metaLines.length) last += 16 + (metaLines.length - 1) * 15;
    const headerH = last + 12;

    const THEAD_H = 26;
    const tableTop = MARGIN + headerH;
    const rowsTop = tableTop + THEAD_H;
    const FOOT_H = 28;
    const bottom = PAGE_H - MARGIN - FOOT_H;

    const pages = [];
    let cur = [], y = rowsTop;
    for (let i = 0; i < rowHeights.length; i++) {
      const h = rowHeights[i];
      if (cur.length && y + h > bottom) { pages.push(cur); cur = []; y = rowsTop; }
      cur.push(i); y += h;
    }
    pages.push(cur);

    return { cols, rows, texts, rowLines, rowHeights, widths, pages, metaLines, hasSub, headerH, tableTop, rowsTop, bottom, LINE, PADY, PADX, THEAD_H };
  }

  function drawHeader(ctx, L, d, company, logo) {
    const top = MARGIN, R = PAGE_W - MARGIN;
    if (logo) { try { ctx.drawImage(logo, R - 44, top, 44, 44); } catch (e) { /* تجاهل */ } }
    const infoR = R - (logo ? 54 : 0);
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.fillStyle = "#111";
    ctx.font = F(15, true);
    ctx.fillText(company.name || "طلباتك", infoR, top + 17);
    ctx.font = F(9.5);
    ctx.fillStyle = "#666";
    ctx.fillText([company.phone, company.email].filter(Boolean).join(" — "), infoR, top + 32);
    ctx.fillText(company.address || "", infoR, top + 45);
    ctx.strokeStyle = BRAND; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(MARGIN, top + 52); ctx.lineTo(R, top + 52); ctx.stroke();

    ctx.fillStyle = "#111"; ctx.font = F(18, true);
    ctx.fillText((d.title || "تقرير") + (L.pages.length > 1 && L._pi > 0 ? "  (تابع)" : ""), R, top + 74);
    let y = top + 74;
    if (L.hasSub) { y = top + 91; ctx.font = F(10.5); ctx.fillStyle = "#666"; ctx.fillText(d.subtitle, R, y); }
    if (L.metaLines.length) {
      y += 16; ctx.font = F(9.5); ctx.fillStyle = "#555";
      L.metaLines.forEach((ln, i) => ctx.fillText(ln, R, y + i * 15));
    }
  }

  function drawTableHead(ctx, L) {
    const y = L.tableTop, h = L.THEAD_H;
    ctx.fillStyle = BRAND;
    ctx.fillRect(MARGIN, y, CW, h);
    ctx.fillStyle = "#fff";
    ctx.font = F(10.5, true);
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    let x = MARGIN + CW;
    L.cols.forEach((c, i) => {
      const w = L.widths[i];
      ctx.save();
      ctx.beginPath(); ctx.rect(x - w + 2, y, w - 4, h); ctx.clip();
      ctx.fillText(String(c.label || ""), x - L.PADX, y + h / 2 + 4);
      ctx.restore();
      x -= w;
    });
    ctx.strokeStyle = "#d9d9d9"; ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN, y, CW, h);
  }

  function drawRow(ctx, L, idx, y) {
    const h = L.rowHeights[idx];
    if ((idx & 1) === 1) { ctx.fillStyle = "#fafafa"; ctx.fillRect(MARGIN, y, CW, h); }
    ctx.strokeStyle = "#e5e5e5"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(MARGIN, y + h); ctx.lineTo(MARGIN + CW, y + h); ctx.stroke();

    ctx.textAlign = "right";
    ctx.direction = "rtl";
    let x = MARGIN + CW;
    for (let i = 0; i < L.cols.length; i++) {
      const w = L.widths[i];
      const lines = L.rowLines[idx][i];
      ctx.fillStyle = "#222";
      ctx.font = F(10.5);
      ctx.save();
      ctx.beginPath(); ctx.rect(x - w + 2, y, w - 4, h); ctx.clip();
      for (let k = 0; k < lines.length; k++) ctx.fillText(lines[k], x - L.PADX, y + L.PADY + L.LINE * (k + 0.75));
      ctx.restore();
      x -= w;
    }
    return y + h;
  }

  function summaryItems(d) {
    return Object.entries(d.summary || {})
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => ({ label: k, value: typeof v === "number" ? TB.money(v) : String(v) }));
  }
  function measureSummary(ctx, d) {
    const items = summaryItems(d);
    if (!items.length) return { items, height: 0 };
    ctx.font = F(9.5);
    const widths = items.map(it => Math.max(120, Math.max(ctx.measureText(it.label).width, ctx.measureText(it.value).width) + 28));
    let rowW = 0, rows = 1;
    for (const w of widths) {
      if (rowW && rowW + 10 + w > CW) { rows++; rowW = w; }
      else rowW += (rowW ? 10 : 0) + w;
    }
    return { items, widths, rows, height: rows * 44 + 10 };
  }
  function drawSummary(ctx, d, y) {
    const m = measureSummary(ctx, d);
    if (!m.items.length) return y;
    let x = MARGIN + CW, rowW = 0;
    let ry = y;
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    m.items.forEach((it, i) => {
      const w = m.widths[i];
      if (rowW && rowW + 10 + w > CW) { ry += 44; x = MARGIN + CW; rowW = 0; }
      x -= (rowW ? 10 : 0) + w;
      ctx.fillStyle = "#fbfbfb"; ctx.strokeStyle = "#eee"; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, ry, w, 38, 8); else ctx.rect(x, ry, w, 38);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#777"; ctx.font = F(9, true);
      ctx.fillText(it.label, x + w / 2, ry + 14);
      ctx.fillStyle = "#111"; ctx.font = F(12, true);
      ctx.fillText(it.value, x + w / 2, ry + 31);
      rowW += (rowW ? 10 : 0) + w;
    });
    return ry + 44;
  }

  function drawFooter(ctx, d, company, pageIdx, tot) {
    const y = PAGE_H - MARGIN + 4;
    ctx.strokeStyle = "#eee"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(MARGIN, y - 14); ctx.lineTo(PAGE_W - MARGIN, y - 14); ctx.stroke();
    ctx.font = F(9); ctx.fillStyle = "#888"; ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText(`مستند صادر آليًا من نظام «${company.name || "طلباتك"}» — ${TB.dt(new Date().toISOString())}`, PAGE_W - MARGIN, y);
    ctx.textAlign = "left";
    ctx.fillText(`صفحة ${pageIdx + 1} / ${tot}`, MARGIN, y);
  }

  function loadImage(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
      setTimeout(() => res(null), 2500);
    });
  }
  let _company = null;
  async function companyInfo() {
    if (_company) return _company;
    try { _company = await TB.api("company"); } catch (e) { _company = {}; }
    return _company || {};
  }

  /* يحوّل التقرير إلى مصفوفة صور JPEG (صفحة لكل عنصر) */
  async function reportToImages(d, onProgress) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* تجاهل */ } }
    const company = await companyInfo();
    const logo = await loadImage(company.logo);
    const L = layoutReport(d);
    if (L.pages.length > 200) throw new Error("حجم البيانات كبير جدًا للتصدير كـ PDF — استخدم تصدير إكسل");
    const images = [];
    for (let p = 0; p < L.pages.length; p++) {
      L._pi = p;
      const cv = document.createElement("canvas");
      cv.width = PAGE_W * SCALE;
      cv.height = PAGE_H * SCALE;
      const ctx = cv.getContext("2d");
      ctx.scale(SCALE, SCALE);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      drawHeader(ctx, L, d, company, logo);
      drawTableHead(ctx, L);
      let y = L.rowsTop;
      for (const ri of L.pages[p]) y = drawRow(ctx, L, ri, y);
      if (p === L.pages.length - 1) {
        const sm = measureSummary(ctx, d);
        if (sm.items.length) {
          if (y + sm.height > PAGE_H - MARGIN - 20) {
            /* الصفحة الأخيرة لا تتّسع للخلاصة */
          }
          y = drawSummary(ctx, d, y + 10);
        }
      }
      drawFooter(ctx, d, company, p, L.pages.length);
      const url = cv.toDataURL("image/jpeg", 0.86);
      const bytes = b64ToBytes(url.slice(url.indexOf(",") + 1));
      images.push({ bytes, w: cv.width, h: cv.height, pageW: PAGE_W, pageH: PAGE_H });
      cv.width = 0; cv.height = 0;
      if (onProgress) onProgress(p + 1, L.pages.length);
      await new Promise(r => setTimeout(r, 0));
    }
    return images;
  }

  TB.buildReportPdf = async (d, onProgress) => {
    const images = await reportToImages(d, onProgress);
    return new Blob([buildPdf(images)], { type: PDF_MIME });
  };

  /* ============================================================
     6) الحفظ: اختيار مجلد/اسم الملف (File System Access) مع بديل
     ============================================================ */
  TB.saveBlob = async (blob, name, opts) => {
    opts = opts || {};
    const ext = opts.ext || "";
    const mime = opts.mime || blob.type || "application/octet-stream";
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: opts.desc || "ملف", accept: { [mime]: ext ? [ext] : [] } }],
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return { saved: true, fallback: false };
      } catch (e) {
        if (e && (e.name === "AbortError")) return { saved: false, cancelled: true };
        /* متصفح لا يدعم/منع الوصول → البدء بالتنزيل المباشر */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    return { saved: true, fallback: true };
  };

  /* ============================================================
     7) الواجهات العامة
     ============================================================ */
  const stamp = s => TB.dt(new Date().toISOString()) + (s ? " — " + s : "");

  TB.exportExcel = async (d, name) => {
    const base = name || d.file || "export";
    try {
      const blob = xlsxBlob(d);
      const r = await TB.saveBlob(blob, base + ".xlsx", { ext: ".xlsx", mime: XLSX_MIME, desc: "مصنّف Excel" });
      if (r.cancelled) return;
      TB.toast(r.fallback
        ? `✅ تم تنزيل ${base}.xlsx في مجلد التنزيلات (المتصفح لا يدعم اختيار المكان)`
        : `✅ تم حفظ ${base}.xlsx في المكان الذي اخترته`, "success");
    } catch (e) { TB.toast("⚠️ " + e.message, "error"); }
  };

  TB.exportPdfFile = async (d, name) => {
    const base = name || d.file || "export";
    try {
      TB.toast("⏳ جاري تجهيز ملف PDF…", "info");
      const blob = await TB.buildReportPdf(d);
      const r = await TB.saveBlob(blob, base + ".pdf", { ext: ".pdf", mime: PDF_MIME, desc: "مستند PDF" });
      if (r.cancelled) return;
      TB.toast(r.fallback
        ? `✅ تم تنزيل ${base}.pdf في مجلد التنزيلات (المتصفح لا يدعم اختيار المكان)`
        : `✅ تم حفظ ${base}.pdf في المكان الذي اخترته`, "success");
    } catch (e) { TB.toast("⚠️ " + e.message, "error"); }
  };

  /** الطباعة فقط (على الطابعة) — تبني مستندًا منسّقًا في #print-area ثم تفتح حوار الطباعة */
  TB.printReport = async (opts) => {
    opts = opts || {};
    const { title = "تقرير", subtitle = "", columns = [], rows = [], meta = {}, summary = {} } = opts;
    if (!rows || !rows.length) { TB.toast("لا توجد بيانات للطباعة", "error"); return; }
    const company = await companyInfo();
    const e = TB.esc;
    const prev = document.getElementById("print-area");
    if (prev) prev.remove();
    const box = TB.el("div", { id: "print-area" });
    const metaHtml = Object.entries(meta || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `<span><i>${e(k)}:</i> ${e(v)}</span>`).join("");
    const sumHtml = Object.entries(summary || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `<div class="pr-sum"><i>${e(k)}</i><b>${typeof v === "number" ? TB.money(v) : e(v)}</b></div>`).join("");
    box.innerHTML =
      `<div class="pr-head">
        ${company.logo ? `<img class="pr-logo" src="${e(company.logo)}" alt="">` : ""}
        <div class="pr-co"><b>${e(company.name || "طلباتك")}</b>
          <span>${e(company.phone || "")}${company.email ? " — " + e(company.email) : ""}</span>
          <span>${e(company.address || "")}</span></div>
      </div>
      <h1 class="pr-title">${e(title)}</h1>
      ${subtitle ? `<div class="pr-sub">${e(subtitle)}</div>` : ""}
      ${metaHtml ? `<div class="pr-meta">${metaHtml}</div>` : ""}
      <table class="pr-table">
        <thead><tr>${columns.map(c => `<th>${e(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${e(cellText(c, r))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      ${sumHtml ? `<div class="pr-sums">${sumHtml}</div>` : ""}
      <div class="pr-foot">مستند صادر آليًا من نظام «${e(company.name || "طلباتك")}» — ${e(TB.dt(new Date().toISOString()))}</div>`;
    document.body.appendChild(box);
    const done = () => { const b = document.getElementById("print-area"); if (b) b.remove(); };
    window.addEventListener("afterprint", done, { once: true });
    setTimeout(() => { try { window.print(); } catch (err) { /* تجاهل */ } setTimeout(done, 800); }, 60);
    TB.toast("🖨️ تم إرسال المستند إلى الطابعة", "success");
  };

  /* تصدير CSV (متوافق للخلف) */
  TB.exportCsv = (filename, columns, rows) => {
    const q = v => `"${String(v === null || v === undefined ? "" : v).replace(/"/g, '""')}"`;
    const lines = [columns.map(c => q(c.label)).join(",")];
    for (const r of rows) lines.push(columns.map(c => q(c.csv ? c.csv(r) : r[c.key])).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  /**
   * أزرار تصدير جاهزة: إكسل (.xlsx) + PDF (.pdf) + طباعة.
   * getData: دالة تُعيد كائنًا/وعدًا بالشكل:
   *   { file, title, subtitle, sheet, columns:[{label,key,csv,type}], rows, summary, meta }
   */
  TB.exportButtons = getData => {
    const wrap = TB.el("div", { class: "flex export-btns", style: "gap:6px" });
    const run = async (btn, kind) => {
      btn.disabled = true;
      try {
        const d = await Promise.resolve(getData());
        if (!d || !d.rows || !d.rows.length) { TB.toast("لا توجد بيانات للتصدير", "error"); return; }
        d.columns = d.columns || [];
        if (kind === "excel") await TB.exportExcel(d, d.file);
        else if (kind === "pdf") await TB.exportPdfFile(d, d.file);
        else await TB.printReport(d);
      } catch (e) { TB.toast("⚠️ " + e.message, "error"); }
      btn.disabled = false;
    };
    const mk = (label, title, kind) => {
      const b = TB.el("button", { class: "btn btn-sm", title }, label);
      b.onclick = () => run(b, kind);
      return b;
    };
    wrap.append(
      mk("⬇️ إكسل", "تصدير النتائج إلى ملف Excel (.xlsx) في المكان الذي تختاره", "excel"),
      mk("📄 PDF", "تصدير النتائج إلى ملف PDF في المكان الذي تختاره", "pdf"),
      mk("🖨️ طباعة", "إرسال النتائج إلى الطابعة", "print")
    );
    return wrap;
  };
})();
