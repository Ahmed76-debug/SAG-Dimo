const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { db, init, now } = require('./src/db');
const auth = require('./src/auth');

init();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/site', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const A = auth.authMiddleware;

// Basic login rate limiter (in-memory)
const LOGIN_ATTEMPTS = new Map();
function loginBlocked(ip) {
  const e = LOGIN_ATTEMPTS.get(ip);
  if (!e) return false;
  const now = Date.now();
  if (now - e.first > 15 * 60 * 1000) { LOGIN_ATTEMPTS.delete(ip); return false; }
  return e.count >= 8;
}
function recordLoginFailure(ip) {
  const e = LOGIN_ATTEMPTS.get(ip) || { count: 0, first: Date.now() };
  e.count += 1;
  if (!e.first) e.first = Date.now();
  LOGIN_ATTEMPTS.set(ip, e);
}
function clearLoginAttempts(ip) {
  LOGIN_ATTEMPTS.delete(ip);
}

function J(v) { try { return JSON.parse(v || '[]'); } catch { return []; } }
function S(v) { return JSON.stringify(Array.isArray(v) ? v : []); }

const allowed = {
  hero_stats: ['label','label_en','label_ar','value','icon','sort_order'],
  about_items: ['text','text_en','text_ar','sort_order'],
  vmv: ['kind','title','title_en','title_ar','body','sort_order'],
  values_list: ['label','label_en','label_ar','sort_order'],
  services: ['icon','title','title_en','title_ar','description','bullets','sort_order'],
  categories: ['title','title_en','title_ar','icon','description','sort_order'],
  subitems: ['category_id','text','text_en','text_ar','sort_order'],
  process_steps: ['num','title','title_en','title_ar','body','sort_order'],
  why_items: ['icon','title','title_en','title_ar','body','sort_order'],
  standards: ['icon','title','title_en','title_ar','body','sort_order'],
  segments: ['icon','title','title_en','title_ar','body','sort_order'],
  models: ['icon','title','title_en','title_ar','body','sort_order'],
  cases: ['tag','tag_en','tag_ar','title','title_en','title_ar','body','sort_order'],
  contact_fields: ['label','label_en','label_ar','value','sort_order'],
  experiences: ['icon','title','title_en','title_ar','organization','period','body','sort_order'],
  partners: ['name','name_en','name_ar','status','industry','note','sort_order'],
};

function updateRow(table, id, body) {
  const cols = allowed[table] || [];
  const ups = [], vals = [];
  for (const c of cols) {
    if (Object.prototype.hasOwnProperty.call(body, c)) {
      ups.push(`${c}=?`);
      vals.push(c === 'bullets' ? S(body[c]) : body[c]);
    }
  }
  if (!ups.length) return null;
  vals.push(id);
  db.prepare(`UPDATE ${table} SET ${ups.join(',')} WHERE id=?`).run(...vals);
  return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
}

