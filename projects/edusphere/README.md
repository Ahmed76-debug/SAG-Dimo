# EduSphere — International School Management & ERP

EduSphere is a bilingual (Arabic/English) web-based international school management system and full ERP built with **zero external dependencies**:

- **Backend:** Node.js (v20+ recommended, tested with Node 26) using built-in `http`, `fs`, `crypto`, `zlib`, and `node:sqlite`
- **Database:** SQLite (file-based, `storage/edusphere.db`)
- **Frontend:** Vanilla ES modules SPA (no build step)

## Features

- **Bilingual UI (AR/EN):** RTL/LTR support, database-driven editable translations
- **Dark/Light theme:** System-aware with manual toggle
- **Full CRUD:** Metadata-driven modules for students, staff, academics, finance, ERP, HR, library, e-learning, transport, inventory, and operations
- **ERP & financial reports:** Trial Balance, Income Statement, Balance Sheet, Statement of Changes in Equity, Cash Flow, General Ledger, Aging, Student Statement, Fee Collection, Payroll, Budget Variance, and more
- **Attendance, Gradebook, Timetable:** Dedicated operational views with register/matrix/slot APIs
- **RBAC:** Multi-user roles and granular permissions, multi-branch support
- **Backup & restore:** Create/verify/download/upload/restore `.edusphere` backups to local folders, external drives, or cloud-synced paths
- **Responsive design:** Works across desktop and tablet/mobile screen sizes
- **PWA-ready shell:** Manifest and service-worker placeholder for future app packaging

## Requirements

- Node.js with `node:sqlite` support (Node 22+; recommended latest LTS/current)
- Windows, macOS, or Linux

No `npm install` is required.

## Quick start

```bash
cd edusphere
node server/index.js
```

Then open the URL printed in the console (e.g. `http://localhost:4173`).  
The active port is also written to `.port`.

### Windows helpers

- `start.bat` or `start.ps1` starts the server and opens the app in your browser.

## Default login

- **Username:** `admin`
- **Password:** `admin123`

Demo data is seeded automatically on first run.

## Project structure

- `server/` — HTTP server, routing, auth, schema, CRUD engine, reports, backup, seeding
  - `server/index.js` — entry point
  - `server/lib/` — database, schema, entities metadata, CRUD, auth, i18n, reports, backup
  - `server/routes/` — `system.js`, `data.js`, `business.js`
  - `server/tools/smoke.js` — API smoke tests
- `public/` — SPA frontend (HTML/CSS/JS)
- `storage/` — SQLite database, uploads, backups (created at runtime)

## Backup format

Backups are gzip-compressed JSON archives with the `.edusphere` extension containing the SQLite database (base64) and uploaded files metadata/content as applicable. Restore uses a safe table-copy approach (`ATTACH DATABASE`) without requiring a server restart.

## Smoke tests

With the server running:

```bash
node server/tools/smoke.js
```

## Notes

- The server auto-increments the port if the default is busy.
- To reseed translations/permissions metadata on schema/entity updates, restart the server (seed/i18n sync runs at boot).
- For production deployment, place behind a reverse proxy (HTTPS) and configure secure cookie/session settings as needed.
