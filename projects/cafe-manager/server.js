const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { dbKind, getRow, getRows, run, exec, ensureSetup, audit } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const now = () => new Date().toISOString().slice(0, 10);

/* async-safe route wrapper: any error returns JSON instead of crashing the server */
['get','post','put','delete','patch'].forEach(m => {
  const orig = app[m].bind(app);
  app[m] = (p, ...handlers) => orig(p, ...handlers.map(h => (req, res, next) =>
    Promise.resolve(typeof h === 'function' ? h(req, res, next) : h).catch(e => {
      console.error('❌ API Error [' + req.method + ' ' + req.originalUrl + ']:', e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    })));
});
process.on('unhandledRejection', e => console.error('⚠️ unhandled:', e?.message || e));

/* ================== الجلسات والصلاحيات ================== */
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 ساعة
const sessions = new Map(); // token -> session

const permsOf = u => { try { return typeof u === 'string' ? JSON.parse(u) : (u || {}); } catch { return {}; } };
const isAdmin = u => u && u.role === 'مدير';
const can = (u, page, action) => {
  if (!u) return false;
  if (isAdmin(u)) return true;
  const pm = permsOf(u.perms);
  return !!(pm && pm[page] && pm[page][action]);
};
const need = (page, action) => (req, res, next) => {
  if (!can(req.user, page, action)) return res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء' });
  next();
};
const needAdmin = (req, res, next) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'هذا الإجراء للمدير فقط' });
  next();
};

/* المصادقة: كل المسارات محتاجة توكن (ما عدا تسجيل الدخول) */
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/health') return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || '');
  const s = sessions.get(token);
  if (!s) return res.status(401).json({ error: 'انتهت الجلسة، برجاء تسجيل الدخول مرة أخرى' });
  if (Date.now() - s.at > SESSION_TTL) { sessions.delete(token); return res.status(401).json({ error: 'انتهت الجلسة، برجاء تسجيل الدخول مرة أخرى' }); }
  s.at = Date.now();
  req.user = s;
  next();
});
setInterval(() => {
  const nowTs = Date.now();
  for (const [k, v] of sessions) if (nowTs - v.at > SESSION_TTL) sessions.delete(k);
}, 30 * 60 * 1000).unref?.();

/* ================== أدوات ================== */
const addJournal = async (date, ref, desc, lines) => {
  for (const l of lines)
    await run('INSERT INTO journal(date,ref,`desc`,account,debit,credit) VALUES($1,$2,$3,$4,$5,$6)',
      [date, ref, desc, l.account, l.debit || 0, l.credit || 0]);
};
/* اقتباس أسماء الأعمدة (desc كلمة محجوزة في MySQL) */
const qcol = c => '`' + String(c).replace(/`/g, '``') + '`';
const colInsert = (table, cols) => async (body) => {
  const vals = cols.map(c => body[c]);
  const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
  const info = await run(`INSERT INTO ${table}(${cols.map(qcol).join(',')}) VALUES(${placeholders})`, vals);
  return info.lastInsertRowid;
};
const colUpdate = (table, cols) => async (id, body) => {
  const vals = cols.map(c => body[c]);
  await run(`UPDATE ${table} SET ${cols.map((c,i)=>`${qcol(c)}=$${i+1}`).join(',')} WHERE id=$${cols.length+1}`, [...vals, id]);
};

/* فلترة الفرع: المدير يشوف الكل، والكاشير مقصور على فرعه */
const BRANCH_TABLES = ['sales','purchases','finance','shifts'];
const branchFilter = (req) => {
  if (isAdmin(req.user)) return req.query.branch && req.query.branch !== 'all' ? String(req.query.branch) : null;
  return String(req.user.branch_id || 1);
};
const scopeRows = (rows, req, table) => {
  if (!BRANCH_TABLES.includes(table)) return rows;
  const b = branchFilter(req);
  return b ? rows.filter(x => String(x.branch_id) === b) : rows;
};
/* يمنع الكتابة في فرع تاني */
const forceBranch = (req, table, body) => {
  if (BRANCH_TABLES.includes(table) && body && 'branch_id' in body && !isAdmin(req.user)) {
    body.branch_id = req.user.branch_id || 1;
  }
  return body;
};

/* ================== المصادقة ================== */
app.get('/api/health', (req, res) => res.json({ ok: true, db: dbKind, time: now() }));

app.post('/api/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const pass = String(req.body.pass || '');
  let u = await getRow('SELECT * FROM users WHERE username=$1 AND pass=$2', [username, pass]);
  // الحساب الموحّد admin / admin123 يُطابق الاستعلام المباشر أعلاه
  if (!u) return res.status(401).json({ error: 'بيانات غير صحيحة' });
  const token = crypto.randomBytes(24).toString('hex');
  const session = { id: u.id, name: u.name, username: u.username, role: u.role, perms: permsOf(u.perms), branch_id: u.branch_id || 1, at: Date.now() };
  sessions.set(token, session);
  res.json({ ...session, token });
});
app.post('/api/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  sessions.delete(auth.replace('Bearer ', ''));
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  const u = req.user;
  res.json({ id: u.id, name: u.name, username: u.username, role: u.role, perms: u.perms, branch_id: u.branch_id });
});

