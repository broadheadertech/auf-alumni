# AUF Alumni Network

The school-verified alumni network and hiring platform for **Angeles University Foundation** graduates and the employers who want to hire them.

- **App**: Next.js 16 (App Router, Turbopack)
- **Backend**: Convex (live deployment: `judicious-goose-928`)
- **Planning**: BMAD Method v6.6.0 — planning artifacts live in the parent project tree

## Quick start

```bash
npm install

# 1. Generate Convex types (REQUIRED on first checkout — _generated/ is gitignored)
npx convex dev
#   The CLI prompts to log in + link the deployment. Pick `judicious-goose-928`.
#   Leave this running in one terminal — it watches convex/ and hot-pushes.

# 2. In a second terminal, run the Next dev server
npm run dev
# Open http://localhost:3000
```

If you see `Module not found: Can't resolve '../../convex/_generated/api'`, you skipped step 1.

## Demo accounts

After running `npx convex run seedAccounts:run` (one-time, idempotent):

| Role     | Email                       | Password                 |
| -------- | --------------------------- | ------------------------ |
| Alumna   | `alumna@demo.auf.local`     | `DemoAlumna-2026-Pass`   |
| Employer | `employer@demo.auf.local`   | `DemoEmployer-2026-Pass` |
| Admin    | `admin@demo.auf.local`      | `DemoAdmin-2026-Pass`    |

For demo content (10 alumni, 6 employers, 6 jobs, events, posts):

```bash
npx convex run seed:run
```

Both seeders are idempotent — safe to re-run.

## Scripts

```bash
npm run dev               # next dev (Turbopack)
npm run build             # production build
npm run lint              # eslint
npm run lint:privacy      # custom: enforces applyPrivacy on profiles reads
npm run lint:admin        # custom: enforces requireRole + withAuditLog on admin mutations
npm test                  # vitest
npx tsc --noEmit          # typecheck
npx convex dev --once     # one-shot Convex push
```

## Architecture highlights

- **Three-sided marketplace**: alumni / employers / school admin — each gets its own shell + nav
- **Per-field privacy tiers** (`public` / `alumni` / `connections` / `private`) — enforced by `applyPrivacy` invariant + lint script
- **Audit logging** — every admin mutation wrapped with `withAuditLog`, lint-enforced
- **DPA compliance** — DSR tracking, 72-hour incident clock, k-anonymity (k≥5) on analytics exports
- **Convex Auth** with email/password + JWT (Scrypt hashing via Lucia)

## Status

All 16 epics across 3 phases are implemented (MVP + Phase 2 + Phase 3). Demo accounts work end-to-end; brand visuals from the Claude Design prototype are in place.
