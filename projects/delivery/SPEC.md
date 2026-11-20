# طلباتك — Talabatak Delivery Platform — SPEC (contract for all modules)

## 1. Stack (ZERO external dependencies — no npm install, offline-safe)
- Backend: Node.js 24 (`node:sqlite` DatabaseSync), `node:http`, built-in modules ONLY.
- DB file: `delivery/data/app.db` (auto-created + seeded on first run).
- Run: `node server.js` from `delivery/` → http://localhost:8080
- Frontend: plain HTML/CSS/JS, ES modules not required (classic scripts allowed), Arabic RTL.

## 2. Files layout
```
delivery/
  server.js            # http server, static + API dispatch, auth
  lib/db.js            # schema + seed + helper functions (stock, journal, balances)
  lib/api.js           # resource CRUD registry + store endpoints + reports endpoints
  lib/barcode.js       # Code128 SVG generator
  SPEC.md
  public/
    index.html         # CUSTOMER storefront (SPA)  + js/store.js + css/store.css
    admin.html         # ADMIN/STAFF panel (SPA)    + js/admin/*.js + css/admin.css
    css/base.css       # DESIGN SYSTEM tokens + shared components (rtl, dark/light)
    assets/            # generated svg images (optional; seed uses inline data URIs)
```

## 3. Design system (css/base.css) — MUST exist first
Theme via `html[data-theme="dark"]` and `html[data-theme="light"`].
Tokens (CSS variables on `:root`):
```
--bg:#F5F7FB; --surface:#FFFFFF; --surface-2:#EEF2F8; --border:#E3E8F0;
--text:#161C2A; --muted:#6B7280;
--primary:#FF6B35; --primary-hover:#E8560F; --primary-soft:rgba(255,107,53,.12);
--secondary:#0EA5A4; --success:#16A34A; --danger:#DC2626; --warning:#F59E0B; --info:#2563EB;
--radius:14px; --radius-sm:9px; --shadow:0 6px 24px rgba(16,24,40,.08);
--font: "Segoe UI", Tahoma, "Helvetica Neue", Arial, sans-serif;
```
Dark theme overrides: `--bg:#0A0E17; --surface:#121826; --surface-2:#1A2133; --border:#26304A; --text:#E8ECF7; --muted:#93A0BC; --primary:#FF8A5B; ...`
Rules:
- `<html lang="ar" dir="rtl">` everywhere.
- Theme toggler stores `localStorage.tb_theme` and applies before paint (inline script in `<head>`).
- Responsive: NO horizontal page overflow ever (`body{overflow-x:hidden}`), tables/cards switch to cards < 760px, sidebar → off-canvas drawer < 1024px. No clipped text: use `min-width:0`, `overflow-wrap:anywhere` on content areas.
- Utility classes in base.css: `.btn .btn-primary .btn-ghost .btn-danger .btn-sm`, `.card`, `.grid`, `.badge`, `.field (label+input)`, `.table`, `.modal`, `.toast`, `.tabs`, `.empty`, `.kpi`.

## 4. Auth & roles
### Staff/admin
- `POST /api/auth/login {email,password}` → `{token,user}`
- `GET /api/auth/me` (header `Authorization: Bearer <token>`) → `{user}`
- `POST /api/auth/logout`
- Seed users: `admin / admin123` (role=admin, all perms), `manager@... / 123456`, `seller@... / 123456`.
- `users.permissions` = JSON like `{"orders":["view","create","update","delete"],"products":["view"],...}`
- Permission keys (used by UI + API): `dashboard, branches, users, pilots, suppliers, customers, categories, products, inventory, purchases, payment_methods, orders, promotions, rewards, ads, accounting, cash, vouchers, stock_counts, reports, settings(company)`
  - `settings` key = company data (first tab key is `company` → maps to perm `settings`).
- Role `admin` bypasses permission checks. Role `staff` uses matrix. `pilot` role sees only assigned orders (API + no admin UI).
- **Customers must NEVER reach admin APIs/UI** (customer tokens only authorized on `/api/store/*`; `/admin` route does not render for customers; admin APIs reject customer tokens with 403).
### Customer
- Token in `Authorization: Bearer` from:
  - `POST /api/store/register {name,phone,address}` → `{token,customer}` (first order — data saved once)
  - `POST /api/store/login {phone}` → `{token,customer}` (demo: existing phone, no password)
  - `GET /api/store/me`
  - token also cached in `localStorage.tb_customer_token`.
  - `POST /api/auth/logout` works for both kinds.