/* ================== CRUD عام ================== */
const SOFT_TABLES = new Set(['suppliers', 'accounts', 'items', 'tables']);
const crud = (pathName, table, cols, opts = {}) => {
  const page = opts.page || pathName;
  const soft = SOFT_TABLES.has(table);
  app.get('/api/' + pathName, need(page, 'v'), async (req, res) => {
    let rows = await getRows(`SELECT * FROM ${table}${soft ? ' WHERE COALESCE(active,1)=1' : ''} ORDER BY id DESC`);
    rows = scopeRows(rows, req, table);
    res.json(rows);
  });
  app.post('/api/' + pathName, need(page, 'a'), async (req, res) => {
    try {
      const body = forceBranch(req, table, { ...req.body });
      const id = await colInsert(table, cols)(body);
      opts.extra && await opts.extra(body, id);
      await audit(req.user, 'create', table, id, body.name || body.username || '');
      res.json({ id });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.put('/api/' + pathName + '/:id', need(page, 'e'), async (req, res) => {
    try {
      await colUpdate(table, cols)(req.params.id, { ...req.body });
      await audit(req.user, 'update', table, req.params.id, req.body.name || req.body.username || '');
      res.json({ ok: true });
    }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete('/api/' + pathName + '/:id', need(page, 'd'), async (req, res) => {
    if (soft) {
      await run(`UPDATE ${table} SET active=0 WHERE id=$1`, [req.params.id]);
      await audit(req.user, 'delete', table, req.params.id, 'نقل إلى سلة المحذوفات');
    } else {
      await run(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
      await audit(req.user, 'delete', table, req.params.id, '');
    }
    res.json({ ok: true });
  });
};
crud('users', 'users', ['name','username','pass','role','perms','branch_id'], { page: 'users' });
crud('suppliers', 'suppliers', ['name','phone','address'], { page: 'suppliers' });
crud('accounts', 'accounts', ['name','type'], { page: 'accounts' });
crud('items', 'items', ['name','type','cost_price','sell_price','barcode'], { page: 'items' });
crud('recipes', 'recipes', ['menu_item','ingredient','qty'], { page: 'items' });
crud('purchases', 'purchases', ['supplier','item','qty','unitPrice','total','date','branch_id'], {
  page: 'purchases', extra: async b => {
    await addJournal(b.date || now(), 'PUR', `شراء ${b.item}`, [{account:'المشتريات', debit:b.total},{account:'الصندوق', credit:b.total}]);
  }
});
crud('sales', 'sales', ['customer','item','qty','price','total','payment','user_id','shift_id','date','branch_id'], {
  page: 'sales', extra: async b => {
    await addJournal(b.date || now(), 'SAL', `بيع ${b.item}`, [{account:'الصندوق', debit:b.total},{account:'إيرادات المبيعات', credit:b.total}]);
  }
});
crud('finance', 'finance', ['type','desc','amount','date','branch_id'], {
  page: 'finance', extra: async b => {
    await addJournal(b.date || now(), 'FIN', b.desc, b.type === 'expense'
      ? [{account:'مصروفات تشغيلية', debit:b.amount},{account:'الصندوق', credit:b.amount}]
      : [{account:'الصندوق', debit:b.amount},{account:'إيرادات أخرى', credit:b.amount}]);
  }
});

/* ================== أدوات البيانات (تفريغ + سلة محذوفات + سجل) ================== */
const PROTECTED_TABLES = new Set(['users', 'audit_log']);
const TRASH_ENTITIES = {
  suppliers: { table: 'suppliers', label: 'الموردون', col: 'name' },
  accounts: { table: 'accounts', label: 'دليل الحسابات', col: 'name' },
  items: { table: 'items', label: 'الأصناف', col: 'name' },
  tables: { table: 'tables', label: 'الطاولات', col: 'name' },
};
app.get('/api/data-tools', needAdmin, async (_, res) => {
  const names = dbKind === 'mysql'
    ? (await exec('SHOW TABLES')).map(r => Object.values(r)[0])
    : (await getRows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(r => r.name);
  const labels = {
    branches: 'الفروع', users: 'المستخدمون', suppliers: 'الموردون', accounts: 'دليل الحسابات',
    sales: 'المبيعات', purchases: 'المشتريات', finance: 'المالية', journal: 'القيود اليومية',
    shifts: 'الشيفتات', items: 'الأصناف', recipes: 'الوصفات', tables: 'الطاولات',
    orders: 'الطلبيات', order_items: 'بنود الطلبيات', audit_log: 'سجل التدقيق',
  };
  const tables = [];
  for (const name of names) {
    let rows = 0;
    try { rows = Number((await getRow(`SELECT COUNT(*) c FROM ${name}`)).c); } catch (e) { /* ignore */ }
    tables.push({ name, label: labels[name] || name, rows, protected: PROTECTED_TABLES.has(name) });
  }
  res.json({ tables });
});
app.post('/api/data-tools/truncate', needAdmin, async (req, res) => {
  const known = new Set(dbKind === 'mysql'
    ? (await exec('SHOW TABLES')).map(r => Object.values(r)[0])
    : (await getRows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(r => r.name));
  const selected = (Array.isArray(req.body.tables) ? req.body.tables.map(String) : [])
    .filter(t => known.has(t) && !PROTECTED_TABLES.has(t));
  if (!selected.length) return res.status(400).json({ error: 'اختر جدولًا واحدًا على الأقل (الجداول المحمية لا يمكن تفريغها)' });
  const cleared = [];
  try {
    if (dbKind === 'mysql') await exec('SET FOREIGN_KEY_CHECKS=0');
    else await exec('PRAGMA foreign_keys=OFF');
    for (const t of selected) {
      try { await run(`DELETE FROM ${t}`); cleared.push(t); } catch (e) { /* ignore */ }
    }
  } finally {
    try {
      if (dbKind === 'mysql') await exec('SET FOREIGN_KEY_CHECKS=1');
      else await exec('PRAGMA foreign_keys=ON');
    } catch (e) { /* ignore */ }
  }
  await audit(req.user, 'truncate', 'database', '', cleared.join(', '));
  res.json({ message: 'تم تفريغ الجداول المحددة', cleared });
});
app.get('/api/trash', needAdmin, async (_, res) => {
  const groups = [];
  for (const [key, cfg] of Object.entries(TRASH_ENTITIES)) {
    let rows = [];
    try { rows = await getRows(`SELECT id, ${cfg.col} AS name FROM ${cfg.table} WHERE COALESCE(active,1)=0 ORDER BY id DESC LIMIT 300`); } catch (e) { /* ignore */ }
    groups.push({ entity: key, label: cfg.label, rows });
  }
  res.json({ groups, total: groups.reduce((n, g) => n + g.rows.length, 0) });
});
app.post('/api/trash/:entity/:id/restore', needAdmin, async (req, res) => {
  const cfg = TRASH_ENTITIES[req.params.entity];
  if (!cfg) return res.status(404).json({ error: 'نوع غير معروف' });
  await run(`UPDATE ${cfg.table} SET active=1 WHERE id=$1`, [req.params.id]);
  await audit(req.user, 'restore', cfg.table, req.params.id, 'استعادة من السلة');
  res.json({ message: 'تمت الاستعادة' });
});
app.delete('/api/trash/:entity/:id', needAdmin, async (req, res) => {
  const cfg = TRASH_ENTITIES[req.params.entity];
  if (!cfg) return res.status(404).json({ error: 'نوع غير معروف' });
  try { await run(`DELETE FROM ${cfg.table} WHERE id=$1`, [req.params.id]); }
  catch (e) { return res.status(409).json({ error: 'لا يمكن الحذف النهائي لوجود بيانات مرتبطة' }); }
  await audit(req.user, 'purge', cfg.table, req.params.id, 'حذف نهائي');
  res.json({ message: 'تم الحذف النهائي' });
});
app.get('/api/audit', needAdmin, async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  res.json(await getRows(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ${limit}`));
});

/* ================== القيود اليومية ================== */
app.get('/api/journal', need('journal','v'), async (_, r) => r.json(await getRows('SELECT * FROM journal ORDER BY id DESC')));
app.post('/api/journal/entry', need('journal','a'), async (req, res) => {
  const { date, desc, lines } = req.body;
  if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ error: 'أضف سطور القيد' });
  const d = lines.reduce((a,l)=>a+ (+l.debit || 0),0), c = lines.reduce((a,l)=>a+ (+l.credit || 0),0);
  if (Math.abs(d - c) > 0.001) return res.status(400).json({ error: 'القيد غير متوازن' });
  await addJournal(date || now(), 'MAN', desc, lines);
  res.json({ ok: true });
});

/* ================== الشيفتات ================== */
app.get('/api/shifts', need('shifts','v'), async (req, r) => {
  let rows = await getRows('SELECT * FROM shifts ORDER BY id DESC');
  rows = scopeRows(rows, req, 'shifts');
  r.json(rows);
});
app.get('/api/shifts/open/:userId', async (req, res) => {
  const uid = isAdmin(req.user) ? req.params.userId : req.user.id;
  res.json(await getRow("SELECT * FROM shifts WHERE user_id=$1 AND status='open'", [uid]) || null);
});
app.post('/api/shifts/open', need('shifts','a'), async (req, res) => {
  const b = isAdmin(req.user) ? (req.body.branch_id || 1) : (req.user.branch_id || 1);
  const id = await run("INSERT INTO shifts(user_id,username,opened_at,opening_cash,status,branch_id) VALUES($1,$2,$3,$4,'open',$5)",
    [req.user.id, req.user.username || req.user.name, new Date().toLocaleString('ar-EG'), req.body.opening_cash, b]);
  res.json({ id: id.lastInsertRowid });
});
app.post('/api/shifts/close', need('shifts','e'), async (req, res) => {
  await run("UPDATE shifts SET closed_at=$1, closing_cash=$2, status='closed' WHERE id=$3",
    [new Date().toLocaleString('ar-EG'), req.body.closing_cash, req.body.id]);
  res.json({ ok: true });
});

/* ================== الفروع ================== */
app.get('/api/branches', async (_, res) => res.json(await getRows('SELECT * FROM branches ORDER BY id')));
app.post('/api/branches', needAdmin, async (req, res) => {
  const sql = dbKind === 'mysql'
    ? 'INSERT IGNORE INTO branches(name,address) VALUES($1,$2)'
    : 'INSERT OR IGNORE INTO branches(name,address) VALUES($1,$2)';
  const id = await run(sql, [req.body.name, req.body.address || '']);
  res.json({ id: id.lastInsertRowid });
});
app.delete('/api/branches/:id', needAdmin, async (req, res) => { await run('DELETE FROM branches WHERE id>1 AND id=$1', [req.params.id]); res.json({ ok: true }); });

/* ================== الطاولات والطلبيات ================== */
app.get('/api/tables', need('tables','v'), async (_, res) => {
  res.json(await getRows(`SELECT t.*, o.id oid, o.total ototal FROM tables t LEFT JOIN orders o ON o.table_id=t.id AND o.status='open' WHERE COALESCE(t.active,1)=1 ORDER BY t.id`));
});
app.post('/api/tables', need('tables','a'), async (req, res) => {
  const sql = dbKind === 'mysql'
    ? 'INSERT IGNORE INTO tables(name) VALUES($1)'
    : 'INSERT OR IGNORE INTO tables(name) VALUES($1)';
  const id = await run(sql, [req.body.name]);
  res.json({ id: id.lastInsertRowid });
});
app.delete('/api/tables/:id', need('tables','d'), async (req, res) => {
  await run("UPDATE tables SET active=0 WHERE id=$1 AND status='free'", [req.params.id]);
  await audit(req.user, 'delete', 'tables', req.params.id, 'نقل إلى سلة المحذوفات');
  res.json({ ok: true });
});
app.post('/api/orders', need('tables','a'), async (req, res) => {
  const t = await getRow('SELECT * FROM tables WHERE id=$1', [req.body.table_id]);
  if (!t) return res.status(400).json({ error: 'طاولة غير موجودة' });
  if (t.status !== 'free') return res.status(400).json({ error: 'الطاولة محجوزة بالفعل' });
  const id = await run("INSERT INTO orders(table_id,table_name,status,created_at,total) VALUES($1,$2,'open',$3,0)",
    [t.id, t.name, new Date().toLocaleString('ar-EG')]);
  await run("UPDATE tables SET status='busy' WHERE id=$1", [t.id]);
  res.json({ id: id.lastInsertRowid });
});
app.get('/api/orders/:id', need('tables','v'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o) return res.status(404).json({ error: 'غير موجود' });
  o.items = await getRows('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
  res.json(o);
});
app.post('/api/orders/:id/items', need('tables','a'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  const it = await getRow('SELECT * FROM items WHERE name=$1', [req.body.item]);
  const price = it ? +it.sell_price : +req.body.price;
  await run('INSERT INTO order_items(order_id,item,qty,price,total) VALUES($1,$2,$3,$4,$5)', [o.id, req.body.item, req.body.qty, price, req.body.qty * price]);
  await run('UPDATE orders SET total=(SELECT COALESCE(SUM(total),0) FROM order_items WHERE order_id=$1) WHERE id=$2', [o.id, o.id]);
  res.json({ ok: true });
});
app.delete('/api/orders/:oid/items/:iid', need('tables','e'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.oid]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  await run('DELETE FROM order_items WHERE id=$1 AND order_id=$2', [req.params.iid, o.id]);
  await run('UPDATE orders SET total=(SELECT COALESCE(SUM(total),0) FROM order_items WHERE order_id=$1) WHERE id=$2', [o.id, o.id]);
  res.json({ ok: true });
});
app.post('/api/orders/:id/cancel', need('tables','e'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  const cnt = await getRow('SELECT COUNT(*) c FROM order_items WHERE order_id=$1', [o.id]);
  if (Number(cnt?.c || 0) > 0) return res.status(400).json({ error: 'مفيش طريقة لإلغاء الطلب بعد إضافة أصناف، احذف الأصناف أو قم بالحساب' });
  await run("DELETE FROM orders WHERE id=$1 AND status='open'", [o.id]);
  await run("UPDATE tables SET status='free' WHERE id=$1", [o.table_id]);
  res.json({ ok: true });
});
app.post('/api/orders/:id/close', need('tables','e'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  const items = await getRows('SELECT * FROM order_items WHERE order_id=$1', [o.id]);
  const b = isAdmin(req.user) ? (req.body.branch_id || 1) : (req.user.branch_id || 1);
  for (const it of items) {
    await run('INSERT INTO sales(customer,item,qty,price,total,payment,user_id,shift_id,date,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [o.table_name, it.item, it.qty, it.price, it.total, req.body.payment || 'نقدي', req.user.id, req.body.shift_id || null, now(), b]);
  }
  if (items.length) await addJournal(now(), 'SAL', `فاتورة ${o.table_name}`, [{account:'الصندوق', debit:o.total},{account:'إيرادات المبيعات', credit:o.total}]);
  await run("UPDATE orders SET status='billed', billed_at=$1 WHERE id=$2", [new Date().toLocaleString('ar-EG'), o.id]);
  await run("UPDATE tables SET status='free' WHERE id=$1", [o.table_id]);
  res.json({ ok: true });
});
app.post('/api/orders/:id/transfer', need('tables','e'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  const t = await getRow('SELECT * FROM tables WHERE id=$1', [req.body.table_id]);
  if (!t) return res.status(400).json({ error: 'طاولة غير موجودة' });
  if (t.status !== 'free') return res.status(400).json({ error: 'الطاولة الهدف محجوزة' });
  await run("UPDATE tables SET status='free' WHERE id=$1", [o.table_id]);
  await run('UPDATE orders SET table_id=$1, table_name=$2 WHERE id=$3', [t.id, t.name, o.id]);
  await run("UPDATE tables SET status='busy' WHERE id=$1", [t.id]);
  res.json({ ok: true });
});
app.post('/api/orders/:id/pay-items', need('tables','e'), async (req, res) => {
  const o = await getRow('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'الأوردر مغلق' });
  const ids = req.body.item_ids || [];
  if (!ids.length) return res.status(400).json({ error: 'اختر أصنافاً' });
  const items = await getRows(`SELECT * FROM order_items WHERE order_id=$1 AND id IN (${ids.map((_,i)=>'$'+(i+2)).join(',')})`, [o.id, ...ids]);
  const paidTotal = items.reduce((a,i)=>a+(+i.total||0),0);
  const b = isAdmin(req.user) ? (req.body.branch_id || 1) : (req.user.branch_id || 1);
  for (const it of items) {
    await run('INSERT INTO sales(customer,item,qty,price,total,payment,user_id,shift_id,date,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [o.table_name + ' (تقسيم)', it.item, it.qty, it.price, it.total, req.body.payment || 'نقدي', req.user.id, req.body.shift_id || null, now(), b]);
    await run('DELETE FROM order_items WHERE id=$1', [it.id]);
  }
  await run('UPDATE orders SET total=(SELECT COALESCE(SUM(total),0) FROM order_items WHERE order_id=$1) WHERE id=$2', [o.id, o.id]);
  if (paidTotal > 0) await addJournal(now(), 'SAL', `فاتورة جزئية ${o.table_name}`, [{account:'الصندوق', debit:paidTotal},{account:'إيرادات المبيعات', credit:paidTotal}]);
  const left = +(await getRow('SELECT COUNT(*) c FROM order_items WHERE order_id=$1', [o.id])).c;
  if (!left) { await run("UPDATE orders SET status='billed', billed_at=$1 WHERE id=$2", [new Date().toLocaleString('ar-EG'), o.id]); await run("UPDATE tables SET status='free' WHERE id=$1", [o.table_id]); }
  res.json({ ok: true, remaining: left });
});

/* ================== تكلفة الوحدة ================== */
async function unitCost(itemName) {
  const it = await getRow('SELECT * FROM items WHERE name=$1', [itemName]);
  if (!it) return 0;
  if (+it.cost_price > 0 && it.type === 'menu') return +it.cost_price;
  const recs = await getRows('SELECT * FROM recipes WHERE menu_item=$1', [itemName]);
  if (recs.length) {
    let c = 0;
    for (const r of recs) {
      const ing = await getRow('SELECT * FROM items WHERE name=$1', [r.ingredient]);
      c += (+r.qty || 0) * (ing ? +ing.cost_price : 0);
    }
    return c;
  }
  const avg = await getRow('SELECT AVG("unitPrice") a FROM purchases WHERE item=$1', [itemName]);
  return avg && avg.a ? +avg.a : (+it.cost_price || 0);
}

/* ================== التقارير ================== */
app.get('/api/report/pl', need('reports','v'), async (req, res) => {
  const sales = scopeRows(await getRows('SELECT * FROM sales'), req, 'sales');
  const fin = scopeRows(await getRows('SELECT * FROM finance'), req, 'finance');
  const revenue = sales.reduce((a,x)=>a+(+x.total||0),0) + fin.filter(x=>x.type==='revenue').reduce((a,x)=>a+(+x.amount||0),0);
  let cogs = 0; for (const x of sales) cogs += (+x.qty||0) * await unitCost(x.item);
  const expenses = fin.filter(x=>x.type==='expense').reduce((a,x)=>a+(+x.amount||0),0);
  const byItem = Object.entries(sales.reduce((m,x)=>(m[x.item]=(m[x.item]||0)+ (+x.total||0),m),{})).map(([item,total])=>({item,total}));
  res.json({ revenue, cogs, expenses, gross: revenue-cogs, net: revenue-cogs-expenses, byItem });
});
app.get('/api/report/inventory', need('reports','v'), async (req, res) => {
  const items = await getRows('SELECT * FROM items');
  const purchases = scopeRows(await getRows('SELECT * FROM purchases'), req, 'purchases');
  const sales = scopeRows(await getRows('SELECT * FROM sales'), req, 'sales');
  const rows = items.map(it => {
    const pp = purchases.filter(x=>x.item===it.name);
    const inQty = pp.reduce((a,x)=>a+(+x.qty||0),0);
    const outQty = sales.filter(x=>x.item===it.name).reduce((a,x)=>a+(+x.qty||0),0);
    const avg = pp.length ? pp.reduce((a,x)=>a+(+x.unitPrice||0),0) / pp.length : (+it.cost_price||0);
    const remaining = Math.max(0, inQty - outQty);
    return { name: it.name, type: it.type, inQty, outQty: Math.round(outQty*1000)/1000, remaining: Math.round(remaining*1000)/1000, avg: Math.round(avg*100)/100, value: Math.round(remaining*avg*100)/100 };
  });
  res.json(rows);
});
app.get('/api/report/payments', need('reports','v'), async (req, res) => {
  const rows = await getRows("SELECT payment, COUNT(*) cnt, COALESCE(SUM(total),0) total FROM sales GROUP BY payment");
  const map = {}; rows.forEach(r => map[r.payment] = +r.total);
  const closing = await getRow("SELECT COALESCE(SUM(closing_cash),0) closing FROM shifts WHERE status='closed'");
  res.json({ rows, map, shifts: +closing.closing || 0 });
});
app.get('/api/report/shift/:id', need('reports','v'), async (req, res) => {
  const sh = await getRow('SELECT * FROM shifts WHERE id=$1', [req.params.id]);
  if (!sh) return res.status(404).json({ error: 'غير موجود' });
  const sales = await getRows('SELECT * FROM sales WHERE shift_id=$1', [req.params.id]);
  const byPayment = sales.reduce((m,s)=>(m[s.payment]=(m[s.payment]||0)+ (+s.total||0),m),{});
  const total = sales.reduce((a,s)=>a+(+s.total||0),0);
  const cashSales = sales.filter(s=>s.payment==='نقدي').reduce((a,s)=>a+(+s.total||0),0);
  res.json({ shift: sh, sales, byPayment, total, cashExpected: +sh.opening_cash + cashSales });
});

/* ================== لوحة التحكم ================== */
app.get('/api/dashboard', async (req, res) => {
  const sales = scopeRows(await getRows('SELECT * FROM sales'), req, 'sales');
  const purchases = scopeRows(await getRows('SELECT * FROM purchases'), req, 'purchases');
  const fin = scopeRows(await getRows('SELECT * FROM finance'), req, 'finance');
  const salesTotal = sales.reduce((a,x)=>a+(+x.total||0),0);
  const purchTotal = purchases.reduce((a,x)=>a+(+x.total||0),0);
  const extraRev = fin.filter(x=>x.type==='revenue').reduce((a,x)=>a+(+x.amount||0),0);
  const extraExp = fin.filter(x=>x.type==='expense').reduce((a,x)=>a+(+x.amount||0),0);
  const invoices = sales.length;
  const grouped = {};
  const from = new Date(Date.now()-6*864e5).toISOString().slice(0,10);
  sales.filter(x => x.date >= from).forEach(x => grouped[x.date] = (grouped[x.date]||0) + (+x.total||0));
  const chart = Object.keys(grouped).sort().map(date => ({ date, total: grouped[date] }));
  res.json({ salesTotal, purchTotal, invoices, net: salesTotal + extraRev - purchTotal - extraExp, chart });
});

/* ================== القوائم المالية ================== */
app.get('/api/reports', need('reports','v'), async (req, res) => {
  const sales = scopeRows(await getRows('SELECT * FROM sales'), req, 'sales');
  const purchases = scopeRows(await getRows('SELECT * FROM purchases'), req, 'purchases');
  const fin = scopeRows(await getRows('SELECT * FROM finance'), req, 'finance');
  const CAPITAL = 100000;
  let endInv = 0;
  const itemsNames = [...new Set([...purchases.map(p=>p.item), ...sales.map(s=>s.item)])];
  for (const n of itemsNames) {
    const pp = purchases.filter(p => p.item === n);
    const avg = pp.length ? pp.reduce((a,p)=>a+(+p.unitPrice||0),0) / pp.length : 0;
    const qin = pp.reduce((a,p)=>a+(+p.qty||0),0);
    const qout = sales.filter(s => s.item === n).reduce((a,s)=>a+(+s.qty||0),0);
    endInv += Math.max(0, qin - qout) * avg;
  }
  const purchaseTotal = purchases.reduce((a,p)=>a+(+p.total||0),0);
  const cogs = purchaseTotal - endInv;
  const salesRev = sales.reduce((a,s)=>a+(+s.total||0),0);
  const extraRev = fin.filter(x=>x.type==='revenue').reduce((a,x)=>a+(+x.amount||0),0);
  const extraExp = fin.filter(x=>x.type==='expense').reduce((a,x)=>a+(+x.amount||0),0);
  const net = salesRev - cogs - extraExp + extraRev;
  const cash = CAPITAL + salesRev + extraRev - purchaseTotal - extraExp;
  const equity = CAPITAL + net;
  res.json({ salesRev, cogs, extraRev, extraExp, net, cash, endInv, equity, CAPITAL });
});

/* ================== النسخ الاحتياطي والاسترجاع ================== */
const BACKUP_TABLES = ['branches','users','suppliers','accounts','items','recipes','sales','purchases','finance','journal','shifts','tables','orders','order_items'];

app.get('/api/backup', needAdmin, async (req, res) => {
  const data = {};
  for (const t of BACKUP_TABLES) data[t] = await getRows(`SELECT * FROM ${t}`);
  res.json({
    meta: { createdAt: new Date().toISOString(), db: dbKind, app: 'كافيه برو', version: 1 },
    data
  });
});
app.post('/api/restore', needAdmin, async (req, res) => {
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
  try {
    for (const t of [...BACKUP_TABLES].reverse()) await run(`DELETE FROM ${t}`);
    let count = 0;
    for (const t of BACKUP_TABLES) {
      for (const row of (data[t] || [])) {
        const cols = Object.keys(row);
        const vals = cols.map(c => row[c] === undefined ? null : row[c]);
        await run(`INSERT INTO ${t}(${cols.map(qcol).join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')})`, vals);
        count++;
      }
    }
    // إعادة ضبط العدادات بعد الاسترجاع
    for (const t of BACKUP_TABLES) {
      if (dbKind === 'mysql') {
        const m = await getRow(`SELECT COALESCE(MAX(id),0) m FROM ${t}`);
        await exec(`ALTER TABLE ${t} AUTO_INCREMENT = ${Number(m && m.m) + 1}`);
      } else {
        await run(`UPDATE sqlite_sequence SET seq=(SELECT COALESCE(MAX(id),1) FROM ${t}) WHERE name='${t}'`);
      }
    }
    res.json({ ok: true, restored: count });
  } catch (e) {
    res.status(400).json({ error: 'فشل الاسترجاع: ' + e.message });
  }
});

/* ================== التشغيل ================== */
const fs = require('fs');

function listenFree(app, startPort, attempts = 10) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(startPort, process.env.HOST || '0.0.0.0');
    srv.once('listening', () => resolve({ srv, port: startPort }));
    srv.once('error', e => {
      if (e.code === 'EADDRINUSE' && attempts > 0) {
        console.log(`⚠️ المنفذ ${startPort} مشغول، هجرّب ${startPort + 1}...`);
        resolve(listenFree(app, startPort + 1, attempts - 1));
      } else reject(e);
    });
  });
}

async function start() {
  await ensureSetup();
  const desired = +process.env.PORT || 3000;
  const { port } = await listenFree(app, desired);
  try { fs.writeFileSync(path.join(__dirname, '.port'), String(port)); } catch {}
  console.log('🚀 http://localhost:' + port + '  [' + dbKind + ']');
}
start().catch(e => { console.error(e); process.exit(1); });
