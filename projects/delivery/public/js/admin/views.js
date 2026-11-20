/* ============================================================
   طلباتك — Admin views: dashboard, orders, inventory, purchases,
   stock counts, settings, barcode labels
   ============================================================ */
(function () {
  "use strict";
  const V = window.registerView;

  /* ================================================== DASHBOARD */
  V("dashboard", async el => {
    el.innerHTML = '<div class="empty">⏳ جاري تحميل لوحة التحكم...</div>';
    const d = await TB.api("reports/dashboard");
    el.innerHTML = "";
    const k = d.kpis;
    const kpiRows = [
      { item: "طلبات اليوم", value: k.orders_today, kind: "num" },
      { item: "مبيعات اليوم", value: k.revenue_today, kind: "money" },
      { item: "مبيعات الشهر", value: k.revenue_month, kind: "money" },
      { item: "طلبات قيد التنفيذ", value: k.pending_orders, kind: "num" },
      { item: "عدد العملاء", value: k.customers, kind: "num" },
      { item: "أصناف تحت حد الطلب", value: k.low_stock, kind: "num" },
      { item: "أرصدة الخزائن", value: k.cash_balance, kind: "money" },
      { item: "أرصدة البنوك", value: k.bank_balance, kind: "money" },
      { item: "متوسط تقييم الطلبات", value: k.avg_rating, kind: "num" },
      { item: "إثباتات دفع قيد المراجعة", value: k.proofs_pending, kind: "num" },
      { item: "مبلغ إثباتات قيد المراجعة", value: k.proofs_amount, kind: "money" },
      { item: "طلبات غير مدفوعة", value: k.unpaid_orders, kind: "num" },
    ];
    const dashHead = TB.el("div", { class: "toolbar" });
    dashHead.appendChild(TB.el("div", { class: "spacer" }));
    dashHead.appendChild(TB.exportButtons(() => ({
      file: "dashboard", title: "ملخص لوحة التحكم", subtitle: TB.dt(new Date().toISOString()),
      columns: [
        { label: "المؤشر", key: "item" },
        { label: "القيمة", csv: r => String(r.value ?? ""), key: "value" },
      ],
      rows: kpiRows,
      summary: { "مبيعات اليوم": k.revenue_today, "مبيعات الشهر": k.revenue_month },
    })));
    el.appendChild(dashHead);
    const cards = [
      ["📦", "طلبات اليوم", TB.num(k.orders_today), "var(--primary-soft)", "var(--primary)"],
      ["💰", "مبيعات اليوم", TB.money(k.revenue_today), "var(--success-soft)", "var(--success)"],
      ["📈", "مبيعات الشهر", TB.money(k.revenue_month), "var(--info-soft)", "var(--info)"],
      ["🧾", "طلبات قيد التنفيذ", TB.num(k.pending_orders), "var(--warning-soft)", "var(--warning)"],
      ["👥", "العملاء", TB.num(k.customers), "var(--secondary-soft)", "var(--secondary)"],
      ["⚠️", "أصناف تحت حد الطلب", TB.num(k.low_stock), "var(--danger-soft)", "var(--danger)"],
      ["💵", "الخزائن", TB.money(k.cash_balance), "var(--success-soft)", "var(--success)"],
      ["🏦", "البنوك", TB.money(k.bank_balance), "var(--info-soft)", "var(--info)"],
      ["🧾", "إثباتات دفع للمراجعة", TB.num(k.proofs_pending), "var(--warning-soft)", "var(--warning)"],
      ["💰", "مبلغ إثباتات للمراجعة", TB.money(k.proofs_amount), "var(--primary-soft)", "var(--primary)"],
    ];
    const grid = TB.el("div", { class: "grid cols-4", style: "margin-bottom:16px" });
    for (const [ic, lbl, val, bg, fg] of cards) {
      grid.appendChild(TB.el("div", { class: "card" },
        `<div class="kpi"><div class="ic" style="background:${bg};color:${fg}">${ic}</div><div style="min-width:0"><div class="val">${val}</div><div class="lbl">${lbl}</div></div></div>`));
    }
    el.appendChild(grid);

    /* chart */
    const days = d.chart.days;
    const max = Math.max(1, ...days.map(x => x.revenue));
    const chartCard = TB.el("div", { class: "card", style: "margin-bottom:16px" },
      `<div class="card-head"><h3 class="card-title">📉 المبيعات — آخر ١٤ يوم</h3><span class="badge badge-success">⭐ متوسط تقييم الطلبات ${TB.num(k.avg_rating)}</span></div>`);
    const chart = TB.el("div", { class: "chart" });
    for (const dd of days) {
      const h = Math.round((dd.revenue / max) * 100);
      chart.appendChild(TB.el("div", { class: "bar", title: `${dd.d}: ${TB.money(dd.revenue)}` },
        `<span class="v">${dd.revenue ? TB.num(Math.round(dd.revenue)) : ""}</span><div class="b" style="height:${Math.max(3, h)}%"></div><span class="d">${(dd.d || "").slice(5)}</span>`));
    }
    if (!days.length) chart.appendChild(TB.el("div", { class: "empty" }, "لا توجد بيانات"));
    chartCard.appendChild(chart);
    el.appendChild(chartCard);

    /* statuses + low stock + top products */
    const stNames = window.STATUS;
    const stCard = TB.el("div", { class: "card" }, `<h3 class="card-title" style="margin-bottom:10px">📊 حالات الأوردرات</h3>`);
    const stWrap = TB.el("div", { class: "flex", style: "gap:10px" });
    for (const s of d.chart.statuses) {
      stWrap.appendChild(TB.el("a", { class: "badge " + (stNames[s.status] || ["", "badge-muted"])[1], href: "#/orders?status=" + s.status, style: "padding:.5em .9em" },
        `${(stNames[s.status] || ["", ""])[0]}: ${TB.num(s.count)}`));
    }
    stCard.appendChild(stWrap);
    const lowCard = TB.el("div", { class: "card" }, `<h3 class="card-title" style="margin-bottom:10px">⚠️ أصناف تحت حد الطلب</h3>`);
    lowCard.appendChild(TB.table(d.low_stock, [
      { label: "الصنف", key: "name" },
      { label: "الرصيد", render: r => `<b class="text-danger">${TB.num(r.stock)} ${TB.esc(r.unit)}</b>` },
      { label: "حد الطلب", key: "min_stock" },
    ], { emptyText: "كل الأصناف بمستويات جيدة ✅", emptyIcon: "✅" }));
    const row = TB.el("div", { class: "grid cols-2", style: "margin-bottom:16px" });
    row.append(stCard, lowCard);
    el.appendChild(row);

    /* top products + recent orders */
    const topCard = TB.el("div", { class: "card" }, `<h3 class="card-title" style="margin-bottom:10px">🏆 أكثر الأصناف مبيعاً</h3>`);
    topCard.appendChild(TB.table(d.top_products, [
      { label: "الصنف", key: "name" },
      { label: "الكمية", render: r => TB.num(r.qty) },
      { label: "الإيراد", render: r => `<b class="price">${TB.money(r.revenue)}</b>` },
    ], { emptyText: "لا مبيعات بعد" }));
    const recCard = TB.el("div", { class: "card" }, `<div class="card-head"><h3 class="card-title">🧾 أحدث الأوردرات</h3><a class="btn btn-sm btn-soft" href="#/orders">عرض الكل</a></div>`);
    recCard.appendChild(TB.table(d.recent_orders, [
      { label: "الكود", render: r => `<b class="mono">${TB.esc(r.code)}</b>` },
      { label: "العميل", key: "customer" },
      { label: "الطيار", key: "pilot" },
      { label: "الإجمالي", render: r => TB.money(r.total) },
      { label: "الحالة", render: r => `<span class="badge ${stNames[r.status][1]}">${stNames[r.status][0]}</span>` },
    ], { onRow: r => window.showOrder(r.id), emptyText: "لا طلبات" }));
    const row2 = TB.el("div", { class: "grid cols-2" });
    row2.append(topCard, recCard);
    el.appendChild(row2);
  });

  /* ================================================== ORDERS */
  const statusFlow = { new: ["confirmed", "تأكيد"], confirmed: ["preparing", "تجهيز"], preparing: ["delivering", "بدء التوصيل"], delivering: ["delivered", "تم التسليم"] };

  function orderQs(filters) {
    const qs = new URLSearchParams({ limit: 500 });
    if (filters.status) qs.set("fv_status", filters.status);
    if (filters.customer) qs.set("fv_customer_id", filters.customer);
    if (filters.search) qs.set("search", filters.search);
    return qs;
  }
  const ORDER_COLS = [
    { label: "الكود", key: "code" },
    { label: "العميل", key: "customer" },
    { label: "الهاتف", key: "phone" },
    { label: "المنطقة", key: "_zone" },
    { label: "الطيار", key: "pilot" },
    { label: "وسيلة الدفع", key: "payment" },
    { label: "الحالة", csv: r => (window.STATUS[r.status] || ["", ""])[0] || r.status, key: "status" },
    { label: "الإجمالي", key: "total", type: "money" },
    { label: "التوصيل", key: "delivery_fee", type: "money" },
    { label: "السداد", csv: r => r.paid === "paid" ? "مدفوع" : "غير مدفوع", key: "paid" },
    { label: "حالة إثبات الدفع", csv: r => ({ none: "بدون إثبات", pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" }[r.proof_status] || ""), key: "proof_status" },
    { label: "العنوان", key: "address" },
    { label: "التاريخ", key: "created_at", type: "dt" },
  ];
  async function exportOrdersData(filters) {
    const out = await TB.api("orders?" + orderQs(filters));
    const rows = out.rows.map(o => ({ ...o, _zone: o.zone || "" }));
    return {
      file: "orders", title: "سجل الأوردرات", sheet: "الأوردرات",
      columns: ORDER_COLS, rows,
      summary: {
        "عدد الأوردرات": rows.length,
        "إجمالي المبيعات": TB.money(rows.reduce((s, o) => s + Number(o.total || 0), 0)),
        "إجمالي التوصيل": TB.money(rows.reduce((s, o) => s + Number(o.delivery_fee || 0), 0)),
      },
      meta: {
        "الحالة": filters.status ? (window.STATUS[filters.status] || ["", ""])[0] : "كل الحالات",
        "بحث": filters.search || "—",
        "تاريخ التصدير": TB.dt(new Date().toISOString()),
      },
    };
  }

  async function loadOrdersInto(el, filters) {
    const qs = orderQs(filters);
    const out = await TB.api("orders?" + qs);
    const box = el.querySelector("#orders-body");
    box.innerHTML = "";
    if (!out.rows.length) { box.appendChild(TB.el("div", { class: "empty" }, '<span class="emoji">📭</span>لا توجد أوردرات هنا')); return; }
    const board = TB.el("div", { class: "board" });
    for (const o of out.rows) {
      board.appendChild(orderCard(o, () => loadOrdersInto(el, filters)));
    }
    box.appendChild(board);
  }

  function orderCard(o, reload) {
    const st = window.STATUS[o.status] || ["", "badge-muted"];
    const c = TB.el("div", { class: "order-card" });
    c.appendChild(TB.el("div", { class: "head" },
      `<b class="mono">${TB.esc(o.code)}</b><span class="badge ${st[1]}">${st[0]}</span>`));
    c.appendChild(TB.el("div", {}, `<div class="cust">👤 ${TB.esc(o.customer || "—")}</div>
      <div class="meta">🛵 ${TB.esc(o.pilot || "بدون طيار")} · 💳 ${TB.esc(o.payment || "")}</div>
      ${o.proof_status === "pending" ? `<div class="meta"><span class="badge badge-warning">⏳ إثبات دفع للمراجعة</span></div>` : ""}
      ${o.proof_status === "rejected" ? `<div class="meta"><span class="badge badge-danger">❌ إثبات دفع مرفوض</span></div>` : ""}
      <div class="meta">📍 ${TB.esc(o.address || "")}</div>
      <div class="meta">🕐 ${TB.dt(o.created_at)}</div>`));
    c.appendChild(TB.el("div", {}, `<span class="price" style="font-size:1.15rem">${TB.money(o.total)}</span>`));
    const acts = TB.el("div", { class: "acts" });
    acts.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => window.showOrder(o.id, reload) }, "👁️ تفاصيل"));
    if (statusFlow[o.status] && TB.can("orders", "update")) {
      const [ns, lbl] = statusFlow[o.status];
      acts.appendChild(TB.el("button", {
        class: "btn btn-sm btn-primary",
        onclick: async () => {
          try {
            if (o.status === "preparing") return window.assignPilot(o, reload);
            await TB.api(`orders/${o.id}/status`, { method: "POST", body: { status: ns } });
            TB.toast(`✅ تم: ${lbl}`, "success"); reload();
          } catch (e) { TB.toast(e.message, "error"); }
        }
      }, lbl));
    }
    if (["new", "confirmed", "preparing"].includes(o.status) && TB.can("orders", "update")) {
      acts.appendChild(TB.el("button", {
        class: "btn btn-sm btn-danger", onclick: () => {
          const reason = prompt("سبب الإلغاء (اختياري):");
          if (reason === null) return;
          TB.confirm("تأكيد إلغاء الطلب وإرجاع الأصناف للمخزون؟", async () => {
            await TB.api(`orders/${o.id}/status`, { method: "POST", body: { status: "cancelled", note: reason } });
            TB.toast("تم إلغاء الطلب", "success"); reload();
          });
        }
      }, "✖ إلغاء"));
    }
    c.appendChild(acts);
    return c;
  }

  window.assignPilot = async (o, reload) => {
    const pilots = (await TB.api("options?of=pilots")).filter(p => Number(p.id));
    const pilotsAll = await TB.api("pilots?limit=200");
    const wrap = TB.el("div", {}, `<p>اختر الطيار المسؤول عن توصيل الطلب <b class="mono">${TB.esc(o.code)}</b>:</p>`);
    const sel = TB.el("select", { class: "input" });
    for (const p of pilotsAll.rows.filter(x => x.active)) {
      const cnt = p.orders ?? "";
      sel.appendChild(TB.el("option", { value: p.id }, `${p.name} — ${p.vehicle || ""} (طلباته: ${cnt})`));
    }
    wrap.appendChild(sel);
    const foot = TB.el("div", { class: "flex" });
    const ok = TB.el("button", { class: "btn btn-primary" }, "🛵 إسناد وبدء التوصيل");
    foot.append(ok, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
    const md = TB.modal("إسناد طيار", wrap, foot);
    ok.onclick = async () => {
      try {
        await TB.api(`orders/${o.id}/status`, { method: "POST", body: { status: "delivering", pilot_id: Number(sel.value) } });
        TB.toast("✅ تم إسناد الطلب", "success"); md.close(); if (reload) reload();
      } catch (e) { TB.toast(e.message, "error"); }
    };
  };

  window.showOrder = async (id, reload) => {
    const o = await TB.api("orders/" + id);
    const cust = o.customer_id ? await TB.api("customers/" + o.customer_id).catch(() => null) : null;
    const st = window.STATUS[o.status] || ["", "badge-muted"];
    const body = TB.el("div");
    body.appendChild(TB.el("div", { class: "flex between", style: "margin-bottom:10px" },
      `<div><b class="mono" style="font-size:1.1rem">${TB.esc(o.code)}</b> <span class="badge ${st[1]}">${st[0]}</span></div>
       <div class="muted">${TB.dt(o.created_at)}</div>`));
    body.appendChild(TB.el("div", { class: "card", style: "margin-bottom:10px" },
      `<div class="flex" style="gap:18px">
        <div>👤 <b>${TB.esc(cust ? cust.name : "—")}</b><br><span class="muted mono">${TB.esc(o.phone || (cust ? cust.phone : ""))}</span></div>
        <div>📍 ${TB.esc(o.address || "—")}</div>
        ${o._zone ? `<div>🗺️ منطقة التوصيل: <b>${TB.esc(o._zone)}</b></div>` : ""}
        <div>🛵 ${TB.esc(o._pilot || "بدون طيار")}</div>
        <div>💳 ${TB.esc(o._payment || "—")}</div>
        ${o.rating ? `<div>⭐ تقييم العميل: ${TB.num(o.rating)}</div>` : ""}
        ${o.rating_comment ? `<div class="muted">«${TB.esc(o.rating_comment)}»</div>` : ""}
      </div>`));
    body.appendChild(TB.table(o.items, [
      { label: "الصنف", key: "name" },
      { label: "السعر", render: r => TB.money(r.price) },
      { label: "الكمية", key: "qty" },
      { label: "الإجمالي", render: r => `<b>${TB.money(r.total)}</b>` },
    ], { emptyText: "لا أصناف" }));
    /* ---- بطاقة الدفع وإثبات التحويل ---- */
    const ps = o.proof_status || "none";
    const pf = (o.proofs || [])[0] || null;
    const PB = { none: ["الدفع عند الاستلام", "badge-muted", "💵"], pending: ["إثبات قيد المراجعة", "badge-warning", "⏳"],
      approved: ["تم اعتماد الدفع", "badge-success", "✅"], rejected: ["إثبات مرفوض", "badge-danger", "❌"] };
    const pb = PB[ps] || PB.none;
    const payCard = TB.el("div", { class: "card", style: "margin-top:10px" },
      `<div class="flex between" style="margin-bottom:6px"><h4 style="margin:0">💳 الدفع</h4>
        <span class="badge ${pb[1]}">${pb[2]} ${pb[0]}</span></div>
       <div class="flex" style="gap:18px;flex-wrap:wrap">
         <div>الوسيلة: <b>${TB.esc(o._payment || "—")}</b></div>
         <div>السداد: <b class="${o.paid === "paid" ? "text-success" : "text-danger"}">${o.paid === "paid" ? "مدفوع" : "غير مدفوع"}</b></div>
         ${pf ? `<div>رقم العملية: <b class="mono ltr">${TB.esc(pf.txn_ref || "—")}</b></div>
           <div>المبلغ المُحوَّل: <b>${TB.money(pf.amount)}</b></div>
           <div>تاريخ التحويل: <b>${pf.paid_at ? TB.date(pf.paid_at) : "—"}</b></div>` : ""}
       </div>
       ${pf && pf.reject_reason ? `<div class="text-danger small" style="margin-top:6px">سبب الرفض: ${TB.esc(pf.reject_reason)}</div>` : ""}
       ${(o.proofs || []).length ? `<div class="small muted" style="margin-top:6px">عدد الإثباتات المُرسلة: ${TB.num((o.proofs || []).length)}</div>` : ""}`);
    if (pf && pf.image)
      payCard.appendChild(TB.el("img", { src: pf.image, alt: "إثبات التحويل", class: "proof-thumb", style: "max-width:180px;max-height:130px;margin-top:8px;cursor:zoom-in;border-radius:8px;border:1px solid var(--border)" }));
    body.appendChild(payCard);
    body.appendChild(TB.el("div", { class: "flex", style: "justify-content:flex-end;gap:18px;margin-top:10px;font-weight:800;flex-wrap:wrap" },
      `<span>الإجمالي: ${TB.money(o.subtotal)}</span>
       ${o.discount ? `<span class="text-danger">الخصم: -${TB.money(o.discount)}</span>` : ""}
       <span>التوصيل: ${TB.money(o.delivery_fee)}</span>
       <span class="price" style="font-size:1.1rem">الإجمالي النهائي: ${TB.money(o.total)}</span>`));
    /* timeline */
    const steps = ["new", "confirmed", "preparing", "delivering", "delivered"];
    const labels = { new: "تم استلام الطلب", confirmed: "تم التأكيد", preparing: "قيد التجهيز", delivering: "في التوصيل", delivered: "تم التسليم" };
    const tl = TB.el("div", { class: "tl" });
    const evMap = {}; (o.events || []).forEach(e => evMap[e.status] = e.at);
    if (o.status === "cancelled") {
      tl.appendChild(TB.el("div", { class: "tl-item done" }, `<div class="dot" style="background:var(--danger)"></div><div class="txt"><b>تم إلغاء الطلب</b><br><small>${TB.dt(evMap.cancelled || o.updated_at)}</small></div>`));
    } else {
      const curIdx = steps.indexOf(o.status);
      steps.forEach((s, i) => {
        const done = i <= curIdx;
        tl.appendChild(TB.el("div", { class: "tl-item " + (done ? (i === curIdx ? "cur done" : "done") : "") },
          `<div class="dot"></div><div class="txt"><b>${labels[s]}</b><br><small>${evMap[s] ? TB.dt(evMap[s]) : ""}</small></div>`));
        if (i < steps.length - 1) tl.appendChild(TB.el("div", { class: "tl-item " + (i < curIdx ? "done" : "") }, `<div class="dot" style="visibility:hidden"></div><div class="line"></div>`));
      });
    }
    body.appendChild(TB.el("div", { class: "card", style: "margin-top:10px" }, `<h4 style="margin-bottom:8px">🕒 مراحل الطلب</h4>`)).appendChild(tl);
    const foot = TB.el("div", { class: "flex" });
    if (ps === "pending" && pf && TB.can("payment_proofs", "update")) {
      foot.appendChild(TB.el("button", { class: "btn btn-success", onclick: async () => {
        try { await TB.api(`payment_proofs/${pf.id}/approve`, { method: "POST" }); TB.toast("✅ تم اعتماد الدفع", "success"); md.close(); TB.refreshBadges(); if (reload) reload(); }
        catch (e) { TB.toast(e.message, "error"); }
      } }, "✅ اعتماد إثبات الدفع"));
      foot.appendChild(TB.el("button", { class: "btn btn-danger", onclick: async () => {
        try { await TB.api(`payment_proofs/${pf.id}/reject`, { method: "POST", body: { reason: "" } }); TB.toast("تم رفض الإثبات", "success"); md.close(); if (reload) reload(); }
        catch (e) { TB.toast(e.message, "error"); }
      } }, "❌ رفض الإثبات"));
    }
    if (o.status === "delivering" && TB.can("orders", "update"))
      foot.appendChild(TB.el("button", { class: "btn btn-success", onclick: async () => { await TB.api(`orders/${o.id}/status`, { method: "POST", body: { status: "delivered", paid: "paid" } }); TB.toast("✅ تم التسليم", "success"); md.close(); if (reload) reload(); } }, "✅ تسليم وتحصيل"));
    foot.appendChild(TB.el("button", { class: "btn", onclick: () => window.printInvoice(o, cust) }, "🖨️ فاتورة"));
    foot.appendChild(TB.el("button", { class: "btn", onclick: () => md.close() }, "إغلاق"));
    const md = TB.modal("تفاصيل الطلب", body, foot, { wide: true });
  };

  V("orders", async el => {
    const params = new URLSearchParams((location.hash.split("?")[1] || ""));
    const filters = { status: params.get("status") || "", customer: params.get("customer") || "", search: "" };
    el.innerHTML = "";
    const head = TB.el("div", { class: "toolbar" });
    const search = TB.el("input", { class: "input", placeholder: "🔎 بحث برقم الطلب أو العميل أو الهاتف..." });
    search.addEventListener("input", TB.debounce(async () => { filters.search = search.value; await loadOrdersInto(el, filters); }));
    head.appendChild(search);
    const selStatus = TB.el("select", { class: "input" });
    selStatus.appendChild(TB.el("option", { value: "" }, "كل الحالات"));
    for (const [v, [l]] of Object.entries(window.STATUS)) selStatus.appendChild(TB.el("option", { value: v }, l));
    selStatus.value = filters.status;
    selStatus.addEventListener("change", async () => { filters.status = selStatus.value; await loadOrdersInto(el, filters); });
    head.appendChild(selStatus);
    if (filters.customer) {
      const c = await TB.api("customers/" + filters.customer).catch(() => null);
      head.appendChild(TB.el("button", { class: "btn btn-soft", onclick: () => { filters.customer = ""; loadOrdersInto(el, filters); head.querySelector(".cust-flt")?.remove(); } }, `✖ عميل: ${c ? c.name : filters.customer}`));
      head.querySelector(".cust-flt")?.classList?.add("cust-flt");
    }
    head.appendChild(TB.el("div", { class: "spacer" }));
    head.appendChild(TB.el("button", { class: "btn", onclick: () => loadOrdersInto(el, filters) }, "🔄 تحديث"));
    head.appendChild(TB.exportButtons(() => exportOrdersData(filters)));
    el.appendChild(head);
    el.appendChild(TB.el("div", { id: "orders-body" }, '<div class="empty">⏳ جاري التحميل...</div>'));
    await loadOrdersInto(el, filters);
  });

  /* ================================================== INVENTORY */
  V("inventory", async el => {
    el.innerHTML = "";
    const tabs = TB.el("div", { class: "tabs" });
    const body = TB.el("div");
    el.append(tabs, body);
    const t1 = TB.el("button", { class: "tab active" }, "📦 الأصناف والرصيد");
    const t2 = TB.el("button", { class: "tab" }, "🔄 حركات المخزون");
    tabs.append(t1, t2);
    t1.onclick = () => { t1.classList.add("active"); t2.classList.remove("active"); renderStock(); };
    t2.onclick = () => { t2.classList.add("active"); t1.classList.remove("active"); renderMoves(); };

    async function renderStock() {
      body.innerHTML = "";
      const toolbar = TB.el("div", { class: "toolbar" });
      const search = TB.el("input", { class: "input", placeholder: "🔎 بحث بالصنف أو الباركود..." });
      toolbar.appendChild(search);
      toolbar.appendChild(TB.el("div", { class: "spacer" }));
      const cats = await TB.options("categories");
      const catName = id => (cats.find(c => c.id === id) || {}).name || "—";
      let stockRows = [];
      toolbar.appendChild(TB.exportButtons(() => {
        const rows = stockRows.map(r => ({ ...r, category: catName(r.category_id), value: Number(r.stock) * Number(r.cost || 0) }));
        const total = rows.reduce((s, r) => s + r.value, 0);
        const low = rows.filter(r => Number(r.stock) <= Number(r.min_stock)).length;
        return {
          file: "stock", title: "تقرير المخزون والأرصدة",
          subtitle: `عدد الأصناف: ${TB.num(rows.length)}`,
          columns: [
            { label: "الصنف", key: "name" },
            { label: "القسم", key: "category" },
            { label: "الرصيد", key: "stock" },
            { label: "الوحدة", key: "unit" },
            { label: "التكلفة", key: "cost", type: "money" },
            { label: "قيمة الرصيد", key: "value", type: "money" },
          ],
          rows,
          summary: { "إجمالي قيمة المخزون": total, "أصناف تحت حد الطلب": low },
        };
      }));
      if (TB.can("inventory", "create"))
        toolbar.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => adjustModal(() => renderStock()) }, "⚖️ تسوية مخزون"));
      body.appendChild(toolbar);
      const box = TB.el("div");
      body.appendChild(box);
      async function load() {
        const out = await TB.api("products?limit=500&search=" + encodeURIComponent(search.value));
        stockRows = out.rows;
        box.innerHTML = "";
        box.appendChild(TB.table(out.rows, [
          { label: "الصورة", render: r => r.image ? `<img class="img-thumb" src="${TB.esc(r.image)}">` : "📦" },
          { label: "الصنف", render: r => `<b>${TB.esc(r.name)}</b><br><small class="muted">${TB.esc(catName(r.category_id))}</small>` },
          { label: "الرصيد", render: r => `<b class="${r.stock <= r.min_stock ? "text-danger" : "text-success"}" style="font-size:1.05rem">${TB.num(r.stock)}</b> <small class="muted">${TB.esc(r.unit)}</small>${r.stock <= r.min_stock ? '<br><span class="badge badge-danger">تحت الحد</span>' : ""}` },
          { label: "التكلفة", render: r => TB.money(r.cost) },
          { label: "قيمة الرصيد", render: r => `<b>${TB.money(r.stock * r.cost)}</b>` },
          { label: "إجراءات", render: r => {
            const d = TB.el("div", { class: "flex" });
            if (TB.can("inventory", "create"))
              d.appendChild(TB.el("button", { class: "btn btn-sm btn-soft", onclick: () => adjustModal(() => renderStock(), r) }, "⚖️"));
            d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => window.printBarcodes([r]) }, "🏷️"));
            if (TB.can("products", "update"))
              d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => TB.recordModal("products", window.MODULES.products, r).then(() => renderStock()) }, "✏️"));
            return d;
          } },
        ], { emptyText: "لا أصناف" }));
      }
      search.addEventListener("input", TB.debounce(load));
      await load();
    }
    async function renderMoves() {
      body.innerHTML = "";
      await TB.listView(body, "inventory_moves", window.MODULES.inventory_moves);
    }
    await renderStock();
  });

  function adjustModal(reload, product) {
    const wrap = TB.el("div", { class: "grid", style: "gap:10px" });
    const selP = TB.el("select", { class: "input" });
    const selT = TB.el("select", { class: "input" });
    [["in", "إضافة للمخزون (+)"], ["out", "صرف من المخزون (−)"], ["adjust", "تسوية يدوية"]].forEach(([v, l]) => selT.appendChild(TB.el("option", { value: v }, l)));
    const qty = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "الكمية" });
    const note = TB.el("input", { class: "input", placeholder: "سبب الحركة / ملاحظات" });
    TB.options("products").then(ps => {
      for (const p of ps) selP.appendChild(TB.el("option", { value: p.id }, `${p.name} (رصيد: ${p.stock})`));
      if (product) selP.value = product.id;
    });
    wrap.append(
      TB.el("div", { class: "field" }, "<label>الصنف</label>"), selP,
      TB.el("div", { class: "field" }, "<label>نوع الحركة</label>"), selT,
      TB.el("div", { class: "field" }, "<label>الكمية</label>"), qty,
      TB.el("div", { class: "field" }, "<label>ملاحظات</label>"), note,
    );
    const grid = TB.el("div", { class: "grid", style: "grid-template-columns:1fr 1fr;gap:10px" });
    [selP, selT, qty, note].forEach((x, i) => { const f = TB.el("div", { class: "field" }, ["<label>الصنف</label>", "<label>نوع الحركة</label>", "<label>الكمية</label>", "<label>ملاحظات</label>"][i]); f.appendChild(x); grid.appendChild(f); });
    const foot = TB.el("div", { class: "flex" });
    const ok = TB.el("button", { class: "btn btn-primary" }, "💾 حفظ الحركة");
    foot.append(ok, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
    const md = TB.modal("⚖️ تسوية مخزون", grid, foot);
    ok.onclick = async () => {
      try {
        const type = selT.value;
        let q = Number(qty.value) || 0;
        if (type === "out") q = -Math.abs(q);
        if (type === "in") q = Math.abs(q);
        if (!q) throw new Error("أدخل كمية صحيحة");
        await TB.api("inventory/adjust", { method: "POST", body: { product_id: Number(selP.value), type, qty: q, note: note.value } });
        TB.toast("✅ تم تسجيل الحركة", "success"); md.close(); reload();
      } catch (e) { TB.toast(e.message, "error"); }
    };
  }

  /* ================================================== PURCHASES */
  V("purchases", async el => {
    const cfg = {
      title: "المشتريات", perm: "purchases",
      columns: [
        { label: "رقم", render: r => `<b class="mono">#${r.id}</b>` },
        { label: "المورد", render: r => r._sname || "—" },
        { label: "التاريخ", render: r => TB.date(r.date) },
        { label: "الإجمالي", render: r => `<b>${TB.money(r.total)}</b>` },
        { label: "المدفوع", render: r => TB.money(r.paid) },
        { label: "المتبقي", render: r => `<span class="${r.total - r.paid > 0 ? "text-danger" : "text-success"}">${TB.money(r.total - r.paid)}</span>` },
        { label: "الحالة", render: r => { const s = { draft: ["مسودة", "badge-muted"], approved: ["معتمد", "badge-success"], cancelled: ["ملغي", "badge-danger"] }[r.status] || ["", ""]; return `<span class="badge ${s[1]}">${s[0]}</span>`; } },
      ],
      fields: [],
      extraButtons: () => [],
      rowActions: [
        { icon: "🧾", label: "الفاتورة", perm: "purchases", run: r => purchaseEditor(r, reload) },
        ...(TB.can("purchases", "update") ? [{ icon: "✅", label: "اعتماد", run: async r => { try { await TB.api(`purchases/${r.id}/approve`, { method: "POST", body: {} }); TB.toast("✅ تم الاعتماد وتحديث المخزون والحسابات", "success"); TB.clearOptions(); reload(); } catch (e) { TB.toast(e.message, "error"); } } }] : []),
      ],
      onRow: r => purchaseEditor(r, reload),
      deleteMsg: () => "حذف فاتورة المشتريات؟",
    };
    el.innerHTML = "";
    const head = TB.el("div", { class: "toolbar" });
    head.appendChild(TB.el("div", { class: "spacer" }));
    head.appendChild(TB.el("span", { class: "muted" }, "اضغط على أي فاتورة لعرضها أو تعديل أصنافها"));
    let rows = [];
    head.appendChild(TB.exportButtons(() => {
      const t = rows.reduce((s, r) => s + Number(r.total || 0), 0);
      const p = rows.reduce((s, r) => s + Number(r.paid || 0), 0);
      const st = { draft: "مسودة", approved: "معتمد", cancelled: "ملغي" };
      return {
        file: "purchases", title: "تقرير المشتريات",
        columns: [
          { label: "رقم", key: "id" },
          { label: "المورد", key: "_sname" },
          { label: "التاريخ", key: "date", type: "date" },
          { label: "الإجمالي", key: "total", type: "money" },
          { label: "المدفوع", key: "paid", type: "money" },
          { label: "المتبقي", csv: r => Number(r.total || 0) - Number(r.paid || 0), key: "remaining", type: "money" },
          { label: "الحالة", csv: r => st[r.status] || r.status, key: "status" },
        ],
        rows,
        summary: { "إجمالي المشتريات": t, "إجمالي المدفوع": p, "المتبقي": t - p },
      };
    }));
    if (TB.can("purchases", "create"))
      head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => purchaseEditor(null, reload) }, "➕ فاتورة مشتريات جديدة"));
    el.appendChild(head);
    const box = TB.el("div");
    el.appendChild(box);
    async function reload() {
      box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      const suppliers = await TB.options("suppliers");
      const out = await TB.api("purchases?limit=100");
      out.rows.forEach(r => r._sname = (suppliers.find(s => s.id === r.supplier_id) || {}).name || "—");
      rows = out.rows;
      box.innerHTML = "";
      box.appendChild(TB.table(out.rows, cfg.columns, { onRow: r => purchaseEditor(r, reload) }));
    }
    await reload();
  });

  async function purchaseEditor(row, reload) {
    const isEdit = !!row;
    const suppliers = await TB.options("suppliers");
    const pms = await TB.options("payment_methods");
    const products = await TB.options("products");
    const form = TB.el("div", { class: "grid", style: "gap:10px" });
    const selSup = TB.el("select", { class: "input" });
    suppliers.forEach(s => selSup.appendChild(TB.el("option", { value: s.id }, s.name)));
    if (row) selSup.value = row.supplier_id;
    const inDate = TB.el("input", { class: "input", type: "date" }); inDate.value = (row ? row.date : TB.today()).slice(0, 10);
    const inPaid = TB.el("input", { class: "input", type: "number", step: "any" }); inPaid.value = row ? row.paid : 0;
    const selPm = TB.el("select", { class: "input" });
    selPm.appendChild(TB.el("option", { value: "" }, "— اختر —"));
    pms.forEach(p => selPm.appendChild(TB.el("option", { value: p.id }, p.name)));
    if (row && row.payment_method_id) selPm.value = row.payment_method_id;
    const inWh = TB.el("input", { class: "input", placeholder: "المستودع" }); inWh.value = row ? row.warehouse || "" : "";
    const inNote = TB.el("input", { class: "input", placeholder: "ملاحظات" }); inNote.value = row ? row.note || "" : "";
    const head = TB.el("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px" });
    [["المورد", selSup], ["التاريخ", inDate], ["المدفوع", inPaid], ["وسيلة الدفع", selPm], ["المستودع", inWh], ["ملاحظات", inNote]].forEach(([l, x]) => {
      const f = TB.el("div", { class: "field" }, `<label>${l}</label>`); f.appendChild(x); head.appendChild(f);
    });
    form.appendChild(head);
    /* items editor */
    const itemsBox = TB.el("div", { class: "items-editor", style: "margin-top:12px" });
    const rows = [];
    function addRow(it = {}) {
      const r = TB.el("div", { class: "irow" });
      const sel = TB.el("select", { class: "input grow" });
      products.forEach(p => sel.appendChild(TB.el("option", { value: p.id }, `${p.name} (تكلفة ${TB.num(p.cost)})`)));
      if (it.product_id) sel.value = it.product_id;
      const qty = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "الكمية" }); qty.value = it.qty || "";
      const cost = TB.el("input", { class: "input", type: "number", step: "any", placeholder: "التكلفة" }); cost.value = it.cost || "";
      const del = TB.el("button", { class: "btn btn-sm btn-danger" }, "🗑️");
      const upd = () => { r.querySelector(".rtot").textContent = TB.money((Number(qty.value) || 0) * (Number(cost.value) || 0)); totals(); };
      qty.addEventListener("input", upd); cost.addEventListener("input", upd);
      sel.addEventListener("change", () => { const p = products.find(x => x.id === Number(sel.value)); if (p && !cost.value) { cost.value = p.cost; upd(); } });
      del.addEventListener("click", () => { r.remove(); rows.splice(rows.indexOf(r), 1); totals(); });
      r.append(sel, qty, cost, del, TB.el("span", { class: "rtot muted", style: "grid-column:1/-1;text-align:left" }, ""));
      const rtot = r.querySelector(".rtot");
      Object.defineProperty(r, "data", { get: () => ({ product_id: Number(sel.value), qty: Number(qty.value) || 0, cost: Number(cost.value) || 0 }) });
      r._upd = upd;
      rows.push(r);
      itemsBox.appendChild(r);
      upd();
      return r;
    }
    const addBtn = TB.el("button", { class: "btn btn-sm btn-soft", onclick: () => addRow() }, "➕ إضافة صنف");
    itemsBox.appendChild(TB.el("div", { class: "flex between", style: "margin:10px 0 8px" }, "<b>أصناف الفاتورة</b>"));
    itemsBox.appendChild(addBtn);
    const totalsEl = TB.el("div", { class: "totals" });
    itemsBox.appendChild(totalsEl);
    function totals() {
      const t = rows.reduce((s, r) => s + r.data.qty * r.data.cost, 0);
      totalsEl.innerHTML = `<span>عدد الأصناف: ${rows.length}</span><span>الإجمالي: <b class="price">${TB.money(t)}</b></span>`;
    }
    form.appendChild(itemsBox);
    /* load existing items */
    let existing = row ? (row.items && row.items.length ? row.items : await TB.api("purchases/" + row.id).then(x => x.items)) : [];
    (existing.length ? existing : [{}]).forEach(it => addRow(it));
    totals();
    const foot = TB.el("div", { class: "flex" });
    const save = TB.el("button", { class: "btn btn-primary" }, isEdit ? "💾 حفظ" : "💾 حفظ الفاتورة");
    foot.append(save);
    if (isEdit && row.status !== "approved" && TB.can("purchases", "update"))
      foot.appendChild(TB.el("button", { class: "btn btn-success", onclick: async () => { try { await saveIt(); await TB.api(`purchases/${row.id}/approve`, { method: "POST", body: {} }); TB.toast("✅ تم الاعتماد", "success"); md.close(); TB.clearOptions(); reload(); } catch (e) { TB.toast(e.message, "error"); } } }, "✅ حفظ واعتماد"));
    foot.appendChild(TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
    async function saveIt() {
      const items = rows.map(r => r.data).filter(x => x.product_id && x.qty > 0);
      const body = { supplier_id: Number(selSup.value), date: inDate.value, paid: Number(inPaid.value) || 0, payment_method_id: selPm.value ? Number(selPm.value) : null, warehouse: inWh.value, note: inNote.value, items };
      if (isEdit) await TB.api("purchases/" + row.id, { method: "PUT", body });
      else await TB.api("purchases", { method: "POST", body });
    }
    const md = TB.modal(isEdit ? `فاتورة مشتريات #${row.id}` : "فاتورة مشتريات جديدة", form, foot, { wide: true });
    save.onclick = async () => {
      save.disabled = true;
      try { await saveIt(); TB.toast("✅ تم الحفظ", "success"); md.close(); reload(); }
      catch (e) { TB.toast(e.message, "error"); save.disabled = false; }
    };
  }

  /* ================================================== STOCK COUNTS */
  V("stockCounts", async el => {
    el.innerHTML = "";
    const head = TB.el("div", { class: "toolbar" });
    head.appendChild(TB.el("div", { class: "spacer" }));
    head.appendChild(TB.el("span", { class: "muted" }, "الجرد يقارن الرصيد الفعلي بالنظام ويوثق الفروقات تلقائياً في المخزون واليومية"));
    let rows = [];
    head.appendChild(TB.exportButtons(() => {
      const st = { draft: "مسودة", approved: "معتمد", cancelled: "ملغي" };
      return {
        file: "stock-counts", title: "تقرير الجرد والتسويات",
        columns: [
          { label: "#", key: "id" },
          { label: "التاريخ", key: "date", type: "date" },
          { label: "الحالة", csv: r => st[r.status] || r.status, key: "status" },
          { label: "ملاحظات", key: "memo" },
        ],
        rows,
        summary: { "عدد الجردات": rows.length, "معتمد": rows.filter(r => r.status === "approved").length, "مسودة": rows.filter(r => r.status === "draft").length },
      };
    }));
    if (TB.can("stock_counts", "create"))
      head.appendChild(TB.el("button", { class: "btn btn-primary", onclick: () => countEditor(null, reload) }, "➕ جرد جديد"));
    el.appendChild(head);
    const box = TB.el("div");
    el.appendChild(box);
    async function reload() {
      box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      const out = await TB.api("stock_counts?limit=100");
      rows = out.rows;
      box.innerHTML = "";
      box.appendChild(TB.table(out.rows, [
        { label: "#", render: r => `<b class="mono">${r.id}</b>` },
        { label: "التاريخ", render: r => TB.date(r.date) },
        { label: "الحالة", render: r => { const s = { draft: ["مسودة", "badge-muted"], approved: ["معتمد", "badge-success"], cancelled: ["ملغي", "badge-danger"] }[r.status] || ["", ""]; return `<span class="badge ${s[1]}">${s[0]}</span>`; } },
        { label: "ملاحظات", render: r => TB.esc(r.memo || "") },
        { label: "إجراءات", render: r => {
          const d = TB.el("div", { class: "flex" });
          d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: () => countView(r) }, "👁️"));
          if (r.status === "draft" && TB.can("stock_counts", "update"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-success", onclick: () => TB.confirm("اعتماد الجرد وتسجيل التسويات؟", async () => { try { await TB.api(`stock_counts/${r.id}/approve`, { method: "POST", body: {} }); TB.toast("✅ تم اعتماد الجرد وعمل التسويات", "success"); reload(); } catch (e) { TB.toast(e.message, "error"); } }) }, "✅ اعتماد"));
          if (r.status === "draft" && TB.can("stock_counts", "update"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-soft", onclick: () => countEditor(r, reload) }, "✏️"));
          return d;
        } },
      ], { emptyText: "لا جرد بعد" }));
    }
    async function countView(r) {
      const det = await TB.api("stock_counts/" + r.id);
      const body = TB.el("div");
      body.appendChild(TB.table(det.items, [
        { label: "الصنف", key: "name" },
        { label: "الرصيد بالنظام", key: "system_qty" },
        { label: "الرصيد الفعلي", key: "actual_qty" },
        { label: "الفرق", render: x => `<b class="${x.diff < 0 ? "text-danger" : x.diff > 0 ? "text-success" : "muted"}">${x.diff > 0 ? "+" : ""}${TB.num(x.diff)}</b>` },
        { label: "ملاحظات", render: x => TB.esc(x.memo || "") },
      ], { emptyText: "لا بنود" }));
      TB.modal(`جرد #${r.id} — ${TB.date(r.date)}`, body, TB.el("div", { class: "flex" }, '<button class="btn" onclick="this.closest(\'.modal-backdrop\').remove()">إغلاق</button>'), { wide: true });
    }
    async function countEditor(row, reload) {
      const all = await TB.api("products?limit=500");
      const existing = row ? (await TB.api("stock_counts/" + row.id)).items : [];
      const exMap = {}; existing.forEach(i => exMap[i.product_id] = i);
      const memo = TB.el("input", { class: "input", placeholder: "ملاحظات الجرد" }); memo.value = row ? row.memo || "" : "";
      const grid = TB.el("div", { class: "grid", style: "grid-template-columns:1fr;gap:8px" });
      grid.appendChild(TB.el("div", { class: "field" }, "<label>ملاحظات</label>")).appendChild(memo);
      const itemsBox = TB.el("div", { class: "table-wrap" });
      const t = TB.el("table", { class: "table" });
      t.innerHTML = "<thead><tr><th>الصنف</th><th>الرصيد بالنظام</th><th>الرصيد الفعلي</th><th>الفرق</th></tr></thead>";
      const tb = TB.el("tbody");
      const inputs = [];
      for (const p of all.rows) {
        const tr = TB.el("tr");
        const inQty = TB.el("input", { class: "input", type: "number", step: "any", style: "min-width:90px" });
        inQty.value = exMap[p.id] ? exMap[p.id].actual_qty : p.stock;
        const diffTd = TB.el("td");
        const upd = () => {
          const diff = (Number(inQty.value) || 0) - p.stock;
          diffTd.innerHTML = `<b class="${diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "muted"}">${diff > 0 ? "+" : ""}${TB.num(diff)}</b>`;
        };
        inQty.addEventListener("input", upd);
        inputs.push({ p, inQty });
        tr.append(TB.el("td", {}, `<b>${TB.esc(p.name)}</b> <small class="muted">${TB.esc(p.unit)}</small>`), TB.el("td", {}, TB.num(p.stock)), TB.el("td", {}, "").appendChild(inQty).parentElement || inQty, diffTd);
        tr.children[2].appendChild(inQty);
        upd();
        tb.appendChild(tr);
      }
      t.appendChild(tb); itemsBox.appendChild(t);
      grid.appendChild(itemsBox);
      const foot = TB.el("div", { class: "flex" });
      const save = TB.el("button", { class: "btn btn-primary" }, "💾 حفظ المسودة");
      foot.append(save, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
      const md = TB.modal(row ? `تعديل جرد #${row.id}` : "جرد جديد", grid, foot, { wide: true });
      save.onclick = async () => {
        save.disabled = true;
        try {
          const items = inputs.map(({ p, inQty }) => ({ product_id: p.id, actual_qty: Number(inQty.value) || 0 })).filter(i => i.actual_qty !== (inputs.find(x => x.p.id === i.product_id).p.stock));
          if (row) await TB.api("stock_counts/" + row.id, { method: "PUT", body: { memo: memo.value, items } });
          else await TB.api("stock_counts", { method: "POST", body: { date: TB.today(), memo: memo.value, status: "draft", items } });
          TB.toast("✅ تم حفظ الجرد", "success"); md.close(); reload();
        } catch (e) { TB.toast(e.message, "error"); save.disabled = false; }
      };
    }
    await reload();
  });

  /* ================================================== SETTINGS (company) */
  /* ================================================== VIP CUSTOMERS */
  V("vip", async el => {
    el.innerHTML = "";
    const state = { sort: "spent", dir: "desc", tier: "" };
    const head = TB.el("div", { class: "toolbar" });
    const selSort = TB.el("select", { class: "input" });
    [["spent", "إجمالي المشتريات"], ["count", "عدد المعاملات"], ["avg", "متوسط قيمة الطلب"], ["last", "آخر طلب"], ["gifts", "عدد الجوائز"]]
      .forEach(([v, l]) => selSort.appendChild(TB.el("option", { value: v }, l)));
    const selDir = TB.el("select", { class: "input" });
    [["desc", "الأعلى أولاً"], ["asc", "الأقل أولاً"]].forEach(([v, l]) => selDir.appendChild(TB.el("option", { value: v }, l)));
    const selTier = TB.el("select", { class: "input" });
    [["", "كل الطبقات"], ["gold", "🥇 ذهبي"], ["silver", "🥈 فضي"], ["bronze", "🥉 برونزي"]].forEach(([v, l]) => selTier.appendChild(TB.el("option", { value: v }, l)));
    head.append(TB.el("span", { class: "muted" }, "الترتيب حسب:"), selSort, selDir, TB.el("span", { class: "muted" }, "الطبقة:"), selTier, TB.el("div", { class: "spacer" }));
    head.appendChild(TB.exportButtons(() => ({
      file: "vip-customers", title: "تقرير العملاء المميزين", sheet: "العملاء المميزون",
      subtitle: `الترتيب حسب: ${selSort.options[selSort.selectedIndex].text} — ${selDir.options[selDir.selectedIndex].text}`,
      columns: plainCols(), rows: (data && data.rows) || [],
      summary: data ? {
        "إجمالي العملاء": data.summary.total, "🥇 ذهبي": data.summary.gold, "🥈 فضي": data.summary.silver,
        "🥉 برونزي": data.summary.bronze, "إجمالي الإيرادات": TB.money(data.summary.revenue),
      } : {},
      meta: { "تاريخ التصدير": TB.dt(new Date().toISOString()), "الطبقة": selTier.value ? selTier.options[selTier.selectedIndex].text : "كل الطبقات" },
    })));
    el.appendChild(head);
    const box = TB.el("div");
    el.appendChild(box);
    let data = null;

    const cols = [
      { label: "الترتيب", key: "rank" },
      { label: "العميل", key: "name", csv: r => r.name || "", render: r => `<div class="flex"><span class="avatar">${TB.esc((r.name || "?").charAt(0))}</span><b>${TB.esc(r.name || "—")}</b></div>` },
      { label: "الهاتف", key: "phone", csv: r => r.phone || "", render: r => `<span class="mono">${TB.esc(r.phone || "")}</span>` },
      { label: "المنطقة", key: "zone_name", csv: r => r.zone_name || "", render: r => r.zone_name ? `<span class="badge badge-muted">🗺️ ${TB.esc(r.zone_name)}</span>` : "—" },
      { label: "عدد المعاملات", csv: r => r.cnt, render: r => `<span class="badge badge-info">${TB.num(r.cnt)}</span>` },
      { label: "إجمالي المشتريات", csv: r => r.spent, type: "money" },
      { label: "متوسط قيمة الطلب", csv: r => r.avg, type: "money" },
      { label: "آخر طلب", csv: r => (r.last_order ? TB.date(r.last_order) : ""), render: r => r.last_order ? TB.date(r.last_order) : "—" },
      { label: "التميّز", csv: r => (window.vipTier(r.spent, r.cnt) || { name: "عادي" }).name, render: r => window.vipBadge(r.spent, r.cnt) },
      { label: "النقاط", csv: r => r.points, render: r => `<span class="badge badge-warning">⭐ ${TB.num(r.points)}</span>` },
      { label: "الجوائز", csv: r => r.gifts, render: r => `<span class="badge ${r.gifts ? "badge-success" : "badge-muted"}">🎁 ${TB.num(r.gifts)}</span>` },
      { label: "إجراءات", render: r => {
          const d = TB.el("div", { class: "flex" });
          if (TB.can("rewards", "create"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-soft", onclick: e => { e.stopPropagation(); TB.recordModal("rewards", window.MODULES.rewards, { customer_id: r.id }).then(() => {}); } }, "🎁 جائزة"));
          if (TB.can("orders", "view"))
            d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: e => { e.stopPropagation(); TB.go("#/orders?customer=" + r.id); } }, "🧾 طلباته"));
          return d;
        } },
    ];

    async function load() {
      box.innerHTML = '<div class="empty">⏳ جاري التحليل...</div>';
      try {
        data = await TB.api(`customers/vip?sort=${state.sort}&dir=${state.dir}` + (state.tier ? "&tier=" + state.tier : ""));
        box.innerHTML = "";
        /* ملخص علوي */
        const s = data.summary || {};
        const cards = TB.el("div", { class: "summary-cards" });
        const card = (t, v, cls) => cards.appendChild(TB.el("div", { class: "card " + (cls || "") }, `<div class="muted" style="font-size:.83rem">${t}</div><div class="v">${v}</div>`));
        card("👥 إجمالي العملاء", TB.num(s.total));
        card("🥇 عملاء ذهبيون", TB.num(s.gold));
        card("🥈 عملاء فضيون", TB.num(s.silver));
        card("🥉 عملاء برونزيون", TB.num(s.bronze));
        card("💵 إجمالي إيرادات العملاء", TB.money(s.revenue));
        card("🧾 عدد الأوردرات", TB.num(s.orders));
        box.appendChild(cards);
        /* منصّة الشرف */
        if ((data.top || []).length) {
          const top = data.top.slice(0, 3);
          const pod = TB.el("div", { class: "vip-podium" });
          top.forEach((t, i) => {
            const tier = window.vipTier(t.spent, t.cnt);
            pod.appendChild(TB.el("div", { class: "vip-card " + (i === 0 ? "first" : "") },
              `<div class="vip-medal">${["🥇", "🥈", "🥉"][i]}</div>
               <div class="vip-name">${TB.esc(t.name || "—")}</div>
               <div class="vip-spent">${TB.money(t.spent)}</div>
               <div class="muted small">${TB.num(t.cnt)} معاملة${tier ? " · " + tier.icon + " " + tier.name : ""}</div>`));
          });
          box.appendChild(pod);
        }
        const tierHint = (window.VIP_TIERS || []).map(t => `${t.icon} ${t.name} (${TB.money(t.min_spent)}+ أو ${TB.num(t.min_orders)} معاملات)`).join(" · ");
        const hint = TB.el("p", { class: "muted small", style: "margin:12px 0" },
          `طبقات التميّز: ${tierHint} — استخدم زر «🎁 جائزة» لمكافأة العميل بخصم أو هدية.`);
        box.appendChild(hint);
        if (!data.rows.length) { box.appendChild(TB.el("div", { class: "empty" }, "لا عملاء مطابقين للفلتر الحالي")); return; }
        box.appendChild(TB.table(data.rows, cols, { emptyText: "لا بيانات" }));
      } catch (e) { box.innerHTML = ""; box.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    }
    function plainCols() { return cols.filter(c => c.label !== "إجراءات").map(c => ({ label: c.label, key: c.key, csv: c.csv, type: c.type })); }
    selSort.addEventListener("change", () => { state.sort = selSort.value; load(); });
    selDir.addEventListener("change", () => { state.dir = selDir.value; load(); });
    selTier.addEventListener("change", () => { state.tier = selTier.value; load(); });
    await load();
  });

  /* ============ إثباتات الدفع — مراجعة واعتماد تحويلات العملاء ============ */
  V("proofs", async el => {
    el.innerHTML = "";
    const state = { status: "pending", q: "" };
    const STAT = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
    const SFILE = { pending: "pending", approved: "approved", rejected: "rejected", "": "all" };
    let data = { rows: [], summary: { pending: 0, approved: 0, rejected: 0, pending_amount: 0, approved_amount: 0 } };

    const head = TB.el("div", { class: "toolbar" });
    const selStatus = TB.el("select", { class: "input" });
    [["pending", "⏳ قيد المراجعة"], ["approved", "✅ المقبولة"], ["rejected", "❌ المرفوضة"], ["", "📋 الكل"]]
      .forEach(([v, l]) => selStatus.appendChild(TB.el("option", { value: v }, l)));
    const inpQ = TB.el("input", { class: "input", placeholder: "🔎 ابحث برقم الطلب / رقم العملية / العميل", style: "min-width:230px" });
    head.append(TB.el("span", { class: "muted" }, "الحالة:"), selStatus, inpQ, TB.el("div", { class: "spacer" }));
    head.appendChild(TB.exportButtons(() => ({
      file: "payment-proofs-" + (SFILE[state.status] || "all"), title: "تقرير إثباتات الدفع", sheet: "إثباتات الدفع",
      subtitle: `الحالة: ${selStatus.options[selStatus.selectedIndex].text}${state.q ? " · بحث: " + state.q : ""}`,
      columns: cols.filter(c => c.label !== "إجراءات" && c.label !== "صورة").map(c => ({ label: c.label, key: c.key, csv: c.csv, type: c.type })),
      rows: data.rows,
      summary: { "قيد المراجعة": TB.num(data.summary.pending), "مبلغ قيد المراجعة": TB.money(data.summary.pending_amount),
        "مقبولة": TB.num(data.summary.approved), "مبلغ مقبول": TB.money(data.summary.approved_amount), "مرفوضة": TB.num(data.summary.rejected) },
      meta: { "تاريخ التصدير": TB.dt(new Date().toISOString()) },
    })));
    el.appendChild(head);
    const cardsBox = TB.el("div", { class: "summary-cards" });
    const box = TB.el("div");
    el.append(cardsBox, box);

    const cols = [
      { label: "الطلب", key: "_order", csv: r => r._order || "", render: r => `<b class="mono">${TB.esc(r._order || "#" + r.order_id)}</b>` },
      { label: "العميل", key: "_customer", csv: r => r._customer || "", render: r => `<div><b>${TB.esc(r._customer || "—")}</b><div class="muted small mono">${TB.esc(r._customer_phone || "")}</div></div>` },
      { label: "وسيلة الدفع", key: "method_name", csv: r => r.method_name || "", render: r => `<span class="badge badge-muted">${TB.esc(r.method_name || "—")}</span>` },
      { label: "المبلغ", key: "amount", csv: r => r.amount, type: "money" },
      { label: "رقم العملية", key: "txn_ref", csv: r => r.txn_ref || "", render: r => `<span class="mono ltr">${TB.esc(r.txn_ref || "—")}</span>` },
      { label: "تاريخ التحويل", key: "paid_at", csv: r => r.paid_at || "", render: r => r.paid_at ? TB.date(r.paid_at) : "—" },
      { label: "صورة الإثبات", render: r => r.image
          ? `<img src="${TB.esc(r.image)}" alt="إثبات" class="proof-thumb" data-act="view-proof" data-src="${TB.esc(r.image)}" style="max-width:70px;max-height:56px;cursor:zoom-in;border-radius:6px;border:1px solid var(--border)">`
          : '<span class="muted">—</span>' },
      { label: "إجمالي الطلب", key: "_order_total", csv: r => r._order_total, type: "money" },
      { label: "حالة السداد", csv: r => r._order_paid === "paid" ? "مدفوع" : "غير مدفوع", render: r => r._order_paid === "paid" ? '<span class="badge badge-success">مدفوع</span>' : '<span class="badge badge-warning">غير مدفوع</span>' },
      { label: "الحالة", csv: r => STAT[r.status] || r.status, render: r => r.status === "approved" ? '<span class="badge badge-success">✅ مقبول</span>' : r.status === "rejected" ? '<span class="badge badge-danger">❌ مرفوض</span>' : '<span class="badge badge-warning">⏳ قيد المراجعة</span>' },
      { label: "ملاحظة/سبب الرفض", render: r => r.status === "rejected" && r.reject_reason ? `<span class="text-danger small">${TB.esc(r.reject_reason)}</span>` : `<span class="muted small">${TB.esc(r.note || "—")}</span>` },
      { label: "إجراءات", render: r => {
          const d = TB.el("div", { class: "flex" });
          if (r.status !== "approved" && TB.can("payment_proofs", "update"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-success", onclick: e => { e.stopPropagation(); approve(r); } }, "✅ اعتماد"));
          if (r.status !== "rejected" && TB.can("payment_proofs", "update"))
            d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: e => { e.stopPropagation(); reject(r); } }, "❌ رفض"));
          if (TB.can("orders", "view"))
            d.appendChild(TB.el("button", { class: "btn btn-sm", onclick: e => { e.stopPropagation(); TB.go("#/orders?order=" + r.order_id); } }, "🧾 الطلب"));
          return d;
        } },
    ];

    function summaryCards() {
      cardsBox.innerHTML = "";
      const s = data.summary || {};
      const card = (t, v, cls) => cardsBox.appendChild(TB.el("div", { class: "card " + (cls || "") }, `<div class="muted" style="font-size:.83rem">${t}</div><div class="v">${v}</div>`));
      card("⏳ إثباتات قيد المراجعة", TB.num(s.pending));
      card("💰 مبلغ قيد المراجعة", TB.money(s.pending_amount));
      card("✅ مقبولة", TB.num(s.approved));
      card("💵 مبلغ مُعتمد", TB.money(s.approved_amount));
      card("❌ مرفوضة", TB.num(s.rejected));
    }

    async function load() {
      box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      try {
        const qs = "payment_proofs?status=" + encodeURIComponent(state.status) + (state.q ? "&q=" + encodeURIComponent(state.q) : "");
        data = await TB.api(qs);
        summaryCards();
        box.innerHTML = "";
        if (!data.rows.length) {
          box.appendChild(TB.el("div", { class: "empty" }, state.status === "pending" ? "🎉 لا توجد إثباتات قيد المراجعة — كل التحويلات مُراجَعة" : "لا إثباتات مطابقة للفلتر الحالي"));
          return;
        }
        box.appendChild(TB.table(data.rows, cols, { emptyText: "لا بيانات" }));
      } catch (e) { box.innerHTML = ""; box.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    }

    async function approve(r) {
      const md = TB.modal("اعتماد إثبات الدفع",
        TB.el("div", {}, `<p>اعتماد إثبات تحويل بمبلغ <b>${TB.money(r.amount)}</b> للطلب <b class="mono">${TB.esc(r._order || "")}</b>؟</p>
          <p class="muted small">سيتم تعليم الطلب «مدفوع» تلقائيًا وتسجيل ذلك في سجل الطلب.</p>`),
        (() => {
          const f = TB.el("div", { class: "flex" });
          const ok = TB.el("button", { class: "btn btn-success" }, "✅ نعم، اعتمد الدفع");
          ok.onclick = async () => {
            ok.disabled = true;
            try { await TB.api(`payment_proofs/${r.id}/approve`, { method: "POST" }); TB.toast("✅ تم اعتماد الدفع وتعليم الطلب مدفوعًا", "success"); md.close(); TB.refreshBadges(); load(); }
            catch (e) { ok.disabled = false; TB.toast(e.message, "error"); }
          };
          f.append(ok, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
          return f;
        })());
    }

    async function reject(r) {
      const ta = TB.el("textarea", { class: "input", rows: 3, placeholder: "مثال: رقم العملية غير مطابق / المبلغ ناقص / الصورة غير واضحة" });
      const body = TB.el("div", {});
      body.append(
        TB.el("p", {}, `رفض إثبات تحويل الطلب <b class="mono">${TB.esc(r._order || "")}</b>؟`),
        TB.el("p", { class: "muted small" }, "لن يُلغى الطلب — سيُطلب من العميل إرسال إثبات جديد من صفحة تتبع الطلب."),
        TB.el("div", { class: "field", style: "margin-top:10px" }, "<label>سبب الرفض (يظهر للعميل)</label>"),
        ta);
      const f = TB.el("div", { class: "flex" });
      const ok = TB.el("button", { class: "btn btn-danger" }, "❌ تأكيد الرفض");
      f.append(ok, TB.el("button", { class: "btn", onclick: () => md.close() }, "إلغاء"));
      const md = TB.modal("رفض إثبات الدفع", body, f);
      ok.onclick = async () => {
        ok.disabled = true;
        try {
          await TB.api(`payment_proofs/${r.id}/reject`, { method: "POST", body: { reason: ta.value.trim() } });
          TB.toast("تم رفض الإثبات وطلب إعادة الإرسال", "success"); md.close(); load();
        } catch (e) { ok.disabled = false; TB.toast(e.message, "error"); }
      };
    }

    /* عارض الصورة بالحجم الكامل */
    el.addEventListener("click", e => {
      const t = e.target.closest("[data-act='view-proof']");
      if (!t) return;
      const f = TB.el("div", { class: "flex" });
      const md = TB.modal("🧾 إشعار التحويل المُرسل من العميل",
        TB.el("div", {}, `<img src="${TB.esc(t.dataset.src)}" alt="إثبات الدفع" style="width:100%;max-height:70vh;object-fit:contain;border-radius:10px">`), f);
      f.appendChild(TB.el("button", { class: "btn", onclick: () => md.close() }, "إغلاق"));
    });

    selStatus.addEventListener("change", () => { state.status = selStatus.value; load(); });
    let tmr = null;
    inpQ.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = inpQ.value.trim(); load(); }, 350); });
    await load();
  });

  V("settings", async el => {    el.innerHTML = "";
    const company = await TB.api("company");
    const card = TB.el("div", { class: "card" });
    card.appendChild(TB.el("div", { class: "card-head" }, `<h3 class="card-title">🏢 بيانات الشركة والمتجر</h3>`));
    const fields = [
      { name: "name", label: "اسم الشركة", type: "text", required: true },
      { name: "logo", label: "شعار الشركة", type: "image" },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "email", label: "البريد الإلكتروني", type: "text" },
      { name: "address", label: "العنوان", type: "textarea" },
      { name: "currency", label: "العملة", type: "text" },
      { name: "delivery_fee", label: "قيمة التوصيل", type: "number" },
      { name: "tax_percent", label: "نسبة الضريبة ٪", type: "number" },
      { name: "tax_enabled", label: "تفعيل الضريبة", type: "switch" },
      { name: "working_hours", label: "ساعات العمل", type: "text" },
      { name: "facebook", label: "فيسبوك", type: "text" },
      { name: "instagram", label: "إنستجرام", type: "text" },
      { name: "about", label: "نبذة عن الشركة", type: "textarea" },
    ];
    const built = await TB.buildForm(fields, company);
    card.appendChild(built.el);
    const save = TB.el("button", { class: "btn btn-primary", style: "margin-top:14px" }, "💾 حفظ البيانات");
    save.onclick = async () => {
      save.disabled = true;
      try {
        const out = await TB.api("company", { method: "PUT", body: built.values() });
        TB.toast("✅ تم حفظ بيانات الشركة", "success");
        if (out.logo) TB.$("#brand-logo").src = out.logo;
        TB.$("#brand-name").textContent = out.name;
      } catch (e) { TB.toast(e.message, "error"); }
      save.disabled = false;
    };
    card.appendChild(save);
    el.appendChild(card);

    /* ---- النسخ الاحتياطي (مع إمكانية اختيار مجلد الحفظ) ---- */
    const canWrite = TB.can("settings", "update");
    const bk = TB.el("div", { class: "card", style: "margin-top:14px" });
    bk.appendChild(TB.el("div", { class: "card-head" }, `<h3 class="card-title">🗂️ النسخ الاحتياطي لقاعدة البيانات</h3>`));
    const fmtSize = n => !n ? "0 ك.ب" : (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب");

    /* اختيار وجهة الحفظ */
    const destRow = TB.el("div", { class: "flex", style: "gap:8px;flex-wrap:wrap;align-items:center" });
    const dirSel = TB.el("select", { class: "input" });
    dirSel.style.maxWidth = "340px";
    const addDirBtn = TB.el("button", { class: "btn btn-soft" }, "➕ إضافة مجلد حفظ…");
    const delDirBtn = TB.el("button", { class: "btn btn-sm btn-ghost", title: "إلغاء تسجيل المجلد المختار" }, "🗑️ إلغاء تسجيل المجلد");
    destRow.append(dirSel, addDirBtn, delDirBtn);
    bk.appendChild(destRow);
    const hint = TB.el("p", { class: "muted small", style: "margin:10px 0 0" }, "");
    bk.appendChild(hint);

    /* إنشاء نسخة */
    const noteInput = TB.el("input", { class: "input", placeholder: "ملاحظة على النسخة (اختياري) — مثال: قبل تحديث الأسعار" });
    noteInput.style.maxWidth = "340px";
    const createBtn = TB.el("button", { class: "btn btn-primary" }, "💾 إنشاء نسخة احتياطية الآن");
    const bar = TB.el("div", { class: "flex", style: "gap:8px;flex-wrap:wrap;margin-top:12px" });
    bar.append(noteInput, createBtn);
    bk.appendChild(bar);
    if (!canWrite) { addDirBtn.disabled = true; delDirBtn.disabled = true; createBtn.disabled = true; noteInput.disabled = true; }

    const listBox = TB.el("div", { style: "margin-top:12px" });
    bk.appendChild(listBox);

    let dirs = [];
    async function loadBackups() {
      listBox.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      let out = { backups: [], dirs: [], dir: "", db_size: 0 };
      try { out = await TB.api("system/backup"); }
      catch (e) { listBox.innerHTML = ""; listBox.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); return; }
      dirs = out.dirs || [];
      /* قائمة المجلدات */
      const prev = dirSel.value;
      dirSel.innerHTML = "";
      dirs.forEach(d => {
        const o = TB.el("option", { value: String(d.id) },
          `${d.is_default ? "⭐ " : "📁 "}${d.path}${d.is_default ? " (افتراضي)" : ""}${d.writable ? "" : " — ⚠️ غير قابل للكتابة"}`);
        dirSel.appendChild(o);
      });
      if (prev && dirs.some(d => String(d.id) === prev)) dirSel.value = prev;
      delDirBtn.style.display = canWrite ? "" : "none";
      updateDelState();
      hint.innerHTML = `حجم قاعدة البيانات الحالية: <b>${fmtSize(out.db_size)}</b> — يُنشأ النسخ في المجلد المختار أعلاه.`;
      listBox.innerHTML = "";
      if (!out.backups.length) { listBox.appendChild(TB.el("div", { class: "empty" }, "لا توجد نسخ احتياطية بعد — أنشئ أول نسخة الآن.")); return; }
      const cols = [
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
                TB.confirm(`استرجاع النسخة «${r.name}»؟ سيتم استبدال كل البيانات الحالية (تُؤخذ نسخة أمان تلقائيًا قبل ذلك).`, async () => {
                  try {
                    const out2 = await TB.api("system/backup/restore", { method: "POST", body: { name: r.name, d: r.dir_id } });
                    TB.toast(`✅ تم الاسترجاع بنجاح (${out2.tables} جدول) — جاري إعادة التحميل...`, "success");
                    TB.clearOptions();
                    setTimeout(() => location.reload(), 1200);
                  } catch (err) { TB.toast(err.message, "error"); }
                });
              } }, "♻️ استرجاع"));
              d.appendChild(TB.el("button", { class: "btn btn-sm btn-danger", onclick: e => {
                e.stopPropagation();
                TB.confirm(`حذف النسخة «${r.name}» نهائيًا؟`, async () => {
                  try { await TB.api("system/backup/" + encodeURIComponent(r.name) + q, { method: "DELETE" }); TB.toast("🗑️ تم حذف النسخة", "success"); loadBackups(); }
                  catch (err) { TB.toast(err.message, "error"); }
                });
              } }, "🗑️"));
            }
            return d;
          } },
      ];
      listBox.appendChild(TB.table(out.backups, cols));
    }
    function updateDelState() {
      const cur = dirs.find(d => String(d.id) === String(dirSel.value));
      delDirBtn.disabled = !canWrite || !cur || !!cur.is_default;
    }
    dirSel.addEventListener("change", updateDelState);

    /* متصفح المجلدات لاختيار وجهة الحفظ */
    function openFolderPicker(startPath) {
      let cur = startPath || "";
      const pathInp = TB.el("input", { class: "input mono", dir: "ltr", placeholder: "المسار الكامل للمجلد — مثال: D:\\Backups" });
      const upBtn = TB.el("button", { class: "btn btn-sm" }, "⬆️ الأعلى");
      const goBtn = TB.el("button", { class: "btn btn-sm btn-soft" }, "↪️ انتقال");
      const wrap = TB.el("div", { class: "grid", style: "gap:10px" });
      const info = TB.el("p", { class: "muted small" }, "");
      const listEl = TB.el("div", { class: "folder-picker" });
      const row1 = TB.el("div", { class: "flex", style: "gap:8px;flex-wrap:wrap" });
      row1.append(pathInp, goBtn, upBtn);
      wrap.append(row1, info, listEl);

      async function load(p) {
        listEl.innerHTML = '<div class="empty">⏳ ...</div>';
        try {
          const out = await TB.api("system/backup/browse" + (p ? "?path=" + encodeURIComponent(p) : ""));
          cur = out.path; pathInp.value = out.path;
          info.innerHTML = out.writable
            ? `<span class="text-success">✅ هذا المجلد صالح للحفظ</span>` + (out.registered.includes(out.path) ? ` — <span class="badge badge-info">مسجّل بالفعل</span>` : "")
            : `<span class="text-danger">⚠️ هذا المجلد غير قابل للكتابة</span>`;
          listEl.innerHTML = "";
          if (!out.dirs.length) { listEl.appendChild(TB.el("div", { class: "empty" }, "لا توجد مجلدات فرعية")); return; }
          out.dirs.forEach(name => {
            listEl.appendChild(TB.el("button", { class: "folder-item", onclick: () => load(out.path + (out.path.endsWith("\\") || out.path.endsWith("/") ? "" : "\\") + name) },
              `📁 ${TB.esc(name)}`));
          });
        } catch (e) { listEl.innerHTML = ""; listEl.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
      }
      upBtn.onclick = () => { const o = pathInp.value; TB.api("system/backup/browse?path=" + encodeURIComponent(o)).then(r => r.parent ? load(r.parent) : null).catch(() => {}); };
      goBtn.onclick = () => load(pathInp.value.trim());
      pathInp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); load(pathInp.value.trim()); } });
      const useBtn = TB.el("button", { class: "btn btn-primary" }, "✅ استخدام هذا المجلد");
      const md = TB.modal("📁 اختيار مجلد حفظ النسخ الاحتياطي", wrap, useBtn, { wide: true });
      useBtn.onclick = async () => {
        useBtn.disabled = true;
        try {
          await TB.api("system/backup/location", { method: "POST", body: { path: cur } });
          TB.toast("✅ تم حفظ المجلد كوجهة للنسخ الاحتياطي", "success");
          md.close();
          loadBackups();
        } catch (e) { TB.toast(e.message, "error"); useBtn.disabled = false; }
      };
      load(cur);
    }
    addDirBtn.onclick = () => { const d = dirs.find(x => String(x.id) === String(dirSel.value)); openFolderPicker(d ? d.path : ""); };
    delDirBtn.onclick = () => {
      const cur = dirs.find(d => String(d.id) === String(dirSel.value));
      if (!cur) return;
      TB.confirm(`إلغاء تسجيل المجلد «${cur.path}» كوجهة نسخ؟ (لن تُحذف الملفات)`, async () => {
        try { await TB.api("system/backup/location/" + cur.id, { method: "DELETE" }); TB.toast("✅ تم إلغاء التسجيل", "success"); loadBackups(); }
        catch (e) { TB.toast(e.message, "error"); }
      });
    };
    createBtn.onclick = async () => {
      createBtn.disabled = true;
      const old = createBtn.textContent; createBtn.textContent = "⏳ جاري إنشاء النسخة...";
      try {
        const out = await TB.api("system/backup/create", { method: "POST", body: { note: noteInput.value, dir_id: dirSel.value || undefined } });
        TB.toast(`✅ تم إنشاء النسخة «${out.name}» (${fmtSize(out.size)})`, "success");
        noteInput.value = "";
        loadBackups();
      } catch (e) { TB.toast(e.message, "error"); }
      createBtn.disabled = false; createBtn.textContent = old;
    };
    el.appendChild(bk);
    loadBackups();
  });

  /* ================================================== BARCODE LABELS */
  window.openBarcodeLabels = async () => {
    const cats = await TB.options("categories");
    const wrap = TB.el("div", { class: "grid", style: "gap:10px" });
    const sel = TB.el("select", { class: "input" });
    sel.appendChild(TB.el("option", { value: "" }, "كل الأقسام"));
    cats.forEach(c => sel.appendChild(TB.el("option", { value: c.id }, c.name)));
    const qty = TB.el("input", { class: "input", type: "number", value: 1, min: 1 });
    const row = TB.el("div", { class: "flex" });
    const f1 = TB.el("div", { class: "field grow" }, "<label>القسم</label>"); f1.appendChild(sel);
    const f2 = TB.el("div", { class: "field" }, "<label>عدد النسخ لكل صنف</label>"); f2.appendChild(qty);
    row.append(f1, f2);
    wrap.appendChild(row);
    const grid = TB.el("div", { class: "barcode-grid", style: "margin-top:10px;max-height:50vh;overflow:auto" });
    wrap.appendChild(grid);
    async function gen() {
      grid.innerHTML = "";
      const out = await TB.api("products?limit=500" + (sel.value ? "&fv_category_id=" + sel.value : ""));
      for (const p of out.rows) {
        for (let i = 0; i < (Number(qty.value) || 1); i++) {
          grid.appendChild(TB.el("div", { class: "barcode-label" },
            `<img src="/api/products/${p.id}/barcode.svg" alt=""><div class="nm">${TB.esc(p.name)}</div><div class="muted" style="font-size:.72rem">${TB.money(p.price)}</div>`));
        }
      }
    }
    sel.addEventListener("change", gen); qty.addEventListener("change", gen);
    await gen();
    const foot = TB.el("div", { class: "flex" });
    foot.append(
      TB.el("button", { class: "btn btn-primary", onclick: () => { const a = TB.el("div", { id: "print-area" }); a.innerHTML = grid.innerHTML; document.body.appendChild(a); window.print(); setTimeout(() => a.remove(), 500); } }, "🖨️ طباعة الملصقات"),
      TB.el("button", { class: "btn", onclick: () => md.close() }, "إغلاق"),
    );
    const md = TB.modal("🏷️ ملصقات الباركود", wrap, foot, { wide: true });
  };
  window.printBarcodes = products => {
    const a = TB.el("div", { id: "print-area", class: "barcode-grid" });
    for (const p of products) {
      for (let i = 0; i < 12; i++) {
        a.appendChild(TB.el("div", { class: "barcode-label" },
          `<img src="/api/products/${p.id}/barcode.svg" alt=""><div class="nm">${TB.esc(p.name)}</div><div class="muted" style="font-size:.72rem">${TB.money(p.price)}</div>`));
      }
    }
    document.body.appendChild(a);
    window.print();
    setTimeout(() => a.remove(), 500);
  };

  /* ================================================== PRINTABLE INVOICE */
  /** طباعة فاتورة الطلب في تنسيق نظيف جاهز للطابعة */
  window.printInvoice = async (o, cust) => {
    const c = await TB.api("company").catch(() => ({}));
    const st = (window.STATUS[o.status] || [o.status])[0] || o.status;
    const rows = (o.items || []).map((it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${TB.esc(it.name)}</td>
        <td>${TB.money(it.price)}</td>
        <td>${TB.num(it.qty)}</td>
        <td><b>${TB.money(it.total)}</b></td>
      </tr>`).join("");
    const a = TB.el("div", { id: "print-area" });
    a.innerHTML = `
      <div class="invoice">
        <div class="inv-head">
          <div class="flex" style="gap:12px;align-items:center">
            ${c.logo ? `<img class="inv-logo" src="${TB.esc(c.logo)}" alt="">` : ""}
            <div>
              <div class="inv-brand">${TB.esc(c.name || "طلباتك")}</div>
              <div>${TB.esc(c.phone || "")}</div>
              <div>${TB.esc(c.address || "")}</div>
            </div>
          </div>
          <div style="text-align:left">
            <div class="inv-title">فاتورة</div>
            <div><b class="mono">${TB.esc(o.code)}</b></div>
            <div>${TB.dt(o.created_at)}</div>
            <div>الحالة: ${TB.esc(st)}</div>
          </div>
        </div>
        <div class="inv-grid">
          <div class="inv-box"><b>العميل</b>${TB.esc(cust ? cust.name : "—")}</div>
          <div class="inv-box"><b>الهاتف</b>${TB.esc(o.phone || (cust ? cust.phone : "") || "—")}</div>
          <div class="inv-box"><b>العنوان</b>${TB.esc(o.address || "—")}</div>
          <div class="inv-box"><b>طريقة الدفع</b>${TB.esc(o._payment || "—")}</div>
          <div class="inv-box"><b>الطيار</b>${TB.esc(o._pilot || "بدون طيار")}</div>
          <div class="inv-box"><b>حالة الدفع</b>${o.paid === "paid" ? "مدفوع ✅" : "غير مدفوع"}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>الصنف</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5">لا أصناف</td></tr>`}</tbody>
        </table>
        <div class="inv-totals">
          <div class="row"><span>الإجمالي الفرعي</span><span>${TB.money(o.subtotal)}</span></div>
          ${Number(o.discount) ? `<div class="row"><span>الخصم</span><span>-${TB.money(o.discount)}</span></div>` : ""}
          <div class="row"><span>قيمة التوصيل</span><span>${TB.money(o.delivery_fee)}</span></div>
          ${Number(o.tax) ? `<div class="row"><span>الضريبة</span><span>${TB.money(o.tax)}</span></div>` : ""}
          <div class="row grand"><span>الإجمالي النهائي</span><span>${TB.money(o.total)}</span></div>
        </div>
        <div class="inv-foot">
          ${c.about ? TB.esc(c.about) + "<br>" : ""}
          ${c.working_hours ? "🕒 " + TB.esc(c.working_hours) + "<br>" : ""}
          شكرًا لتعاملكم معنا 💛
        </div>
      </div>`;
    document.body.appendChild(a);
    window.print();
    setTimeout(() => a.remove(), 500);
  };

  /* ================================================== PILOT ORDERS */
  window.showPilotOrders = async p => {
    const rows = await TB.api(`pilots/${p.id}/orders`);
    const body = TB.el("div");
    body.appendChild(TB.el("p", { class: "muted" }, `إجمالي أوردرات ${TB.esc(p.name)}: ${rows.length}`));
    body.appendChild(TB.table(rows, [
      { label: "الكود", render: r => `<b class="mono">${TB.esc(r.code)}</b>` },
      { label: "العميل", key: "customer" },
      { label: "الإجمالي", render: r => TB.money(r.total) },
      { label: "الحالة", render: r => { const s = window.STATUS[r.status] || ["", ""]; return `<span class="badge ${s[1]}">${s[0]}</span>`; } },
      { label: "التاريخ", render: r => TB.date(r.created_at) },
    ], { emptyText: "لا أوردرات لهذا الطيار بعد" }));
    TB.modal(`🛵 أوردرات — ${p.name}`, body, TB.el("div", { class: "flex" }, '<button class="btn" onclick="this.closest(\'.modal-backdrop\').remove()">إغلاق</button>'), { wide: true });
  };

  /* ================================================== AUDIT LOG (سجل النشاط) */
  const AUDIT_BADGE = {
    "إنشاء": "badge-success", "تعديل": "badge-info", "حذف": "badge-danger",
    "تسجيل دخول": "badge-primary", "محاولة دخول فاشلة": "badge-danger",
    "تغيير كلمة المرور": "badge-warning", "تسجيل خروج": "badge-muted",
    "اعتماد": "badge-success", "تسليم": "badge-success", "إلغاء": "badge-danger",
  };
  V("audit", async el => {
    el.innerHTML = "";
    const state = { search: "", action: "", page: 1 };
    const head = TB.el("div", { class: "toolbar" });
    const search = TB.el("input", { class: "input", placeholder: "🔎 بحث في سجل النشاط…" });
    search.addEventListener("input", TB.debounce(() => { state.search = search.value; state.page = 1; load(); }, 250));
    const sel = TB.el("select", { class: "input" });
    sel.appendChild(TB.el("option", { value: "" }, "كل العمليات"));
    ["إنشاء", "تعديل", "حذف", "تسجيل دخول", "محاولة دخول فاشلة", "تغيير كلمة المرور"].forEach(a =>
      sel.appendChild(TB.el("option", { value: a }, a)));
    sel.addEventListener("change", () => { state.action = sel.value; state.page = 1; load(); });
    head.append(search, sel, TB.el("div", { class: "spacer" }));
    const info = TB.el("span", { class: "muted" });
    head.appendChild(info);
    head.appendChild(TB.exportButtons(() => ({
      file: "audit-log", title: "سجل النشاط",
      subtitle: state.action ? `الفلتر: ${state.action}` : "كل العمليات",
      columns: [
        { label: "#", key: "id" },
        { label: "الوقت", key: "at", type: "dt" },
        { label: "المستخدم", key: "user_name" },
        { label: "العملية", key: "action" },
        { label: "الشاشة", key: "entity" },
        { label: "التفاصيل", key: "detail" },
      ],
      rows: lastRows,
      summary: { "عدد العمليات المعروضة": lastRows.length },
    })));
    el.appendChild(head);

    const box = TB.el("div");
    el.appendChild(box);
    const pg = TB.el("div", { class: "flex center", style: "margin-top:14px" });
    el.appendChild(pg);
    let lastRows = [];

    async function load() {
      box.innerHTML = '<div class="empty">⏳ جاري التحميل...</div>';
      try {
        const qs = new URLSearchParams({ search: state.search, limit: 100, page: state.page });
        if (state.action) qs.set("fv_action", state.action);
        const out = await TB.api("audit?" + qs);
        lastRows = out.rows || [];
        info.textContent = "عدد العمليات: " + out.total;
        box.innerHTML = "";
        box.appendChild(TB.table(lastRows, [
          { label: "#", render: r => `<b class="mono">${r.id}</b>` },
          { label: "الوقت", render: r => `<span class="mono small">${TB.dt(r.at)}</span>` },
          { label: "المستخدم", render: r => `<div class="flex"><span class="avatar" style="width:26px;height:26px;font-size:.75rem">${TB.esc((r.user_name || "?").trim().charAt(0))}</span><b>${TB.esc(r.user_name || "—")}</b></div>` },
          { label: "العملية", render: r => `<span class="badge ${AUDIT_BADGE[r.action] || "badge-muted"}">${TB.esc(r.action)}</span>` },
          { label: "الشاشة", render: r => TB.esc(r.entity || "—") },
          { label: "التفاصيل", render: r => `<span class="muted small">${TB.esc(r.detail || "—")}</span>` },
        ], { emptyText: "لا توجد عمليات مسجّلة بعد", emptyIcon: "🕓" }));
        pg.innerHTML = "";
        if ((out.pages || 1) > 1) {
          const prev = TB.el("button", { class: "btn btn-sm", onclick: () => { state.page = Math.max(1, state.page - 1); load(); } }, "السابق");
          const next = TB.el("button", { class: "btn btn-sm", onclick: () => { state.page = Math.min(out.pages, state.page + 1); load(); } }, "التالي");
          if (state.page <= 1) prev.disabled = true;
          if (state.page >= out.pages) next.disabled = true;
          pg.append(prev, TB.el("span", { class: "muted" }, `صفحة ${state.page} من ${out.pages}`), next);
        }
      } catch (e) { box.innerHTML = ""; box.appendChild(TB.el("div", { class: "empty" }, "⚠️ " + TB.esc(e.message))); }
    }
    await load();
  });

  /* ================================================== TUTORIALS */
  V("tutorials", async el => {
    const KEY = 'tb_tutorial_videos_v1';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
    const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
    const uid = () => 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    const human = (b) => { b=Number(b)||0; if(b>1048576) return (b/1048576).toFixed(1)+' MB'; if(b>1024) return (b/1024).toFixed(0)+' KB'; return b+' B'; };
    const readFile = (f) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result)); r.onerror=rej; r.readAsDataURL(f); });
    let q='';
    let showDeleted=false;
    function draw(){
      const term=q.trim().toLowerCase();
      const rows=load().filter(v=>showDeleted?!!v.deletedAt:!v.deletedAt).sort((a,b)=>(Number(a.num)||0)-(Number(b.num)||0)).filter(v=>!term||[v.title,v.page,v.desc,v.num].some(x=>String(x||'').toLowerCase().includes(term)));
      const grid=el.querySelector('#tv-grid'); const cnt=el.querySelector('#tv-count'); if(cnt) cnt.textContent=rows.length+(showDeleted?' محذوف':' فيديو');
      const tb=el.querySelector('#tv-trash'); if(tb) tb.classList.toggle('btn-primary',showDeleted);
      if(!rows.length){ grid.innerHTML='<div class="card" style="grid-column:1/-1;text-align:center;padding:30px"><div style="font-size:40px">🎬</div><h3>'+(showDeleted?'لا توجد فيديوهات محذوفة':'لا توجد فيديوهات شرح بعد')+'</h3><p class="muted">'+(showDeleted?'كل ما تحذفه من فيديوهات سيظهر هنا لإمكانية استعادته.':'أضف فيديو يشرح إحدى صفحات البرنامج.')+'</p>'+(showDeleted?'':'<button class="btn btn-primary" id="tv-first">إضافة أول فيديو</button>')+'</div>'; const b=el.querySelector('#tv-first'); if(b) b.onclick=()=>openForm(); return; }
      grid.innerHTML=rows.map(v=>'<div class="card" style="padding:0;overflow:hidden"><button type="button" data-play="'+v.id+'" style="display:grid;place-items:center;position:relative;width:100%;height:150px;border:0;cursor:pointer;background:var(--surface-2)"><span style="display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--primary);color:#fff;font-size:22px">▶</span><span class="badge badge-info" style="position:absolute;top:10px;inset-inline-end:10px">#'+TB.esc(String(v.num||''))+'</span></button><div style="padding:12px"><h3 style="margin:0 0 2px;font-size:14px">'+TB.esc(v.title)+'</h3><div class="muted small">الصفحة: '+TB.esc(v.page||'-')+'</div>'+(v.desc?'<p class="muted small" style="margin-top:6px">'+TB.esc(v.desc)+'</p>':'')+'<div class="flex" style="justify-content:space-between;font-size:.75rem;color:var(--muted);margin-top:8px"><span>'+human(v.size)+'</span><span>'+TB.esc((v.updatedAt||v.createdAt||'').slice(0,16).replace("T"," "))+'</span></div><div class="flex" style="gap:8px;margin-top:10px">'+(showDeleted?'<button class="btn btn-sm btn-primary" data-restore="'+v.id+'">♻️ استعادة</button><button class="btn btn-sm btn-danger" data-purge="'+v.id+'">🗑️ حذف نهائي</button>':'<button class="btn btn-sm" data-edit="'+v.id+'">✏️ تعديل</button><button class="btn btn-sm btn-danger" data-del="'+v.id+'">🗑️ حذف</button>')+'</div></div></div>').join('');
      grid.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>openPlayer(load().find(x=>x.id===b.dataset.play)));
      grid.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openForm(load().find(x=>x.id===b.dataset.edit)));
      grid.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ const v=load().find(x=>x.id===b.dataset.del); if(!v) return; TB.confirm('نقل "'+v.title+'" إلى سلة المحذوفات؟', async()=>{ save(load().map(x=>x.id===v.id?{...x,deletedAt:new Date().toISOString()}:x)); TB.toast('تم نقله إلى السلة','success'); draw(); }); });
      grid.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{ save(load().map(x=>x.id===b.dataset.restore?{...x,deletedAt:null,restoredAt:new Date().toISOString()}:x)); TB.toast('تمت الاستعادة','success'); draw(); });
      grid.querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>{ TB.confirm('لا يمكن التراجع عن الحذف النهائي.', async()=>{ save(load().filter(x=>x.id!==b.dataset.purge)); TB.toast('تم الحذف النهائي','success'); draw(); }); });
    }
    function openPlayer(v){ if(!v) return; const body=TB.el('div',{}, '<div class="muted small" style="margin-bottom:8px">الصفحة: '+TB.esc(v.page||'-')+'</div><video controls autoplay src="'+v.data+'" style="width:100%;max-height:60vh;border-radius:12px;background:#000"></video>'+(v.desc?'<p style="margin-top:10px">'+TB.esc(v.desc)+'</p>':'')); TB.modal(TB.esc(v.title)+' #'+TB.esc(String(v.num||'')), body, null, {wide:true}); }
    function openForm(v){
      const edit=!!v;
      const body=TB.el('div',{class:'grid',style:'grid-template-columns:1fr 1fr;gap:12px'});
      const title=TB.el('div',{class:'field',style:'grid-column:1/-1'}, '<label>اسم الفيديو</label>'); const ti=TB.el('input',{class:'input',value:v?.title||''}); title.appendChild(ti);
      const page=TB.el('div',{class:'field'}, '<label>اسم الصفحة</label>'); const pi=TB.el('input',{class:'input',value:v?.page||''}); page.appendChild(pi);
      const num=TB.el('div',{class:'field'}, '<label>رقم الفيديو</label>'); const ni=TB.el('input',{class:'input',type:'number',value:v?.num??''}); num.appendChild(ni);
      const desc=TB.el('div',{class:'field',style:'grid-column:1/-1'}, '<label>وصف</label>'); const di=TB.el('textarea',{class:'input',rows:'3'}); di.value=v?.desc||''; desc.appendChild(di);
      const file=TB.el('div',{class:'field',style:'grid-column:1/-1'}, '<label>ملف الفيديو</label>'); const fi=TB.el('input',{class:'input',type:'file',accept:'video/*'}); file.appendChild(fi); file.appendChild(TB.el('div',{class:'muted small'}, edit?'اتركه فارغًا للإبقاء على الملف الحالي':'اختر ملف فيديو'));
      body.append(title,page,num,desc,file);
      const foot=TB.el('div',{class:'flex'});
      const saveBtn=TB.el('button',{class:'btn btn-primary'}, 'حفظ');
      foot.append(saveBtn, TB.el('button',{class:'btn',onclick:()=>md.close()}, 'إلغاء'));
      const md=TB.modal(edit?'تعديل الفيديو':'إضافة فيديو شرح', body, foot, {wide:true});
      saveBtn.onclick=async()=>{
        const t=ti.value.trim(), p=pi.value.trim(), n=Number(ni.value), d=di.value.trim(); const f=fi.files&&fi.files[0];
        if(!t||!p||!Number.isFinite(n)||n<=0){ TB.toast('أدخل الاسم والصفحة ورقمًا صحيحًا','error'); return; }
        if(!edit && !f){ TB.toast('اختر ملف فيديو','error'); return; }
        saveBtn.disabled=true;
        try{
          let media=edit?{data:v.data,fileName:v.fileName,mime:v.mime,size:v.size}:{};
          if(f) media={data:await readFile(f),fileName:f.name,mime:f.type||'video/mp4',size:f.size};
          const now=new Date().toISOString(); const list=load();
          if(edit){ const i=list.findIndex(x=>x.id===v.id); if(i>=0) list[i]={...list[i],title:t,page:p,num:n,desc:d,...media,updatedAt:now}; }
          else list.push({id:uid(),title:t,page:p,num:n,desc:d,...media,createdAt:now,updatedAt:now});
          save(list); md.close(); TB.toast('تم الحفظ','success'); draw();
        }catch(e){ TB.toast('تعذر حفظ الفيديو (قد يكون الملف كبيرًا)','error'); }
        finally{ saveBtn.disabled=false; }
      };
    }
    el.innerHTML = '<div class="toolbar"><input class="input" id="tv-q" placeholder="ابحث بالاسم أو الصفحة أو الرقم..." style="max-width:360px"><div class="spacer"></div><button class="btn" id="tv-trash">🗑️ سلة المحذوفات</button><span class="badge badge-info" id="tv-count"></span><button class="btn btn-primary" id="tv-add">+ إضافة فيديو</button></div><div id="tv-grid" class="board" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"></div>';
    el.querySelector('#tv-q').oninput = e => { q=e.target.value; draw(); };
    el.querySelector('#tv-add').onclick = () => openForm();
    el.querySelector('#tv-trash').onclick = () => { showDeleted=!showDeleted; draw(); };
    draw();
  });
})();
