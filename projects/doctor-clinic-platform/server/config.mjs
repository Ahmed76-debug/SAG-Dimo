import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "tabib.db");
export const PORT = Number(process.env.PORT || 5191);
export const HOST = process.env.HOST || "127.0.0.1";
export const TOKEN_SECRET = process.env.TOKEN_SECRET || "tabib-clinic-local-secret-change-me";
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
