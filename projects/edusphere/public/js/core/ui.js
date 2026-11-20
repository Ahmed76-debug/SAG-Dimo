import { h, icon, clear } from './dom.js';
import { t } from './i18n.js';

/* ------------------------------------------------------------------ *
 * Toasts
 * ------------------------------------------------------------------ */
let toastStack = null;

function ensureToastStack() {
  if (!toastStack) {
    toastStack = h('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastStack);
  }
  return toastStack;
}

const TOAST_ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};
const TOAST_COLORS = {
  success: 'var(--accent)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

export function toast({ type = 'info', title, message = '', duration = 4200 } = {}) {
  const stack = ensureToastStack();
  const el = h(
    'div',
    { class: `toast toast--${type}`, style: { '--toast-color': TOAST_COLORS[type], '--toast-dur': `${duration}ms` } },
    icon(TOAST_ICONS[type] || 'info', 'toast__icon'),
    h(
      'div',
      { class: 'toast__body' },
      h('div', { class: 'toast__title' }, title || t(`common.${type}`, type)),
      message ? h('div', { class: 'toast__msg' }, message) : null,
    ),
    h(
      'button',
      { class: 'toast__close', 'aria-label': t('common.close', 'Close'), onclick: () => dismiss() },
      icon('x'),
    ),
  );
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast__close svg')?.setAttribute('width', '15');
  el.querySelector('.toast__close svg')?.setAttribute('height', '15');
  stack.appendChild(el);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return { dismiss, el };
}

export const notify = {
  success: (title, message) => toast({ type: 'success', title, message }),
  error: (title, message) => toast({ type: 'error', title, message, duration: 6500 }),
  warning: (title, message) => toast({ type: 'warning', title, message, duration: 5500 }),
  info: (title, message) => toast({ type: 'info', title, message }),
};

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */
const openOverlays = new Set();

function trackOverlay(el) {
  openOverlays.add(el);
  return () => {
    openOverlays.delete(el);
    el.remove();
    if (!openOverlays.size) document.body.style.overflow = '';
  };
}

function lockScroll() {
  document.body.style.overflow = 'hidden';
}

function focusFirst(container) {
  const target = container.querySelector(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
  );
  if (target) setTimeout(() => target.focus(), 30);
}

export function openModal({ title, subtitle, body, footer, size = '', onClose, closeOnBackdrop = true } = {}) {
  lockScroll();
  const close = () => {
    remove();
    if (onClose) onClose();
  };
  const dialog = h(
    'div',
    { class: `modal ${size ? `modal--${size}` : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h(
      'div',
      { class: 'modal__head' },
      h(
        'div',
        { class: 'grow' },
        h('h3', {}, title || ''),
        subtitle ? h('p', {}, subtitle) : null,
      ),
      h('button', { class: 'icon-btn modal__close', onclick: close, 'aria-label': t('common.close', 'Close') }, icon('x')),
    ),
    h('div', { class: 'modal__body' }, body),
    footer ? h('div', { class: 'modal__foot' }, footer) : null,
  );
  const overlay = h(
    'div',
    {
      class: 'overlay',
      onclick: (e) => {
        if (closeOnBackdrop && e.target === overlay) close();
      },
    },
    dialog,
  );
  const remove = trackOverlay(overlay);
  document.body.appendChild(overlay);
  focusFirst(dialog);
  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      close();
    }
  };
  document.addEventListener('keydown', onKey);
  return { close, el: dialog, overlay };
}

export function openDrawer({ title, subtitle, body, footer, wide = false, onClose } = {}) {
  lockScroll();
  const panel = h(
    'div',
    { class: `drawer ${wide ? 'drawer--wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h(
      'div',
      { class: 'drawer__head' },
      h(
        'div',
        { class: 'grow' },
        h('h3', { style: { fontSize: 'var(--fs-lg)' } }, title || ''),
        subtitle ? h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, subtitle) : null,
      ),
      h('button', { class: 'icon-btn', onclick: () => close(), 'aria-label': t('common.close', 'Close') }, icon('x')),
    ),
    h('div', { class: 'drawer__body' }, body),
    footer ? h('div', { class: 'drawer__foot' }, footer) : null,
  );
  const overlay = h('div', { class: 'drawer-overlay' });
  const remove = trackOverlay(overlay);
  const close = () => {
    document.removeEventListener('keydown', keyHandler);
    panel.remove();
    remove();
    if (onClose) onClose();
  };
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  const keyHandler = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', keyHandler);
  focusFirst(panel);
  return { close, el: panel, overlay };
}

/* ------------------------------------------------------------------ *
 * Confirmation & prompt
 * ------------------------------------------------------------------ */
export function confirmDialog({
  title = t('common.confirm', 'Confirm'),
  message = '',
  confirmText = t('common.confirm', 'Confirm'),
  cancelText = t('common.cancel', 'Cancel'),
  danger = false,
  iconName = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve(value);
    };
    const modal = openModal({
      title,
      size: 'sm',
      body: h(
        'div',
        { class: 'row', style: { alignItems: 'flex-start', gap: '14px' } },
        iconName
          ? h(
              'div',
              {
                style: {
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: '0',
                  background: danger ? 'var(--danger-050)' : 'var(--brand-050)',
                  color: danger ? 'var(--danger)' : 'var(--brand)',
                },
              },
              icon(iconName),
            )
          : null,
        h('div', { class: 'grow', style: { fontSize: 'var(--fs-sm)', color: 'var(--text-2)' } }, message),
      ),
      footer: [
        h('button', { class: 'btn', onclick: () => finish(false) }, cancelText),
        h('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onclick: () => finish(true) }, confirmText),
      ],
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
    });
  });
}

