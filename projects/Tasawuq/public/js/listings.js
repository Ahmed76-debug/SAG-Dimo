/* Listings Page JS */
let page = 1;
const limit = 12;
const params = new URLSearchParams(location.search);

document.getElementById('filterQ').value = params.get('q')||'';
document.getElementById('filterCity').value = params.get('city')||'';
document.querySelectorAll('input[name="type"]').forEach(r=>{
  if(r.value === (params.get('type')||'')) r.checked = true;
});

async function load() {
  const grid = document.getElementById('resultsGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('countRes');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem"><div class="spinner"></div></div>';
  
  const type = document.querySelector('input[name="type"]:checked').value;
  const q = document.getElementById('filterQ').value;
  const city = document.getElementById('filterCity').value;
  const min = document.getElementById('minPrice').value;
  const max = document.getElementById('maxPrice').value;
  
  const p = new URLSearchParams({ page, limit });
  if(type) p.set('type',type);
  if(q) p.set('q',q);
  if(city) p.set('city',city);
  if(min) p.set('min',min);
  if(max) p.set('max',max);
  const sortEl = document.getElementById('sortBy');
  if(sortEl) p.set('sort', sortEl.value);
  
  try {
    const res = await fetch('/api/listings?'+p.toString());
    const data = await res.json();
    count.textContent = data.total||0;
    if(!data.rows || data.rows.length===0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    grid.innerHTML = data.rows.map((l,i)=>`
      <a href="/listing.html?id=${l.id}" class="listing-card" style="animation-delay:${i*.03}s">
        <div class="listing-img-wrap">
          <img src="${l.thumb||'assets/placeholder.svg'}" class="listing-img" onerror="this.src='assets/placeholder.svg'">
          <span class="listing-badge">${l.type==='cars'?'🚗 سيارة':l.type==='real_estate'?'🏠 عقار':'🌍 أرض'}</span>
        </div>
        <div class="listing-content">
          <div class="listing-price">${Number(l.price).toLocaleString('ar-EG')} ${l.currency||'ج.م'} ${l.negotiable?'• قابل للتفاوض':''}</div>
          <h3 class="listing-title">${escapeHtml(l.title)}</h3>
          <div class="listing-meta">
            ${l.city?'<span><i class="bi bi-geo-alt"></i> '+escapeHtml(l.city)+'</span>':''}
            <span><i class="bi bi-eye"></i> '+${l.views||0}+'</span>
          </div>
          <div class="listing-footer">
            <div class="listing-location"><i class="bi bi-person"></i> ${escapeHtml(l.seller_name||'مستخدم')}</div>
            <span style="color:var(--primary);font-weight:600">التفاصيل <i class="bi bi-arrow-left"></i></span>
          </div>
        </div>
      </a>
    `).join('');
    renderPagination(data.pages);
  } catch(e) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--danger)">حدث خطأ</p>';
  }
}

function renderPagination(pages){
  const p = document.getElementById('pagination');
  if(pages <= 1){ p.innerHTML=''; return; }
  let html = '';
  for(let i=1;i<=pages;i++) html += `<button class="page-btn ${i===page?'active':''}" onclick="goPage(${i})">${i}</button>`;
  p.innerHTML = html;
}
window.goPage = function(n){ page=n; load(); window.scrollTo({top:0,behavior:'smooth'}); }

document.getElementById('applyFilters').addEventListener('click', ()=>{ page=1; load(); });
document.getElementById('sortBy')?.addEventListener('change', ()=>{ page=1; load(); });
document.getElementById('clearFilters').addEventListener('click', ()=>{
  document.querySelectorAll('input[name="type"]').forEach(r=>r.checked = r.value==='');
  document.getElementById('filterQ').value='';
  document.getElementById('filterCity').value='';
  document.getElementById('minPrice').value='';
  document.getElementById('maxPrice').value='';
  page=1; load();
});

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));}

const style = document.createElement('style');
style.textContent = `.spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

load();


