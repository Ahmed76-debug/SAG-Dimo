import type { User } from "./types";
import { api, setToken, getToken } from "./api";

export { getToken };

export function readSession(): { userId: string } | null {
  // توافق: الجلسة تُدار الآن عبر رمز الدخول (token) ويُستعاد المستخدم من الخادم
  const token = getToken();
  return token ? { userId: "__token__" } : null;
}

export function clearSession() {
  setToken(null);
}

export async function login(username: string, password: string): Promise<User | null> {
  try {
    const data = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    if (data?.token) setToken(data.token);
    return (data?.user as User) ?? null;
  } catch {
    return null;
  }
}

export async function fetchMe(): Promise<User | null> {
  try {
    const data = await api<{ user: User }>("/api/auth/me");
    return (data?.user as User) ?? null;
  } catch {
    return null;
  }
}

export async function logoutApi(): Promise<void> {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  clearSession();
}

// أدوات مساعدة للتوافق مع الشاشات التي تستخدمها محليًا
export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 120000, hash: "SHA-256" }, keyMaterial, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (!password) return { score: 0, label: "ضعيفة", color: "#ef4444" };
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) || /[ء-ي]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9ء-ي]/.test(password)) score++;
  score = Math.min(4, Math.max(0, Math.floor((score / 5) * 4)));
  const labels = ["ضعيفة", "ضعيفة", "متوسطة", "جيدة", "قوية"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  return { score, label: labels[score] || "ضعيفة", color: colors[score] || "#ef4444" };
}