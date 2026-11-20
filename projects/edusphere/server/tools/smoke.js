/**
 * EduSphere smoke test — exercises auth, metadata, CRUD, reports and backup
 * against a running server. Usage: node server/tools/smoke.js [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function resolveBase() {
  if (process.argv[2]) return process.argv[2].replace(/\/$/, '');
  if (process.env.EDUSPHERE_URL) return process.env.EDUSPHERE_URL.replace(/\/$/, '');
  const portFile = path.join(ROOT, '.port');
  const port = fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8').trim() : '4173';
  return `http://localhost:${port}`;
}

const BASE = resolveBase();
let cookie = '';
let passed = 0;
let failed = 0;
const failures = [];

async function api(method, url, body, { raw = false } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let data = text;
  if (!raw) {
    try {
      data = JSON.parse(text);
    } catch {
      /* keep text */
    }
  }
  return { status: res.status, ok: res.ok, data };
}

function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`\nEduSphere smoke test → ${BASE}\n`);

  /* health */
  const health = await api('GET', '/api/health');
  check('GET /api/health', health.ok && health.data.ok === true, `status ${health.status}`);

  /* auth */
  const login = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  check('POST /api/auth/login', login.ok && login.data.user?.username === 'admin', `status ${login.status}`);
  check('session cookie set', Boolean(cookie));

  const me = await api('GET', '/api/auth/me');
  check('GET /api/auth/me', me.ok && me.data.user?.username === 'admin');

  /* bootstrap */
  const boot = await api('GET', '/api/bootstrap');
  const entities = boot.data?.entities || [];
  check('GET /api/bootstrap', boot.ok && entities.length > 50, `${entities.length} entities`);
  check('translations loaded', Object.keys(boot.data?.translations || {}).length > 100, `${Object.keys(boot.data?.translations || {}).length} keys`);
  check('branches loaded', (boot.data?.branches || []).length >= 1);

  /* dashboard */
  const dash = await api('GET', '/api/dashboard');
  check('GET /api/dashboard', dash.ok && typeof dash.data === 'object', `status ${dash.status}`);

  /* generic list + options */
  const students = await api('GET', '/api/students?pageSize=5&sort=id%20desc');
  check('GET /api/students', students.ok && Array.isArray(students.data.rows) && students.data.rows.length > 0, `total ${students.data?.total}`);
  check('student ref labels resolved', students.data?.rows?.[0] && 'grade_level_id__label' in students.data.rows[0]);
  const opts = await api('GET', '/api/students/options?limit=5');
  check('GET /api/students/options', opts.ok && Array.isArray(opts.data.rows));

  /* filters */
  const filtered = await api('GET', '/api/students?pageSize=3&filter%5Bstatus%5D=active');
  check('filtered list', filtered.ok && Array.isArray(filtered.data.rows));

  /* CRUD on books */
  const created = await api('POST', '/api/books', {
    code: `SMOKE-${Date.now()}`,
    title_en: 'Smoke Test Book',
    title_ar: 'كتاب الاختبار',
    author: 'Automated Test',
    total_copies: 2,
    available_copies: 2,
  });
  check('POST /api/books', created.status === 201 && created.data.id, `status ${created.status}`);
  const bookId = created.data?.id;

  if (bookId) {
    const read = await api('GET', `/api/books/${bookId}`);
    check('GET /api/books/:id', read.ok && read.data.row?.title_en === 'Smoke Test Book');

    const updated = await api('PATCH', `/api/books/${bookId}`, { author: 'Updated Author' });
    check('PATCH /api/books/:id', updated.ok && updated.data.row?.author === 'Updated Author');

    const del = await api('DELETE', `/api/books/${bookId}`);
    check('DELETE /api/books/:id (soft)', del.ok);
    const afterDelete = await api('GET', `/api/books/${bookId}`);
    check('soft-deleted row still retrievable', afterDelete.ok);
    await api('DELETE', `/api/books/${bookId}?hard=1`);
    const hardGone = await api('GET', `/api/books/${bookId}`);
    check('hard delete removes row', hardGone.status === 404);
  }

  /* validation */
  const invalid = await api('POST', '/api/books', { author: 'No title' });
  check('validation rejects missing required field', invalid.status === 400 && invalid.data.errors?.length);

  /* ERP reports */
  const reports = [
    ['trial-balance', '/api/reports/trial-balance'],
    ['income-statement', '/api/reports/income-statement'],
    ['balance-sheet', '/api/reports/balance-sheet'],
    ['equity-changes', '/api/reports/equity-changes'],
    ['cash-flow', '/api/reports/cash-flow'],
    ['aging', '/api/reports/aging'],
    ['fee-collection', '/api/reports/fee-collection'],
    ['attendance-summary', '/api/reports/attendance-summary'],
    ['enrollment', '/api/reports/enrollment'],
    ['payroll', '/api/reports/payroll'],
    ['budget-variance', '/api/reports/budget-variance'],
    ['class-roster', '/api/reports/class-roster'],
    ['teacher-load', '/api/reports/teacher-load'],
    ['grade-sheet', '/api/reports/grade-sheet'],
    ['asset-register', '/api/reports/asset-register'],
    ['library-circulation', '/api/reports/library-circulation'],
    ['transport-routes', '/api/reports/transport-routes'],
  ];
  for (const [name, url] of reports) {
    const r = await api('GET', url);
    check(`report ${name}`, r.ok, `status ${r.status} ${typeof r.data === 'object' ? '' : r.data}`);
  }

  /* accounting & journal */
  const journal = await api('POST', '/api/erp/journal', {
    entry_date: new Date().toISOString().slice(0, 10),
    description_en: 'Smoke test journal',
    description_ar: 'قيد اختبار',
    lines: [
      { account_id: 1, debit: 100, credit: 0, description: 'Debit' },
      { account_id: 2, debit: 0, credit: 100, description: 'Credit' },
    ],
  });
  check('POST /api/erp/journal', journal.ok || journal.status === 400, `status ${journal.status}`);

  /* backup */
  const backup = await api('POST', '/api/backup/create', { note: 'smoke test' });
  check('POST /api/backup/create', backup.ok, `status ${backup.status}`);
  const list = await api('GET', '/api/backup/list');
  check('GET /api/backup/list', list.ok && Array.isArray(list.data.files) && list.data.files.length > 0);

  /* i18n */
  const i18n = await api('GET', '/api/i18n/en');
  check('GET /api/i18n/en', i18n.ok && Object.keys(i18n.data.translations || {}).length > 100);

  /* global search */
  const search = await api('GET', '/api/search?q=ah');
  check('GET /api/search', search.ok && Array.isArray(search.data.results));

  /* logout */
  const logout = await api('POST', '/api/auth/logout');
  check('POST /api/auth/logout', logout.ok);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  • ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
