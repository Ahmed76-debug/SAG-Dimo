import { h, icon } from '../core/dom.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { pageHeader, card, emptyState, badge, skeletonTable } from '../core/ui.js';
import { relativeTime } from '../core/dom.js';
import { entityLabel } from '../core/i18n.js';
import { L, tt, dataTable, pagination, dateTimeFmt } from './common.js';

export async function renderNotifications() {
  const wrap = h('div', {}, skeletonTable(4));
  (async () => {
    try {
      const data = await api.get('/api/notifications', { limit: 100 });
      const rows = data.rows || [];
      if (!rows.length) {
        wrap.replaceChildren(emptyState({ iconName: 'bell', title: L('No notifications', 'لا توجد إشعارات'), message: L('You are all caught up.', 'لا يوجد جديد حالياً.') }));
        return;
      }
      wrap.replaceChildren(h('div', { class: 'notif-list' }, rows.map((n) => {
        const title = L(n.title_en || '', n.title_ar || n.title_en || '');
        const body = L(n.body_en || '', n.body_ar || n.body_en || '');
        return h('div', { class: `notif-item ${n.is_read ? '' : 'is-unread'}` },
          h('div', { class: 'notif-item__icon' }, icon(n.severity === 'error' ? 'x-circle' : n.severity === 'warning' ? 'alert-triangle' : 'info')),
          h('div', { class: 'notif-item__body' },
            h('div', { class: 'notif-item__title' }, title || L('Notification', 'إشعار')),
            body ? h('div', { class: 'notif-item__text' }, body) : null,
            h('div', { class: 'notif-item__time' }, dateTimeFmt(n.created_at))),
          n.url ? h('a', { class: 'btn btn--sm btn--ghost', href: n.url.startsWith('#') ? n.url : `#${n.url}` }, L('Open', 'فتح')) : null,
        );
      })));
      // mark as read best-effort
      store.set({ unread: 0 });
      const dot = document.querySelector('.icon-btn__dot');
      if (dot) dot.style.display = 'none';
    } catch (err) {
      wrap.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  })();
  return h('div', { class: 'view' },
    pageHeader({
      title: L('Notifications', 'الإشعارات'), iconName: 'bell',
      actions: [h('button', { class: 'btn btn--soft btn--sm', onclick: async () => { try { await api.post('/api/notifications/read-all', {}); store.set({ unread: 0 }); } catch {} location.hash = '#/notifications'; } }, icon('check'), L('Mark all read', 'تحديد الكل كمقروء'))],
    }),
    card({ body: wrap }),
  );
}

export async function renderNotFound(route) {
  return h('div', { class: 'view' },
    card({ body: emptyState({
      iconName: 'search',
      title: L('Page not found', 'الصفحة غير موجودة'),
      message: route?.path ? L(`No page matches ${route.path}`, `لا توجد صفحة تطابق ${route.path}`) : '',
      action: h('a', { class: 'btn btn--primary', href: '#/dashboard' }, icon('home'), L('Go to dashboard', 'العودة للوحة القيادة')),
    }) }),
  );
}

export async function renderAccount() {
  const user = store.get('user') || {};
  const wrap = h('div', { class: 'col gap-4' });
  const info = card({
    title: L('Profile', 'الملف الشخصي'),
    body: h('div', { class: 'kv' },
      ...[
        [L('Full name', 'الاسم الكامل'), L(user.full_name_en, user.full_name_ar) || user.full_name_en || '—'],
        [L('Username', 'اسم المستخدم'), user.username || '—'],
        [L('Email', 'البريد الإلكتروني'), user.email || '—'],
        [L('Mobile', 'الجوال'), user.mobile || '—'],
        [L('Locale', 'اللغة'), user.locale === 'ar' ? 'العربية' : 'English'],
        [L('Roles', 'الأدوار'), (user.roles || []).map((r) => L(r.name_en, r.name_ar)).join(', ') || (user.is_super ? L('Super administrator', 'مدير عام') : '—')],
      ].map(([k, v]) => h('div', { class: 'kv__item' },
        h('div', { class: 'kv__label' }, k), h('div', { class: 'kv__value' }, v))),
    ),
  });

  const oldPw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const newPw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const confirmPw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const msg = h('div', { class: 'alert', style: { display: 'none' } });
  const savePw = h('button', { class: 'btn btn--primary' }, icon('lock'), L('Change password', 'تغيير كلمة المرور'));
  savePw.addEventListener('click', async () => {
    msg.style.display = 'none';
    if (!newPw.value || newPw.value.length < 6) {
      msg.className = 'alert alert--danger'; msg.textContent = L('Password must be at least 6 characters.', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'); msg.style.display = 'flex'; return;
    }
    if (newPw.value !== confirmPw.value) {
      msg.className = 'alert alert--danger'; msg.textContent = L('Passwords do not match.', 'كلمتا المرور غير متطابقتين.'); msg.style.display = 'flex'; return;
    }
    savePw.disabled = true;
    try {
      await api.post('/api/auth/change-password', { current_password: oldPw.value, new_password: newPw.value });
      msg.className = 'alert alert--success'; msg.textContent = L('Password changed successfully.', 'تم تغيير كلمة المرور بنجاح.'); msg.style.display = 'flex';
      oldPw.value = newPw.value = confirmPw.value = '';
    } catch (err) {
      msg.className = 'alert alert--danger'; msg.textContent = err.data?.message || err.message; msg.style.display = 'flex';
    } finally { savePw.disabled = false; }
  });

  const pw = card({
    title: L('Security', 'الأمان'),
    body: h('div', { class: 'col gap-3', style: { maxWidth: '420px' } },
      msg,
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Current password', 'كلمة المرور الحالية')), oldPw),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('New password', 'كلمة المرور الجديدة')), newPw),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Confirm new password', 'تأكيد كلمة المرور')), confirmPw),
      h('div', {}, savePw),
    ),
  });

  wrap.append(info, pw);
  return h('div', { class: 'view' },
    pageHeader({ title: L('My account', 'حسابي'), subtitle: user.email || user.username, iconName: 'user' }),
    wrap,
  );
}
