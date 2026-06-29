# Backend — Feature Flag API

Node.js + Express API backing all three frontends.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # optional — defaults work out of the box
npm start
```

The server listens on `http://localhost:4000` and prints the Super Admin
credentials it's using on startup. The SQLite file lives at `backend/data/app.sqlite`
and is created automatically on first run.

Run `bash test-flow.sh` (server must already be running) for an end-to-end
smoke test that also asserts the cross-tenant security boundary.

## Data model

```
organizations (id, name, created_at)
roles         (id, name)              -- super_admin / org_admin / end_user
users         (id, org_id, role_id, name, email, password_hash, created_at)
feature_flags (id, org_id, key, description, enabled, created_at, updated_at)
              UNIQUE(org_id, key)
```

`roles` is a real table (not just an enum column) because the spec lists
"Roles" as its own persisted entity. End Users don't get a `users` row at
all — see **Design decisions** below for why.

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/super-admin/login` | — | `{username, password}` → JWT |
| POST | `/api/auth/org-admin/signup` | — | `{orgId, name, email, password}` → JWT |
| POST | `/api/auth/org-admin/login` | — | `{email, password}` → JWT |
| GET | `/api/organizations/public` | — | `[{id, name}]`, for signup/check pickers |
| POST | `/api/organizations` | Super Admin | `{name}` → create org |
| GET | `/api/organizations` | Super Admin | list orgs + admin/flag counts |
| GET | `/api/flags` | Org Admin | list **own org's** flags |
| POST | `/api/flags` | Org Admin | `{key, description?, enabled?}` |
| PUT | `/api/flags/:id` | Org Admin | `{description?, enabled?}` |
| DELETE | `/api/flags/:id` | Org Admin | — |
| GET | `/api/flags/check?orgId=&key=` | — | `{key, enabled}` |

All Org Admin routes scope to `req.user.orgId`, taken from the verified JWT
— never from a client-supplied org id — so one tenant's admin can't read or
mutate another tenant's flags, even by guessing an id (verified by
`test-flow.sh`, which asserts a 404 there rather than a 403, so existence
isn't leaked either).

## Design decisions & trade-offs

- **SQLite via `sql.js` instead of `better-sqlite3`.** `better-sqlite3` is a
  native addon and needs a compiler toolchain at install time; in a
  network-restricted environment (and on some grading machines) that
  install can fail. `sql.js` is pure WASM, so `npm install` always works.
  The trade-off: it's an in-memory database that gets serialized to
  `data/app.sqlite` on every write. Fine at this scale and with a single
  process; it would not be the right choice for high write concurrency.
  Because all access goes through `src/db.js`, swapping to a real
  on-disk driver later is a one-file change.
- **Custom auth, not a third-party provider** — per the spec. `bcryptjs` and
  `jsonwebtoken` are just hashing/token *utilities*, not auth providers; the
  login/signup/verification logic is hand-rolled.
- **Super Admin has no database row.** The spec says "static credentials
  (hardcoded or config-based)" specifically to *avoid* needing a signup flow
  for that role, so it's checked against `config.js`/`.env` and signed into
  a JWT directly.
- **End Users are anonymous.** The spec's "Required features" for the User
  Frontend never mention signup or login — just an org + feature-key form —
  while the System Roles section says an End User "belongs to one
  organization." I read that as identification by organization, not by
  account, so the check endpoint is public and unauthenticated. The
  trade-off is no per-user audit trail for checks; if that's wanted, the
  next step would be a lightweight end-user signup mirroring the Org Admin
  one.
- **One JWT secret, no refresh tokens, 8h expiry.** Acceptable for the scope
  of this assignment; a production version would add refresh tokens and
  shorter access-token lifetimes.
- **No pagination/rate limiting.** Left out deliberately to stay inside the
  assignment's time-box — flagged here rather than silently skipped.
