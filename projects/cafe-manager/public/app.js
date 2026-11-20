const $ = id => document.getElementById(id);
let token = localStorage.getItem('cafe_token') || '';
const api = async (p, opt = {}) => {
  const { headers, ...rest } = opt;
  const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) };
  const r = await fetch('/api' + p, { ...rest, headers: h });
  if (r.status === 401) {
    const e = await r.json().catch(() => ({}));
    const msg = e.error || 'انتهت الجلسة، برجاء تسجيل الدخول';
    if (p === '/login' || !token) throw new Error(e.error || 'بيانات غير صحيحة');
    forceLogout(msg); throw new Error(msg);
  }
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || 'خطأ'); }
  return r.json();
};
const getRaw = p => api(p);
const get = p => {
  const filtered = ['/sales','/purchases','/finance','/shifts','/dashboard','/reports'];
  if (currentBranch && currentBranch !== 'all' && filtered.some(f => p.startsWith(f)))
    p += (p.includes('?') ? '&' : '?') + 'branch=' + currentBranch;
  return api(p);
};
const PAGES = [
  { k: 'dashboard', l: '🏠 الرئيسية' },
  { k: 'shifts', l: '⏱️ الشيفتات' },
  { k: 'sales', l: '🛒 المبيعات' },
  { k: 'purchases', l: '📦 المشتريات' },
  { k: 'suppliers', l: '🚚 الموردين' },
  { k: 'finance', l: '💰 المالية' },
  { k: 'accounts', l: '📚 دليل الحسابات' },
  { k: 'journal', l: '📒 القيود اليومية' },
  { k: 'pos', l: '☕ شاشة البيع' },
  { k: 'tables', l: '🪑 الطاولات والطلبيات' },
  { k: 'items', l: '🧾 الأصناف والوصفات' },
  { k: 'reports', l: '📊 التقارير' },
  { k: 'tutorials', l: '🎬 فيديوهات الشرح' },
  { k: 'backup', l: '💾 النسخ الاحتياطي' },
  { k: 'data-tools', l: '🗄️ أدوات البيانات' },
  { k: 'users', l: '👥 المستخدمين' },
];
const bid = () => (currentBranch && currentBranch !== 'all') ? +currentBranch : 1;

let user = null, openShift = null, currentBranch = 'all';
const P = k => {
  if (user.role === 'مدير') return { v:1,a:1,e:1,d:1 };
  let pm = user.perms;
  try { pm = typeof pm === 'string' ? JSON.parse(pm) : pm; } catch { pm = {}; }
  return (pm && pm[k]) || {};
};
const fmt = n => Number(n||0).toLocaleString('ar-EG', { style:'currency', currency:'EGP' });
const today = () => new Date().toISOString().slice(0,10);
const esc = s => String(s ?? '');

/* --- login --- */
$('login-form').onsubmit = async e => {
  e.preventDefault();
  const err = $('login-error');
  err.style.display = 'none'; err.textContent = '';
  try {
    const res = await api('/login', { method:'POST', body: JSON.stringify({ username: $('login-user').value.trim(), pass: $('login-pass').value }) });
    token = res.token; localStorage.setItem('cafe_token', token);
    user = res;
    err.style.display = 'none'; err.textContent = '';
    enterApp();
  } catch (ex) {
    err.textContent = ex && ex.message ? ex.message : 'بيانات غير صحيحة';
    err.style.display = 'block';
  }
};
function forceLogout(msg) {
  token = ''; localStorage.removeItem('cafe_token');
  $('login-screen').style.display = 'flex';
  $('main-layout').style.display = 'none';
  const err = $('login-error');
  err.textContent = msg || '';
  err.style.display = msg ? 'block' : 'none';
}
$('logout-btn').onclick = async () => {
  try { await api('/logout', { method:'POST' }); } catch {}
  forceLogout();
};

/* استرجاع الجلسة تلقائياً لو المستخدم داخل بالفعل */
(async () => {
  if (!token) return;
  try { user = await api('/me'); enterApp(); }
  catch { token = ''; localStorage.removeItem('cafe_token'); }
})();
const CAFE_THEMES = [
  { id:'light',      name:'فاتح (افتراضي)', mode:'light', colors:{ bg:'#f3f7f6', surface:'#ffffff', brand:'#0f766e', accent:'#14b8a6' } },
  { id:'light-warm', name:'فاتح دافئ',      mode:'light', colors:{ bg:'#fbf6ee', surface:'#fffdf8', brand:'#b45309', accent:'#f59e0b' } },
  { id:'dark',       name:'داكن (افتراضي)', mode:'dark',  colors:{ bg:'#071311', surface:'#102220', brand:'#14b8a6', accent:'#2dd4bf' } },
  { id:'dark-blue',  name:'داكن أزرق',      mode:'dark',  colors:{ bg:'#08101d', surface:'#111a2e', brand:'#3b82f6', accent:'#22d3ee' } },
];
const savedTheme = (CAFE_THEMES.find(t=>t.id===localStorage.getItem('cafe_theme'))||CAFE_THEMES[2]).id;
document.documentElement.dataset.theme = savedTheme;
$('theme-btn').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/></svg>';
$('theme-btn').title = 'معرض الثيمات';
$('theme-btn').setAttribute('aria-label','معرض الثيمات');
$('theme-btn').onclick = () => openThemePicker();
function applyCafeTheme(id){
  document.documentElement.dataset.theme = id;
  localStorage.setItem('cafe_theme', id);
  $('theme-btn').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/></svg>';
}
function cafeThemeCard(th, cur){
  const c = th.colors || {}; const active = th.id===cur?' active':'';
  return '<button type="button" class="cafe-theme-card'+active+'" data-cafe-theme="'+th.id+'" title="'+th.name+'">'+
    '<span class="cafe-tc-preview" style="--p-bg:'+c.bg+';--p-surface:'+c.surface+';--p-brand:'+c.brand+';--p-accent:'+c.accent+'">'+
      '<span class="cafe-tc-side"></span><span class="cafe-tc-main"><span class="cafe-tc-head"></span><span class="cafe-tc-line w70"></span><span class="cafe-tc-line w45"></span><span class="cafe-tc-chips"><i style="background:var(--p-brand)"></i><i style="background:var(--p-accent)"></i><i style="background:var(--p-surface);border:1px solid rgba(128,128,128,.25)"></i></span></span>'+
      '<span class="cafe-tc-check">✓</span></span>'+
    '<span class="cafe-tc-name">'+th.name+'<span class="cafe-tc-mode">'+(th.mode==='dark'?'داكن':'فاتح')+'</span></span></button>';
}
function openThemePicker(){
  const cur = document.documentElement.dataset.theme || 'dark';
  const lights = CAFE_THEMES.filter(t=>t.mode==='light');
  const darks = CAFE_THEMES.filter(t=>t.mode==='dark');
  let ov = document.getElementById('cafe-theme-modal');
  if(!ov){ ov = document.createElement('div'); ov.id='cafe-theme-modal'; ov.className='cafe-theme-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="cafe-theme-modal"><div class="cafe-theme-modal-head"><h3>معرض الثيمات</h3><button type="button" class="btn small" data-close>إغلاق</button></div>'+
    '<div class="cafe-theme-gallery"><section><div class="cafe-tg-head"><span class="cafe-tg-dot light"></span><h4>الثيمات الفاتحة</h4><span class="cafe-tg-count">'+lights.length+'</span></div><div class="cafe-theme-grid">'+lights.map(t=>cafeThemeCard(t,cur)).join('')+'</div></section>'+
    '<section><div class="cafe-tg-head"><span class="cafe-tg-dot dark"></span><h4>الثيمات الداكنة</h4><span class="cafe-tg-count">'+darks.length+'</span></div><div class="cafe-theme-grid">'+darks.map(t=>cafeThemeCard(t,cur)).join('')+'</div></section></div></div>';
  ov.style.display='grid';
  const close=()=>{ ov.style.display='none'; };
  ov.querySelector('[data-close]').onclick=close;
  ov.onclick=(e)=>{ if(e.target===ov) close(); };
  ov.querySelectorAll('[data-cafe-theme]').forEach(b=>b.onclick=()=>{ applyCafeTheme(b.dataset.cafeTheme); ov.querySelectorAll('[data-cafe-theme]').forEach(x=>x.classList.toggle('active', x===b)); });
}
$('menu-btn').onclick = () => { $('sidebar').classList.toggle('open'); $('scrim').classList.toggle('show'); };
$('scrim').onclick = () => { $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); };

