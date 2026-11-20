import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, Search, X } from "lucide-react";
import { avatarGradient, initials } from "@/lib/utils";

/* ------------------------------------------------------------------ Button */
type BtnVariant = "primary" | "soft" | "ghost" | "danger" | "danger-soft" | "ok" | "dark" | "outline";
type BtnSize = "sm" | "md" | "lg";

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  const v = variant === "outline" ? "" : `btn-${variant}`;
  const s = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button className={`btn ${v} ${s} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`icon-btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  icon,
  action,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-hd">
      <h3>
        {icon}
        <span>
          {title}
          {sub ? <span className="sub" style={{ display: "block", marginTop: 1 }}>{sub}</span> : null}
        </span>
      </h3>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */
export type BadgeTone = "default" | "primary" | "ok" | "warn" | "danger" | "info" | "violet" | "gold" | "line";

export function Badge({
  tone = "default",
  children,
  dot,
  className = "",
  style,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`badge ${tone === "default" ? "" : `badge-${tone}`} ${className}`} style={style}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Avatar */
export function Avatar({
  name,
  size = "md",
  src,
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  src?: string;
  className?: string;
}) {
  const cls = size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : size === "xl" ? "avatar-xl" : "";
  return (
    <div
      className={`avatar ${cls} ${className}`}
      style={{ background: src ? undefined : avatarGradient(name) }}
      title={name}
    >
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}
    </div>
  );
}

/* ------------------------------------------------------------------ Fields */
export function Field({
  label,
  children,
  hint,
  required,
  className = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label>
        {label}
        {required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
      </label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "بحث…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`searchbar ${className}`} style={{ maxWidth: "none" }}>
      <Search size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  sub,
  icon,
  children,
  footer,
  size = "md",
  printing,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  printing?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizeCls = size === "sm" ? "modal-sm" : size === "lg" ? "modal-lg" : size === "xl" ? "modal-xl" : "";

  return createPortal(
    <div
      className={`overlay ${printing ? "printing" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${sizeCls}`} role="dialog" aria-modal="true">
        {title ? (
          <div className="modal-hd">
            <div className="row" style={{ alignItems: "flex-start" }}>
              {icon ? (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--primary-soft)",
                    color: "var(--primary)",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {icon}
                </div>
              ) : null}
              <div>
                <h3>{title}</h3>
                {sub ? <div className="sub">{sub}</div> : null}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
              <X size={18} />
            </button>
          </div>
        ) : null}
        <div className="modal-bd">{children}</div>
        {footer ? <div className="modal-ft">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------- EmptyState */
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon}</div>
      <h4>{title}</h4>
      {desc ? <p>{desc}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- Tabs */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={`tab ${value === t.key ? "on" : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
          {typeof t.count === "number" ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Stat */
export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "primary",
  foot,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon: React.ReactNode;
  tone?: "primary" | "ok" | "warn" | "danger" | "info" | "violet" | "gold";
  foot?: React.ReactNode;
  tint?: string;
}) {
  const map: Record<string, { c: string; bg: string }> = {
    primary: { c: "var(--primary)", bg: "var(--primary-soft)" },
    ok: { c: "var(--ok)", bg: "var(--ok-soft)" },
    warn: { c: "var(--warn)", bg: "var(--warn-soft)" },
    danger: { c: "var(--danger)", bg: "var(--danger-soft)" },
    info: { c: "var(--info)", bg: "var(--info-soft)" },
    violet: { c: "var(--violet)", bg: "var(--violet-soft)" },
    gold: { c: "var(--gold)", bg: "var(--gold-soft)" },
  };
  const m = map[tone];
  return (
    <div className="stat" style={{ "--stat-tint": tint ?? m.bg, "--stat-color": m.c } as React.CSSProperties}>
      <div className="stat-ico">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value num">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Progress */
export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "warn" | "danger" }) {
  return (
    <div className={`progress ${tone === "primary" ? "" : tone}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Toast */
export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; msg: string; kind: "ok" | "err" | "info" }[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => onDismiss(t.id)}>
          {t.kind === "ok" ? <CheckCircle2 size={16} /> : t.kind === "err" ? <AlertCircle size={16} /> : <Info size={16} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ Confirm */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      icon={<AlertCircle size={18} />}
      footer={
        <>
          <Button onClick={onCancel}>إلغاء</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: ".87rem", color: "var(--ink-2)", lineHeight: 1.8 }}>{message}</div>
    </Modal>
  );
}

/* --------------------------------------------------------------- PageHead */
export function PageHead({
  title,
  sub,
  actions,
  eyebrow,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 7 }}>{eyebrow}</div> : null}
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