## 5. Generic CRUD (admin) — the core of “CRUD in every detail”
```
GET    /api/:res?search=&page=1&limit=20&sort=id&dir=desc&<col>=<val>  → {rows,total,page,pages}
POST   /api/:res                      → row      (perm create)
GET    /api/:res/:id                  → row      (perm view)
PUT    /api/:res/:id                  → row      (perm update)
DELETE /api/:res/:id                  → {ok}     (perm delete)
```
- Registry `RESOURCES` in `lib/api.js`: `{ table, fields:[{name,type,label,...}], search:[cols], orderBy, beforeCreate, beforeUpdate, afterDelete, perm }`.
- Field types: `text,number,textarea,select,switch,date,datetime,image,password,code,readonly,multiselect,json`.
- `select` options are resolved server-side when `options: {resource:'branches', label:'name', value:'id'}` given.
- `image` field: client sends data-URL string, stored directly (demo scale).
- All list responses are JSON. Errors: `{error:"arabic message"}` with proper status.
- Extra query helpers: `?fk=branch_id&fv=3` exact filters.

## 6. Store (customer) endpoints
```
GET  /api/store/home        → {company,categories:[{...count}],ads,banners}
GET  /api/store/categories  → rows (active) with products_count
GET  /api/store/products?category_id= → rows (active): id,name,image,price,unit,barcode,stock,category_id
GET  /api/store/payment-methods
GET  /api/store/promotions  → active valid promos (public: code, type, value, end_at, min_order)
POST /api/store/quote       {items:[{product_id,qty}],promo_code} → {lines[],subtotal,delivery_fee,discount,tax,total,promo}
POST /api/store/orders      {items,promo_code,payment_method_id,note,address,phone} + customer token → order
GET  /api/store/orders      → my orders (+ items)
GET  /api/store/orders/:id  → order + items (+ status history)
POST /api/store/orders/:id/rate {rating,comment}
```
- Delivery fee from `company.delivery_fee`; tax `company.tax_percent` if `tax_enabled`.
- Stock decremented + inventory_move type `sale` on order creation; status flow: `new → confirmed → preparing → delivering → delivered | cancelled`. Cancelling restores stock.
- Points: `floor(total/10)` added on delivered; `/api/store/rewards` returns customer gifts/discounts.

## 7. Database tables (SQLite)
`company(id=1,name,logo,phone,email,address,currency,tax_percent,tax_enabled,delivery_fee,about,working_hours,facebook,instagram)`
`branches(id,name,address,phone,manager,active,created_at)`
`users(id,name,email,phone,password,role,permissions,active,branch_id,created_at)`
`pilots(id,name,phone,vehicle,plate,branch_id,active,rating,created_at)`
`suppliers(id,name,phone,address,balance,notes,active)`
`customers(id,name,phone,address,points,total_spent,orders_count,rating,notes,created_at)`
`categories(id,name,description,image,active,sort_order)`
`products(id,category_id,name,description,image,price,cost,unit,barcode,stock,min_stock,active,created_at)`
`inventory_moves(id,product_id,branch_id,type,qty,balance_after,ref,note,date,user_id)` type: purchase|sale|adjust|in|out|count
`purchases(id,supplier_id,date,status,total,paid,payment_method_id,warehouse,note,created_at)` + `purchase_items(id,purchase_id,product_id,qty,cost,total)`
`payment_methods(id,name,kind,active,sort_order)` kind: cash|card|online|wallet
`orders(id,code,customer_id,branch_id,pilot_id,payment_method_id,promo_id,promo_code,status,subtotal,discount,delivery_fee,tax,total,paid,note,address,phone,rating,rating_comment,created_at,updated_at,delivered_at,cancel_reason)`
`order_items(id,order_id,product_id,name,price,qty,total)`
`promotions(id,name,kind,value,code,start_at,end_at,min_order,active,category_id,used_count)` kind: percent|fixed
`rewards(id,customer_id,kind,value,note,active,created_at)` kind: gift|discount
`ads(id,title,image,link,position,start_at,end_at,active,clicks)` position: home|strip|popup
`accounts(id,code,name,type,parent_id,kind,is_system,balance)` type: asset|liability|equity|revenue|expense; kind: normal|cash|bank|customer|supplier|inventory
`journals(id,date,ref_type,ref_id,memo,created_by,approved,created_at)` + `journal_lines(id,journal_id,account_id,debit,credit)`
`cash_accounts(id,kind,name,holder,branch_id,account_no,balance,active)` kind: treasury|bank
`vouchers(id,kind,source,cash_account_id,party_type,party_id,amount,date,memo,ref,journal_id,created_by,approved,created_at)` kind: receipt|payment (قبض/صرف); source: cash|bank
`stock_counts(id,date,branch_id,status,memo,created_by,created_at)` + `stock_count_items(id,count_id,product_id,unit_cost,system_qty,actual_qty,diff,memo)`
`sessions(token,kind,user_id,customer_id,created_at)` kind: staff|customer
`orders.status` history derived from timestamps + `order_events(id,order_id,status,at,note)`.

