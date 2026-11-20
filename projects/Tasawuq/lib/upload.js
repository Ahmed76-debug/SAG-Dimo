/* ============================================================
   تسوق - Upload Handler (صور + فيديوهات)
   Parser متعدد الأجزاء آمن للعربية والملفات الثنائية
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { uid } = require("./db");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMG_EXT = ['.jpg','.jpeg','.png','.webp','.gif','.avif'];
const VID_EXT = ['.mp4','.webm','.mov','.mkv'];
const ALLOWED = [...IMG_EXT, ...VID_EXT];

function indexOf(buf, needle, from = 0) {
  return buf.indexOf(needle, from);
}

function parseMultipart(req, maxBytes = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return resolve({ fields: {}, files: [] });
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = m ? (m[1] || m[2]).trim() : null;
    if (!boundary) return resolve({ fields: {}, files: [] });

    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', c => {
      if (aborted) return;
      size += c.length;
      if (size > maxBytes) { aborted = true; reject(new Error('حجم الملفات كبير جدًا')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (aborted) return;
      try {
        const body = Buffer.concat(chunks);
        const dashBoundary = Buffer.from('--' + boundary);
        const crlf = Buffer.from('\r\n');
        const doubleCrlf = Buffer.from('\r\n\r\n');
        const fields = {};
        const files = [];

        let pos = indexOf(body, dashBoundary);
        if (pos < 0) return resolve({ fields, files });

        while (pos >= 0) {
          pos += dashBoundary.length;
          // closing boundary
          if (body[pos] === 0x2d && body[pos + 1] === 0x2d) break;
          // skip CRLF after boundary
          if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;

          const headerEnd = indexOf(body, doubleCrlf, pos);
          if (headerEnd < 0) break;
          const headersRaw = body.slice(pos, headerEnd).toString('utf8');
          const dataStart = headerEnd + 4;

          const nextBoundary = indexOf(body, dashBoundary, dataStart);
          if (nextBoundary < 0) break;
          // data ends before CRLF preceding boundary
          let dataEnd = nextBoundary;
          if (body[dataEnd - 2] === 0x0d && body[dataEnd - 1] === 0x0a) dataEnd -= 2;
          const data = body.slice(dataStart, dataEnd);

          const nameMatch = headersRaw.match(/name="([^"]*)"/i);
          const fileMatch = headersRaw.match(/filename="([^"]*)"/i);
          const fieldName = nameMatch ? nameMatch[1] : 'file';

          if (fileMatch) {
            const filename = fileMatch[1];
            const ext = path.extname(filename).toLowerCase();
            if (ALLOWED.includes(ext) && data.length > 0) {
              const type = VID_EXT.includes(ext) ? 'video' : 'image';
              const newName = uid() + ext;
              fs.writeFileSync(path.join(UPLOAD_DIR, newName), data);
              files.push({ field: fieldName, original: filename, name: newName, url: '/uploads/' + newName, type, ext, size: data.length });
            }
          } else {
            fields[fieldName] = data.toString('utf8');
          }

          pos = nextBoundary;
        }
        resolve({ fields, files });
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = { parseMultipart, UPLOAD_DIR, ALLOWED };
