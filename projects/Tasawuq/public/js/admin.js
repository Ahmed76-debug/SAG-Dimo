/* ============================================================
   تسوق - Admin Panel JS
   ============================================================ */
const API = '';
let token = localStorage.getItem('ts_token');
let user = JSON.parse(localStorage.getItem('ts_user')||'null');

// Auth check
if(!token || !user || (user.role !== 'admin' && user.role !== 'moderator')) {
  alert('يجب تسجيل الدخول كمدير أو مشرف');
  location.href='/login.html';
}
document.getElementById('adminName').textContent = user.name;
document.getElementById('adminRole').textContent = user.role === 'admin' ? 'مدير عام' : 'مشرف';

// Theme
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle?.querySelector('i');
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('ts_theme',t);
  if(themeIcon) themeIcon.className = t==='dark'?'bi bi-sun':'bi bi-moon-stars';
}
setTheme(localStorage.getItem('ts_theme')||'light');
themeToggle?.addEventListener('click',()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

// Logout
document.getElementById('adminLogout').addEventListener('click', async e=>{
  e.preventDefault();
  try{ await fetch('/api/auth/logout',{method:'POST',headers:{'Authorization':'Bearer '+token}}); }catch(e){}
  localStorage.removeItem('ts_token'); localStorage.removeItem('ts_user');
  location.href='/';
});

// Mobile sidebar
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);
function closeSidebar(){ sidebar?.classList.remove('open'); overlay.classList.remove('show'); }
sidebarToggle?.addEventListener('click', ()=>{ sidebar?.classList.toggle('open'); overlay.classList.toggle('show'); });
overlay.addEventListener('click', closeSidebar);
window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeSidebar(); });

// Nav
document.querySelectorAll('.nav-item[data-view]').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    closeSidebar();
    loadView(a.dataset.view);
  });
});

