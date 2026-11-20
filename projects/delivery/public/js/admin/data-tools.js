/* أدوات البيانات — تفريغ الجداول + سلة المهملات */
(function () {
  'use strict';
  const V = window.registerView;

  V('data-tools', async (el) => {
    let tab = 'tables';
    let tools = { tables: [] };
    let trash = { groups: [], total: 0 };

    async function loadAll() {
      [tools, trash] = await Promise.all([TB.api('data-tools'), TB.api('trash')]);
      paint();
    }

    function paint() {
      el.innerHTML = '';
      const tabs = TB.el('div', { class: 'toolbar' });
      const b1 = TB.el('button', { class: 'btn ' + (tab === 'tables' ? 'btn-primary' : ''), onclick: () => { tab = 'tables'; paint(); } }, '🗄️ تفريغ الجداول');
      const b2 = TB.el('button', { class: 'btn ' + (tab === 'trash' ? 'btn-primary' : ''), onclick: () => { tab = 'trash'; paint(); } }, '🗑️ سلة المهملات (' + trash.total + ')');
      tabs.append(b1, b2, TB.el('div', { class: 'spacer' }));
      el.appendChild(tabs);
      const box = TB.el('div', { style: 'margin-top:14px' });
      el.appendChild(box);
      if (tab === 'tables') paintTables(box); else paintTrash(box);
    }

    function paintTables(box) {
      box.innerHTML = '';
      box.appendChild(TB.el('div', { class: 'alert', style: 'background:var(--warn-soft,#fef3c7);color:#92400e;padding:10px 14px;border-radius:12px;margin-bottom:12px' },
        '⚠️ تفريغ الجداول يحذف بياناتها نهائيًا. تُضاف الجداول المرتبطة تلقائيًا للحفاظ على سلامة العلاقات، ويُسجَّل الإجراء في سجل النشاط. خذ نسخة احتياطية أولًا.'));
      const wrap = TB.el('div', { class: 'table-wrap' });
      const t = TB.el('table', { class: 'table' });
      t.innerHTML = '<thead><tr><th style="width:44px"></th><th>الجدول</th><th>الاسم</th><th>الصفوف</th><th>الحالة</th></tr></thead>';
      const tb = TB.el('tbody');
      const boxes = [];
      (tools.tables || []).forEach((row) => {
        const tr = TB.el('tr');
        const td0 = TB.el('td');
        const cb = TB.el('input', { type: 'checkbox' });
        cb.dataset.table = row.name;
        if (row.protected) cb.disabled = true;
        boxes.push(cb);
        td0.appendChild(cb);
        tr.appendChild(td0);
        tr.appendChild(TB.el('td', { class: 'mono ltr' }, row.name));
        tr.appendChild(TB.el('td', {}, row.label));
        tr.appendChild(TB.el('td', { class: 'num' }, String(row.rows)));
        tr.appendChild(TB.el('td', {}, row.protected ? '🔒 محمي' : '✅ قابل للتفريغ'));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      box.appendChild(wrap);
      const bar = TB.el('div', { class: 'toolbar', style: 'margin-top:12px' });
      const info = TB.el('span', { class: 'muted' }, 'لم يتم تحديد أي جدول');
      const btn = TB.el('button', { class: 'btn btn-danger', disabled: 'disabled' }, '🗑️ تفريغ المحدد');
      const upd = () => {
        const n = boxes.filter((b) => b.checked && !b.disabled).length;
        info.textContent = n ? 'تم تحديد ' + n + ' جدول' : 'لم يتم تحديد أي جدول';
        btn.disabled = !n;
      };
      boxes.forEach((b) => b.addEventListener('change', upd));
      btn.onclick = () => {
        const selected = boxes.filter((b) => b.checked && !b.disabled).map((b) => b.dataset.table);
        if (!selected.length) return;
        TB.confirm('سيتم حذف كل صفوف: ' + selected.join(', ') + '. قد تُضاف جداول مرتبطة تلقائيًا. لا يمكن التراجع.', async () => {
          const r = await TB.api('data-tools/truncate', { method: 'POST', body: { tables: selected } });
          TB.toast('تم تفريغ ' + (r.cleared || []).length + ' جدول', 'success');
          await loadAll();
        });
      };
      bar.append(info, TB.el('div', { class: 'spacer' }), btn);
      box.appendChild(bar);
    }

    function paintTrash(box) {
      box.innerHTML = '';
      const groups = (trash.groups || []).filter((g) => g.rows.length);
      if (!groups.length) {
        box.appendChild(TB.el('div', { class: 'empty' }, '🗑️ السلة فارغة — عند حذف عنصر من الجداول التي تدعم الحذف الناعم سيظهر هنا.'));
        return;
      }
      groups.forEach((g) => {
        box.appendChild(TB.el('h3', { style: 'margin:16px 0 8px' }, g.label + ' (' + g.rows.length + ')'));
        const wrap = TB.el('div', { class: 'table-wrap' });
        const t = TB.el('table', { class: 'table' });
        t.innerHTML = '<thead><tr><th>#</th><th>الاسم</th><th>تاريخ الإنشاء</th><th style="width:200px"></th></tr></thead>';
        const tb = TB.el('tbody');
        g.rows.forEach((r) => {
          const tr = TB.el('tr');
          tr.appendChild(TB.el('td', { class: 'num' }, String(r.id)));
          tr.appendChild(TB.el('td', {}, r.name || '—'));
          tr.appendChild(TB.el('td', { class: 'small muted' }, r.created_at || '—'));
          const td = TB.el('td', { class: 'actions' });
          const restore = TB.el('button', { class: 'btn btn-sm btn-soft' }, '♻️ استعادة');
          restore.onclick = async () => {
            try { await TB.api('trash/' + g.entity + '/' + r.id + '/restore', { method: 'POST' }); TB.toast('تمت الاستعادة', 'success'); await loadAll(); }
            catch (e) { TB.toast(e.message, 'error'); }
          };
          const purge = TB.el('button', { class: 'btn btn-sm' }, '🗑️ نهائي');
          purge.onclick = () => TB.confirm('لا يمكن التراجع عن الحذف النهائي.', async () => {
            try { await TB.api('trash/' + g.entity + '/' + r.id, { method: 'DELETE' }); TB.toast('تم الحذف النهائي', 'success'); await loadAll(); }
            catch (e) { TB.toast(e.message, 'error'); }
          });
          td.append(restore, purge);
          tr.appendChild(td);
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        wrap.appendChild(t);
        box.appendChild(wrap);
      });
    }

    await loadAll();
  });
})();
