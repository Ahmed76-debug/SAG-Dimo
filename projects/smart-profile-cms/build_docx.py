from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

doc = Document()

# base font
normal = doc.styles['Normal']
normal.font.name = 'Calibri'
normal.font.size = Pt(11)

def title(text, size=22, color=(30,58,138)):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor(*color)
    return p

def heading(text, size=15, color=(30,58,138)):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor(*color)
    return p

def para(text, bold=False, italic=False, size=11):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    r.font.size = Pt(size)
    return p

def bullet(text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.25 + 0.25*level)
    r = p.add_run(text)
    r.font.size = Pt(11)
    return p

def code(text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.35)
    r = p.add_run(text)
    r.font.name = 'Consolas'
    r.font.size = Pt(9.5)
    r.font.color.rgb = RGBColor(15,23,42)
    return p

def table(rows, header=True, width=6.5):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = t.rows[i].cells[j]
            cell.text = ''
            p = cell.paragraphs[0]
            r = p.add_run(str(val))
            r.font.size = Pt(10)
            if header and i == 0:
                r.bold = True
    return t

title('Smart Activity Group — Profile CMS')
para('Developer Handoff Guide (Full Project Documentation)', bold=True)
para('Prepared for developers who will maintain, extend, or deploy this project.', italic=True)
para('')

heading('1. Project overview')
para('This project is a database-driven, admin-managed company profile website (CMS) for SMART ACTIVITY GROUP, focused on B2B general supplies. It includes a public responsive website and a protected admin panel with full CRUD for all profile content. All content is stored in SQLite and rendered dynamically.')
para('')

