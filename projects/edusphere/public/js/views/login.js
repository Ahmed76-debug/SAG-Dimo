import { h, icon } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { notify, spinner } from '../core/ui.js';
import { L, tt } from './common.js';

export async function renderLogin() {
  const locale = store.get('locale') || 'ar';
  // Load public translations so login is bilingual before bootstrap/auth
  if (!store.get('translations') || !Object.keys(store.get('translations')).length) {
    try {
      const data = await api.get(`/api/i18n/${locale}`);
      store.set({ translations: data.translations || {}, locale: data.locale || locale });
    } catch { /* ignore */ }
  }

  const userInput = h('input', {
    class: 'input', name: 'username', autocomplete: 'username', required: true,
    placeholder: tt('auth.usernamePlaceholder', 'Username or email', 'اسم المستخدم أو البريد'),
  });
  const passInput = h('input', {
    class: 'input', type: 'password', name: 'password', autocomplete: 'current-password', required: true,
    placeholder: '••••••••',
  });
  const showBtn = h('button', {
    type: 'button', class: 'icon-btn', tabindex: '-1', title: tt('common.show', 'Show', 'إظهار'),
    onclick: () => {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
      showBtn.replaceChildren(icon(passInput.type === 'password' ? 'eye' : 'eye-off'));
    },
  }, icon('eye'));

  const remember = h('input', { type: 'checkbox', checked: true });
  const submit = h('button', { class: 'btn btn--primary', type: 'submit', style: { width: '100%', justifyContent: 'center' } },
    icon('log-in'), tt('auth.signIn', 'Sign in', 'تسجيل الدخول'));

  const errorBox = h('div', { class: 'alert alert--danger', style: { display: 'none', marginBottom: '12px' } });

  const form = h('form', { class: 'auth-form' },
    errorBox,
    h('label', { class: 'field' },
      h('span', { class: 'field__label' }, tt('auth.username', 'Username', 'اسم المستخدم')),
      userInput),
    h('label', { class: 'field' },
      h('span', { class: 'field__label' }, tt('auth.password', 'Password', 'كلمة المرور')),
      h('div', { class: 'password-field' }, passInput, showBtn)),
    h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
      h('label', { class: 'row gap-2', style: { fontSize: 'var(--fs-sm)', cursor: 'pointer' } },
        remember, tt('auth.remember', 'Remember me', 'تذكرني')),
      h('span', { class: 'faint', style: { fontSize: 'var(--fs-xs)' } }, 'admin / admin123')),
    h('div', { style: { marginTop: '6px' } }, submit),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submit.disabled = true;
    const orig = submit.innerHTML;
    submit.replaceChildren(spinner(), document.createTextNode(tt('auth.signingIn', 'Signing in…', 'جارٍ تسجيل الدخول…')));
    try {
      const data = await api.post('/api/auth/login', {
        username: userInput.value.trim(),
        password: passInput.value,
      });
      if (data.user) store.set({ user: data.user });
      if (data.user?.locale) store.set({ locale: data.user.locale, dir: data.user.locale === 'ar' ? 'rtl' : 'ltr' });
      window.dispatchEvent(new CustomEvent('edusphere:login', { detail: data }));
    } catch (err) {
      errorBox.textContent = err.data?.message || tt('auth.failed', 'Invalid username or password', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      errorBox.style.display = 'flex';
    } finally {
      submit.disabled = false;
      submit.innerHTML = orig;
    }
  });

  const langBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button' },
    icon('languages'), store.get('locale') === 'ar' ? 'English' : 'العربية');
  langBtn.addEventListener('click', async () => {
    const next = store.get('locale') === 'ar' ? 'en' : 'ar';
    try {
      const data = await api.get(`/api/i18n/${next}`);
      store.set({ translations: data.translations || {}, locale: next, dir: next === 'ar' ? 'rtl' : 'ltr' });
      document.documentElement.lang = next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      // re-render login
      window.dispatchEvent(new CustomEvent('edusphere:rerender'));
    } catch { /* ignore */ }
  });

  const brand = h('div', { class: 'auth-brand' },
    h('div', { class: 'auth-brand__mark' }, 'ES'),
    h('div', {},
      h('h1', {}, 'EduSphere'),
      h('p', {}, L('International School Management & ERP', 'منصة إدارة المدارس الدولية وتخطيط الموارد'))),
  );

  const panel = h('div', { class: 'auth-panel' },
    h('div', { class: 'auth-panel__inner' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' } },
        h('div', {}, h('h2', {}, tt('auth.welcome', 'Welcome back', 'مرحباً بعودتك')),
          h('p', { class: 'muted' }, tt('auth.subtitle', 'Sign in to manage your school', 'سجّل الدخول لإدارة مدرستك'))),
        langBtn),
      form,
      h('div', { class: 'auth-meta', style: { marginTop: '18px', fontSize: 'var(--fs-xs)', color: 'var(--faint)' } },
        L('Demo data is preloaded. You can backup, restore, and customize everything.', 'البيانات التجريبية محمّلة مسبقاً. يمكنك النسخ الاحتياطي والاستعادة وتخصيص كل شيء.')),
    ),
  );

  const hero = h('div', { class: 'auth-hero' },
    brand,
    h('div', { class: 'auth-features' },
      ...[
        [L('Bilingual AR/EN', 'ثنائي اللغة عربي/إنجليزي'), L('Every label, report and workflow adapts instantly.', 'كل تسمية وتقرير وسير عمل يتكيف فوراً.')],
        [L('Full school ERP', 'نظام ERP متكامل للمدرسة'), L('Accounting, HR, academics, library, transport and more.', 'محاسبة، موارد بشرية، أكاديميات، مكتبة، مواصلات والمزيد.')],
        [L('Secure & portable', 'آمن وقابل للنقل'), L('Role-based access with backup/restore to any folder or drive.', 'صلاحيات حسب الدور مع نسخ احتياطي واستعادة لأي مجلد أو قرص.')],
      ].map(([title, desc]) => h('div', { class: 'auth-feature' },
        h('div', { class: 'auth-feature__icon' }, icon('check-circle')),
        h('div', {}, h('strong', {}, title), h('p', {}, desc)))),
    ),
  );

  const root = h('div', { class: 'auth-layout' }, hero, panel);
  setTimeout(() => (userInput.value ? passInput : userInput).focus(), 50);
  return root;
}
