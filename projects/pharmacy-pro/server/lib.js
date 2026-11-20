'use strict';
/**
 * PharmaPro – Business logic (inventory, sales, purchases, returns, shifts, accounting)
 */
const db = require('./db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n, d = 0) => (n === undefined || n === null || n === '' ? d : Number(n));

function today() { return db.nowStamp().slice(0, 10); }
function now() { return db.nowStamp(); }

/* ---------------------------------- numbering --------------------------------- */
function nextNo(prefix, table, column, dateStr) {
  const ym = (dateStr || today()).slice(0, 7).replace('-', '');
  const like = `${prefix}-${ym}-%`;
  const row = db.get(`SELECT ${column} AS no FROM ${table} WHERE ${column} LIKE ? ORDER BY id DESC LIMIT 1`, like);
  let seq = 1;
  if (row && row.no) seq = (parseInt(String(row.no).split('-').pop(), 10) || 0) + 1;
  return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
}

/* ---------------------------------- accounting -------------------------------- */
function accountId(code) {
  const row = db.get('SELECT id FROM accounts WHERE code = ?', String(code));
  if (!row) throw new AppError(`الحساب المحاسبي ${code} غير موجود`, 500);
  return row.id;
}

/**
 * Post a balanced journal entry.
 * lines: [{ account: '1010' | id, debit, credit, description }]
 */
function postJournal({ date, description, refType = null, refId = null, userId = null, lines }) {
  const clean = lines
    .map((l) => ({
      account_id: typeof l.account === 'number' ? l.account : accountId(l.account),
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
      description: l.description || description || ''
    }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  if (!clean.length) return null;
  const debit = round2(clean.reduce((s, l) => s + l.debit, 0));
  const credit = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debit - credit) > 0.009) {
    throw new AppError(`قيد غير متوازن: مدين ${debit} / دائن ${credit}`, 500);
  }
  const entryNo = nextNo('JV', 'journal_entries', 'entry_no', date || today());
  const entry = db.run(
    `INSERT INTO journal_entries(entry_no,date,description,ref_type,ref_id,user_id)
     VALUES(?,?,?,?,?,?)`,
    entryNo, date || now(), description || 'قيد يومية', refType, refId, userId
  );
  const entryId = Number(entry.lastInsertRowid);
  const stmt = db.getDB().prepare(
    'INSERT INTO journal_lines(entry_id,account_id,debit,credit,description) VALUES(?,?,?,?,?)'
  );
  for (const l of clean) stmt.run(entryId, l.account_id, l.debit, l.credit, l.description);
  return entryId;
}

function cashAccount(method) {
  if (method === 'cash') return '1010';
  if (method === 'credit') return '1030';
  return '1020'; // card / wallet / bank
}

function deleteJournalFor(refType, refId) {
  const entries = db.all('SELECT id FROM journal_entries WHERE ref_type = ? AND ref_id = ?', refType, refId);
  for (const e of entries) db.run('DELETE FROM journal_entries WHERE id = ?', e.id);
}

/* ---------------------------------- inventory --------------------------------- */
function allocateStock(productId, qty, { allowExpired = false } = {}) {
  qty = num(qty);
  if (qty <= 0) throw new AppError('الكمية يجب أن تكون أكبر من صفر');
  const conditions = allowExpired ? '' : " AND (expiry_date IS NULL OR expiry_date >= date('now','localtime'))";
  const batches = db.all(
    `SELECT * FROM batches WHERE product_id = ? AND qty > 0${conditions}
     ORDER BY (expiry_date IS NULL) ASC, expiry_date ASC, id ASC`,
    productId
  );
  let remaining = qty;
  const allocations = [];
  for (const b of batches) {
    if (remaining <= 0.00001) break;
    const take = Math.min(remaining, Number(b.qty));
    if (take <= 0) continue;
    allocations.push({ batch: b, qty: take, cost: Number(b.cost) || 0 });
    remaining = round2(remaining - take);
  }
  if (remaining > 0.00001) {
    const p = db.get('SELECT name FROM products WHERE id = ?', productId);
    throw new AppError(`الكمية غير كافية في المخزون للصنف «${p ? p.name : productId}» (المتاح: ${round2(qty - remaining)})`);
  }
  return allocations;
}

function deductAllocation(allocation, refType, refId, userId) {
  const remainingQty = round2(Number(allocation.batch.qty) - allocation.qty);
  db.run('UPDATE batches SET qty = ? WHERE id = ?', remainingQty, allocation.batch.id);
  db.run(
    `INSERT INTO stock_movements(product_id,batch_id,type,qty,unit_cost,ref_type,ref_id,user_id,note)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    allocation.batch.product_id, allocation.batch.id, 'out', -allocation.qty, allocation.cost,
    refType, refId, userId, 'صرف من المخزون'
  );
}

function addStock({ productId, qty, cost = 0, batchNo, expiryDate, supplierId = null, purchaseId = null,
  refType = 'adjust', refId = null, userId = null, note = 'إضافة للمخزون' }) {
  qty = num(qty);
  if (qty <= 0) throw new AppError('الكمية يجب أن تكون أكبر من صفر');
  let batch = null;
  if (batchNo) {
    batch = db.get(
      `SELECT * FROM batches WHERE product_id = ? AND COALESCE(batch_no,'') = ? AND COALESCE(expiry_date,'') = ?`,
      productId, String(batchNo), expiryDate || ''
    );
  }
  if (batch) {
    db.run('UPDATE batches SET qty = qty + ?, cost = ? WHERE id = ?', qty, num(cost, batch.cost), batch.id);
  } else {
    const r = db.run(
      `INSERT INTO batches(product_id,batch_no,expiry_date,qty,cost,supplier_id,purchase_id)
       VALUES(?,?,?,?,?,?,?)`,
      productId, batchNo || null, expiryDate || null, qty, num(cost), supplierId, purchaseId
    );
    batch = { id: Number(r.lastInsertRowid), product_id: productId, qty };
  }
  db.run(
    `INSERT INTO stock_movements(product_id,batch_id,type,qty,unit_cost,ref_type,ref_id,user_id,note)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    productId, batch.id, 'in', qty, num(cost), refType, refId, userId, note
  );
  return batch;
}

/* ----------------------------------- sales ----------------------------------- */
function createSale(payload) {
  const {
    items = [], customer_id = null, discount = 0, payment_method = 'cash', paid,
    notes = null, user_id = null, shift_id = null, prescription_id = null, date = now()
  } = payload;
  if (!Array.isArray(items) || !items.length) throw new AppError('لا يمكن إتمام بيع بدون أصناف');

  return db.tx(() => {
    let shift = shift_id ? db.get('SELECT * FROM shifts WHERE id = ?', shift_id) : null;
    if (!shift && user_id) {
      shift = db.get("SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", user_id);
      if (!shift) throw new AppError('يجب فتح وردية أولاً قبل تسجيل المبيعات');
    }

    const products = new Map();
    let subtotal = 0;
    const prepared = items.map((it) => {
      const p = db.get('SELECT * FROM products WHERE id = ?', it.product_id);
      if (!p) throw new AppError('صنف غير موجود');
      if (!products.has(p.id)) products.set(p.id, p);
      const qty = num(it.qty);
      if (qty <= 0) throw new AppError(`كمية غير صالحة للصنف ${p.name}`);
      const price = round2(num(it.price, p.price));
      const lineTotal = round2(price * qty);
      subtotal = round2(subtotal + lineTotal);
      return { product: p, qty, price, lineTotal, discount: round2(num(it.discount)) };
    });

    const invDiscount = Math.min(round2(num(discount)), subtotal);
    let taxTotal = 0;
    let total = 0;
    const lines = [];
    for (const line of prepared) {
      const share = subtotal > 0 ? line.lineTotal / subtotal : 0;
      const lineDiscount = round2(line.discount + invDiscount * share);
      const net = round2(line.lineTotal - lineDiscount);
      const tax = round2(net * (Number(line.product.tax_rate) || 0) / 100);
      taxTotal = round2(taxTotal + tax);
      total = round2(total + net + tax);
      lines.push({ ...line, lineDiscount, net, tax });
    }
    const grandTotal = round2(total);
    const paidAmount = paid === undefined || paid === null || paid === '' ? grandTotal : round2(num(paid));
    const change = Math.max(0, round2(paidAmount - grandTotal));

    const invoiceNo = nextNo('INV', 'sales', 'invoice_no', date);
    const saleRes = db.run(
      `INSERT INTO sales(invoice_no,customer_id,shift_id,user_id,date,subtotal,discount,tax,total,paid,change_due,payment_method,status,prescription_id,notes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      invoiceNo, customer_id || null, shift ? shift.id : null, user_id, date, subtotal, invDiscount, taxTotal,
      grandTotal, paidAmount, change, payment_method, 'completed', prescription_id || null, notes
    );
    const saleId = Number(saleRes.lastInsertRowid);

    let costTotal = 0;
    const itemStmt = db.getDB().prepare(
      `INSERT INTO sale_items(sale_id,product_id,batch_id,batch_no,name,qty,price,cost,discount,tax,total)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    );

    for (const line of lines) {
      const allocations = allocateStock(line.product.id, line.qty);
      for (const alloc of allocations) {
        const proportion = line.qty > 0 ? alloc.qty / line.qty : 0;
        const itemDiscount = round2(line.lineDiscount * proportion);
        const itemTax = round2(line.tax * proportion);
        const itemTotal = round2(line.net * proportion + itemTax);
        const cost = round2(alloc.cost * alloc.qty);
        costTotal = round2(costTotal + cost);
        itemStmt.run(
          saleId, line.product.id, alloc.batch.id, alloc.batch.batch_no || '', line.product.name,
          alloc.qty, line.price, alloc.cost, itemDiscount, itemTax, itemTotal
        );
        deductAllocation(alloc, 'sale', saleId, user_id);
      }
      // update product price if overridden? keep master price untouched
    }

    // Journal entry
    const cashLine = payment_method === 'credit'
      ? { account: '1030', debit: grandTotal }
      : { account: cashAccount(payment_method), debit: grandTotal };
    postJournal({
      date, description: `فاتورة بيع ${invoiceNo}`, refType: 'sale', refId: saleId, userId: user_id,
      lines: [
        cashLine,
        { account: '4010', credit: round2(subtotal - invDiscount), description: 'إيرادات مبيعات' },
        { account: '2020', credit: taxTotal, description: 'ضريبة قيمة مضافة مستحقة' },
        { account: '5010', debit: costTotal, description: 'تكلفة المبيعات' },
        { account: '1040', credit: costTotal, description: 'صرف مخزون' }
      ]
    });

    if (customer_id) {
      const points = Math.floor(grandTotal / Math.max(1, num(db.get("SELECT value FROM settings WHERE key='loyalty_per_point'")?.value, 10)));
      if (points > 0) db.run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', points, customer_id);
    }
    if (prescription_id) {
      db.run("UPDATE prescriptions SET status='dispensed' WHERE id = ?", prescription_id);
      db.run('UPDATE prescription_items SET dispensed=1 WHERE prescription_id = ?', prescription_id);
    }

    return getSale(saleId);
  });
}

function getSale(id) {
  const sale = db.get(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, u.full_name AS cashier_name,
            sh.opened_at AS shift_opened
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     LEFT JOIN users u ON u.id = s.user_id LEFT JOIN shifts sh ON sh.id = s.shift_id
     WHERE s.id = ?`, id
  );
  if (!sale) throw new AppError('الفاتورة غير موجودة', 404);
  sale.items = db.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', id);
  const returned = db.all(
    `SELECT ri.product_id, COALESCE(SUM(ri.qty),0) AS qty FROM return_items ri
     JOIN returns r ON r.id = ri.return_id WHERE r.type='sale' AND r.ref_id = ? GROUP BY ri.product_id`, id
  );
  const retMap = new Map(returned.map((r) => [r.product_id, Number(r.qty)]));
  sale.items.forEach((it) => { it.returned_qty = retMap.get(it.product_id) || 0; });
  sale.returns = db.all(
    `SELECT id, return_no, date, total, refund_method, reason FROM returns
     WHERE type='sale' AND ref_id = ? ORDER BY id DESC`, id
  );
  return sale;
}

function createSaleReturn({ sale_id, items = [], refund_method = 'cash', reason = '', user_id = null }) {
  return db.tx(() => {
    const sale = getSale(sale_id);
    if (sale.status === 'void') throw new AppError('لا يمكن إرجاع فاتورة ملغاة');
    if (!items.length) throw new AppError('حدد الأصناف المرتجعة');

    // already returned qty per product
    const prevRows = db.all(
      `SELECT ri.product_id, SUM(ri.qty) AS qty FROM return_items ri
       JOIN returns r ON r.id = ri.return_id
       WHERE r.type = 'sale' AND r.ref_id = ? GROUP BY ri.product_id`, sale_id
    );
    const prev = new Map(prevRows.map((r) => [r.product_id, Number(r.qty)]));

    const sold = new Map();
    for (const s of sale.items) sold.set(s.product_id, (sold.get(s.product_id) || 0) + Number(s.qty));

    let total = 0;
    const prepared = [];
    for (const it of items) {
      const productId = Number(it.product_id);
      const qty = num(it.qty);
      if (qty <= 0) continue;
      const soldQty = sold.get(productId) || 0;
      const returnedQty = prev.get(productId) || 0;
      if (qty > soldQty - returnedQty + 0.0001) {
        throw new AppError('الكمية المرتجعة أكبر من الكمية المتاحة للإرجاع');
      }
      const saleItem = sale.items.find((s) => s.product_id === productId);
      const price = round2(num(it.price, saleItem.price));
      const share = saleItem.qty > 0 ? qty / saleItem.qty : 0;
      const tax = round2(Number(saleItem.tax || 0) * share);
      const lineTotal = round2(price * qty + tax);
      total = round2(total + lineTotal);
      prepared.push({ productId, qty, price, lineTotal, tax, saleItem });
    }
    if (!prepared.length) throw new AppError('لا توجد كميات صالحة للإرجاع');

    const returnNo = nextNo('RET', 'returns', 'return_no', today());
    const currentShift = user_id ? db.get("SELECT id FROM shifts WHERE user_id=? AND status='open' ORDER BY id DESC LIMIT 1", user_id) : null;
    const r = db.run(
      `INSERT INTO returns(return_no,type,ref_id,customer_id,shift_id,date,total,refund_method,reason,user_id)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      returnNo, 'sale', sale_id, sale.customer_id, currentShift ? currentShift.id : null, now(), total, refund_method, reason, user_id
    );
    const returnId = Number(r.lastInsertRowid);

    let costTotal = 0;
    let taxTotal = 0;
    for (const line of prepared) {
      const si = line.saleItem;
      const share = si.qty > 0 ? line.qty / si.qty : 0;
      const cost = round2(si.cost * line.qty);
      const tax = round2(si.tax * share);
      taxTotal = round2(taxTotal + tax);
      costTotal = round2(costTotal + cost);
      db.run(
        'INSERT INTO return_items(return_id,product_id,batch_id,qty,price,total) VALUES(?,?,?,?,?,?)',
        returnId, line.productId, si.batch_id, line.qty, line.price, line.lineTotal
      );
      // restock
      if (si.batch_id) {
        const batch = db.get('SELECT * FROM batches WHERE id = ?', si.batch_id);
        if (batch) {
          db.run('UPDATE batches SET qty = qty + ? WHERE id = ?', line.qty, batch.id);
          db.run(
            `INSERT INTO stock_movements(product_id,batch_id,type,qty,unit_cost,ref_type,ref_id,user_id,note)
             VALUES(?,?,?,?,?,?,?,?,?)`,
            line.productId, batch.id, 'in', line.qty, si.cost, 'sale_return', returnId, user_id, 'مرتجع بيع'
          );
        }
      }
    }

    const net = round2(total - taxTotal);
    postJournal({
      date: now(), description: `مرتجع بيع ${returnNo} – فاتورة ${sale.invoice_no}`, refType: 'sale_return',
      refId: returnId, userId: user_id,
      lines: [
        { account: '4030', debit: net, description: 'مردودات مبيعات' },
        { account: '2020', debit: taxTotal, description: 'عكس ضريبة المبيعات' },
        { account: cashAccount(refund_method), credit: total, description: 'رد مبلغ للعميل' },
        { account: '1040', debit: costTotal, description: 'إعادة مخزون' },
        { account: '5010', credit: costTotal, description: 'عكس تكلفة مبيعات' }
      ]
    });

    // update sale status
    const totalReturned = db.get(
      `SELECT COALESCE(SUM(ri.qty),0) AS qty FROM return_items ri JOIN returns r ON r.id = ri.return_id
       WHERE r.type='sale' AND r.ref_id = ?`, sale_id
    ).qty;
    const totalSold = db.get('SELECT COALESCE(SUM(qty),0) AS qty FROM sale_items WHERE sale_id = ?', sale_id).qty;
    if (totalReturned >= totalSold - 0.0001) db.run("UPDATE sales SET status='returned' WHERE id = ?", sale_id);
    else db.run("UPDATE sales SET status='partially_returned' WHERE id = ?", sale_id);

    return db.get('SELECT * FROM returns WHERE id = ?', returnId);
  });
}

