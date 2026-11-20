import { all, get, run, insertRow, transaction } from '../lib/db.js';
import { sendJson, readJson, HttpError } from '../lib/http.js';
import { getEntity } from '../entities/index.js';
import { listRows, getRow, createRow, updateRow, deleteRow, restoreRow, optionsFor, bulkAction } from '../lib/crud.js';
import { requirePerm } from './system.js';
import { toCsv, nowIso, round2 } from '../lib/util.js';

function resolveEntity(name) {
  const entity = getEntity(name);
  if (!entity) throw new HttpError(404, 'unknown_entity');
  return entity;
}

export function registerDataRoutes(router) {
  /* ---------------- generic CRUD ---------------- */
  router.get('/api/:entity/options', ({ res, params, query, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.read`);
    sendJson(res, 200, { rows: optionsFor(entity, query) });
  });

  router.get('/api/:entity/export', ({ res, params, query, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.export`);
    const data = listRows(entity, { ...query, page: 1, pageSize: 5000 }, ctx);
    const cols = entity.fields.filter((f) => f.type !== 'password').map((f) => f.name);
    const flat = data.rows.map((row) => {
      const out = {};
      for (const c of cols) {
        const v = row[c];
        out[c] = v && typeof v === 'object' ? JSON.stringify(v) : v;
      }
      return out;
    });
    const csv = toCsv(flat, cols);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entity.name}-${nowIso().slice(0, 10)}.csv"`,
    });
    res.end(csv);
  });

  router.get('/api/:entity/:id', ({ res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.read`);
    const row = getRow(entity, params.id, ctx);
    if (!row) throw new HttpError(404, 'not_found');
    sendJson(res, 200, { row });
  });

  router.get('/api/:entity', ({ res, params, query, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.read`);
    const data = listRows(entity, query, ctx);
    sendJson(res, 200, data);
  });

  router.post('/api/:entity', async ({ req, res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.create`);
    const body = await readJson(req);
    const result = createRow(entity, body, ctx);
    if (result.errors) return sendJson(res, 400, { error: 'validation', errors: result.errors });
    sendJson(res, 201, { row: result.row, id: result.id });
  });

  router.patch('/api/:entity/:id', async ({ req, res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.update`);
    const body = await readJson(req);
    const result = updateRow(entity, params.id, body, ctx);
    if (result.errors) {
      const status = result.errors[0]?.code === 'notFound' ? 404 : 400;
      return sendJson(res, status, { error: result.errors[0]?.code === 'notFound' ? 'not_found' : 'validation', errors: result.errors });
    }
    sendJson(res, 200, { row: result.row });
  });

  router.put('/api/:entity/:id', async ({ req, res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.update`);
    const body = await readJson(req);
    const result = updateRow(entity, params.id, body, ctx);
    if (result.errors) return sendJson(res, 400, { error: 'validation', errors: result.errors });
    sendJson(res, 200, { row: result.row });
  });

  router.delete('/api/:entity/:id', ({ res, params, query, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.delete`);
    const result = deleteRow(entity, params.id, ctx, { hard: query.hard === '1' });
    if (result.errors) throw new HttpError(404, 'not_found');
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/:entity/:id/restore', ({ res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    requirePerm(ctx, `${entity.name}.update`);
    const result = restoreRow(entity, params.id, ctx);
    sendJson(res, 200, { row: result.row });
  });

  router.post('/api/:entity/bulk', async ({ req, res, params, ctx }) => {
    const entity = resolveEntity(params.entity);
    const body = await readJson(req);
    const action = body.action || 'delete';
    requirePerm(ctx, `${entity.name}.${action === 'restore' ? 'update' : 'delete'}`);
    const result = bulkAction(entity, action, body.ids || [], ctx);
    sendJson(res, 200, result);
  });

  /* ---------------- payroll processing ---------------- */
  router.post('/api/payroll_runs/:id/process', ({ res, params, ctx }) => {
    requirePerm(ctx, 'payroll_runs.update');
    const runRow = get(`SELECT * FROM payroll_runs WHERE id = ?`, [params.id]);
    if (!runRow) throw new HttpError(404, 'not_found');
    const staff = all(`SELECT * FROM staff WHERE status = 'active' AND deleted_at IS NULL`);
    let gross = 0;
    let deductions = 0;
    let net = 0;
    transaction(() => {
      run(`DELETE FROM payslips WHERE payroll_run_id = ?`, [runRow.id]);
      for (const s of staff) {
        const basic = s.basic_salary || 0;
        const allowances = s.allowances || 0;
        const tax = round2(basic * 0.05);
        const insurance = round2(basic * 0.03);
        const ded = round2(tax + insurance);
        const netPay = round2(basic + allowances - ded);
        gross += basic + allowances;
        deductions += ded;
        net += netPay;
        insertRow('payslips', {
          payroll_run_id: runRow.id,
          staff_id: s.id,
          basic,
          allowances,
          overtime: 0,
          deductions: ded,
          tax,
          insurance,
          net: netPay,
          currency_code: s.currency_code || 'USD',
          status: 'draft',
        });
      }
      run(`UPDATE payroll_runs SET total_gross = ?, total_deductions = ?, total_net = ?, status = 'approved', processed_at = ? WHERE id = ?`, [
        round2(gross),
        round2(deductions),
        round2(net),
        nowIso(),
        runRow.id,
      ]);
    });
    sendJson(res, 200, { ok: true, gross: round2(gross), deductions: round2(deductions), net: round2(net), count: staff.length });
  });

  /* ---------------- fixed asset depreciation ---------------- */
  router.post('/api/fixed_assets/:id/depreciate', async ({ req, res, params, ctx }) => {
    requirePerm(ctx, 'fixed_assets.update');
    const asset = get(`SELECT * FROM fixed_assets WHERE id = ?`, [params.id]);
    if (!asset) throw new HttpError(404, 'not_found');
    const body = await readJson(req);
    const annual = round2(((asset.cost - (asset.salvage_value || 0)) / (asset.useful_life_years || 5)));
    const amount = body.amount ? round2(body.amount) : round2(annual / 12);
    const accumulated = round2((asset.accumulated_depreciation || 0) + amount);
    const bookValue = round2(asset.cost - accumulated);
    run(`UPDATE fixed_assets SET accumulated_depreciation = ?, book_value = ?, updated_at = ? WHERE id = ?`, [accumulated, bookValue, nowIso(), asset.id]);
    sendJson(res, 200, { ok: true, amount, accumulated, bookValue });
  });

  /* ---------------- library return ---------------- */
  router.post('/api/book_loans/:id/return', ({ res, params, ctx }) => {
    requirePerm(ctx, 'book_loans.update');
    const loan = get(`SELECT * FROM book_loans WHERE id = ?`, [params.id]);
    if (!loan) throw new HttpError(404, 'not_found');
    const today = nowIso().slice(0, 10);
    const daysLate = Math.max(0, Math.floor((new Date(today) - new Date(loan.due_date)) / 86400000));
    const fine = round2(daysLate * 1);
    transaction(() => {
      run(`UPDATE book_loans SET status = 'returned', return_date = ?, fine = ? WHERE id = ?`, [today, fine, loan.id]);
      if (loan.copy_id) run(`UPDATE book_copies SET status = 'available' WHERE id = ?`, [loan.copy_id]);
      if (loan.book_id) run(`UPDATE books SET available_copies = available_copies + 1 WHERE id = ?`, [loan.book_id]);
    });
    sendJson(res, 200, { ok: true, fine, daysLate });
  });
}
