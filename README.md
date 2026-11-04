# Twisungane Platform

Digital management system for **Twisungane**, a SACCO (savings & credit cooperative /
association d'épargne et de crédit) in Rwanda. It digitizes the association's statutes:
member registration, share management, loans, interest distribution, penalties, a social
support fund, group expenses, and reporting — in English, French, and Kinyarwanda.

> **Status:** Proprietary, in-house software built for the Twisungane association's own
> operations. It is not open source and no license is granted for reuse; see
> [License](#license) below.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.4 / Java 21, Spring Security + JWT, Spring Data JPA |
| Database | PostgreSQL, Flyway migrations |
| Frontend | React 19, Vite, React Router, Axios, Recharts |
| PDF generation | OpenPDF (member statements, loan contracts, monthly/annual reports) |
| i18n | English / French / Kinyarwanda translation files |

Directory layout:

```
backend/     Spring Boot API (Maven project, com.twisungane package)
frontend/    React + Vite single-page app
Documentations/   Requirements, architecture notes, and a system audit report
DEPLOYMENT.md     Step-by-step production deployment guide (AlmaLinux VPS + Nginx)
```

## Prerequisites

- Java 21 (JDK)
- Maven 3.9+
- Node.js 20+ and npm
- PostgreSQL 14+ (local instance, or point `DB_URL` at one)

## Backend setup

```bash
cd backend
cp .env.example .env   # fill in real values, see below
```

`JWT_SECRET` and `ENCRYPTION_SECRET_KEY` have **no default value** — the application refuses
to start without them. Generate strong random values:

```bash
openssl rand -hex 32   # run twice: once for JWT_SECRET, once for ENCRYPTION_SECRET_KEY
```

Export the variables from `.env` into your shell (or use your IDE's run-configuration env
file support), create a `twisungane` PostgreSQL database, then:

```bash
mvn spring-boot:run
```

Flyway runs the migrations in `backend/src/main/resources/db/migration/` automatically on
startup, and `DataInitializer`/`SocialMemberInitializer` seed roles, permissions, and two
default accounts (`admin@twisungane.com` / `admin123` and `president@twisungane.com` /
`president123`) if the database is empty.

> **Change the default admin/president passwords immediately after first login** — they are
> seeded in plain sight in `DataInitializer.java` and are only meant to get you into the system
> once.

The API listens on `http://localhost:8080`.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` and proxies `/api/*` requests to
`http://localhost:8080` (see `vite.config.js`), so run the backend alongside it.

## Testing

**Backend** — JUnit 5 unit tests for the security/crypto primitives (`JwtUtil`, `HmacUtil`,
`EncryptionConverter`) and the proportional interest-splitting algorithm
(`ProportionalSplitter`) that the loan/interest-distribution logic depends on:

```bash
cd backend
mvn test
```

**Frontend** — Vitest + React Testing Library for shared utilities/hooks
(`i18nHelper`, `useDebounce`):

```bash
cd frontend
npm test
```

Linting (ESLint, flat config in `eslint.config.js`):

```bash
cd frontend
npm run lint
```

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: backend tests + package build,
and frontend lint + tests + build.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full production deployment runbook (AlmaLinux 9
VPS, PostgreSQL, Nginx reverse proxy, systemd service, Let's Encrypt).

## Further documentation

`Documentations/` contains the original requirements/architecture document and a system audit
report produced against an earlier snapshot of the codebase — useful background, though some
items it flagged have since been fixed (check the current code before assuming a listed issue
still applies).

## Security notes

- Secrets (`JWT_SECRET`, `ENCRYPTION_SECRET_KEY`, `DB_PASSWORD`) are read only from the
  environment — never commit a `.env` file (already covered by `.gitignore`) or put real
  values in `application.yml`.
- Member PII (name, national ID, phone) is encrypted at rest with AES-256-GCM
  (`EncryptionConverter`), with HMAC-SHA256 blind-index columns (`HmacUtil`) for lookups
  without decryption.
- If you rotate `ENCRYPTION_SECRET_KEY`, existing encrypted data becomes undecryptable —
  plan a re-encryption migration before rotating in production.

## License

Proprietary — all rights reserved. This is internal software for the Twisungane association;
it is not licensed for reuse, redistribution, or derivative works by third parties.
