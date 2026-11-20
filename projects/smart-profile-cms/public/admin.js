const API = '';
const PREFIX = window.__DEMO_PREFIX__ || '';
let TOKEN = localStorage.getItem('sag_token') || '';

function api(path, opts = {}) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(PREFIX + API + path, opts);
}

function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---------- Modal ----------
const modalRoot = document.getElementById('modalRoot');
function openModal(title, bodyHtml, onSave) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" id="modalClose">✕</button></div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-foot">
          <button class="btn btn-ghost-dark" id="modalCancel">إلغاء</button>
          <button class="btn btn-primary-dark" id="modalSave">حفظ</button>
        </div>
      </div>
    </div>`;
  const close = () => { modalRoot.innerHTML = ''; };
  document.getElementById('modalClose').onclick = close;
  document.getElementById('modalCancel').onclick = close;
  document.getElementById('modalBackdrop').onclick = (e) => { if (e.target.id === 'modalBackdrop') close(); };
  document.getElementById('modalSave').onclick = async () => {
    try { await onSave(); close(); } catch (e) { alert(e.message || e); }
  };
}

function fieldHtml(f, item) {
  const v = item ? item[f.name] : (f.default || '');
  if (f.type === 'textarea') {
    return `<label>${esc(f.label)} <textarea class="m-input" data-field="${f.name}" rows="4">${esc(v ?? '')}</textarea></label>`;
  }
  if (f.type === 'bullets') {
    const arr = Array.isArray(v) ? v : [];
    return `<label>${esc(f.label)} <textarea class="m-input" data-field="${f.name}" rows="6" placeholder="بند واحد في كل سطر">${esc(arr.join('\n'))}</textarea></label>`;
  }
  if (f.type === 'select') {
    const opts = (f.options || []).map(o => `<option value="${esc(o.value)}" ${String(v)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('');
    return `<label>${esc(f.label)} <select class="m-input" data-field="${f.name}">${opts}</select></label>`;
  }
  if (f.type === 'number') {
    return `<label>${esc(f.label)} <input class="m-input" type="number" data-field="${f.name}" value="${esc(v ?? '')}" /></label>`;
  }
  return `<label>${esc(f.label)} <input class="m-input" type="text" data-field="${f.name}" value="${esc(v ?? '')}" /></label>`;
}

function collectForm(fields) {
  const out = {};
  fields.forEach(f => {
    const elx = document.querySelector(`[data-field="${f.name}"]`);
    if (!elx) return;
    let val = elx.value;
    if (f.type === 'number') val = val === '' ? null : Number(val);
    if (f.type === 'bullets') val = val.split('\n').map(x=>x.trim()).filter(Boolean);
    out[f.name] = val;
  });
  return out;
}

// ---------- Generic entity panel ----------
async function renderEntity(container, cfg) {
  const wrap = document.getElementById(container);
  wrap.innerHTML = `<div class="panel-toolbar"><h2>${esc(cfg.title)}</h2><button class="btn btn-primary-dark" id="add-${cfg.key}">+ إضافة</button></div><div id="list-${cfg.key}" class="entity-list">…</div>`;
  async function refresh() {
    const res = await api(cfg.endpoint);
    const rows = await res.json();
    const list = document.getElementById('list-' + cfg.key);
    list.innerHTML = '';
    if (!rows || !rows.length) { list.innerHTML = '<div class="empty">لا توجد بيانات.</div>'; return; }
    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'entity-item';
      const __title = row[cfg.titleField] || row.title_en || row.title || row.title_ar || row.name_en || row.name || row.name_ar || row.label_en || row.label || row.label_ar || row.text_en || row.text || row.text_ar || row.key || ('#' + row.id);
      item.innerHTML = `
        <div class="entity-main">
          <div class="entity-title">${esc(__title)}</div>
          <div class="entity-sub">${cfg.subtitle ? cfg.subtitle(row) : esc(row.description || row.body || '')}</div>
        </div>
        <div class="entity-actions">
          <button data-edit="${row.id}" class="btn-sm">تعديل</button>
          <button data-del="${row.id}" class="btn-sm btn-danger">حذف</button>
        </div>`;
      list.appendChild(item);
      item.querySelector(`[data-edit="${row.id}"]`).onclick = () => {
        openModal('تعديل ' + (row[cfg.titleField||'title'] || ''), cfg.fields.map(f=>fieldHtml(f,row)).join(''), async () => {
          const data = collectForm(cfg.fields);
          await api(cfg.endpoint + '/' + row.id, { method:'PUT', body: data });
          await refresh();
        });
      };
      item.querySelector(`[data-del="${row.id}"]`).onclick = async () => {
        if (!confirm('حذف this item?')) return;
        await api(cfg.endpoint + '/' + row.id, { method:'DELETE' });
        await refresh();
      };
    });
  }
  document.getElementById('add-' + cfg.key).onclick = () => {
    openModal('إضافة ' + cfg.title, cfg.fields.map(f=>fieldHtml(f,null)).join(''), async () => {
      const data = collectForm(cfg.fields);
      await api(cfg.endpoint, { method:'POST', body: data });
      await refresh();
    });
  };
  await refresh();
}

