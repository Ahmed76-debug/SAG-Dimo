/* Smoke test: exercises the main API flows end-to-end. Usage: node scripts/smoke.mjs */
const BASE = process.env.MIFTAH_URL || 'http://127.0.0.1:4781';
const DEMO_KEY = 'mft_live_demo_7f3a9c2e5b1d4a6f8c0e2b4d6a8f0c2e';

let token = '';
async function call(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const json = await res.json();
  if (!json.ok) throw new Error(`${method} ${path} -> ${res.status} ${json.error?.code}: ${json.error?.message}`);
  return json.data;
}

let passed = 0;
function ok(name) { passed++; console.log(`  ✓ ${name}`); }

console.log(`\nMiftah Studio smoke test → ${BASE}\n`);

const login = await call('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
token = login.token;
ok(`login as ${login.user.name} (${login.user.role.slug})`);

const dash = await call('/api/dashboard');
ok(`dashboard: ${dash.cards.licenses} licenses, ${dash.cards.activations} activations`);

const products = await call('/api/products');
ok(`products list (${products.items.length})`);

const createdProduct = await call('/api/products', {
  method: 'POST',
  body: {
    name: 'منتج اختبار', code: 'TST', category: 'اختبار', platform: 'Windows', color: '#22d3ee',
    activationMode: 'hybrid', defaultPlan: 'subscription', defaultDays: 30, defaultSeats: 2,
    features: ['ميزة أ', 'ميزة ب'],
  },
});
ok(`product create #${createdProduct.product.id}`);

const customers = await call('/api/customers');
ok(`customers list (${customers.items.length})`);

const license = await call('/api/licenses', {
  method: 'POST',
  body: {
    productId: createdProduct.product.id,
    customerId: customers.items[0].id,
    plan: 'subscription',
    days: 60,
    maxSeats: 2,
    price: 149,
    features: ['ميزة أ'],
    notes: 'ترخيص اختبار آلي',
  },
});
ok(`license create ${license.license.uid} key=${license.key.slice(0, 9)}…`);

const detail = await call(`/api/licenses/${license.license.id}`);
ok(`license detail (${detail.activations.length} activations)`);

const revealed = await call(`/api/licenses/${license.license.id}/reveal`, { method: 'POST' });
if (revealed.key !== license.key) throw new Error('reveal mismatch');
ok('license reveal matches generated key');

const offlineRes = await call(
  `/api/licenses/${license.license.id}/offline-license?machineId=TEST-MACHINE-0001&machineName=QA-PC`,
  { raw: true }
);
const offlineDoc = await offlineRes.json();
if (offlineDoc.payload?.machineId !== 'TEST-MACHINE-0001') throw new Error('offline doc missing machine');
ok(`offline .lic signed (${offlineDoc.payload.licenseUid})`);

const apiHeaders = { 'x-api-key': DEMO_KEY };
const activation = await call('/api/v1/activate', {
  method: 'POST',
  headers: apiHeaders,
  body: { licenseKey: license.key, productCode: 'TST', machineId: 'TEST-MACHINE-0001', machineName: 'QA-PC', os: 'Windows 11' },
});
ok(`online activation (seats ${activation.seats.used}/${activation.seats.max})`);

const validation = await call('/api/v1/validate', {
  method: 'POST', headers: apiHeaders,
  body: { licenseKey: license.key, machineId: 'TEST-MACHINE-0001' },
});
if (!validation.valid) throw new Error('validation should be valid');
ok('online validation valid + refreshed token');

const renewal = await call(`/api/licenses/${license.license.id}/renew`, { method: 'POST', body: { days: 30 } });
ok(`renewal → ${renewal.expiresAt.slice(0, 10)}`);

const publicKey = await call('/api/v1/public-key');
ok(`public key fingerprint ${publicKey.fingerprint}`);

const backup = await call('/api/backups', { method: 'POST', body: { note: 'smoke test' } });
ok(`backup created ${backup.backup.filename} (${Math.round(backup.backup.size / 1024)} KB)`);

const restored = await call('/api/backups/restore', { method: 'POST', body: { path: backup.backup.path } });
ok(`backup restore (${restored.restoredFrom})`);

const afterRestore = await call('/api/dashboard');
ok(`db alive after restore (${afterRestore.cards.licenses} licenses)`);

const roles = await call('/api/roles');
ok(`roles (${roles.items.length})`);

const users = await call('/api/users');
ok(`users (${users.items.length})`);

const audit = await call('/api/audit?limit=5');
ok(`audit log (${audit.total} entries)`);

console.log(`\n✅ ${passed} checks passed\n`);
