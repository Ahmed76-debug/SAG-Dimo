const $ = (s) => document.querySelector(s);
const escapeHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function biTitle(en, ar, fallback = '') {
  const e = (en && String(en).trim()) ? en : (fallback || '');
  const a = (ar && String(ar).trim() && String(ar).trim() !== String(e).trim()) ? ar : '';
  if (!e && !a) return '';
  if (!a) return escapeHtml(e);
  return escapeHtml(e) + '<span class="bi-ar">' + escapeHtml(a) + '</span>';
}

function el(tag, html, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function renderList(container, items, renderItem) {
  const c = document.querySelector(container);
  if (!c) return;
  c.innerHTML = '';
  items.forEach((it, i) => c.appendChild(renderItem(it, i)));
}

async function load() {
  try {
    const res = await fetch('/api/site');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    renderAll(data);
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('afterbegin', '<div style="background:#fee2e2;color:#991b1b;padding:12px;text-align:center">تعذر تحميل البيانات. تأكد من تشغيل الخادم.</div>');
  }
}

function renderAll(d) {
  const s = d.settings || {};
  document.title = (s.company_name || 'SMART ACTIVITY GROUP') + ' | توريدات عامة';
  document.getElementById('brandName').textContent = s.company_name || '';
  document.getElementById('brandSub').textContent = s.tagline || '';
  const brandMark = document.getElementById('brandMark');
  if (s.logo_url) {
    brandMark.innerHTML = `<img src="${escapeHtml(s.logo_url)}" alt="logo" class="brand-logo-img" onerror="this.style.display='none';this.parentElement.textContent='${escapeHtml((s.company_name || 'SA').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'SA')}'" />`;
  } else {
    brandMark.textContent = (s.company_name || 'SA').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'SA';
  }
  document.getElementById('heroTitle').innerHTML = escapeHtml(s.hero_title || '');
  document.getElementById('heroSubtitle').textContent = s.hero_subtitle || '';
  document.getElementById('heroBadge').textContent = s.hero_badge || '';
  document.getElementById('heroBadge2').textContent = s.hero_badge || '';
  document.getElementById('heroNote').textContent = s.hero_note || '';
  document.getElementById('footerName').textContent = s.company_name || '';
  const aboutIntro = document.getElementById('aboutIntro');
  if (aboutIntro) aboutIntro.textContent = s.about_intro || '';

  // hero stats
  const hs = document.getElementById('heroStats');
  hs.innerHTML = '';
  (d.hero_stats || []).forEach(st => {
    const stEl = document.createElement('div');
    stEl.className = 'stat';
    stEl.innerHTML = `<div class="stat-num">${escapeHtml(st.value)}</div><div class="stat-label">${biTitle(st.label_en, st.label_ar, st.label)}</div>`;
    hs.appendChild(stEl);
  });

  // about
  document.getElementById('aboutTitle').textContent = 'نبذة عن ' + (s.company_name || '');
  const aboutItems = document.getElementById('aboutItems');
  aboutItems.innerHTML = '';
  (d.about_items || []).forEach(it => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ic">✓</span> ${biTitle(it.text_en, it.text_ar, it.text)}`;
    aboutItems.appendChild(li);
  });
  document.getElementById('aboutCore').innerHTML = 'SAG<br/>SMART<br/>ACTIVITY';

  // vmv
  const vmvCards = document.getElementById('vmvCards');
  vmvCards.innerHTML = '';
  const kinds = ['vision','mission','values_card'];
  kinds.forEach(k => {
    const card = (d.vmv || []).find(v => v.kind === k);
    if (!card) return;
    const div = document.createElement('div');
    div.className = 'vmv-card';
    const icons = { vision:'🎯', mission:'🚀', values_card:'💎' };
    div.innerHTML = `<div class="vmv-icon">${icons[k]}</div><h3>${biTitle(card.title_en, card.title_ar, card.title)}</h3><p>${escapeHtml(card.body)}</p>`;
    vmvCards.appendChild(div);
  });
  const vl = document.getElementById('valuesList');
  vl.innerHTML = '';
  (d.values_list || []).forEach(v => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    const parts = [v.label_en || v.label, v.label_ar].filter((x,i,arr) => x && String(x).trim() && String(x).trim() !== String(arr[0]).trim());
    pill.innerHTML = parts.length ? parts.map(escapeHtml).join(' • ') : escapeHtml(v.label || '');
    vl.appendChild(pill);
  });

  // services
  const sg = document.getElementById('servicesGrid');
  sg.innerHTML = '';
  (d.services || []).forEach(sv => {
    const card = document.createElement('div');
    card.className = 'svc-card';
    const bullets = (sv.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    card.innerHTML = `<div class="svc-ic">${escapeHtml(sv.icon || '')}</div><h3>${biTitle(sv.title_en, sv.title_ar, sv.title)}</h3><p>${escapeHtml(sv.description || '')}</p><ul>${bullets}</ul>`;
    sg.appendChild(card);
  });

  // categories
  const cg = document.getElementById('categoriesGrid');
  cg.innerHTML = '';
  (d.categories || []).forEach(c => {
    const det = document.createElement('details');
    det.className = 'cat';
    const subs = (c.subitems || []).map(s => `<li>${biTitle(s.text_en, s.text_ar, s.text)}</li>`).join('');
    det.innerHTML = `<summary><span class="cat-head"><span class="ic">${escapeHtml(c.icon || '')}</span><h3>${biTitle(c.title_en, c.title_ar, c.title)}</h3></span><span class="chev">▾</span></summary>
      <p>${escapeHtml(c.description || '')}</p>
      <ul class="sublist">${subs}</ul>`;
    cg.appendChild(det);
  });

  // process
  const ps = document.getElementById('processSteps');
  ps.innerHTML = '';
  (d.process_steps || []).forEach(st => {
    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML = `<div class="step-num">${escapeHtml(st.num || '')}</div><h4>${biTitle(st.title_en, st.title_ar, st.title)}</h4><p>${escapeHtml(st.body || '')}</p>`;
    ps.appendChild(div);
  });

  // why
  const wg = document.getElementById('whyGrid');
  wg.innerHTML = '';
  (d.why_items || []).forEach(it => {
    const div = document.createElement('div');
    div.className = 'why-item';
    div.innerHTML = `<div class="why-ic">${escapeHtml(it.icon || '')}</div><div><h4>${biTitle(it.title_en, it.title_ar, it.title)}</h4><p>${escapeHtml(it.body || '')}</p></div>`;
    wg.appendChild(div);
  });

  // standards
  const stdg = document.getElementById('standardsGrid');
  stdg.innerHTML = '';
  (d.standards || []).forEach(st => {
    const div = document.createElement('div');
    div.className = 'std';
    div.innerHTML = `<div class="ic">${escapeHtml(st.icon || '')}</div><h4>${biTitle(st.title_en, st.title_ar, st.title)}</h4><p>${escapeHtml(st.body || '')}</p>`;
    stdg.appendChild(div);
  });

  // segments
  const segg = document.getElementById('segmentsGrid');
  segg.innerHTML = '';
  (d.segments || []).forEach(sg => {
    const div = document.createElement('div');
    div.className = 'seg';
    div.innerHTML = `<div class="ic">${escapeHtml(sg.icon || '')}</div><h3>${biTitle(sg.title_en, sg.title_ar, sg.title)}</h3><p>${escapeHtml(sg.body || '')}</p>`;
    segg.appendChild(div);
  });

  // models
  const mg = document.getElementById('modelsGrid');
  mg.innerHTML = '';
  (d.models || []).forEach(m => {
    const div = document.createElement('div');
    div.className = 'model';
    div.innerHTML = `<div class="ic">${escapeHtml(m.icon || '')}</div><div><h4>${biTitle(m.title_en, m.title_ar, m.title)}</h4><p>${escapeHtml(m.body || '')}</p></div>`;
    mg.appendChild(div);
  });

  // logos
  const lr = document.getElementById('logoRow');
  lr.innerHTML = '';
  (d.partners || []).forEach(p => {
    const b = document.createElement('div');
    b.className = 'logo-box';
    b.textContent = p.name_en || p.name || p.name_ar || '';
    b.title = p.industry || '';
    lr.appendChild(b);
  });
  // cases
  const cg2 = document.getElementById('casesGrid');
  cg2.innerHTML = '';
  (d.cases || []).forEach(c => {
    const div = document.createElement('div');
    div.className = 'case';
    div.innerHTML = `<span class="tag">${biTitle(c.tag_en, c.tag_ar, c.tag || 'Case Study')}</span><h4>${biTitle(c.title_en, c.title_ar, c.title)}</h4><p>${escapeHtml(c.body || '')}</p>`;
    cg2.appendChild(div);
  });

  // experiences
  const expg = document.getElementById('experiencesGrid');
  if (expg) {
    expg.innerHTML = '';
    (d.experiences || []).forEach(x => {
      const div = document.createElement('div');
      div.className = 'exp-card';
      div.innerHTML = `<div class="exp-head"><div class="exp-ic">${escapeHtml(x.icon || '💼')}</div><div><div class="exp-title">${biTitle(x.title_en, x.title_ar, x.title)}</div><div class="exp-meta">${escapeHtml(x.organization || '')} ${x.period ? '• ' + escapeHtml(x.period) : ''}</div></div></div><div class="exp-body">${escapeHtml(x.body || '')}</div>`;
      expg.appendChild(div);
    });
  }
  // partners
  const partg = document.getElementById('partnersGrid');
  if (partg) {
    partg.innerHTML = '';
    (d.partners || []).forEach(p => {
      const div = document.createElement('div');
      div.className = 'partner-card';
      const lbl = p.status === 'current' ? 'حالي' : (p.status === 'previous' ? 'سابق' : p.status);
      const cls = p.status === 'current' ? 'current' : 'previous';
      div.innerHTML = `<div class="partner-name">${biTitle(p.name_en, p.name_ar, p.name)}</div><div class="partner-meta">${escapeHtml(p.industry || '')}</div><div class="partner-meta">${escapeHtml(p.note || '')}</div><span class="partner-status ${cls}">${escapeHtml(lbl)}</span>`;
      partg.appendChild(div);
    });
  }

  // contact fields
  const cf = document.getElementById('contactFields');
  cf.innerHTML = `<h3 style="margin-bottom:16px;font-size:18px;font-weight:800">Contact details</h3>`;
  (d.contact_fields || []).forEach(f => {
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `<label>${biTitle(f.label_en, f.label_ar, f.label)}</label><div class="val">${escapeHtml(f.value || '')}</div>`;
    cf.appendChild(field);
  });
  const social = document.createElement('div');
  social.className = 'social';
  const wa = String(s.whatsapp_number || '').replace(/\D/g, '');
  social.innerHTML = `<a href="${wa ? 'https://wa.me/' + wa : '#'}" target="_blank" rel="noopener">WhatsApp</a>` +
    `<a href="${escapeHtml(s.linkedin_url || '#')}" target="_blank" rel="noopener">LinkedIn</a>` +
    `<a href="mailto:${escapeHtml(s.company_email || '')}">Email</a>`;
  cf.appendChild(social);
}

document.getElementById('cfSend').addEventListener('click', async () => {
  const payload = {
    name: document.getElementById('cfName').value,
    company: document.getElementById('cfCompany').value,
    email: document.getElementById('cfEmail').value,
    phone: document.getElementById('cfPhone').value,
    message: document.getElementById('cfMessage').value,
  };
  const status = document.getElementById('cfStatus');
  try {
    const res = await fetch('/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      status.innerHTML = '✅ تم إرسال الطلب. سنعود إليك قريباً.';
      status.style.color = '#bbf7d0';
      // Reset form fields
      ['cfName','cfCompany','cfEmail','cfPhone','cfMessage'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    } else { status.textContent = '❌ فشل الإرسال.'; status.style.color = '#fecaca'; }
  } catch (e) { status.textContent = '❌ خطأ في الشبكة.'; status.style.color = '#fecaca'; }
});
document.getElementById('year').textContent = new Date().getFullYear();
const menuBtn = document.getElementById('menuBtn');
const mainNav = document.getElementById('mainNav');
if (menuBtn && mainNav) {
  menuBtn.addEventListener('click', () => mainNav.classList.toggle('open'));
  mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mainNav.classList.remove('open')));
}

load();
