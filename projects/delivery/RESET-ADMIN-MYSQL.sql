-- ============================================================
-- Talabatak — إعادة تعيين كلمة مرور المدير (MySQL / MariaDB)
-- نفّذ هذا الملف من phpMyAdmin > SQL على قاعدة بيانات المشروع.
-- Username: admin
-- Password: admin123
-- غيّر كلمة المرور فور الدخول.
--
-- كلمة المرور في طلباتك تُخزَّن كـ SHA-256 (بدون salt)،
-- والقيمة التالية هي SHA-256 للنص: admin123
-- ============================================================

INSERT INTO users
  (name, email, phone, password, role, permissions, active, branch_id, created_at)
VALUES
  ('General Manager',
   'admin',
   '01000000001',
   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
   'admin',
   '{}',
   1,
   NULL,
   NOW())
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  role     = 'admin',
  active   = 1;

-- للتحقق:
SELECT id, name, email, role, active FROM users WHERE email = 'admin';