async function enterApp() {
  $('login-screen').style.display = 'none';
  $('main-layout').style.display = 'flex';
  $('user-chip').textContent = `${user.name} — ${user.role}`;
  const branches = await getRaw('/branches');
  const bs = $('branch-select');
  currentBranch = user.role === 'مدير' ? 'all' : String(user.branch_id || 1);
  bs.innerHTML = (user.role === 'مدير' ? '<option value="all">جميع الفروع</option>' : '') + branches.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  bs.value = currentBranch;
  bs.onchange = () => { currentBranch = bs.value; loadAll(); };
  $('nav').innerHTML = PAGES.filter(p => ['backup','data-tools'].includes(p.k) ? user.role === 'مدير' : (p.k === 'tutorials' || user.role === 'مدير' || P(p.k).v || p.k === 'dashboard'))
    .map((p, i) => `<button class="nav-btn ${i===0?'active':''}" data-page="${p.k}">${p.l}</button>`).join('');
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.onclick = () => showPage(b));
  $('perms-matrix').innerHTML = PAGES.filter(p=>p.k!=='dashboard' && p.k!=='backup' && p.k!=='data-tools').map(p =>
    `<div class="pm"><b>${p.l}</b><div class="pm-checks">
      <label><input type="checkbox" data-pm="${p.k}:v"><span>عرض</span></label>
      <label><input type="checkbox" data-pm="${p.k}:a"><span>إضافة</span></label>
      <label><input type="checkbox" data-pm="${p.k}:e"><span>تعديل</span></label>
      <label><input type="checkbox" data-pm="${p.k}:d"><span>حذف</span></label></div></div>`).join('');
  loadAll(); checkShift();
}
function showPage(b) {
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('page-' + b.dataset.page).classList.add('active');
  $('page-title').textContent = b.textContent;
  $('sidebar').classList.remove('open'); $('scrim').classList.remove('show');
  if (b.dataset.page === 'dashboard') loadDashboard();
  if (b.dataset.page === 'reports') { loadReports(); loadPL(); loadInventory(); fillShiftSelect(); loadPayments(); }
  if (b.dataset.page === 'pos') renderPos();
  if (b.dataset.page === 'tables') renderTables();
  if (b.dataset.page === 'backup') loadBackupInfo();
  if (b.dataset.page === 'data-tools') renderDataTools();
  if (b.dataset.page === 'tutorials') renderTutorials();
}

/* --- shifts --- */
async function checkShift() {
  openShift = await get(`/shifts/open/${user.id}`);
  $('shift-chip').textContent = openShift ? `شيفت مفتوح #${openShift.id}` : 'بدون شيفت';
  loadShifts();
}
async function currentShiftId() { await checkShift(); return openShift ? openShift.id : null; }
$('shift-open-btn').onclick = async () => {
  if (openShift) return alert('لديك شيفت مفتوح بالفعل');
  await api('/shifts/open', { method:'POST', body: JSON.stringify({user_id: user.id, username: user.name, opening_cash: +$('shift-cash').value, branch_id: bid()}) });
  $('shift-cash').value = ''; checkShift();
};
$('shift-close-btn').onclick = async () => {
  if (!openShift) return alert('لا يوجد شيفت مفتوح');
  await api('/shifts/close', { method:'POST', body: JSON.stringify({ id: openShift.id, closing_cash: +$('shift-cash').value }) });
  $('shift-cash').value = ''; checkShift();
};
async function loadShifts() {
  const rows = await get('/shifts');
  $('shifts-table').innerHTML = rows.map(s => `<tr><td>${esc(s.username)}</td><td>${esc(s.opened_at)}</td><td>${esc(s.closed_at||'—')}</td><td>${fmt(s.opening_cash)}</td><td>${s.closing_cash!=null?fmt(s.closing_cash):'—'}</td><td>${s.status==='open'?'🟢 مفتوح':'⚫ مغلق'}</td></tr>`).join('');
}

