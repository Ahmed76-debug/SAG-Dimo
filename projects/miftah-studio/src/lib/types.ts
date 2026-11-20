export type RoleSlug = 'owner' | 'manager' | 'support' | 'viewer' | string;

export interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: { id: number; slug: RoleSlug; name: string; permissions: string[] };
  permissions: string[];
  avatarColor: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string | null;
  platform: string | null;
  version: string | null;
  vendor: string | null;
  website: string | null;
  color: string;
  icon: string;
  activationMode: 'online' | 'offline' | 'hybrid';
  defaultPlan: 'subscription' | 'perpetual' | 'trial';
  defaultDays: number;
  defaultSeats: number;
  features: string[];
  status: 'active' | 'inactive';
  licenses?: number;
  activeLicenses?: number;
  revenue?: number;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  licenses?: number;
  activeLicenses?: number;
  revenue?: number;
  createdAt: string;
}

export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'revoked';
export type Plan = 'perpetual' | 'subscription' | 'trial';

export interface License {
  id: number;
  uid: string;
  keyHint: string;
  product: { id: number; code: string; name: string; color: string; icon: string };
  customer: { id: number; name: string; company: string | null; email: string | null } | null;
  plan: Plan;
  planLabel: string;
  status: LicenseStatus;
  rawStatus: 'active' | 'suspended' | 'revoked';
  activationMode: 'online' | 'offline' | 'hybrid';
  issuedAt: string;
  startsAt: string;
  expiresAt: string | null;
  maxSeats: number;
  activeActivations: number;
  features: string[];
  price: number;
  currency: string;
  notes: string | null;
  lastSeenAt: string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface Activation {
  id: number;
  machineId: string;
  machineName: string | null;
  os: string | null;
  appVersion: string | null;
  ip: string | null;
  mode: 'online' | 'offline';
  status: 'active' | 'deactivated';
  activatedAt: string;
  lastSeenAt: string | null;
}

export interface ActivationRow extends Activation {
  licenseId: number;
  licenseUid: string;
  product: { name: string; code: string; color: string };
  customer: { name: string; company: string | null } | null;
}

export interface ActivationRequest {
  id: number;
  uid: string;
  licenseId: number | null;
  licenseUid: string | null;
  keyHint: string | null;
  product: { name: string; code: string; color: string };
  customer: { name: string; company: string | null } | null;
  machineId: string;
  machineName: string | null;
  os: string | null;
  appVersion: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
}

export interface Role {
  id: number;
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  users: number;
  createdAt?: string;
}

export interface PermissionDef {
  key: string;
  group: string;
  label: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  userId: number | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  detail: Record<string, unknown> | null;
}

export interface DashboardData {
  cards: {
    licenses: number;
    activeLicenses: number;
    activeGrowth: number;
    expiring: number;
    revenue: number;
    revenueGrowth: number;
    totalRevenue: number;
    activations: number;
    onlineActivations: number;
    pendingRequests: number;
    customers: number;
    products: number;
  };
  series: { month: string; count: number; revenue: number }[];
  planSplit: { plan: Plan; count: number }[];
  statusSplit: { status: LicenseStatus; count: number }[];
  topProducts: { id: number; name: string; code: string; color: string; icon: string; licenses: number; active: number; revenue: number }[];
  expiringSoon: {
    id: number; uid: string; key_hint: string; plan: Plan; expires_at: string; max_seats: number;
    product_name: string; product_color: string; product_code: string;
    customer_name: string | null; customer_company: string | null;
  }[];
  recent: AuditEntry[];
  activationsDaily: { date: string; count: number }[];
}

export interface LicenseDetailData {
  license: License;
  activations: Activation[];
  requests: { id: number; uid: string; machine_id: string; machine_name: string | null; os: string | null; status: string; created_at: string; approved_at: string | null }[];
  history: AuditEntry[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  summary?: Record<string, number>;
}

export interface BackupRecord {
  id: number;
  filename: string;
  path: string;
  size: number;
  note: string | null;
  kind: 'manual' | 'auto' | 'pre-restore';
  createdBy: string | null;
  createdAt: string;
  exists: boolean;
}

export interface BackupFile {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
}

export interface ApiKeyRecord {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface SystemInfo {
  appName: string;
  version: string;
  node: string;
  platform: string;
  port: number;
  host: string;
  dataDir: string;
  keysDir: string;
  backupsDir: string;
  dbFile: string;
  dbSize: number;
  uptime: number;
  counts: Record<string, number>;
  publicKey: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  drives: string[];
  home?: string;
  dataDir?: string;
  backupsDir?: string;
  dirs: { name: string; path: string }[];
  files: BackupFile[];
}
