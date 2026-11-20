/* النسخ الاحتياطي والاستعادة — مركز حماية بيانات طلباتك */
(function () {
  "use strict";
  const V = window.registerView;
  const fmtSize = n => {
    n = Number(n) || 0;
    if (n < 1024) return n + " بايت";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " ك.ب";
    return (n / 1024 / 1024).toFixed(2) + " م.ب";
  };

  V("backup", async el => {
    el.innerHTML = "";
    const canWrite = TB.can("settings", "update");
    let state = { backups: [], dirs: [], dir: "", db_size: 0 };

    /* ---------- hero ---------- */
    const hero = TB.el("div", { class: "backup-hero" });
    hero.innerHTML = `
      <div class="backup-hero-copy">
        <span class="erp-eyebrow">حماية البيانات • Business Continuity</span>
        <h2>مركز النسخ الاحتياطي والاستعادة</h2>
        <p>احمِ بيانات طلباتك وعملائك ومحاسبتك. أنشئ نسخة متّسقة، نزّلها على جهازك، أو استعد نسخة سابقة بأمان — مع نسخة أمان تلقائية قبل كل استعادة.</p>
      </div>
      <div class="backup-hero-actions">
        <button class="btn btn-primary" id="bk-quick">➕ نسخة احتياطية الآن</button>
        <button class="btn" id="bk-to-upload">📤 استعادة من ملف</button>
      </div>`;
    el.appendChild(hero);

    /* ---------- stats ---------- */
    const stats = TB.el("div", { class: "backup-stats" });
    el.appendChild(stats);
    function paintStats() {
      const last = state.backups.slice().sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)))[0];
      stats.innerHTML = `
        <div class="backup-stat"><span>💾</span><div><small>حجم قاعدة البيانات</small><b>${fmtSize(state.db_size)}</b></div></div>
        <div class="backup-stat"><span>🗂️</span><div><small>النسخ المتاحة</small><b>${TB.num(state.backups.length)}</b></div></div>
        <div class="backup-stat"><span>🕒</span><div><small>آخر نسخة</small><b>${last ? TB.dt(last.mtime) : "لا توجد"}</b></div></div>
        <div class="backup-stat"><span>📁</span><div><small>مجلد الحفظ</small><b class="mono" dir="ltr" title="${TB.esc(state.dir)}">${TB.esc(state.dir || "—")}</b></div></div>`;
    }

    /* ---------- create / folder card ---------- */
    const grid = TB.el("div", { class: "backup-grid" });
    el.appendChild(grid);

    const createCard = TB.el("div", { class: "card backup-card" });
    createCard.innerHTML = `
      <div class="card-head"><h3 class="card-title">➕ إنشاء نسخة احتياطية</h3><span class="badge badge-success">موصى به يوميًا</span></div>
      <p class="muted small">تُنشأ النسخة من قاعدة البيانات الحالية بشكل متّسق، ويمكن حفظها في المجلد الافتراضي أو أي مجلد آخر.</p>`;
    const createBody = TB.el("div", { class: "backup-form" });
    const dirRow = TB.el("div", { class: "backup-dir-row" });
    const dirSel = TB.el("select", { class: "input" });
    const addDirBtn = TB.el("button", { class: "btn btn-sm", type: "button" }, "📁 إضافة مجلد");
    const delDirBtn = TB.el("button", { class: "btn btn-sm btn-danger", type: "button" }, "✖ إزالة");
    dirRow.append(dirSel, addDirBtn, delDirBtn);
    const noteInput = TB.el("input", { class: "input", placeholder: "ملاحظة اختيارية — مثال: قبل تحديث الأسعار" });
    const createBtn = TB.el("button", { class: "btn btn-primary" }, "💾 إنشاء النسخة");
    const hint = TB.el("p", { class: "muted small" }, "");
    createBody.append(TB.el("label", { class: "field-label" }, "وجهة الحفظ"), dirRow, TB.el("label", { class: "field-label" }, "ملاحظة النسخة"), noteInput, createBtn, hint);
    createCard.appendChild(createBody);
    grid.appendChild(createCard);

    /* ---------- upload restore card ---------- */
    const uploadCard = TB.el("div", { class: "card backup-card" });
    uploadCard.innerHTML = `
      <div class="card-head"><h3 class="card-title">📤 استعادة من ملف</h3><span class="badge badge-warning">عملية حساسة</span></div>
      <p class="muted small">ارفع نسخة <b>.db</b> (SQLite) أو <b>.json</b> (MySQL) من جهازك. تُؤخذ نسخة أمان تلقائية قبل الاستعادة، ثم تُستبدل البيانات الحالية.</p>`;
    const upBody = TB.el("div", { class: "backup-form" });
    const fileInp = TB.el("input", { type: "file", accept: ".db,.sqlite,.sqlite3,.json,application/json,application/octet-stream", class: "hidden-file" });
    const fileLabel = TB.el("label", { class: "backup-drop", for: "bk-file" }, `<span>📥</span><b>اختر ملف النسخة أو اسحبه هنا</b><small>SQLite .db / MySQL .json — حتى ١٢٨ ميجا</small>`);
    fileInp.id = "bk-file";
    const fileName = TB.el("div", { class: "file-pill", style: "display:none" }, "");
    const restoreBtn = TB.el("button", { class: "btn btn-danger" }, "♻️ استعادة النسخة");
    restoreBtn.disabled = true;
    upBody.append(fileInp, fileLabel, fileName, restoreBtn);
    uploadCard.appendChild(upBody);
    grid.appendChild(uploadCard);

    /* ---------- backup list ---------- */
    const listCard = TB.el("div", { class: "card backup-card backup-list-card" });
    const listHead = TB.el("div", { class: "card-head" });
    listHead.innerHTML = `<h3 class="card-title">🗂️ النسخ المتاحة</h3>`;
    const refreshBtn = TB.el("button", { class: "btn btn-sm" }, "🔄 تحديث");
    listHead.appendChild(refreshBtn);
    const listBox = TB.el("div");
    listCard.append(listHead, listBox);
    el.appendChild(listCard);

    function paintDirs() {
      const prev = dirSel.value;
      dirSel.innerHTML = "";
      const dirs = state.dirs || [];
      if (!dirs.length) dirSel.appendChild(TB.el("option", { value: "" }, "📁 المجلد الافتراضي"));
      dirs.forEach(d => dirSel.appendChild(TB.el("option", { value: String(d.id) },
        `${d.is_default ? "⭐ " : "📁 "}${d.path}${d.is_default ? " (افتراضي)" : ""}${d.writable ? "" : " — ⚠️ غير قابل للكتابة"}`)));
      if (prev && dirs.some(d => String(d.id) === prev)) dirSel.value = prev;
      const cur = dirs.find(d => String(d.id) === String(dirSel.value));
      delDirBtn.disabled = !canWrite || !cur || !!cur.is_default;
      addDirBtn.disabled = !canWrite;
      createBtn.disabled = !canWrite;
    }

    function paintList() {
      listBox.innerHTML = "";
      if (!state.backups.length) {
        listBox.appendChild(TB.el("div", { class: "empty" }, `<span class="emoji">🛡️</span>لا توجد نسخ احتياطية بعد — أنشئ أول نسخة الآن.`));
        return;
      }
      listBox.appendChild(TB.table(state.backups, [
        { label: "ملف النسخة", render: r => `<span class="mono" dir="ltr">${TB.esc(r.name)}</span>` },
        { label: "المجلد", render: r => `<span class="mono small" dir="ltr" title="${TB.esc(r.dir || "")}">${TB.esc((r.dir || "").split(/[\\/]/).slice(-2).join("/"))}</span>` },
        { label: "الحجم", render: r => fmtSize(r.size) },
        { label: "التاريخ", render: r => TB.dt(r.mtime) },
        { label: "إجراءات", render: r => {
            const d = TB.el("div", { class: "flex" });
            const q = r.dir_id != null ? "?d=" + encodeURIComponent(r.dir_id) : "";
            d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: async e => {
              e.stopPropagation();
              try { await TB.download("system/backup/" + encodeURIComponent(r.name) + "/download" + q, r.name); TB.toast("⬇️ جاري تنزيل النسخة", "success"); }
              catch (err) { TB.toast(err.message, "error"); }
            } }, "⬇️ تنزيل"));
            if (canWrite) {
              d.appendChild(TB.el("button", { class: "btn btn-sm btn-soft", onclick: e => {
                e.stopPropagation();
                TB.confirm(`استعادة النسخة «${r.name}»؟ سيتم استبدال كل البيانات الحالية (تُؤخذ نسخة أمان تلقائيًا قبل ذلك).`, async () => {
                  try {
                    const out = await TB.api("system/backup/restore", { method: "POST", body: { name: r.name, d: r.dir_id } });
                    TB.toast(`✅ تمت الاستعادة (${out.tables} جدول) — جاري إعادة التحميل...`, "success");
                    TB.clearOptions();
                    setTimeout(() => location.reload(), 1200);
                  } catch (err) { TB.toast(err.message, "error"); }
                });
              } }, "♻️ استعادة"));
              d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: e => {
                e.stopPropagation();
                TB.confirm(`حذف النسخة «${r.name}» نهائيًا؟`, async () => {
                  try { await TB.api("system/backup/" + encodeURIComponent(r.name) + q, { method: "DELETE" }); TB.toast("🗑️ تم حذف النسخة", "success"); await load(); }
                  catch (err) { TB.toast(err.message, "error"); }
                });
              } }, "🗑️"));
            }
            return d;
          } },
      ]));
    }

    async function load() {
      listBox.innerHTML = '<div class="empty">⏳ جاري تحميل النسخ...</div>';
      try {
        state = await TB.api("system/backup");
        paintDirs();
        paintStats();
        paintList();
        hint.innerHTML = `حجم قاعدة البيانات الحالية: <b>${fmtSize(state.db_size)}</b> — تُحفظ النسخة في المجلد المختار أعلاه.`;
      } catch (e) {
        listBox.innerHTML = "";
        listBox.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message)));
      }
    }

    /* ---------- create ---------- */
    async function quickCreate(note) {
      if (!canWrite) return TB.toast("لا تملك صلاحية إنشاء نسخة", "error");
      const old = createBtn.textContent;
      createBtn.disabled = true; createBtn.textContent = "⏳ جاري الإنشاء...";
      try {
        const out = await TB.api("system/backup/create", { method: "POST", body: { note: note || "", dir_id: dirSel.value || undefined } });
        TB.toast(`✅ تم إنشاء النسخة «${out.name}» (${fmtSize(out.size)})`, "success");
        noteInput.value = "";
        await load();
      } catch (e) { TB.toast(e.message, "error"); }
      createBtn.disabled = false; createBtn.textContent = old;
    }
    createBtn.onclick = () => quickCreate(noteInput.value.trim());
    document.getElementById("bk-quick").onclick = () => quickCreate("نسخة-سريعة");
    document.getElementById("bk-to-upload").onclick = () => uploadCard.scrollIntoView({ behavior: "smooth", block: "center" });

    /* ---------- folder picker ---------- */
    function openFolderPicker(startPath) {
      let cur = startPath || "";
      const pathInp = TB.el("input", { class: "input mono", dir: "ltr", placeholder: "المسار الكامل للمجلد — مثال: D:\\Backups" });
      const upBtn = TB.el("button", { class: "btn btn-sm", type: "button" }, "⬆️ الأعلى");
      const goBtn = TB.el("button", { class: "btn btn-sm btn-soft", type: "button" }, "↪️ انتقال");
      const wrap = TB.el("div", { class: "grid", style: "gap:10px" });
      const info = TB.el("p", { class: "muted small" }, "");
      const listEl = TB.el("div", { class: "folder-picker" });
      const row1 = TB.el("div", { class: "flex", style: "gap:8px;flex-wrap:wrap" });
      row1.append(pathInp, goBtn, upBtn);
      wrap.append(row1, info, listEl);

      async function browse(p) {
        listEl.innerHTML = '<div class="empty">⏳ ...</div>';
        try {
          const out = await TB.api("system/backup/browse" + (p ? "?path=" + encodeURIComponent(p) : ""));
          cur = out.path; pathInp.value = out.path;
          info.innerHTML = out.writable
            ? `<span class="text-success">✅ هذا المجلد صالح للحفظ</span>` + (out.registered.includes(out.path) ? ` — <span class="badge badge-info">مسجّل بالفعل</span>` : "")
            : `<span class="text-danger">⚠️ هذا المجلد غير قابل للكتابة</span>`;
          listEl.innerHTML = "";
          if (!out.dirs.length) { listEl.appendChild(TB.el("div", { class: "empty" }, "لا توجد مجلدات فرعية")); return; }
          out.dirs.forEach(name => listEl.appendChild(TB.el("button", { class: "folder-item", type: "button", onclick: () => browse(out.path + (out.path.endsWith("\\") || out.path.endsWith("/") ? "" : "\\") + name) }, `📁 ${TB.esc(name)}`)));
        } catch (e) { listEl.innerHTML = ""; listEl.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
      }
      upBtn.onclick = () => { const o = pathInp.value; TB.api("system/backup/browse?path=" + encodeURIComponent(o)).then(r => r.parent ? browse(r.parent) : null).catch(() => {}); };
      goBtn.onclick = () => browse(pathInp.value.trim());
      pathInp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); browse(pathInp.value.trim()); } });

      const useBtn = TB.el("button", { class: "btn btn-primary" }, "✅ استخدام هذا المجلد");
      const md = TB.modal("📁 اختيار مجلد حفظ النسخ", wrap, useBtn, { wide: true });
      useBtn.onclick = async () => {
        useBtn.disabled = true;
        try {
          await TB.api("system/backup/location", { method: "POST", body: { path: cur } });
          TB.toast("✅ تم حفظ المجلد كوجهة للنسخ", "success");
          md.close();
          await load();
        } catch (e) { TB.toast(e.message, "error"); useBtn.disabled = false; }
      };
      browse(cur);
    }
    addDirBtn.onclick = () => { const d = state.dirs.find(x => String(x.id) === String(dirSel.value)); openFolderPicker(d ? d.path : ""); };
    delDirBtn.onclick = () => {
      const cur = state.dirs.find(d => String(d.id) === String(dirSel.value));
      if (!cur || cur.is_default) return;
      TB.confirm(`إلغاء تسجيل المجلد «${cur.path}» كوجهة نسخ؟ (لن تُحذف الملفات)`, async () => {
        try { await TB.api("system/backup/location/" + cur.id, { method: "DELETE" }); TB.toast("✅ تم إلغاء التسجيل", "success"); await load(); }
        catch (e) { TB.toast(e.message, "error"); }
      });
    };

    /* ---------- upload restore ---------- */
    fileInp.addEventListener("change", () => {
      const f = fileInp.files && fileInp.files[0];
      if (!f) { fileName.style.display = "none"; restoreBtn.disabled = true; return; }
      fileName.style.display = "";
      fileName.innerHTML = `📄 <b>${TB.esc(f.name)}</b> <small>${fmtSize(f.size)}</small>`;
      restoreBtn.disabled = !canWrite;
    });
    restoreBtn.onclick = () => {
      const f = fileInp.files && fileInp.files[0];
      if (!f) return TB.toast("اختر ملف النسخة أولاً", "error");
      if (f.size > 128 * 1024 * 1024) return TB.toast("حجم الملف أكبر من الحد المسموح (١٢٨ ميجا)", "error");
      TB.confirm(`استعادة النسخة «${f.name}»؟ سيتم استبدال كل البيانات الحالية، وتُؤخذ نسخة أمان تلقائية قبل الاستعادة.`, async () => {
        const old = restoreBtn.textContent;
        restoreBtn.disabled = true; restoreBtn.textContent = "⏳ جاري الرفع والاستعادة...";
        try {
          const data = await new Promise((resolve, reject) => {
            const rd = new FileReader();
            rd.onload = () => resolve(String(rd.result || "").split(",")[1] || "");
            rd.onerror = () => reject(new Error("تعذر قراءة الملف"));
            rd.readAsDataURL(f);
          });
          const out = await TB.api("system/backup/restore-upload", { method: "POST", body: { name: f.name, data } });
          TB.toast(`✅ تمت الاستعادة من الملف (${out.tables} جدول) — جاري إعادة التحميل...`, "success");
          TB.clearOptions();
          setTimeout(() => location.reload(), 1400);
        } catch (e) {
          TB.toast(e.message, "error");
          restoreBtn.disabled = false; restoreBtn.textContent = old;
        }
      });
    };

    refreshBtn.onclick = load;
    await load();
  });
})();