/* --- generic table renderers --- */
async function jget(p){ return get(p); }
async function renderContacts() {
  const rows = await get('/suppliers');
  $('suppliers-table').innerHTML = rows.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.address)}</td><td>${P('suppliers').e?`<button class="btn small" onclick="editSupplier(${s.id})">✏️</button>`:''} ${P('suppliers').d?`<button class="btn small danger" onclick="delRow('suppliers',${s.id},renderContacts)">🗑️</button>`:''}</td></tr>`).join('');
  $('purchase-supplier').innerHTML = rows.map(s => `<option>${esc(s.name)}</option>`).join('');
}
window.editSupplier = async id => { const s = (await get('/suppliers')).find(x=>x.id==id); $('supplier-id').value=s.id; $('supplier-name').value=s.name; $('supplier-phone').value=s.phone; $('supplier-address').value=s.address; };
$('supplier-form').onsubmit = async e => { e.preventDefault(); const id=$('supplier-id').value;
  const body = JSON.stringify({name:$('supplier-name').value,phone:$('supplier-phone').value,address:$('supplier-address').value});
  if (id) await api('/suppliers/'+id,{method:'PUT',body}); else await api('/suppliers',{method:'POST',body});
  e.target.reset(); $('supplier-id').value=''; renderContacts(); };

async function renderPurchases() {
  const rows = await get('/purchases');
  $('purchases-table').innerHTML = rows.map(p => `<tr><td>${esc(p.supplier)}</td><td>${esc(p.item)}</td><td>${p.qty}</td><td>${fmt(p.total)}</td><td>${p.date}</td><td>${P('purchases').d?`<button class="btn small danger" onclick="delRow('purchases',${p.id},renderPurchases)">🗑️</button>`:''}</td></tr>`).join('');
}
$('purchase-form').onsubmit = async e => { e.preventDefault();
  const qty=+$('purchase-qty').value, price=+$('purchase-price').value;
  await api('/purchases',{method:'POST',body:JSON.stringify({supplier:$('purchase-supplier').value,item:$('purchase-item').value,qty,unitPrice:price,total:qty*price,date:$('purchase-date').value||today(),branch_id:bid()})});
  e.target.reset(); renderPurchases(); };

async function renderSales() {
  const rows = await get('/sales');
  $('sales-table').innerHTML = rows.map(s => `<tr><td>${esc(s.customer)}</td><td>${esc(s.item)}</td><td>${s.qty}</td><td>${fmt(s.total)}</td><td>${esc(s.payment)}</td><td>${s.date}</td><td><button class="btn small" onclick="printInvoice(${s.id})">🖨️</button> ${P('sales').d?`<button class="btn small danger" onclick="delRow('sales',${s.id},renderSales)">🗑️</button>`:''}</td></tr>`).join('');
}
$('sale-form').onsubmit = async e => { e.preventDefault();
  const qty=+$('sale-qty').value, price=+$('sale-price').value;
  await api('/sales',{method:'POST',body:JSON.stringify({customer:$('sale-customer').value||'عميل عام',item:$('sale-item').value,qty,price,total:qty*price,payment:$('sale-payment').value,user_id:user.id,shift_id:await currentShiftId(),date:today(),branch_id:bid()})});
  e.target.reset(); renderSales(); };

async function renderFinance() {
  const rows = await get('/finance');
  const rev = rows.filter(f=>f.type==='revenue').reduce((a,f)=>a+(+f.amount||0),0);
  const exp = rows.filter(f=>f.type==='expense').reduce((a,f)=>a+(+f.amount||0),0);
  const sales = await get('/sales'), purch = await get('/purchases');
  const totalRev = rev + sales.reduce((a,s)=>a+(+s.total||0),0);
  const totalExp = exp + purch.reduce((a,p)=>a+(+p.total||0),0);
  $('fin-revenue').textContent = fmt(totalRev); $('fin-expense').textContent = fmt(totalExp); $('fin-net').textContent = fmt(totalRev-totalExp);
  $('finance-table').innerHTML = rows.map(f => `<tr><td>${f.type==='expense'?'مصروف':'إيراد'}</td><td>${esc(f.desc)}</td><td>${fmt(f.amount)}</td><td>${f.date}</td><td>${P('finance').d?`<button class="btn small danger" onclick="delRow('finance',${f.id},renderFinance)">🗑️</button>`:''}</td></tr>`).join('');
}
$('expense-form').onsubmit = async e => { e.preventDefault();
  await api('/finance',{method:'POST',body:JSON.stringify({type:$('exp-type').value,desc:$('exp-desc').value,amount:+$('exp-amount').value,date:today(),branch_id:bid()})});
  e.target.reset(); renderFinance(); };

async function renderAccounts() {
  const rows = await get('/accounts');
  $('accounts-table').innerHTML = rows.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${P('accounts').d?`<button class="btn small danger" onclick="delRow('accounts',${a.id},renderAccounts)">🗑️</button>`:''}</td></tr>`).join('');
  document.querySelectorAll('.j-acc').forEach(s => s.innerHTML = rows.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join(''));
}
$('account-form').onsubmit = async e => { e.preventDefault();
  await api('/accounts',{method:'POST',body:JSON.stringify({name:$('acc-name').value,type:$('acc-type').value})});
  e.target.reset(); renderAccounts(); };

async function renderJournal() {
  const rows = await get('/journal');
  $('journal-table').innerHTML = rows.map(j => `<tr><td>${j.date}</td><td>${esc(j.ref)}</td><td>${esc(j.desc)}</td><td>${esc(j.account)}</td><td>${j.debit||''}</td><td>${j.credit||''}</td></tr>`).join('');
}
$('journal-form').onsubmit = async e => { e.preventDefault();
  try {
    await api('/journal/entry',{method:'POST',body:JSON.stringify({desc:$('j-desc').value,date:today(),lines:[{account:$('j-acc1').value,debit:+$('j-d1').value||0},{account:$('j-acc2').value,credit:+$('j-c2').value||0}]})});
    e.target.reset(); renderJournal();
  } catch(err){ alert(err.message); } };

