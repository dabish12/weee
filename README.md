# DDEO-SRATMS – Student Roster and Academic Transcript Management System

Dembi Dollo Education Office, Oromia. Grades 9–12. Node.js + Express + MySQL, with a plain HTML/CSS/JS frontend served by the same Express app (same origin, so secure cookies and CSRF checks stay simple).

```
frontend/   index.html, style.css, app.js
backend/    server.js, database.sql, package.json, .env.example
            src/ (config, db, http helpers)   routes/   controllers/
            services/ (academic.js, audit.js) middleware/ (auth, error)
            scripts/ (init-db, create-admin)  tests/
```

## Install

1. Install Node.js 18+ and MySQL 8+.
2. `cd backend && npm install`
3. `cp .env.example .env` and fill in real values (never commit `.env`).
4. Create the database: `npm run init-db` (uses `DB_ADMIN_USER`). Then create a limited MySQL user for the app:
   ```sql
   CREATE USER 'ddeo_app'@'localhost' IDENTIFIED BY '<strong password>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON ddeo_sratms.* TO 'ddeo_app'@'localhost';
   ```
5. Create the first Education Office administrator (one time only):
   `ADMIN_USERNAME=office-admin ADMIN_PASSWORD='<12+ chars>' npm run create-admin`
6. `npm run dev` (or `npm start` in production), then open http://localhost:3000.

## First-time setup in the app

1. Sign in as the Education Office administrator and change the password when asked.
2. **Academic rules**: enter the officially approved ranking method, grading scale, promotion rule and Grade 12 graduation rule. Nothing is pre-filled on purpose. Until set, results show `UNCONFIGURED` and annual computation requires a ranking method.
3. **Schools**: register a school and add its administrator (a one-time temporary password is shown).
4. The school administrator then sets up academic years, sections, subjects, teachers, assignments and assessment weights (must total exactly 100%), registers students, and creates student logins.
5. Teachers enter marks, submit; the administrator approves; annual results are computed; transcripts can be previewed, printed and issued.

## Security design (implemented in code)

- Passwords hashed with bcrypt (cost 12); 10+ character policy; forced change on first login and after reset; 5 failed logins lock the account for 15 minutes; login also rate limited per IP.
- Server-side sessions: random token stored hashed, `HttpOnly`, `SameSite=Strict`, `Secure` in production, expiry from `SESSION_HOURS`; logout deletes the session; password change ends other sessions.
- CSRF token required on every state-changing request. Helmet headers with a strict CSP (no inline script/style).
- Every protected route checks authentication, role, and takes `school_id` from the session, never from the request. School-scoped tables use composite foreign keys `(id, school_id)` so cross-school references are rejected by MySQL itself.
- Parameterised SQL everywhere (identifiers come only from fixed whitelists). Input validated with zod. The frontend builds DOM with `textContent` only. CSV export neutralises spreadsheet formulas.
- Submitted/approved marks cannot be changed by teachers; administrator corrections need a reason and write old/new values to `audit_logs`. Issued transcripts are stored as immutable snapshots.

## Tests

`cd backend && npm test` runs the unit tests for the academic calculations (weights, mark ranges, weighted mark, annual average, ranking ties, config-driven grading/promotion).

## Production deployment

Choose a host that provides Node.js, MySQL reachable from the app, environment variables, HTTPS (TLS terminated at a proxy; the app sets `trust proxy` in production), persistent storage and backups. Set `NODE_ENV=production`, run `npm start` under a process manager, and keep `.env` out of the repository.

Backups: `mysqldump --single-transaction --routines ddeo_sratms > backups/ddeo-$(date +%F).sql` on a schedule, stored off the server and encrypted. Restore into an empty database with `mysql ddeo_sratms < file.sql`. Test a restore before relying on it.

## Status: what is and is not done

Written but **not yet run against a real MySQL server or in a browser**. Only the academic-calculation unit tests and JavaScript syntax checks have been executed. Expect bugs on first run.

Not implemented yet:
- Photograph upload, Excel (.xlsx) import/export (CSV export exists), CSV import
- Server-generated PDF (use the browser's Print / Save as PDF on the transcript page)
- Attendance and conduct screens (tables exist), student self-registration requests screen (table exists), notifications screen (notifications are stored, not displayed)
- Self-service account recovery by email (administrators reset passwords instead); a separate registrar role (not among the five roles in the specification)
- Result publication windows and the student "secure verification" step for published results
- Automated tests for authentication, permissions, cross-school isolation, imports, session expiry and database failure (needs a test database), and manual test scripts
- Logo upload, a school-level principal approval step, promotion of students to the next grade as a bulk action
