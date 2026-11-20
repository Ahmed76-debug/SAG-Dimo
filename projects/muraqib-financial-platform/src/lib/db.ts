import type {
  AccountNature, AccountType, ApprovalStatus, CompanyActivity, CompanySize,
  CurrencyCode, LegalForm, UserRole,
} from '@/types'
import { api, getToken, ApiError } from './api'
import { notifyDbChange } from './liveQuery'

export interface OfficeProfile {
  id?: number
  nameAr: string
  nameEn: string
  ownerNameAr: string
  ownerNameEn: string
  titleAr: string
  titleEn: string
  email?: string
  phone?: string
  addressAr?: string
  addressEn?: string
  website?: string
  logoDataUrl?: string
  updatedAt: string
}

export interface Company {
  id?: number
  code: string
  nameAr: string
  nameEn: string
  legalForm: LegalForm
  size: CompanySize
  activity: CompanyActivity
  activityDetailsAr?: string
  activityDetailsEn?: string
  taxId?: string
  registrationNo?: string
  phone?: string
  email?: string
  addressAr?: string
  addressEn?: string
  baseCurrency: CurrencyCode
  fiscalYearStart: string
  fiscalYearEnd?: string
  status: 'active' | 'archived' | 'suspended'
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Account {
  id?: number
  companyId: number
  code: string
  nameAr: string
  nameEn: string
  parentCode?: string
  type: AccountType
  section?: string
  level: number
  nature: AccountNature
  isActive: boolean
  isSystem: boolean
  allowPosting: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TrialBalanceImport {
  id?: number
  companyId: number
  fiscalYear: string
  periodStart: string
  periodEnd: string
  status: ApprovalStatus
  source: 'excel_import' | 'direct_entry' | 'cfo_portal' | 'generated_template' | 'archive_restore'
  submittedBy?: number
  submittedByName?: string
  reviewedBy?: number
  reviewedByName?: string
  reviewedAt?: string
  reviewNotes?: string
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  lineCount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TrialBalanceLine {
  id?: number
  importId: number
  companyId: number
  code: string
  nameAr: string
  nameEn: string
  type: AccountType
  section?: string
  debit: number
  credit: number
  currency?: CurrencyCode
  exchangeRate?: number
  debitBase: number
  creditBase: number
  order: number
  notes?: string
}

export interface AdjustmentLine {
  code: string
  nameAr: string
  nameEn: string
  type: AccountType
  section?: string
  debit: number
  credit: number
}

export interface Adjustment {
  id?: number
  companyId: number
  fiscalYear: string
  no: string
  kind?: 'opening' | 'adjustment'
  date: string
  descriptionAr: string
  descriptionEn: string
  reference?: string
  status: ApprovalStatus
  lines: AdjustmentLine[]
  submittedBy?: number
  submittedByName?: string
  reviewedBy?: number
  reviewedByName?: string
  reviewedAt?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id?: number
  username: string
  passwordHash: string
  fullNameAr: string
  fullNameEn: string
  email?: string
  phone?: string
  role: UserRole
  companyId?: number
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface Reminder {
  id?: number
  titleAr: string
  titleEn: string
  descriptionAr?: string
  descriptionEn?: string
  companyId?: number
  dueDate: string
  remindBeforeDays: number
  status: 'pending' | 'done' | 'overdue' | 'cancelled'
  type: 'review' | 'meeting' | 'deadline' | 'followup' | 'other'
  createdAt: string
  updatedAt: string
}

export interface ArchiveItem {
  id?: number
  companyId: number
  year: string
  type: 'financial_statements' | 'trial_balance' | 'reports' | 'documents'
  titleAr: string
  titleEn: string
  data: unknown
  archivedAt: string
  archivedBy?: string
}

export interface CurrencyRate {
  id?: number
  code: CurrencyCode
  nameAr: string
  nameEn: string
  rateToEGP: number
  date: string
  source?: string
}

export interface Budget {
  id?: number
  companyId: number
  year: string
  lines: Array<{ code: string; amount: number }>
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id?: number
  defaultLanguage: 'ar' | 'en'
  defaultTheme: 'light' | 'dark' | 'light-sand' | 'light-mist' | 'dark-midnight' | 'dark-emerald'
  backupFolderName?: string
  autoBackup: boolean
  lastBackupAt?: string
  lastRestoreAt?: string
  auditTightening: boolean
}

export interface AuditLog {
  id?: number
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'export' | 'backup' | 'restore' | 'generate' | 'truncate'
  entity: string
  entityId?: number
  detailsAr: string
  detailsEn: string
  userName?: string
  createdAt: string
}

export interface TutorialVideo {
  id?: number
  title: string
  pageName: string
  videoNumber: number
  description?: string
  fileName: string
  mimeType: string
  size: number
  videoData: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

// ---------------- Managed SQL (server-backed) compat layer ----------------

const cache: Record<string, any[] | null> = {};
const inflight: Record<string, Promise<any[]> | null> = {};

async function fetchTable(table: string): Promise<any[]> {
  // The login screen renders before authentication; avoid noisy 401 requests.
  if (!getToken()) return [];
  if (cache[table]) return cache[table]!;
  if (inflight[table]) return inflight[table]!;
  inflight[table] = api<any[]>(`/api/tables/${table}`).then((rows) => {
    cache[table] = Array.isArray(rows) ? rows : [];
    inflight[table] = null;
    return cache[table]!;
  }).catch((e) => { inflight[table] = null; throw e; });
  return inflight[table]!;
}
function invalidate(table?: string) {
  if (table) { cache[table] = null; } else { for (const k of Object.keys(cache)) cache[k] = null; }
  notifyDbChange();
}

function sortRows<T>(rows: T[], field: string): T[] {
  return [...rows].sort((a: any, b: any) => String(a?.[field] ?? '').localeCompare(String(b?.[field] ?? ''), undefined, { numeric: true, sensitivity: 'base' }));
}

interface Collection<T extends { id?: any }> {
  toArray(): Promise<T[]>;
  first(): Promise<T | undefined>;
  count(): Promise<number>;
  reverse(): Collection<T>;
  limit(n: number): Collection<T>;
  offset(n: number): Collection<T>;
  filter(fn: (item: T) => boolean): Collection<T>;
  sortBy(field: string): Promise<T[]>;
  each(fn: (item: T) => void): Promise<void>;
  delete(): Promise<void>;
  modify(changes: any): Promise<void>;
}

function createCollection<T extends { id?: any }>(getRows: () => Promise<T[]>, tableApi?: TableApi<T>): Collection<T> {
  return {
    toArray: async (): Promise<T[]> => getRows(),
    first: async (): Promise<T | undefined> => (await getRows())[0],
    count: async (): Promise<number> => (await getRows()).length,
    reverse: () => createCollection(async () => [...(await getRows())].reverse(), tableApi),
    limit: (n: number) => createCollection(async () => (await getRows()).slice(0, n), tableApi),
    offset: (n: number) => createCollection(async () => (await getRows()).slice(n), tableApi),
    filter: (fn: (item: T) => boolean) => createCollection(async () => (await getRows()).filter(fn), tableApi),
    sortBy: async (field: string): Promise<T[]> => sortRows<T>(await getRows(), field),
    each: async (fn: (item: T) => void) => { (await getRows()).forEach(fn); },
    delete: async () => {
      const rows = await getRows() as any[];
      if (tableApi && rows.length) await tableApi.bulkDelete(rows.map(r => r.id));
    },
    modify: async (changes: any) => {
      const rows = await getRows() as any[];
      if (!tableApi) return;
      for (const row of rows) {
        if (typeof changes === 'function') {
          const copy = { ...row };
          changes(copy);
          await tableApi.update(row.id, copy);
        } else {
          await tableApi.update(row.id, { ...row, ...changes });
        }
      }
    },
  };
}

class TableApi<T extends { id?: any }> {
  name: string;
  constructor(name: string) { this.name = name; }
  async toArray(): Promise<T[]> { return fetchTable(this.name) as Promise<T[]>; }
  async get(id: any): Promise<T | undefined> {
    const rows = await this.toArray();
    return rows.find((r: any) => String(r.id) === String(id));
  }
  async add(item: T): Promise<any> {
    const saved = await api(`/api/tables/${this.name}`, { method: 'POST', body: item });
    invalidate(this.name);
    return saved?.id ?? (item as any).id;
  }
  async put(item: T): Promise<any> {
    const id = (item as any).id;
    const saved = await api(`/api/tables/${this.name}/${encodeURIComponent(id)}`, { method: 'PUT', body: item });
    invalidate(this.name);
    return saved?.id ?? id;
  }
  async update(id: any, patch: Partial<T>): Promise<any> {
    await api(`/api/tables/${this.name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
    invalidate(this.name);
    return 1;
  }
  async delete(id: any): Promise<void> {
    await api(`/api/tables/${this.name}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    invalidate(this.name);
  }
  async bulkDelete(ids: any[]): Promise<void> {
    if (!ids?.length) return;
    await api(`/api/tables/${this.name}/bulk-delete`, { method: 'POST', body: { ids } });
    invalidate(this.name);
  }
  async bulkAdd(items: T[]): Promise<any> {
    for (const it of items) await api(`/api/tables/${this.name}`, { method: 'POST', body: it });
    invalidate(this.name);
  }
  async bulkPut(items: T[]): Promise<any> {
    for (const it of items) await api(`/api/tables/${this.name}/${encodeURIComponent((it as any).id)}`, { method: 'PUT', body: it });
    invalidate(this.name);
  }
  async count(): Promise<number> { return (await this.toArray()).length; }
  async clear(): Promise<void> {
    const rows = await this.toArray();
    if (rows.length) await this.bulkDelete(rows.map((r: any) => r.id));
  }
  orderBy(field: string) {
    return {
      reverse: () => createCollection(async () => sortRows(await this.toArray(), field).reverse(), this),
      toArray: async () => sortRows(await this.toArray(), field),
    };
  }
  where(arg: string): { equals: (value: any) => Collection<T>; anyOf: (values: any[]) => Collection<T>; startsWith: (prefix: string) => Collection<T> };
  where(arg: Record<string, any>): Collection<T>;
  where(arg: any): any {
    const self = this;
    if (typeof arg === 'string') {
      const field = arg;
      return {
        equals: (value: any): Collection<T> => createCollection(async () => (await self.toArray()).filter((r: any) => String(r[field]) === String(value)), self),
        anyOf: (values: any[]): Collection<T> => createCollection(async () => (await self.toArray()).filter((r: any) => values.map(String).includes(String(r[field]))), self),
        startsWith: (prefix: string): Collection<T> => createCollection(async () => (await self.toArray()).filter((r: any) => String(r[field] ?? '').startsWith(prefix)), self),
      };
    }
    if (arg && typeof arg === 'object') {
      const entries = Object.entries(arg);
      const match = (r: any) => entries.every(([k, v]) => String(r[k]) === String(v));
      return createCollection(async () => (await self.toArray()).filter(match), self);
    }
    return createCollection<T>(async () => [], self);
  }
  filter(fn: (item: T) => boolean): Collection<T> {
    return createCollection(async () => (await this.toArray()).filter(fn), this);
  }
  toCollection(): Collection<T> { return createCollection(async () => this.toArray(), this); }
}

class MuraqibDBCompat {
  officeProfile = new TableApi<OfficeProfile>('officeProfile');
  appSettings = new TableApi<AppSettings>('appSettings');
  companies = new TableApi<Company>('companies');
  accounts = new TableApi<Account>('accounts');
  trialBalanceImports = new TableApi<TrialBalanceImport>('trialBalanceImports');
  trialBalanceLines = new TableApi<TrialBalanceLine>('trialBalanceLines');
  adjustments = new TableApi<Adjustment>('adjustments');
  users = new TableApi<User>('users');
  reminders = new TableApi<Reminder>('reminders');
  archive = new TableApi<ArchiveItem>('archive');
  currencyRates = new TableApi<CurrencyRate>('currencyRates');
  budgets = new TableApi<Budget>('budgets');
  auditLogs = new TableApi<AuditLog>('auditLogs');
  tutorialVideos = new TableApi<TutorialVideo>('tutorialVideos');

  get tables() {
    return [
      this.officeProfile, this.appSettings, this.companies, this.accounts, this.trialBalanceImports,
      this.trialBalanceLines, this.adjustments, this.users, this.reminders, this.archive,
      this.currencyRates, this.budgets, this.auditLogs, this.tutorialVideos,
    ];
  }

  table(name: string): any { return (this as any)[name]; }

  async transaction(_mode: string, ...args: any[]) {
    const fn = args[args.length - 1];
    const res = typeof fn === 'function' ? await fn() : undefined;
    invalidate();
    return res;
  }

  async exportBackup() {
    // النسخة الخام من الخادم تحفظ كلمات المرور وكل الأعمدة، وتُستعاد بشكل ذري.
    try {
      const data = await api<any>('/api/backup');
      if (data?.tables) {
        return JSON.stringify({
          app: 'Muraqib Certified Financial Controller Platform',
          version: data.version ?? 2,
          exportedAt: data.createdAt ?? new Date().toISOString(),
          ...data.tables,
          tables: data.tables,
        }, null, 2);
      }
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
    }

    // توافق مع خوادم قديمة
    const data: any = { app: 'Muraqib Certified Financial Controller Platform', version: 7, exportedAt: new Date().toISOString() };
    for (const t of this.tables) data[t.name] = await t.toArray();
    return JSON.stringify(data, null, 2);
  }

  async importBackup(json: string) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') throw new Error('INVALID_BACKUP');

    try {
      await api('/api/restore', {
        method: 'POST',
        body: data.tables ? data : { tables: data },
      });
      invalidate();
      return data;
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
    }

    // توافق مع خوادم قديمة
    if (!data.app || !Array.isArray(data.companies)) throw new Error('INVALID_BACKUP');
    await this.transaction('rw', async () => {
      for (const t of this.tables) await t.clear();
      for (const t of this.tables) {
        const rows = data[t.name];
        if (Array.isArray(rows) && rows.length) await t.bulkAdd(rows);
      }
    });
    invalidate();
    return data;
  }

  async delete() { /* noop in server mode */ }
  async open() { /* noop */ }
  async close() { /* noop */ }
  on() { return this; }
}

export const db = new MuraqibDBCompat();