async function renderUsers() {
  const rows = await get('/users');
  $('users-table').innerHTML = rows.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${P('users').e?`<button class="btn small" onclick="editUser(${u.id})">✏️</button>`:''} ${P('users').d?`<button class="btn small danger" onclick="delRow('users',${u.id},renderUsers)">🗑️</button>`:''}</td></tr>`).join('');
}
window.editUser = async id => { const u = (await get('/users')).find(x=>x.id==id);
  $('user-id').value=u.id; $('user-name').value=u.name; $('user-username').value=u.username; $('user-role').value=u.role;
  try { const pm = JSON.parse(u.perms); document.querySelectorAll('#perms-matrix input').forEach(i => { const [p,a]=i.dataset.pm.split(':'); i.checked = pm[p]?.[a] ? true : false; }); } catch {}
};
$('user-form').onsubmit = async e => { e.preventDefault();
  const perms = {}; document.querySelectorAll('#perms-matrix input:checked').forEach(i => { const [p,a]=i.dataset.pm.split(':'); perms[p]=perms[p]||{}; perms[p][a]=1; });
  const id=$('user-id').value, old=(id?(await get('/users')).find(u=>u.id==id):null);
  const body=JSON.stringify({name:$('user-name').value,username:$('user-username').value,pass:$('user-pass').value||old?.pass||'1234',role:$('user-role').value,perms:JSON.stringify(perms)});
  if (id) await api('/users/'+id,{method:'PUT',body}); else await api('/users',{method:'POST',body});
  e.target.reset(); $('user-id').value=''; renderUsers(); };

window.delRow = async (key,id,fn) => { if(confirm('حذف؟')){ await api('/'+key+'/'+id,{method:'DELETE'}); fn(); } };

/* --- dashboard --- */
async function loadDashboard() {
  const d = await get('/dashboard');
  $('kpi-sales').textContent = fmt(d.salesTotal); $('kpi-invoices').textContent = d.invoices;
  $('kpi-purchases').textContent = fmt(d.purchTotal); $('kpi-profit').textContent = fmt(d.net);
  drawChart(d.chart);
}
function drawChart(data) {
  const c = $('sales-chart'), ctx = c.getContext('2d');
  c.width = c.offsetWidth; const W = c.width, H = c.height; ctx.clearRect(0,0,W,H);
  if (!data.length) return;
  const max = Math.max(...data.map(d=>d.total), 1), pad = 40, iw = W - pad*2, ih = H - pad*2;
  // axes + grid
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();
  for (let i=0;i<=4;i++){ const y = pad + (ih/4)*i; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.strokeStyle='#1e293b30'; ctx.stroke(); }
  const pts = data.map((d,i) => ({ x: pad + (iw/(data.length-1||1))*i, y: H-pad - (d.total/max)*ih }));
  // area under line
  const grad = ctx.createLinearGradient(0,pad,0,H-pad);
  grad.addColorStop(0,'#f59e0b44'); grad.addColorStop(1,'#f59e0b00');
  ctx.beginPath(); ctx.moveTo(pts[0].x, H-pad); pts.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.lineTo(pts[pts.length-1].x, H-pad); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  // line
  ctx.beginPath(); pts.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=3; ctx.lineJoin='round'; ctx.stroke();
  // markers + labels
  pts.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fillStyle='#f59e0b'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#0f172a'; ctx.stroke();
    ctx.fillStyle='#94a3b8'; ctx.font='11px Tahoma'; ctx.textAlign='center';
    ctx.fillText(data[i].date.slice(5), p.x, H-12);
    ctx.fillText(Math.round(data[i].total), p.x, p.y-10);
  });
}

/* --- reports / export / print --- */
async function loadReports() {
  const r = await get('/reports');
  $('income-statement').innerHTML = `<table>
    <tr><td>المبيعات</td><td>${fmt(r.salesRev)}</td></tr>
    <tr><td>تكلفة البضاعة المباعة</td><td>(${fmt(r.cogs)})</td></tr>
    <tr><td><b>مجمل الربح</b></td><td><b>${fmt(r.salesRev-r.cogs)}</b></td></tr>
    <tr><td>إيرادات أخرى</td><td>${fmt(r.extraRev)}</td></tr>
    <tr><td>مصروفات</td><td>(${fmt(r.extraExp)})</td></tr>
    <tr><td><b>صافي الدخل</b></td><td><b>${fmt(r.net)}</b></td></tr></table>`;
  $('balance-sheet').innerHTML = `<table>
    <tr><td>النقدية</td><td>${fmt(r.cash)}</td></tr>
    <tr><td>المخزون السلعي</td><td>${fmt(r.endInv)}</td></tr>
    <tr><td><b>إجمالي الأصول</b></td><td><b>${fmt(r.cash+r.endInv)}</b></td></tr>
    <tr><td>الخصوم</td><td>${fmt(0)}</td></tr>
    <tr><td><b>حقوق الملكية</b></td><td><b>${fmt(r.equity)}</b></td></tr></table>`;
  $('equity-statement').innerHTML = `<table>
    <tr><td>رصيد أول المدة</td><td>${fmt(r.CAPITAL)}</td></tr>
    <tr><td>صافي الدخل</td><td>${fmt(r.net)}</td></tr>
    <tr><td><b>رصيد آخر المدة</b></td><td><b>${fmt(r.equity)}</b></td></tr></table>`;
}
window.exportCSV = async key => {
  const map = { sales:'sales', purchases:'purchases', finance:'finance', journal:'journal' };
  const rows = await get('/' + map[key]);
  if (!rows.length) return alert('لا توجد بيانات');
  const cols = Object.keys(rows[0]);
  const csv = '﻿' + cols.join(',') + '\n' + rows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  a.download = key + '.csv'; a.click();
};
window.printInvoice = async id => {
  const s = (await get('/sales')).find(x => x.id == id);
  const w = window.open('','_blank');
  w.document.write(`<html dir="rtl"><body style="font-family:Tahoma;padding:30px"><h1 style="text-align:center">☕ كافيه برو</h1><hr>
    <p>رقم: ${s.id} | تاريخ: ${s.date} | عميل: ${s.customer} | دفع: ${s.payment}</p>
    <table border="1" cellpadding="10" width="100%" style="border-collapse:collapse"><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>
    <tr><td>${s.item}</td><td>${s.qty}</td><td>${fmt(s.total)}</td></tr></table><h2>الإجمالي: ${fmt(s.total)}</h2><script>window.print()<\/script></body></html>`);
  w.document.close();
};
window.printReport = (id, title) => {
  const w = window.open('','_blank');
  w.document.write(`<html dir="rtl"><body style="font-family:Tahoma;padding:30px"><h1 style="text-align:center">${title}</h1><hr>${$(id).innerHTML}<script>window.print()<\/script></body></html>`);
  w.document.close();
};

/* --- tables & orders --- */
let activeOrder = null;
async function renderTables() {
  const rows = await get('/tables');
  $('tables-grid').innerHTML = rows.map(t => {
    const free = t.status === 'free';
    return `<div class="table-card ${free?'free-card':'busy'}" tabindex="0" role="button" onclick="tableCardClick(${t.id},'${esc(t.name)}',${free?'true':'false'},${t.oid||null})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tableCardClick(${t.id},'${esc(t.name)}',${free?'true':'false'},${t.oid||null});}">
      <h3>${esc(t.name)}</h3>
      <span class="st ${free?'free':'busy'}">${free?'🟢 فارغة' : '🔴 محجوزة'}</span>
      ${!free && t.ototal ? `<p style="color:#f59e0b">${fmt(t.ototal)}</p>` : ''}
      <small style="color:var(--muted)">${free?'اضغط لفتح طلب' : 'اضغط لإدارة الطلب'}</small>
    </div>`;
  }).join('');
}
window.tableCardClick = (id, name, free, oid) => {
  if (free) return openTable(id, name);
  if (oid) return viewOrder(oid);
};
$('table-form').onsubmit = async e => { e.preventDefault();
  await api('/tables',{method:'POST',body:JSON.stringify({name:$('table-name').value})});
  e.target.reset(); renderTables(); };
window.openTable = async (id, name) => {
  try {
    const o = await api('/orders', { method:'POST', body: JSON.stringify({ table_id: id }) });
    activeOrder = o.id; await viewOrder(o.id); renderTables();
  } catch(e){ alert(e.message); }
};
window.viewOrder = async id => {
  activeOrder = id;
  const o = await get('/orders/' + id);
  $('order-panel').style.display = 'block';
  $('order-title').textContent = `أوردر ${o.table_name} — ${o.status==='open'?'جارٍ':'مُحاسَب'}`;
  const items = (await get('/items')).filter(i => i.type === 'menu');
  $('ord-item').innerHTML = items.map(i => `<option value="${esc(i.name)}">${esc(i.name)}</option>`).join('');
  $('order-items').innerHTML = o.items.map(it => `<tr><td>${esc(it.item)}</td><td>${it.qty}</td><td>${fmt(it.price)}</td><td>${fmt(it.total)}</td><td>${o.status==='open' ? `<button class="btn small danger" onclick="removeOrderItem(${o.id},${it.id})">حذف</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5">لا طلبات بعد</td></tr>';
  $('order-total').textContent = 'إجمالي الطاولة: ' + fmt(o.total);
  $('split-items').innerHTML = o.items.map(it => `<label style="display:block"><input type="checkbox" class="split-cb" value="${it.id}"> ${esc(it.item)} × ${it.qty} — ${fmt(it.total)}</label>`).join('') || '—';
  const tables = (await get('/tables')).filter(t => t.status === 'free');
  $('transfer-table').innerHTML = tables.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('order-panel').scrollIntoView({ behavior: 'smooth' });
};
window.addOrderItem = async () => {
  const qty = +$('ord-qty').value || 1;
  if (qty < 1) return alert('أدخل كمية صحيحة');
  await api('/orders/' + activeOrder + '/items', { method:'POST', body: JSON.stringify({ item: $('ord-item').value, qty }) });
  $('ord-qty').value = 1; viewOrder(activeOrder); renderTables();
};
window.removeOrderItem = async (oid, iid) => {
  if (!confirm('حذف هذا الصنف من الطلب؟')) return;
  try {
    await api('/orders/' + oid + '/items/' + iid, { method:'DELETE' });
    await viewOrder(oid); renderTables();
  } catch(e) { alert(e.message); }
};
window.cancelOrder = async () => {
  if (!activeOrder) return;
  if (!confirm('هل فعلاً تريد إلغاء الطلب وإفراغ الطاولة؟ لا يمكن التراجع.')) return;
  try {
    await api('/orders/' + activeOrder + '/cancel', { method:'POST' });
    $('order-panel').style.display = 'none';
    activeOrder = null;
    renderTables();
  } catch(e) { alert(e.message); }
};
window.closeOrder = async () => {
  try {
    const o = await get('/orders/' + activeOrder);
    const items = o.items; const payment = $('ord-payment').value;
    await api('/orders/' + activeOrder + '/close', { method:'POST', body: JSON.stringify({ payment, user_id: user.id, shift_id: await currentShiftId(), branch_id: bid() }) });
    alert('✅ تمت المحاسبة وتحرير الطاولة');
    printCombined(items, 'طاولة ' + o.table_name, payment);
    activeOrder = null; $('order-panel').style.display = 'none';
    renderTables(); renderSales(); loadDashboard();
  } catch(e){ alert(e.message); }
};

window.transferOrder = async () => {
  const tid = $('transfer-table').value; if (!tid) return alert('لا توجد طاولة فارغة');
  try {
    await api('/orders/' + activeOrder + '/transfer', { method:'POST', body: JSON.stringify({ table_id: +tid }) });
    alert('🔀 تم نقل الأوردر'); viewOrder(activeOrder); renderTables();
  } catch(e){ alert(e.message); }
};
window.splitPay = async () => {
  const ids = [...document.querySelectorAll('.split-cb:checked')].map(c => +c.value);
  if (!ids.length) return alert('علّم أصنافاً أولاً');
  try {
    const r = await api('/orders/' + activeOrder + '/pay-items', { method:'POST', body: JSON.stringify({ item_ids: ids, payment: $('ord-payment').value, user_id: user.id, shift_id: await currentShiftId(), branch_id: bid() }) });
    alert('✅ تم دفع الأصناف المختارة');
    if (r.remaining === 0) { activeOrder = null; $('order-panel').style.display = 'none'; } else viewOrder(activeOrder);
    renderTables(); renderSales(); loadDashboard();
  } catch(e){ alert(e.message); }
};

/* --- POS touch screen --- */
let cart = [], itemsCache = [];
async function renderPos() {
  const items = (await get('/items')).filter(i => i.type === 'menu' && i.sell_price > 0);
  $('pos-grid').innerHTML = items.map(i => `<button class="pos-btn" onclick="posAdd('${esc(i.name)}',${i.sell_price})">☕ ${esc(i.name)}<small>${fmt(i.sell_price)}</small></button>`).join('');
}
window.barcodeLookup = () => {
  const b = $('purchase-barcode').value.trim();
  const it = itemsCache.find(x => x.barcode === b);
  if (it) { $('purchase-item').value = it.name; $('purchase-price').value = it.cost_price || ''; }
};
window.posAdd = (name, price) => {
  const l = cart.find(x => x.name === name);
  l ? l.qty++ : cart.push({ name, price, qty: 1 });
  drawCart();
};
function drawCart() {
  $('pos-lines').innerHTML = cart.map((l,i) => `<div class="pos-line"><span>${l.name} × ${l.qty}</span><span>${fmt(l.qty*l.price)} <button style="background:none;border:none;color:#ef4444;cursor:pointer" onclick="cart.splice(${i},1);drawCart()">✕</button></span></div>`).join('') || '<p style="color:#94a3b8">السلة فارغة</p>';
  $('pos-total').textContent = 'الإجمالي: ' + fmt(cart.reduce((a,l)=>a+l.qty*l.price,0));
}
window.posClear = () => { cart = []; drawCart(); };
window.posConfirm = async () => {
  if (!cart.length) return alert('السلة فارغة');
  for (const l of cart) {
    await api('/sales', { method:'POST', body: JSON.stringify({ customer:'تاتش', item:l.name, qty:l.qty, price:l.price, total:l.qty*l.price, payment:$('pos-payment').value, user_id:user.id, shift_id:await currentShiftId(), date:today(), branch_id:bid() }) });
  }
  const cartCopy = cart.map(l => ({...l}));
  const payment = $('pos-payment').value;
  alert('✅ تم تسجيل البيع'); posClear(); renderSales(); loadDashboard();
  printCombined(cartCopy.map(l => ({ item: l.name, qty: l.qty, total: l.qty * l.price })), 'شاشة البيع', payment);
};
window.printCurrentCart = () => {
  if (!cart.length) return alert('السلة فارغة');
  printCombined(cart.map(l => ({ item: l.name, qty: l.qty, total: l.qty * l.price })), 'طلب (غير محاسب)', $('pos-payment').value);
};
function printCombined(items, title, payment) {
  const total = items.reduce((a,i) => a + (+i.total||0), 0);
  const w = window.open('','_blank');
  w.document.write(`<html dir="rtl"><body style="font-family:Tahoma;padding:30px"><h1 style="text-align:center">☕ كافيه برو</h1><hr>
    <p> ${title} | دفع: ${payment} | تاريخ: ${today()}</p>
    <table border="1" cellpadding="10" width="100%" style="border-collapse:collapse"><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>
    ${items.map(i => `<tr><td>${esc(i.item)}</td><td>${i.qty}</td><td>${fmt(i.total)}</td></tr>`).join('')}
    </table><h2>الإجمالي: ${fmt(total)}</h2><script>window.print()<\/script></body></html>`);
  w.document.close();
}

/* --- items & recipes --- */
async function renderItems() {
  const rows = await get('/items');
  itemsCache = rows;
  fillSaleItems();
  $('items-table').innerHTML = rows.map(i => `<tr><td>${esc(i.name)}</td><td>${i.type==='menu'?'صنف مباع':'مكون'}</td><td>${fmt(i.cost_price)}</td><td>${fmt(i.sell_price)}</td><td>${esc(i.barcode||'-')}</td><td>${P('items').d?`<button class="btn small danger" onclick="delRow('items',${i.id},renderItems)">🗑️</button>`:''}</td></tr>`).join('');
  $('purchase-item').innerHTML = rows.filter(i=>i.type!=='menu').map(i=>`<option>${esc(i.name)}</option>`).join('');
  $('rc-menu').innerHTML = rows.filter(i=>i.type==='menu').map(i=>`<option>${esc(i.name)}</option>`).join('');
  $('rc-ing').innerHTML = rows.filter(i=>i.type==='ingredient').map(i=>`<option>${esc(i.name)}</option>`).join('');
  const recs = await get('/recipes');
  $('recipes-table').innerHTML = recs.map(r => `<tr><td>${esc(r.menu_item)}</td><td>${esc(r.ingredient)}</td><td>${r.qty}</td><td><button class="btn small danger" onclick="delRow('recipes',${r.id},renderItems)">🗑️</button></td></tr>`).join('');
}
function fillSaleItems() {
  const sel = $('sale-item');
  if (!sel) return;
  const items = (itemsCache||[]).filter(i => i.type === 'menu');
  const current = sel.value;
  sel.innerHTML = '<option value="">اختر الصنف</option>' + items.map(i => `<option value="${esc(i.name)}" data-price="${i.sell_price||0}">${esc(i.name)}</option>`).join('');
  if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
}
const _saleItem = document.getElementById('sale-item');
if (_saleItem) _saleItem.addEventListener('change', e => {
  const opt = e.target.selectedOptions[0];
  const p = opt && opt.dataset.price;
  if (p !== undefined && p !== '') $('sale-price').value = p;
});
$('item-form').onsubmit = async e => { e.preventDefault();
  await api('/items',{method:'POST',body:JSON.stringify({name:$('it-name').value,type:$('it-type').value,cost_price:+$('it-cost').value||0,sell_price:+$('it-sell').value||0,barcode:$('it-barcode').value})});
  e.target.reset(); renderItems(); renderPos(); };
$('recipe-form').onsubmit = async e => { e.preventDefault();
  await api('/recipes',{method:'POST',body:JSON.stringify({menu_item:$('rc-menu').value,ingredient:$('rc-ing').value,qty:+$('rc-qty').value})});
  e.target.reset(); renderItems(); };

/* --- detailed reports --- */
async function loadPayments() {
  const r = await get('/report/payments');
  $('pay-report').innerHTML = `<div class="cards" style="margin:0">
    <div class="card"><span>💵 جرد النقدية</span><b>${fmt(r.map['نقدي'])}</b></div>
    <div class="card"><span>💳 جرد البطاقة</span><b>${fmt(r.map['بطاقة'])}</b></div>
    <div class="card"><span>📱 جرد التطبيق</span><b>${fmt(r.map['تطبيق'])}</b></div>
  </div>
  <table style="margin-top:12px"><thead><tr><th>الوسيلة</th><th>عدد العمليات</th><th>الرصيد</th></tr></thead>
  <tbody>${r.rows.map(x=>`<tr><td>${esc(x.payment)}</td><td>${x.count}</td><td>${fmt(x.total)}</td></tr>`).join('')}</tbody></table>`;
}
async function loadPL() {
  const r = await get('/report/pl');
  $('pl-report').innerHTML = `<table>
    <tr><td>إجمالي الإيرادات</td><td>${fmt(r.revenue)}</td></tr>
    <tr><td>تكلفة المبيعات (حسب الوصفات)</td><td>(${fmt(r.cogs)})</td></tr>
    <tr><td><b>مجمل الربح</b></td><td><b>${fmt(r.gross)}</b></td></tr>
    <tr><td>إجمالي المصروفات</td><td>(${fmt(r.expenses)})</td></tr>
    <tr><td><b>صافي الربح/الخسارة</b></td><td><b>${fmt(r.net)}</b></td></tr></table>
    <h3 style="margin:10px 0">الإيرادات حسب الصنف</h3>
    <table>${r.byItem.map(x=>`<tr><td>${esc(x.item)}</td><td>${fmt(x.total)}</td></tr>`).join('')}</table>`;
}
async function loadInventory() {
  const rows = await get('/report/inventory');
  $('inv-report').innerHTML = `<table><thead><tr><th>الصنف</th><th>النوع</th><th>وارد</th><th>منصرف</th><th>الرصيد</th><th>متوسط التكلفة</th><th>القيمة</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.type==='menu'?'مباع':'مكون'}</td><td>${r.inQty}</td><td>${r.outQty}</td><td>${r.remaining}</td><td>${fmt(r.avg)}</td><td>${fmt(r.value)}</td></tr>`).join('')}</tbody></table>`;
}
window.loadShiftReport = async () => {
  const id = $('shift-select').value; if (!id) return;
  const r = await get('/report/shift/' + id);
  $('shift-report').innerHTML = `<p>الكاشير: <b>${esc(r.shift.username)}</b> | الحالة: ${r.shift.status==='open'?'مفتوح':'مغلق'}</p>
    <p>نقدية البداية: ${fmt(r.shift.opening_cash)} | نقدية النهاية: ${r.shift.closing_cash!=null?fmt(r.shift.closing_cash):'—'} | النقدي المتوقع: <b>${fmt(r.cashExpected)}</b></p>
    <p>المبيعات: ${r.sales.length} — الإجمالي: <b>${fmt(r.total)}</b></p>
    <table>${Object.entries(r.byPayment).map(([k,v])=>`<tr><td>${k}</td><td>${fmt(v)}</td></tr>`).join('')}</table>`;
};
async function fillShiftSelect() {
  const rows = await get('/shifts');
  $('shift-select').innerHTML = rows.map(s=>`<option value="${s.id}">شيفت #${s.id} — ${esc(s.username)} (${s.opened_at})</option>`).join('');
  loadShiftReport();
}

