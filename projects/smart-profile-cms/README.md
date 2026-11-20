# SMART ACTIVITY GROUP — Admin-Driven Profile CMS

Modern CMS (Node + Express + SQLite) for the company profile. All public content is stored in the database and fully manageable by admin (add/edit/delete) via `/admin`.

## Run

```bash
npm install
npm start
```

Open:
- Public site: http://localhost:3000/
- Admin panel: http://localhost:3000/admin

Default admin credentials:
- Username: `admin`
- Password: `admin123`

Change the password in production by creating a new admin user and removing the default one.

## Features
- Dynamic public profile rendered from `/api/site`.
- Admin panel with full CRUD for:
  - Settings (company name, tagline, hero text, badge, note, footer)
  - Hero stats
  - About checklist
  - Vision / Mission / Values + values list
  - Services (+ bullet lists)
  - Categories + sub-items (accordion on public site)
  - Process steps
  - Why choose us
  - Standards / Compliance
  - Segments
  - Engagement models
  - Case studies
  - Contact fields
  - Contact messages (status + delete)
- SQLite database at `data/app.db` (auto-created & seeded on first run).
- Session-based admin auth (Bearer token, 8-hour expiry).

## Notes
- Backup `data/app.db` to preserve content.
- Port can be changed via `PORT` env variable.
- Sub-items are linked to categories and deleted automatically when category is deleted.