function voidSale(id, userId) {
  return db.tx(() => {
    const sale = getSale(id);
    if (sale.status === 'void') throw new AppError('الفاتورة ملغاة بالفعل');
    if (sale.status === 'returned') throw new AppError('لا يمكن إلغاء فاتورة مرتجعة بالكامل');
    // restock everything
    for (const item of sale.items) {
      if (item.batch_id) {
        db.run('UPDATE batches SET qty = qty + ? WHERE id = ?', item.qty, item.batch_id);
        db.run(
          `INSERT INTO stock_movements(product_id,batch_id,type,qty,unit_cost,ref_type,ref_id,user_id,note)
           VALUES(?,?,?,?,?,?,?,?,?)`,
          item.product_id, item.batch_id, 'in', item.qty, item.cost, 'sale_void', id, userId, 'إلغاء فاتورة'
        );
      }
    }
    deleteJournalFor('sale', id);
    db.run("UPDATE sales SET status='void' WHERE id = ?", id);
    if (sale.customer_id) {
      const points = Math.floor(Number(sale.total) / 10);
      db.run('UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?', points, sale.customer_id);
    }
    return { ok: true };
  });
}

/* --------------------------------- purchases --------------------------------- */
function createPurchase(payload) {
  const {
    supplier_id = null, items = [], discount = 0, paid = 0, notes = '', user_id = null,
    date = now(), invoice_ref = null, tax = 0
  } = payload;
  if (!items.length) throw new AppError('أضف أصنافاً إلى فاتورة الشراء');
  return db.tx(() => {
    let subtotal = 0;
    const prepared = items.map((it) => {
      const p = db.get('SELECT * FROM products WHERE id = ?', it.product_id);
      if (!p) throw new AppError('صنف غير موجود');
      const qty = num(it.qty);
      const cost = round2(num(it.cost, p.cost));
      if (qty <= 0) throw new AppError(`كمية غير صالحة للصنف ${p.name}`);
      const lineTotal = round2(qty * cost);
      subtotal = round2(subtotal + lineTotal);
      return { product: p, qty, cost, lineTotal, batch_no: it.batch_no || '', expiry_date: it.expiry_date || null };
    });
    const disc = Math.min(round2(num(discount)), subtotal);
    const taxAmount = round2(num(tax));
    const total = round2(subtotal - disc + taxAmount);
    const paidAmount = Math.min(round2(num(paid)), total);
    const invoiceNo = nextNo('PUR', 'purchases', 'invoice_no', date);

    const r = db.run(
      `INSERT INTO purchases(invoice_no,supplier_id,date,subtotal,discount,tax,total,paid,status,user_id,notes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      invoiceNo, supplier_id, date, subtotal, disc, taxAmount, total, paidAmount, 'received', user_id,
      invoice_ref ? `مرجع المورد: ${invoice_ref}${notes ? ' – ' + notes : ''}` : notes
    );
    const purchaseId = Number(r.lastInsertRowid);

    for (const line of prepared) {
      const batch = addStock({
        productId: line.product.id, qty: line.qty, cost: line.cost, batchNo: line.batch_no,
        expiryDate: line.expiry_date, supplierId: supplier_id, purchaseId,
        refType: 'purchase', refId: purchaseId, userId: user_id, note: 'توريد'
      });
      db.run(
        `INSERT INTO purchase_items(purchase_id,product_id,batch_id,batch_no,expiry_date,qty,cost,total)
         VALUES(?,?,?,?,?,?,?,?)`,
        purchaseId, line.product.id, batch.id, line.batch_no, line.expiry_date, line.qty, line.cost, line.lineTotal
      );
      db.run('UPDATE products SET cost = ?, updated_at = ? WHERE id = ?', line.cost, now(), line.product.id);
    }

    postJournal({
      date, description: `فاتورة شراء ${invoiceNo}`, refType: 'purchase', refId: purchaseId, userId: user_id,
      lines: [
        { account: '1040', debit: round2(subtotal - disc), description: 'إضافة مخزون' },
        { account: '2020', debit: taxAmount, description: 'ضريبة مشتريات (مدخلات)' },
        { account: cashAccount('cash'), credit: paidAmount, description: 'دفعة نقدية للمورد' },
        { account: '2010', credit: round2(total - paidAmount), description: 'مستحق للمورد' }
      ]
    });

    return getPurchase(purchaseId);
  });
}

function getPurchase(id) {
  const purchase = db.get(
    `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, u.full_name AS user_name
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`, id
  );
  if (!purchase) throw new AppError('فاتورة الشراء غير موجودة', 404);
  purchase.items = db.all(
    `SELECT pi.*, pr.name, pr.unit FROM purchase_items pi JOIN products pr ON pr.id = pi.product_id
     WHERE pi.purchase_id = ? ORDER BY pi.id`, id
  );
  const returned = db.all(
    `SELECT ri.product_id, COALESCE(SUM(ri.qty),0) AS qty FROM return_items ri
     JOIN returns r ON r.id = ri.return_id WHERE r.type='purchase' AND r.ref_id = ? GROUP BY ri.product_id`, id
  );
  const retMap = new Map(returned.map((r) => [r.product_id, Number(r.qty)]));
  purchase.items.forEach((it) => { it.returned_qty = retMap.get(it.product_id) || 0; });
  purchase.returns = db.all(
    `SELECT id, return_no, date, total, refund_method, reason FROM returns
     WHERE type='purchase' AND ref_id = ? ORDER BY id DESC`, id
  );
  return purchase;
}

function payPurchase(id, amount, userId) {
  return db.tx(() => {
    const purchase = db.get('SELECT * FROM purchases WHERE id = ?', id);
    if (!purchase) throw new AppError('الفاتورة غير موجودة', 404);
    const remaining = round2(purchase.total - purchase.paid);
    const pay = Math.min(round2(num(amount)), remaining);
    if (pay <= 0) throw new AppError('لا يوجد مبلغ مستحق');
    db.run('UPDATE purchases SET paid = paid + ? WHERE id = ?', pay, id);
    postJournal({
      date: now(), description: `سداد دفعة لمورد – ${purchase.invoice_no}`, refType: 'purchase_payment',
      refId: id, userId,
      lines: [
        { account: '2010', debit: pay, description: 'سداد مستحق مورد' },
        { account: '1010', credit: pay, description: 'نقدية الصندوق' }
      ]
    });
    return getPurchase(id);
  });
}

function createPurchaseReturn({ purchase_id, items = [], refund_method = 'credit', reason = '', user_id = null }) {
  return db.tx(() => {
    const purchase = getPurchase(purchase_id);
    if (!items.length) throw new AppError('حدد الأصناف المرتجعة');
    let total = 0;
    const prepared = [];
    for (const it of items) {
      const qty = num(it.qty);
      if (qty <= 0) continue;
      const pi = purchase.items.find((x) => x.product_id === Number(it.product_id));
      if (!pi) throw new AppError('الصنف ليس ضمن الفاتورة');
      const already = db.get(
        `SELECT COALESCE(SUM(ri.qty),0) AS qty FROM return_items ri JOIN returns r ON r.id = ri.return_id
         WHERE r.type='purchase' AND r.ref_id = ? AND ri.product_id = ?`, purchase_id, pi.product_id
      ).qty;
      if (qty > Number(pi.qty) - Number(already) + 0.0001) throw new AppError('الكمية المرتجعة أكبر من المتاح');
      const batch = db.get('SELECT * FROM batches WHERE id = ?', pi.batch_id);
      if (!batch || Number(batch.qty) < qty - 0.0001) throw new AppError(`لا يوجد رصيد كافٍ من «${pi.name}» في الدفعة لإرجاعها للمورد`);
      const price = round2(Number(pi.cost));
      const lineTotal = round2(price * qty);
      total = round2(total + lineTotal);
      prepared.push({ pi, batch, qty, price, lineTotal });
    }
    if (!prepared.length) throw new AppError('لا توجد كميات صالحة');
    const returnNo = nextNo('RET', 'returns', 'return_no', today());
    const r = db.run(
      `INSERT INTO returns(return_no,type,ref_id,supplier_id,date,total,refund_method,reason,user_id)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      returnNo, 'purchase', purchase_id, purchase.supplier_id, now(), total, refund_method, reason, user_id
    );
    const returnId = Number(r.lastInsertRowid);
    for (const line of prepared) {
      db.run('UPDATE batches SET qty = qty - ? WHERE id = ?', line.qty, line.batch.id);
      db.run(
        `INSERT INTO stock_movements(product_id,batch_id,type,qty,unit_cost,ref_type,ref_id,user_id,note)
         VALUES(?,?,?,?,?,?,?,?,?)`,
        line.pi.product_id, line.batch.id, 'out', -line.qty, line.price, 'purchase_return', returnId, user_id, 'مرتجع مورد'
      );
      db.run(
        'INSERT INTO return_items(return_id,product_id,batch_id,qty,price,total) VALUES(?,?,?,?,?,?)',
        returnId, line.pi.product_id, line.batch.id, line.qty, line.price, line.lineTotal
      );
    }
    postJournal({
      date: now(), description: `مرتجع مشتريات ${returnNo}`, refType: 'purchase_return', refId: returnId, userId: user_id,
      lines: refund_method === 'cash'
        ? [
            { account: '1010', debit: total, description: 'استرداد نقدي من مورد' },
            { account: '1040', credit: total, description: 'إخراج مخزون' }
          ]
        : [
            { account: '2010', debit: total, description: 'خصم من مستحق المورد' },
            { account: '1040', credit: total, description: 'إخراج مخزون' }
          ]
    });
    return db.get('SELECT * FROM returns WHERE id = ?', returnId);
  });
}

