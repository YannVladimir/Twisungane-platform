# TWISUNGANE SACCO — Full System Audit Report

> **Prepared:** 2026-05-26  
> **Scope:** Backend (Spring Boot), Frontend (React), Business Rules (Statutes v1.2)  
> **Status:** Pre-improvement baseline — read before any new work begins  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Rules Compliance Audit](#2-business-rules-compliance-audit)
3. [Backend Critical Bugs](#3-backend-critical-bugs)
4. [Frontend Critical Bugs](#4-frontend-critical-bugs)
5. [Security Vulnerabilities](#5-security-vulnerabilities)
6. [Missing Features (Spec vs. Implementation)](#6-missing-features-spec-vs-implementation)
7. [Data Integrity Risks](#7-data-integrity-risks)
8. [Architecture & Code Quality](#8-architecture--code-quality)
9. [Suggested Improvements (Prioritized)](#9-suggested-improvements-prioritized)
10. [Module-by-Module Status](#10-module-by-module-status)

---

## 1. Executive Summary

Twisungane is a **Rwanda-based SACCO financial management system** — Spring Boot 3.4 backend + React 19 frontend — designed to enforce the association's official statutes digitally. The system covers member management, loans, interest distribution (snapshot model), penalties, social fund payouts, annual deductions, and reporting across four roles (Admin, President, Finance, Member) in three languages (EN/FR/KY).

### Overall Health

| Dimension | Rating | Notes |
|---|---|---|
| Feature completeness | 75% | Core modules done; Settings, Account Delegation, General Assembly absent |
| Business rule compliance | 65% | Several statute rules not enforced in code |
| Data integrity | 60% | Race conditions, duplicate writes, missing constraints |
| Security | 70% | Good baseline (JWT, BCrypt, AES-256); gaps in brute-force, account lock |
| Frontend quality | 70% | Good UX; AdminSettings mocked; no error boundaries |
| Code quality | 75% | Well-structured; some hardcoded values; no tests |

### Most Critical Items Requiring Immediate Attention

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | Member exit causes double-settlement payout | CRITICAL | MemberExitService |
| 2 | Annual deductions recorded as penalties but never actually deducted | CRITICAL | AutomationScheduler |
| 3 | AdminSettings page is entirely non-functional (mock) | CRITICAL | Frontend |
| 4 | System Config API endpoint (`/api/v1/config`) does not exist | CRITICAL | Backend |
| 5 | Login brute-force: account lock field set but never activated | HIGH | AuthService / Member |
| 6 | Loan disbursal has a race condition (no pessimistic locking) | HIGH | LoanService |
| 7 | Prepayment rule (LOAN-007) not enforced | HIGH | LoanService |
| 8 | Interest distribution weight uses shares only, not shares+reserves | HIGH | InterestService |
| 9 | Guarantor not validated at loan application | HIGH | LoanService |
| 10 | Social claim approve() has no status guard (can approve twice) | HIGH | SocialFundService |

---

## 2. Business Rules Compliance Audit

This section checks every rule in the official statutes against the actual implementation.

### 2.1 Membership Rules

| Rule ID | Rule | Status | Notes |
|---|---|---|---|
| MEM-001 | National ID mandatory | ✅ Enforced | Encrypted + HMAC index |
| MEM-002 | Guarantor required | ⚠️ Partial | Stored in Member entity but not validated at loan application |
| MEM-003 | 15-day wait before loan | ✅ Enforced | `waitPeriodStart` + check in LoanService |
| MEM-004 | Special member = 6-month wait | ⚠️ Partial | SPECIAL type exists; wait period hardcoded as 15 days in code, not using 6-month path |
| MEM-005 | Entry fee: 100k share + 2k bank + 18k social | ✅ Enforced | Via config SHARE_PRICE, seeded; initial share on register |
| MEM-006 | Expulsion by General Assembly | ❌ Not implemented | No General Assembly module |
| MEM-007 | Exit requires debt clearance | ✅ Enforced | MemberExitService checks active loans + unpaid penalties |

### 2.2 Share Rules

| Rule ID | Rule | Status | Notes |
|---|---|---|---|
| SHA-001 | Share value = 100,000 FRW | ✅ Enforced | Config SHARE_PRICE |
| SHA-002 | Shares accumulate via contributions | ✅ Enforced | ShareRecord ledger |
| SHA-003 | Shares used for loan eligibility | ✅ Enforced | LoanService.checkEligibility() |
| SHA-004 | Fractional shares rounded down | ✅ Enforced | `floor()` in eligibility |
| SHA-005 | Shares locked while loan ACTIVE | ❌ Not enforced | `isLocked` field exists on Member but never set by services |

### 2.3 Loan Rules

| Rule ID | Rule | Status | Notes |
|---|---|---|---|
| LOAN-001 | 1–7.5 shares: max = 2× shares | ✅ Enforced | LoanService tier calculation |
| LOAN-002 | 8–10.5 shares: max = shares + 700,000 | ✅ Enforced | |
| LOAN-003 | 11+ shares: max = shares + 1,000,000 | ✅ Enforced | |
| LOAN-004 | Loan contract (PDF) | ✅ Enforced | PdfService generates; file upload/download |
| LOAN-005 | Max 1 active loan at a time | ✅ Enforced | Eligibility check blocks new application |
| LOAN-006 | Monthly installment repayment | ✅ Enforced | 55,000 FRW standard installment |
| LOAN-007 | Prepayment = full interest for original term | ❌ NOT ENFORCED | **Major bug** — system allows proportional split; statute requires full term interest always |
| LOAN-008 | 3+ months non-payment → General Assembly | ⚠️ Partial | AutomationScheduler detects late payments; escalation flag not implemented |
| LOAN-009 | GA escalation → deduction from shares | ❌ Not implemented | No GA module |
| LOAN-010 | Repayments signed by Treasurer | ⚠️ Partial | `recordedBy` field stored; no multi-signatory enforcement |

### 2.4 Interest Rules

| Rule ID | Rule | Status | Notes |
|---|---|---|---|
| INT-001 | 10% flat on principal | ✅ Enforced | Config LOAN_INTEREST_RATE |
| INT-002 | 55,000 FRW/month mandatory minimum | ✅ Enforced | Hardcoded in service (should be config) |
| INT-003 | Installment split: 50k principal + 5k interest | ✅ Enforced | `0.90909` multiplier |
| INT-004 | term = CEILING(principal / 50,000) | ✅ Enforced | |
| INT-005 | Snapshot-based interest distribution | ✅ Enforced | InterestSnapshot + SnapshotMember entities |
| INT-006 | Member interest dashboard: WAITING/PAID/PENDING | ⚠️ Partial | Dashboard shows data; state transitions need verification |
| INT-007 | Real-time interest dashboard update | ✅ Enforced | Recalculates on repayment record |
| INT-008 | Negative interest rule (< 45k annual = member owes difference) | ⚠️ Partial | Annual deduction scheduler exists; applied as penalty but not actual deduction from interest balance |

### 2.5 Annual Deduction Rules

| Rule ID | Deduction | Status | Notes |
|---|---|---|---|
| DED-001 | 25,000 FRW/year reserve | ⚠️ Partial | Scheduler creates ANNUAL_DEFICIT penalty record; **no actual fund movement** |
| DED-002 | 18,000 FRW/year social fund | ⚠️ Partial | Same issue |
| DED-003 | 2,000 FRW/year bank fee | ⚠️ Partial | Same issue |
| Total | 45,000 FRW applied in December | ⚠️ Partial | Scheduler runs Dec 31 at 23:00; deduction not real |

> **Critical Finding:** The entire annual deduction mechanism creates penalty records but does not move money. A real deduction should create a `Contribution` record (type: OBLIGATORY_RESERVE, SOCIAL, FRAIS_BANCAIRE) that reduces the member's interest balance. Currently it is accounting fiction.

### 2.6 Penalty Rules

| Rule ID | Rule | Status | Notes |
|---|---|---|---|
| PEN-001 | 15-day late → 2,000 FRW | ✅ Enforced | AutomationScheduler, 1 AM daily |
| PEN-002 | 30-day late → 5,000 FRW (REPLACES 15-day) | ✅ Enforced | PenaltyService replaces older penalty |
| PEN-003 | 3+ months → General Assembly | ❌ Not enforced | Detected but no escalation flag or notification |
| PEN-004 | GA authorizes share deduction | ❌ Not implemented | No GA module |

### 2.7 Social Fund Rules

| Rule ID | Event | Configured Amount | Status | Notes |
|---|---|---|---|---|
| SOC-001 | Member wedding | 50,000 FRW | ✅ Enforced | Config SOCIAL_PAYOUT_MEMBER_WEDDING |
| SOC-002 | Child wedding | 30,000 FRW | ✅ Enforced | Config SOCIAL_PAYOUT_CHILD_WEDDING |
| SOC-003 | Birth (max 2 children) | 50,000 FRW | ⚠️ Partial | Config exists; max 2 children NOT enforced in code |
| SOC-004 | Sickness/hospitalization | 50,000 FRW | ✅ Enforced | |
| SOC-005 | Member death | 150,000 FRW | ✅ Enforced | |
| SOC-006 | Close relative death | 100,000 FRW | ✅ Enforced | |

### 2.8 Configurable Settings Compliance

The spec requires **26 configurable parameters** via `SYSTEM_CONFIG` table. Current status:

| Category | Spec Keys | Seeded in DataInitializer | API Endpoint | Admin UI |
|---|---|---|---|---|
| Loan | 9 keys | ✅ Most seeded | ❌ No `/api/v1/config` endpoint | ❌ Mocked/non-functional |
| Membership | 6 keys | ⚠️ Partial | ❌ | ❌ |
| Annual Deductions | 4 keys | ⚠️ Partial | ❌ | ❌ |
| Penalties | 5 keys | ✅ | ❌ | ❌ |
| Social Fund | 7 keys | ✅ | ❌ | ❌ |
| System/Security | 4 keys | ⚠️ Partial | ❌ | ❌ |

> **Critical Finding:** The Admin Settings page and the `/api/v1/admin/config` REST API specified in the architecture document do not exist in the implementation. This means the system has no way for an admin to change any business rule through the UI. All rule changes require direct database modifications.

---

## 3. Backend Critical Bugs

### BUG-001 — Double Settlement on Member Exit [CRITICAL]

**File:** `MemberExitService.java`  
**Problem:** `approveExit()` writes a negative `ShareRecord` for settlement. Then `recordPayout()` writes another negative `ShareRecord` with the same description "EXIT SETTLEMENT". A member who exits will have their shares debited twice, effectively giving them double payout or creating a negative share balance.  
**Fix:** Write the negative share record only once — in `approveExit()`. The `recordPayout()` method should only change the exit request status to COMPLETED without touching share records.

---

### BUG-002 — Annual Deductions Are Accounting Fiction [CRITICAL]

**File:** `AutomationScheduler.java`  
**Problem:** The December 31 job creates an `ANNUAL_DEFICIT` penalty record for each member (45,000 FRW) but does not create any corresponding `Contribution` entries or reduce any balance. The penalty sits as a debt but is never connected to the interest balance reconciliation.  
**Fix:** Replace with proper contribution entries of types `OBLIGATORY_RESERVE`, `SOCIAL`, and `FRAIS_BANCAIRE`. Check if the member's accumulated interest covers 45,000 FRW and either settle from interest or flag for collection.

---

### BUG-003 — Prepayment Rule LOAN-007 Not Enforced [HIGH]

**File:** `LoanService.java` — repayment method  
**Problem:** The statute (LOAN-007) requires that if a member repays a loan early, they must still pay the full interest for the original term. The current code splits payment proportionally between principal and interest based on what remains, allowing members to avoid paying full interest on early repayment.  
**Fix:** When recording a final repayment that closes the loan, calculate `interest_still_owed = total_agreed_interest - interest_already_paid` and require that amount to be included in the final payment before marking the loan SETTLED.

---

### BUG-004 — Loan Share Lock Never Activated [HIGH]

**File:** `LoanService.java`, `MemberService.java`  
**Problem:** The `Member` entity has `isLocked` and `lockedUntil` fields. The spec (SHA-005, HCQ-008) requires shares to be locked while a loan is ACTIVE. Neither `LoanService.disburse()` nor any other method ever sets `member.isLocked = true`. Share transfers are therefore not blocked during active loans.  
**Fix:** Set `member.isLocked = true` on loan disbursement. Set `member.isLocked = false` when loan reaches SETTLED and all penalties are paid.

---

### BUG-005 — Social Claim Can Be Approved Twice [HIGH]

**File:** `SocialFundService.java` — `approveClaim()`  
**Problem:** The approve method does not check that the claim status is currently PENDING. If called twice, it overwrites `approvedBy`, `approvedAt`, and `comments` silently.  
**Fix:** Add guard: `if (claim.getStatus() != SocialClaim.Status.PENDING) throw new IllegalStateException("Claim is not in PENDING state")`.

---

### BUG-006 — Guarantor Not Validated at Loan Application [HIGH]

**File:** `LoanService.java` — `apply()`  
**Problem:** When a loan application is submitted with a `guarantorId`, the service does not validate that: (1) the guarantor exists, (2) the guarantor is ACTIVE, (3) the guarantor is not the same person as the borrower.  
**Fix:** Fetch the guarantor member, verify status = ACTIVE, verify guarantorId ≠ memberId.

---

### BUG-007 — Race Condition on Loan Disbursement [HIGH]

**File:** `LoanService.java` — `disburse()`  
**Problem:** The method checks available pool balance before disbursing but does not hold a database lock. In a scenario where two loans are approved and disbursed simultaneously, both checks pass against the same balance, overdrawing the pool.  
**Fix:** Add `@Lock(LockModeType.PESSIMISTIC_WRITE)` on the pool balance query, or use a database row lock on the relevant SystemConfig balance row before disbursement.

---

### BUG-008 — Interest Snapshot Distribution Weight Mismatch [HIGH]

**File:** `InterestService.java`  
**Problem:** The spec (INT-005, §8.4) states that interest distribution weights should be proportional to shares at snapshot time. The snapshot creation in `LoanService` captures `totalSharesAtTime + totalReserveSharesAtTime`. However, some distribution paths only use share count without adding the reserve component, creating inconsistent weighting.  
**Fix:** Consistently use `shareCountAtSnapshot + reserveWeightAtSnapshot` across all distribution calculations.

---

### BUG-009 — SPECIAL Member Wait Period Not Applied [MEDIUM]

**File:** `LoanService.java` — `checkEligibility()`  
**Problem:** Members of type SPECIAL should wait 6 months (configurable) before loan eligibility instead of 15 days. The code checks `waitPeriodStart + 15 days` for all member types including SPECIAL.  
**Fix:** Branch on `member.getType() == MemberType.SPECIAL` and apply the 6-month wait period from config `member.special_loan_wait_months`.

---

### BUG-010 — Birth Claim Max 2 Children Not Enforced [MEDIUM]

**File:** `SocialFundService.java`  
**Problem:** SOC-003 specifies a maximum of 2 birth payouts per member. When a BIRTH claim is submitted, the system does not count existing BIRTH claims for that member and block if already 2 have been approved/paid.  
**Fix:** Before approving a BIRTH claim, count `approved + paid BIRTH claims` for the member and throw if count ≥ `config.social.birth_max_children`.

---

### BUG-011 — AutomationScheduler Uses Day Count / 30 Instead of Calendar Months [MEDIUM]

**File:** `AutomationScheduler.java` — daily late payment detection  
**Problem:** Late payment detection calculates `daysSinceDisbursement / 30` to determine how many installments are due. This is imprecise — February has 28 days, some months 31. Over time, this drifts, causing false late payment flags or missed detections.  
**Fix:** Use `ChronoUnit.MONTHS.between(disbursementDate, LocalDate.now())` to count elapsed calendar months precisely.

---

### BUG-012 — Default Credentials Hardcoded [HIGH-SECURITY]

**File:** `DataInitializer.java`  
**Problem:** Default admin password `admin123` and president password `president123` are hardcoded in the initializer. Any developer or attacker who reads the source code knows the initial credentials.  
**Fix:** Read credentials from environment variables `ADMIN_INITIAL_PASSWORD` and `PRESIDENT_INITIAL_PASSWORD`. The application should refuse to start if these vars are not set in production mode.

---

### BUG-013 — Logo File Path Hardcoded to Windows User Directory [LOW]

**File:** `PdfService.java` — `LOGO_PATH` field  
**Problem:** Logo path contains a hardcoded absolute path to a Windows user's directory. This will fail on any Linux server deployment.  
**Fix:** Load the logo from `classpath:static/logo.png` using `getClass().getResourceAsStream()`.

---

## 4. Frontend Critical Bugs

### FE-001 — AdminSettings Page Is Entirely Non-Functional [CRITICAL]

**File:** `AdminSettings.jsx`  
**Problem:** The settings page fetches from `/api/v1/dashboard/stats` (wrong endpoint), displays mock values, and the Save button uses a `setTimeout` fake delay rather than a real API call. No configuration is persisted.  
**Fix:** Requires backend `/api/v1/admin/config` endpoints to be built first, then wire the page to fetch, display, and save all 26 config keys grouped by category.

---

### FE-002 — No Error Boundaries [HIGH]

**Problem:** If any page component throws an uncaught JavaScript error, the entire application goes blank with no user-visible error message or recovery option.  
**Fix:** Wrap each route's page component in a React `ErrorBoundary` that shows a friendly error screen with a refresh button.

---

### FE-003 — Calendar Timezone Parsing Issue in Dashboard [HIGH]

**File:** `Dashboard.jsx`  
**Problem:** Upcoming payment dates parsed with `new Date(dateString)` interpret UTC dates in local timezone, shifting calendar cells by ±1 day depending on the user's timezone.  
**Fix:** Parse dates as `new Date(dateString + 'T00:00:00')` or use a UTC-safe date parsing utility.

---

### FE-004 — Member Filter `ageGroup` Never Resolves [MEDIUM]

**File:** `Members.jsx`  
**Problem:** A filter for age group checks `member.isMinor` but the members API response never includes this field. The filter always shows all members regardless of selection.  
**Fix:** Either include `isMinor` in the member response DTO from the backend, or derive the field client-side from `dateOfBirth`.

---

### FE-005 — Loan Repayment Form Does Not Disable Submit on Processing [MEDIUM]

**File:** `Loans.jsx`  
**Problem:** When recording a repayment, the form shows "Processing..." text but does not disable the submit button. Double-clicking submits two identical repayment records.  
**Fix:** Set `disabled={isSubmitting}` on the submit button and `isSubmitting` state during the async call.

---

### FE-006 — Reports Page Appears to Use Mocked PDF Generation [MEDIUM]

**File:** `Reports.jsx`  
**Problem:** PDF download buttons appear to trigger local/mock operations rather than downloading PDFs from the backend reporting endpoints.  
**Fix:** Wire all PDF actions to the corresponding backend endpoints (`/api/v1/reporting/annual-audit-pdf`, etc.) and handle blob response for file download.

---

### FE-007 — Missing i18n Keys Cause Raw Key Strings Shown to Users [LOW]

**Files:** `en.json`, `fr.json`, `ky.json`  
**Missing keys found in code:**
- `common.sun`, `common.mon`, `common.tue`, `common.wed`, `common.thu`, `common.fri`, `common.sat` (calendar day names)
- `common.system_error`
- `expenditure.failed_record`
- `common.save_changes`
- Duplicate key: `admin_settings.monthly_principal_base` appears twice  
**Fix:** Add all missing keys to all three translation files.

---

### FE-008 — No Validation on Loan Application Form Amount [MEDIUM]

**File:** `Loans.jsx`  
**Problem:** The spec requires loan amounts to be multiples of 50,000 FRW. This is validated server-side, but the frontend shows a generic error message instead of a clear "Amount must be a multiple of 50,000 FRW" message. Additionally, the eligibility amount upper limit is shown but not enforced before submission.  
**Fix:** Add client-side validation: `amount % 50000 === 0` and `amount <= eligibilityLimit`.

---

## 5. Security Vulnerabilities

### SEC-001 — Account Lockout Never Activated [HIGH]

**Spec:** Security config requires account lock after 5 failed login attempts (HCQ-005, `security.max_failed_logins`).  
**Reality:** `Member.failedLoginAttempts` incremented nowhere. `Member.isLocked` set nowhere. Unlimited brute-force attempts are possible.  
**Fix:** In `AuthService.login()`, catch `BadCredentialsException`, increment `failedLoginAttempts`, and if `≥ max_failed_logins`, set `isLocked = true`. Reject login if `isLocked = true` before password check.

---

### SEC-002 — No Rate Limiting on Login Endpoint [HIGH]

**Problem:** `/api/v1/auth/login` has no rate limiting at the application layer. Combined with SEC-001, this allows unlimited password guessing without consequence.  
**Fix:** Add Spring Boot rate limiting (Bucket4j or Spring Cloud Gateway) — 5 attempts per IP per 15 minutes on auth endpoints.

---

### SEC-003 — JWT Secret Has Hardcoded Default Value [HIGH]

**File:** `application.yml`  
**Problem:** JWT secret has a non-empty hardcoded default. If the `JWT_SECRET` environment variable is not set in production, the system uses a predictable secret, allowing anyone to forge valid tokens.  
**Fix:** Remove the default value entirely. If `JWT_SECRET` is not set, throw a startup failure exception.

---

### SEC-004 — Cookie Secure Defaults to False [MEDIUM]

**File:** `application.yml`  
**Problem:** `twisungane.cookie.secure: false` is the default. JWT cookies sent over HTTP are interceptable.  
**Fix:** Default `COOKIE_SECURE=true`. Only override to false explicitly in a local dev profile (`application-dev.yml`).

---

### SEC-005 — No CORS Environment Isolation [LOW]

**Problem:** `ALLOWED_ORIGINS` is a single environment variable. The same value is likely used in dev, staging, and production, permitting dev origins to call production APIs.  
**Fix:** Use Spring profile-specific configuration files. `application-prod.yml` should have an explicit production origin whitelist.

---

### SEC-006 — File Upload Has No Server-Side Type/Size Validation [MEDIUM]

**Problem:** Contract and document uploads accept any content type and up to 20 MB. A malicious user could upload executable files or very large files.  
**Fix:** Validate MIME type on the server side (accept only PDF, JPG, PNG). Restrict contract files to ≤ 5 MB.

---

## 6. Missing Features (Spec vs. Implementation)

| Module | Feature | Spec Reference | Status |
|---|---|---|---|
| **System Config API** | `/api/v1/admin/config` CRUD endpoints | §16.5 | ❌ Not implemented |
| **Admin Settings UI** | Functional config management page | §16.4 | ❌ Non-functional stub |
| **Account Delegation** | Module 10 — manage dependent accounts | §4, Module 10 | ❌ Not implemented |
| **General Assembly Module** | GA decisions, escalation recording | §4, §7.4 | ❌ Not implemented |
| **Share Lock Enforcement** | Lock shares during active loan | SHA-005, HCQ-008 | ❌ Fields exist, never set |
| **Account Lock/Unlock** | Lock after failed logins; admin unlock | HCQ-005 | ❌ Fields exist, never set |
| **Refresh Token** | 7-day refresh token for session continuity | §10.1 | ❌ Only 24h access token |
| **Loan Contract E-Signature** | Digital signing workflow | LOAN-004 | ⚠️ Upload only, no e-sign |
| **SMS Notifications** | Loan due dates, penalties | §15.1 | ❌ Phase 2 |
| **Mobile Money Integration** | MTN MoMo, Airtel | §15.1 | ❌ Phase 2 |
| **Offline Mode** | Cached data + sync | §14.1 | ❌ Phase 2 |
| **GA Escalation Flag** | 3-month non-payment escalation | PEN-003, LOAN-008 | ❌ Detected but not flagged |
| **SPECIAL Member 6-Month Wait** | Separate wait period for special members | MEM-004 | ❌ All members use 15-day |
| **Birth Claim 2-Child Limit** | Max 2 birth payouts | SOC-003, §16.1 | ❌ Not enforced |
| **Annual Interest vs Deduction Reconciliation** | Net interest calculation + negative interest collection | INT-008, §8.5 | ⚠️ Partial — scheduler creates penalty but no real deduction |
| **Prepayment Full Interest Rule** | Full term interest on early repayment | LOAN-007, §8.3 | ❌ Not enforced |
| **OpenAPI / Swagger UI** | API documentation | §13.1 | ❌ Not present |
| **Docker / CI-CD** | Container deployment | §15.4 | ❌ Not present |

---

## 7. Data Integrity Risks

| Risk | Location | Impact | Fix |
|---|---|---|---|
| Contribution duplicate month/year | Contribution entity | Double-counting in reports | Add unique constraint on `(member_id, month, year, type)` |
| Share transfer race condition | MemberService.transferShares() | Negative balance if concurrent | Pessimistic lock on share record sum query |
| Loan disbursement race condition | LoanService.disburse() | Pool overdraft | Pessimistic lock on pool balance |
| SnapshotMember duplicates | InterestSnapshot | Wrong interest weights | Add unique constraint on `(snapshot_id, member_id)` |
| Exit settlement written twice | MemberExitService | Double payout | See BUG-001 |
| Social claim approved twice | SocialFundService | Double approval | See BUG-005 |
| Email/phone hash not re-indexed if encryption key changes | Member | Lookup failures after key rotation | Document key rotation procedure; re-hash all records on rotation |
| No `@Transactional` timeout | Long service methods | Lock held indefinitely under load | Add `timeout = 30` to all transactional service methods |

---

## 8. Architecture & Code Quality

### Strengths

- **Well-layered architecture**: Controller → Service → Repository cleanly separated
- **Field-level encryption**: AES-256-GCM via JPA converters on all PII and financial fields
- **HMAC blind indexing**: Enables database lookup on encrypted fields (nationalId, email) without decrypting
- **Audit logging**: `AuditService` with `REQUIRES_NEW` propagation ensures logs are written even if main transaction rolls back
- **Multilingual support**: 720+ keys across EN/FR/KY; context falls back to English gracefully
- **SystemConfig pattern**: Business rules loaded from database; no hardcoded amounts in most places

### Weaknesses

#### Hardcoded values that should use SystemConfig
The following values are hardcoded in service code and should instead be read from the `SystemConfig` table:

| Value | Location | Should Be Config Key |
|---|---|---|
| 55,000 FRW installment | LoanService, DashboardService | `loan.monthly_installment` |
| 50,000 FRW principal portion | LoanService | `loan.monthly_principal_payment` |
| 25,000 FRW annual reserve | InterestService | `deduction.reserve_annual_frw` |
| 45,000 FRW deduction total | ReportingService, AutomationScheduler | Derived from three deduction configs |
| 2025-01-01 cutoff for loan limits | LoanService | Remove — legacy data should be migrated |
| `0.90909` repayment ratio | LoanService | Derived from `55000/50000` ratio |
| 30-day pagination cap | DashboardService | Not configurable — acceptable |

#### No automated tests
The system has zero unit tests, integration tests, or end-to-end tests. Financial calculations (loan eligibility, interest distribution, penalty replacement) are complex enough that any refactoring carries high risk of silent regression.

#### N+1 query risk
`ReportingService.getMemberBalances()` iterates all members and for each member streams all share records. With 100 members, this is acceptable. At 500+ members and years of history, this will become very slow.

#### In-memory pagination on dashboard
`DashboardService` loads all records into memory and then paginates. For long-lived associations with thousands of transactions, this will degrade performance significantly.

---

## 9. Suggested Improvements (Prioritized)

### Priority 1 — Fix Critical Bugs (Before Any Production Use)

| # | Work Item | Estimated Effort |
|---|---|---|
| P1-1 | Fix BUG-001: Remove double share write in MemberExitService.recordPayout() | 1 hour |
| P1-2 | Fix BUG-002: Replace annual deduction penalty with real contribution + interest reconciliation | 1 day |
| P1-3 | Fix BUG-003: Enforce prepayment full-interest rule on early loan settlement | 4 hours |
| P1-4 | Fix BUG-004: Set member.isLocked on loan disburse; clear on loan SETTLED | 2 hours |
| P1-5 | Fix BUG-005: Guard approveClaim() against double-approval | 30 min |
| P1-6 | Fix BUG-006: Validate guarantor is active and not self at loan application | 1 hour |
| P1-7 | Fix SEC-001: Implement login attempt counter + account lock | 3 hours |
| P1-8 | Fix SEC-003: Remove hardcoded JWT secret default; fail on startup if not set | 30 min |
| P1-9 | Fix BUG-012: Move default credentials to environment variables | 1 hour |

### Priority 2 — Build Missing Core Features

| # | Work Item | Estimated Effort |
|---|---|---|
| P2-1 | Build `/api/v1/admin/config` CRUD API (GET all, GET one, PUT one) | 1 day |
| P2-2 | Build functional AdminSettings UI with all 26 config keys | 2 days |
| P2-3 | Apply SPECIAL member 6-month wait period in loan eligibility | 2 hours |
| P2-4 | Enforce birth claim max-2-children rule | 1 hour |
| P2-5 | Add loan disbursement pessimistic locking | 2 hours |
| P2-6 | Add contribution duplicate unique constraint | 1 hour |
| P2-7 | Add General Assembly escalation flag on 3-month non-payment | 4 hours |
| P2-8 | Fix FE-001: Wire AdminSettings to real backend | Requires P2-1 first |
| P2-9 | Fix FE-002: Add React ErrorBoundary to all page routes | 2 hours |
| P2-10 | Fix FE-003: Timezone-safe date parsing in Dashboard calendar | 1 hour |

### Priority 3 — Strengthen Security & Data Integrity

| # | Work Item | Estimated Effort |
|---|---|---|
| P3-1 | Add rate limiting to login endpoint (Bucket4j) | 4 hours |
| P3-2 | Add server-side MIME type + size validation for file uploads | 2 hours |
| P3-3 | Set COOKIE_SECURE default to true; use dev profile for false | 1 hour |
| P3-4 | Add unique DB constraint on (member_id, month, year, type) for contributions | 30 min |
| P3-5 | Add unique DB constraint on (snapshot_id, member_id) for SnapshotMember | 30 min |
| P3-6 | Add `@Transactional(timeout=30)` on all long-running service methods | 1 hour |
| P3-7 | Replace hardcoded logo path with classpath resource | 30 min |

### Priority 4 — Code Quality & Performance

| # | Work Item | Estimated Effort |
|---|---|---|
| P4-1 | Add JWT refresh token (7-day) as per spec §10.1 | 1 day |
| P4-2 | Replace in-memory pagination in DashboardService with DB-level LIMIT/OFFSET | 4 hours |
| P4-3 | Add proper Swagger/OpenAPI documentation | 1 day |
| P4-4 | Replace hardcoded financial values in services with SystemConfig lookups | 4 hours |
| P4-5 | Write integration tests for: loan eligibility, interest distribution, penalty replacement, annual deductions | 3 days |
| P4-6 | Add i18n missing keys (day names, system_error, save_changes) | 1 hour |
| P4-7 | Fix FE-005: Disable submit button during repayment processing | 30 min |
| P4-8 | Replace AutomationScheduler date math with proper calendar month calculation | 1 hour |

### Priority 5 — Phase 2 Features (Future)

| # | Work Item |
|---|---|
| P5-1 | Account Delegation module (Module 10) |
| P5-2 | General Assembly decision recording module |
| P5-3 | SMS notifications (MTN MoMo integration) |
| P5-4 | Mobile Money payment tracking |
| P5-5 | Docker + CI/CD pipeline |
| P5-6 | WCAG 2.1 AA accessibility audit |

---

## 10. Module-by-Module Status

| Module | Backend | Frontend | Business Rules | Notes |
|---|---|---|---|---|
| **Authentication** | ✅ Works | ✅ Works | ⚠️ Lock not implemented | No rate limit, no account lock |
| **Member Management** | ✅ Works | ✅ Works | ⚠️ Partial | Special member wait missing |
| **Share Management** | ✅ Works | ✅ Works | ⚠️ Lock not enforced | Share lock during loan absent |
| **Loan Management** | ✅ Works | ✅ Works | ❌ LOAN-007 broken | Prepayment rule, guarantor validation |
| **Interest Distribution** | ✅ Works | ✅ Works | ⚠️ Weight mismatch | Reserve weight inconsistent |
| **Penalty Management** | ✅ Works | ✅ Works | ✅ Compliant | Replacement logic correct |
| **Social Fund** | ✅ Works | ✅ Works | ⚠️ Partial | Birth limit not enforced |
| **Contributions** | ✅ Works | ✅ Works | ✅ Compliant | Duplicate risk without DB constraint |
| **Member Exit** | ✅ Works | ✅ Works | ⚠️ Double write | Double settlement bug |
| **Annual Deductions** | ⚠️ Partial | N/A | ❌ Not real | Deduction is fake; no fund movement |
| **Reporting** | ✅ Works | ⚠️ Partial | ✅ Compliant | PDF download mocked in frontend |
| **Audit Logs** | ✅ Works | ✅ Works | ✅ Compliant | Good coverage |
| **Group Expenses** | ✅ Works | ✅ Works | ⚠️ Partial | No approval workflow |
| **System Config API** | ❌ Missing | ❌ Mocked | ❌ Not usable | Entire admin settings absent |
| **Account Delegation** | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented | Module 10 entirely absent |
| **General Assembly** | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented | Phase 2 |

---

*Report generated: 2026-05-26 | Twisungane SACCO Digital Management System | Version 1.x (pre-production)*
