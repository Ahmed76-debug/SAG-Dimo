/* ============================================================
   تسوق - خادم الموقع الرئيسي
   موقع مبوبات لبيع السيارات والمنازل والأراضي + نظام عمولة
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { initSchema, seed } = require("./lib/db");
const { getSession, createToken, logActivity, hash } = require("./lib/auth");
const { parseMultipart } = require("./lib/upload");
const { q, one, nowISO } = require("./lib/db");

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC = path.join(__dirname, "public");

initSchema();
seed();

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

function send(res, status, data, type, headers={}) {
  if (Buffer.isBuffer(data)) {
    res.writeHead(status, { "Content-Type": type||"application/octet-stream", "Cache-Control": "no-cache", ...headers });
    return res.end(data);
  }
  if (typeof data === "string") {
    res.writeHead(status, { "Content-Type": type||"text/plain; charset=utf-8", "Cache-Control": "no-cache", ...headers });
    return res.end(data);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache", ...headers });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "", size=0;
    req.on("data", c=>{ size+=c.length; if(size>20*1024*1024){req.destroy();return;} raw+=c; });
    req.on("end", ()=>{ if(!raw)return resolve({}); try{resolve(JSON.parse(raw));}catch{return resolve({});} });
  });
}

function getIP(req) { return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || ''; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host||'localhost'}`);
  const pathname = url.pathname;

  // CORS for local preview
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  try {
    // API
    if (pathname.startsWith("/api/")) {
      const token = (req.headers.authorization||"").replace("Bearer ","").trim();
      const sess = getSession(token);
      req.user = sess?.user || null;

      // Auth
      if (pathname === "/api/auth/register" && req.method === "POST") {
        const body = await readBody(req);
        if (!body.name || !body.phone || !body.password) return send(res,400,{error:"يرجى إدخال الاسم ورقم الهاتف وكلمة المرور"});
        const exist = one("SELECT id FROM users WHERE phone=? OR email=?", [body.phone, body.email||'']);
        if (exist) return send(res,400,{error:"هذا الرقم أو البريد مسجل بالفعل"});
        const r = q("INSERT INTO users (name,email,phone,password,role,status,city) VALUES (?,?,?,?,?,?,?)", [body.name, body.email||null, body.phone, hash(body.password), 'user', 'active', body.city||null]);
        const token2 = createToken(r.lastInsertRowid, getIP(req), req.headers['user-agent']);
        const u = one("SELECT id,name,email,phone,role,avatar,status FROM users WHERE id=?", [r.lastInsertRowid]);
        logActivity(r.lastInsertRowid, 'register', getIP(req), req.headers['user-agent'], {});
        return send(res,201,{token:token2, user:u});
      }

      if (pathname === "/api/auth/login" && req.method === "POST") {
        try {
          const body = await readBody(req);
          if (!body.password) return send(res,400,{error:"يرجى إدخال كلمة المرور"});
          const identifier = body.phone || body.email || body.username || body.login || body.user;
          if (!identifier) return send(res,400,{error:"يرجى إدخال رقم الهاتف أو البريد الإلكتروني"});
          let u = one("SELECT * FROM users WHERE phone=? OR email=?", [String(identifier).trim(), String(identifier).trim()]);
          if (!u) u = one("SELECT * FROM users WHERE lower(phone)=lower(?) OR lower(email)=lower(?)", [String(identifier).trim(), String(identifier).trim()]);
          if (!u || u.password !== hash(body.password)) return send(res,401,{error:"بيانات الدخول غير صحيحة"});
          if (u.status === 'blocked') return send(res,403,{error:"تم حظر هذا الحساب"});
          const token2 = createToken(u.id, getIP(req), req.headers['user-agent']);
          try { q("UPDATE users SET last_login=? WHERE id=?", [nowISO(), u.id]); } catch(e){}
          delete u.password;
          logActivity(u.id, 'login', getIP(req), req.headers['user-agent'], {});
          return send(res,200,{token:token2, user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,avatar:u.avatar,status:u.status}});
        } catch(e) {
          console.error('LOGIN ERR', e);
          return send(res,500,{error:"خطأ في الخادم"});
        }
      }

      if (pathname === "/api/auth/me" && req.method === "GET") {
        if (!req.user) return send(res,401,{error:"غير مسجل"});
        const u = one("SELECT id,name,email,phone,avatar,role,status,city,address,bio FROM users WHERE id=?", [req.user.id]);
        return send(res,200,{user:u});
      }

      if (pathname === "/api/auth/logout" && req.method === "POST") {
        if (token) q("DELETE FROM sessions WHERE token=?", [token]);
        return send(res,200,{ok:true});
      }

      // Public listings
      if (pathname === "/api/listings" && req.method === "GET") {
        const type = url.searchParams.get('type');
        const cat = url.searchParams.get('category_id');
        const city = url.searchParams.get('city');
        const qsearch = url.searchParams.get('q');
        const min = url.searchParams.get('min');
        const max = url.searchParams.get('max');
        const sort = url.searchParams.get('sort') || 'newest';
        const featuredOnly = url.searchParams.get('featured') === '1';
        const page = Math.max(1, parseInt(url.searchParams.get('page'))||1);
        const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get('limit'))||12));
        const offset = (page-1)*limit;
        let where = "WHERE l.status='approved'";
        let params = [];
        if (featuredOnly) where += " AND l.featured=1";
        if (type) { where += " AND l.type=?"; params.push(type); }
        if (cat) { where += " AND l.category_id=?"; params.push(cat); }
        if (city) { where += " AND (l.city LIKE ? OR l.area LIKE ?)"; params.push('%'+city+'%', '%'+city+'%'); }
        if (qsearch) { where += " AND (l.title LIKE ? OR l.description LIKE ? OR l.city LIKE ?)"; params.push('%'+qsearch+'%', '%'+qsearch+'%', '%'+qsearch+'%'); }
        if (min) { where += " AND l.price>=?"; params.push(Number(min)); }
        if (max) { where += " AND l.price<=?"; params.push(Number(max)); }
        const ORDER = {
          newest: "l.featured DESC, l.created_at DESC",
          price_low: "l.price ASC",
          price_high: "l.price DESC",
          views: "l.views DESC",
        }[sort] || "l.featured DESC, l.created_at DESC";
        const rows = q(`SELECT l.*, u.name as seller_name, u.phone as seller_phone, c.name as category_name, c.icon as category_icon,
          (SELECT url FROM listing_media WHERE listing_id=l.id AND type='image' ORDER BY sort_order LIMIT 1) as thumb
          FROM listings l LEFT JOIN users u ON u.id=l.user_id LEFT JOIN categories c ON c.id=l.category_id
          ${where} ORDER BY ${ORDER} LIMIT ${limit} OFFSET ${offset}`, params);
        const total = one(`SELECT COUNT(*) as cnt FROM listings l ${where}`, params).cnt;
        return send(res,200,{rows, total, page, pages: Math.ceil(total/limit)||1});
      }

      if (pathname === "/api/pages" && req.method === "GET") {
        return send(res,200,{rows: q("SELECT id,title,slug FROM pages WHERE active=1")});
      }
      if (pathname.match(/^\/api\/pages\/([\w-]+)$/) && req.method === "GET") {
        const slug = pathname.split('/')[3];
        const p = one("SELECT * FROM pages WHERE slug=? AND active=1", [slug]);
        if (!p) return send(res,404,{error:"الصفحة غير موجودة"});
        return send(res,200,{page:p});
      }

      if (pathname.match(/^\/api\/listings\/(\d+)$/) && req.method === "GET") {
        const id = pathname.split('/')[3];
        const l = one(`SELECT l.*, u.name as seller_name, u.phone as seller_phone, u.avatar as seller_avatar, u.created_at as seller_since
          FROM listings l LEFT JOIN users u ON u.id=l.user_id WHERE l.id=?`, [id]);
        if (!l) return send(res,404,{error:"الإعلان غير موجود"});
        if (l.status !== 'approved' && (!req.user || (req.user.role!=='admin' && req.user.id!==l.user_id))) return send(res,404,{error:"الإعلان غير موجود"});
        q("UPDATE listings SET views = views + 1 WHERE id=?", [id]);
        const media = q("SELECT * FROM listing_media WHERE listing_id=? ORDER BY sort_order,id", [id]);
        const attrs = q("SELECT * FROM listing_attrs WHERE listing_id=?", [id]);
        return send(res,200,{listing:l, media, attrs});
      }

      // Categories public
      if (pathname === "/api/categories" && req.method === "GET") {
        const rows = q("SELECT * FROM categories WHERE active=1 ORDER BY sort_order,id");
        return send(res,200,{rows});
      }

      // Settings public
      if (pathname === "/api/settings" && req.method === "GET") {
        const rows = q("SELECT * FROM settings");
        const s = {}; for (const r of rows) s[r.key]=r.value;
        return send(res,200,s);
      }

      // Public stats (homepage counters + category counts)
      if (pathname === "/api/stats" && req.method === "GET") {
        const listings = one("SELECT COUNT(*) c FROM listings WHERE status='approved'").c;
        const users = one("SELECT COUNT(*) c FROM users WHERE status='active'").c;
        const views = one("SELECT SUM(views) s FROM listings WHERE status='approved'").s || 0;
        const cars = one("SELECT COUNT(*) c FROM listings WHERE status='approved' AND type='cars'").c;
        const realEstate = one("SELECT COUNT(*) c FROM listings WHERE status='approved' AND type='real_estate'").c;
        const lands = one("SELECT COUNT(*) c FROM listings WHERE status='approved' AND type='lands'").c;
        const commissionPercent = one("SELECT value FROM settings WHERE key='commission_percent'");
        const siteName = one("SELECT value FROM settings WHERE key='site_name'");
        return send(res,200, {
          listings, users, views, cars, real_estate: realEstate, lands,
          commission_percent: Number(commissionPercent ? commissionPercent.value : 2) || 2,
          site_name: siteName ? siteName.value : 'تسوق'
        });
      }

      // User: create listing
      if (pathname === "/api/my/listings" && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const mp = await parseMultipart(req);
        const body = mp.fields;
        if (!body.title || !body.type || !body.price) return send(res,400,{error:"يرجى إدخال العنوان ونوع الإعلان والسعر"});
        const slug = (body.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'-') + '-' + Date.now()).toLowerCase().replace(/-+/g,'-');
        const ins = q("INSERT INTO listings (user_id,category_id,title,slug,type,price,currency,negotiable,description,city,area,address,phone,whatsapp,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [req.user.id, body.category_id||null, body.title, slug, body.type, body.price, 'ج.م', body.negotiable==='0'?0:1, body.description||'', body.city||'', body.area||'', body.address||'', body.phone||req.user.phone||'', body.whatsapp||'', 'pending']);
        const lid = ins.lastInsertRowid;
        for (let i=0;i<mp.files.length;i++) {
          const f = mp.files[i];
          q("INSERT INTO listing_media (listing_id,type,url,sort_order) VALUES (?,?,?,?)", [lid, f.type, f.url, i]);
        }
        // attrs
        const cars = ['brand','model','year','km','fuel','transmission','color','condition'];
        const re = ['rooms','bathrooms','area_m2','floor','furnished'];
        const lands = ['area_m2','land_type','purpose'];
        const keys = body.type==='cars'?cars: body.type==='real_estate'?re: lands;
        for (const k of keys) if (body[k]) q("INSERT INTO listing_attrs (listing_id,attr_key,attr_value) VALUES (?,?,?)", [lid, k, body[k]]);
        logActivity(req.user.id, 'create_listing', getIP(req), req.headers['user-agent'], {id:lid});
        return send(res,201,{ok:true, id:lid, message:"تم إرسال الإعلان بنجاح، بانتظار موافقة الإدارة"});
      }

      if (pathname === "/api/my/listings" && req.method === "GET") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const rows = q(`SELECT l.*, (SELECT url FROM listing_media WHERE listing_id=l.id AND type='image' ORDER BY sort_order LIMIT 1) as thumb
          FROM listings l WHERE l.user_id=? ORDER BY l.id DESC`, [req.user.id]);
        return send(res,200,{rows});
      }

      // تعيين إعلان كـ "مباع" من صاحب الإعلان
      if (pathname.match(/^\/api\/my\/listings\/(\d+)\/sold$/) && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const id = pathname.split('/')[4];
        const l = one("SELECT id,user_id FROM listings WHERE id=?", [id]);
        if (!l || (l.user_id !== req.user.id && req.user.role !== 'admin')) return send(res,404,{error:"الإعلان غير موجود"});
        q("UPDATE listings SET status='sold', sold_at=? WHERE id=?", [nowISO(), id]);
        logActivity(req.user.id, 'listing_sold', getIP(req), req.headers['user-agent'], {id});
        return send(res,200,{ok:true});
      }

      // حذف إعلان من صاحب الإعلان
      if (pathname.match(/^\/api\/my\/listings\/(\d+)\/delete$/) && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const id = pathname.split('/')[4];
        const l = one("SELECT id,user_id,status FROM listings WHERE id=?", [id]);
        if (!l || (l.user_id !== req.user.id && req.user.role !== 'admin')) return send(res,404,{error:"الإعلان غير موجود"});
        if (l.status === 'sold' && req.user.role !== 'admin') return send(res,400,{error:"لا يمكن حذف إعلان تم بيعه"});
        q("DELETE FROM listing_media WHERE listing_id=?", [id]);
        q("DELETE FROM listing_attrs WHERE listing_id=?", [id]);
        q("DELETE FROM favorites WHERE listing_id=?", [id]);
        q("DELETE FROM listings WHERE id=?", [id]);
        logActivity(req.user.id, 'listing_delete', getIP(req), req.headers['user-agent'], {id});
        return send(res,200,{ok:true});
      }

      // تعديل بيانات إعلان (صاحب الإعلان) - يعاد للمراجعة
      if (pathname.match(/^\/api\/my\/listings\/(\d+)$/) && req.method === "PUT") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const id = pathname.split('/')[4];
        const l = one("SELECT id,user_id FROM listings WHERE id=?", [id]);
        if (!l || (l.user_id !== req.user.id && req.user.role !== 'admin')) return send(res,404,{error:"الإعلان غير موجود"});
        const b = await readBody(req);
        const fields = ['title','price','description','city','area','address','phone','whatsapp','negotiable'];
        const sets = [], vals = [];
        for (const f of fields) if (b[f] !== undefined) { sets.push(f+'=?'); vals.push(b[f]); }
        if (!sets.length) return send(res,400,{error:"لا توجد بيانات للتعديل"});
        sets.push("status='pending'"); sets.push("rejection_reason=NULL");
        vals.push(id);
        q(`UPDATE listings SET ${sets.join(', ')} WHERE id=?`, vals);
        logActivity(req.user.id, 'listing_update', getIP(req), req.headers['user-agent'], {id});
        return send(res,200,{ok:true});
      }

      // Favorites
      if (pathname === "/api/favorites" && req.method === "GET") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const rows = q(`SELECT l.*, c.name as category_name, (SELECT url FROM listing_media WHERE listing_id=l.id AND type='image' ORDER BY sort_order LIMIT 1) as thumb
          FROM favorites f JOIN listings l ON l.id=f.listing_id LEFT JOIN categories c ON c.id=l.category_id
          WHERE f.user_id=? AND l.status='approved' ORDER BY f.id DESC`, [req.user.id]);
        return send(res,200,{rows});
      }
      if (pathname === "/api/favorites/toggle" && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const body = await readBody(req);
        const ex = one("SELECT id FROM favorites WHERE user_id=? AND listing_id=?", [req.user.id, body.listing_id]);
        if (ex) { q("DELETE FROM favorites WHERE id=?", [ex.id]); return send(res,200,{fav:false}); }
        else { q("INSERT INTO favorites (user_id,listing_id) VALUES (?,?)", [req.user.id, body.listing_id]); return send(res,200,{fav:true}); }
      }

      // Messages
      if (pathname === "/api/messages" && req.method === "GET") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const rows = q(`SELECT m.*, u.name as from_name, u.avatar as from_avatar FROM messages m JOIN users u ON u.id=m.from_user WHERE m.to_user=? ORDER BY m.id DESC`, [req.user.id]);
        return send(res,200,{rows});
      }
      if (pathname === "/api/messages/send" && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const body = await readBody(req);
        if (!body.to_user || !body.message) return send(res,400,{error:"يرجى إدخال الرسالة"});
        q("INSERT INTO messages (from_user,to_user,listing_id,subject,message) VALUES (?,?,?,?,?)", [req.user.id, body.to_user, body.listing_id||null, body.subject||'', body.message]);
        return send(res,201,{ok:true});
      }
      if (pathname.match(/^\/api\/messages\/(\d+)\/read$/) && req.method === "POST") {
        if (!req.user) return send(res,401,{error:"يجب تسجيل الدخول"});
        const id = pathname.split('/')[4];
        q("UPDATE messages SET read=1 WHERE id=? AND to_user=?", [id, req.user.id]);
        return send(res,200,{ok:true});
      }

      // Admin
      if (pathname.startsWith("/api/admin/")) {
        if (!req.user || (req.user.role!=='admin' && req.user.role!=='moderator')) return send(res,403,{error:"غير مصرح"});
        if (pathname === "/api/admin/stats" && req.method === "GET") {
          const users = one("SELECT COUNT(*) c FROM users").c;
          const listings = one("SELECT COUNT(*) c FROM listings").c;
          const pending = one("SELECT COUNT(*) c FROM listings WHERE status='pending'").c;
          const approved = one("SELECT COUNT(*) c FROM listings WHERE status='approved'").c;
          const sold = one("SELECT COUNT(*) c FROM listings WHERE status='sold'").c;
          const views = one("SELECT SUM(views) s FROM listings").s||0;
          const tx = one("SELECT COUNT(*) c, SUM(commission) s FROM transactions WHERE status='completed'").c||0;
          const commission = one("SELECT SUM(commission) s FROM transactions WHERE status='completed'").s||0;
          return send(res,200,{users,listings,pending,approved,sold,views,tx,commission});
        }
        if (pathname === "/api/admin/listings" && req.method === "GET") {
          const status = url.searchParams.get('status');
          let where = ""; let params=[];
          if (status) { where="WHERE l.status=?"; params=[status]; }
          const rows = q(`SELECT l.*, u.name as seller_name, u.phone as seller_phone, c.name as category_name
            FROM listings l LEFT JOIN users u ON u.id=l.user_id LEFT JOIN categories c ON c.id=l.category_id
            ${where} ORDER BY l.id DESC`, params);
          return send(res,200,{rows});
        }
        if (pathname.match(/^\/api\/admin\/listings\/(\d+)\/(approve|reject|feature|sold)$/) && req.method === "POST") {
          const parts = pathname.split('/');
          const id = parts[4], act = parts[5];
          if (act==='approve') q("UPDATE listings SET status='approved', approved_at=?, approved_by=? WHERE id=?", [nowISO(), req.user.id, id]);
          if (act==='reject') { const b=await readBody(req); q("UPDATE listings SET status='rejected', rejection_reason=? WHERE id=?", [b.reason||'', id]); }
          if (act==='feature') { const l=one("SELECT featured FROM listings WHERE id=?", [id]); q("UPDATE listings SET featured=? WHERE id=?", [l.featured?0:1, id]); }
          if (act==='sold') q("UPDATE listings SET status='sold', sold_at=? WHERE id=?", [nowISO(), id]);
          logActivity(req.user.id, 'admin_listing_'+act, getIP(req), req.headers['user-agent'], {id});
          return send(res,200,{ok:true});
        }
        if (pathname === "/api/admin/users" && req.method === "GET") {
          const rows = q("SELECT id,name,email,phone,role,status,city,last_login,created_at FROM users ORDER BY id DESC");
          return send(res,200,{rows});
        }
        if (pathname === "/api/admin/users" && req.method === "POST") {
          const body = await readBody(req);
          if (!body.name || !body.phone || !body.password) return send(res,400,{error:"بيانات ناقصة"});
          const r = q("INSERT INTO users (name,email,phone,password,role,status) VALUES (?,?,?,?,?,?)", [body.name, body.email||null, body.phone, hash(body.password), body.role||'user', body.status||'active']);
          return send(res,201,{ok:true,id:r.lastInsertRowid});
        }
        // تعديل دور المستخدم / حالته / حذفه
        if (pathname.match(/^\/api\/admin\/users\/(\d+)\/(role|status|delete)$/) && req.method === "POST") {
          const parts = pathname.split('/');
          const id = Number(parts[4]), act = parts[5];
          if (id === req.user.id) return send(res,400,{error:"لا يمكنك تعديل حسابك الشخصي من هنا"});
          if (act === 'role') {
            const b = await readBody(req);
            if (!['admin','moderator','user'].includes(b.role)) return send(res,400,{error:"دور غير صالح"});
            q("UPDATE users SET role=? WHERE id=?", [b.role, id]);
          }
          if (act === 'status') {
            const b = await readBody(req);
            if (!['active','blocked','pending'].includes(b.status)) return send(res,400,{error:"حالة غير صالحة"});
            q("UPDATE users SET status=? WHERE id=?", [b.status, id]);
            if (b.status === 'blocked') q("DELETE FROM sessions WHERE user_id=?", [id]);
          }
          if (act === 'delete') {
            const target = one("SELECT id,role FROM users WHERE id=?", [id]);
            if (!target) return send(res,404,{error:"المستخدم غير موجود"});
            if (target.role === 'admin') return send(res,400,{error:"لا يمكن حذف حساب مدير"});
            q("DELETE FROM sessions WHERE user_id=?", [id]);
            q("DELETE FROM favorites WHERE user_id=?", [id]);
            q("DELETE FROM users WHERE id=?", [id]);
          }
          logActivity(req.user.id, 'admin_user_'+act, getIP(req), req.headers['user-agent'], {id});
          return send(res,200,{ok:true});
        }
        // صلاحيات: قائمة/إضافة/حذف
        if (pathname === "/api/admin/permissions" && req.method === "GET") {
          const rows = q("SELECT * FROM permissions ORDER BY id");
          return send(res,200,{rows});
        }
        if (pathname === "/api/admin/permissions" && req.method === "POST") {
          const b = await readBody(req);
          if (!b.key || !b.label) return send(res,400,{error:"المفتاح والعنوان مطلوبان"});
          const exists = one("SELECT id FROM permissions WHERE key=?", [b.key]);
          if (exists) return send(res,400,{error:"المفتاح موجود مسبقاً"});
          const r = q("INSERT INTO permissions (key,label,description) VALUES (?,?,?)", [b.key, b.label, b.description||'']);
          logActivity(req.user.id, 'admin_permission_add', getIP(req), req.headers['user-agent'], {key:b.key});
          return send(res,201,{ok:true, id:r.lastInsertRowid});
        }
        if (pathname.match(/^\/api\/admin\/permissions\/(\d+)$/) && req.method === "DELETE") {
          const id = Number(pathname.split('/')[4]);
          const p = one("SELECT key FROM permissions WHERE id=?", [id]);
          if (!p) return send(res,404,{error:"الصلاحية غير موجودة"});
          q("DELETE FROM permissions WHERE id=?", [id]);
          // إزالة من users.permissions JSON
          const users = q("SELECT id,permissions FROM users");
          for (const u of users) {
            try {
              let arr = JSON.parse(u.permissions||'[]');
              if (Array.isArray(arr)) {
                arr = arr.filter(x => x !== p.key);
                q("UPDATE users SET permissions=? WHERE id=?", [JSON.stringify(arr), u.id]);
              }
            } catch(e){}
          }
          logActivity(req.user.id, 'admin_permission_delete', getIP(req), req.headers['user-agent'], {key:p.key});
          return send(res,200,{ok:true});
        }
        // صلاحيات مستخدم: جلب/تعيين/preset
        if (pathname.match(/^\/api\/admin\/users\/(\d+)\/permissions$/) && req.method === "GET") {
          const id = Number(pathname.split('/')[4]);
          const u = one("SELECT id,permissions FROM users WHERE id=?", [id]);
          if (!u) return send(res,404,{error:"المستخدم غير موجود"});
          let arr = [];
          try { arr = JSON.parse(u.permissions||'[]'); if(!Array.isArray(arr)) arr=[]; } catch(e){ arr=[]; }
          return send(res,200,{permissions: arr});
        }
        if (pathname.match(/^\/api\/admin\/users\/(\d+)\/permissions$/) && req.method === "PUT") {
          const id = Number(pathname.split('/')[4]);
          const b = await readBody(req);
          const arr = Array.isArray(b.permissions) ? b.permissions : [];
          // validate keys exist
          const valid = q("SELECT key FROM permissions").map(x=>x.key);
          const filtered = arr.filter(x => valid.includes(x));
          q("UPDATE users SET permissions=? WHERE id=?", [JSON.stringify(filtered), id]);
          logActivity(req.user.id, 'admin_user_permissions', getIP(req), req.headers['user-agent'], {id, count: filtered.length});
          return send(res,200,{ok:true, permissions: filtered});
        }
        if (pathname.match(/^\/api\/admin\/users\/(\d+)\/permissions\/preset$/) && req.method === "POST") {
          const id = Number(pathname.split('/')[4]);
          const b = await readBody(req);
          const role = b.role;
          const presets = {
            admin: q("SELECT key FROM permissions").map(x=>x.key),
            moderator: ['dashboard.view','listings.view_all','listings.approve','listings.feature','users.view','activity.view','listings.manage_own','favorites.manage','messages.manage'],
            user: ['listings.manage_own','favorites.manage','messages.manage','dashboard.view'],
          };
          const arr = presets[role] || [];
          q("UPDATE users SET permissions=? , role=? WHERE id=?", [JSON.stringify(arr), role, id]);
          logActivity(req.user.id, 'admin_user_preset', getIP(req), req.headers['user-agent'], {id, role});
          return send(res,200,{ok:true, permissions: arr});
        }
        // حذف إعلان
        if (pathname.match(/^\/api\/admin\/listings\/(\d+)\/delete$/) && req.method === "POST") {
          const id = pathname.split('/')[4];
          q("DELETE FROM listing_media WHERE listing_id=?", [id]);
          q("DELETE FROM listing_attrs WHERE listing_id=?", [id]);
          q("DELETE FROM favorites WHERE listing_id=?", [id]);
          q("DELETE FROM listings WHERE id=?", [id]);
          logActivity(req.user.id, 'admin_listing_delete', getIP(req), req.headers['user-agent'], {id});
          return send(res,200,{ok:true});
        }
        if (pathname === "/api/admin/categories" && req.method === "GET") {
          const rows = q("SELECT * FROM categories ORDER BY sort_order,id");
          return send(res,200,{rows});
        }
        if (pathname === "/api/admin/categories" && req.method === "POST") {
          const body = await readBody(req);
          const slug = (body.name||'').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'-').toLowerCase();
          q("INSERT INTO categories (name,slug,icon,type,sort_order,active) VALUES (?,?,?,?,?,1)", [body.name, slug, body.icon||'📦', body.type||'other', body.sort_order||0]);
          return send(res,201,{ok:true});
        }
        if (pathname === "/api/admin/transactions" && req.method === "GET") {
          const rows = q(`SELECT t.*, l.title as listing_title, s.name as seller_name, b.name as buyer_name
            FROM transactions t LEFT JOIN listings l ON l.id=t.listing_id LEFT JOIN users s ON s.id=t.seller_id LEFT JOIN users b ON b.id=t.buyer_id
            ORDER BY t.id DESC`);
          return send(res,200,{rows});
        }
        // تسجيل صفقة جديدة (احتساب العمولة تلقائيًا)
        if (pathname === "/api/admin/transactions" && req.method === "POST") {
          const body = await readBody(req);
          if (!body.listing_id || !body.buyer_id || !body.amount) return send(res,400,{error:"يرجى اختيار الإعلان والمشتري وإدخال مبلغ الصفقة"});
          const listing = one("SELECT id,user_id FROM listings WHERE id=?", [body.listing_id]);
          if (!listing) return send(res,404,{error:"الإعلان غير موجود"});
          if (Number(listing.user_id) === Number(body.buyer_id)) return send(res,400,{error:"لا يمكن أن يكون البائع مشتريًا"});
          let pct = Number(body.commission_percent);
          if (!pct || pct < 0 || pct > 100) {
            const s = one("SELECT value FROM settings WHERE key='commission_percent'");
            pct = Number(s ? s.value : 2) || 2;
          }
          const amount = Number(body.amount) || 0;
          const commission = Math.round(amount * pct) / 100;
          const r = q(`INSERT INTO transactions (listing_id,seller_id,buyer_id,amount,commission,commission_percent,status,note)
                       VALUES (?,?,?,?,?,?,?,?)`, [listing.id, listing.user_id, body.buyer_id, amount, commission, pct, 'pending', body.note||'']);
          logActivity(req.user.id, 'admin_transaction_create', getIP(req), req.headers['user-agent'], {id:r.lastInsertRowid});
          return send(res,201,{ok:true, id:r.lastInsertRowid, commission});
        }
        if (pathname.match(/^\/api\/admin\/transactions\/(\d+)\/(complete|cancel)$/) && req.method === "POST") {
          const parts = pathname.split('/');
          const id = parts[4], act = parts[5];
          if (act === 'complete') {
            q("UPDATE transactions SET status='completed', processed_at=? WHERE id=?", [nowISO(), id]);
            const t = one("SELECT listing_id FROM transactions WHERE id=?", [id]);
            if (t) q("UPDATE listings SET status='sold', sold_at=? WHERE id=?", [nowISO(), t.listing_id]);
          }
          if (act === 'cancel') q("UPDATE transactions SET status='cancelled' WHERE id=?", [id]);
          logActivity(req.user.id, 'admin_transaction_'+act, getIP(req), req.headers['user-agent'], {id});
          return send(res,200,{ok:true});
        }
        // قائمة النسخ الاحتياطية
        if (pathname === "/api/admin/backups" && req.method === "GET") {
          const dir = path.join(__dirname, "backups");
          if (!fs.existsSync(dir)) return send(res,200,{rows:[]});
          const rows = fs.readdirSync(dir).filter(f => f.endsWith('.db')).map(f => {
            const st = fs.statSync(path.join(dir, f));
            return { name: f, size: st.size, created_at: st.mtime.toISOString() };
          }).sort((a,b) => b.name.localeCompare(a.name));
          return send(res,200,{rows});
        }
        if (pathname === "/api/admin/backup" && req.method === "POST") {
          const backup = require("./scripts/backup");
          backup();
          return send(res,200,{ok:true, message:"تم إنشاء نسخة احتياطية"});
        }
        if (pathname === "/api/admin/settings" && req.method === "GET") {
          const rows = q("SELECT * FROM settings");
          const s = {}; for (const r of rows) s[r.key]=r.value;
          return send(res,200,s);
        }
        if (pathname === "/api/admin/settings" && req.method === "POST") {
          const body = await readBody(req);
          const st = q.prepare ? null : null;
          for (const k of Object.keys(body)) q("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,?)", [k, body[k], nowISO()]);
          return send(res,200,{ok:true});
        }
        if (pathname === "/api/admin/activity" && req.method === "GET") {
          const rows = q(`SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100`);
          return send(res,200,{rows});
        }
        return send(res,404,{error:"مسار غير موجود"});
      }

      return send(res,404,{error:"مسار API غير موجود"});
    }

    // Static files
    let filePath = pathname === "/" ? "/login.html" : pathname;
    if (filePath === "/site" || filePath === "/site/") filePath = "/index.html";
    if (filePath === "/admin" || filePath === "/admin/") filePath = "/admin.html";
    if (filePath === "/dashboard" || filePath === "/dashboard/") filePath = "/dashboard.html";
    if (filePath.startsWith("/uploads/")) {
      const fp = path.join(PUBLIC, filePath);
      if (!fs.existsSync(fp)) return send(res,404,"Not Found");
      const ext = path.extname(fp).toLowerCase();
      const type = MIME[ext] || "application/octet-stream";
      const data = fs.readFileSync(fp);
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=86400" });
      return res.end(data);
    }
    if (filePath.startsWith("/backups/")) {
      const name = path.basename(filePath);
      const fp = path.join(__dirname, "backups", name);
      if (!name.endsWith('.db') || !fs.existsSync(fp)) return send(res,404,"Not Found");
      const data = fs.readFileSync(fp);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store"
      });
      return res.end(data);
    }
    const fp = path.normalize(path.join(PUBLIC, filePath));
    if (!fp.startsWith(PUBLIC)) return send(res,403,"Forbidden");
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      // try html
      if (fs.existsSync(fp + ".html")) { filePath = filePath + ".html"; }
      else return send(res,404,"صفحة غير موجودة");
    }
    const fp2 = path.normalize(path.join(PUBLIC, filePath === "/" ? "/index.html" : filePath.includes('.') ? filePath : filePath + ".html"));
    if (!fs.existsSync(fp2)) {
      // fallback
      const idx = path.join(PUBLIC, "index.html");
      const data = fs.readFileSync(idx);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(data);
    }
    const ext = path.extname(fp2).toLowerCase();
    const type = MIME[ext] || "text/html; charset=utf-8";
    const data = fs.readFileSync(fp2);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  } catch(e) {
    console.error("ERR:", e);
    if (!res.headersSent) send(res,500,{error:"خطأ في الخادم"});
  }
});

server.listen(PORT, HOST, () => {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  🏠 تسوق - موقع مبوبات السيارات والمنازل والأراضي");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  🌐 الموقع الرئيسي : http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}/`);
  console.log(`  ⚙️  لوحة التحكم    : http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}/admin.html`);
  console.log(`  👤 حساب المدير     : admin / admin123`);
  console.log(`  👤 حساب المشرف     : moderator / admin123`);
  console.log("═══════════════════════════════════════════════════════════\n");
});