// Toast
function toast(msg,type='info'){
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className='toast';
  t.innerHTML = `<i class="bi bi-${type==='success'?'check-circle':type==='error'?'x-circle':'info-circle'}" style="color:var(--${type==='success'?'success':type==='error'?'danger':'info'})"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// Load stats for badge
fetch('/api/admin/stats',{headers:{'Authorization':'Bearer '+token}}).then(r=>r.json()).then(d=>{
  const b = document.getElementById('badgePending');
  if(b) b.textContent = d.pending||0;
}).catch(()=>{});

const content = document.getElementById('content');

async function loadView(view){
  if(view==='dashboard') return renderDashboard();
  if(view==='listings') return renderListings('all');
  if(view==='pending') return renderListings('pending');
  if(view==='users') return renderUsers();
  if(view==='permissions') return renderPermissions();
  if(view==='categories') return renderCategories();
  if(view==='transactions') return renderTransactions();
  if(view==='settings') return renderSettings();
  if(view==='backup') return renderBackup();
  if(view==='activity') return renderActivity();
}

async function renderDashboard(){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">لوحة التحكم</h1><p class="page-subtitle">نظرة عامة على الموقع</p></div></div><div id="stats" class="stats-grid"></div><div class="card"><div class="card-header"><div class="card-title"><i class="bi bi-clock-history"></i> أحدث الإعلانات بانتظار الموافقة</div></div><div class="table-wrap"><table class="table"><thead><tr><th>صورة</th><th>العنوان</th><th>البائع</th><th>القسم</th><th>السعر</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody id="pendingTbl"></tbody></table></div></div>`;
  try {
    const res = await fetch('/api/admin/stats',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-people"></i></div><div class="stat-info"><div class="stat-label">المستخدمين</div><div class="stat-value">${d.users}</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="bi bi-megaphone"></i></div><div class="stat-info"><div class="stat-label">الإعلانات</div><div class="stat-value">${d.listings}</div></div></div>
      <div class="stat-card"><div class="stat-icon orange"><i class="bi bi-clock"></i></div><div class="stat-info"><div class="stat-label">بانتظار الموافقة</div><div class="stat-value">${d.pending}</div></div></div>
      <div class="stat-card"><div class="stat-icon red"><i class="bi bi-cash-stack"></i></div><div class="stat-info"><div class="stat-label">إجمالي العمولة</div><div class="stat-value">${Number(d.commission||0).toLocaleString('ar-EG')} ج.م</div></div></div>
    `;
    const res2 = await fetch('/api/admin/listings?status=pending',{headers:{'Authorization':'Bearer '+token}});
    const d2 = await res2.json();
    const tb = document.getElementById('pendingTbl');
    if(!d2.rows.length){ tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-2)">لا توجد إعلانات بانتظار الموافقة</td></tr>'; return; }
    tb.innerHTML = d2.rows.slice(0,10).map(l=>`
      <tr>
        <td><img src="assets/placeholder.svg" class="table-img"></td>
        <td><strong>${escapeHtml(l.title)}</strong></td>
        <td>${escapeHtml(l.seller_name)}</td>
        <td>${l.category_name||'-'}</td>
        <td>${Number(l.price).toLocaleString('ar-EG')} ج.م</td>
        <td>${new Date(l.created_at).toLocaleDateString('ar-EG')}</td>
        <td style="display:flex;gap:.375rem">
          <button class="btn btn-success btn-sm" onclick="actListing(${l.id},'approve')"><i class="bi bi-check"></i> قبول</button>
          <button class="btn btn-danger btn-sm" onclick="actListing(${l.id},'reject')"><i class="bi bi-x"></i> رفض</button>
          <a href="/listing.html?id=${l.id}" target="_blank" class="btn btn-ghost btn-sm"><i class="bi bi-eye"></i> معاينة</a>
        </td>
      </tr>
    `).join('');
  } catch(e){ toast('خطأ في تحميل البيانات','error'); }
}

async function renderListings(type){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">${type==='pending'?'إعلانات بانتظار الموافقة':'جميع الإعلانات'}</h1></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>العنوان</th><th>البائع</th><th>القسم</th><th>النوع</th><th>السعر</th><th>الحالة</th><th>المشاهدات</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody id="listTbl"></tbody></table></div></div>`;
  try {
    const url = type==='pending'?'/api/admin/listings?status=pending':'/api/admin/listings';
    const res = await fetch(url,{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    const tb = document.getElementById('listTbl');
    if(!d.rows.length){ tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--text-2)">لا توجد إعلانات</td></tr>'; return; }
    tb.innerHTML = d.rows.map((l,i)=>`
      <tr>
        <td>${l.id}</td>
        <td><strong>${escapeHtml(l.title)}</strong></td>
        <td>${escapeHtml(l.seller_name)}<br><small style="color:var(--text-2)">${l.seller_phone||''}</small></td>
        <td>${l.category_name||'-'}</td>
        <td>${l.type==='cars'?'سيارات':l.type==='real_estate'?'عقارات':'أراضي'}</td>
        <td>${Number(l.price).toLocaleString('ar-EG')} ج.م</td>
        <td><span class="status status-${l.status}">${l.status==='pending'?'بانتظار':l.status==='approved'?'مقبول':l.status==='rejected'?'مرفوض':l.status==='sold'?'مباع':'منتهي'}</span></td>
        <td>${l.views||0}</td>
        <td>${new Date(l.created_at).toLocaleDateString('ar-EG')}</td>
        <td style="display:flex;gap:.25rem;flex-wrap:wrap">
          ${l.status==='pending'?`<button class="btn btn-success btn-sm" onclick="actListing(${l.id},'approve')"><i class="bi bi-check"></i></button><button class="btn btn-danger btn-sm" onclick="actListing(${l.id},'reject')"><i class="bi bi-x"></i></button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="actListing(${l.id},'feature')"><i class="bi bi-star${l.featured?'':'-fill'}"></i> ${l.featured?'إلغاء تمييز':'تمييز'}</button>
          <button class="btn btn-ghost btn-sm" onclick="actListing(${l.id},'sold')"><i class="bi bi-bag-check"></i> مباع</button>
          <button class="btn btn-danger btn-sm" onclick="delListing(${l.id})"><i class="bi bi-trash"></i></button>
          <a href="/listing.html?id=${l.id}" target="_blank" class="btn btn-ghost btn-sm"><i class="bi bi-eye"></i></a>
        </td>
      </tr>
    `).join('');
  } catch(e){ toast('خطأ','error'); }
}

window.delListing = async function(id){
  if(!confirm('هل تريد حذف الإعلان رقم '+id+' نهائيًا؟')) return;
  try{
    const res = await fetch('/api/admin/listings/'+id+'/delete',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ toast('تم حذف الإعلان','success'); loadView(document.querySelector('.nav-item.active[data-view]').dataset.view); }
    else toast(d.error||'خطأ','error');
  }catch(e){ toast('خطأ','error'); }
};

window.actListing = async function(id,act){
  if(act==='reject'){
    const reason = prompt('سبب الرفض:');
    if(reason===null) return;
    try{
      const res = await fetch('/api/admin/listings/'+id+'/reject',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({reason})});
      if(res.ok){ toast('تم رفض الإعلان'); loadView(document.querySelector('.nav-item.active[data-view]').dataset.view); }
    }catch(e){ toast('خطأ','error'); }
    return;
  }
  try{
    const res = await fetch('/api/admin/listings/'+id+'/'+act,{method:'POST',headers:{'Authorization':'Bearer '+token}});
    if(res.ok){ toast('تم التنفيذ بنجاح'); loadView(document.querySelector('.nav-item.active[data-view]').dataset.view); fetch('/api/admin/stats',{headers:{'Authorization':'Bearer '+token}}).then(r=>r.json()).then(d=>{const b=document.getElementById('badgePending'); if(b)b.textContent=d.pending||0;}); }
  }catch(e){ toast('خطأ','error'); }
}

async function renderUsers(){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">إدارة المستخدمين</h1><p class="page-subtitle">التحكم في الحسابات والصلاحيات</p></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>الاسم</th><th>الهاتف</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>أخر دخول</th><th>إجراء</th></tr></thead><tbody id="userTbl"></tbody></table></div></div>`;
  try {
    const res = await fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    document.getElementById('userTbl').innerHTML = d.rows.map(u=>`
      <tr>
        <td>${u.id}</td>
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td>${u.phone||'-'}</td>
        <td>${u.email||'-'}</td>
        <td>
          <select class="field-select role-select" onchange="setRole(${u.id}, this.value)" ${u.id===user.id?'disabled':''} style="padding:.375rem .5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);color:var(--text)">
            <option value="admin" ${u.role==='admin'?'selected':''}>مدير</option>
            <option value="moderator" ${u.role==='moderator'?'selected':''}>مشرف</option>
            <option value="user" ${u.role==='user'?'selected':''}>مستخدم</option>
          </select>
        </td>
        <td><span class="status status-${u.status==='active'?'approved':u.status==='blocked'?'rejected':'pending'}">${u.status==='active'?'نشط':u.status==='blocked'?'محظور':'معلق'}</span></td>
        <td>${u.last_login?new Date(u.last_login).toLocaleString('ar-EG'):'-'}</td>
        <td style="display:flex;gap:.25rem;flex-wrap:wrap">
          ${u.id===user.id?'<span style="color:var(--text-2);font-size:.8rem">حسابك</span>':`
            <button class="btn btn-ghost btn-sm" onclick="setStatus(${u.id},'${u.status==='blocked'?'active':'blocked'}')">
              <i class="bi bi-${u.status==='blocked'?'unlock':'lock'}"></i> ${u.status==='blocked'?'فك الحظر':'حظر'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="delUser(${u.id},'${escapeHtml(u.name).replace(/'/g,'')}')"><i class="bi bi-trash"></i></button>
          `}
        </td>
      </tr>
    `).join('');
  } catch(e){ toast('خطأ في تحميل المستخدمين','error'); }
}

window.setRole = async function(id, role){
  try {
    const res = await fetch('/api/admin/users/'+id+'/role',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({role})});
    const d = await res.json();
    if(res.ok) toast('تم تحديث الصلاحية','success'); else { toast(d.error||'خطأ','error'); renderUsers(); }
  } catch(e){ toast('خطأ','error'); }
};
window.setStatus = async function(id, status){
  try {
    const res = await fetch('/api/admin/users/'+id+'/status',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({status})});
    const d = await res.json();
    if(res.ok){ toast(status==='blocked'?'تم حظر الحساب':'تم تنشيط الحساب','success'); renderUsers(); }
    else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
};
window.delUser = async function(id, name){
  if(!confirm('هل تريد حذف المستخدم "'+name+'" نهائيًا؟')) return;
  try {
    const res = await fetch('/api/admin/users/'+id+'/delete',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ toast('تم حذف المستخدم','success'); renderUsers(); } else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
};

async function renderPermissions(){
  content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">صلاحيات المستخدمين</h1><p class="page-subtitle">تحديد/تعديل/إضافة/حذف صلاحيات لكل مستخدم (CRUD كامل)</p></div></div>

    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-header"><div class="card-title"><i class="bi bi-key"></i> إدارة مفاتيح الصلاحيات</div>
        <button class="btn btn-primary btn-sm" onclick="openPermAdd()"><i class="bi bi-plus-lg"></i> إضافة صلاحية</button>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>#</th><th>المفتاح (key)</th><th>العنوان (label)</th><th>الوصف</th><th>إجراء</th></tr></thead>
        <tbody id="permKeysTbl"></tbody>
      </table></div>
    </div>

    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-header"><div class="card-title"><i class="bi bi-people"></i> تعيين صلاحيات المستخدمين</div></div>
      <div class="table-wrap" style="overflow:auto"><table class="table" id="permGridTbl"></table></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title"><i class="bi bi-info-circle"></i> شرح الأدوار (preset)</div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:.5rem;font-size:.9rem">
        <div><strong style="color:var(--primary)">مدير (admin):</strong> جميع الصلاحيات (18).</div>
        <div><strong style="color:var(--info)">مشرف (moderator):</strong> dashboard, listings.view_all, listings.approve, listings.feature, users.view, activity.view, listings.manage_own, favorites, messages.</div>
        <div><strong style="color:var(--text-2)">مستخدم (user):</strong> dashboard, listings.manage_own, favorites, messages.</div>
      </div>
    </div>
  `;

  await loadPermKeys();
  await loadPermGrid();
}

async function loadPermKeys(){
  try {
    const res = await fetch('/api/admin/permissions',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    const tb = document.getElementById('permKeysTbl');
    if(!d.rows || !d.rows.length){ tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-2);padding:2rem">لا توجد صلاحيات</td></tr>'; return; }
    tb.innerHTML = d.rows.map(p=>`
      <tr>
        <td>${p.id}</td>
        <td><code style="background:var(--bg-2);padding:.125rem .5rem;border-radius:6px;font-size:.85rem">${escapeHtml(p.key)}</code></td>
        <td><strong>${escapeHtml(p.label)}</strong></td>
        <td style="color:var(--text-2);font-size:.85rem">${escapeHtml(p.description||'-')}</td>
        <td><button class="btn btn-danger btn-sm" onclick="delPerm(${p.id},'${escapeHtml(p.key).replace(/'/g,'')}')"><i class="bi bi-trash"></i> حذف</button></td>
      </tr>`).join('');
  } catch(e){ toast('خطأ في تحميل الصلاحيات','error'); }
}

window.openPermAdd = function(){
  const key = prompt('مفتاح الصلاحية (بالإنجليزية، مثال: reports.view):');
  if(!key) return;
  const label = prompt('عنوان الصلاحية (بالعربية):');
  if(!label) return;
  const desc = prompt('وصف (اختياري):') || '';
  fetch('/api/admin/permissions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({key:key.trim(),label:label.trim(),description:desc.trim()})})
    .then(r=>r.json()).then(d=>{ if(d.ok){ toast('تمت الإضافة','success'); loadPermKeys(); loadPermGrid(); } else toast(d.error||'خطأ','error'); })
    .catch(()=>toast('خطأ','error'));
};

window.delPerm = async function(id,key){
  if(!confirm('حذف الصلاحية "'+key+'"? سيتم إزالتها من جميع المستخدمين.')) return;
  try {
    const res = await fetch('/api/admin/permissions/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ toast('تم الحذف','success'); loadPermKeys(); loadPermGrid(); }
    else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
};

let permKeysCache = [];
let permUsersCache = [];
async function loadPermGrid(){
  try {
    const pRes = await fetch('/api/admin/permissions',{headers:{'Authorization':'Bearer '+token}});
    const uRes = await fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+token}});
    const pD = await pRes.json(); const uD = await uRes.json();
    permKeysCache = pD.rows||[];
    permUsersCache = uD.rows||[];

    const userPerms = {};
    await Promise.all(permUsersCache.map(async function(u){
      const r = await fetch('/api/admin/users/'+u.id+'/permissions',{headers:{'Authorization':'Bearer '+token}});
      const d = await r.json();
      userPerms[u.id] = d.permissions||[];
    }));

    const tbl = document.getElementById('permGridTbl');
    let html = '<thead><tr><th style="min-width:160px">المستخدم</th>';
    for(const p of permKeysCache){ html += '<th style="text-align:center;font-size:.75rem;min-width:70px;writing-mode:vertical-rl;transform:rotate(180deg)">'+escapeHtml(p.label)+'</th>'; }
    html += '<th style="min-width:120px">إجراءات</th></tr></thead><tbody>';
    for(const u of permUsersCache){
      const granted = userPerms[u.id]||[];
      html += '<tr><td><strong>'+escapeHtml(u.name)+'</strong><br><span style="font-size:.75rem;color:var(--text-2)">'+u.role+'</span></td>';
      for(const p of permKeysCache){
        const checked = granted.includes(p.key) ? 'checked' : '';
        html += '<td style="text-align:center"><input type="checkbox" class="perm-cb" data-user="'+u.id+'" data-key="'+p.key+'" '+checked+' style="width:16px;height:16px;cursor:pointer"></td>';
      }
      html += '<td style="display:flex;gap:.25rem;flex-wrap:wrap">'
        + '<button class="btn btn-primary btn-sm" onclick="saveUserPerms('+u.id+')"><i class="bi bi-check2"></i> حفظ</button>'
        + '<select onchange="applyPreset('+u.id+', this.value, this)" style="padding:.25rem .375rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);font-size:.75rem">'
        + '<option value="">preset...</option><option value="admin">admin</option><option value="moderator">moderator</option><option value="user">user</option>'
        + '</select></td></tr>';
    }
    html += '</tbody>';
    tbl.innerHTML = html;
  } catch(e){ toast('خطأ في تحميل شبكة الصلاحيات','error'); }
}

window.saveUserPerms = async function(userId){
  const cbs = document.querySelectorAll('.perm-cb[data-user="'+userId+'"]');
  const perms = [];
  cbs.forEach(function(cb){ if(cb.checked) perms.push(cb.dataset.key); });
  try {
    const res = await fetch('/api/admin/users/'+userId+'/permissions',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({permissions:perms})});
    const d = await res.json();
    if(res.ok) toast('تم حفظ صلاحيات '+userId+' ('+perms.length+')','success');
    else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
};

window.applyPreset = async function(userId, role, sel){
  if(!role) return;
  if(!confirm('تطبيق preset "'+role+'" على المستخدم '+userId+'? (سيُستبدل دوره وصلاحياته)')) { sel.value=''; return; }
  try {
    const res = await fetch('/api/admin/users/'+userId+'/permissions/preset',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({role})});
    const d = await res.json();
    if(res.ok){ toast('تم تطبيق preset '+role,'success'); loadPermGrid(); }
    else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
  sel.value='';
};

window.applyPresetAll = async function(role){
  if(!confirm('تطبيق preset "'+role+'" على جميع المستخدمين (عدا حسابك)؟')) return;
  for(const u of permUsersCache){
    if(u.id===user.id) continue;
    await fetch('/api/admin/users/'+u.id+'/permissions/preset',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({role})});
  }
  toast('تم تطبيق preset '+role,'success');
  loadPermGrid();
};

async function renderCategories(){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">الأقسام</h1></div><button class="btn btn-primary" onclick="addCat()"><i class="bi bi-plus"></i> إضافة قسم</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>الاسم</th><th>الأيقونة</th><th>النوع</th><th>الترتيب</th><th>الحالة</th></tr></thead><tbody id="catTbl"></tbody></table></div></div>`;
  try {
    const res = await fetch('/api/admin/categories',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    document.getElementById('catTbl').innerHTML = d.rows.map(c=>`
      <tr>
        <td>${c.id}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td style="font-size:1.5rem">${c.icon}</td>
        <td>${c.type}</td>
        <td>${c.sort_order}</td>
        <td><span class="status status-${c.active?'approved':'rejected'}">${c.active?'مفعل':'معطل'}</span></td>
      </tr>
    `).join('');
  } catch(e){}
}
window.addCat = function(){
  const name = prompt('اسم القسم:');
  if(!name) return;
  const icon = prompt('أيقونة (رمز إيموجي):','📦');
  const type = prompt('النوع (cars/real_estate/lands/other):','other');
  fetch('/api/admin/categories',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({name,icon,type})}).then(r=>r.json()).then(()=>{ toast('تم الإضافة'); renderCategories(); });
}

let txCache = { listings: [], users: [] };

async function renderTransactions(){
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">المعاملات والعمولة</h1><p class="page-subtitle">تسجيل الصفقات واحتساب عمولة الموقع تلقائيًا</p></div>
      <button class="btn btn-primary" onclick="openTxModal()"><i class="bi bi-plus-lg"></i> تسجيل صفقة</button>
    </div>
    <div id="commissionSummary" class="stats-grid" style="margin-bottom:1.5rem"></div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>الإعلان</th><th>البائع</th><th>المشتري</th><th>مبلغ الصفقة</th><th>النسبة</th><th>العمولة</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead>
      <tbody id="txTbl"></tbody>
    </table></div></div>`;
  try {
    const res = await fetch('/api/admin/transactions',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    const rows = d.rows || [];
    const completed = rows.filter(t=>t.status==='completed');
    const pending = rows.filter(t=>t.status==='pending');
    const totalCommission = completed.reduce((s,t)=>s+Number(t.commission||0),0);
    const totalAmount = completed.reduce((s,t)=>s+Number(t.amount||0),0);
    document.getElementById('commissionSummary').innerHTML = `
      <div class="stat-card"><div class="stat-icon blue"><i class="bi bi-receipt"></i></div><div class="stat-info"><div class="stat-label">إجمالي العمولة المحصلة</div><div class="stat-value">${Number(totalCommission).toLocaleString('ar-EG')} ج.م</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="bi bi-cash-stack"></i></div><div class="stat-info"><div class="stat-label">قيمة الصفقات المكتملة</div><div class="stat-value">${Number(totalAmount).toLocaleString('ar-EG')} ج.م</div></div></div>
      <div class="stat-card"><div class="stat-icon orange"><i class="bi bi-hourglass-split"></i></div><div class="stat-info"><div class="stat-label">صفقات قيد الانتظار</div><div class="stat-value">${pending.length}</div></div></div>
    `;
    const tb = document.getElementById('txTbl');
    if(!rows.length){ tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--text-2);padding:2rem">لا توجد معاملات بعد — اضغط "تسجيل صفقة" لإضافة أول صفقة</td></tr>'; return; }
    tb.innerHTML = rows.map(t=>`
      <tr>
        <td>${t.id}</td>
        <td>${escapeHtml(t.listing_title||'-')}</td>
        <td>${escapeHtml(t.seller_name||'-')}</td>
        <td>${escapeHtml(t.buyer_name||'-')}</td>
        <td>${Number(t.amount||0).toLocaleString('ar-EG')} ج.م</td>
        <td>${t.commission_percent||2}%</td>
        <td><strong style="color:var(--primary)">${Number(t.commission||0).toLocaleString('ar-EG')} ج.م</strong></td>
        <td><span class="status status-${t.status==='completed'?'approved':t.status==='pending'?'pending':'rejected'}">${t.status==='completed'?'مكتمل':t.status==='pending'?'قيد الانتظار':'ملغي'}</span></td>
        <td>${new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
        <td style="display:flex;gap:.25rem;flex-wrap:wrap">
          ${t.status==='pending'?`
            <button class="btn btn-success btn-sm" onclick="txAction(${t.id},'complete')"><i class="bi bi-check2"></i> إتمام</button>
            <button class="btn btn-ghost btn-sm" onclick="txAction(${t.id},'cancel')"><i class="bi bi-x"></i> إلغاء</button>`:'<span style="color:var(--text-2);font-size:.8rem">—</span>'}
        </td>
      </tr>
    `).join('');
  } catch(e){ toast('خطأ في تحميل المعاملات','error'); }
}

window.openTxModal = async function(){
  try {
    const [lRes, uRes, sRes] = await Promise.all([
      fetch('/api/admin/listings',{headers:{'Authorization':'Bearer '+token}}),
      fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+token}}),
      fetch('/api/admin/settings',{headers:{'Authorization':'Bearer '+token}})
    ]);
    const l = await lRes.json(), u = await uRes.json(), s = await sRes.json();
    txCache.listings = (l.rows||[]).filter(x=>['approved','sold'].includes(x.status));
    txCache.users = (u.rows||[]);
    const pct = Number(s.commission_percent||2) || 2;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3><i class="bi bi-cash-coin"></i> تسجيل صفقة جديدة</h3>
          <button class="btn-close" onclick="closeTxModal()"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>الإعلان</label>
            <select id="txListing">
              <option value="">— اختر الإعلان —</option>
              ${txCache.listings.map(x=>`<option value="${x.id}" data-seller="${x.user_id}" data-price="${x.price}">#${x.id} — ${escapeHtml(x.title)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>المشتري</label>
            <select id="txBuyer">
              <option value="">— اختر المشتري —</option>
              ${txCache.users.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} ${x.phone?'('+x.phone+')':''}</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label>مبلغ الصفقة (ج.م)</label>
              <input type="number" id="txAmount" value="0" min="0">
            </div>
            <div class="field">
              <label>نسبة العمولة %</label>
              <input type="number" id="txPct" value="${pct}" min="0" max="100" step="0.1">
            </div>
          </div>
          <div class="field">
            <label>ملاحظات (اختياري)</label>
            <textarea id="txNote" rows="2" placeholder="مثال: بيع سيارة بعد الاتفاق على السعر"></textarea>
          </div>
          <div id="txPreview" style="padding:.75rem 1rem;border-radius:10px;background:var(--bg-2);border:1px solid var(--border);font-size:.9rem">
            العمولة المتوقعة: <strong id="txCommissionPreview">0</strong> ج.م
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-primary" id="txSave" onclick="saveTx()"><i class="bi bi-check2"></i> حفظ الصفقة</button>
          <button class="btn btn-ghost" onclick="closeTxModal()">إلغاء</button>
        </div>
      </div>`;
    backdrop.id = 'txModalBackdrop';
    backdrop.addEventListener('click', closeTxModal);
    document.body.appendChild(backdrop);

    const listingSel = document.getElementById('txListing');
    listingSel.addEventListener('change', ()=>{
      const opt = listingSel.selectedOptions[0];
      if(opt && opt.dataset.price) document.getElementById('txAmount').value = opt.dataset.price;
      updateTxPreview();
    });
    document.getElementById('txAmount').addEventListener('input', updateTxPreview);
    document.getElementById('txPct').addEventListener('input', updateTxPreview);
    updateTxPreview();
  } catch(e){ toast('تعذر فتح نموذج الصفقة','error'); }
};

function updateTxPreview(){
  const a = Number(document.getElementById('txAmount')?.value||0);
  const p = Number(document.getElementById('txPct')?.value||0);
  const c = Math.round(a * p) / 100;
  const el = document.getElementById('txCommissionPreview');
  if(el) el.textContent = c.toLocaleString('ar-EG');
}
window.updateTxPreview = updateTxPreview;

window.closeTxModal = function(){
  document.getElementById('txModalBackdrop')?.remove();
};

window.saveTx = async function(){
  const listing_id = document.getElementById('txListing').value;
  const buyer_id = document.getElementById('txBuyer').value;
  const amount = document.getElementById('txAmount').value;
  const commission_percent = document.getElementById('txPct').value;
  const note = document.getElementById('txNote').value;
  if(!listing_id || !buyer_id || !amount){ toast('يرجى اختيار الإعلان والمشتري وإدخال المبلغ','error'); return; }
  const btn = document.getElementById('txSave');
  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/transactions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({listing_id,buyer_id,amount,commission_percent,note})});
    const d = await res.json();
    if(res.ok){ toast('تم تسجيل الصفقة بنجاح','success'); closeTxModal(); renderTransactions(); }
    else { toast(d.error||'خطأ','error'); btn.disabled = false; }
  } catch(e){ toast('خطأ','error'); btn.disabled = false; }
};

window.txAction = async function(id, act){
  if(act==='cancel' && !confirm('إلغاء هذه الصفقة؟')) return;
  try {
    const res = await fetch('/api/admin/transactions/'+id+'/'+act,{method:'POST',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ toast(act==='complete'?'تم إتمام الصفقة':'تم إلغاء الصفقة','success'); renderTransactions(); }
    else toast(d.error||'خطأ','error');
  } catch(e){ toast('خطأ','error'); }
};

async function renderSettings(){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">إعدادات الموقع</h1></div><button class="btn btn-primary" onclick="saveSettings()"><i class="bi bi-check"></i> حفظ الإعدادات</button></div><div class="card"><div class="card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem"><div><label style="display:block;margin-bottom:.5rem;font-weight:600">اسم الموقع</label><input class="form-input" id="s_site_name" style="width:100%;padding:.625rem 1rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-2);color:var(--text)"></div><div><label style="display:block;margin-bottom:.5rem;font-weight:600">نسبة العمولة %</label><input type="number" class="form-input" id="s_commission_percent" style="width:100%;padding:.625rem 1rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-2);color:var(--text)"></div><div style="grid-column:1/-1"><label style="display:block;margin-bottom:.5rem;font-weight:600">وصف الموقع</label><input class="form-input" id="s_site_desc" style="width:100%;padding:.625rem 1rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-2);color:var(--text)"></div></div></div></div>`;
  try {
    const res = await fetch('/api/admin/settings',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    document.getElementById('s_site_name').value = d.site_name||'تسوق';
    document.getElementById('s_commission_percent').value = d.commission_percent||'2';
    document.getElementById('s_site_desc').value = d.site_desc||'';
  } catch(e){}
}
window.saveSettings = function(){
  const body = {
    site_name: document.getElementById('s_site_name').value,
    commission_percent: document.getElementById('s_commission_percent').value,
    site_desc: document.getElementById('s_site_desc').value,
  };
  fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(body)}).then(r=>r.json()).then(()=>toast('تم حفظ الإعدادات','success'));
}

async function renderBackup(){
  content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">نظام النسخ الاحتياطي</h1><p class="page-subtitle">حفظ نسخة آمنة من قاعدة البيانات واستعادتها</p></div>
      <button class="btn btn-primary" onclick="doBackup()"><i class="bi bi-database-down"></i> إنشاء نسخة احتياطية</button>
    </div>
    <div class="card" style="max-width:760px;margin-bottom:1.5rem"><div class="card-body" style="display:flex;align-items:center;gap:1.25rem">
      <div style="width:70px;height:70px;border-radius:18px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--primary)">💾</div>
      <div>
        <h3 style="margin-bottom:.25rem">نسخة احتياطية كاملة</h3>
        <p style="color:var(--text-2);font-size:.9rem">يتم حفظ نسخة من قاعدة البيانات في مجلد <code>backups/</code>، ويمكن تنزيلها في أي وقت.</p>
      </div>
    </div></div>
    <div class="card"><div class="card-header"><div class="card-title"><i class="bi bi-clock-history"></i> النسخ المتاحة</div><button class="btn btn-ghost btn-sm" onclick="loadBackups()"><i class="bi bi-arrow-clockwise"></i> تحديث</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>الملف</th><th>الحجم</th><th>التاريخ</th><th>تنزيل</th></tr></thead><tbody id="backupTbl"></tbody></table></div>
    </div>`;
  loadBackups();
}

window.loadBackups = async function(){
  const tb = document.getElementById('backupTbl');
  if(!tb) return;
  try {
    const res = await fetch('/api/admin/backups',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(!d.rows || !d.rows.length){ tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-2);padding:2rem">لا توجد نسخ احتياطية — اضغط "إنشاء نسخة احتياطية"</td></tr>'; return; }
    tb.innerHTML = d.rows.map(b=>`
      <tr>
        <td><i class="bi bi-file-earmark-zip" style="color:var(--primary)"></i> ${b.name}</td>
        <td>${(b.size/1024).toFixed(1)} كيلوبايت</td>
        <td>${new Date(b.created_at).toLocaleString('ar-EG')}</td>
        <td><a class="btn btn-ghost btn-sm" href="/backups/${encodeURIComponent(b.name)}" download><i class="bi bi-download"></i> تنزيل</a></td>
      </tr>`).join('');
  } catch(e){}
};

window.doBackup = function(){
  fetch('/api/admin/backup',{method:'POST',headers:{'Authorization':'Bearer '+token}}).then(r=>r.json()).then(d=>{
    toast(d.message || 'تم إنشاء النسخة', 'success');
    loadBackups();
  }).catch(()=>toast('تعذر إنشاء النسخة','error'));
};

async function renderActivity(){
  content.innerHTML = `<div class="page-header"><div><h1 class="page-title">سجل النشاط</h1></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>المستخدم</th><th>النشاط</th><th>IP</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody id="actTbl"></tbody></table></div></div>`;
  try {
    const res = await fetch('/api/admin/activity',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    document.getElementById('actTbl').innerHTML = d.rows.map(a=>`
      <tr>
        <td>${escapeHtml(a.user_name||'نظام')}</td>
        <td>${a.action}</td>
        <td>${a.ip||'-'}</td>
        <td><code style="font-size:.8rem">${a.details||'-'}</code></td>
        <td>${new Date(a.created_at).toLocaleString('ar-EG')}</td>
      </tr>
    `).join('');
  } catch(e){}
}

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));}

loadView('dashboard');