/* ----------------------------------- shifts ---------------------------------- */
function currentShift(userId) {
  return db.get(
    `SELECT s.*, u.full_name AS user_name FROM shifts s JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ? AND s.status = 'open' ORDER BY s.id DESC LIMIT 1`, userId
  ) || null;
}

function openShift(userId, openingCash = 0) {
  return db.tx(() => {
    const existing = currentShift(userId);
    if (existing) throw new AppError('لديك وردية مفتوحة بالفعل. أغلقها أولاً.');
    const r = db.run(
      'INSERT INTO shifts(user_id,opened_at,opening_cash,status) VALUES(?,?,?,?)',
      userId, now(), round2(openingCash), 'open'
    );
    return db.get('SELECT * FROM shifts WHERE id = ?', Number(r.lastInsertRowid));
  });
}

function shiftTotals(shiftId) {
  const sales = db.get(
    `SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total,
            COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash_sales,
            COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) AS card_sales,
            COALESCE(SUM(CASE WHEN payment_method='wallet' THEN total ELSE 0 END),0) AS wallet_sales,
            COALESCE(SUM(CASE WHEN payment_method='credit' THEN total ELSE 0 END),0) AS credit_sales,
            COALESCE(SUM(discount),0) AS discounts, COALESCE(SUM(tax),0) AS tax
     FROM sales WHERE shift_id = ? AND status NOT IN ('void')`, shiftId
  );
  const returnsRow = db.get(
    `SELECT COALESCE(SUM(total),0) AS total FROM returns
     WHERE type='sale' AND shift_id = ?`, shiftId
  );
  const cash = db.get(
    `SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END),0) AS net
     FROM cash_movements WHERE shift_id = ?`, shiftId
  );
  const cost = db.get(
    `SELECT COALESCE(SUM(si.cost * si.qty),0) AS cost FROM sale_items si
     JOIN sales s ON s.id = si.sale_id WHERE s.shift_id = ? AND s.status NOT IN ('void')`, shiftId
  );
  return {
    ...sales,
    returns: returnsRow.total,
    cash_net: cash.net,
    cost: cost.cost,
    gross_profit: round2(Number(sales.total) - Number(sales.tax) - Number(cost.cost) - Number(returnsRow.total))
  };
}