## 8. Seed data (Arabic, realistic — MUST be browsable/demo-ready)
- Company: «طلباتك» + SVG logo (data URI), delivery_fee=25, tax 14% disabled.
- 3 branches (القاهرة – المعادي / الجيزة – الهرم / الإسكندرية – سموحة).
- 6 categories with images: منتجات سوبر ماركت، خضراوات وفواكه، مخبوزات، مشروبات، لحوم ودواجن، منتجات ألبان.
- ≥ 36 products (image+price+cost+stock+barcode Code128 of `P0001..`), each category ≥4.
- 4 pilots, 5 suppliers, 10 customers, 12 payment-ready orders spread over last 14 days with mixed statuses (incl. delivered with ratings + cancelled), ≥1 order assigned per pilot.
- 2 promotions (Eid 15% code `EID15`, fixed 20 `SAVE20`), 3 rewards, 3 ads.
- Chart of accounts (دليل حسابات مصري متعارف عليه): 1000 الأصول (1010 الخزينة، 1020 البنك، 1100 العملاء، 1200 المخزون)، 2000 الخصوم (2010 الموردون، 2100 ضريبة)، 3000 حقوق الملكية، 4000 الإيرادات، 5000 المصروفات — with opening balances.
- 2 treasuries (خزينة رئيسية، خزينة فرع) + 2 banks (CIB، NBE) with balances; ≥8 vouchers; ≥12 journal entries; 1 approved stock count; purchase orders; inventory moves consistent.
- Stock totals of products must match inventory_moves derived balances (build moves from seed quantities).

## 9. ERP / Accounting rules
- `postJournal(db,{date,ref_type,ref_id,memo,lines:[{account_id,debit,credit}],created_by})` inserts journal + updates `accounts.balance` (debit-normal: +debit-credit for asset/expense; reverse for others).
- Auto-post: purchase approved → Dr inventory / Cr supplier(or cash); sale delivered → Dr cash-or-customer / Cr revenue + Dr COGS / Cr inventory (cost); voucher → Dr/Cr cash_account + party account; stock count diff → inventory ± gain/loss (قيد التسوية).
- Balances kept on `suppliers.balance`, `customers.total_spent`, `cash_accounts.balance`, `products.stock`.
- Approval actions: vouchers approve, stock count approve, journal approve.

## 10. Reports (all under admin `#/reports` + `#/accounting`)
- مالي: قائمة الدخل، الميزانية العمومية، ميزان المراجعة، قائمة التدفقات النقدية (بسيط)، دفتر الأستاذ / حساب عميل ومورد، قائمة القيود.
- مبيعات: يومي/شهري، أفضل المنتجات، حسب الفرع، حسب الطيار، حسب القسم، هامش الربح.
- تشغيلي: مخزون (رصيد، قيمة، حركات، كرت صنف)، عملاء، طيارين، مشتريات، تحصيلات الخزينة/البنوك.
- Endpoints pattern: `GET /api/reports/:name?from=&to=` → `{title,columns,rows,summary}` (generic table renderer) except dashboards/financial statements which return structured JSON:
  - `GET /api/reports/dashboard` → {kpis:{orders_today,revenue_today,revenue_month,low_stock,new_orders,pending_orders,customers,avg_rating},chart:{days:[{date,orders,revenue}],statuses:[{status,count}]},recent_orders,low_stock,top_products}
  - `GET /api/reports/income-statement?from&to`, `/api/reports/balance-sheet`, `/api/reports/trial-balance`.
  - `GET /api/reports/erp-overview?from&to` → لوحة ERP التشغيلية: `{period,kpis,daily,pilots,branches,payments}` (إيراد، توصيل، تكلفة مبيعات، ربح إجمالي، مصروفات، صافي دخل، سيولة، مستحقات، مخزون، عمولات طيارين).