const isManager = () => user && user.role === 'مدير';
async function loadAll() {
  const jobs = [];
  const add = (page, fn, always) => { if (always || isManager() || P(page).v) jobs.push(fn()); };
  add('suppliers', renderContacts); add('purchases', renderPurchases); add('sales', renderSales);
  add('finance', renderFinance); add('accounts', renderAccounts); add('journal', renderJournal);
  add('users', renderUsers); add('items', renderItems); add('pos', renderPos); add('tables', renderTables);
  add('shifts', loadShifts); add('reports', loadPL); add('reports', loadInventory);
  add('reports', fillShiftSelect); add('reports', loadPayments);
  jobs.push(loadDashboard());
  await Promise.allSettled(jobs);
}

/* --- النسخ الاحتياطي --- */
async function loadBackupInfo() {
  try {
    const h = await api('/health');
    $('db-info').innerHTML = `<p>نوع قاعدة البيانات الحالية: <b>${h.db === 'postgresql' ? 'PostgreSQL (دائمة على الاستضافة)' : 'SQLite (ملف محلي داخل المشروع)'}</b></p>
      <p>حالة السيرفر: <b>${h.ok ? '✅ يعمل' : '❌ لا يعمل'}</b></p>
      <p style="color:var(--muted);font-size:13px">لو هتشتغل على استضافة، استخدم PostgreSQL عبر متغير DATABASE_URL، والنسخ الاحتياطي هيشتغل معاها بنفس الطريقة.</p>`;
    const last = localStorage.getItem('cafe_last_backup');
    $('backup-info').textContent = last ? 'آخر تنزيل: ' + new Date(+last).toLocaleString('ar-EG') : 'لم تُنزّل نسخة بعد';
  } catch (e) { $('db-info').textContent = e.message; }
}
window.downloadBackup = async () => {
  try {
    const b = await api('/backup');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
    a.download = 'cafe-backup-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    localStorage.setItem('cafe_last_backup', Date.now());
    loadBackupInfo();
  } catch (e) { alert(e.message); }
};
window.restoreBackup = async input => {
  const f = input.files && input.files[0];
  if (!f) return;
  if (!confirm('⚠️ الاسترجاع هيمسح البيانات الحالية ويستبدلها ببيانات الملف. متأكد؟')) { input.value = ''; return; }
  try {
    const data = JSON.parse(await f.text());
    const r = await api('/restore', { method: 'POST', body: JSON.stringify(data) });
    alert('✅ تم استرجاع ' + r.restored + ' سجل بنجاح');
    loadAll();
  } catch (e) { alert('❌ ' + e.message); }
  input.value = '';
};

