import { api, getToken, ApiError } from './api';
import { notifyDbChange } from './liveQuery';
import type {
  ActivityEntry,
  Agreement,
  AppNotification,
  Client,
  DocTemplate,
  LegalDocument,
  LegalEvent,
  LibraryItem,
  Matter,
  MatterNote,
  MatterType,
  Payment,
  PortfolioContent,
  Settings,
  StoredFile,
  Task,
  TutorialVideo,
  User,
} from './types';

export const uid = (prefix = '') =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const nowISO = () => new Date().toISOString();

const cache: Record<string, any[] | null> = {};
const inflight: Record<string, Promise<any[]> | null> = {};

async function fetchTable(table: string): Promise<any[]> {
  // Public/login screens render before authentication; avoid noisy 401 requests.
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
  if (table) { cache[table] = null; }
  else { for (const k of Object.keys(cache)) cache[k] = null; }
  notifyDbChange();
}

class QueryChain<T> {
  constructor(private table: string, private op: () => Promise<T[]>) {}
  reverse() { const prev = this.op; return new QueryChain<T>(this.table, async () => [...(await prev())].reverse()); }
  limit(n: number) { const prev = this.op; return new QueryChain<T>(this.table, async () => (await prev()).slice(0, n)); }
  async toArray(): Promise<T[]> { return this.op(); }
  async first(): Promise<T | undefined> { return (await this.op())[0]; }
}

class TableApi<T extends { id: string }> {
  constructor(public name: string) {}
  async toArray(): Promise<T[]> { return fetchTable(this.name) as Promise<T[]>; }
  async get(id: string): Promise<T | undefined> {
    const rows = await this.toArray();
    return rows.find(r => r.id === id);
  }
  async add(item: T): Promise<any> {
    const saved = await api(`/api/tables/${this.name}`, { method: 'POST', body: item });
    invalidate(this.name);
    return saved?.id ?? item.id;
  }
  async put(item: T): Promise<any> {
    const saved = await api(`/api/tables/${this.name}/${encodeURIComponent(item.id)}`, { method: 'PUT', body: item });
    invalidate(this.name);
    return saved?.id ?? item.id;
  }
  async update(id: string, patch: Partial<T>): Promise<any> {
    await api(`/api/tables/${this.name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
    invalidate(this.name);
    return 1;
  }
  async delete(id: string): Promise<void> {
    await api(`/api/tables/${this.name}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    invalidate(this.name);
  }
  async bulkDelete(ids: string[]): Promise<void> {
    await api(`/api/tables/${this.name}/bulk-delete`, { method: 'POST', body: { ids } });
    invalidate(this.name);
  }
  async bulkAdd(items: T[]): Promise<any> {
    for (const it of items) await api(`/api/tables/${this.name}`, { method: 'POST', body: it });
    invalidate(this.name);
  }
  async bulkPut(items: T[]): Promise<any> {
    for (const it of items) await api(`/api/tables/${this.name}/${encodeURIComponent(it.id)}`, { method: 'PUT', body: it });
    invalidate(this.name);
  }
  async count(): Promise<number> { return (await this.toArray()).length; }
  async clear(): Promise<void> {
    const rows = await this.toArray();
    if (rows.length) await this.bulkDelete(rows.map(r => r.id));
  }
  orderBy(field: keyof T & string) {
    return {
      reverse: () => new QueryChain<T>(this.name, async () => {
        const rows = [...(await this.toArray())];
        rows.sort((a:any,b:any)=> String(a[field]??'').localeCompare(String(b[field]??'')));
        return rows.reverse();
      }),
      limit: (n: number) => new QueryChain<T>(this.name, async () => {
        const rows = [...(await this.toArray())];
        rows.sort((a:any,b:any)=> String(a[field]??'').localeCompare(String(b[field]??'')));
        return rows.slice(0,n);
      }),
      toArray: async () => {
        const rows = [...(await this.toArray())];
        rows.sort((a:any,b:any)=> String(a[field]??'').localeCompare(String(b[field]??'')));
        return rows;
      },
    };
  }
  where(field: keyof T & string) {
    return {
      equals: (value: any) => ({
        first: async () => (await this.toArray()).find((r:any) => r[field] === value),
        toArray: async () => (await this.toArray()).filter((r:any) => r[field] === value),
      }),
    };
  }
  filter(fn: (item: T) => boolean) {
    return {
      toArray: async () => (await this.toArray()).filter(fn),
      first: async () => (await this.toArray()).find(fn),
    };
  }
}

class DbCompat {
  users = new TableApi<User>('users');
  clients = new TableApi<Client>('clients');
  matterTypes = new TableApi<MatterType>('matterTypes');
  matters = new TableApi<Matter>('matters');
  agreements = new TableApi<Agreement>('agreements');
  payments = new TableApi<Payment>('payments');
  tasks = new TableApi<Task>('tasks');
  events = new TableApi<LegalEvent>('events');
  documents = new TableApi<LegalDocument>('documents');
  files = new TableApi<StoredFile>('files');
  notes = new TableApi<MatterNote>('notes');
  library = new TableApi<LibraryItem>('library');
  templates = new TableApi<DocTemplate>('templates');
  activity = new TableApi<ActivityEntry>('activity');
  notifications = new TableApi<AppNotification>('notifications');
  settings = new TableApi<Settings>('settings');
  portfolio = new TableApi<PortfolioContent>('portfolio');
  tutorialVideos = new TableApi<TutorialVideo>('tutorialVideos');