## 10.1 Backup & restore
- `GET /api/system/backup` → `{dir,dirs,backups,db_size}`.
- `POST /api/system/backup/create {note,dir_id}` → نسخة متّسقة داخل مجلد البيانات.
- `GET /api/system/backup/:name/download?d=<dir_id>` → تنزيل النسخة.
- `POST /api/system/backup/restore {name,d}` → استعادة نسخة موجودة (نسخة أمان تلقائية قبل الاستعادة).
- `POST /api/system/backup/restore-upload {name,data}` → استعادة ملف `.db` (SQLite) أو `.json` (MySQL) مرفوع كـ base64، مع التحقق من الصيغة.
- `DELETE /api/system/backup/:name?d=<dir_id>` → حذف نسخة.
- `GET/POST/DELETE /api/system/backup/location...` → إدارة مجلدات الحفظ.
- واجهة `#/backup` في `js/admin/backup.js` تعرض الإنشاء والتنزيل والاستعادة والاستعادة من ملف.

## 11. Barcode
- `GET /api/products/:id/barcode.svg` → Code128 SVG (lib/barcode.js). Admin: «طباعة ملصقات الباركود» modal with qty + print CSS (`window.print()`).
- Product field `barcode` editable; default `P0001…`.

## 12. Admin SPA sections (`admin.html` + `js/admin/`)
- Shell: topbar (search, theme toggle, user menu) + sidebar (grouped nav) + content `<main id="view">`.
- Router: hash-based `#/`, `#/orders`, `#/erp`, `#/reports`, `#/accounting`, `#/stock-counts`, `#/backup`, `#/module/<res>`, `#/settings`, `#/users`, `#/profile`.
- `js/admin/core.js`: api() helper, auth guard, toast, modal, table renderer, form renderer, image picker, theme, permissions check.
- `js/admin/modules.js`: `window.MODULES = {...}` declarative config for every resource: `{title,perm,icon,columns,fields,search,filters,actions}`.
- `js/admin/views.js`: dashboard, orders board (kanban by status), reports, accounting, stock counts, settings(company logo), users permission matrix, barcode labels, purchases(with items editor), inventory (moves + adjust modal).
- `js/admin/erp.js`: accounting + cash + vouchers + reports + ERP command center views (must register into `window.VIEWS`).
- `js/admin/backup.js`: مركز النسخ الاحتياطي والاستعادة (`#/backup`).
- Views registry: `window.VIEWS[name]=function(el,params){}` called by router; `window.registerView(name,fn)`.

## 13. Store SPA (`index.html` + `js/store.js` + `css/store.css`)
Screens: splash/home (company header, ads strip, «الأقسام» grid like cafe tables → big cards with image+name), category screen (same design: product cards image+name+price+qty stepper), floating invoice/cart drawer (lines editable, subtotal, delivery, discount, total, promo code), checkout (name/phone/address once via register or stored token — never asked again), payment method select, orders list + tracking timeline + rate, account page (points, rewards), login/register modal.
- Bottom nav (mobile): الرئيسية / الأقسام / طلباتي / حسابي.
- Must be fully RTL-responsive, no overflow, dark mode follows site toggle.

## 14. Hard rules
1. Arabic UI text only (labels, toasts, errors), `dir="rtl"`.
2. Customers cannot open `/admin` nor call staff APIs (403).
3. Every entity in the requirements must have full CRUD via generic registry (no read-only tables).
4. Responsive: 320px → 2560px with zero clipped content; test at least 360/768/1440.
5. Dark + light mode, persisted, no flash.
6. Seed data present at first boot; safe to reseed with `node scripts/reseed.js` or delete `data/app.db`.
7. No external network requests (fonts/CDN forbidden) — all icons inline SVG or emoji.
