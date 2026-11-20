import crypto from "node:crypto";

export const nowIso = () => new Date().toISOString();
export const uid = (prefix = "") =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value) {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function bad(message, code = "bad_request", status = 400, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}
export function unauthorized(message = "غير مصرح") {
  return bad(message, "unauthorized", 401);
}
export function forbidden(message = "غير مسموح") {
  return bad(message, "forbidden", 403);
}
export function notFound(message = "غير موجود") {
  return bad(message, "not_found", 404);
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

export function signToken(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [data, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = parseJson(Buffer.from(data, "base64url").toString("utf8"), null);
  if (!payload) return null;
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
