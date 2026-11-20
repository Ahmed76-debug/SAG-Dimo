import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, insertRow, transaction, nextSequence, getSetting } from '../lib/db.js';
import { sendJson, readJson, HttpError } from '../lib/http.js';
import { requirePerm } from './system.js';
import { nowIso, todayIso, round2, formatSequence } from '../lib/util.js';
import {
  trialBalance, incomeStatement, balanceSheet, equityChanges, cashFlow, generalLedger, aging,
  studentStatement, feeCollection, attendanceSummary, enrollmentStats, payrollSummary, budgetVariance,
} from '../lib/reports.js';
import { browseFolder, listBackups, createBackup, restoreBackup, verifyBackup, resolveFolder, saveBackupSettings, ensureFolder } from '../lib/backup.js';

const num = (v, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v));

/* ------------------------------------------------------------------ *
 * Accounting helpers
 * ------------------------------------------------------------------ */
function applyBalances(lines) {
  for (const line of lines) {
    const account = get(`SELECT current_balance FROM accounts WHERE id = ?`, [line.account_id]);
    if (!account) continue;
    const delta = num(line.debit) - num(line.credit);
    run(`UPDATE accounts SET current_balance = ? WHERE id = ?`, [round2((account.current_balance || 0) + delta), line.account_id]);
  }
}

export function postJournal({ entry_date, reference, description_en, description_ar, branch_id, source = 'manual', lines, post = true, createdBy = null }) {
  const clean = (lines || [])
    .filter((l) => l.account_id && (num(l.debit) || num(l.credit)))
    .map((l) => ({ ...l, debit: round2(num(l.debit)), credit: round2(num(l.credit)) }));
  if (clean.length < 2) throw new HttpError(400, 'journal_needs_two_lines');
  const totalDebit = round2(clean.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) throw new HttpError(400, 'journal_not_balanced');

  return transaction(() => {
    const seq = nextSequence('journal', 1);
    const entryNo = formatSequence(getSetting('app', 'numbering', {}).journal || 'JE', seq, 5);
    const period = get(
      `SELECT id FROM fiscal_periods WHERE start_date <= ? AND end_date >= ? LIMIT 1`,
      [entry_date, entry_date],
    );
    const id = insertRow('journal_entries', {
      entry_no: entryNo,
      fiscal_period_id: period?.id || null,
      entry_date,
      reference: reference || null,
      description_en: description_en || null,
      description_ar: description_ar || null,
      source,
      status: post ? 'posted' : 'draft',
      total_debit: totalDebit,
      total_credit: totalCredit,
      branch_id: branch_id || null,
      posted_at: post ? nowIso() : null,
      posted_by: post ? createdBy : null,
      created_by: createdBy,
    });
    clean.forEach((l, i) => {
      insertRow('journal_lines', {
        journal_entry_id: id,
        account_id: l.account_id,
        description: l.description || description_en || null,
        debit: l.debit,
        credit: l.credit,
        currency_code: l.currency_code || 'USD',
        exchange_rate: l.exchange_rate || 1,
        cost_center_id: l.cost_center_id || null,
        branch_id: branch_id || null,
        sort_order: i,
      });
    });
    if (post) applyBalances(clean);
    return { id, entry_no: entryNo, totalDebit, totalCredit };
  });
}

function reverseJournal(entryId, createdBy) {
  const entry = get(`SELECT * FROM journal_entries WHERE id = ?`, [entryId]);
  if (!entry) throw new HttpError(404, 'not_found');
  if (entry.status !== 'posted') throw new HttpError(400, 'not_posted');
  const lines = all(`SELECT * FROM journal_lines WHERE journal_entry_id = ?`, [entryId]);
  const seq = nextSequence('journal', 1);
  return transaction(() => {
    const entryNo = formatSequence(getSetting('app', 'numbering', {}).journal || 'JE', seq, 5);
    const id = insertRow('journal_entries', {
      entry_no: entryNo,
      fiscal_period_id: entry.fiscal_period_id,
      entry_date: todayIso(),
      reference: entry.entry_no,
      description_en: `Reversal of ${entry.entry_no}`,
      description_ar: `عكس القيد ${entry.entry_no}`,
      source: 'manual',
      status: 'posted',
      total_debit: entry.total_credit,
      total_credit: entry.total_debit,
      branch_id: entry.branch_id,
      posted_at: nowIso(),
      posted_by: createdBy,
      reversal_of: entry.id,
      created_by: createdBy,
    });
    const swapped = lines.map((l, i) => {
      insertRow('journal_lines', {
        journal_entry_id: id,
        account_id: l.account_id,
        description: `Reversal: ${l.description || ''}`,
        debit: l.credit,
        credit: l.debit,
        currency_code: l.currency_code,
        exchange_rate: l.exchange_rate,
        branch_id: l.branch_id,
        sort_order: i,
      });
      return { account_id: l.account_id, debit: l.credit, credit: l.debit };
    });
    applyBalances(swapped);
    run(`UPDATE journal_entries SET status = 'void' WHERE id = ?`, [entry.id]);
    return { id, entry_no: entryNo };
  });
}

