# Multi-Tenant Feature Flag Management System

Built for the Byepo Technologies assignment. One Node.js/Express backend,
three standalone frontends (Super Admin, Org Admin, End User), SQLite for
storage, custom JWT-based auth.

```
feature-flag-system/
├── backend/                 Express API + SQLite (see backend/README.md)
├── frontend-super-admin/    Login + create/view organizations
├── frontend-admin/          Signup/login + feature flag CRUD
└── frontend-user/           Pick org + check a feature flag
```

## Quick start

**1. Start th`e backend** (see `backend/README.md` for details):

```bash
cd backend
npm install
npm start
```

It runs on `http://localhost:4000`. The Super Admin credentials are printed
to the console on startup (default: `superadmin` / `SuperAdmin@123`,
configurable in `.env`).

**2. Open the frontends.** Each is a single static `index.html` with no
build step — open it directly in a browser, or serve the folder:

```bash
# from any of the three frontend-* folders
python3 -m http.server 8080
```

All three call the backend at `http://localhost:4000/api` by default
(see the `API_BASE` constant near the top of each file's `<script>` if you
need to point them somewhere else).

**3. Walk through the roles:**

1. **Super Admin** (`frontend-super-admin`) — log in, create an organization.
2. **Org Admin** (`frontend-admin`) — sign up, picking the org you just
   created, then create/enable/disable feature flags.
3. **End User** (`frontend-user`) — pick that org, type the feature key you
   created, and check whether it's enabled.

## How the roles and tenancy work

- **Super Admin** has static, config-based credentials — by design, no
  signup, no database row for this role.
- **Org Admin** signs up against an *existing* organization (created by the
  Super Admin) and can only ever see or modify flags for that one
  organization. The org id comes from their JWT, not from anything the
  client sends, so an admin can't act on another org's data even by
  guessing a flag id in the URL.
- **End User** is anonymous by design (see `backend/README.md` for the
  reasoning) — they just pick their org and a feature key.

`backend/test-flow.sh` is a runnable smoke test that walks this whole
lifecycle, including a check that one org's admin gets a 404 — not a
403 — when probing another org's flag by id, so existence isn't leaked
either.

## What's deliberately out of scope

Given the assignment's 6–10 hour guidance, the following were left out and
are flagged here rather than silently skipped: refresh tokens, pagination,
rate limiting, email verification, audit logging, and automated test
suites beyond the smoke-test script. `backend/README.md` has the full list
of trade-offs and the reasoning behind each one.
