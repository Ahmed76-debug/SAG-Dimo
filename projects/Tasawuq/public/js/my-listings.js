/* My Listings */
if(!token) location.href='/login.html';
let all = [];
let cur = 'all';

async function load(){
  try{
    const res = await fetch('/api/my/listings',{headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    all = d.rows||[];
    document.getElementById('statsRow').innerHTML = `
      <div class="mini-stat"><div class="num">${all.length}</div><div class="lbl">إجمالي الإعلانات</div></div>
      <div class="mini-stat"><div class="num">${all.filter(x=>x.status==='pending').length}</div><div class="lbl">قيد المراجعة</div></div>
      <div class="mini-stat"><div class="num">${all.filter(x=>x.status==='approved').length}</div><div class="lbl">منشور</div></div>
      <div class="mini-stat"><div class="num">${all.reduce((s,x)=>s+(x.views||0),0)}</div><div class="lbl">إجمالي المشاهدات</div></div>
    `;
    render();
  }catch(e){}
}

function render(){
  const wrap = document.getElementById('listingsWrap');
  const list = cur==='all'?all:all.filter(x=>x.status===cur);
  if(!list.length){
    wrap.innerHTML = `<div class="empty-box"><div class="ic">📭</div><h3>لا توجد إعلانات</h3><p>${cur==='all'?'ابدأ بإضافة أول إعلان لك':'لا يوجد إعلانات بهذه الحالة'}</p><a href="/add-listing.html" class="btn btn-primary"><i class="bi bi-plus-circle"></i> أضف إعلان</a></div>`;
    return;
  }
  wrap.innerHTML = `<div class="my-listings">` + list.map(l=>`
    <div class="my-listing">
      <img src="${l.thumb||'assets/placeholder.svg'}" class="my-listing-img" onerror="this.src='assets/placeholder.svg'">
      <div class="my-listing-body">
        <span class="badge-status badge-${l.status}">${statusText(l.status)}</span>
        <div class="my-listing-title">${esc(l.title)}</div>
        <div class="my-listing-price">${Number(l.price).toLocaleString('ar-EG')} ج.م</div>
        <div class="my-listing-meta">
          <span><i class="bi bi-geo-alt"></i> ${esc(l.city||'-')}</span>
          <span><i class="bi bi-eye"></i> ${l.views||0} مشاهدة</span>
          <span><i class="bi bi-clock"></i> ${new Date(l.created_at).toLocaleDateString('ar-EG')}</span>
        </div>
        ${l.status==='rejected'&&l.rejection_reason?`<div style="color:var(--danger);font-size:.9rem"><i class="bi bi-exclamation-triangle"></i> سبب الرفض: ${esc(l.rejection_reason)}</div>`:''}
      </div>
      <div class="my-listing-actions">
        <a href="/listing.html?id=${l.id}" class="btn btn-ghost btn-sm"><i class="bi bi-eye"></i> عرض</a>
        <button class="btn btn-ghost btn-sm" onclick="editListing(${l.id})"><i class="bi bi-pencil"></i> تعديل</button>
        ${l.status==='approved'?`<button class="btn btn-ghost btn-sm" onclick="markSold(${l.id})"><i class="bi bi-bag-check"></i> تم البيع</button>`:''}
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteListing(${l.id})"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `).join('') + `</div>`;
}

function statusText(s){ return s==='pending'?'قيد المراجعة':s==='approved'?'منشور':s==='rejected'?'مرفوض':s==='sold'?'مباع':'منتهي'; }
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));}

document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    cur = b.dataset.status;
    render();
  });
});

window.markSold = async function(id){
  if(!confirm('هل تريد تعيين الإعلان كمباع؟ سيتم إخفاؤه من قائمة الإعلانات المتاحة.')) return;
  try{
    const res = await fetch('/api/my/listings/'+id+'/sold',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ load(); } else alert(d.error||'خطأ');
  }catch(e){ alert('خطأ في الاتصال'); }
};

window.deleteListing = async function(id){
  if(!confirm('هل تريد حذف هذا الإعلان نهائيًا؟')) return;
  try{
    const res = await fetch('/api/my/listings/'+id+'/delete',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    const d = await res.json();
    if(res.ok){ load(); } else alert(d.error||'خطأ');
  }catch(e){ alert('خطأ في الاتصال'); }
};

window.editListing = function(id){
  const l = all.find(x=>x.id===id);
  if(!l) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'editModal';
  backdrop.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3><i class="bi bi-pencil-square"></i> تعديل الإعلان</h3>
        <button class="btn-close" onclick="document.getElementById('editModal').remove()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="modal-body">
        <div class="field"><label>العنوان</label><input id="e_title" value="${esc(l.title)}"></div>
        <div class="field-row">
          <div class="field"><label>السعر</label><input type="number" id="e_price" value="${l.price}"></div>
          <div class="field"><label>المدينة</label><input id="e_city" value="${esc(l.city||'')}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>الهاتف</label><input id="e_phone" value="${esc(l.phone||'')}"></div>
          <div class="field"><label>واتساب</label><input id="e_whatsapp" value="${esc(l.whatsapp||'')}"></div>
        </div>
        <div class="field"><label>الوصف</label><textarea id="e_desc" rows="4">${esc(l.description||'')}</textarea></div>
        <div class="notice" style="margin:0;font-size:.85rem"><i class="bi bi-info-circle"></i><p>بعد التعديل سيُعاد الإعلان للمراجعة قبل النشر مرة أخرى.</p></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="e_save"><i class="bi bi-check2"></i> حفظ التعديلات</button>
        <button class="btn btn-ghost" onclick="document.getElementById('editModal').remove()">إلغاء</button>
      </div>
    </div>`;
  backdrop.addEventListener('click', ()=>backdrop.remove());
  document.body.appendChild(backdrop);
  document.getElementById('e_save').addEventListener('click', async ()=>{
    const body = {
      title: document.getElementById('e_title').value.trim(),
      price: document.getElementById('e_price').value,
      city: document.getElementById('e_city').value.trim(),
      phone: document.getElementById('e_phone').value.trim(),
      whatsapp: document.getElementById('e_whatsapp').value.trim(),
      description: document.getElementById('e_desc').value
    };
    if(!body.title || !body.price){ alert('العنوان والسعر مطلوبان'); return; }
    try{
      const res = await fetch('/api/my/listings/'+id,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(body)});
      const d = await res.json();
      if(res.ok){ backdrop.remove(); load(); } else alert(d.error||'خطأ');
    }catch(e){ alert('خطأ في الاتصال'); }
  });
};

load();

