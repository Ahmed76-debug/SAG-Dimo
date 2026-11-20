/* ============================================================
   طلباتك — Admin core: auth, api, router, modal, table, form
   ============================================================ */
(function () {
  "use strict";
  const TB = window.TB = {};
  TB.user = null;
  TB.token = localStorage.getItem("tb_admin_token") || "";
  window.VIEWS = window.VIEWS || {};
  window.registerView = (name, fn) => { window.VIEWS[name] = fn; };

  /* ---------------- utils ---------------- */
  const $ = TB.$ = s => document.querySelector(s);
  const $$ = TB.$$ = s => Array.from(document.querySelectorAll(s));
  TB.el = (tag, attrs = {}, html) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  TB.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  TB.money = n => (Number(n) || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2, minimumFractionDigits: 0 }) + " ج.م";
  TB.num = n => (Number(n) || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
  TB.date = s => s ? new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—";
  TB.dt = s => s ? new Date(s).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  TB.today = () => new Date().toISOString().slice(0, 10);
  TB.daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  TB.can = (perm, action) => {
    const u = TB.user;
    if (!u) return false;
    if (u.role === "admin") return true;
    return ((u._perms || {})[perm] || []).includes(action || "view");
  };

  /* ---------------- theme ---------------- */
  TB.THEMES = [
    { id:'light',        name:'فاتح (افتراضي)', mode:'light', colors:{ bg:'#f3f7f6', surface:'#ffffff', brand:'#0f766e', accent:'#14b8a6' } },
    { id:'light-warm',   name:'فاتح دافئ',      mode:'light', colors:{ bg:'#fbf6ee', surface:'#fffdf8', brand:'#b45309', accent:'#f59e0b' } },
    { id:'light-sea',    name:'فاتح بحري',      mode:'light', colors:{ bg:'#eff6ff', surface:'#ffffff', brand:'#1d4ed8', accent:'#0ea5e9' } },
    { id:'dark',         name:'داكن (افتراضي)', mode:'dark',  colors:{ bg:'#071311', surface:'#102220', brand:'#14b8a6', accent:'#2dd4bf' } },
    { id:'dark-blue',    name:'داكن أزرق',      mode:'dark',  colors:{ bg:'#08101d', surface:'#111a2e', brand:'#3b82f6', accent:'#22d3ee' } },
    { id:'dark-forest',  name:'داكن غابات',     mode:'dark',  colors:{ bg:'#08130d', surface:'#112016', brand:'#22c55e', accent:'#84cc16' } },
  ];
  TB.setTheme = t => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('tb_theme', t);
    const b = $('#theme-btn');
    if (b) b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/></svg>';
  };
  function tbThemeCard(th, cur, onPick) {
    const c = th.colors || {};
    const btn = TB.el('button', { class: 'tb-theme-card' + (th.id===cur ? ' active' : ''), 'data-th': th.id, type: 'button', title: th.name });
    btn.innerHTML = '<span class="tb-tc-preview" style="--p-bg:'+c.bg+';--p-surface:'+c.surface+';--p-brand:'+c.brand+';--p-accent:'+c.accent+'">'+
      '<span class="tb-tc-side"></span>'+
      '<span class="tb-tc-main"><span class="tb-tc-head"></span><span class="tb-tc-line w70"></span><span class="tb-tc-line w45"></span><span class="tb-tc-chips"><i style="background:var(--p-brand)"></i><i style="background:var(--p-accent)"></i><i style="background:var(--p-surface);border:1px solid rgba(128,128,128,.25)"></i></span></span>'+
      '<span class="tb-tc-check">✓</span></span>'+
      '<span class="tb-tc-name">'+TB.esc(th.name)+'<span class="tb-tc-mode">'+(th.mode==='dark'?'داكن':'فاتح')+'</span></span>';
    btn.onclick = () => onPick(th.id, btn);
    return btn;
  }
  TB.openThemePicker = () => {
    const cur = document.documentElement.getAttribute('data-theme') || localStorage.getItem('tb_theme') || 'light';
    const wrap = TB.el('div', { class: 'tb-theme-gallery' });
    const lights = TB.THEMES.filter(t=>t.mode==='light');
    const darks = TB.THEMES.filter(t=>t.mode==='dark');
    const mkGroup = (title, arr) => {
      const sec = TB.el('section', { class: 'tb-tg-group' });
      sec.innerHTML = '<div class="tb-tg-head"><span class="tb-tg-dot '+(arr[0]&&arr[0].mode)+'"></span><h4>'+TB.esc(title)+'</h4><span class="tb-tg-count">'+arr.length+'</span></div>';
      const grid = TB.el('div', { class: 'tb-theme-grid' });
      arr.forEach(th => grid.appendChild(tbThemeCard(th, cur, (id, btn)=>{ TB.setTheme(id); grid.parentNode.parentNode.querySelectorAll('.tb-theme-card').forEach(x=>x.classList.toggle('active', x.dataset.th===id)); })));
      sec.appendChild(grid); wrap.appendChild(sec);
    };
    mkGroup('الثيمات الفاتحة', lights);
    mkGroup('الثيمات الداكنة', darks);
    TB.modal('معرض الثيمات', wrap, null);
  };
  TB.toggleTheme = () => TB.openThemePicker();


  /* ---------------- api ---------------- */
  TB.api = async (path, opts = {}) => {
    const res = await fetch("/api/" + path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(TB.token ? { Authorization: "Bearer " + TB.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = (data && data.error) || "تعذر إتمام العملية";
      if (res.status === 401 && TB.token) { TB.logout(true); }
      throw new Error(msg);
    }
    return data;
  };

  /* ---------------- toast ---------------- */
  TB.toast = (msg, type = "") => {
    const t = TB.el("div", { class: "toast " + type }, TB.esc(msg));
    $("#toast-root").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".4s"; setTimeout(() => t.remove(), 400); }, 2800);
  };

  /* ---------------- modal ---------------- */
  TB.modal = (title, bodyEl, footEl, opts = {}) => {
    const back = TB.el("div", { class: "modal-backdrop" });
    const m = TB.el("div", { class: "modal" + (opts.wide ? " wide" : "") });
    m.appendChild(TB.el("div", { class: "modal-head" },
      `<h3 class="card-title">${title}</h3><button class="btn btn-ghost btn-icon">✕</button>`));
    const body = TB.el("div", { class: "modal-body" });
    body.appendChild(bodyEl);
    m.appendChild(body);
    if (footEl) m.appendChild(TB.el("div", { class: "modal-foot" })).appendChild(footEl);
    back.appendChild(m);
    back.addEventListener("click", e => { if (e.target === back && !opts.sticky) back.remove(); });
    m.querySelector(".modal-head button").addEventListener("click", () => back.remove());
    $("#modal-root").appendChild(back);
    return { close: () => back.remove(), body, root: back };
  };
  TB.confirm = (msg, onYes, danger = true) => {
    const foot = TB.el("div", { class: "flex" });
    const yes = TB.el("button", { class: danger ? "btn btn-danger" : "btn btn-primary" }, "نعم، متابعة");
    const no = TB.el("button", { class: "btn" }, "إلغاء");
    foot.append(yes, no);
    const md = TB.modal("تأكيد العملية", TB.el("div", {}, `<p>${TB.esc(msg)}</p>`), foot);
    no.onclick = () => md.close();
    yes.onclick = async () => {
      yes.disabled = true;
      try { await onYes(); md.close(); } catch (e) { TB.toast(e.message, "error"); yes.disabled = false; }
    };
  };

  /* ---------------- options cache ---------------- */
  const optCache = {};
  TB.options = async of => {
    if (!optCache[of]) optCache[of] = await TB.api("options?of=" + of);
    return optCache[of];
  };
  TB.clearOptions = () => Object.keys(optCache).forEach(k => delete optCache[k]);

  /* ---------------- table renderer ---------------- */
  TB.table = (rows, columns, opts = {}) => {
    const wrap = TB.el("div", { class: "table-wrap card pad-0" });
    if (!rows.length) {
      wrap.appendChild(TB.el("div", { class: "empty" }, `<span class="emoji">${opts.emptyIcon || "📭"}</span>${opts.emptyText || "لا توجد بيانات بعد"}`));
      return wrap;
    }
    const t = TB.el("table", { class: "table" });
    t.appendChild(TB.el("thead", {}, "<tr>" + columns.map(c => `<th>${TB.esc(c.label)}</th>`).join("") + "</tr>"));
    const tb = TB.el("tbody");
    for (const r of rows) {
      const tr = TB.el("tr");
      if (opts.onRow) { tr.style.cursor = "pointer"; tr.addEventListener("click", e => { if (!e.target.closest("button,a,select,input")) opts.onRow(r); }); }
      for (const c of columns) {
        const td = TB.el("td", { "data-label": c.label });
        const v = c.render ? c.render(r) : r[c.key];
        if (v === null || v === undefined || v === "") td.innerHTML = '<span class="muted">—</span>';
        else if (v instanceof Node) td.appendChild(v);
        else if (typeof v === "string" && v.startsWith("<")) td.innerHTML = v;
        else td.textContent = v;
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  };

  /* ---------------- form renderer ---------------- */
  const IMG_MAX = 1400;
  TB.readFileImage = file => new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, IMG_MAX / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(rd.result);
      img.src = rd.result;
    };
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });

  TB.buildForm = async (fields, values = {}) => {
    const form = TB.el("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px" });
    const inputs = {};
    for (const f of fields) {
      const val = values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : (typeof f.default === "function" ? f.default() : (f.default ?? ""));
      let box;
      const label = `<label>${TB.esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>`;
      switch (f.type) {
        case "textarea":
          box = TB.el("textarea", { class: "input" }); box.value = val || ""; break;
        case "number":
          box = TB.el("input", { class: "input", type: "number", step: "any" }); box.value = val === "" ? "" : val; break;
        case "date":
          box = TB.el("input", { class: "input", type: "date" }); box.value = (val || "").slice(0, 10); break;
        case "datetime":
          box = TB.el("input", { class: "input", type: "datetime-local" }); box.value = val ? String(val).slice(0, 16) : ""; break;
        case "password":
          box = TB.el("input", { class: "input", type: "password", placeholder: "اتركه فارغاً للإبقاء" }); box.value = ""; break;
        case "switch": {
          box = TB.el("label", { class: "switch" });
          const cb = TB.el("input", { type: "checkbox" }); cb.checked = !!Number(val);
          box.append(cb, TB.el("span", { class: "track" }));
          inputs[f.name] = { get: () => cb.checked ? 1 : 0, el: box };
          break;
        }
        case "select": {
          box = TB.el("select", { class: "input" });
          box.appendChild(TB.el("option", { value: "" }, "— اختر —"));
          const opts = f.options || (await TB.options(f.resource)).map(r => [r.id, r[f.label_field || "name"]]);
          for (const [v, l] of opts) box.appendChild(TB.el("option", { value: v }, TB.esc(l)));
          box.value = val === null ? "" : String(val || "");
          break;
        }
        case "dynamic_select": {
          box = TB.el("select", { class: "input" });
          box.appendChild(TB.el("option", { value: "" }, "— اختر —"));
          const src = { customer: "customers", supplier: "suppliers", pilot: "pilots", other: null }[values.party_type] || "customers";
          if (src) for (const r of await TB.options(src)) box.appendChild(TB.el("option", { value: r.id }, TB.esc(r.name)));
          box.value = val === null ? "" : String(val || "");
          inputs[f.name] = { get: () => box.value || null, el: box, refresh: src => { box.innerHTML = ""; } };
          break;
        }
        case "image": {
          box = TB.el("div", { class: "imgup" });
          let cur = val || "";
          const prev = TB.el("div", { class: "imgup-prev" });
          const img = TB.el("img", { class: "imgup-img", alt: "معاينة" });
          const ph = TB.el("div", { class: "imgup-ph" }, `<span class="imgup-ic">🖼️</span><span>لا توجد صورة</span>`);
          prev.append(img, ph);
          const meta = TB.el("div", { class: "imgup-meta" });
          const fname = TB.el("div", { class: "imgup-name" }, cur ? "الصورة الحالية" : "لم يتم اختيار صورة");
          const fsize = TB.el("div", { class: "imgup-hint" }, "PNG · JPG · WEBP · SVG — حتى ٢ ميجابايت");
          meta.append(fname, fsize);

          const inp = TB.el("input", { type: "file", accept: "image/*", class: "imgup-file" });
          const pick = TB.el("button", { type: "button", class: "btn btn-sm btn-soft" }, "📁 اختيار صورة");
          const clear = TB.el("button", { type: "button", class: "btn btn-sm btn-danger" }, "🗑️ إزالة");
          const acts = TB.el("div", { class: "imgup-acts" });
          acts.append(pick, clear);

          const paint = () => {
            if (cur) { img.src = cur; img.style.display = "block"; ph.style.display = "none"; clear.style.display = ""; }
            else { img.removeAttribute("src"); img.style.display = "none"; ph.style.display = ""; clear.style.display = "none"; }
          };
          const takeFile = async file => {
            if (!file) return;
            if (!/^image\//.test(file.type)) { TB.toast("الملف ليس صورة", "error"); return; }
            if (file.size > 2 * 1024 * 1024) { TB.toast("حجم الصورة أكبر من ٢ ميجابايت", "error"); return; }
            fname.textContent = "جارٍ المعالجة…";
            try {
              const durl = await TB.readFileImage(file);
              cur = durl; inputs[f.name].value = durl;
              fname.textContent = file.name.length > 28 ? file.name.slice(0, 28) + "…" : file.name;
              fsize.textContent = (file.size / 1024).toFixed(0) + " ك.ب · " + (file.type.split("/")[1] || "").toUpperCase();
              paint();
            } catch (e) { TB.toast("تعذّرت قراءة الصورة", "error"); fname.textContent = "خطأ في القراءة"; }
          };
          pick.addEventListener("click", () => inp.click());
          inp.addEventListener("change", () => takeFile(inp.files[0]));
          clear.addEventListener("click", () => {
            cur = ""; inputs[f.name].value = ""; inp.value = "";
            fname.textContent = "لم يتم اختيار صورة"; fsize.textContent = "PNG · JPG · WEBP · SVG — حتى ٢ ميجابايت";
            paint();
          });
          // سحب وإفلات
          box.addEventListener("dragover", e => { e.preventDefault(); box.classList.add("drag"); });
          box.addEventListener("dragleave", () => box.classList.remove("drag"));
          box.addEventListener("drop", e => { e.preventDefault(); box.classList.remove("drag"); takeFile(e.dataTransfer.files[0]); });

          const drop = TB.el("div", { class: "imgup-drop" });
          drop.append(
            TB.el("button", { type: "button", class: "btn btn-sm" }, "⤓ اختر من الجهاز"),
            TB.el("span", { class: "imgup-hint" }, "أو اسحب الصورة وأفلتها هنا")
          );
          drop.querySelector("button").addEventListener("click", () => inp.click());

          const wrapL = TB.el("div", { class: "imgup-left" }); wrapL.appendChild(prev);
          const wrapR = TB.el("div", { class: "imgup-right" }); wrapR.append(meta, inp, drop, acts);
          box.append(wrapL, wrapR);
          paint();
          if (cur) { fname.textContent = "الصورة الحالية"; fsize.textContent = "اضغط «إزالة» لحذفها"; }
          inputs[f.name] = { value: cur || "", get: () => inputs[f.name].value, el: box };
          break;
        }
        case "readonly":
          box = TB.el("div", { class: "input", style: "background:var(--surface-2);display:flex;align-items:center" }, TB.esc(val === "" || val === null ? "—" : String(val)));
          break;
        case "permissions": {
          box = TB.el("div", { style: "grid-column:1/-1" });
          box.appendChild(TB.el("label", {}, TB.esc(f.label)));
          const perms = await TB.api("meta/permissions");
          let tpl = { templates: [] };
          try { tpl = await TB.api("meta/role-templates"); } catch (e) { tpl = { templates: [] }; }
          let permsObj = {};
          try { permsObj = typeof val === "string" ? JSON.parse(val || "{}") : (val || {}); } catch { permsObj = {}; }
          const tbl = TB.el("div", { class: "table-wrap", style: "margin-top:8px" });
          const t = TB.el("table", { class: "perm-table" });
          t.innerHTML = "<thead><tr><th>الشاشة</th><th>عرض</th><th>إضافة</th><th>تعديل</th><th>حذف</th></tr></thead>";
          const tbody = TB.el("tbody");
          const checks = [];
          for (const [key, lbl] of perms.keys) {
            const tr = TB.el("tr");
            tr.appendChild(TB.el("td", {}, TB.esc(lbl)));
            for (const act of ["view", "create", "update", "delete"]) {
              const td = TB.el("td");
              const cb = TB.el("input", { type: "checkbox", class: "perm-check" });
              cb.checked = (permsObj[key] || []).includes(act);
              cb.dataset.k = key; cb.dataset.a = act;
              checks.push(cb);
              td.appendChild(cb); tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          t.appendChild(tbody); tbl.appendChild(t); box.appendChild(tbl);

          /* ---- قوالب الأدوار الجاهزة + أدوات سريعة ---- */
          const applyPerms = obj => {
            checks.forEach(cb => { cb.checked = (obj[cb.dataset.k] || []).includes(cb.dataset.a); });
          };
          const countChecked = () => checks.filter(c => c.checked).length;
          const stat = TB.el("span", { class: "muted small" }, `المحدد: ${countChecked()} / ${checks.length}`);
          checks.forEach(c => c.addEventListener("change", () => { stat.textContent = `المحدد: ${countChecked()} / ${checks.length}`; }));

          const bar = TB.el("div", { class: "perm-templates" });
          if (tpl.templates && tpl.templates.length) {
            for (const tp of tpl.templates) {
              bar.appendChild(TB.el("button", {
                type: "button", class: "btn btn-sm btn-soft perm-tpl", title: tp.desc || "",
                onclick: () => {
                  let built = {};
                  try { built = typeof tp.perms === "string" ? JSON.parse(tp.perms) : (tp.perms || {}); } catch (e) { built = {}; }
                  applyPerms(built);
                  stat.textContent = `المحدد: ${countChecked()} / ${checks.length}`;
                  TB.toast(`✅ تم تطبيق قالب «${tp.name}»`, "success");
                }
              }, `${tp.icon || "•"} ${tp.name}`));
            }
          }
          const quick = TB.el("div", { class: "perm-quick" });
          quick.append(
            TB.el("button", { type: "button", class: "btn btn-sm", onclick: () => { applyPerms(Object.fromEntries(perms.keys.map(([k]) => [k, ["view", "create", "update", "delete"]]))); stat.textContent = `المحدد: ${countChecked()} / ${checks.length}`; } }, "☑️ الكل"),
            TB.el("button", { type: "button", class: "btn btn-sm", onclick: () => { applyPerms(Object.fromEntries(perms.keys.map(([k]) => [k, ["view"]]))); stat.textContent = `المحدد: ${countChecked()} / ${checks.length}`; } }, "👁️ عرض فقط"),
            TB.el("button", { type: "button", class: "btn btn-sm btn-danger", onclick: () => { applyPerms({}); stat.textContent = `المحدد: ${countChecked()} / ${checks.length}`; } }, "⬜ مسح الكل")
          );
          const head = TB.el("div", { class: "perm-head" });
          head.append(bar, quick);
          const statRow = TB.el("div", { class: "perm-stat" }); statRow.appendChild(stat);
          head.appendChild(statRow);
          box.insertBefore(head, tbl);

          inputs[f.name] = {
            get: () => {
              const out = {};
              box.querySelectorAll(".perm-check:checked").forEach(cb => { (out[cb.dataset.k] = out[cb.dataset.k] || []).push(cb.dataset.a); });
              return JSON.stringify(out);
            }, el: box
          };
          break;
        }
        default:
          box = TB.el("input", { class: "input", type: "text" }); box.value = val ?? "";
      }
      if (f.placeholder && box && (box.tagName === "INPUT" || box.tagName === "TEXTAREA")) box.placeholder = f.placeholder;
      const wrap = TB.el("div", { class: "field" + (f.type === "permissions" ? "" : "") }, "");
      if (f.type === "permissions") { wrap.style.gridColumn = "1/-1"; wrap.appendChild(box); }
      else { wrap.innerHTML = label; wrap.appendChild(box); }
      form.appendChild(wrap);
      if (!inputs[f.name]) inputs[f.name] = { get: () => box.value, el: box };
    }
    return {
      el: form, inputs,
      values() {
        const out = {};
        for (const [k, inp] of Object.entries(inputs)) out[k] = inp.get();
        return out;
      },
    };
  };

  /* ---------------- CRUD modal ---------------- */
  TB.recordModal = async (res, cfg, row) => {
    const isEdit = !!row;
    const built = await TB.buildForm(cfg.fields, row || {});
    const foot = TB.el("div", { class: "flex" });
    const save = TB.el("button", { class: "btn btn-primary" }, isEdit ? "💾 حفظ التعديل" : "➕ إضافة");
    foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
    const md = TB.modal(isEdit ? `تعديل — ${cfg.title}` : `إضافة — ${cfg.title}`, built.el, foot, { wide: !!cfg.wideForm });
    save.onclick = async () => {
      const data = built.values();
      if (cfg.prepareSave) Object.assign(data, cfg.prepareSave(data, row));
      save.disabled = true;
      try {
        const out = await TB.api(isEdit ? `${res}/${row.id}` : res, { method: isEdit ? "PUT" : "POST", body: data });
        TB.toast(isEdit ? "✅ تم حفظ التعديل" : "✅ تمت الإضافة بنجاح", "success");
        TB.clearOptions();
        md.close();
        if (cfg.onSave) cfg.onSave(out);
      } catch (e) { TB.toast(e.message, "error"); save.disabled = false; }
    };
  };

  /* ---------------- generic list view ---------------- */
  TB.listView = async (container, res, cfg) => {
    container.innerHTML = "";
    const state = { search: "", page: 1, filters: {} };
    const head = TB.el("div", { class: "toolbar" });
    const search = TB.el("input", { class: "input", placeholder: `🔎 بحث في ${cfg.title}...` });
    search.addEventListener("input", debounce(() => { state.search = search.value; state.page = 1; load(); }));
    head.appendChild(search);
    for (const f of cfg.filters || []) {
      const sel = TB.el("select", { class: "input" });
      sel.appendChild(TB.el("option", { value: "" }, f.label));
      const opts = f.options || (await TB.options(f.resource)).map(r => [r.id, r[f.label_field || "name"]]);
      for (const [v, l] of opts) sel.appendChild(TB.el("option", { value: v }, TB.esc(l)));
      sel.addEventListener("change", () => { state.filters[f.name] = sel.value; state.page = 1; load(); });
      head.appendChild(sel);
    }
    head.appendChild(TB.el("div", { class: "spacer" }));
    const info = TB.el("span", { class: "muted" });
    head.appendChild(info);
    head.appendChild(TB.exportButtons(async () => {
      const { cols, all } = await collectAll();
      return {
        file: res, title: cfg.title || res, sheet: cfg.title || res,
        subtitle: state.search ? `بحث: ${state.search}` : "",
        columns: cols.map(c => ({ label: c.label, key: c.key, csv: c.csv, type: c.type })),
        rows: all,
        meta: { "إجمالي السجلات": TB.num(all.length), "تاريخ التصدير": TB.dt(new Date().toISOString()),
                "بحث": state.search || "—",
                "فلاتر": Object.entries(state.filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ") || "—" },
      };
    }));
    if (cfg.extraButtons) for (const b of cfg.extraButtons(() => load())) head.appendChild(b);
    if (TB.can(cfg.perm || res, "create")) {
      head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => TB.recordModal(res, cfg, null).then(() => {}) }, "➕ إضافة جديد"));
    }
    container.appendChild(head);
    const bodyBox = TB.el("div");
    container.appendChild(bodyBox);

    async function load() {
      bodyBox.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      try {
        const qs = new URLSearchParams({ search: state.search, page: state.page, limit: 25 });
        for (const [k, v] of Object.entries(state.filters)) if (v) qs.set("fv_" + k, v);
        const out = await TB.api(`${res}?${qs}`);
        info.textContent = `عدد السجلات: ${out.total}`;
        bodyBox.innerHTML = "";
        const columns = cfg.columns.filter(c => !c.perm || TB.can(cfg.perm || res, c.perm)).map(c => ({
          label: c.label, render: c.render || (r => fmtCell(r[c.key], c))
        }));
        if (TB.can(cfg.perm || res, "update") || TB.can(cfg.perm || res, "delete")) {
          columns.push({
            label: "إجراءات", render: r => {
              const d = TB.el("div", { class: "flex" });
              if (cfg.rowActions) {
                for (const a of cfg.rowActions) {
                  if (!a.perm || TB.can(cfg.perm || res, a.perm)) {
                    d.appendChild(TB.el("button", { class: "btn btn-sm " + (a.class || ""), onclick: e => { e.stopPropagation(); a.run(r, () => load()); } }, a.icon + " " + a.label));
                  }
                }
              }
              if (TB.can(cfg.perm || res, "update"))
                d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: e => { e.stopPropagation(); TB.recordModal(res, cfg, r).then(() => {}); } }, "✏️"));
              if (TB.can(cfg.perm || res, "delete"))
                d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: e => { e.stopPropagation(); del(r); } }, "🗑️"));
              return d;
            }
          });
        }
        bodyBox.appendChild(TB.table(out.rows, columns, { onRow: cfg.onRow, emptyText: cfg.emptyText }));
        if (out.pages > 1) {
          const pg = TB.el("div", { class: "flex center", style: "margin-top:14px" });
          pg.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => { state.page = Math.max(1, state.page - 1); load(); } }, "السابق"));
          pg.appendChild(TB.el("span", { class: "muted" }, `صفحة ${out.page} من ${out.pages}`));
          pg.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => { state.page = Math.min(out.pages, state.page + 1); load(); } }, "التالي"));
          bodyBox.appendChild(pg);
        }
      } catch (e) { bodyBox.innerHTML = ""; bodyBox.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    }
    function del(r) {
      TB.confirm(cfg.deleteMsg ? cfg.deleteMsg(r) : "هل تريد حذف هذا السجل نهائياً؟", async () => {
        await TB.api(`${res}/${r.id}`, { method: "DELETE" });
        TB.toast("🗑️ تم الحذف", "success");
        TB.clearOptions();
        load();
      });
    }
    /* تصدير كل السجلات المطابقة للبحث/الفلاتر الحالية إلى CSV */
    async function collectAll() {
      const cols = cfg.columns.filter(c => !c.perm || TB.can(cfg.perm || res, c.perm));
      const all = [];
      let page = 1, pages = 1;
      do {
        const qs = new URLSearchParams({ search: state.search, page, limit: 500 });
        for (const [k, v] of Object.entries(state.filters)) if (v) qs.set("fv_" + k, v);
        const out = await TB.api(`${res}?${qs}`);
        all.push(...(out.rows || []));
        pages = out.pages || 1;
        page++;
      } while (page <= pages && all.length < 5000);
      return { cols, all };
    }
    await load();
    return load;
  };
  function fmtCell(v, c) {
    if (v === null || v === undefined) return "";
    if (c.type === "money") return TB.money(v);
    if (c.type === "date") return TB.date(v);
    if (c.type === "dt") return TB.dt(v);
    if (c.type === "bool") return v ? "✅" : "⛔";
    if (c.type === "badge") return `<span class="badge ${c.badge(v)}">${c.label2 ? c.label2(v) : TB.esc(v)}</span>`;
    if (c.type === "img") return v ? `<img class="img-thumb" src="${TB.esc(v)}">` : "";
    return v;
  }
  function debounce(fn, ms = 350) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  TB.debounce = debounce;

  /** تنزيل ملف محمي من الـ API (يُرسل التوكن في الهيدر ثم يحوّله لملف قابل للحفظ) */
  TB.download = async (path, filename) => {
    const res = await fetch("/api/" + path, { headers: TB.token ? { Authorization: "Bearer " + TB.token } : {} });
    if (!res.ok) {
      let msg = "تعذّر تنزيل الملف";
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* تجاهل */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* ---------------- router ---------------- */
  TB.go = hash => { location.hash = hash; };
  async function route() {
    /* نفصل سطر الاستعلام (?cash=12) قبل قراءة المسار — وإلا فشل التوجيه ورجع للوحة التحكم */
    const raw = location.hash.replace(/^#\/?/, "") || "dashboard";
    const hash = (raw.split("?")[0] || "dashboard");
    const [head, param, param2] = hash.split("/");
    if (!TB.user) return;
    $("#app").classList.remove("hidden");
    $("#login").style.display = "none";
    let title = "لوحة التحكم";
    /* حارس صلاحيات: يمنع عرض شاشة بلا صلاحية قبل بنائها (رسالة نظيفة بدل هيكل جزئي) */
    const ROUTE_PERM = {
      dashboard: "dashboard", orders: "orders", inventory: "inventory", purchases: "purchases",
      "stock-counts": "stock_counts", cash: "cash", vouchers: "vouchers", accounting: "accounting",
      reports: "reports", settings: "settings", audit: "users", vip: "customers",
      proofs: "payment_proofs", tutorials: "dashboard", erp: "reports", backup: "settings",
    };
    const need = ROUTE_PERM[head];
    if (need && !TB.can(need, "view")) {
      $("#view").innerHTML = "";
      $("#view").appendChild(TB.el("div", { class: "empty" },
        `<span class="emoji">🔒</span>لا تملك صلاحية الوصول إلى هذه الشاشة
         <div class="muted small" style="margin-top:8px">تواصل مع مدير النظام لمنحك صلاحية «${need}»</div>
         <div style="margin-top:14px"><a class="btn btn-primary" href="#/dashboard">العودة للوحة التحكم</a></div>`));
      $("#page-title").textContent = "غير مصرّح";
      document.title = "طلباتك — غير مصرّح";
      highlightNav(head, param);
      $("#sidebar").classList.remove("open");
      $("#side-overlay").classList.remove("show");
      return;
    }
    try {
      if (head === "dashboard" || head === "") { title = "لوحة التحكم"; await VIEWS.dashboard($("#view")); }
      else if (head === "orders") { title = "الأوردرات"; await VIEWS.orders($("#view")); }
      else if (head === "inventory") { title = "المخزون"; await VIEWS.inventory($("#view")); }
      else if (head === "purchases") { title = "المشتريات"; await VIEWS.purchases($("#view")); }
      else if (head === "stock-counts") { title = "الجرد والتسويات"; await VIEWS.stockCounts($("#view")); }
      else if (head === "cash") { title = "الخزائن والبنوك"; await VIEWS.cash($("#view")); }
      else if (head === "vouchers") { title = "أذون القبض والصرف"; await VIEWS.vouchers($("#view")); }
      else if (head === "accounting") { title = "الحسابات"; await VIEWS.accounting($("#view")); }
      else if (head === "erp") { title = "مركز ERP للتوصيل"; await VIEWS.erp($("#view")); }
      else if (head === "reports") { title = "التقارير"; await VIEWS.reports($("#view")); }
      else if (head === "backup") { title = "النسخ الاحتياطي والاستعادة"; await VIEWS.backup($("#view")); }
      else if (head === "settings") { title = "إعدادات الشركة"; await VIEWS.settings($("#view")); }
      else if (head === "vip") { title = "العملاء المميزون"; await VIEWS.vip($("#view")); }
      else if (head === "proofs") { title = "إثباتات الدفع"; await VIEWS.proofs($("#view")); }
      else if (head === "audit") {
        title = "سجل النشاط";
        await VIEWS.audit($("#view"));
      }
      else if (head === "tutorials") {
        title = "فيديوهات الشرح";
        await VIEWS.tutorials($("#view"));
      }
      else if (head === "module" && param) {
        const cfg = window.MODULES[param];
        if (!cfg) throw new Error("شاشة غير موجودة");
        if (!TB.can(cfg.perm || param, "view")) throw new Error("🔒 لا تملك صلاحية الوصول إلى هذه الشاشة");
        title = cfg.title;
        $("#view").innerHTML = "";
        await TB.listView($("#view"), param, cfg);
      }
      else { title = "لوحة التحكم"; await VIEWS.dashboard($("#view")); }
    } catch (e) {
      $("#view").innerHTML = "";
      $("#view").appendChild(TB.el("div", { class: "empty" }, `<span class="emoji">⚠️</span>${TB.esc(e.message)}`));
    }
    $("#page-title").textContent = title;
    document.title = `طلباتك — ${title}`;
    highlightNav(head, param);
    $("#sidebar").classList.remove("open");
    $("#side-overlay").classList.remove("show");
  }
  window.addEventListener("hashchange", route);

  function highlightNav(head, param) {
    $$("#nav .nav-item").forEach(a => {
      const target = a.getAttribute("href").replace(/^#\/?/, "");
      const [th, tp] = target.split("/");
      a.classList.toggle("active", (th === head || (head === "dashboard" && th === "dashboard")) && (!tp || tp === param));
    });
  }

  /* ---------------- nav ---------------- */
  TB.buildNav = () => {
    const nav = $("#nav");
    nav.innerHTML = "";
    for (const group of window.NAV) {
      const items = group.items.filter(i => !i.perm || TB.can(i.perm, "view"));
      if (!items.length) continue;
      const g = TB.el("div", { class: "nav-group" }, `<h4>${TB.esc(group.title)}</h4>`);
      for (const i of items) {
        const a = TB.el("a", { class: "nav-item", href: i.href }, `<span class="ic">${i.icon}</span><span>${TB.esc(i.label)}</span>${i.badge ? '<span class="count" data-badge="' + i.badge + '"></span>' : ""}`);
        g.appendChild(a);
      }
      nav.appendChild(g);
    }
  };
  TB.refreshBadges = async () => {
    try {
      const d = await TB.api("reports/dashboard");
      $$('#nav .count').forEach(c => {
        const k = c.dataset.badge;
        c.textContent = d.kpis[k] || "";
        if (!d.kpis[k]) c.style.display = "none";
      });
    } catch { }
  };

  /* ---------------- auth ---------------- */
  TB.login = async (email, password) => {
    const out = await TB.api("auth/login", { method: "POST", body: { email, password } });
    TB.token = out.token;
    localStorage.setItem("tb_admin_token", out.token);
    TB.user = out.user;
    return out.user;
  };
  TB.logout = (silent) => {
    if (TB.token) TB.api("auth/logout", { method: "POST" }).catch(() => { });
    TB.token = ""; TB.user = null;
    localStorage.removeItem("tb_admin_token");
    if (!silent) location.reload();
  };

  /* ---------------- password strength ---------------- */
  TB.pwScore = pw => {
    if (!pw) return { score: 0, label: "—", cls: "" };
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const map = [
      { label: "ضعيفة جدًا", cls: "pw-1" },
      { label: "ضعيفة", cls: "pw-1" },
      { label: "متوسطة", cls: "pw-2" },
      { label: "جيدة", cls: "pw-3" },
      { label: "قوية", cls: "pw-4" },
      { label: "ممتازة 🔒", cls: "pw-4" },
    ];
    const m = map[Math.min(s, map.length - 1)];
    return { score: s, label: m.label, cls: m.cls };
  };
  const pwMeter = () => {
    const wrap = TB.el("div", { class: "pw-meter" });
    const bars = TB.el("div", { class: "pw-bars" });
    for (let i = 0; i < 4; i++) bars.appendChild(TB.el("i"));
    const lbl = TB.el("span", { class: "pw-label muted small" }, "لم تُكتب بعد");
    wrap.append(bars, lbl);
    return {
      el: wrap,
      update(v) {
        const sc = TB.pwScore(v);
        const n = v ? Math.max(1, Math.ceil(sc.score * 4 / 5)) : 0;
        [...bars.children].forEach((b, i) => { b.className = i < n ? "on " + sc.cls : ""; });
        lbl.textContent = v ? `قوة كلمة المرور: ${sc.label}` : "لم تُكتب بعد";
      },
    };
  };

  /* ---------------- change password ---------------- */
  TB.changePassword = () => {
    const body = TB.el("div", { class: "stack" });
    const mk = (labelTxt, ph) => {
      const f = TB.el("div", { class: "field" }, `<label>${labelTxt}</label>`);
      const i = TB.el("input", { class: "input", type: "password", placeholder: ph, autocomplete: "new-password" });
      f.appendChild(i); return { f, i };
    };
    const cur = mk("كلمة المرور الحالية <span class=\"req\">*</span>", "••••••••");
    const nu = mk("كلمة المرور الجديدة <span class=\"req\">*</span>", "٦ أحرف على الأقل");
    const cf = mk("تأكيد كلمة المرور الجديدة <span class=\"req\">*</span>", "أعد كتابة كلمة المرور");
    const meter = pwMeter();
    body.append(cur.f, nu.f, meter.el, cf.f);
    body.appendChild(TB.el("p", { class: "muted small" }, "استخدم ١٠ أحرف أو أكثر مع أرقام ورموز لحماية حسابك."));
    const show = TB.el("label", { class: "switch-inline" });
    const scb = TB.el("input", { type: "checkbox" });
    show.append(scb, TB.el("span", {}, " إظهار كلمات المرور"));
    show.querySelector("input").addEventListener("change", () => {
      const t = scb.checked ? "text" : "password";
      [cur.i, nu.i, cf.i].forEach(x => x.type = t);
    });
    body.appendChild(show);
    nu.i.addEventListener("input", () => meter.update(nu.i.value));

    const save = TB.el("button", { class: "btn btn-primary" }, "🔑 حفظ كلمة المرور الجديدة");
    const foot = TB.el("div", { class: "flex" });
    foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
    const md = TB.modal("🔑 تغيير كلمة المرور", body, foot);
    const go = async () => {
      if (!cur.i.value) return TB.toast("أدخل كلمة المرور الحالية", "error");
      if (nu.i.value.length < 6) return TB.toast("كلمة المرور الجديدة قصيرة — ٦ أحرف على الأقل", "error");
      if (nu.i.value !== cf.i.value) return TB.toast("كلمتا المرور غير متطابقتين", "error");
      if (nu.i.value === cur.i.value) return TB.toast("كلمة المرور الجديدة مطابقة للحالية", "error");
      save.disabled = true; save.textContent = "جارٍ الحفظ…";
      try {
        await TB.api("auth/change-password", { method: "POST", body: { current: cur.i.value, next: nu.i.value } });
        TB.toast("✅ تم تغيير كلمة المرور بنجاح", "success");
        md.close();
      } catch (e) { TB.toast(e.message, "error"); }
      save.disabled = false; save.textContent = "🔑 حفظ كلمة المرور الجديدة";
    };
    save.onclick = go;
    [cur.i, nu.i, cf.i].forEach(x => x.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
    cur.i.focus();
  };

  /* ---------------- sessions ---------------- */
  TB.mySessions = async () => {
    const body = TB.el("div", { class: "stack" }, '<div class="empty">⏳ جاري التحميل...</div>');
    const foot = TB.el("div", { class: "flex" });
    const revoke = TB.el("button", { class: "btn btn-danger" }, "🚪 تسجيل الخروج من كل الأجهزة الأخرى");
    foot.append(revoke, TB.el("button", { class: "btn", onclick: () => md.close() }, "إغلاق"));
    const md = TB.modal("📱 الأجهزة المسجّلة", body, foot);
    try {
      const rows = await TB.api("auth/sessions");
      body.innerHTML = "";
      if (!rows.length) body.appendChild(TB.el("div", { class: "empty" }, "لا توجد جلسات أخرى"));
      rows.forEach(r => {
        const isCur = r.is_current === true || r.token === TB.token;
        const row = TB.el("div", { class: "session-row" });
        row.appendChild(TB.el("span", { class: "session-ic" }, isCur ? "🟢" : "⚪"));
        const info = TB.el("div", { class: "grow" });
        info.appendChild(TB.el("b", {}, isCur ? "الجهاز الحالي" : "جهاز آخر"));
        info.appendChild(TB.el("div", { class: "muted small" }, "بدأ في: " + TB.dt(r.created_at)));
        row.appendChild(info);
        body.appendChild(row);
      });
    } catch (e) { body.innerHTML = ""; body.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    revoke.onclick = () => TB.confirm("تسجيل الخروج من كل الأجهزة الأخرى؟ سيعاد تحميل الصفحة.", async () => {
      try {
        await TB.api("auth/sessions/revoke-all", { method: "POST", body: {} });
        TB.toast("✅ تم تسجيل الخروج من الأجهزة الأخرى", "success");
        md.close();
      } catch (e) { TB.toast(e.message, "error"); }
    }, true);
  };

  /* ---------------- العلامة التجارية ---------------- */
  let _brand = null;
  function paintBrand(c) {
    if (c) _brand = c;
    const nm = (_brand && _brand.name) || "طلباتك";
    const label = nm;
    const b = $("#brand-name"); if (b) b.textContent = label;
    const lb = $("#login-brand"); if (lb) lb.textContent = label;
    const logo = _brand && _brand.logo;
    if (logo) {
      const img = $("#brand-logo"); if (img) img.src = logo;
      const ll = $("#login-logo");
      if (ll) { ll.textContent = ""; const i2 = document.createElement("img"); i2.src = logo; i2.alt = ""; ll.appendChild(i2); }
    }
  }
  function loadBrand() {
    return fetch("/api/store/home").then(r => r.ok ? r.json() : null)
      .then(h => paintBrand(h && h.company)).catch(() => paintBrand());
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    TB.setTheme(localStorage.getItem("tb_theme") || document.documentElement.getAttribute("data-theme") || "light");
    loadBrand();
    $("#theme-btn").addEventListener("click", TB.toggleTheme);
    $("#menu-btn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#side-overlay").classList.add("show"); });
    $("#side-overlay").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#side-overlay").classList.remove("show"); });
    $("#side-close").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#side-overlay").classList.remove("show"); });
    $("#user-btn").addEventListener("click", () => $("#user-menu").classList.toggle("hidden"));
    $("#logout-btn").addEventListener("click", () => TB.logout());
    $("#change-pass-btn")?.addEventListener("click", () => { $("#user-menu").classList.add("hidden"); TB.changePassword(); });
    $("#my-sessions-btn")?.addEventListener("click", () => { $("#user-menu").classList.add("hidden"); TB.mySessions(); });
    document.addEventListener("click", e => {
      if (!e.target.closest(".dropdown")) $("#user-menu")?.classList.add("hidden");
    });
    $("#login-form").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await TB.login($("#login-email").value.trim(), $("#login-pass").value);
        TB.toast("مرحباً بعودتك 👋", "success");
        startApp();
      } catch (err) { TB.toast(err.message, "error"); }
      btn.disabled = false;
    });
    if (TB.token) {
      try {
        const me = await TB.api("auth/me");
        if (!me.user) throw new Error("no user");
        TB.user = me.user;
        try { TB.user._perms = JSON.parse(TB.user.permissions || "{}"); } catch { TB.user._perms = {}; }
        return startApp();
      } catch { TB.token = ""; localStorage.removeItem("tb_admin_token"); }
    }
    $("#login").style.display = "flex";
  }
  function startApp() {
    $("#login").style.display = "none";
    $("#app").classList.remove("hidden");
    $("#user-name").textContent = TB.user.name;
    $("#user-role").textContent = TB.user.role === "admin" ? "مدير عام — كل الصلاحيات" : "موظف — صلاحيات محددة";
    $("#user-avatar").textContent = TB.user.name.trim().charAt(0);
    TB.buildNav();
    loadBrand();
    TB.refreshBadges();
    if (!location.hash) location.hash = "#/dashboard";
    route();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