function shiftReport(shiftId) {
  const shift = db.get(
    `SELECT s.*, u.full_name AS user_name FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, shiftId
  );
  if (!shift) throw new AppError('الوردية غير موجودة', 404);
  const totals = shiftTotals(shiftId);
  const expected = round2(Number(shift.opening_cash) + Number(totals.cash_sales) - Number(totals.returns) + Number(totals.cash_net));
  const sales = db.all(
    `SELECT s.id,s.invoice_no,s.date,s.total,s.payment_method,s.status,c.name AS customer_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.shift_id = ? ORDER BY s.id DESC`, shiftId
  );
  const movements = db.all('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC', shiftId);
  return { shift, totals, expected_cash: expected, sales, movements };
}

function closeShift(shiftId, closingCash, notes, userId) {
  return db.tx(() => {
    const report = shiftReport(shiftId);
    if (report.shift.status === 'closed') throw new AppError('الوردية مغلقة بالفعل');
    const closing = round2(closingCash);
    const diff = round2(closing - report.expected_cash);
    db.run(
      `UPDATE shifts SET closed_at=?, closing_cash=?, expected_cash=?, difference=?, status='closed', notes=? WHERE id=?`,
      now(), closing, report.expected_cash, diff, notes || '', shiftId
    );
    return shiftReport(shiftId);
  });
}

/* --------------------------------- expenses ---------------------------------- */
function createExpense({ date = today(), account_id, amount, payment_method = 'cash', description = '', user_id = null }) {
  return db.tx(() => {
    const amt = round2(num(amount));
    if (amt <= 0) throw new AppError('المبلغ غير صالح');
    const acc = db.get('SELECT * FROM accounts WHERE id = ?', account_id);
    if (!acc) throw new AppError('حساب المصروف غير موجود');
    const r = db.run(
      `INSERT INTO expenses(date,account_id,amount,payment_method,description,user_id) VALUES(?,?,?,?,?,?)`,
      date, account_id, amt, payment_method, description, user_id
    );
    const id = Number(r.lastInsertRowid);
    postJournal({
      date, description: `مصروف – ${acc.name}${description ? ' – ' + description : ''}`, refType: 'expense', refId: id, userId: user_id,
      lines: [
        { account: account_id, debit: amt, description: description || acc.name },
        { account: cashAccount(payment_method), credit: amt, description: 'دفع مصروف' }
      ]
    });
    return db.get('SELECT * FROM expenses WHERE id = ?', id);
  });
}

module.exports = {
  AppError, round2, num, today, now,
  nextNo, postJournal, accountId, cashAccount, deleteJournalFor,
  allocateStock, deductAllocation, addStock,
  createSale, getSale, createSaleReturn, voidSale,
  createPurchase, getPurchase, payPurchase, createPurchaseReturn,
  currentShift, openShift, shiftTotals, shiftReport, closeShift,
  createExpense
};
