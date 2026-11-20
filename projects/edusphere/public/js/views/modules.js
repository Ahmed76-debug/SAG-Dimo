import { h, icon } from '../core/dom.js';
import { store } from '../core/store.js';
import { pageHeader, card, badge } from '../core/ui.js';
import { entityLabel, groupLabel } from '../core/i18n.js';
import { L, tt } from './common.js';

export default async function renderModules() {
  const entities = store.get('entities').filter((e) => store.can(`${e.name}.read`));
  const byGroup = new Map();
  for (const e of entities) {
    const g = e.group || 'other';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(e);
  }
  const groups = store.get('groups') || [];
  const ordered = [];
  for (const g of groups) if (byGroup.has(g.code)) ordered.push([g.code, byGroup.get(g.code)]);
  for (const [k, v] of byGroup) if (!groups.find((g) => g.code === k)) ordered.push([k, v]);

  const body = h('div', { class: 'modules-groups' },
    ordered.map(([code, list]) => h('section', { class: 'modules-group' },
      h('h2', { class: 'modules-group__title' }, groupLabel(code)),
      h('div', { class: 'modules-grid' },
        list.map((e) => h('a', { class: 'module-card', href: `#/e/${e.name}` },
          h('div', { class: 'module-card__icon' }, icon(e.icon || 'table')),
          h('div', { class: 'module-card__body' },
            h('div', { class: 'module-card__name' }, entityLabel(e)),
            h('div', { class: 'module-card__meta' }, `${e.fields?.length || 0} ${L('fields', 'حقل')}`)),
          h('span', { class: 'module-card__arrow' }, icon(L('arrow-right', 'arrow-left'))),
        )),
      ),
    )),
  );

  return h('div', { class: 'view view--modules' },
    pageHeader({
      title: tt('nav.modules', 'All modules', 'جميع الوحدات'),
      subtitle: tCount(entities.length),
      iconName: 'grid',
    }),
    card({ body }),
  );
}

function tCount(n) {
  return L(`${n} modules available`, `${n} وحدة متاحة`);
}