  get tables() {
    return [
      this.users, this.clients, this.matterTypes, this.matters, this.agreements, this.payments,
      this.tasks, this.events, this.documents, this.files, this.notes, this.library,
      this.templates, this.activity, this.notifications, this.settings, this.portfolio, this.tutorialVideos,
    ];
  }

  // minimal Dexie-like transaction shim: just execute and invalidate all
  async transaction(_mode: string, ...args: any[]) {
    const fn = args[args.length - 1];
    const res = typeof fn === 'function' ? await fn() : undefined;
    invalidate();
    return res;
  }

  async delete() { /* noop in server mode */ }
  async open() { /* noop */ }
}

export const db = new DbCompat();

export async function logActivity(
  entry: Omit<ActivityEntry, 'id' | 'at'> & { at?: string },
): Promise<void> {
  try {
    await db.activity.add({
      id: uid('act_'),
      at: entry.at ?? nowISO(),
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: entry.meta,
    } as any);
  } catch { /* non-critical */ }
}

type Repo<T extends { id: string }> = {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
  bulkRemove(ids: string[]): Promise<void>;
};

export function repo<T extends { id: string }>(table: any): Repo<T> {
  return {
    all: () => table.toArray(),
    get: (id) => table.get(id),
    create: async (item) => { await table.add(item); return item; },
    update: async (id, patch) => { await table.update(id, patch); },
    remove: (id) => table.delete(id),
    bulkRemove: (ids) => table.bulkDelete(ids),
  };
}

export const usersRepo = repo(db.users);
export const clientsRepo = repo(db.clients);
export const mattersRepo = repo(db.matters);
export const agreementsRepo = repo(db.agreements);
export const paymentsRepo = repo(db.payments);
export const tasksRepo = repo(db.tasks);
export const eventsRepo = repo(db.events);
export const documentsRepo = repo(db.documents);
export const notesRepo = repo(db.notes);
export const libraryRepo = repo(db.library);
export const templatesRepo = repo(db.templates);
export const matterTypesRepo = repo(db.matterTypes);
export const notificationsRepo = repo(db.notifications);
export const tutorialVideosRepo = repo(db.tutorialVideos);

export async function saveFile(blob: Blob, name: string): Promise<StoredFile> {
  const dataUrl = await fileToDataUrl(blob);
  const file: StoredFile = {
    id: uid('file_'),
    blob,
    name,
    mime: blob.type || 'application/octet-stream',
    size: blob.size,
    createdAt: nowISO(),
  } as any;
  await api('/api/tables/files', { method: 'POST', body: { id: file.id, name, mime: file.mime, size: file.size, dataUrl, createdAt: file.createdAt } });
  invalidate('files');
  return file;
}

export async function getFile(id?: string): Promise<StoredFile | undefined> {
  if (!id) return undefined;
  const row = await api<any>(`/api/tables/files/${encodeURIComponent(id)}`).catch(() => null);
  if (!row) return undefined;
  let blob: Blob | undefined;
  if (row.dataUrl) {
    try { blob = await (await fetch(row.dataUrl)).blob(); } catch {}
  }
  return { ...row, blob } as any;
}

export async function deleteFile(id?: string): Promise<void> {
  if (!id) return;
  await api(`/api/tables/files/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  invalidate('files');
}

export function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function blobFromDataUrl(dataUrl: string, name: string): Promise<StoredFile> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return saveFile(blob, name);
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  tables: Record<string, unknown[]>;
  files: { id: string; name: string; mime: string; dataUrl: string }[];
}

const BACKUP_TABLES = [
  'users','clients','matterTypes','matters','agreements','payments','tasks','events','documents','notes','library','templates','activity','settings','portfolio','tutorialVideos',
] as const;

export async function exportBackup(includeFiles = true): Promise<BackupPayload> {
  // المسار الجديد: نسخة خام من الخادم تشمل بصمات كلمات المرور والملفات
  // حتى تعمل الاستعادة دون أن تفقد الحسابات أو الملفات.
  try {
    const res = await api<{ version?: number; createdAt?: string; tables?: Record<string, unknown[]> }>('/api/backup');
    if (res?.tables) {
      const tables = { ...res.tables };
      if (!includeFiles) delete tables.files;
      return {
        version: res.version ?? 2,
        createdAt: res.createdAt ?? nowISO(),
        tables,
        files: [],
      };
    }
  } catch (e) {
    // توافق مع خوادم قديمة لا تعرف /api/backup
    if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
  }

  // المسار القديم (توافق فقط)
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await api(`/api/tables/${t}`);
  }
  let files: BackupPayload['files'] = [];
  if (includeFiles) {
    const frows = await api<any[]>('/api/tables/files');
    files = frows.map(f => ({ id: f.id, name: f.name, mime: f.mime, dataUrl: f.dataUrl }));
  }
  return { version: 1, createdAt: nowISO(), tables, files };
}

export async function importBackup(payload: BackupPayload, mode: 'merge' | 'replace' = 'replace') {
  if (mode === 'replace') {
    // الاستعادة الذرية على الخادم: أسرع وأكثر أمانًا وتحافظ على كلمات المرور.
    try {
      await api('/api/restore', { method: 'POST', body: payload });
      invalidate();
      return;
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 405)) throw e;
    }
  }

  // مسار قديم (توافق مع خوادم لا تعرف /api/restore)
  if (mode === 'replace') {
    for (const t of [...BACKUP_TABLES, 'files'] as const) {
      const rows = await api<any[]>(`/api/tables/${t}`).catch(() => []);
      if (rows.length) await api(`/api/tables/${t}/bulk-delete`, { method: 'POST', body: { ids: rows.map(r=>r.id) } });
    }
  }
  for (const [name, rows] of Object.entries(payload.tables || {})) {
    for (const row of rows as any[]) {
      await api(`/api/tables/${name}/${encodeURIComponent(row.id)}`, { method: 'PUT', body: row }).catch(async () => {
        await api(`/api/tables/${name}`, { method: 'POST', body: row });
      });
    }
  }
  for (const f of payload.files || []) {
    await api('/api/tables/files', { method: 'POST', body: f }).catch(async () => {
      await api(`/api/tables/files/${encodeURIComponent(f.id)}`, { method: 'PUT', body: f });
    });
  }
  invalidate();
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  return { usage: 0, quota: 0 };
}

export async function wipeLocalData() {
  invalidate();
}

/** إعادة تعيين قاعدة البيانات إلى البيانات التجريبية (حذف كامل ثم زرع) */
export async function resetDemoData() {
  await api('/api/reset-demo', { method: 'POST' });
  invalidate();
}

export async function flushSqlSync(): Promise<void> { /* managed server-side */ }
export function sqliteReady(): boolean { return true; }
export function sqlStats() { return { tables: [], totalRows: 0 }; }
export function downloadSqliteFile() { /* server-side db */ }