/* ================== أدوات البيانات (تفريغ + سلة محذوفات + سجل) ================== */
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.updateDtSel = () => {
  const boxes = [...document.querySelectorAll('#dt-tables input[type=checkbox]:not(:disabled)')];
  const n = boxes.filter(b => b.checked).length;
  const label = $('dt-sel'); if (label) label.textContent = n ? 'تم تحديد ' + n + ' جدول' : 'لم يتم تحديد أي جدول';
  const btn = $('dt-truncate'); if (btn) btn.disabled = !n;
};

window.truncateTables = async () => {
  const selected = [...document.querySelectorAll('#dt-tables input[type=checkbox]:checked:not(:disabled)')].map(b => b.dataset.table);
  if (!selected.length) return;
  if (!confirm('سيتم حذف كل صفوف: ' + selected.join(', ') + '. لا يمكن التراجع. هل أنت متأكد؟')) return;
  try {
    const r = await api('/data-tools/truncate', { method: 'POST', body: JSON.stringify({ tables: selected }) });
    alert('تم تفريغ ' + (r.cleared || []).length + ' جدول');
    renderDataTools();
  } catch (e) { alert(e.message); }
};

window.dtRestore = async (entity, id) => {
  try { await api('/trash/' + entity + '/' + id + '/restore', { method: 'POST' }); renderDataTools(); }
  catch (e) { alert(e.message); }
};
window.dtPurge = async (entity, id) => {
  if (!confirm('لا يمكن التراجع عن الحذف النهائي. متابعة؟')) return;
  try { await api('/trash/' + entity + '/' + id, { method: 'DELETE' }); renderDataTools(); }
  catch (e) { alert(e.message); }
};

