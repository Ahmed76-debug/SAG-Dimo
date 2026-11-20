/* ============================================================
   تسوق - Frontend App
   ============================================================ */
const API = '';
let token = localStorage.getItem('ts_token');
let user = JSON.parse(localStorage.getItem('ts_user')||'null');

// Theme
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle?.querySelector('i');
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('ts_theme', t);
  if (themeIcon) themeIcon.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
}
setTheme(localStorage.getItem('ts_theme')||'light');
themeToggle?.addEventListener('click', ()=> setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

// Auth UI
const userMenu = document.getElementById('userMenu');
const loginBtn = document.getElementById('loginBtn');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
if (user && token) {
  if (userMenu) userMenu.style.display='flex';
  if (loginBtn) loginBtn.style.display='none';
  if (userName) userName.textContent = user.name.split(' ')[0];
}
logoutBtn?.addEventListener('click', async (e)=>{
  e.preventDefault();
  try { await fetch(API+'/api/auth/logout',{method:'POST',headers:{'Authorization':'Bearer '+token}}); } catch(e){}
  localStorage.removeItem('ts_token'); localStorage.removeItem('ts_user');
  location.href='/';
});

// Load latest listings
async function loadListings() {
  const grid = document.getElementById('listingsGrid');
  if (!grid) return;
  try {
    const res = await fetch(API+'/api/listings?limit=8');
    const data = await res.json();
    if (!data.rows || data.rows.length===0) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-2);padding:2rem">لا توجد إعلانات بعد</p>';
      return;
    }
    grid.innerHTML = data.rows.map((l,i)=>`
      <a href="/listing.html?id=${l.id}" class="listing-card" style="animation-delay:${i*.05}s">
        <div class="listing-img-wrap">
          <img src="${l.thumb||'assets/placeholder.svg'}" alt="${l.title}" class="listing-img" onerror="this.src='assets/placeholder.svg'">
          <span class="listing-badge">${l.type==='cars'?'🚗 سيارة':l.type==='real_estate'?'🏠 عقار':'🌍 أرض'}</span>
          <button class="listing-fav" onclick="event.preventDefault();toggleFav(${l.id},this)"><i class="bi bi-heart"></i></button>
        </div>
        <div class="listing-content">
          <div class="listing-price">${Number(l.price).toLocaleString('ar-EG')} ${l.currency||'ج.م'} ${l.negotiable?'• قابل للتفاوض':''}</div>
          <h3 class="listing-title">${escapeHtml(l.title)}</h3>
          <div class="listing-meta">
            ${l.city?'<span><i class="bi bi-geo-alt"></i> '+escapeHtml(l.city)+'</span>':''}
            <span><i class="bi bi-eye"></i> ${l.views||0}</span>
            <span><i class="bi bi-clock"></i> ${timeAgo(l.created_at)}</span>
          </div>
          <div class="listing-footer">
            <div class="listing-location"><i class="bi bi-person"></i> ${escapeHtml(l.seller_name||'مستخدم')}</div>
            <span class="btn btn-ghost btn-sm">عرض التفاصيل <i class="bi bi-arrow-left"></i></span>
          </div>
        </div>
      </a>
    `).join('');
  } catch(e) { console.error(e); }
}

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));}
function timeAgo(d){if(!d)return'';const diff=(Date.now()-new Date(d).getTime())/1000;if(diff<60)return'الآن';if(diff<3600)return Math.floor(diff/60)+' دقيقة';if(diff<86400)return Math.floor(diff/3600)+' ساعة';if(diff<604800)return Math.floor(diff/86400)+' يوم';return new Date(d).toLocaleDateString('ar-EG');}

window.toggleFav = async function(id,btn){
  if(!token){ location.href='/login.html'; return; }
  try {
    const res = await fetch(API+'/api/favorites/toggle',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({listing_id:id})});
    const d = await res.json();
    btn.querySelector('i').className = d.fav ? 'bi bi-heart-fill' : 'bi bi-heart';
    btn.style.color = d.fav ? '#ef4444' : '';
  } catch(e){}
}

// Search
document.getElementById('searchBtn')?.addEventListener('click', ()=>{
  const q = document.getElementById('searchInput').value;
  const t = document.getElementById('typeFilter').value;
  const c = document.getElementById('cityFilter').value;
  const params = new URLSearchParams();
  if(q) params.set('q',q);
  if(t) params.set('type',t);
  if(c) params.set('city',c);
  location.href='/listings.html?'+params.toString();
});
document.getElementById('searchInput')?.addEventListener('keypress', e=>{ if(e.key==='Enter') document.getElementById('searchBtn').click(); });

// Mobile menu (all pages)
const menuToggle = document.getElementById('menuToggle');
const headerEl = document.querySelector('.header');
menuToggle?.addEventListener('click', (e)=>{
  e.stopPropagation();
  headerEl?.classList.toggle('mobile-open');
  const icon = menuToggle.querySelector('i');
  if (icon) icon.className = headerEl?.classList.contains('mobile-open') ? 'bi bi-x-lg' : 'bi bi-list';
});

// Password show/hide toggle (global enhancer)
function setupPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    const group = input.closest('.input-group');
    if (!group || group.querySelector('.toggle-pass')) return;
    group.classList.add('has-toggle');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-pass';
    btn.setAttribute('aria-label', 'إظهار كلمة المرور');
    btn.innerHTML = '<i class="bi bi-eye"></i>';
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.querySelector('i').className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
      btn.setAttribute('aria-label', isPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      btn.style.color = isPass ? 'var(--primary)' : 'var(--muted)';
    });
    group.appendChild(btn);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPasswordToggles);
else setupPasswordToggles();