export function registerBusinessRoutes(router) {
  /* ---------------- journal entries ---------------- */
  router.get('/api/erp/journal/:id', ({ res, params, ctx }) => {
    requirePerm(ctx, 'journal_entries.read');
    const entry = get(`SELECT * FROM journal_entries WHERE id = ?`, [params.id]);
    if (!entry) throw new HttpError(404, 'not_found');
    const lines = all(
      `SELECT jl.*, a.code AS account_code, a.name_en AS account_name_en, a.name_ar AS account_name_ar
       FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = ? ORDER BY jl.sort_order, jl.id`,
      [params.id],
    );
    sendJson(res, 200, { entry, lines });
  });

  router.post('/api/erp/journal', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'journal_entries.create');
    const body = await readJson(req);
    const result = postJournal({ ...body, createdBy: ctx.user.id, post: body.status !== 'draft' });
    sendJson(res, 201, { ok: true, ...result });
  });

  router.post('/api/erp/journal/:id/post', ({ res, params, ctx }) => {
    requirePerm(ctx, 'erp.post');
    const entry = get(`SELECT * FROM journal_entries WHERE id = ?`, [params.id]);
    if (!entry) throw new HttpError(404, 'not_found');
    if (entry.status === 'posted') throw new HttpError(400, 'already_posted');
    const lines = all(`SELECT * FROM journal_lines WHERE journal_entry_id = ?`, [entry.id]);
    transaction(() => {
      run(`UPDATE journal_entries SET status = 'posted', posted_at = ?, posted_by = ? WHERE id = ?`, [nowIso(), ctx.user.id, entry.id]);
      applyBalances(lines);
    });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/erp/journal/:id/reverse', ({ res, params, ctx }) => {
    requirePerm(ctx, 'erp.post');
    const result = reverseJournal(params.id, ctx.user.id);
    sendJson(res, 200, { ok: true, ...result });
  });

  /* ---------------- invoices ---------------- */
  router.post('/api/finance/invoices/generate', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'invoices.create');
    const body = await readJson(req);
    const structure = get(`SELECT * FROM fee_structures WHERE id = ?`, [body.fee_structure_id]);
    if (!structure) throw new HttpError(404, 'fee_structure_not_found');
    const items = all(`SELECT * FROM fee_items WHERE fee_structure_id = ? ORDER BY sort_order`, [structure.id]);
    if (!items.length) throw new HttpError(400, 'no_fee_items');

    let students = [];
    if (Array.isArray(body.student_ids) && body.student_ids.length) {
      students = all(`SELECT * FROM students WHERE id IN (${body.student_ids.map(() => '?').join(',')})`, body.student_ids);
    } else if (body.section_id) {
      students = all(`SELECT * FROM students WHERE section_id = ? AND status = 'active'`, [body.section_id]);
    } else if (body.grade_level_id) {
      students = all(`SELECT * FROM students WHERE grade_level_id = ? AND status = 'active'`, [body.grade_level_id]);
    } else {
      students = all(`SELECT * FROM students WHERE status = 'active'`);
    }

    const created = [];
    const skipped = [];
    transaction(() => {
      for (const student of students) {
        const existing = get(
          `SELECT id FROM invoices WHERE student_id = ? AND academic_year_id = ? AND notes LIKE ?`,
          [student.id, structure.academic_year_id, `%FS:${structure.id}%`],
        );
        if (existing) {
          skipped.push(student.id);
          continue;
        }
        const subtotal = round2(items.reduce((s, it) => s + (it.amount || 0), 0));
        const discountPct = student.discount_percent || 0;
        const discountTotal = round2((subtotal * discountPct) / 100);
        const total = round2(subtotal - discountTotal);
        const seq = nextSequence('invoice', 1);
        const invoiceNo = formatSequence(getSetting('app', 'numbering', {}).invoice || 'INV', seq, 5);
        const issueDate = body.issue_date || todayIso();
        const invId = insertRow('invoices', {
          invoice_no: invoiceNo,
          student_id: student.id,
          academic_year_id: structure.academic_year_id,
          term_id: structure.term_id,
          branch_id: student.branch_id || structure.branch_id,
          issue_date: issueDate,
          due_date: body.due_date || issueDate,
          currency_code: structure.currency_code || 'USD',
          exchange_rate: 1,
          subtotal,
          discount_total: discountTotal,
          tax_total: 0,
          total,
          paid_total: 0,
          balance: total,
          status: 'unpaid',
          notes: `FS:${structure.id}`,
          created_by: ctx.user.id,
        });
        items.forEach((it, idx) => {
          insertRow('invoice_lines', {
            invoice_id: invId,
            fee_item_id: it.id,
            fee_category_id: it.fee_category_id,
            description_en: it.name_en,
            description_ar: it.name_ar,
            quantity: 1,
            unit_price: it.amount,
            discount: round2((it.amount * discountPct) / 100),
            tax_rate: 0,
            line_total: round2(it.amount - (it.amount * discountPct) / 100),
            sort_order: idx,
          });
        });
        created.push({ id: invId, invoice_no: invoiceNo, student_id: student.id });
      }
    });
    sendJson(res, 200, { ok: true, created: created.length, skipped: skipped.length, invoices: created });
  });

  router.post('/api/finance/invoices/:id/pay', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'fees.collect');
    const body = await readJson(req);
    const invoice = get(`SELECT * FROM invoices WHERE id = ?`, [params.id]);
    if (!invoice) throw new HttpError(404, 'not_found');
    const amount = round2(num(body.amount));
    if (amount <= 0) throw new HttpError(400, 'invalid_amount');
    const exchangeRate = num(body.exchange_rate, 1) || 1;
    const baseCurrency = getSetting('app', 'finance', {}).base_currency || 'USD';

    const result = transaction(() => {
      const seq = nextSequence('receipt', 1);
      const receiptNo = formatSequence(getSetting('app', 'numbering', {}).receipt || 'RCT', seq, 5);
      const paymentId = insertRow('payments', {
        receipt_no: receiptNo,
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        branch_id: invoice.branch_id,
        amount,
        currency_code: body.currency_code || invoice.currency_code,
        exchange_rate: exchangeRate,
        base_amount: round2(amount * exchangeRate),
        method_id: body.method_id || null,
        method: body.method || 'cash',
        reference_no: body.reference_no || null,
        payment_date: body.payment_date || todayIso(),
        status: 'completed',
        notes: body.notes || null,
        received_by: ctx.user.id,
      });

      const paidTotal = round2((invoice.paid_total || 0) + amount);
      const balance = round2((invoice.total || 0) - paidTotal);
      const status = balance <= 0.01 ? 'paid' : paidTotal > 0 ? 'partial' : invoice.status;
      run(`UPDATE invoices SET paid_total = ?, balance = ?, status = ?, updated_at = ? WHERE id = ?`, [
        paidTotal,
        Math.max(0, balance),
        status,
        nowIso(),
        invoice.id,
      ]);

      // resolve cash/bank account: explicit bank_account_id, else method's linked bank_account, else fallback by method type
      let baId = body.bank_account_id ? Number(body.bank_account_id) : null;
      if (!baId && body.method_id) {
        const pm = get(`SELECT bank_account_id, account_id, type FROM payment_methods WHERE id = ?`, [body.method_id]);
        if (pm?.bank_account_id) baId = pm.bank_account_id;
        if (!baId && pm?.account_id) {
          // use GL account directly from method
          const ar0 = get(`SELECT id FROM accounts WHERE code = '1130'`);
          if (ar0) {
            const journal = postJournal({
              entry_date: body.payment_date || todayIso(),
              reference: receiptNo,
              description_en: `Fee payment — ${invoice.invoice_no}`,
              description_ar: `سداد رسوم — ${invoice.invoice_no}`,
              branch_id: invoice.branch_id,
              source: 'payment',
              createdBy: ctx.user.id,
              lines: [
                { account_id: pm.account_id, debit: round2(amount * exchangeRate), credit: 0, description: receiptNo },
                { account_id: ar0.id, debit: 0, credit: round2(amount * exchangeRate), description: receiptNo },
              ],
            });
            run(`UPDATE payments SET journal_entry_id = ?, bank_account_id = NULL WHERE id = ?`, [journal.id, paymentId]);
            return { paymentId, receiptNo, paidTotal, balance: Math.max(0, balance), status, journalId: journal.id, baseCurrency };
          }
        }
      }
      if (baId) run(`UPDATE payments SET bank_account_id = ? WHERE id = ?`, [baId, paymentId]);
      const ba = baId ? get(`SELECT * FROM bank_accounts WHERE id = ?`, [baId]) : null;
      let debitAccountId = ba?.account_id || null;
      if (!debitAccountId) {
        const cashCode = (body.method === 'cash' || ba?.kind === 'cashbox') ? '1110' : '1120';
        debitAccountId = get(`SELECT id FROM accounts WHERE code = ?`, [cashCode])?.id || null;
      }
      const ar = get(`SELECT id FROM accounts WHERE code = '1130'`);
      let journal = null;
      if (debitAccountId && ar) {
        journal = postJournal({
          entry_date: body.payment_date || todayIso(),
          reference: receiptNo,
          description_en: `Fee payment — ${invoice.invoice_no}`,
          description_ar: `سداد رسوم — ${invoice.invoice_no}`,
          branch_id: invoice.branch_id,
          source: 'payment',
          createdBy: ctx.user.id,
          lines: [
            { account_id: debitAccountId, debit: round2(amount * exchangeRate), credit: 0, description: receiptNo },
            { account_id: ar.id, debit: 0, credit: round2(amount * exchangeRate), description: receiptNo },
          ],
        });
        run(`UPDATE payments SET journal_entry_id = ? WHERE id = ?`, [journal.id, paymentId]);
        if (baId) run(`UPDATE bank_accounts SET current_balance = ROUND(COALESCE(current_balance,0) + ?, 2) WHERE id = ?`, [round2(amount * exchangeRate), baId]);
      }
      return { paymentId, receiptNo, paidTotal, balance: Math.max(0, balance), status, journalId: journal?.id || null, baseCurrency };
    });

    sendJson(res, 200, { ok: true, ...result });
  });

  /* ---------------- expenses posting ---------------- */
  router.post('/api/expenses/:id/post-journal', ({ res, params, ctx }) => {
    requirePerm(ctx, 'expenses.update');
    const expense = get(`SELECT * FROM expenses WHERE id = ?`, [params.id]);
    if (!expense) throw new HttpError(404, 'not_found');
    if (expense.journal_entry_id) throw new HttpError(400, 'already_posted');
    const cash = get(`SELECT id FROM accounts WHERE code = '1120'`);
    if (!cash) throw new HttpError(400, 'no_bank_account');
    const result = postJournal({
      entry_date: expense.expense_date || todayIso(),
      reference: expense.expense_no,
      description_en: expense.description_en,
      description_ar: expense.description_ar,
      branch_id: expense.branch_id,
      source: 'expense',
      createdBy: ctx.user.id,
      lines: [
        { account_id: expense.category_account_id, debit: round2(expense.amount * (expense.exchange_rate || 1)), credit: 0 },
        { account_id: cash.id, debit: 0, credit: round2(expense.amount * (expense.exchange_rate || 1)) },
      ],
    });
    run(`UPDATE expenses SET journal_entry_id = ?, status = 'paid' WHERE id = ?`, [result.id, expense.id]);
    sendJson(res, 200, { ok: true, ...result });
  });

  /* ---------------- attendance register ---------------- */
  router.get('/api/attendance/register', ({ res, query, ctx }) => {
    requirePerm(ctx, 'attendance_records.read');
    const sectionId = Number(query.section_id);
    const date = query.date || todayIso();
    if (!sectionId) throw new HttpError(400, 'section_required');
    const students = all(
      `SELECT s.id, s.code, s.first_name_en, s.last_name_en, s.first_name_ar, s.last_name_ar,
              ar.status, ar.minutes_late, ar.reason, ar.id AS record_id
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.date = ? AND ar.section_id = s.section_id
       WHERE s.section_id = ? AND s.status = 'active' AND s.deleted_at IS NULL
       ORDER BY s.first_name_en`,
      [date, sectionId],
    );
    sendJson(res, 200, { date, section_id: sectionId, students });
  });

  router.post('/api/attendance/register', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'attendance.mark');
    const body = await readJson(req);
    const sectionId = Number(body.section_id);
    const date = body.date || todayIso();
    if (!sectionId || !Array.isArray(body.records)) throw new HttpError(400, 'invalid_payload');
    const section = get(`SELECT * FROM sections WHERE id = ?`, [sectionId]);
    let saved = 0;
    transaction(() => {
      for (const rec of body.records) {
        const existing = get(`SELECT id FROM attendance_records WHERE student_id = ? AND date = ? AND section_id = ?`, [rec.student_id, date, sectionId]);
        if (existing) {
          run(`UPDATE attendance_records SET status = ?, minutes_late = ?, reason = ?, recorded_by = ?, updated_at = ? WHERE id = ?`, [
            rec.status || 'present', num(rec.minutes_late), rec.reason || null, ctx.user.id, nowIso(), existing.id,
          ]);
        } else {
          insertRow('attendance_records', {
            student_id: rec.student_id,
            section_id: sectionId,
            date,
            status: rec.status || 'present',
            minutes_late: num(rec.minutes_late),
            reason: rec.reason || null,
            recorded_by: ctx.user.id,
            branch_id: section?.branch_id || ctx.user.branch_id || null,
          });
        }
        saved += 1;
      }
    });
    sendJson(res, 200, { ok: true, saved, date });
  });

  /* ---------------- gradebook matrix ---------------- */
  router.get('/api/grades/matrix', ({ res, query, ctx }) => {
    requirePerm(ctx, 'grades.read');
    const sectionId = Number(query.section_id);
    const subjectId = Number(query.subject_id);
    if (!sectionId || !subjectId) throw new HttpError(400, 'section_and_subject_required');
    const termId = query.term_id ? Number(query.term_id) : null;
    const assessments = all(
      `SELECT * FROM assessments WHERE section_id = ? AND subject_id = ? ${termId ? 'AND term_id = ?' : ''} ORDER BY id`,
      termId ? [sectionId, subjectId, termId] : [sectionId, subjectId],
    );
    const students = all(
      `SELECT id, code, first_name_en, last_name_en, first_name_ar, last_name_ar FROM students WHERE section_id = ? AND status = 'active' ORDER BY first_name_en`,
      [sectionId],
    );
    const grades = all(
      `SELECT g.* FROM grades g JOIN assessments a ON a.id = g.assessment_id WHERE a.section_id = ? AND a.subject_id = ? ${termId ? 'AND a.term_id = ?' : ''}`,
      termId ? [sectionId, subjectId, termId] : [sectionId, subjectId],
    );
    sendJson(res, 200, { assessments, students, grades });
  });

  router.post('/api/grades/matrix', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'grades.enter');
    const body = await readJson(req);
    if (!Array.isArray(body.grades)) throw new HttpError(400, 'invalid_payload');
    let saved = 0;
    transaction(() => {
      for (const g of body.grades) {
        if (!g.assessment_id || !g.student_id) continue;
        const assessment = get(`SELECT max_score FROM assessments WHERE id = ?`, [g.assessment_id]);
        const score = g.score === '' || g.score === null ? null : round2(num(g.score));
        const pct = assessment?.max_score ? score / assessment.max_score : 0;
        const letter = pct >= 0.9 ? 'A' : pct >= 0.8 ? 'B' : pct >= 0.7 ? 'C' : pct >= 0.6 ? 'D' : pct >= 0.5 ? 'E' : 'F';
        const existing = get(`SELECT id FROM grades WHERE assessment_id = ? AND student_id = ?`, [g.assessment_id, g.student_id]);
        if (existing) {
          run(`UPDATE grades SET score = ?, grade_letter = ?, remarks = ?, graded_by = ?, graded_at = ?, updated_at = ? WHERE id = ?`, [
            score, score === null ? null : letter, g.remarks || null, ctx.user.id, nowIso(), nowIso(), existing.id,
          ]);
        } else {
          insertRow('grades', {
            assessment_id: g.assessment_id,
            student_id: g.student_id,
            score,
            grade_letter: score === null ? null : letter,
            remarks: g.remarks || null,
            graded_by: ctx.user.id,
            graded_at: nowIso(),
          });
        }
        saved += 1;
      }
    });
    sendJson(res, 200, { ok: true, saved });
  });

  /* ---------------- timetable ---------------- */
  router.get('/api/timetable/:sectionId', ({ res, params, ctx }) => {
    requirePerm(ctx, 'timetable_slots.read');
    const slots = all(
      `SELECT ts.*, sub.name_en AS subject_name_en, sub.name_ar AS subject_name_ar, sub.color,
              st.first_name_en AS teacher_first_en, st.last_name_en AS teacher_last_en,
              st.first_name_ar AS teacher_first_ar, st.last_name_ar AS teacher_last_ar,
              cr.name_en AS room_name_en, cr.name_ar AS room_name_ar
       FROM timetable_slots ts
       LEFT JOIN subjects sub ON sub.id = ts.subject_id
       LEFT JOIN staff st ON st.id = ts.teacher_id
       LEFT JOIN classrooms cr ON cr.id = ts.room_id
       WHERE ts.section_id = ? ORDER BY ts.day_of_week, ts.period`,
      [params.sectionId],
    );
    sendJson(res, 200, { slots });
  });

  router.post('/api/timetable/slot', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'timetable_slots.create');
    const body = await readJson(req);
    const conflicts = [];
    if (body.teacher_id) {
      const c = get(
        `SELECT id FROM timetable_slots WHERE day_of_week = ? AND period = ? AND teacher_id = ? AND section_id <> ?`,
        [body.day_of_week, body.period, body.teacher_id, body.section_id || 0],
      );
      if (c) conflicts.push('teacher');
    }
    if (body.room_id) {
      const c = get(
        `SELECT id FROM timetable_slots WHERE day_of_week = ? AND period = ? AND room_id = ? AND section_id <> ?`,
        [body.day_of_week, body.period, body.room_id, body.section_id || 0],
      );
      if (c) conflicts.push('room');
    }
    if (conflicts.length && body.force !== true) return sendJson(res, 409, { error: 'conflict', conflicts });
    const existing = get(
      `SELECT id FROM timetable_slots WHERE section_id = ? AND day_of_week = ? AND period = ?`,
      [body.section_id, body.day_of_week, body.period],
    );
    if (existing) {
      run(
        `UPDATE timetable_slots SET subject_id = ?, teacher_id = ?, room_id = ?, start_time = ?, end_time = ?, updated_at = ? WHERE id = ?`,
        [body.subject_id, body.teacher_id || null, body.room_id || null, body.start_time || null, body.end_time || null, nowIso(), existing.id],
      );
      return sendJson(res, 200, { ok: true, id: existing.id, updated: true });
    }
    const id = insertRow('timetable_slots', {
      section_id: body.section_id,
      subject_id: body.subject_id,
      teacher_id: body.teacher_id || null,
      room_id: body.room_id || null,
      term_id: body.term_id || null,
      day_of_week: body.day_of_week,
      period: body.period,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      branch_id: ctx.user.branch_id || null,
    });
    sendJson(res, 201, { ok: true, id });
  });

  router.delete('/api/timetable/slot/:id', ({ res, params, ctx }) => {
    requirePerm(ctx, 'timetable_slots.delete');
    run(`DELETE FROM timetable_slots WHERE id = ?`, [params.id]);
    sendJson(res, 200, { ok: true });
  });

  /* ---------------- reports ---------------- */
  const finGuard = (ctx) => {
    requirePerm(ctx, 'reports.view');
    if (!ctx.user.is_super) requirePerm(ctx, 'reports.financial');
  };

  router.get('/api/reports/trial-balance', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, trialBalance({ from: query.from, to: query.to, branchId: query.branch, currency: query.currency || query.report_currency }));
  });
  router.get('/api/reports/income-statement', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, incomeStatement({ from: query.from, to: query.to, branchId: query.branch, comparative: query.comparative === '1', currency: query.currency || query.report_currency }));
  });
  router.get('/api/reports/balance-sheet', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, balanceSheet({ asOf: query.as_of, branchId: query.branch, currency: query.currency || query.report_currency }));
  });
  router.get('/api/reports/equity-changes', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, equityChanges({ from: query.from, to: query.to, branchId: query.branch, currency: query.currency || query.report_currency }));
  });
  router.get('/api/reports/cash-flow', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, cashFlow({ from: query.from, to: query.to, branchId: query.branch, currency: query.currency || query.report_currency }));
  });
  router.get('/api/reports/general-ledger', ({ res, query, ctx }) => {
    finGuard(ctx);
    const data = generalLedger({ accountId: Number(query.account_id), from: query.from, to: query.to, branchId: query.branch, currency: query.currency || query.report_currency });
    if (!data) throw new HttpError(404, 'not_found');
    sendJson(res, 200, data);
  });
  router.get('/api/reports/aging', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, aging({ asOf: query.as_of }));
  });
  router.get('/api/reports/student-statement/:id', ({ res, params, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const data = studentStatement(params.id, { from: query.from, to: query.to });
    if (!data) throw new HttpError(404, 'not_found');
    sendJson(res, 200, data);
  });
  router.get('/api/reports/fee-collection', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, feeCollection({ from: query.from, to: query.to, branchId: query.branch }));
  });
  router.get('/api/reports/attendance-summary', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    sendJson(res, 200, attendanceSummary({ from: query.from, to: query.to, sectionId: query.section }));
  });
  router.get('/api/reports/enrollment', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    sendJson(res, 200, enrollmentStats({ academicYearId: query.year }));
  });
  router.get('/api/reports/payroll', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    sendJson(res, 200, payrollSummary({ runId: query.run }));
  });
  router.get('/api/reports/budget-variance', ({ res, query, ctx }) => {
    finGuard(ctx);
    sendJson(res, 200, budgetVariance({ fiscalYearId: query.year }));
  });
  router.get('/api/reports/class-roster', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const rows = all(
      `SELECT s.*, g.name_en AS grade_name_en, g.name_ar AS grade_name_ar
       FROM students s LEFT JOIN grade_levels g ON g.id = s.grade_level_id
       WHERE s.section_id = ? AND s.status = 'active' ORDER BY s.first_name_en`,
      [Number(query.section)],
    );
    sendJson(res, 200, { rows });
  });
  router.get('/api/reports/teacher-load', ({ res, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const rows = all(
      `SELECT st.id, st.code, st.first_name_en, st.last_name_en, st.first_name_ar, st.last_name_ar,
              COUNT(ts.id) AS periods, COUNT(DISTINCT ts.section_id) AS sections, COUNT(DISTINCT ts.subject_id) AS subjects
       FROM staff st LEFT JOIN timetable_slots ts ON ts.teacher_id = st.id
       WHERE st.is_teacher = 1 AND st.status = 'active' GROUP BY st.id ORDER BY periods DESC`,
    );
    sendJson(res, 200, { rows });
  });
  router.get('/api/reports/grade-sheet', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const sectionId = Number(query.section);
    const termId = query.term ? Number(query.term) : null;
    const students = all(
      `SELECT id, code, first_name_en, last_name_en, first_name_ar, last_name_ar FROM students WHERE section_id = ? AND status = 'active' ORDER BY first_name_en`,
      [sectionId],
    );
    const subjects = all(
      `SELECT DISTINCT sub.id, sub.name_en, sub.name_ar, sub.color
       FROM assessments a JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.section_id = ? ${termId ? 'AND a.term_id = ?' : ''} ORDER BY sub.name_en`,
      termId ? [sectionId, termId] : [sectionId],
    );
    const scores = all(
      `SELECT a.subject_id, g.student_id, SUM(g.score) AS score, SUM(a.max_score) AS max_score
       FROM grades g JOIN assessments a ON a.id = g.assessment_id
       WHERE a.section_id = ? ${termId ? 'AND a.term_id = ?' : ''}
       GROUP BY a.subject_id, g.student_id`,
      termId ? [sectionId, termId] : [sectionId],
    );
    sendJson(res, 200, { students, subjects, scores });
  });
  router.get('/api/reports/asset-register', ({ res, ctx }) => {
    requirePerm(ctx, 'reports.view');
    sendJson(res, 200, { rows: all(`SELECT * FROM fixed_assets WHERE deleted_at IS NULL ORDER BY code`) });
  });
  router.get('/api/reports/library-circulation', ({ res, query, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const rows = all(
      `SELECT bl.*, b.title_en, b.title_ar, lm.membership_no FROM book_loans bl
       LEFT JOIN books b ON b.id = bl.book_id LEFT JOIN library_members lm ON lm.id = bl.member_id
       WHERE bl.loan_date BETWEEN ? AND ? ORDER BY bl.loan_date DESC`,
      [query.from || '2000-01-01', query.to || '2999-12-31'],
    );
    sendJson(res, 200, { rows });
  });
  router.get('/api/reports/transport-routes', ({ res, ctx }) => {
    requirePerm(ctx, 'reports.view');
    const routes = all(`SELECT * FROM transport_routes WHERE is_active = 1 ORDER BY code`);
    const stops = all(`SELECT * FROM transport_stops ORDER BY route_id, sort_order`);
    const counts = all(`SELECT route_id, COUNT(*) AS students FROM student_transport WHERE status='active' GROUP BY route_id`);
    sendJson(res, 200, { routes, stops, counts });
  });

  /* ---------------- backup ---------------- */
  router.get('/api/backup/browse', ({ res, query, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    sendJson(res, 200, browseFolder(query.folder || ''));
  });

  router.get('/api/backup/list', ({ res, query, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    sendJson(res, 200, listBackups(query.folder || getSetting('app', 'backup', {}).folder));
  });

  router.get('/api/backup/settings', ({ res, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    sendJson(res, 200, { settings: getSetting('app', 'backup', {}), history: getSetting('app', 'backup_history', []) });
  });

  router.put('/api/backup/settings', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const body = await readJson(req);
    sendJson(res, 200, { ok: true, settings: saveBackupSettings(body) });
  });

  router.post('/api/backup/create', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const body = await readJson(req);
    const meta = createBackup({
      folder: body.folder,
      includeFiles: body.include_files !== false,
      note: body.note || '',
      createdBy: ctx.user.id,
    });
    sendJson(res, 201, { ok: true, backup: meta });
  });

  router.post('/api/backup/restore', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const body = await readJson(req);
    if (!body.path) throw new HttpError(400, 'path_required');
    const result = restoreBackup(body.path, { restoreFiles: body.restore_files !== false });
    sendJson(res, 200, result);
  });

  router.post('/api/backup/verify', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const body = await readJson(req);
    if (!body.path) throw new HttpError(400, 'path_required');
    sendJson(res, 200, verifyBackup(body.path));
  });

  router.get('/api/backup/download', ({ res, query, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const full = resolveFolder(query.path);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new HttpError(404, 'not_found');
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': fs.statSync(full).size,
      'Content-Disposition': `attachment; filename="${path.basename(full)}"`,
    });
    fs.createReadStream(full).pipe(res);
  });

  router.post('/api/backup/upload', async ({ req, res, query, ctx }) => {
    requirePerm(ctx, 'backup.manage');
    const folder = ensureFolder(query.folder || getSetting('app', 'backup', {}).folder);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    const name = String(query.name || `uploaded-${Date.now()}.edusphere`).replace(/[^\w.\-]/g, '_');
    const full = path.join(folder, name.endsWith('.edusphere') ? name : `${name}.edusphere`);
    fs.writeFileSync(full, buf);
    sendJson(res, 200, { ok: true, path: full, size: buf.length });
  });

  /* ---------------- treasury: cashboxes, banks, transactions, settlements, opening balances ---------------- */
  function syncBankAccountBalance(bankAccountId) {
    const ba = get(`SELECT * FROM bank_accounts WHERE id = ?`, [bankAccountId]);
    if (!ba) return null;
    if (ba.account_id) {
      const acc = get(`SELECT current_balance FROM accounts WHERE id = ?`, [ba.account_id]);
      if (acc) run(`UPDATE bank_accounts SET current_balance = ? WHERE id = ?`, [round2(acc.current_balance || 0), ba.id]);
    }
    return get(`SELECT * FROM bank_accounts WHERE id = ?`, [ba.id]);
  }

  router.get('/api/treasury/summary', ({ res, ctx }) => {
    requirePerm(ctx, 'bank_accounts.read');
    const accounts = all(`SELECT ba.*, b.name_en AS branch_name_en, b.name_ar AS branch_name_ar, a.code AS gl_code, a.name_en AS gl_name_en
      FROM bank_accounts ba LEFT JOIN branches b ON b.id = ba.branch_id LEFT JOIN accounts a ON a.id = ba.account_id
      ORDER BY ba.kind, ba.branch_id, ba.id`);
    const byKind = { bank: { count: 0, total: 0 }, cashbox: { count: 0, total: 0 } };
    for (const x of accounts) { const k = x.kind || 'bank'; if(!byKind[k]) byKind[k]={count:0,total:0}; byKind[k].count++; byKind[k].total = round2(byKind[k].total + (x.current_balance||0)); }
    sendJson(res, 200, { accounts, byKind, baseCurrency: getSetting('app','finance',{}).base_currency || 'USD' });
  });

  router.post('/api/treasury/transaction', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'journal_entries.create');
    const body = await readJson(req);
    const type = String(body.type || '').toLowerCase(); // deposit(in), withdraw(out), transfer
    const amount = round2(num(body.amount));
    if (amount <= 0) throw new HttpError(400, 'invalid_amount');
    const date = body.entry_date || body.date || todayIso();
    const ref = body.reference || null;
    const noteEn = body.description_en || body.description || '';
    const noteAr = body.description_ar || '';

    const result = transaction(() => {
      if (type === 'transfer') {
        const fromId = Number(body.from_bank_account_id || body.from_id);
        const toId = Number(body.to_bank_account_id || body.to_id);
        if (!fromId || !toId || fromId === toId) throw new HttpError(400, 'invalid_transfer_accounts');
        const from = get(`SELECT * FROM bank_accounts WHERE id = ?`, [fromId]);
        const to = get(`SELECT * FROM bank_accounts WHERE id = ?`, [toId]);
        if (!from || !to) throw new HttpError(404, 'bank_account_not_found');
        if (!from.account_id || !to.account_id) throw new HttpError(400, 'bank_account_missing_gl');
        const j = postJournal({ entry_date: date, reference: ref, description_en: noteEn || `Transfer ${from.name_en} -> ${to.name_en}`, description_ar: noteAr || `تحويل ${from.name_ar||from.name_en} -> ${to.name_ar||to.name_en}`, branch_id: body.branch_id || from.branch_id, source: 'transfer', createdBy: ctx.user.id,
          lines: [
            { account_id: to.account_id, debit: amount, credit: 0, description: noteEn },
            { account_id: from.account_id, debit: 0, credit: amount, description: noteEn },
          ] });
        syncBankAccountBalance(fromId); syncBankAccountBalance(toId);
        return { ok: true, type, journal_id: j.id, entry_no: j.entry_no };
      }

      const baId = Number(body.bank_account_id || body.account_id);
      const ba = get(`SELECT * FROM bank_accounts WHERE id = ?`, [baId]);
      if (!ba) throw new HttpError(404, 'bank_account_not_found');
      if (!ba.account_id) throw new HttpError(400, 'bank_account_missing_gl');
      const contraId = Number(body.contra_account_id || body.account_id_gl || 0) || get(`SELECT id FROM accounts WHERE code = ?`, [type === 'deposit' ? '4100' : '5200'])?.id;
      if (!contraId) throw new HttpError(400, 'contra_account_required');

      let lines;
      if (type === 'deposit' || type === 'in' || type === 'receipt') {
        lines = [ { account_id: ba.account_id, debit: amount, credit: 0, description: noteEn }, { account_id: contraId, debit: 0, credit: amount, description: noteEn } ];
      } else if (type === 'withdraw' || type === 'out' || type === 'payment') {
        lines = [ { account_id: contraId, debit: amount, credit: 0, description: noteEn }, { account_id: ba.account_id, debit: 0, credit: amount, description: noteEn } ];
      } else throw new HttpError(400, 'invalid_transaction_type');

      const j = postJournal({ entry_date: date, reference: ref, description_en: noteEn || (type==='deposit'?'Cash/Bank deposit':'Cash/Bank withdrawal'), description_ar: noteAr || (type==='deposit'?'إيداع خزينة/بنك':'صرف من خزينة/بنك'), branch_id: body.branch_id || ba.branch_id, source: 'treasury', createdBy: ctx.user.id, lines });
      syncBankAccountBalance(baId);
      return { ok: true, type, journal_id: j.id, entry_no: j.entry_no, bank_account_id: baId };
    });
    sendJson(res, 200, result);
  });

  router.post('/api/treasury/settlement', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'journal_entries.create');
    const body = await readJson(req);
    const date = body.entry_date || body.date || todayIso();
    const amount = round2(num(body.amount));
    if (amount <= 0) throw new HttpError(400, 'invalid_amount');
    const direction = String(body.direction || 'increase'); // increase = add to target, decrease = reduce
    const targetType = String(body.target_type || ''); // bank_account, vendor, customer, student, account
    const noteEn = body.description_en || body.description || 'Settlement adjustment';
    const noteAr = body.description_ar || 'تسوية رصيد';

    const result = transaction(() => {
      let targetAccountId = null;
      let baId = null;
      let contraAccountId = Number(body.contra_account_id) || null;

      if (targetType === 'bank_account' || targetType === 'cashbox' || targetType === 'bank') {
        baId = Number(body.target_id || body.bank_account_id);
        const ba = get(`SELECT * FROM bank_accounts WHERE id = ?`, [baId]);
        if (!ba?.account_id) throw new HttpError(400, 'bank_account_missing_gl');
        targetAccountId = ba.account_id;
        if (!contraAccountId) contraAccountId = get(`SELECT id FROM accounts WHERE type='equity' ORDER BY code LIMIT 1`)?.id || get(`SELECT id FROM accounts WHERE code='3200'`)?.id;
      } else if (targetType === 'vendor') {
        const v = get(`SELECT * FROM vendors WHERE id = ?`, [body.target_id]);
        if (!v) throw new HttpError(404, 'not_found');
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='2110'`)?.id; // AP
        if (!contraAccountId) contraAccountId = get(`SELECT id FROM accounts WHERE code='5200'`)?.id;
        const delta = direction === 'increase' ? amount : -amount;
        run(`UPDATE vendors SET balance = ROUND(COALESCE(balance,0) + ?, 2) WHERE id = ?`, [delta, v.id]);
      } else if (targetType === 'customer') {
        const c = get(`SELECT * FROM customers WHERE id = ?`, [body.target_id]);
        if (!c) throw new HttpError(404, 'not_found');
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='1130'`)?.id; // AR
        if (!contraAccountId) contraAccountId = get(`SELECT id FROM accounts WHERE code='4100'`)?.id;
        const delta = direction === 'increase' ? amount : -amount;
        run(`UPDATE customers SET balance = ROUND(COALESCE(balance,0) + ?, 2) WHERE id = ?`, [delta, c.id]);
      } else if (targetType === 'student') {
        // adjust via AR (student receivable context) - record as customer-like adjustment note; student has no balance column but invoices do
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='1130'`)?.id;
        if (!contraAccountId) contraAccountId = get(`SELECT id FROM accounts WHERE code='4100'`)?.id;
      } else if (targetType === 'account') {
        targetAccountId = Number(body.target_id || body.account_id_target);
      } else {
        throw new HttpError(400, 'invalid_target_type');
      }

      if (!targetAccountId || !contraAccountId) throw new HttpError(400, 'accounts_required');
      // direction increase: debit target / credit contra (asset-like increase). decrease: opposite.
      let lines;
      if (direction === 'decrease') {
        lines = [ { account_id: contraAccountId, debit: amount, credit: 0 }, { account_id: targetAccountId, debit: 0, credit: amount } ];
      } else {
        lines = [ { account_id: targetAccountId, debit: amount, credit: 0 }, { account_id: contraAccountId, debit: 0, credit: amount } ];
      }
      const j = postJournal({ entry_date: date, reference: body.reference || null, description_en: noteEn, description_ar: noteAr, branch_id: body.branch_id || null, source: 'settlement', createdBy: ctx.user.id, lines });
      if (baId) syncBankAccountBalance(baId);
      return { ok: true, journal_id: j.id, entry_no: j.entry_no };
    });
    sendJson(res, 200, result);
  });

  router.post('/api/treasury/opening-balance', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'journal_entries.create');
    const body = await readJson(req);
    const date = body.entry_date || body.date || todayIso();
    const amount = round2(num(body.amount));
    if (amount <= 0) throw new HttpError(400, 'invalid_amount');
    const targetType = String(body.target_type || 'account'); // bank_account, account, vendor, customer, student
    const nature = String(body.nature || 'debit'); // debit-balance or credit-balance for opening
    const noteEn = body.description_en || body.description || 'Opening balance';
    const noteAr = body.description_ar || 'رصيد افتتاحي';
    const equityId = Number(body.contra_account_id) || get(`SELECT id FROM accounts WHERE code='3100' OR (type='equity' AND subtype='capital') ORDER BY code LIMIT 1`)?.id || get(`SELECT id FROM accounts WHERE type='equity' ORDER BY code LIMIT 1`)?.id;
    if (!equityId) throw new HttpError(400, 'equity_account_required');

    const result = transaction(() => {
      let targetAccountId = null;
      let baId = null;
      if (targetType === 'bank_account' || targetType === 'cashbox' || targetType === 'bank') {
        baId = Number(body.target_id || body.bank_account_id);
        const ba = get(`SELECT * FROM bank_accounts WHERE id = ?`, [baId]);
        if (!ba?.account_id) throw new HttpError(400, 'bank_account_missing_gl');
        targetAccountId = ba.account_id;
        run(`UPDATE bank_accounts SET opening_balance = ? WHERE id = ?`, [amount, ba.id]);
      } else if (targetType === 'vendor') {
        const v = get(`SELECT * FROM vendors WHERE id = ?`, [body.target_id]);
        if (!v) throw new HttpError(404, 'not_found');
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='2110'`)?.id;
        run(`UPDATE vendors SET balance = ? WHERE id = ?`, [amount, v.id]);
      } else if (targetType === 'customer') {
        const c = get(`SELECT * FROM customers WHERE id = ?`, [body.target_id]);
        if (!c) throw new HttpError(404, 'not_found');
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='1130'`)?.id;
        run(`UPDATE customers SET balance = ? WHERE id = ?`, [amount, c.id]);
      } else if (targetType === 'student') {
        targetAccountId = Number(body.account_id) || get(`SELECT id FROM accounts WHERE code='1130'`)?.id;
      } else {
        targetAccountId = Number(body.target_id || body.account_id);
      }
      if (!targetAccountId) throw new HttpError(400, 'target_account_required');

      const lines = (nature === 'credit')
        ? [ { account_id: equityId, debit: amount, credit: 0 }, { account_id: targetAccountId, debit: 0, credit: amount } ]
        : [ { account_id: targetAccountId, debit: amount, credit: 0 }, { account_id: equityId, debit: 0, credit: amount } ];
      const j = postJournal({ entry_date: date, reference: body.reference || 'OPENING', description_en: noteEn, description_ar: noteAr, branch_id: body.branch_id || null, source: 'opening', createdBy: ctx.user.id, lines });
      if (baId) syncBankAccountBalance(baId);
      return { ok: true, journal_id: j.id, entry_no: j.entry_no };
    });
    sendJson(res, 200, result);
  });

}