window.renderDataTools = async () => {
  const tablesBox = $('dt-tables'); if (!tablesBox) return;
  tablesBox.innerHTML = '<p style="color:var(--muted)">جارٍ التحميل…</p>';
  try {
    const [tools, trash, auditRows] = await Promise.all([api('/data-tools'), api('/trash'), api('/audit?limit=100')]);

    tablesBox.innerHTML = '<table class="tbl" style="width:100%"><thead><tr><th style="width:44px"></th><th>الجدول</th><th>الاسم</th><th>الصفوف</th><th>الحالة</th></tr></thead><tbody>' +
      (tools.tables || []).map(t => '<tr><td><input type="checkbox" data-table="' + h(t.name) + '" ' + (t.protected ? 'disabled' : '') + ' onchange="updateDtSel()"></td><td style="direction:ltr;text-align:left">' + h(t.name) + '</td><td>' + h(t.label) + '</td><td>' + Number(t.rows || 0).toLocaleString('ar-EG') + '</td><td>' + (t.protected ? '🔒 محمي' : '✅ قابل للتفريغ') + '</td></tr>').join('') +
      '</tbody></table>';
    updateDtSel();

    const groups = (trash.groups || []).filter(g => g.rows.length);
    $('dt-trash').innerHTML = groups.length ? groups.map(g =>
      '<h3 style="margin:12px 0 6px">' + h(g.label) + ' <span style="color:var(--muted);font-size:13px">(' + g.rows.length + ')</span></h3>' +
      '<table class="tbl" style="width:100%"><thead><tr><th>#</th><th>الاسم</th><th style="width:190px"></th></tr></thead><tbody>' +
      g.rows.map(r => '<tr><td>' + r.id + '</td><td>' + h(r.name || '—') + '</td><td><button class="btn" style="padding:4px 10px" onclick="dtRestore(\'' + h(g.entity) + '\',' + r.id + ')">♻️ استعادة</button> <button class="btn danger" style="padding:4px 10px" onclick="dtPurge(\'' + h(g.entity) + '\',' + r.id + ')">🗑️ نهائي</button></td></tr>').join('') +
      '</tbody></table>'
    ).join('') : '<p style="color:var(--muted)">السلة فارغة — عند حذف مورد أو صنف أو حساب أو طاولة سيظهر هنا لإمكانية استعادته.</p>';

    $('dt-audit').innerHTML = (auditRows && auditRows.length) ?
      '<table class="tbl" style="width:100%"><thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>الجدول</th><th>التفاصيل</th></tr></thead><tbody>' +
      auditRows.map(r => '<tr><td style="font-size:12px">' + h((r.created_at || '').slice(0, 19).replace('T', ' ')) + '</td><td>' + h(r.username || '—') + '</td><td>' + h(r.action || '') + '</td><td style="direction:ltr;text-align:left">' + h(r.entity || '') + '</td><td style="font-size:12px">' + h(r.details || '') + '</td></tr>').join('') +
      '</tbody></table>' : '<p style="color:var(--muted)">لا توجد أحداث بعد.</p>';
  } catch (e) {
    tablesBox.innerHTML = '<p style="color:var(--danger,#dc2626)">' + h(e.message) + '</p>';
  }
};

/* ================== فيديوهات الشرح ================== */
const TV_KEY = 'cafe_tutorial_videos_v1';
const tvLoad = () => { try { return JSON.parse(localStorage.getItem(TV_KEY) || '[]'); } catch { return []; } };
const tvSave = (list) => localStorage.setItem(TV_KEY, JSON.stringify(list));
const tvUid = () => 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const tvHuman = (b) => { b = Number(b) || 0; if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b > 1024) return (b / 1024).toFixed(0) + ' KB'; return b + ' B'; };
const tvRead = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
const tvEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tvState = { q: '', showDeleted: false };

function tvOverlay(html) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:9999;padding:16px';
  ov.innerHTML = '<div style="background:var(--panel,#fff);color:var(--text,#111);border-radius:16px;max-width:680px;width:100%;max-height:90vh;overflow:auto;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' + html + '</div>';
  document.body.appendChild(ov);
  return ov;
}