// ---------- Panels ----------
const panels = {
  dashboard: async (el) => {
    el.innerHTML = '<h2>Dashboard</h2><p style="margin-bottom:16px;color:#94a3b8">ملخص المحتوى الحالي — يمكنك التعديل من الأقسام في القائمة الجانبية.</p><div id="dashStats" class="dash-stats">جاري تحميل البيانات…</div>';
    const defs = [
      ['الخدمات','/api/services'],['الفئات','/api/categories'],['العناصر الفرعية','/api/subitems'],
      ['النبذة','/api/about-items'],['الإحصائيات','/api/hero-stats'],['دراسات الحالة','/api/cases'],
      ['الشركاء','/api/partners'],['الرسائل','/api/messages'],['الإعدادات','/api/settings']
    ];
    const results = await Promise.all(defs.map(async ([label, path]) => {
      try {
        const r = await api(path);
        if (!r.ok) return [label, 0];
        const d = await r.json();
        const n = Array.isArray(d) ? d.length : (d && typeof d === 'object' ? Object.keys(d).length : 0);
        return [label, n];
      } catch { return [label, 0]; }
    }));
    const wrap = document.getElementById('dashStats');
    if (!wrap) return;
    wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">${results.map(([label,n]) => `<div class="card-admin" style="padding:14px;text-align:center"><div style="font-size:28px;font-weight:700">${n}</div><div style="color:#94a3b8;font-size:13px">${esc(label)}</div></div>`).join('')}</div>
      <p style="margin-top:14px;color:#94a3b8;font-size:13px">الموقع العام: <a href="${(window.__DEMO_PREFIX__||'') + '/site'}" target="_blank" style="color:#60a5fa">فتح صفحة الملف التعريفي</a></p>`;
  },
  settings: async (el) => {
    el.innerHTML = '<h2>Settings</h2><div id="settingsForm" class="settings-grid">Loading…</div><div class="panel-foot"><button class="btn btn-primary-dark" id="saveSettings">حفظ الإعدادات</button><button class="btn btn-ghost-dark" id="testEmailBtn" type="button">Test Email</button><button class="btn btn-ghost-dark" id="testWhatsAppBtn" type="button">Test WhatsApp</button></div>';
    const res = await api('/api/settings');
    const settings = await res.json();
    // Dedicated logo uploader
    const logoCard = document.createElement('div');
    logoCard.className = 'card-admin';
    logoCard.style.marginBottom = '16px';
    logoCard.innerHTML = `
      <h3>Logo (Logo URL)</h3>
      <div id="logoPreview" style="margin:10px 0;min-height:60px;display:flex;align-items:center;justify-content:center;background:#020617;border:1px dashed #334155;border-radius:12px;padding:12px">
        ${settings.logo_url ? `<img src="${settings.logo_url}" alt="logo" style="max-width:160px;max-height:80px;object-fit:contain" />` : '<span style="color:#64748b">No logo uploaded</span>'}
      </div>
      <label>Select image file (max 500KB recommended)</label>
      <input type="file" id="logoFile" accept="image/*" style="display:none" />
      <label for="logoFile" class="file-picker">
        <span class="file-picker-btn">اختيار صورة</span>
        <span class="file-picker-name" id="logoFileName">لم يتم اختيار ملف</span>
      </label>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary-dark" id="saveLogo" type="button">حفظ الشعار</button>
        <button class="btn btn-danger" id="clearLogo" type="button">حذف</button>
      </div>
    `;
    el.insertBefore(logoCard, el.querySelector('#settingsForm'));
    let pendingLogo = settings.logo_url || '';
    const fileInput = logoCard.querySelector('#logoFile');
    const fileNameEl = logoCard.querySelector('#logoFileName');
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) { if (fileNameEl) fileNameEl.textContent = 'لم يتم اختيار ملف'; return; }
      if (f.size > 1024*1024) { alert('File too large (max 1MB)'); fileInput.value=''; if (fileNameEl) fileNameEl.textContent = 'لم يتم اختيار ملف'; return; }
      if (fileNameEl) fileNameEl.textContent = f.name;
      const reader = new FileReader();
      reader.onload = () => {
        pendingLogo = reader.result;
        const prev = logoCard.querySelector('#logoPreview');
        prev.innerHTML = `<img src="${pendingLogo}" alt="logo" style="max-width:160px;max-height:80px;object-fit:contain" />`;
      };
      reader.readAsDataURL(f);
    };
    logoCard.querySelector('#saveLogo').onclick = async () => {
      await api('/api/settings', { method:'PUT', body: { logo_url: pendingLogo } });
      alert('Logo saved');
    };
    logoCard.querySelector('#clearLogo').onclick = async () => {
      pendingLogo = '';
      await api('/api/settings', { method:'PUT', body: { logo_url: '' } });
      logoCard.querySelector('#logoPreview').innerHTML = '<span style="color:#64748b">No logo uploaded</span>';
      const fn = logoCard.querySelector('#logoFileName');
      if (fn) fn.textContent = 'لم يتم اختيار ملف';
      alert('Logo cleared');
    };

    const form = document.getElementById('settingsForm');
    form.innerHTML = '';
    const keys = Object.keys(settings).filter(k => k !== 'logo_url');
    keys.forEach(k => {
      const div = document.createElement('div');
      div.className = 'field-row';
      div.innerHTML = `<label>${esc(k)}</label><input class="m-input" data-skey="${esc(k)}" value="${esc(settings[k] || '')}" />`;
      form.appendChild(div);
    });
    document.getElementById('saveSettings').onclick = async () => {
      const out = {};
      form.querySelectorAll('[data-skey]').forEach(inp => { out[inp.dataset.skey] = inp.value; });
      await api('/api/settings', { method:'PUT', body: out });
      alert('Saved');
    };
    const testEmailBtn = document.getElementById('testEmailBtn');
    if (testEmailBtn) testEmailBtn.onclick = async () => {
      const r = await api('/api/settings/test-email', { method:'POST' });
      const d = await r.json().catch(()=>({}));
      alert(r.ok ? ('Email OK: ' + JSON.stringify(d)) : ('Email FAILED: ' + (d.error || r.status)));
    };
    const testWhatsAppBtn = document.getElementById('testWhatsAppBtn');
    if (testWhatsAppBtn) testWhatsAppBtn.onclick = async () => {
      const r = await api('/api/settings/test-whatsapp', { method:'POST' });
      const d = await r.json().catch(()=>({}));
      alert(r.ok ? ('WhatsApp OK: ' + JSON.stringify(d)) : ('WhatsApp FAILED: ' + (d.error || r.status)));
    };
  },
  'hero-stats': async (el) => { await renderEntity(el.id, { key:'hero-stats', title:'Hero Stats', endpoint:'/api/hero-stats', titleField:'label', subtitle:(r)=>r.value, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'label', label:'Label (primary)', type:'text'},
    {name:'label_en', label:'Label (English)', type:'text'},
    {name:'label_ar', label:'Label (Arabic)', type:'text'},
    {name:'value', label:'Value', type:'text', required:true},
    {name:'sort_order', label:'Sort order', type:'number'},
  ]}); },
  about: async (el) => { await renderEntity(el.id, { key:'about', title:'About items', endpoint:'/api/about-items', titleField:'text', fields:[
    {name:'text', label:'Text (primary)', type:'textarea'},
    {name:'text_en', label:'Text (English)', type:'textarea'},
    {name:'text_ar', label:'Text (Arabic)', type:'textarea', required:true},
    {name:'sort_order', label:'Sort order', type:'number'},
  ]}); },
  vmv: async (el) => {
    el.innerHTML = '<h2>Vision / Mission / Values</h2><div id="vmvCards" class="vmv-admin"></div><h3 style="margin-top:24px">Values list</h3><div id="valuesWrap"></div>';
    // cards
    const res = await api('/api/vmv'); const rows = await res.json();
    const wrap = document.getElementById('vmvCards');
    wrap.innerHTML = '';
    ['vision','mission','values_card'].forEach(kind => {
      const row = rows.find(r=>r.kind===kind) || { kind, title:'', body:'' };
      const div = document.createElement('div');
      div.className = 'card-admin';
      div.innerHTML = `<h4>${esc(kind)}</h4>
        <label>Title (primary) <input class="m-input" data-vmv="${kind}" data-f="title" value="${esc(row.title)}" /></label>
        <label>Title (English) <input class="m-input" data-vmv="${kind}" data-f="title_en" value="${esc(row.title_en)}" /></label>
        <label>Title (Arabic) <input class="m-input" data-vmv="${kind}" data-f="title_ar" value="${esc(row.title_ar)}" /></label>
        <label>Body <textarea class="m-input" data-vmv="${kind}" data-f="body" rows="3">${esc(row.body)}</textarea></label>
        <button class="btn btn-primary-dark" data-save="${kind}">حفظ</button>`;
      wrap.appendChild(div);
      div.querySelector('[data-save]').onclick = async () => {
        const title = div.querySelector('[data-f="title"]').value;
        const title_en = div.querySelector('[data-f="title_en"]').value;
        const title_ar = div.querySelector('[data-f="title_ar"]').value;
        const body = div.querySelector('[data-f="body"]').value;
        const payload = { kind, title, title_en, title_ar, body };
        if (row.id) await api('/api/vmv/'+row.id, {method:'PUT', body:payload});
        else await api('/api/vmv', {method:'POST', body:payload});
        alert('Saved');
      };
    });
    // values list generic
    await renderEntity('valuesWrap', { key:'values-list', title:'Values list', endpoint:'/api/values-list', titleField:'label', fields:[
      {name:'label', label:'Label (primary)', type:'text'},
      {name:'label_en', label:'Label (English)', type:'text'},
      {name:'label_ar', label:'Label (Arabic)', type:'text'},
      {name:'sort_order', label:'Sort', type:'number'},
    ]});
  },
  services: async (el) => { await renderEntity(el.id, { key:'services', title:'Services', endpoint:'/api/services', titleField:'title', subtitle:(r)=>r.description, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'description', label:'Description', type:'textarea'},
    {name:'bullets', label:'Bullets (one per line)', type:'bullets'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  categories: async (el) => {
    el.innerHTML = '<h2>Categories & Sub-items</h2><div id="catList"></div><div class="panel-toolbar" style="margin-top:16px"><button class="btn btn-primary-dark" id="addCat">+ إضافة تصنيف</button></div>';
    async function refreshCats() {
      const res = await api('/api/categories');
      const cats = await res.json();
      const list = document.getElementById('catList');
      list.innerHTML = '';
      for (const c of cats) {
        const card = document.createElement('div');
        card.className = 'card-admin';
        const subsRes = await api('/api/subitems?category_id=' + c.id);
        const subs = await subsRes.json();
        card.innerHTML = `<div class="cat-admin-head">
            <div><strong>${esc(c.icon || '')} ${esc(c.title)}</strong><div style="font-size:13px;color:#94a3b8">${esc(c.description || '')}</div></div>
            <div>
              <button class="btn-sm" data-editcat="${c.id}">تعديل</button>
              <button class="btn-sm btn-danger" data-delcat="${c.id}">حذف</button>
            </div>
          </div>
          <div class="subitems-admin" id="subs-${c.id}"></div>
          <div class="sub-add">
            <button class="btn-sm" data-addsub="${c.id}">+ add sub-item</button>
          </div>`;
        list.appendChild(card);
        // render subs
        const subsDiv = card.querySelector('#subs-' + c.id);
        subs.forEach(s => {
          const row = document.createElement('div');
          row.className = 'sub-row';
          row.innerHTML = `<span>${esc(s.text)}</span>
            <span><button class="btn-sm" data-editsub="${s.id}">تعديل</button>
            <button class="btn-sm btn-danger" data-delsub="${s.id}">حذف</button></span>`;
          subsDiv.appendChild(row);
          row.querySelector('[data-editsub]').onclick = () => {
            openModal('Edit sub-item', [
              fieldHtml({name:'text',label:'Text (primary)',type:'textarea'}, s),
              fieldHtml({name:'text_en',label:'Text (English)',type:'textarea'}, s),
              fieldHtml({name:'text_ar',label:'Text (Arabic)',type:'textarea'}, s),
            ].join(''), async () => {
              const data = collectForm([{name:'text'},{name:'text_en'},{name:'text_ar'}]);
              await api('/api/subitems/' + s.id, { method:'PUT', body:data });
              await refreshCats();
            });
          };
          row.querySelector('[data-delsub]').onclick = async () => {
            if (!confirm('Delete?')) return;
            await api('/api/subitems/' + s.id, { method:'DELETE' });
            await refreshCats();
          };
        });
        card.querySelector(`[data-editcat="${c.id}"]`).onclick = () => {
          openModal('Edit category', [
            fieldHtml({name:'icon',label:'Icon',type:'text'}, c),
            fieldHtml({name:'title',label:'Title (primary)',type:'text'}, c),
            fieldHtml({name:'title_en',label:'Title (English)',type:'text'}, c),
            fieldHtml({name:'title_ar',label:'Title (Arabic)',type:'text'}, c),
            fieldHtml({name:'description',label:'Description',type:'textarea'}, c),
            fieldHtml({name:'sort_order',label:'Sort',type:'number'}, c),
          ].join(''), async () => {
            const data = collectForm([{name:'icon'},{name:'title'},{name:'title_en'},{name:'title_ar'},{name:'description'},{name:'sort_order',type:'number'}]);
            await api('/api/categories/' + c.id, { method:'PUT', body: data });
            await refreshCats();
          });
        };
        card.querySelector(`[data-delcat="${c.id}"]`).onclick = async () => {
          if (!confirm('Delete category and its sub-items?')) return;
          await api('/api/categories/' + c.id, { method:'DELETE' });
          await refreshCats();
        };
        card.querySelector(`[data-addsub="${c.id}"]`).onclick = async () => {
          openModal('Add sub-item', [
            fieldHtml({name:'text',label:'Text (primary)',type:'textarea'}, null),
            fieldHtml({name:'text_en',label:'Text (English)',type:'textarea'}, null),
            fieldHtml({name:'text_ar',label:'Text (Arabic)',type:'textarea'}, null),
          ].join(''), async () => {
            const data = collectForm([{name:'text'},{name:'text_en'},{name:'text_ar'}]);
            await api('/api/subitems', { method:'POST', body:{ category_id: c.id, ...data } });
            await refreshCats();
          });
        };
      }
    }
    document.getElementById('addCat').onclick = () => {
      openModal('Add category', [
        fieldHtml({name:'icon',label:'Icon',type:'text'}, null),
        fieldHtml({name:'title',label:'Title (primary)',type:'text'}, null),
        fieldHtml({name:'title_en',label:'Title (English)',type:'text'}, null),
        fieldHtml({name:'title_ar',label:'Title (Arabic)',type:'text'}, null),
        fieldHtml({name:'description',label:'Description',type:'textarea'}, null),
      ].join(''), async () => {
        const data = collectForm([{name:'icon'},{name:'title'},{name:'title_en'},{name:'title_ar'},{name:'description'}]);
        await api('/api/categories', { method:'POST', body: data });
        await refreshCats();
      });
    };
    await refreshCats();
  },
  process: async (el) => { await renderEntity(el.id, { key:'process', title:'Process steps', endpoint:'/api/process-steps', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'num', label:'Num', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'text'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  why: async (el) => { await renderEntity(el.id, { key:'why', title:'Why items', endpoint:'/api/why-items', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  standards: async (el) => { await renderEntity(el.id, { key:'standards', title:'Standards', endpoint:'/api/standards', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'text'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  segments: async (el) => { await renderEntity(el.id, { key:'segments', title:'Segments', endpoint:'/api/segments', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  models: async (el) => { await renderEntity(el.id, { key:'models', title:'Engagement models', endpoint:'/api/models', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  cases: async (el) => { await renderEntity(el.id, { key:'cases', title:'Cases', endpoint:'/api/cases', titleField:'title', subtitle:(r)=>r.body, fields:[
    {name:'tag', label:'Tag (primary)', type:'text'},
    {name:'tag_en', label:'Tag (English)', type:'text'},
    {name:'tag_ar', label:'Tag (Arabic)', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'body', label:'Body', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  contact: async (el) => { await renderEntity(el.id, { key:'contact-fields', title:'Contact fields', endpoint:'/api/contact-fields', titleField:'label', subtitle:(r)=>r.value, fields:[
    {name:'label', label:'Label (primary)', type:'text'},
    {name:'label_en', label:'Label (English)', type:'text'},
    {name:'label_ar', label:'Label (Arabic)', type:'text', required:true},
    {name:'value', label:'Value', type:'text'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  experiences: async (el) => { await renderEntity(el.id, { key:'experiences', title:'Experiences', endpoint:'/api/experiences', titleField:'title', subtitle:(r)=> (r.organization||'') + (r.period ? ' • '+r.period : ''), fields:[
    {name:'icon', label:'Icon', type:'text'},
    {name:'title', label:'Title (primary)', type:'text'},
    {name:'title_en', label:'Title (English)', type:'text'},
    {name:'title_ar', label:'Title (Arabic)', type:'text', required:true},
    {name:'organization', label:'Organization', type:'text'},
    {name:'period', label:'Period', type:'text'},
    {name:'body', label:'Body', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  partners: async (el) => { await renderEntity(el.id, { key:'partners', title:'Partners (previous/current)', endpoint:'/api/partners', titleField:'name', subtitle:(r)=> (r.industry||'') + ' • ' + (r.status||''), fields:[
    {name:'name', label:'Name (primary)', type:'text'},
    {name:'name_en', label:'Name (English)', type:'text'},
    {name:'name_ar', label:'Name (Arabic)', type:'text', required:true},
    {name:'status', label:'Status', type:'select', options:[{value:'current',label:'current'},{value:'previous',label:'previous'}]},
    {name:'industry', label:'Industry', type:'text'},
    {name:'note', label:'Note', type:'textarea'},
    {name:'sort_order', label:'Sort', type:'number'},
  ]}); },
  messages: async (el) => {
    el.innerHTML = '<h2>Messages</h2><div id="msgList" class="entity-list">Loading…</div>';
    const res = await api('/api/messages'); const rows = await res.json();
    const list = document.getElementById('msgList');
    list.innerHTML = '';
    if (!rows.length) { list.innerHTML = '<div class="empty">No messages.</div>'; return; }
    rows.forEach(m => {
      const item = document.createElement('div');
      item.className = 'entity-item';
      item.innerHTML = `
        <div class="entity-main">
          <div class="entity-title">${esc(m.name || '(no name)')} — ${esc(m.company || '')}</div>
          <div class="entity-sub">${esc(m.email || '')} ${m.phone ? '• '+esc(m.phone):''} • ${esc(m.created_at || '')}</div>
          <div style="margin-top:6px">${esc(m.message || '')}</div>
        </div>
        <div class="entity-actions">
          <select data-status="${m.id}" class="m-input" style="width:auto">
            <option ${m.status==='new'?'selected':''} value="new">new</option>
            <option ${m.status==='read'?'selected':''} value="read">read</option>
            <option ${m.status==='archived'?'selected':''} value="archived">archived</option>
          </select>
          ${m.email ? `<a class="btn-sm" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: Your inquiry to SMART ACTIVITY GROUP')}&body=${encodeURIComponent('Hello '+(m.name||'')+',\\n\\nRegarding your message:\\n'+(m.message||'')+'\\n\\nBest regards,\\nSMART ACTIVITY GROUP')}" style="text-decoration:none">Reply Email</a>` : ''}
          ${m.phone ? `<a class="btn-sm" target="_blank" href="https://wa.me/${String(m.phone).replace(/\\D/g,'')}?text=${encodeURIComponent('Hello '+(m.name||'')+', regarding your inquiry: '+(m.message||''))}" style="text-decoration:none">Reply WhatsApp</a>` : ''}
          <button class="btn-sm btn-danger" data-del="${m.id}">حذف</button>
        </div>`;
      list.appendChild(item);
      item.querySelector(`[data-status="${m.id}"]`).onchange = (e) => api('/api/messages/'+m.id, { method:'PATCH', body:{status:e.target.value} });
      item.querySelector(`[data-del="${m.id}"]`).onclick = async () => { if(!confirm('Delete?'))return; await api('/api/messages/'+m.id,{method:'DELETE'}); await panels.messages(el); };
    });
  },
};

// ---------- Auth flow ----------
const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
async function trySession() {
  if (!TOKEN) return false;
  const res = await api('/api/auth/me');
  if (!res.ok) { TOKEN=''; localStorage.removeItem('sag_token'); return false; }
  return true;
}
async function login() {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  const res = await fetch(PREFIX + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
  if (!res.ok) { err.textContent = 'بيانات غير صحيحة'; return; }
  const data = await res.json();
  TOKEN = data.token; localStorage.setItem('sag_token', TOKEN);
  await bootAdmin();
}
document.getElementById('loginBtn').onclick = login;
const viewSiteBtn = document.getElementById('viewSiteBtn');
if (viewSiteBtn) {
  viewSiteBtn.onclick = () => {
    window.location.href = (window.__DEMO_PREFIX__ || '') + '/site';
  };
}
document.getElementById('logoutBtn').onclick = async () => {
  await api('/api/auth/logout', { method:'POST' });
  TOKEN=''; localStorage.removeItem('sag_token');
  location.reload();
};

const LABELS = {
  dashboard:'Dashboard', settings:'Settings', 'hero-stats':'Hero stats', about:'About', vmv:'Vision/Mission/Values',
  services:'Services', categories:'Categories & sub-items', process:'Process', why:'Why us', standards:'Standards',
  segments:'Segments', models:'Models', cases:'Cases', contact:'Contact fields', experiences:'Experiences', partners:'Partners', messages:'Messages'
};
const nav = document.getElementById('sideNav');
Object.keys(panels).forEach(key => {
  const btn = document.createElement('button');
  btn.className = 'side-link';
  btn.textContent = LABELS[key] || key;
  btn.dataset.panel = key;
  btn.onclick = async () => {
    document.querySelectorAll('.side-link').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('contentArea');
    content.innerHTML = '<div class="loading">Loading…</div>';
    await panels[key](content);
  };
  nav.appendChild(btn);
});

async function bootAdmin() {
  if (!(await trySession())) { loginScreen.style.display='flex'; adminApp.style.display='none'; return; }
  loginScreen.style.display='none'; adminApp.style.display='flex';
  // load first panel
  document.querySelector('[data-panel="dashboard"]').click();
}

bootAdmin();
