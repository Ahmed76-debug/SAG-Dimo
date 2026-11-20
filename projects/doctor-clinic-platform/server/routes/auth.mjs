import { Router } from "express";
import { getDb } from "../db.mjs";
import {
  hashPassword,
  randomSalt,
  serializeUser,
  requireAuth,
  findUserByLogin,
  verifyPassword,
} from "../auth.mjs";
import { signToken, nowIso, bad, unauthorized } from "../util.mjs";
import { TOKEN_SECRET, TOKEN_TTL_MS } from "../config.mjs";

export const authRouter = Router();

authRouter.post("/login", (req, res, next) => {
  try {
    const raw = String(req.body?.username ?? req.body?.email ?? "").trim();
    const password = req.body?.password;

    if (!raw) return next(bad("أدخل اسم المستخدم أو البريد الإلكتروني.", "missing_username", 400));
    if (password == null || String(password) === "") {
      return next(bad("أدخل كلمة المرور.", "missing_password", 400));
    }

    const user = findUserByLogin(raw);
    if (!user) {
      return next(
        unauthorized(
          "لا يوجد حساب بهذا الاسم أو البريد الإلكتروني. استخدم admin للدخول التجريبي."
        )
      );
    }
    if (!user.active) {
      return next(unauthorized("هذا الحساب موقوف. تواصل مع مدير العيادة لتفعيله."));
    }

    // Lazy migration for accounts created before the managed SQL backend.
    if (!user.passwordHash || !user.salt) {
      const salt = randomSalt();
      const passwordHash = hashPassword(user.id === "usr_admin" ? "admin123" : "1234", salt);
      getDb()
        .prepare("UPDATE users SET passwordHash=?, salt=? WHERE id=?")
        .run(passwordHash, salt, user.id);
      user.passwordHash = passwordHash;
      user.salt = salt;
    }

    if (!verifyPassword(String(password), user)) {
      return next(
        unauthorized(
          user.id === "usr_admin"
            ? "كلمة مرور المدير غير صحيحة. كلمة المرور الافتراضية هي admin123."
            : "كلمة المرور غير صحيحة. كلمة المرور التجريبية الافتراضية هي 1234."
        )
      );
    }

    const at = nowIso();
    const token = signToken({ sub: user.id, exp: Date.now() + TOKEN_TTL_MS }, TOKEN_SECRET);
    res.json({
      ok: true,
      data: { token, user: serializeUser(user), loginAt: at },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, data: { user: req.userSafe } });
});

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

authRouter.post("/change-password", requireAuth, (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword ?? req.body?.password ?? "");
    if (newPassword.length < 4) {
      return next(bad("كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل.", "weak_password", 400));
    }
    const salt = randomSalt();
    const passwordHash = hashPassword(newPassword, salt);
    getDb()
      .prepare("UPDATE users SET passwordHash=?, salt=? WHERE id=?")
      .run(passwordHash, salt, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