heading('2. Exact paths')
rows = [
    ['Item', 'Path'],
    ['Project root', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms'],
    ['Public website', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\public\index.html'],
    ['Public scripts/styles', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\public\app.js, styles.css'],
    ['Admin panel', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\public\admin.html, admin.js'],
    ['Backend server', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\server.js'],
    ['Database module', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\src\db.js'],
    ['Auth module', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\src\auth.js'],
    ['SQLite database', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\data\app.db'],
    ['Package config', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\package.json'],
    ['Documentation', r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\README.md'],
]
table(rows)
para('')

heading('3. Tech stack')
bullet('Runtime: Node.js v24+ (uses built-in node:sqlite)')
bullet('Backend: Express.js')
bullet('View model: Server-rendered static HTML + client-side API rendering (no framework)')
bullet('Database: SQLite (node:sqlite DatabaseSync)')
bullet('Authentication: Scrypt password hashing + bearer session tokens (8h expiry)')
bullet('Email: Nodemailer (SMTP)')
bullet('WhatsApp: Meta Cloud API (optional) + wa.me deep links (no client auto-popup)')
bullet('Frontend: Vanilla JS, custom responsive CSS')
bullet('Admin UI: Single-page admin.html + admin.js')
para('')

heading('4. How to run')
code('cd C:\\Users\\CONNECT\\Desktop\\OPEN\\smart-profile-cms')
code('npm install')
code('npm start')
para('Then open:')
bullet('Public site: http://localhost:3000/')
bullet('Admin panel: http://localhost:3000/admin  (default admin / admin123)')
para('Use PORT env var to change port.')
para('')

heading('5. Architecture flow')
para('Public site fetches /api/site once and renders all sections client-side. Admin panel authenticates, then uses dedicated REST endpoints for CRUD. SQLite persists everything. No templates framework; rendering is Vanilla JS.')
bullet('Public: app.js -> fetch(/api/site) -> renderAll(data)')
bullet('Admin: admin.js -> API calls with Bearer token -> CRUD operations')
bullet('Security: protected admin GET/POST/PUT/PATCH/DELETE; /api/site and contact POST public')
para('')

heading('6. Database schema (tables)')
rows = [
    ['Table', 'Purpose'],
    ['users', 'Admin users (username, scrypt hash, role)'],
    ['sessions', 'Bearer session tokens (id, user_id, expires)'],
    ['settings', 'Key/value site settings (company name, logo, SMTP, WhatsApp, etc.)'],
    ['hero_stats', 'Fact sheet statistics with label_en/label_ar'],
    ['about_items', 'About checklist items (text_en/text_ar)'],
    ['vmv', 'Vision / Mission / Values card (title_en/title_ar, body)'],
    ['values_list', 'Value pills (label_en/label_ar)'],
    ['services', 'Services (title_en/title_ar, description, bullets JSON)'],
    ['categories', 'Supply categories (title_en/title_ar, icon, description)'],
    ['subitems', 'Sub-items under categories (text_en/text_ar)'],
    ['process_steps', 'Process flow (num, title_en/title_ar, body)'],
    ['why_items', 'Why choose us (title_en/title_ar, body)'],
    ['standards', 'Standards/compliance (title_en/title_ar, body)'],
    ['segments', 'Target markets (title_en/title_ar, body)'],
    ['models', 'Engagement models (title_en/title_ar, body)'],
    ['cases', 'Case studies (tag/title/body with EN/AR title/tag)'],
    ['contact_fields', 'Contact info labels/values (label_en/label_ar)'],
    ['experiences', 'Previous experiences/projects (title_en/title_ar)'],
    ['partners', 'Companies (previous/current) (name_en/name_ar)'],
    ['messages', 'Contact form submissions (inbox)'],
]
table(rows)
para('')

heading('7. API overview')
para('Public')
bullet('GET /api/site — full public payload')
bullet('POST /api/messages — submit contact inquiry (email/WhatsApp delivery attempted)')
para('Auth')
bullet('POST /api/auth/login — returns token')
bullet('POST /api/auth/logout — destroy session')
bullet('GET /api/auth/me — current user')
para('Admin CRUD (all protected by Bearer token)')
code('/api/settings (GET/PUT)')
code('/api/hero-stats, /api/about-items, /api/vmv, /api/values-list')
code('/api/services, /api/categories, /api/subitems, /api/process-steps')
code('/api/why-items, /api/standards, /api/segments, /api/models, /api/cases')
code('/api/contact-fields, /api/experiences, /api/partners')
code('/api/messages (GET/PATCH/DELETE), /api/settings/test-email, /api/settings/test-whatsapp')
para('')

heading('8. Bilingual (EN/AR) support')
para('Each item now supports primary/English/Arabic title or text fields (e.g., title_en and title_ar). Public UI renders English title then Arabic beneath using the helper function biTitle(en, ar, fallback). Admin forms include inputs for these fields. This keeps the same design and responsiveness.')
para('')

heading('9. Logo handling')
para('Admin can upload a logo from Settings. The file is read client-side as base64 (max ~1MB recommended) and stored in settings.logo_url. Public brand mark renders an <img> when present, otherwise falls back to initials. Responsive via object-fit: contain.')
para('')

heading('10. Contact / messaging integration')
para('Frontend contact form posts to /api/messages. Backend stores it and attempts:')
bullet('Email via SMTP (nodemailer) if configured')
bullet('WhatsApp via Meta Cloud API if credentials provided')
bullet('If not configured, no crash; message remains in admin inbox')
para('Admin Inbox includes Reply Email / Reply WhatsApp buttons. No client-side auto-open of WhatsApp.')
para('')

heading('11. Security model')
bullet('Scrypt password hashing (salt + 64-byte derived key)')
bullet('Session tokens stored server-side with expiry')
bullet('Login rate limiting: 8 attempts per 15 minutes per IP')
bullet('Admin-only APIs protected with A middleware')
bullet('Public website does not expose admin data directly')
bullet('Default credentials: admin / admin123 (must be changed in production)')
para('')

heading('12. Responsive design principles in this project')
bullet('CSS grid + breakpoints (900px / 560px)')
bullet('Mobile navigation via hamburger with accessible dropdown')
bullet('No display:none for content items (except print mode)')
bullet('Grid columns auto-stack (3 -> 2 -> 1)')
bullet('Modal widths use min(640px, 92vw)')
bullet('Fixed admin link visible (z-index high, safe-area-aware)')
para('')

heading('13. Common developer tasks')
code('To add a new content type:')
bullet('Create table in src/db.js (initSchema)')
bullet('Add ensureColumn migration entries')
bullet('Add allowed fields in server.js')
bullet('Register in makeCrud list and /api/site aggregate if needed')
bullet('Add admin panel in public/admin.js')
bullet('Add render block in public/app.js')
code('To change branding/colors:')
bullet('Edit CSS variables in public/styles.css (primary, accent, dark, etc.)')
code('To deploy:')
bullet('Install Node.js v24+')
bullet('Run npm install && npm start')
bullet('Set PORT and production credentials (HTTPS recommended)')
para('')

heading('14. Environment / config')
para('Config is stored in SQLite settings table, not .env. Required production settings:')
code('company_name, tagline, hero_title, hero_subtitle, hero_badge, hero_note')
code('logo_url (base64)')
code('company_email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from')
code('whatsapp_number, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_recipient')
para('')

heading('15. Troubleshooting')
bullet('Port in use: kill node processes or set PORT=3001.')
bullet('Empty UI: check browser console (usually JS template string syntax).')
bullet('Unauthenticated admin data access: should return 401; verify headers.')
bullet('Cross-machine: data is in data/app.db; backup it.')
para('')

heading('16. Strategy summary')
para('The project is designed as a full-featured but lightweight CMS (Node + SQLite + Vanilla JS). That makes it easy for a developer to deploy on shared/Windows servers (as done), extend table-by-table, and manage through the admin UI without rewriting frontend framework code. Key engineering decisions:')
bullet('No build step (great for low-cost Windows hosting)')
bullet('SQLite for portability')
bullet('Vanilla JS to avoid framework overhead')
bullet('Admin controls (add/edit/delete) everywhere')
bullet('Data never stored only in UI; all persisted and validated')
para('')

para('End of document.', italic=True)
doc.save(r'C:\Users\CONNECT\Desktop\OPEN\smart-profile-cms\Project-Developer-Guide.docx')
print('DOCX created')