function makeCrud(route, table, transform) {
  app.get(route, A, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY sort_order, id`).all();
    res.json(transform ? rows.map(transform) : rows);
  });
  app.post(route, A, (req, res) => {
    const cols = allowed[table];
    const data = req.body || {};
    const keys = cols.filter(k => Object.prototype.hasOwnProperty.call(data, k));
    // require at least title/text/label
    const fields = keys.length ? keys : cols.filter(c=>!['sort_order','icon','bullets','body','tag','num','value','description','category_id'].includes(c));
    const placeholders = fields.map(()=>'?').join(',');
    const vals = fields.map(c => c === 'bullets' ? S(data[c]) : (data[c] ?? null));
    // default sort_order
    if (!fields.includes('sort_order')) {
      const max = db.prepare(`SELECT COALESCE(MAX(sort_order),0) AS m FROM ${table}`).get().m;
      fields.push('sort_order'); vals.push(Number(max)+1);
    }
    const r = db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...vals);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(r.lastInsertRowid);
    res.status(201).json(transform ? transform(row) : row);
  });
  app.put(route + '/:id', A, (req, res) => {
    const id = Number(req.params.id);
    const row = updateRow(table, id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Not found or no changes' });
    res.json(transform ? transform(row) : row);
  });
  app.delete(route + '/:id', A, (req, res) => {
    const r = db.prepare(`DELETE FROM ${table} WHERE id=?`).run(Number(req.params.id));
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });
}

function withBullets(r) { return { ...r, bullets: J(r.bullets) }; }

// Auth
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (loginBlocked(ip)) return res.status(429).json({ error: 'Too many attempts. Try later.' });
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  const { verifyPassword, createSession } = auth;
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  clearLoginAttempts(ip);
  const s = createSession(user.id);
  res.json({ token: s.token, user: { id: user.id, username: user.username, role: user.role } });
});
app.post('/api/auth/logout', A, (req, res) => {
  auth.destroySession(req.token);
  res.json({ ok: true });
});
app.get('/api/auth/me', A, (req, res) => {
  res.json({ user: req.user });
});

// Settings
app.get('/api/settings', A, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});
app.put('/api/settings', A, (req, res) => {
  const data = req.body || {};
  const up = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at');
  const nowIso = new Date().toISOString();
  for (const [k,v] of Object.entries(data)) {
    if (typeof v === 'string' || v === null) {
      (v == null ? null : String(v));
      up.run(k, v == null ? null : String(v), nowIso);
    }
  }
  res.json({ ok: true });
});

// Settings test helpers (admin-only)
app.post('/api/settings/test-email', A, async (req, res) => {
  const s = getSettings();
  try {
    const r = await sendEmailNotification({
      id: 0, name: 'Admin Test', company: 'SMART ACTIVITY GROUP', email: s.company_email || s.smtp_user,
      phone: '', message: 'This is a test email from your profile admin settings.', created_at: new Date().toISOString(),
    }, s);
    res.json(r);
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});
app.post('/api/settings/test-whatsapp', A, async (req, res) => {
  const s = getSettings();
  try {
    const r = await sendWhatsAppNotification({
      name: 'Admin Test', company: 'SMART ACTIVITY GROUP', email: s.company_email || '',
      phone: s.whatsapp_recipient || s.whatsapp_number || '', message: 'This is a test WhatsApp message from your profile admin settings.',
      created_at: new Date().toISOString(),
    }, s);
    res.json(r);
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

// Messages
app.get('/api/messages', A, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC').all());
});
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function sendEmailNotification(msg, settings) {
  const host = settings.smtp_host;
  const port = Number(settings.smtp_port || 587);
  const user = settings.smtp_user;
  const pass = settings.smtp_pass;
  const to = settings.company_email;
  if (!host || !to) return { ok: false, reason: 'smtp not configured' };
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host, port,
    secure: String(settings.smtp_secure) === 'true',
    auth: user || pass ? { user, pass } : undefined,
  });
  const mail = {
    from: settings.smtp_from || user || 'no-reply@localhost',
    to,
    replyTo: msg.email || undefined,
    subject: `New inquiry: ${msg.name || '(no name)'} ${msg.company ? '('+msg.company+')' : ''}`.trim(),
    text:
`New inquiry received via profile website.

Name: ${msg.name || ''}
Company: ${msg.company || ''}
Email: ${msg.email || ''}
Phone: ${msg.phone || ''}

Message:
${msg.message || ''}

Received: ${msg.created_at}
`,
  };
  await transporter.sendMail(mail);
  return { ok: true };
}

async function sendWhatsAppNotification(msg, settings) {
  const phoneId = settings.whatsapp_phone_number_id;
  const token = settings.whatsapp_access_token;
  const recipient = String(settings.whatsapp_recipient || '').replace(/\D/g, '');
  if (!phoneId || !token || !recipient) return { ok: false, reason: 'whatsapp not configured' };
  const text = `New inquiry:\nName: ${msg.name || ''}\nCompany: ${msg.company || ''}\nEmail: ${msg.email || ''}\nPhone: ${msg.phone || ''}\nMessage: ${msg.message || ''}`;
  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error('WhatsApp send failed: ' + t);
  }
  return { ok: true };
}

app.post('/api/messages', async (req, res) => {
  const b = req.body || {};
  const created_at = new Date().toISOString();
  const r = db.prepare('INSERT INTO messages (name, company, email, phone, message, created_at) VALUES (?,?,?,?,?,?)')
    .run(b.name, b.company, b.email, b.phone, b.message, created_at);
  const msg = { id: r.lastInsertRowid, name: b.name, company: b.company, email: b.email, phone: b.phone, message: b.message, created_at };

  const settings = getSettings();
  const notifications = { email: false, whatsapp: false };
  const waNumber = (settings.whatsapp_number || '').replace(/\D/g, '');
  const prefill = encodeURIComponent(`Hello, I just sent an inquiry via your website.\nName: ${msg.name || ''}\nCompany: ${msg.company || ''}\nPhone: ${msg.phone || ''}\nEmail: ${msg.email || ''}\nMessage: ${msg.message || ''}`);
  const whatsapp_url = waNumber ? `https://wa.me/${waNumber}?text=${prefill}` : null;

  // attempt real delivery in background
  sendEmailNotification(msg, settings).then(() => { notifications.email = true; }).catch(err => console.error('Email send failed:', err.message));
  sendWhatsAppNotification(msg, settings).then(() => { notifications.whatsapp = true; }).catch(err => console.error('WhatsApp send failed:', err.message));

  res.status(201).json({ ok: true, id: msg.id, whatsapp_url });
});
app.patch('/api/messages/:id', A, (req, res) => {
  const b = req.body || {};
  const fields = ['status'];
  const ups = [], vals = [];
  for (const f of fields) if (Object.prototype.hasOwnProperty.call(b, f)) { ups.push(`${f}=?`); vals.push(b[f]); }
  if (!ups.length) return res.status(400).json({ error: 'No changes' });
  vals.push(Number(req.params.id));
  db.prepare(`UPDATE messages SET ${ups.join(',')} WHERE id=?`).run(...vals);
  res.json({ ok: true });
});
app.delete('/api/messages/:id', A, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Note endpoints
const typeTransform = { services: withBullets };
['hero_stats','about_items','vmv','values_list','services','categories','process_steps','why_items','standards','segments','models','cases','contact_fields','experiences','partners']
  .forEach(t => {
    const transform = typeTransform[t] ? typeTransform[t] : (t === 'services' ? withBullets : undefined);
    makeCrud('/api/' + t.replace('_','-'), t, transform);
  });

// Subitems nested
app.get('/api/subitems', A, (req, res) => {
  const cat = req.query.category_id;
  if (cat) {
    res.json(db.prepare('SELECT * FROM subitems WHERE category_id=? ORDER BY sort_order, id').all(Number(cat)));
  } else {
    res.json(db.prepare('SELECT * FROM subitems ORDER BY category_id, sort_order, id').all());
  }
});
app.post('/api/subitems', A, (req, res) => {
  const b = req.body || {};
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM subitems WHERE category_id=?').get(Number(b.category_id)).m;
  const r = db.prepare('INSERT INTO subitems (category_id, text, sort_order) VALUES (?,?,?)')
    .run(Number(b.category_id), b.text, b.sort_order != null ? b.sort_order : Number(max)+1);
  res.status(201).json(db.prepare('SELECT * FROM subitems WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/subitems/:id', A, (req, res) => {
  const b = req.body || {};
  const ups=[], vals=[];
  for (const f of ['category_id','text','sort_order']) if (Object.prototype.hasOwnProperty.call(b,f)) { ups.push(`${f}=?`); vals.push(b[f]); }
  if (!ups.length) return res.status(400).json({ error:'No changes' });
  vals.push(Number(req.params.id));
  db.prepare(`UPDATE subitems SET ${ups.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare('SELECT * FROM subitems WHERE id=?').get(Number(req.params.id)));
});
app.delete('/api/subitems/:id', A, (req, res) => {
  db.prepare('DELETE FROM subitems WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Categories with nested subitems
app.get('/api/categories-with-subitems', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const subs = db.prepare('SELECT * FROM subitems ORDER BY category_id, sort_order, id').all();
  const byCat = {};
  subs.forEach(s => { (byCat[s.category_id] ||= []).push(s); });
  res.json(cats.map(c => ({ ...c, subitems: byCat[c.id] || [] })));
});

// Aggregate site payload
app.get('/api/site', (req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = Object.fromEntries(settings.map(r => [r.key, r.value]));
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const subs = db.prepare('SELECT * FROM subitems ORDER BY category_id, sort_order, id').all();
  const byCat = {};
  subs.forEach(s => { (byCat[s.category_id] ||= []).push(s); });
  res.json({
    settings: settingsObj,
    hero_stats: db.prepare('SELECT * FROM hero_stats ORDER BY sort_order, id').all(),
    about_items: db.prepare('SELECT * FROM about_items ORDER BY sort_order, id').all(),
    vmv: db.prepare('SELECT * FROM vmv ORDER BY sort_order, id').all(),
    values_list: db.prepare('SELECT * FROM values_list ORDER BY sort_order, id').all(),
    services: db.prepare('SELECT * FROM services ORDER BY sort_order, id').all().map(withBullets),
    categories: categories.map(c => ({ ...c, subitems: byCat[c.id] || [] })),
    process_steps: db.prepare('SELECT * FROM process_steps ORDER BY sort_order, id').all(),
    why_items: db.prepare('SELECT * FROM why_items ORDER BY sort_order, id').all(),
    standards: db.prepare('SELECT * FROM standards ORDER BY sort_order, id').all(),
    segments: db.prepare('SELECT * FROM segments ORDER BY sort_order, id').all(),
    models: db.prepare('SELECT * FROM models ORDER BY sort_order, id').all(),
    cases: db.prepare('SELECT * FROM cases ORDER BY sort_order, id').all(),
    contact_fields: db.prepare('SELECT * FROM contact_fields ORDER BY sort_order, id').all(),
    experiences: db.prepare('SELECT * FROM experiences ORDER BY sort_order, id').all(),
    partners: db.prepare('SELECT * FROM partners ORDER BY sort_order, id').all(),
  });
});

// SPA fallback for admin
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get(/^\/admin(\/.*)?$/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Smart Profile CMS running on http://localhost:${port}`);
});