export function promptDialog({
  title,
  label,
  value = '',
  placeholder = '',
  confirmText = t('common.save', 'Save'),
  type = 'text',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const input = h('input', { class: 'input', value, placeholder, type });
    const finish = (val) => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve(val);
    };
    const modal = openModal({
      title,
      size: 'sm',
      body: h('div', { class: 'field' }, label ? h('label', { class: 'field__label' }, label) : null, input),
      footer: [
        h('button', { class: 'btn', onclick: () => finish(null) }, t('common.cancel', 'Cancel')),
        h(
          'button',
          {
            class: 'btn btn--primary',
            onclick: () => finish(input.value.trim()),
          },
          confirmText,
        ),
      ],
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim());
    });
    setTimeout(() => input.focus(), 40);
  });
}

/* ------------------------------------------------------------------ *
 * Dropdown helper
 * ------------------------------------------------------------------ */
export function attachDropdown(trigger, menu, { align = 'end' } = {}) {
  menu.classList.add('dropdown__menu');
  if (align === 'start') menu.classList.add('dropdown__menu--start');
  menu.hidden = true;
  const wrap = h('div', { class: 'dropdown' }, trigger, menu);
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const close = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside, true);
    document.removeEventListener('keydown', onKey);
  };
  const open = () => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      document.addEventListener('click', onOutside, true);
      document.addEventListener('keydown', onKey);
    }, 0);
  };
  const onOutside = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  menu.addEventListener('click', () => close());
  return { el: wrap, close, open };
}

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */
export function badge(text, tone = 'muted', { dot = true } = {}) {
  return h('span', { class: `badge badge--${tone}${dot ? '' : ' badge--no-dot'}` }, text);
}

export function emptyState({ iconName = 'inbox', title, message, action = null } = {}) {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__icon' }, icon(iconName)),
    h('h4', {}, title || t('common.noData', 'No data')),
    message ? h('p', {}, message) : null,
    action,
  );
}

export function spinner(size = '') {
  return h('span', { class: `spinner ${size === 'lg' ? 'spinner--lg' : ''}` });
}

export function setLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    clear(button);
    button.append(spinner(), h('span', {}, label || t('common.loading', 'Loading…')));
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

export function pageHeader({ title, subtitle, iconName = 'grid', actions = [], breadcrumbs = null }) {
  return h(
    'div',
    {},
    breadcrumbs,
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        { class: 'page-head__title' },
        h('div', { class: 'page-head__icon' }, icon(iconName)),
        h('div', {}, h('h1', {}, title), subtitle ? h('p', { class: 'page-head__sub' }, subtitle) : null),
      ),
      actions.length ? h('div', { class: 'page-head__actions' }, actions) : null,
    ),
  );
}

export function card({ title, subtitle, actions = [], body, flush = false, foot = null, className = '' } = {}) {
  return h(
    'section',
    { class: `card ${className}` },
    title || actions.length
      ? h(
          'div',
          { class: 'card__head' },
          h('div', { class: 'grow' }, title ? h('h3', {}, title) : null, subtitle ? h('div', { class: 'sub' }, subtitle) : null),
          actions.length ? h('div', { class: 'card__head__actions' }, actions) : null,
        )
      : null,
    h('div', { class: `card__body ${flush ? 'card__body--flush' : ''}` }, body),
    foot,
  );
}

export function breadcrumbs(items) {
  const parts = [];
  items.forEach((item, index) => {
    if (index) parts.push(icon('chevron-right'));
    parts.push(item.href ? h('a', { href: item.href }, item.label) : h('span', {}, item.label));
  });
  return h('nav', { class: 'breadcrumbs' }, parts);
}

export function skeletonTable(rows = 6) {
  return h(
    'div',
    { style: { padding: 'var(--sp-4)' } },
    h('div', { class: 'skeleton skeleton--title' }),
    ...Array.from({ length: rows }, () => h('div', { class: 'skeleton skeleton--row' })),
  );
}

export function progressBar(value, { max = 100, tone = '' } = {}) {
  const pct = max ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  return h(
    'div',
    { class: 'progress' },
    h('div', { class: 'progress__bar', style: { width: `${pct}%`, ...(tone ? { background: tone } : {}) } }),
  );
}