function tvOpenPlayer(v) {
  if (!v) return;
  const ov = tvOverlay('<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0">' + tvEsc(v.title) + ' <span class="badge">#' + tvEsc(String(v.num || '')) + '</span></h3><button class="btn" data-close>إغلاق</button></div>' +
    '<div style="color:var(--muted);font-size:13px;margin-bottom:8px">الصفحة: ' + tvEsc(v.page || '-') + '</div>' +
    '<video controls autoplay src="' + v.data + '" style="width:100%;max-height:62vh;border-radius:12px;background:#000"></video>' +
    (v.desc ? '<p style="color:var(--muted);margin-top:10px">' + tvEsc(v.desc) + '</p>' : ''));
  ov.querySelector('[data-close]').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

function tvOpenForm(v) {
  const edit = !!v;
  const ov = tvOverlay('<h3 style="margin:0 0 12px">' + (edit ? 'تعديل الفيديو' : 'إضافة فيديو شرح') + '</h3>' +
    '<div style="display:grid;gap:10px">' +
    '<label style="display:grid;gap:4px"><span>اسم الفيديو (الصفحة المشروحة)</span><input class="input" id="tvf-title" value="' + tvEsc(v?.title || '') + '"></label>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
    '<label style="display:grid;gap:4px"><span>اسم الصفحة</span><input class="input" id="tvf-page" value="' + tvEsc(v?.page || '') + '"></label>' +
    '<label style="display:grid;gap:4px"><span>رقم الفيديو</span><input class="input" type="number" id="tvf-num" value="' + tvEsc(String(v?.num ?? '')) + '"></label></div>' +
    '<label style="display:grid;gap:4px"><span>وصف مختصر</span><textarea class="input" id="tvf-desc" rows="3">' + tvEsc(v?.desc || '') + '</textarea></label>' +
    '<label style="display:grid;gap:4px"><span>ملف الفيديو</span><input class="input" type="file" id="tvf-file" accept="video/*"><small style="color:var(--muted)">' + (edit ? 'اتركه فارغًا للإبقاء على الملف الحالي.' : 'اختر ملف فيديو للرفع.') + '</small></label>' +
    '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" data-cancel>إلغاء</button><button class="btn primary" data-save>حفظ</button></div>');
  ov.querySelector('[data-cancel]').onclick = () => ov.remove();
  ov.querySelector('[data-save]').onclick = async () => {
    const title = ov.querySelector('#tvf-title').value.trim();
    const page = ov.querySelector('#tvf-page').value.trim();
    const num = Number(ov.querySelector('#tvf-num').value);
    const desc = ov.querySelector('#tvf-desc').value.trim();
    const file = ov.querySelector('#tvf-file').files && ov.querySelector('#tvf-file').files[0];
    if (!title || !page || !Number.isFinite(num) || num <= 0) { alert('أدخل الاسم والصفحة ورقمًا صحيحًا'); return; }
    if (!edit && !file) { alert('اختر ملف فيديو'); return; }
    const btn = ov.querySelector('[data-save]'); btn.disabled = true;
    try {
      let media = edit ? { data: v.data, fileName: v.fileName, mime: v.mime, size: v.size } : {};
      if (file) media = { data: await tvRead(file), fileName: file.name, mime: file.type || 'video/mp4', size: file.size };
      const now = new Date().toISOString(); const list = tvLoad();
      if (edit) { const i = list.findIndex(x => x.id === v.id); if (i >= 0) list[i] = { ...list[i], title, page, num, desc, ...media, updatedAt: now }; }
      else list.push({ id: tvUid(), title, page, num, desc, ...media, createdAt: now, updatedAt: now });
      tvSave(list); ov.remove(); renderTutorials();
    } catch (e) { alert('تعذر حفظ الفيديو (قد يكون الملف كبيرًا)'); btn.disabled = false; }
  };
}

window.tvToggleTrash = () => { tvState.showDeleted = !tvState.showDeleted; renderTutorials(); };

window.renderTutorials = () => {
  const grid = $('tv-grid'); if (!grid) return;
  const q = $('tv-q');
  if (q) { q.value = tvState.q; q.oninput = (e) => { tvState.q = e.target.value; window.renderTutorials(); }; }
  const term = tvState.q.trim().toLowerCase();
  const rows = tvLoad()
    .filter(v => tvState.showDeleted ? !!v.deletedAt : !v.deletedAt)
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0))
    .filter(v => !term || [v.title, v.page, v.desc, v.num].some(x => String(x || '').toLowerCase().includes(term)));
  const cnt = $('tv-count'); if (cnt) cnt.textContent = rows.length + (tvState.showDeleted ? ' محذوف' : ' فيديو');
  const tb = $('tv-trash'); if (tb) tb.classList.toggle('primary', tvState.showDeleted);
  if (!rows.length) {
    grid.innerHTML = '<div class="panel" style="grid-column:1/-1;text-align:center;padding:30px"><div style="font-size:40px">🎬</div><h3>' + (tvState.showDeleted ? 'لا توجد فيديوهات محذوفة' : 'لا توجد فيديوهات شرح بعد') + '</h3><p style="color:var(--muted)">' + (tvState.showDeleted ? 'كل ما تحذفه من فيديوهات سيظهر هنا لإمكانية استعادته.' : 'أضف فيديو يشرح إحدى صفحات البرنامج.') + '</p>' + (tvState.showDeleted ? '' : '<button class="btn primary" onclick="tvOpenForm()">+ إضافة أول فيديو</button>') + '</div>';
    return;
  }
  grid.innerHTML = rows.map(v => '<div class="panel" style="padding:0;overflow:hidden">' +
    '<button type="button" data-play="' + tvEsc(v.id) + '" style="display:grid;place-items:center;position:relative;width:100%;height:150px;border:0;cursor:pointer;background:linear-gradient(135deg,var(--panel,#eef2f7),var(--bg,#e2e8f0));color:var(--text,#111)"><span style="display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--primary,#2563eb);color:#fff;font-size:22px">▶</span><span class="badge" style="position:absolute;top:10px;inset-inline-end:10px">#' + tvEsc(String(v.num || '')) + '</span></button>' +
    '<div style="padding:12px"><h3 style="margin:0 0 2px;font-size:14px">' + tvEsc(v.title) + '</h3><div style="color:var(--muted);font-size:13px">الصفحة: ' + tvEsc(v.page || '-') + '</div>' +
    (v.desc ? '<p style="color:var(--muted);font-size:12px;margin:6px 0 0">' + tvEsc(v.desc) + '</p>' : '') +
    '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:8px"><span>' + tvHuman(v.size) + '</span><span>' + tvEsc((v.updatedAt || v.createdAt || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' + (tvState.showDeleted
      ? '<button class="btn primary" style="padding:4px 10px" data-restore="' + tvEsc(v.id) + '">♻️ استعادة</button><button class="btn danger" style="padding:4px 10px" data-purge="' + tvEsc(v.id) + '">🗑️ حذف نهائي</button>'
      : '<button class="btn" style="padding:4px 10px" data-edit="' + tvEsc(v.id) + '">✏️ تعديل</button><button class="btn danger" style="padding:4px 10px" data-del="' + tvEsc(v.id) + '">🗑️ حذف</button>') + '</div></div></div>').join('');
  grid.querySelectorAll('[data-play]').forEach(b => b.onclick = () => tvOpenPlayer(tvLoad().find(x => x.id === b.dataset.play)));
  grid.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => tvOpenForm(tvLoad().find(x => x.id === b.dataset.edit)));
  grid.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const v = tvLoad().find(x => x.id === b.dataset.del); if (!v) return;
    if (!confirm('نقل "' + v.title + '" إلى سلة المحذوفات؟')) return;
    tvSave(tvLoad().map(x => x.id === v.id ? { ...x, deletedAt: new Date().toISOString() } : x)); renderTutorials();
  });
  grid.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => {
    tvSave(tvLoad().map(x => x.id === b.dataset.restore ? { ...x, deletedAt: null, restoredAt: new Date().toISOString() } : x)); renderTutorials();
  });
  grid.querySelectorAll('[data-purge]').forEach(b => b.onclick = () => {
    if (!confirm('لا يمكن التراجع عن الحذف النهائي. متابعة؟')) return;
    tvSave(tvLoad().filter(x => x.id !== b.dataset.purge)); renderTutorials();
  });
};
window.tvOpenForm = tvOpenForm;
