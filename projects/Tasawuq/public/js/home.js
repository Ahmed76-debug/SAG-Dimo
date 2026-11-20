/* ============================================================
   تسوق — Homepage Logic
   Stats counters, featured listings, commission calculator
   ============================================================ */
(function () {
  const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const nf = (n) => Number(n || 0).toLocaleString('ar-EG');
  const timeAgo = (d) => {
    if (!d) return '';
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
    if (diff < 604800) return Math.floor(diff / 86400) + ' يوم';
    return new Date(d).toLocaleDateString('ar-EG');
  };
  const typeLabel = (t) => t === 'cars' ? '🚗 سيارة' : t === 'real_estate' ? '🏠 عقار' : '🌍 أرض';

  function card(l, i) {
    return `
      <a href="/listing.html?id=${l.id}" class="listing-card" style="animation-delay:${i * 0.05}s">
        <div class="listing-img-wrap">
          <img src="${l.thumb || 'assets/placeholder.svg'}" alt="${esc(l.title)}" class="listing-img" loading="lazy" onerror="this.onerror=null;this.src='assets/placeholder.svg'">
          <span class="listing-badge">${typeLabel(l.type)}</span>
          <button class="listing-fav" onclick="event.preventDefault();window.toggleFav && window.toggleFav(${l.id},this)" aria-label="إضافة للمفضلة"><i class="bi bi-heart"></i></button>
        </div>
        <div class="listing-content">
          <div class="listing-price">${nf(l.price)} ${esc(l.currency || 'ج.م')}${l.negotiable ? ' <span style="font-size:.75rem;font-weight:600;-webkit-text-fill-color:var(--text-2)">• قابل للتفاوض</span>' : ''}</div>
          <h3 class="listing-title">${esc(l.title)}</h3>
          <div class="listing-meta">
            ${l.city ? `<span><i class="bi bi-geo-alt"></i> ${esc(l.city)}</span>` : ''}
            <span><i class="bi bi-eye"></i> ${nf(l.views)}</span>
            <span><i class="bi bi-clock"></i> ${timeAgo(l.created_at)}</span>
          </div>
          <div class="listing-footer">
            <div class="listing-location"><i class="bi bi-person-circle"></i> ${esc(l.seller_name || 'مستخدم')}</div>
            <span style="color:var(--primary);font-weight:600;font-size:.9rem">التفاصيل <i class="bi bi-arrow-left"></i></span>
          </div>
        </div>
      </a>`;
  }

  const skeleton = () => `
    <div class="skeleton-card"><div class="skeleton-img"></div>
      <div class="skeleton-lines"><div class="skeleton-line w-40"></div><div class="skeleton-line"></div><div class="skeleton-line w-70"></div></div>
    </div>`;

  /* ---------- Stat counters ---------- */
  function countUp(el, target) {
    if (!el) return;
    const dur = 900;
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (target - from) * eased).toLocaleString('ar-EG');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  let statsLoaded = false;
  fetch('/api/stats').then(r => r.json()).then((s) => {
    statsLoaded = true;
    countUp(document.getElementById('statListings'), s.listings || 0);
    countUp(document.getElementById('statUsers'), s.users || 0);
    document.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.count;
      el.textContent = nf(s[key] || 0) + ' إعلان';
    });
    const pct = s.commission_percent || 2;
    const cp = document.getElementById('commissionPct');
    if (cp) cp.textContent = pct + '%';
    const calcPct = document.getElementById('calcPct');
    if (calcPct) calcPct.textContent = pct + '%';
    calc();
  }).catch(() => {
    if (!statsLoaded) {
      const a = document.getElementById('statListings');
      if (a) a.textContent = '0';
      const b = document.getElementById('statUsers');
      if (b) b.textContent = '0';
    }
  });

  /* ---------- Featured ---------- */
  const fGrid = document.getElementById('featuredGrid');
  if (fGrid) {
    fGrid.innerHTML = Array.from({ length: 4 }, skeleton).join('');
    fetch('/api/listings?featured=1&limit=8')
      .then(r => r.json())
      .then(d => {
        let rows = d.rows || [];
        if (!rows.length) {
          return fetch('/api/listings?limit=4').then(r => r.json()).then(d2 => {
            fGrid.innerHTML = (d2.rows || []).map(card).join('');
          });
        }
        fGrid.innerHTML = rows.slice(0, 8).map(card).join('');
      })
      .catch(() => { fGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-2)">تعذر تحميل الإعلانات</p>'; });
  }

  /* ---------- Commission calculator ---------- */
  let pctValue = 2;
  fetch('/api/settings').then(r => r.json()).then(s => {
    if (s.commission_percent) pctValue = Number(s.commission_percent) || 2;
    calc();
  }).catch(() => {});

  function calc() {
    const amountEl = document.getElementById('calcAmount');
    const resEl = document.getElementById('calcResult');
    const netEl = document.getElementById('calcNet');
    const pctEl = document.getElementById('calcPct');
    if (!amountEl || !resEl) return;
    const p = (typeof pctValue === 'number' && pctValue > 0) ? pctValue : 2;
    if (pctEl) pctEl.textContent = p + '%';
    const amount = Math.max(0, Number(amountEl.value) || 0);
    const commission = amount * p / 100;
    resEl.textContent = nf(commission) + ' ج.م';
    if (netEl) netEl.textContent = nf(amount - commission) + ' ج.م';
  }
  document.getElementById('calcAmount')?.addEventListener('input', calc);

  /* ---------- Mobile menu ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const header = document.querySelector('.header');
  menuToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    header?.classList.toggle('mobile-open');
    const icon = menuToggle.querySelector('i');
    if (icon) icon.className = header?.classList.contains('mobile-open') ? 'bi bi-x-lg' : 'bi bi-list';
  });
})();
