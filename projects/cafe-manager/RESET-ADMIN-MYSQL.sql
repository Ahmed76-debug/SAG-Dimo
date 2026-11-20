-- ============================================================
-- Cafe Manager — إعادة تعيين كلمة مرور المدير (MySQL / MariaDB)
-- نفّذ هذا الملف من phpMyAdmin > SQL على قاعدة بيانات المشروع.
-- Username: admin
-- Password: admin123
-- غيّر كلمة المرور فور الدخول (المستخدمون > تعديل).
--
-- دور المدير في هذا المشروع هو النص العربي "مدير"،
-- لذلك كُتب بصيغة HEX لضمان سلامته مهما كان ترميز ملف SQL.
-- ============================================================

INSERT INTO users
  (name, username, pass, role, perms, branch_id)
VALUES
  ('General Manager',
   'admin',
   'admin123',
   CONVERT(0xD985D8AFD98AD8B1 USING utf8mb4),
   '{}',
   1)
ON DUPLICATE KEY UPDATE
  pass = VALUES(pass),
  role = CONVERT(0xD985D8AFD98AD8B1 USING utf8mb4);

-- للتحقق:
SELECT id, name, username, role, branch_id FROM users WHERE username = 'admin';
