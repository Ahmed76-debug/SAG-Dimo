/* ============================================================
   طلباتك — ERP views: accounting, cash, vouchers, reports
   ============================================================ */
(function () {
  "use strict";
  const V = window.registerView;
  const TYPE_LBL = { asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };
  const TYPE_BADGE = { asset: "badge-info", liability: "badge-danger", equity: "badge-primary", revenue: "badge-success", expense: "badge-warning" };

  /* ================================================== ACCOUNTING */
  V("accounting", async el => {
    el.innerHTML = "";
    const tabs = TB.el("div", { class: "tabs" });
    const body = TB.el("div");
    el.append(tabs, body);
    const t1 = TB.el("button", { class: "tab active" }, "📚 دليل الحسابات");
    const t2 = TB.el("button", { class: "tab" }, "📒 دفتر اليومية");
    const t3 = TB.el("button", { class: "tab" }, "🔎 دفتر الأستاذ");
    tabs.append(t1, t2, t3);
    t1.onclick = () => act(t1, renderAccounts);
    t2.onclick = () => act(t2, renderJournals);
    t3.onclick = () => act(t3, renderLedger);
    function act(t, fn) { [t1, t2, t3].forEach(x => x.classList.remove("active")); t.classList.add("active"); fn(); }
    act(t1, renderAccounts); // render default tab on load

    async function renderAccounts() {
      body.innerHTML = "";
      await TB.listView(body, "accounts", {
        title: "دليل الحسابات", perm: "accounting",
        columns: [
          { label: "الكود", render: r => `<b class="mono">${TB.esc(r.code)}</b>` },
          { label: "اسم الحساب", render: r => `<b>${TB.esc(r.name)}</b>` },
          { label: "النوع", render: r => `<span class="badge ${TYPE_BADGE[r.type]}">${TYPE_LBL[r.type] || r.type}</span>` },
          { label: "تصنيف خاص", render: r => ({ cash: "💵 خزينة", bank: "🏦 بنك", customer: "👥 عملاء", supplier: "🚚 موردون", inventory: "📦 مخزون", normal: "—" }[r.kind] || r.kind) },
          { label: "الرصيد", render: r => `<b class="${r.balance >= 0 ? "" : "text-danger"}">${TB.money(r.balance)}</b>` },
        ],
        fields: [
          { name: "code", label: "كود الحساب", type: "text", required: true },
          { name: "name", label: "اسم الحساب", type: "text", required: true },
          { name: "type", label: "النوع", type: "select", options: [["asset", "أصول"], ["liability", "خصوم"], ["equity", "حقوق ملكية"], ["revenue", "إيرادات"], ["expense", "مصروفات"]], required: true },
          { name: "parent_id", label: "الحساب الأب", type: "select", resource: "accounts" },
          { name: "kind", label: "تصنيف خاص", type: "select", options: [["normal", "عادي"], ["cash", "خزينة"], ["bank", "بنك"], ["customer", "عملاء"], ["supplier", "موردون"], ["inventory", "مخزون"]], default: "normal" },
          { name: "is_system", label: "حساب نظام", type: "switch", default: 0 },
        ],
        deleteMsg: r => `حذف الحساب «${r.name}»؟`,
      });
    }
    async function renderJournals() {
      body.innerHTML = "";
      const head = TB.el("div", { class: "toolbar" });
      head.appendChild(TB.el("div", { class: "spacer" }));
      let rows = [];
      head.appendChild(TB.exportButtons(() => ({
        file: "journals", title: "دفتر اليومية",
        columns: [
          { label: "#", key: "id" },
          { label: "التاريخ", key: "date", type: "date" },
          { label: "البيان", key: "memo" },
          { label: "المصدر", csv: r => ({ "": "يدوي", order: "طلب", purchase: "مشتريات", voucher: "سند", stock_count: "جرد", expense: "مصروف", opening: "افتتاحي" }[r.ref_type || ""] || ""), key: "ref_type" },
          { label: "رقم المصدر", key: "ref_id" },
        ],
        rows,
        summary: { "عدد القيود": rows.length },
      })));
      if (TB.can("accounting", "create"))
        head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => journalEditor(null, reload) }, "➕ قيد يومية جديد"));
      body.appendChild(head);
      const box = TB.el("div");
      body.appendChild(box);
      async function reload() {
        box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
        const out = await TB.api("journals?limit=100");
        rows = out.rows;
        box.innerHTML = "";
        box.appendChild(TB.table(out.rows, [
          { label: "#", render: r => `<b class="mono">${r.id}</b>` },
          { label: "التاريخ", render: r => TB.date(r.date) },
          { label: "البيان", render: r => `<b>${TB.esc(r.memo)}</b><br><small class="muted">${{ "": "يدوي", order: "طلب", purchase: "مشتريات", voucher: "سند", stock_count: "جرد", expense: "مصروف", opening: "افتتاحي" }[r.ref_type || ""] || ""} ${r.ref_id || ""}</small>` },
          { label: "إجراءات", render: r => {
            const d = TB.el("div", { class: "flex" });
            d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => journalView(r.id) }, "👁️"));
            return d;
          } },
        ], { emptyText: "لا قيود" }));
      }
      await reload();
    }
    async function journalView(id) {
      const j = await TB.api("journals/" + id);
      const accs = await TB.options("accounts");
      const an = i => (accs.find(a => a.id === i) || {}).name || "—";
      const rows = (j.lines || []).map(l => ({ حساب: an(l.account_id), مدين: l.debit ? TB.money(l.debit) : "—", دائن: l.credit ? TB.money(l.credit) : "—" }));
      const body2 = TB.el("div");
      body2.appendChild(TB.el("p", { class: "muted" }, `${TB.date(j.date)} — ${TB.esc(j.memo)}`));
      body2.appendChild(TB.table(rows, [
        { label: "الحساب", key: "حساب" }, { label: "مدين", key: "مدين" }, { label: "دائن", key: "دائن" },
      ], { emptyText: "لا بنود" }));
      TB.modal(`قيد #${j.id}`, body2, TB.el("div", { class: "flex" }, '<button class="btn" onclick="this.closest(\'.modal-backdrop\').remove()">إغلاق</button>'));
    }
    async function journalEditor(row, reload) {
      const accs = await TB.options("accounts");
      const memo = TB.el("input", { class: "input", placeholder: "بيان القيد" });
      const date = TB.el("input", { class: "input", type: "date" }); date.value = TB.today();
      const head = TB.el("div", { class: "grid", style: "grid-template-columns:2fr 1fr;gap:10px" });
      [["البيان", memo], ["التاريخ", date]].forEach(([l, x]) => { const f = TB.el("div", { class: "field" }, `<label>${l}</label>`); f.appendChild(x); head.appendChild(f); });
      const editor = TB.el("div", { class: "items-editor", style: "margin-top:12px" });
      const rows = [];
      function addRow() {
        const r = TB.el("div", { class: "irow" });
        const sel = TB.el("select", { class: "input grow" });
        accs.forEach(a => sel.appendChild(TB.el("option", { value: a.id }, `${a.code} — ${a.name}`)));
        const dr = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "مدين" });
        const cr = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "دائن" });
        const del = TB.el("button", { class: "btn btn-sm btn-danger" }, "🗑️");
        del.addEventListener("click", () => { r.remove(); rows.splice(rows.indexOf(r), 1); totals(); });
        dr.addEventListener("input", totals); cr.addEventListener("input", totals);
        r.append(sel, dr, cr, del);
        r._data = () => ({ account_id: Number(sel.value), debit: Number(dr.value) || 0, credit: Number(cr.value) || 0 });
        rows.push(r); editor.appendChild(r); totals();
      }
      editor.appendChild(TB.el("div", { class: "flex between", style: "margin-bottom:8px" }, "<b>بنود القيد</b>"));
      editor.appendChild(TB.el("button", { class: "btn btn-sm btn-soft", onclick: addRow }, "➕ بند"));
      const totEl = TB.el("div", { class: "totals" });
      editor.appendChild(totEl);
      function totals() {
        const d = rows.reduce((s, r) => s + (r._data().debit), 0), c = rows.reduce((s, r) => s + (r._data().credit), 0);
        const ok = Math.abs(d - c) < 0.01 && d > 0;
        totEl.innerHTML = `مدين: <b>${TB.money(d)}</b> — دائن: <b>${TB.money(c)}</b> <span class="badge ${ok ? "badge-success" : "badge-danger"}">${ok ? "متوازن ✅" : "غير متوازن ⚠️"}</span>`;
      }
      addRow(); addRow();
      const wrap = TB.el("div", {}, "");
      wrap.append(head, editor);
      const foot = TB.el("div", { class: "flex" });
      const save = TB.el("button", { class: "btn btn-primary" }, "💾 ترحيل القيد");
      foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
      const md = TB.modal("📒 قيد يومية جديد", wrap, foot, { wide: true });
      save.onclick = async () => {
        save.disabled = true;
        try {
          await TB.api("journals", { method: "POST", body: { date: date.value, memo: memo.value || "قيد يدوي", ref_type: "", approved: 1, lines: rows.map(r => r._data()) } });
          TB.toast("✅ تم ترحيل القيد", "success"); md.close(); reload();
        } catch (e) { TB.toast(e.message, "error"); save.disabled = false; }
      };
    }
    async function renderLedger() {
      body.innerHTML = "";
      const accs = await TB.options("accounts");
      const head = TB.el("div", { class: "toolbar" });
      const sel = TB.el("select", { class: "input" });
      accs.forEach(a => sel.appendChild(TB.el("option", { value: a.id }, `${a.code} — ${a.name}`)));
      head.appendChild(TB.el("span", { class: "muted" }, "اختر حساباً:"));
      head.appendChild(sel);
      head.appendChild(TB.el("div", { class: "spacer" }));
      let lastOut = { rows: [] };
      const accName = () => { const a = accs.find(x => String(x.id) === String(sel.value)); return a ? `${a.code} — ${a.name}` : ""; };
      head.appendChild(TB.exportButtons(() => ({
        file: "ledger", title: "دفتر الأستاذ", subtitle: accName(),
        columns: [
          { label: "التاريخ", key: "date", type: "date" },
          { label: "البيان", key: "memo" },
          { label: "مدين", key: "debit", type: "money" },
          { label: "دائن", key: "credit", type: "money" },
          { label: "الرصيد", key: "balance", type: "money" },
        ],
        rows: lastOut.rows || [],
        summary: lastOut.summary || {},
      })));
      body.appendChild(head);
      const box = TB.el("div");
      body.appendChild(box);
      async function load() {
        if (!sel.value) return;
        const out = await TB.api("reports/ledger?account_id=" + sel.value);
        lastOut = out;
        box.innerHTML = "";
        box.appendChild(TB.el("div", { class: "stat-strip" },
          `<div class="card stat"><span>رصيد الحساب</span><b>${TB.money(out.summary["رصيد الحساب"] || 0)}</b></div>`));
        box.appendChild(renderStatement(out));
      }
      sel.addEventListener("change", load);
      sel.value = accs.length ? accs[0].id : "";
      await load();
    }
  });

  /* ================================================== CASH / BANKS */
  V("cash", async el => {
    el.innerHTML = "";
    const tabs = TB.el("div", { class: "tabs" });
    const body = TB.el("div");
    el.append(tabs, body);
    const t1 = TB.el("button", { class: "tab active" }, "💵 الخزائن");
    const t2 = TB.el("button", { class: "tab" }, "🏦 البنوك");
    tabs.append(t1, t2);
    t1.onclick = () => { t1.classList.add("active"); t2.classList.remove("active"); render("treasury"); };
    t2.onclick = () => { t2.classList.add("active"); t1.classList.remove("active"); render("bank"); };

    async function render(kind) {
      body.innerHTML = "";
      const head = TB.el("div", { class: "toolbar" });
      head.appendChild(TB.el("div", { class: "spacer" }));
      let rows = [];
      head.appendChild(TB.exportButtons(() => ({
        file: kind === "bank" ? "banks" : "cashboxes",
        title: kind === "bank" ? "أرصدة البنوك" : "أرصدة الخزائن",
        columns: [
          { label: "الاسم", key: "name" },
          { label: "الجهة", key: "holder" },
          { label: kind === "bank" ? "رقم الحساب / الآيبان" : "الفرع", key: "account_no" },
          { label: "الرصيد", key: "balance", type: "money" },
        ],
        rows,
        summary: { [kind === "bank" ? "إجمالي أرصدة البنوك" : "إجمالي أرصدة الخزائن"]: rows.reduce((s, r) => s + Number(r.balance || 0), 0) },
      })));
      if (TB.can("cash", "create"))
        head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => cashModal(kind, reload) }, kind === "bank" ? "➕ إضافة بنك" : "➕ إضافة خزينة"));
      body.appendChild(head);
      const box = TB.el("div");
      body.appendChild(box);
      async function reload() {
        const out = await TB.api("cash_accounts?limit=100&fv_kind=" + kind);
        rows = out.rows;
        const total = out.rows.reduce((s, r) => s + r.balance, 0);
        box.innerHTML = "";
        box.appendChild(TB.el("div", { class: "stat-strip" },
          `<div class="card stat"><span>إجمالي رصيد ${kind === "bank" ? "البنوك" : "الخزائن"}</span><b>${TB.money(total)}</b></div>`));
        box.appendChild(TB.table(out.rows, [
          { label: "الاسم", render: r => `<b>${TB.esc(r.name)}</b><br><small class="muted">${TB.esc(r.holder || "")}</small>` },
          { label: kind === "bank" ? "رقم الحساب / الآيبان" : "الفرع", render: r => kind === "bank" ? `<span class="mono">${TB.esc(r.account_no || "—")}</span>` : TB.esc(r._branch || "—") },
          { label: "الرصيد", render: r => `<b class="${r.balance < 0 ? "text-danger" : "text-success"}" style="font-size:1.05rem">${TB.money(r.balance)}</b>` },
          { label: "إجراءات", render: r => {
            const d = TB.el("div", { class: "flex" });
            d.appendChild(TB.el("a", { class: "btn btn-sm btn-soft", href: "#/vouchers?cash=" + r.id }, "📄 الأذون"));
            if (TB.can("cash", "update")) d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => cashModal(kind, reload, r) }, "✏️"));
            if (TB.can("cash", "delete")) d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: () => TB.confirm(`حذف «${r.name}»؟`, async () => { await TB.api("cash_accounts/" + r.id, { method: "DELETE" }); TB.toast("تم الحذف", "success"); reload(); }) }, "🗑️"));
            return d;
          } },
        ], { emptyText: kind === "bank" ? "لا بنوك مضافة" : "لا خزائن مضافة" }));
        const branches = await TB.options("branches").catch(() => []);
        box.querySelectorAll("table.table tbody tr").forEach(() => { });
      }
      await reload();
    }
    function cashModal(kind, reload, row) {
      const f = TB.el("div", { class: "grid", style: "gap:10px" });
      const name = TB.el("input", { class: "input", placeholder: kind === "bank" ? "اسم البنك" : "اسم الخزينة" }); name.value = row ? row.name : "";
      const holder = TB.el("input", { class: "input", placeholder: kind === "bank" ? "الجهة المالكة للحساب" : "المسؤول / الفرع" }); holder.value = row ? row.holder || "" : "";
      const accNo = TB.el("input", { class: "input", placeholder: kind === "bank" ? "رقم الحساب / الآيبان" : "رقم الدفتر" }); accNo.value = row ? row.account_no || "" : "";
      [["الاسم", name], ["الجهة", holder], ["رقم الحساب", accNo]].forEach(([l, x]) => { const fld = TB.el("div", { class: "field" }, `<label>${l}</label>`); fld.appendChild(x); f.appendChild(fld); });
      const foot = TB.el("div", { class: "flex" });
      const save = TB.el("button", { class: "btn btn-primary" }, "💾 حفظ");
      foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
      const md = TB.modal((row ? "تعديل" : "إضافة") + (kind === "bank" ? " بنك" : " خزينة"), f, foot);
      save.onclick = async () => {
        try {
          const body = { kind, name: name.value, holder: holder.value, account_no: accNo.value };
          if (row) await TB.api("cash_accounts/" + row.id, { method: "PUT", body });
          else await TB.api("cash_accounts", { method: "POST", body });
          TB.toast("✅ تم الحفظ", "success"); md.close(); TB.clearOptions(); reload();
        } catch (e) { TB.toast(e.message, "error"); }
      };
    }
    await render("treasury");
  });

  /* ================================================== VOUCHERS */
  V("vouchers", async el => {
    el.innerHTML = "";
    const params = new URLSearchParams((location.hash.split("?")[1] || ""));
    const head = TB.el("div", { class: "toolbar" });
    const selKind = TB.el("select", { class: "input" });
    [["", "كل الأذون"], ["receipt", "أذون قبض"], ["payment", "أذون صرف"]].forEach(([v, l]) => selKind.appendChild(TB.el("option", { value: v }, l)));
    head.appendChild(selKind);
    head.appendChild(TB.el("div", { class: "spacer" }));
    head.appendChild(TB.exportButtons(() => {
      const rows = lastRows.map(r => ({ ...r, _ref: r.ref || "#" + r.id, _kind: r.kind === "receipt" ? "قبض" : "صرف", _st: r.approved ? "معتمد" : "قيد الاعتماد" }));
      const rec = lastRows.filter(r => r.kind === "receipt").reduce((s, r) => s + r.amount, 0);
      const pay = lastRows.filter(r => r.kind === "payment").reduce((s, r) => s + r.amount, 0);
      return {
        file: "vouchers", title: "أذون القبض والصرف", sheet: "الأذون",
        subtitle: cashFilter ? "محصور على: " + ((lastRows[0] || {})._cash || "") : "كل الخزائن والبنوك",
        columns: [
          { label: "السند", key: "_ref" }, { label: "النوع", key: "_kind" },
          { label: "التاريخ", key: "date", type: "date" }, { label: "البيان", key: "memo" },
          { label: "الخزينة/البنك", key: "_cash" }, { label: "المبلغ", key: "amount", type: "money" },
          { label: "الحالة", key: "_st" },
        ],
        rows,
        summary: { "إجمالي القبض": TB.money(rec), "إجمالي الصرف": TB.money(pay), "الصافي": TB.money(rec - pay), "عدد الأذون": rows.length },
        meta: { "النوع": selKind.value ? selKind.options[selKind.selectedIndex].text : "كل الأذون", "تاريخ التصدير": TB.dt(new Date().toISOString()) },
      };
    }));
    if (TB.can("vouchers", "create"))
      head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => voucherModal(reload) }, "➕ سند جديد"));
    el.appendChild(head);
    const box = TB.el("div");
    el.appendChild(box);
    let cashFilter = params.get("cash") || "";
    let lastRows = [];
    const chip = TB.el("span", { class: "filter-chip hidden" }, "");
    head.appendChild(chip);
    async function reload() {
      box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      const qs = new URLSearchParams({ limit: 200 });
      if (selKind.value) qs.set("fv_kind", selKind.value);
      if (cashFilter) qs.set("fv_cash_account_id", cashFilter);
      const out = await TB.api("vouchers?" + qs);
      const cash = await TB.options("cash_accounts");
      const rows = out.rows;
      rows.forEach(r => r._cash = (cash.find(c => c.id === r.cash_account_id) || {}).name || "—");
      lastRows = rows;
      /* شريحة توضّح الفلترة على خزينة/بنك محدد */
      const acc = cash.find(c => String(c.id) === String(cashFilter));
      if (cashFilter) {
        chip.className = "filter-chip";
        chip.innerHTML = `<span>🏦 محصور على: <b>${TB.esc(acc ? acc.name : "#" + cashFilter)}</b></span><span class="x" title="إلغاء الفلتر">✕</span>`;
        chip.onclick = () => { cashFilter = ""; history.replaceState(null, "", "#/vouchers"); reload(); };
      } else { chip.className = "filter-chip hidden"; chip.onclick = null; chip.innerHTML = ""; }

      box.innerHTML = "";
      const rec = rows.filter(r => r.kind === "receipt").reduce((s, r) => s + r.amount, 0);
      const pay = rows.filter(r => r.kind === "payment").reduce((s, r) => s + r.amount, 0);
      const strip = TB.el("div", { class: "stat-strip" });
      strip.innerHTML =
        `<div class="card stat"><span>📥 إجمالي القبض</span><b class="text-success">${TB.money(rec)}</b></div>
         <div class="card stat"><span>📤 إجمالي الصرف</span><b class="text-danger">${TB.money(pay)}</b></div>
         <div class="card stat"><span>⚖️ الصافي</span><b class="${rec - pay < 0 ? "text-danger" : "text-success"}">${TB.money(rec - pay)}</b></div>
         <div class="card stat"><span>🧾 عدد الأذون</span><b>${TB.num(rows.length)}</b></div>`;
      box.appendChild(strip);
      box.appendChild(TB.table(rows, [
        { label: "السند", csv: r => r.ref || ("#" + r.id), render: r => `<b class="mono">${TB.esc(r.ref || "#" + r.id)}</b>` },
        { label: "النوع", csv: r => r.kind === "receipt" ? "قبض" : "صرف", render: r => r.kind === "receipt" ? '<span class="badge badge-success">📥 قبض</span>' : '<span class="badge badge-danger">📤 صرف</span>' },
        { label: "التاريخ", csv: r => r.date, render: r => TB.date(r.date) },
        { label: "البيان", render: r => TB.esc(r.memo || "") },
        { label: "الخزينة/البنك", key: "_cash" },
        { label: "المبلغ", csv: r => r.amount, render: r => `<b class="${r.kind === "receipt" ? "text-success" : "text-danger"}">${TB.money(r.amount)}</b>` },
        { label: "الحالة", csv: r => r.approved ? "معتمد" : "قيد الاعتماد", render: r => r.approved ? '<span class="badge badge-success">معتمد</span>' : '<span class="badge badge-warning">قيد الاعتماد</span>' },
        { label: "إجراءات", render: r => {
          const d = TB.el("div", { class: "flex" });
          if (!r.approved && TB.can("vouchers", "update"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-success", onclick: async () => { try { await TB.api(`vouchers/${r.id}/approve`, { method: "POST", body: {} }); TB.toast("✅ تم اعتماد السند وتحديث الأرصدة", "success"); reload(); } catch (e) { TB.toast(e.message, "error"); } } }, "✅ اعتماد"));
          if (!r.approved && TB.can("vouchers", "delete"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: () => TB.confirm("حذف السند؟", async () => { await TB.api("vouchers/" + r.id, { method: "DELETE" }); TB.toast("تم الحذف", "success"); reload(); }) }, "🗑️"));
          return d;
        } },
      ], { emptyText: "لا أذون" }));
    }
    selKind.addEventListener("change", reload);
    await reload();
    /* فتح نموذج سند جديد مباشرة عند الوصول من زر «سند قبض/صرف» في شاشة الخزائن */
    if (params.get("new")) voucherModal(reload);

    async function voucherModal(reload2) {
      const cashAll = await TB.api("cash_accounts?limit=100");
      const f = TB.el("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px" });
      const kind = TB.el("select", { class: "input" });
      [["payment", "سند صرف (دفع)"], ["receipt", "سند قبض (استلام)"]].forEach(([v, l]) => kind.appendChild(TB.el("option", { value: v }, l)));
      const ca = TB.el("select", { class: "input" });
      cashAll.rows.forEach(c => ca.appendChild(TB.el("option", { value: c.id }, `${c.name} (رصيد ${TB.num(c.balance)})`)));
      if (cashFilter && cashAll.rows.some(c => String(c.id) === String(cashFilter))) ca.value = String(cashFilter);
      const partyType = TB.el("select", { class: "input" });
      [["other", "أخرى / مصروف"], ["supplier", "مورد"], ["customer", "عميل"]].forEach(([v, l]) => partyType.appendChild(TB.el("option", { value: v }, l)));
      const party = TB.el("select", { class: "input" });
      const amount = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "المبلغ" });
      const date = TB.el("input", { class: "input", type: "date" }); date.value = TB.today();
      const memo = TB.el("input", { class: "input", placeholder: "البيان" });
      const ref = TB.el("input", { class: "input", placeholder: "رقم السند" });
      async function fillParty() {
        party.innerHTML = '<option value="">— اختر —</option>';
        if (partyType.value === "other") return;
        const list = await TB.options(partyType.value === "customer" ? "customers" : "suppliers");
        list.forEach(x => party.appendChild(TB.el("option", { value: x.id }, x.name)));
      }
      partyType.addEventListener("change", fillParty);
      await fillParty();
      [["النوع", kind], ["الخزينة / البنك", ca], ["نوع الطرف", partyType], ["الطرف", party], ["المبلغ", amount], ["التاريخ", date], ["البيان", memo], ["رقم السند", ref]].forEach(([l, x]) => {
        const fld = TB.el("div", { class: "field" }, `<label>${l}</label>`); fld.appendChild(x); f.appendChild(fld);
      });
      const foot = TB.el("div", { class: "flex" });
      const save = TB.el("button", { class: "btn btn-primary" }, "💾 حفظ واعتماد");
      foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
      const md = TB.modal("📄 سند قبض / صرف", f, foot, { wide: true });
      save.onclick = async () => {
        save.disabled = true;
        try {
          const caRow = cashAll.rows.find(c => String(c.id) === ca.value);
          await TB.api("vouchers", { method: "POST", body: {
            kind: kind.value, source: caRow && caRow.kind === "bank" ? "bank" : "cash",
            cash_account_id: Number(ca.value), party_type: partyType.value, party_id: party.value ? Number(party.value) : null,
            amount: Number(amount.value) || 0, date: date.value, memo: memo.value, ref: ref.value, approved: 1,
          }});
          TB.toast("✅ تم اعتماد السند وتحديث الأرصدة واليومية", "success"); md.close(); reload2();
        } catch (e) { TB.toast(e.message, "error"); save.disabled = false; }
      };
    }
  });

  /* ================================================== REPORTS */
  function renderStatement(out) {
    const wrap = TB.el("div", { class: "table-wrap card pad-0" });
    const t = TB.el("table", { class: "table" });
    const isFin = out.columns.includes("code");
    t.innerHTML = "<thead><tr>" + out.columns.map(c => {
      const lbl = { code: "الكود", name: "البيان", date: "التاريخ", memo: "البيان", debit: "مدين", credit: "دائن", balance: "الرصيد" }[c] || c;
      return `<th>${lbl}</th>`;
    }).join("") + "</tr></thead>";
    const tb = TB.el("tbody");
    for (const r of out.rows) {
      const tr = TB.el("tr");
      const isSection = !r.code && !r.debit && !r.credit && (r.balance === "" || r.balance === undefined);
      if (isSection) tr.className = "section-row";
      for (const c of out.columns) {
        const td = TB.el("td", { "data-label": c });
        let v = r[c];
        if (c === "date" && v) {
          td.textContent = TB.date(v);
        } else if (["debit", "credit", "balance"].includes(c) && v !== "" && v !== undefined && v !== null) {
          td.innerHTML = `<b class="${Number(v) < 0 ? "text-danger" : ""}">${TB.money(v)}</b>`;
        } else {
          td.textContent = v === null || v === undefined ? "" : v;
          if (c === "name") td.style.paddingInlineStart = isSection ? "0" : "18px";
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }
  function renderSummary(summary) {
    const g = TB.el("div", { class: "summary-cards" });
    for (const [k, v] of Object.entries(summary || {})) {
      g.appendChild(TB.el("div", { class: "card" }, `<div class="muted" style="font-size:.83rem">${TB.esc(k)}</div><div class="v">${typeof v === "number" ? (k.includes("٪") || k.includes("نسبة") ? TB.num(v) + "٪" : TB.money(v)) : TB.esc(v)}</div>`));
    }
    return g;
  }

  V("reports", async el => {
    el.innerHTML = "";
    const REPORTS = [
      ["sales", "📉 المبيعات", true], ["profit", "💰 الأرباح حسب الصنف", false], ["orders", "🧾 سجل الأوردرات", false],
      ["inventory", "📦 المخزون والقيم", false], ["moves", "🔄 حركات المخزون", false],
      ["customers", "👥 العملاء", false], ["staff", "🛵 أداء الطيارين", false], ["suppliers", "🚚 أرصدة الموردين", false],
      ["payments", "💳 المدفوعات وإثباتات التحويل", false],
      ["purchases", "🛒 المشتريات", false], ["cashflow", "💵 حركة الخزائن والبنوك", false],
      ["trial-balance", "⚖️ ميزان المراجعة", false], ["income-statement", "📊 قائمة الدخل", false], ["balance-sheet", "🏛️ الميزانية العمومية", false],
    ];
    const head = TB.el("div", { class: "toolbar" });
    const sel = TB.el("select", { class: "input" });
    REPORTS.forEach(([v, l]) => sel.appendChild(TB.el("option", { value: v }, l)));
    const from = TB.el("input", { class: "input", type: "date" }); from.value = TB.daysAgo(30);
    const to = TB.el("input", { class: "input", type: "date" }); to.value = TB.today();
    const grp = TB.el("select", { class: "input" });
    [["day", "أياميًا"], ["product", "حسب الصنف"], ["category", "حسب القسم"], ["pilot", "حسب الطيار"], ["branch", "حسب الفرع"], ["payment", "حسب وسيلة الدفع"], ["status", "حسب الحالة"]].forEach(([v, l]) => grp.appendChild(TB.el("option", { value: v }, l)));
    const runBtn = TB.el("button", { class: "btn btn-primary" }, "🔎 عرض التقرير");
    head.append(TB.el("span", { class: "muted" }, "التقرير:"), sel, TB.el("span", { class: "muted" }, "من:"), from, TB.el("span", { class: "muted" }, "إلى:"), to, grp, runBtn,
      TB.exportButtons(() => ({
        file: `${sel.value}-${from.value}_${to.value}`,
        title: (curOut && curOut.title) || sel.options[sel.selectedIndex].text,
        sheet: (curOut && curOut.title) || sel.value,
        subtitle: `${TB.date(from.value)} — ${TB.date(to.value)}`,
        columns: curOut ? reportCols(curOut) : [],
        rows: (curOut && curOut.rows) || [],
        summary: (curOut && curOut.summary) || {},
        meta: curOut ? reportMeta(curOut) : {},
      })));
    el.appendChild(head);
    const box = TB.el("div");
    el.appendChild(box);
    let curOut = null;
    const LBL = { code: "الكود", name: "البيان", debit: "مدين", credit: "دائن", balance: "الرصيد" };
    const reportCols = out => out.columns.map(c => ({ label: LBL[c] || c, key: c, type: ["debit", "credit", "balance"].includes(c) ? "money" : undefined }));
    const reportMeta = out => ({ "الفترة": `${TB.date(from.value)} — ${TB.date(to.value)}`, "تاريخ التصدير": TB.dt(new Date().toISOString()), "إجمالي السجلات": TB.num((out.rows || []).length) });
    async function run() {
      box.innerHTML = '<div class="empty">⏳ جاري إنشاء التقرير...</div>';
      try {
        const qs = new URLSearchParams({ from: from.value, to: to.value });
        if (sel.value === "sales") qs.set("group", grp.value);
        const out = await TB.api("reports/" + sel.value + "?" + qs);
        curOut = out;
        box.innerHTML = "";
        const title = TB.el("div", { class: "card-head" }, `<h3 class="card-title">${TB.esc(out.title || sel.options[sel.selectedIndex].text)}</h3><span class="muted">${TB.date(from.value)} — ${TB.date(to.value)}</span>`);
        box.appendChild(title);
        const isFin = out.columns.includes("code");
        box.appendChild(isFin ? renderStatement(out) : TB.table(out.rows, out.columns.map(c => ({ label: LBL[c] || c, key: c })), { emptyText: "لا بيانات في هذه الفترة" }));
        box.appendChild(renderSummary(out.summary));
      } catch (e) { box.innerHTML = ""; box.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    }
    runBtn.addEventListener("click", run);
    sel.addEventListener("change", () => { grp.style.display = sel.value === "sales" ? "" : "none"; });
    grp.style.display = "none";
    await run();
  });

  /* ================================================== ERP COMMAND CENTER */
  V("erp", async el => {
    el.innerHTML = "";
    let from = TB.daysAgo(90), to = TB.today();

    const hero = TB.el("div", { class: "erp-hero" });
    hero.innerHTML = `
      <div class="erp-hero-copy">
        <span class="erp-eyebrow">ERP • إدارة مالية وتشغيلية متكاملة</span>
        <h2>مركز قيادة التوصيل</h2>
        <p>صورة موحّدة للإيرادات والتوصيل والتكاليف والمخزون والسيولة — مع مؤشرات جاهزة لاتخاذ القرار اليومي.</p>
        <div class="erp-hero-actions">
          <a class="btn btn-primary" href="#/accounting">📚 دليل الحسابات</a>
          <a class="btn" href="#/vouchers">🧾 سندات القبض والصرف</a>
          <a class="btn" href="#/reports">📊 التقارير المالية</a>
          <a class="btn" href="#/backup">🛡️ النسخ الاحتياطي</a>
        </div>
      </div>
      <div class="erp-hero-mark">
        <div class="erp-hero-ring">ERP</div>
        <small>Delivery Finance</small>
      </div>`;
    el.appendChild(hero);

    const toolbar = TB.el("div", { class: "toolbar card erp-toolbar" });
    const fromI = TB.el("input", { class: "input", type: "date" }); fromI.value = from;
    const toI = TB.el("input", { class: "input", type: "date" }); toI.value = to;
    const runBtn = TB.el("button", { class: "btn btn-primary" }, "🔄 تحديث المؤشرات");
    const printBtn = TB.el("button", { class: "btn" }, "🖨️ طباعة");
    toolbar.append(TB.el("span", { class: "muted" }, "من:"), fromI, TB.el("span", { class: "muted" }, "إلى:"), toI, runBtn, TB.el("div", { class: "spacer" }), printBtn);
    el.appendChild(toolbar);

    const body = TB.el("div");
    el.appendChild(body);

    function kpi(label, value, icon, tone, sub) {
      return `<div class="erp-kpi ${tone || ""}">
        <div class="erp-kpi-icon">${icon}</div>
        <div class="erp-kpi-body"><div class="erp-kpi-label">${label}</div><div class="erp-kpi-value">${value}</div>${sub ? `<div class="erp-kpi-sub">${sub}</div>` : ""}</div>
      </div>`;
    }
    function section(title, sub, node) {
      const card = TB.el("div", { class: "card erp-section" });
      card.appendChild(TB.el("div", { class: "card-head" }, `<h3 class="card-title">${title}</h3>${sub ? `<span class="muted">${sub}</span>` : ""}`));
      card.appendChild(node);
      return card;
    }

    async function run() {
      from = fromI.value || TB.daysAgo(30);
      to = toI.value || TB.today();
      body.innerHTML = '<div class="empty">⏳ جاري تجميع بيانات ERP...</div>';
      try {
        const qs = new URLSearchParams({ from, to });
        const out = await TB.api("reports/erp-overview?" + qs);
        const k = out.kpis;
        body.innerHTML = "";

        const kpis = TB.el("div", { class: "erp-kpis" });
        kpis.innerHTML = [
          kpi("إيرادات التشغيل", TB.money(k.revenue), "💰", "success", `من ${TB.num(k.delivered)} طلب مُسلّم`),
          kpi("إيراد التوصيل", TB.money(k.delivery), "🛵", "info", `${TB.num(k.delivery_share)}٪ من الإيراد`),
          kpi("تكلفة المبيعات", TB.money(k.cogs), "📦", "warning", "تكلفة الأصناف المباعة"),
          kpi("الربح الإجمالي", TB.money(k.gross_profit), "📈", "success", `هامش ${TB.num(k.gross_margin)}٪`),
          kpi("المصروفات المحاسبية", TB.money(k.expenses), "🧾", "danger", "من اليومية المعتمدة"),
          kpi("صافي الدخل", TB.money(k.net_profit), "🏁", "primary", "إيراد اليومية − المصروفات"),
          kpi("السيولة المتاحة", TB.money(k.liquidity), "🏦", "info", `خزائن ${TB.money(k.cash)} • بنوك ${TB.money(k.bank)}`),
          kpi("مستحقات العملاء", TB.money(k.receivables), "👥", "warning", "طلبات غير مسددة"),
          kpi("مستحقات الموردين", TB.money(k.payables), "🚚", "danger", "أرصدة دائنة"),
          kpi("قيمة المخزون", TB.money(k.inventory_value), "🏷️", "primary", "بالتكلفة الدفترية"),
          kpi("متوسط قيمة الطلب", TB.money(k.avg_order), "🧾", "info", `${TB.num(k.orders)} طلب في الفترة`),
          kpi("عمولات الطيارين التقديرية", TB.money(k.pilot_commissions), "🛵", "success", "١٥٪ من رسوم التوصيل"),
        ].join("");
        body.appendChild(kpis);

        const grid = TB.el("div", { class: "erp-grid" });

        const dailyWrap = TB.el("div", { class: "erp-chart-wrap" });
        const daily = out.daily || [];
        const max = Math.max(1, ...daily.map(d => Number(d.revenue) || 0));
        const chart = TB.el("div", { class: "erp-chart" });
        if (!daily.length) chart.innerHTML = '<div class="empty">لا توجد حركة في هذه الفترة</div>';
        daily.forEach(d => {
          const h = Math.max(2, Math.round(((Number(d.revenue) || 0) / max) * 100));
          const col = TB.el("div", { class: "erp-bar-col", title: `${d.d} — ${TB.money(d.revenue)}` });
          col.innerHTML = `<div class="erp-bar" style="height:${h}%"></div><span>${String(d.d || "").slice(5)}</span>`;
          chart.appendChild(col);
        });
        dailyWrap.appendChild(chart);
        grid.appendChild(section("📈 حركة الإيراد اليومي", `${TB.date(from)} — ${TB.date(to)}`, dailyWrap));

        const health = TB.el("div", { class: "erp-health" });
        const rows = [
          ["طلبات مُسلّمة", k.delivered, "success"],
          ["طلبات قيد التنفيذ", k.pending, "warning"],
          ["طلبات ملغاة", k.cancelled, "danger"],
          ["نسبة إيراد التوصيل", TB.num(k.delivery_share) + "٪", "info"],
          ["هامش الربح الإجمالي", TB.num(k.gross_margin) + "٪", "primary"],
        ];
        rows.forEach(([label, value, tone]) => {
          health.appendChild(TB.el("div", { class: "erp-health-row" }, `<span>${label}</span><b class="text-${tone}">${value}</b>`));
        });
        grid.appendChild(section("🧭 صحة التشغيل", "مؤشرات سريعة", health));
        body.appendChild(grid);

        const pilotsCard = section("🛵 تسويات وأداء الطيارين", "العمولة التقديرية ١٥٪ من رسوم التوصيل — قابلة للتعديل عند اعتماد السند", TB.table(out.pilots || [], [
          { label: "الطيار", render: r => `<b>${TB.esc(r.name || "—")}</b><br><small class="muted">${TB.esc(r.phone || "")}</small>` },
          { label: "الطلبات", render: r => TB.num(r.orders) },
          { label: "المحصّل", render: r => TB.money(r.collected) },
          { label: "رسوم التوصيل", render: r => TB.money(r.delivery) },
          { label: "عمولة تقديرية", render: r => `<b class="text-success">${TB.money(r.commission)}</b>` },
          { label: "التقييم", render: r => r.rating ? `⭐ ${TB.num(r.rating)}` : "—" },
        ], { emptyText: "لا توجد طلبات مسندة لطيارين في هذه الفترة" }));
        body.appendChild(pilotsCard);

        const grid2 = TB.el("div", { class: "erp-grid" });
        grid2.appendChild(section("🏢 أداء الفروع", "الإيراد ورسوم التوصيل", TB.table(out.branches || [], [
          { label: "الفرع", render: r => TB.esc(r.name || "—") },
          { label: "الطلبات", render: r => TB.num(r.orders) },
          { label: "الإيراد", render: r => TB.money(r.revenue) },
          { label: "التوصيل", render: r => TB.money(r.delivery) },
        ], { emptyText: "لا توجد فروع" })));
        grid2.appendChild(section("💳 وسائل الدفع", "توزيع التحصيل", TB.table(out.payments || [], [
          { label: "الوسيلة", render: r => TB.esc(r.name || "غير محدد") },
          { label: "الطلبات", render: r => TB.num(r.orders) },
          { label: "الإجمالي", render: r => TB.money(r.total) },
        ], { emptyText: "لا توجد مدفوعات" })));
        body.appendChild(grid2);

        const actions = TB.el("div", { class: "erp-actions" });
        [
          ["📚", "دليل الحسابات", "إدارة شجرة الحسابات والأرصدة", "#/accounting"],
          ["🧾", "سند قبض / صرف", "تسجيل التحصيل والمصروفات", "#/vouchers"],
          ["🛒", "فواتير المشتريات", "إدارة الموردين والتكاليف", "#/purchases"],
          ["📊", "التقارير المالية", "قائمة الدخل والميزانية", "#/reports"],
          ["🛡️", "النسخ الاحتياطي", "حماية بياناتك واستعادتها", "#/backup"],
        ].forEach(([icon, title, desc, href]) => {
          actions.appendChild(TB.el("a", { class: "erp-action", href }, `<span>${icon}</span><div><b>${title}</b><small>${desc}</small></div>`));
        });
        body.appendChild(section("⚡ إجراءات سريعة", "انتقل مباشرةً إلى العملية المطلوبة", actions));
      } catch (e) {
        body.innerHTML = "";
        body.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message)));
      }
    }
    runBtn.addEventListener("click", run);
    printBtn.addEventListener("click", () => window.print());
    await run();
  });
})();
