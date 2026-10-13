# TWISUNGANE — Software Requirements & Architecture Document

> **Document Version:** 1.2  
> **Date:** March 2026  
> **Classification:** Internal — Engineering Reference  
> **Source of Truth:** Official Twisungane Association Statutes (Kinyarwanda, 26 pages)  
> **Prepared By:** AI Senior Software Architect Analysis  
> **Last Updated:** All HCQ items resolved, multilingual support (EN/RW/FR) added, fully configurable system settings module added, hardcoded values replaced with admin-configurable parameters.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Business Rules](#2-business-rules)
3. [Actors & Permissions Matrix](#3-actors--permissions-matrix)
4. [Functional Modules](#4-functional-modules)
5. [Loan Workflow](#5-loan-workflow)
6. [Contribution Workflow](#6-contribution-workflow)
7. [Approval Workflow](#7-approval-workflow)
8. [Financial Calculation Rules](#8-financial-calculation-rules)
9. [Database Conceptual Model](#9-database-conceptual-model)
10. [Security Architecture](#10-security-architecture)
11. [Encryption Strategy](#11-encryption-strategy)
12. [Audit & Compliance Model](#12-audit--compliance-model)
13. [API Architecture Proposal](#13-api-architecture-proposal)
14. [Mobile-First UX Recommendations](#14-mobile-first-ux-recommendations)
15. [Future Scalability Suggestions](#15-future-scalability-suggestions)

---

## 1. System Overview

### 1.1 Organization Description

**TWISUNGANE** is a legally registered financial mutual aid association (itorero/urufatanye rw'ingengo y'imari) in Rwanda. It operates as a **rotating savings and credit association (ROSCA)** variant, closer to a **SACCO (Savings and Credit Cooperative Organization)** in functional terms.

Members pool financial resources, lend to each other, and manage social protection funds collectively. The association is governed by elected committees and operates under formal written statutes.

### 1.2 System Purpose

The TWISUNGANE Digital Management System (TDMS) is a **secure, multi-user, mobile-first web application** designed to digitize all financial, administrative, and governance operations of the association, replacing manual bookkeeping and paper-based workflows.

### 1.3 System Goals

| Goal                         | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| **Digitize Contributions**   | Replace manual collection with digital payment tracking           |
| **Automate Loan Management** | Track eligibility, disbursement, repayment, and penalties         |
| **Enforce Business Rules**   | Apply financial rules automatically (interest, penalties, limits) |
| **Role-Based Access**        | Enforce strict permission boundaries between roles                |
| **Ensure Auditability**      | Every financial action must be permanently traceable              |
| **Social Fund Management**   | Track social events and corresponding payouts                     |
| **Generate Reports**         | Monthly financial reports by the 10th of each month               |

### 1.4 Technology Stack

| Layer               | Technology                                                          |
| ------------------- | ------------------------------------------------------------------- |
| **Backend**         | Java 17+ / Spring Boot 3.x                                          |
| **Frontend**        | React 18+ (Mobile-first)                                            |
| **Database**        | PostgreSQL 15+                                                      |
| **Auth**            | Spring Security + JWT                                               |
| **Encryption**      | AES-256-GCM (field-level), BCrypt (passwords)                       |
| **API Style**       | RESTful API with OpenAPI 3.0 documentation                          |
| **Internalization** | i18n: English (EN), Kinyarwanda (RW), French (FR) — user-selectable |
| **Hosting**         | Cloud-ready (Docker/Kubernetes compatible)                          |

### 1.5 Multilingual Requirements

The system must fully support **three languages** switchable by each user at login or from their profile:

| Language    | Code | Notes                                            |
| ----------- | ---- | ------------------------------------------------ |
| English     | `en` | Default / fallback language                      |
| Kinyarwanda | `rw` | Primary language for most members                |
| French      | `fr` | Required for formal documents and educated users |

**Implementation Requirements:**

- All UI labels, messages, error texts, tooltips, and button text must be externalized into translation files (JSON format)
- **Loan contracts and official documents (PDF)** must be generated in the user's selected language
- **Notification messages** (SMS, email) must be sent in the member's preferred language
- The backend must accept a `Accept-Language` header and return translated content where applicable
- Default language = English if no preference is set
- Administrator can set a **system-wide default language** in System Configuration
- Translation files structure: `i18n/en.json`, `i18n/rw.json`, `i18n/fr.json`
- A missing translation falls back to English, never shows a key string to the user

**Frontend Implementation (React):**

```
Library: react-i18next (standard i18n library for React)
Language stored in: user profile (database) + localStorage for unauthenticated screens
Language switcher: visible in navbar and on login page
```

**Backend Implementation (Spring Boot):**

```
Library: Spring MessageSource with ResourceBundleMessageSource
Files: messages_en.properties, messages_rw.properties, messages_fr.properties
All error messages and notification templates stored in these files
```

---

## 2. Business Rules

> **IMPORTANT:** All rules below are extracted directly from the official Twisungane statutes document and subsequent confirmed business decisions. This document is the single source of truth for the system implementation.

### 2.1 Membership Rules

| Rule ID | Rule Description                                                                                                                                                                   | Source            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| MEM-001 | Every member must possess a valid national ID (Indangamuntu)                                                                                                                       | Statutes Art. 3   |
| MEM-002 | Every member must nominate a guarantor/substitute (umusimbura) who also holds a national ID                                                                                        | Statutes Art. 3   |
| MEM-003 | A new member's shares must be in the association account for **15 days** (configurable) before they can request a loan — this waiting period is a system config                    | Statutes          |
| MEM-004 | A **special member** (requiring 6-month wait) is defined as: a **new member who does NOT have an existing family member already in the group**. The 6-month period is configurable | Statutes addendum |
| MEM-005 | Membership requires payment of: **100,000 FRW** (share capital, configurable) + **2,000 FRW** (annual bank fee, configurable) + **18,000 FRW** (social fund, configurable)         | Statutes          |
| MEM-006 | A member may be expelled by decision of the General Assembly for breach of rules or non-payment                                                                                    | Statutes          |
| MEM-007 | Exiting members follow a formal financial settlement procedure — all debts must be cleared before exit                                                                             | Statutes          |

### 2.2 Share Rules

| Rule ID | Rule Description                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| SHA-001 | Each share has a value of **100,000 FRW**                                                                   |
| SHA-002 | Members accumulate shares over time through contributions                                                   |
| SHA-003 | Shares are used as the basis for loan eligibility calculation                                               |
| SHA-004 | When calculating loan limits, **fractional shares are rounded down** (e.g., 7.5 shares → 7 for calculation) |
| SHA-005 | Shares remain locked while a loan is active `[REQUIRES HUMAN CONFIRMATION — exact lock mechanic]`           |

### 2.3 Loan Rules

| Rule ID  | Rule Description                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| LOAN-001 | Members with **1 to 7.5 shares**: Maximum loan = **Total Shares × 2**                                                                   |
| LOAN-002 | Members with **8 to 10.5 shares**: Maximum loan = **Total Shares + 700,000 FRW**                                                        |
| LOAN-003 | Members with **11+ shares**: Maximum loan = **Total Shares + 1,000,000 FRW**                                                            |
| LOAN-004 | Loans must be backed by a formal written **loan contract**                                                                              |
| LOAN-005 | A member cannot exceed one active loan at a time `[REQUIRES HUMAN CONFIRMATION]`                                                        |
| LOAN-006 | Loan repayment is done in **monthly installments**                                                                                      |
| LOAN-007 | **Prepayment Rule**: If a loan is repaid before its term ends, the member MUST still pay the full agreed interest for the original term |
| LOAN-008 | After **3 months of non-payment**, the case is escalated to the General Assembly                                                        |
| LOAN-009 | After General Assembly escalation, debt may be deducted directly from the member's shares/reserves                                      |
| LOAN-010 | All loan disbursements and repayments are recorded and signed by the Treasurer                                                          |

### 2.4 Interest Rules

| Rule ID | Rule Description                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-001 | Interest is calculated as a **flat 10% on the total principal** of the loan                                                                                                                                |
| INT-002 | **Fixed monthly installment**: Every borrower pays **55,000 FRW/month** regardless of loan amount — this is mandatory. The borrower may pay more, but never less than 55,000 FRW                           |
| INT-003 | Each 55,000 FRW monthly installment is split as: **50,000 FRW principal** + **5,000 FRW interest**                                                                                                         |
| INT-004 | **Repayment term is determined by amount borrowed**: term_months = principal ÷ 50,000 (rounded up)                                                                                                         |
| INT-005 | **Interest earned is distributed to shares that were active at the exact moment each loan was disbursed** (snapshot model). Members who join after a loan was given do NOT receive interest from that loan |
| INT-006 | Each member can view their interest dashboard: interest **waiting** (from active loans), interest **already paid**, and interest **pending payment**                                                       |
| INT-007 | Interest dashboard updates in **real-time** as loan repayments are recorded                                                                                                                                |
| INT-008 | **Negative Interest Rule**: If a member's total interest earned in a year is less than 45,000 FRW (annual deductions), they must pay the **difference** to the association                                 |

### 2.5 Annual Deduction Rules

| Rule ID   | Deduction                             | Amount              |
| --------- | ------------------------------------- | ------------------- |
| DED-001   | Mandatory Reserve (uruhare w'imbumbe) | **25,000 FRW/year** |
| DED-002   | Social Fund                           | **18,000 FRW/year** |
| DED-003   | Annual Bank Fees                      | **2,000 FRW/year**  |
| **TOTAL** | **Annual deduction per member**       | **45,000 FRW/year** |

- These deductions are applied in **December** each year.
- They are deducted from the member's accumulated interest balance.

### 2.6 Penalty Rules

| Rule ID | Condition                                                                                                                   | Penalty                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| PEN-001 | Loan repayment **15 days late** (configurable threshold)                                                                    | **2,000 FRW fine** (configurable) |
| PEN-002 | Loan repayment **30 days late** (configurable threshold) — the 30-day penalty **REPLACES** (not adds to) the 15-day penalty | **5,000 FRW fine** (configurable) |
| PEN-003 | Non-payment for **3+ months** (configurable)                                                                                | Case sent to General Assembly     |
| PEN-004 | General Assembly can authorize deduction of debt from member's shares                                                       | Compulsory settlement             |

> **Penalty Replacement Rule:** If a repayment is 30 days late, the system removes the 2,000 FRW penalty (if applied) and replaces it with the 5,000 FRW penalty. The member is never charged both simultaneously.

### 2.7 Social Fund Rules

| Rule ID | Event                                                           | Payout (all configurable)                          |
| ------- | --------------------------------------------------------------- | -------------------------------------------------- |
| SOC-001 | Member's wedding                                                | **50,000 FRW**                                     |
| SOC-002 | Member's child's wedding                                        | **30,000 FRW**                                     |
| SOC-003 | Birth of child (max 2 children)                                 | **50,000 FRW per child**                           |
| SOC-004 | Member hospitalized / sick                                      | **50,000 FRW**                                     |
| SOC-005 | Death of member                                                 | **150,000 FRW** (100k burial + 50k family support) |
| SOC-006 | Death of member's **close relative** (spouse, parent, or child) | **100,000 FRW** (50k burial + 50k support)         |

> **Close Relative Definition (HCQ-011 confirmed):** Spouse, parent, or child of the member only (first-degree kin).

> **No maximum claims** per year (HCQ-010 confirmed). All social fund payouts require documented proof and President approval.

> **All payout amounts are configurable** by the Administrator in System Settings — no amounts are hardcoded.

### 2.8 Reporting Rules

| Rule ID | Rule                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------- |
| REP-001 | The Treasurer must publish a **monthly financial status report by the 10th** of each month      |
| REP-002 | Reports must include: member balances, loans outstanding, interest accrued, penalties collected |
| REP-003 | An **annual audit** is conducted by the Audit Committee                                         |
| REP-004 | Association documents must be preserved permanently or for a defined legal retention period     |

### 2.9 Bank Account Rules

| Rule ID | Rule                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BNK-001 | All association funds are stored in a bank account                                                                                                              |
| BNK-002 | Withdrawals require **multiple authorized signatories** — this process happens **outside the system** at the physical bank                                      |
| BNK-003 | In the system, authorized users can **record a digital confirmation** that they signed off on a withdrawal, creating an audit trail                             |
| BNK-004 | The system stores the disbursement record, amount, date, and list of confirmed signatories for auditability — but does not interface with the bank API directly |

---

## 3. Actors & Permissions Matrix

### 3.1 Role Definitions

| Role          | System Name      | Real-world Equivalent       |
| ------------- | ---------------- | --------------------------- |
| Standard User | `ROLE_MEMBER`    | Regular association member  |
| Finance User  | `ROLE_FINANCE`   | Treasurer / finance officer |
| President     | `ROLE_PRESIDENT` | Association president       |
| Administrator | `ROLE_ADMIN`     | System administrator        |

### 3.2 Full Permissions Matrix

| Permission / Feature                   | MEMBER | FINANCE | PRESIDENT | ADMIN |
| -------------------------------------- | :----: | :-----: | :-------: | :---: |
| **MEMBERSHIP**                         |        |         |           |       |
| View own profile                       |   ✅   |   ✅    |    ✅     |  ✅   |
| Edit own profile                       |   ✅   |   ✅    |    ✅     |  ❌   |
| View all members                       |   ❌   |   ✅    |    ✅     |  ✅   |
| Create new member                      |   ❌   |   ❌    |    ❌     |  ✅   |
| Assign roles                           |   ❌   |   ❌    |    ❌     |  ✅   |
| Deactivate member                      |   ❌   |   ❌    |    ✅     |  ✅   |
| **CONTRIBUTIONS**                      |        |         |           |       |
| View own contributions                 |   ✅   |   ✅    |    ✅     |  ✅   |
| Register contribution                  |   ❌   |   ✅    |    ❌     |  ❌   |
| View all contributions                 |   ❌   |   ✅    |    ✅     |  ✅   |
| **LOANS**                              |        |         |           |       |
| Request loan                           |   ✅   |   ❌    |    ❌     |  ❌   |
| View own loan status                   |   ✅   |   ✅    |    ✅     |  ✅   |
| View all loans                         |   ❌   |   ✅    |    ✅     |  ✅   |
| Approve / reject loan                  |   ❌   |   ❌    |    ✅     |  ❌   |
| Record loan disbursement               |   ❌   |   ✅    |    ❌     |  ❌   |
| Record repayment                       |   ❌   |   ✅    |    ❌     |  ❌   |
| **PENALTIES**                          |        |         |           |       |
| View own penalties                     |   ✅   |   ✅    |    ✅     |  ✅   |
| Apply penalty                          |   ❌   |   ✅    |    ❌     |  ❌   |
| Waive penalty                          |   ❌   |   ❌    |    ✅     |  ❌   |
| **SOCIAL FUND**                        |        |         |           |       |
| Submit social event claim              |   ✅   |   ✅    |    ❌     |  ❌   |
| Approve social payout                  |   ❌   |   ❌    |    ✅     |  ❌   |
| Record social payout                   |   ❌   |   ✅    |    ❌     |  ❌   |
| **GUARANTOR (UMWISHINGIZI)**           |        |         |           |       |
| View active loans of guarantied member |   ✅   |   ✅    |    ✅     |  ✅   |
| **ACCOUNT DELEGATION**                 |        |         |           |       |
| Request to manage dependent account    |   ✅   |   ✅    |    ✅     |  ✅   |
| Approve delegation request             |   ❌   |   ❌    |    ❌     |  ✅   |
| Switch between managed accounts        |   ✅   |   ✅    |    ✅     |  ✅   |
| **REPORTS**                            |        |         |           |       |
| View own reports                       |   ✅   |   ✅    |    ✅     |  ✅   |
| Generate all-member reports            |   ❌   |   ✅    |    ✅     |  ✅   |
| Export financial reports               |   ❌   |   ✅    |    ✅     |  ❌   |
| **AUDIT LOGS**                         |        |         |           |       |
| View own audit trail                   |   ✅   |   ✅    |    ✅     |  ✅   |
| View all audit logs                    |   ❌   |   ❌    |    ✅     |  ✅   |
| **SYSTEM CONFIG**                      |        |         |           |       |
| Configure system settings              |   ❌   |   ❌    |    ❌     |  ✅   |
| Edit encrypted financial records       |   ❌   |   ❌    |    ❌     |  ❌   |

> **Security Rule:** No role — including Administrator — can directly edit encrypted financial records. Financial data mutations follow strict workflow-based approvals.

### 3.3 Permission Model: Hybrid Role + Individual Permissions

The system uses a **hybrid permission model** combining role-based defaults with individual permission overrides:

| Level                     | Description                                                | Example                                                    |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| **Role Permission**       | Default permissions granted to all members of a role       | ROLE_FINANCE can record contributions                      |
| **Individual Permission** | A specific permission granted or revoked for a single user | A specific MEMBER granted `SOCIAL_CLAIM_SUBMIT_FOR_OTHERS` |
| **Permission Override**   | Individual permission trumps role default                  | Admin assigns `LOAN_VIEW_ALL` to a specific MEMBER         |

**Implementation:**

```
PERMISSION
  - id (UUID, PK)
  - permission_code (VARCHAR, UNIQUE)  -- e.g. LOAN_APPROVE, SOCIAL_CLAIM_SUBMIT
  - description

ROLE_PERMISSION (Role default permissions)
  - role_id (FK → USER_ROLE)
  - permission_id (FK → PERMISSION)

USER_PERMISSION (Individual overrides)
  - user_id (FK → MEMBER)
  - permission_id (FK → PERMISSION)
  - granted (BOOLEAN)  -- true = grant extra, false = revoke default
  - granted_by (FK → MEMBER — Admin)
  - granted_at
```

**Authorization Check Logic (Spring Security):**

```java
// Check order: individual grant → role default → deny
boolean hasPermission(user, permissionCode) {
    UserPermission override = userPermissionRepo.find(user, permissionCode);
    if (override != null) return override.isGranted();
    return rolePermissionRepo.existsByRoleAndPermission(user.getRole(), permissionCode);
}
```

---

## 4. Functional Modules

### Module 1: Member Management (`members`)

- Member registration (with ID validation and guarantor)
- Member profile with photo, contacts, ID number
- Member status lifecycle: ACTIVE → SUSPENDED → EXPELLED / EXITED
- Member wait-period tracking (15 days / 6 months loan eligibility lock)
- Guarantor (umwishingizi) relationship management
- **Guarantor dashboard**: A member who is a guarantor can view all active loans for which they are listed as umwishingizi

### Module 2: Share & Contribution Management (`shares`)

- Track share count per member
- Record monthly/annual contributions
- Share purchase transactions (initial 100,000 FRW + subsequent)
- Share balance calculation engine
- Annual deduction processing (December cycle: 45,000 FRW)

### Module 3: Loan Management (`loans`)

- Loan eligibility calculation based on share brackets
- Loan request submission workflow
- Loan contract generation (PDF)
- Disbursement recording
- Repayment schedule auto-generation: term = CEILING(principal ÷ `cfg.monthly_principal_payment`) months, installment = `cfg.monthly_principal_payment + cfg.monthly_interest_amount` (from system config)
- **Shares are locked** (cannot be transferred or sold) while loan is ACTIVE or any repayment is PENDING
- Repayment tracking (installments)
- Prepayment handling with full interest enforcement
- Only **one active loan per member** at a time — new request blocked until existing loan is fully SETTLED
- Loan status: REQUESTED → APPROVED/REJECTED → ACTIVE → SETTLED / DEFAULTED

### Module 4: Interest Management (`interest`)

- Monthly interest calculation per loan (10% flat on principal, 5,000 FRW/month per loan)
- **Snapshot-based interest distribution**: at the moment of each loan disbursement, record which members had active shares — only those members receive interest from that specific loan
- Real-time **Interest Dashboard per member**: shows interest in WAITING, PAID, and NOT YET PAID states, updating live as repayments are recorded
- Year-end interest vs. deduction balance calculation
- Negative interest detection and collection trigger

### Module 5: Penalty Management (`penalties`)

- Automated penalty detection (15-day, 30-day triggers)
- Penalty registration
- Penalty waiver workflow (President approval)
- Non-payment escalation (3-month threshold → General Assembly flag)

### Module 6: Social Fund Management (`social-fund`)

- Social event claim submission with document proof — accessible by **both MEMBER and FINANCE roles**
- Finance can submit a claim on behalf of a member (e.g., for members who cannot use the system)
- Event type and payout amount lookup (static configuration)
- Payout approval workflow (President)
- Social fund balance tracking

### Module 7: Reporting & Analytics (`reports`)

- Monthly member balance reports
- Monthly outstanding loans report
- Interest accrual report
- Annual financial summary
- Individual member statement
- Report generation by 10th of month (auto scheduler)

### Module 8: Audit & Compliance (`audit`)

- Immutable audit log of every system action
- Action types: CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, EXPORT, SWITCH_ACCOUNT
- Actor, timestamp, IP address, affected entity recorded per event
- Annual audit committee report generator

### Module 9: System Administration (`admin`)

- User account creation and deactivation
- Role assignment and individual permission management
- System configuration (interest rates, penalty thresholds, payout amounts)
- Backup and data export tools
- Account delegation approval (admin approves delegated account requests)

### Module 10: Account Delegation (`account-delegation`)

- A member can **request to manage one or more dependent accounts** (e.g., minor children, elderly members, or members unfamiliar with technology)
- Once approved by Admin, the managing member can **switch between accounts** in a single login session using an account switcher
- All actions performed while switched to a managed account are logged under the **acting member's ID** with the **target account ID** noted
- Delegated access does NOT grant new permissions — the delegated member can only perform actions the target account is itself allowed to do
- Admin can revoke delegation at any time

---

## 5. Loan Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOAN WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────┘

[MEMBER] → Submits Loan Request
    │
    ▼
System validates eligibility:
  ✓ Member status = ACTIVE
  ✓ Shares in account ≥ 15 days (or 6 months for special members)
  ✓ No active existing loan
  ✓ No unpaid penalties
  ✓ Requested amount ≤ calculated limit
    │
    ├─[FAILED]→ Loan request rejected automatically, member notified
    │
    ▼
[FINANCE USER] → Reviews request details, prepares loan contract
    │
    ▼
[PRESIDENT] → Reviews and Approves or Rejects
    │
    ├─[REJECTED]→ Member notified with rejection reason
    │
    ▼
[FINANCE USER] → Records Disbursement (actual money sent)
    │
    ▼
System generates:
  • Repayment schedule (monthly installments)
  • Interest pre-calculation for full term
  • Loan contract PDF
    │
    ▼
Loan status: ACTIVE
    │
    ▼ (During loan lifecycle)
[FINANCE USER] → Records each monthly repayment
System checks:
  ✓ Payment date vs. due date
  ✓ If 15 days late → apply 2,000 FRW penalty
  ✓ If 30 days late → apply 5,000 FRW penalty
  ✓ If 3 months missed → flag for General Assembly
    │
    ▼
[When fully repaid]
  Loan status: SETTLED
  • Confirm all interest collected (including prepayment rule)
  • Release share lock (if applicable)
  • Update member interest file
```

### 5.1 Loan Eligibility Calculation Logic

```
INPUT:  member.totalShares (rounded down for fractional)
        share_value = 100,000 FRW

CALCULATION:
  IF shares >= 1 AND shares <= 7:
    max_loan = shares * 100,000 * 2

  ELSE IF shares >= 8 AND shares <= 10:
    max_loan = (shares * 100,000) + 700,000

  ELSE IF shares >= 11:
    max_loan = (shares * 100,000) + 1,000,000

OUTPUT: max_loan (FRW)
```

---

## 6. Contribution Workflow

```
[MEMBER] → Pays contribution (physically or via mobile money)
    │
    ▼
[FINANCE USER] → Logs contribution in system
    • Member ID
    • Amount
    • Date
    • Type: SHARE_PURCHASE | ANNUAL_BANK_FEE | SOCIAL_FUND | RESERVE
    • Reference number
    │
    ▼
System:
  • Updates member's share balance
  • Marks contribution as RECORDED
  • Generates receipt
    │
    ▼
Monthly (December):
  System runs annual deduction cycle:
  • Deduct 25,000 FRW → Mandatory Reserve
  • Deduct 18,000 FRW → Social Fund
  • Deduct 2,000 FRW → Bank Fees
  • Calculate interest balance vs. total deductions
  • If interest < 45,000 FRW → flag member for NEGATIVE INTEREST payment
```

---

## 7. Approval Workflow

### 7.1 Loan Approval

```
State Machine: PENDING_REVIEW → APPROVED | REJECTED
Approver: ROLE_PRESIDENT
Notifications:
  • Finance User notified when loan reaches review stage
  • Member notified on approval or rejection
  • All approval actions recorded in audit log
```

### 7.2 Social Fund Payout Approval

```
State Machine: CLAIM_SUBMITTED → CLAIM_APPROVED | CLAIM_REJECTED → PAYOUT_PROCESSED
Approver: ROLE_PRESIDENT
Supporting document required at submission
```

### 7.3 Penalty Waiver Approval

```
State Machine: PENALTY_ACTIVE → WAIVER_REQUESTED → WAIVER_APPROVED | WAIVER_REJECTED
Approver: ROLE_PRESIDENT
Finance User cannot independently waive penalties
```

### 7.4 Debt-to-Share Deduction (General Assembly Escalation)

```
[3+ months non-payment detected by system]
    ↓
[PRESIDENT / System] generates General Assembly escalation flag
    ↓
[Manual General Assembly decision recorded by ADMIN]
    ↓
[FINANCE USER] executes approved deduction from member shares
    ↓
Audit log records deduction with GA decision reference
```

---

## 8. Financial Calculation Rules

### 8.1 Loan Limit Formula

| Share Range   | Formula                        | Example (8 shares)                       |
| ------------- | ------------------------------ | ---------------------------------------- |
| 1 – 7 shares  | shares × 200,000               | 7 × 200,000 = **1,400,000 FRW**          |
| 8 – 10 shares | (shares × 100,000) + 700,000   | (8 × 100k) + 700k = **1,500,000 FRW**    |
| 11+ shares    | (shares × 100,000) + 1,000,000 | (11 × 100k) + 1,000k = **2,100,000 FRW** |

> Note: Fractional shares are **always rounded down** before calculation.

### 8.2 Interest Calculation — CONFIRMED MODEL

```
Interest Model: 10% FLAT rate on principal (NOT reducing balance)
Fixed Monthly Installment: 55,000 FRW (mandatory minimum)
Installment breakdown:
  - 50,000 FRW → principal repayment
  - 5,000 FRW  → interest payment

Repayment term formula:
  term_months = CEILING(principal / 50,000)

Total interest:
  total_interest = principal × 10%

Total repayment:
  total_repayment = principal + total_interest
  total_repayment = term_months × 55,000
```

**Worked Examples:**

| Amount Borrowed | Term (months) | Monthly Payment | Total Interest | Total Repayment |
| --------------- | :-----------: | :-------------: | :------------: | :-------------: |
| 100,000 FRW     |       2       |   55,000 FRW    |   10,000 FRW   |   110,000 FRW   |
| 200,000 FRW     |       4       |   55,000 FRW    |   20,000 FRW   |   220,000 FRW   |
| 300,000 FRW     |       6       |   55,000 FRW    |   30,000 FRW   |   330,000 FRW   |
| 500,000 FRW     |      10       |   55,000 FRW    |   50,000 FRW   |   550,000 FRW   |
| 1,000,000 FRW   |      20       |   55,000 FRW    |  100,000 FRW   |  1,100,000 FRW  |

> **Implementation Note:** A borrower may pay **more than 55,000 FRW** in any month, but the system must still record the mandatory 5,000 FRW interest component separately. Extra payments reduce the remaining principal, shortening the remaining term, but the full interest for the original term is still owed (see prepayment rule §8.3).

### 8.3 Prepayment Interest Rule

If a member repays early (e.g., pays off in month 3 of 6-month loan):

- System must still collect **all 6 months of interest**
- No interest rebate is given for early repayment

```java
// Pseudo-logic
if (earlyRepayment) {
    interest_owed = total_agreed_interest - interest_already_paid;
    final_payment = remaining_principal + interest_owed;
}
```

### 8.4 Interest Distribution to Members — SNAPSHOT MODEL

```
RULE: Interest from a loan is distributed ONLY to members who had active shares
at the EXACT MOMENT the loan was disbursed (disbursement date snapshot).

Distribution Logic (per loan disbursement):
  1. At loan disbursement time:
     - Record active_shares_snapshot: {member_id → share_count} for all ACTIVE members
     - total_snapshot_shares = SUM(share_count) across snapshot

  2. Each month when a repayment of 55,000 FRW is recorded:
     - interest_collected = 5,000 FRW
     - For each member in snapshot:
         member_interest = (member.snapshot_share_count / total_snapshot_shares) × 5,000
         → credit to member's LOAN_INTEREST_ENTRY (status = WAITING)

  3. When loan is fully SETTLED:
     - All WAITING entries for this loan → status = PAID

  4. If loan goes to DEFAULT:
     - Outstanding entries flagged accordingly

Member Interest Dashboard (real-time, per member):
  • WAITING    — interest accrued but not yet paid (loan still active)
  • PAID       — interest received (repayment collected)
  • UNPAID     — interest entries where repayment is overdue/missed

Members who join AFTER a loan is disbursed:
  → They are NOT in the snapshot for that loan
  → They receive 0 interest from that loan
  → They join the snapshot of all FUTURE loans disbursed after their join date
```

### 8.5 Annual Deduction Calculation

```
Year-end (December):
  total_deductions = 25,000 + 18,000 + 2,000 = 45,000 FRW

  IF member.annual_interest_earned >= 45,000:
    net = member.annual_interest_earned - 45,000  [credit]

  ELSE:
    deficit = 45,000 - member.annual_interest_earned  [member owes this amount]
    status = NEGATIVE_INTEREST → requires collection
```

### 8.6 Penalty Calculation

```
IF days_since_due >= 15 AND days_since_due < 30:
    penalty = 2,000 FRW

IF days_since_due >= 30:
    penalty = 5,000 FRW
    [Decision: The 30-day penalty REPLACES the 15-day penalty; member never pays both simultaneously]

IF months_missed >= 3:
    flag = GENERAL_ASSEMBLY_ESCALATION
```

---

## 9. Database Conceptual Model

### 9.1 Core Entities (ERD Summary)

```
MEMBER
  - id (UUID, PK)
  - national_id (encrypted)
  - first_name
  - last_name
  - phone (encrypted)
  - email (encrypted)
  - status [ACTIVE, SUSPENDED, EXPELLED, EXITED]
  - member_type [STANDARD, SPECIAL]  -- special: 6-month wait
  - join_date
  - guarantor_id (FK → MEMBER)         -- umwishingizi
  - role_id (FK → USER_ROLE)
  - date_of_birth (DATE, nullable)       -- relevant for minor dependents
  - is_minor (BOOLEAN default false)
  - created_at, updated_at

USER_ROLE
  - id
  - name [ROLE_MEMBER, ROLE_FINANCE, ROLE_PRESIDENT, ROLE_ADMIN]

PERMISSION
  - id (UUID, PK)
  - permission_code (VARCHAR UNIQUE)   -- e.g. LOAN_APPROVE, SOCIAL_CLAIM_SUBMIT
  - description

ROLE_PERMISSION  (role default permissions)
  - role_id (FK → USER_ROLE)
  - permission_id (FK → PERMISSION)

USER_PERMISSION  (individual overrides)
  - id (UUID, PK)
  - user_id (FK → MEMBER)
  - permission_id (FK → PERMISSION)
  - granted (BOOLEAN)                  -- true=extra grant, false=revoke default
  - granted_by (FK → MEMBER)
  - granted_at

ACCOUNT_DELEGATION
  - id (UUID, PK)
  - manager_member_id (FK → MEMBER)    -- person who manages the account
  - target_member_id (FK → MEMBER)     -- account being managed (e.g. child)
  - relationship [PARENT, GUARDIAN, OTHER]
  - status [PENDING, ACTIVE, REVOKED]
  - approved_by (FK → MEMBER — Admin, nullable)
  - approved_at (nullable)
  - created_at

SHARE_ACCOUNT
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - total_shares (DECIMAL)  -- accumulated
  - share_value (DECIMAL default 100,000)
  - last_updated

CONTRIBUTION
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - amount (encrypted DECIMAL)
  - type [SHARE_PURCHASE, BANK_FEE, SOCIAL_FUND, RESERVE, PENALTY]
  - payment_date
  - recorded_by (FK → MEMBER — finance user)
  - reference_number
  - receipt_number
  - created_at

LOAN
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - requested_amount (encrypted DECIMAL)
  - approved_amount (encrypted DECIMAL)
  - interest_rate (DECIMAL)
  - term_months (INT)
  - start_date
  - expected_end_date
  - total_interest (encrypted DECIMAL)
  - status [REQUESTED, APPROVED, REJECTED, ACTIVE, SETTLED, DEFAULTED]
  - approved_by (FK → MEMBER — president)
  - approved_at
  - disbursed_by (FK → MEMBER — finance)
  - disbursed_at
  - contract_ref
  - created_at

LOAN_REPAYMENT
  - id (UUID, PK)
  - loan_id (FK → LOAN)
  - installment_number (INT)
  - due_date (DATE)
  - paid_date (DATE, nullable)
  - amount_due (encrypted DECIMAL)
  - amount_paid (encrypted DECIMAL)
  - principal_portion (encrypted DECIMAL)
  - interest_portion (encrypted DECIMAL)
  - status [PENDING, PAID, LATE, MISSED]
  - recorded_by (FK → MEMBER)

PENALTY
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - loan_repayment_id (FK → LOAN_REPAYMENT)
  - penalty_type [LATE_15D, LATE_30D, ESCALATED]
  - amount (encrypted DECIMAL)
  - status [ACTIVE, PAID, WAIVED]
  - waived_by (FK → MEMBER, nullable)
  - waived_at (nullable)
  - created_at

LOAN_SHARE_SNAPSHOT  (members eligible for a specific loan's interest)
  - id (UUID, PK)
  - loan_id (FK → LOAN)
  - member_id (FK → MEMBER)
  - share_count_at_snapshot (DECIMAL)   -- shares at time of loan disbursement
  - snapshot_date (DATE)

LOAN_INTEREST_ENTRY  (per-member, per-loan interest tracking)
  - id (UUID, PK)
  - loan_id (FK → LOAN)
  - member_id (FK → MEMBER)
  - loan_repayment_id (FK → LOAN_REPAYMENT, nullable)  -- which installment created this
  - amount_credited (encrypted DECIMAL)  -- member's share of 5,000 FRW
  - status [WAITING, PAID, UNPAID]       -- WAITING=loan active, PAID=collected, UNPAID=missed
  - credited_month (DATE)                -- month this entry relates to
  - settled_at (nullable)
  - created_at

INTEREST_FILE  (annual summary per member — kept for yearly totals)
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - year (INT)
  - month (INT)
  - interest_credited (encrypted DECIMAL)  -- sum of LOAN_INTEREST_ENTRYs this month
  - created_at

ANNUAL_DEDUCTION
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - year (INT)
  - reserve_deducted (encrypted DECIMAL)
  - social_fund_deducted (encrypted DECIMAL)
  - bank_fee_deducted (encrypted DECIMAL)
  - total_deducted (encrypted DECIMAL)
  - interest_earned (encrypted DECIMAL)
  - net_balance (encrypted DECIMAL)
  - status [BALANCED, NEGATIVE_INTEREST]
  - processed_at

SOCIAL_FUND_CLAIM
  - id (UUID, PK)
  - member_id (FK → MEMBER)
  - event_type [WEDDING_MEMBER, WEDDING_CHILD, BIRTH, SICKNESS, DEATH_MEMBER, DEATH_RELATIVE]
  - event_date (DATE)
  - payout_amount (encrypted DECIMAL)
  - status [SUBMITTED, APPROVED, REJECTED, PAID]
  - approved_by (FK → MEMBER)
  - proof_document_url
  - created_at

AUDIT_LOG
  - id (UUID, PK)
  - actor_id (FK → MEMBER)
  - action_type [CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, EXPORT, WAIVE, DISBURSE]
  - entity_type (VARCHAR)
  - entity_id (UUID)
  - payload_hash (SHA-256 of action payload — for tamper detection)
  - ip_address
  - user_agent
  - timestamp (immutable)
  - description

SYSTEM_CONFIG
  - id
  - config_key (UNIQUE)
  - config_value (encrypted)
  - description
  - updated_by
  - updated_at
```

### 9.2 Key Relationships

```
MEMBER (1) ─────────────── (0..1) MEMBER [as guarantor/umwishingizi]
MEMBER (1) ─────────────── (1)    SHARE_ACCOUNT
MEMBER (1) ─────────────── (N)    CONTRIBUTION
MEMBER (1) ─────────────── (N)    LOAN
LOAN   (1) ─────────────── (N)    LOAN_REPAYMENT
LOAN   (1) ─────────────── (N)    LOAN_SHARE_SNAPSHOT
LOAN   (1) ─────────────── (N)    LOAN_INTEREST_ENTRY
LOAN_REPAYMENT (1) ──────── (0..1) PENALTY
LOAN_REPAYMENT (1) ──────── (N)    LOAN_INTEREST_ENTRY [which payment created entries]
MEMBER (1) ─────────────── (N)    LOAN_INTEREST_ENTRY [interest owed to member]
MEMBER (1) ─────────────── (N)    INTEREST_FILE
MEMBER (1) ─────────────── (N)    ANNUAL_DEDUCTION
MEMBER (1) ─────────────── (N)    SOCIAL_FUND_CLAIM
MEMBER (1) ─────────────── (N)    USER_PERMISSION
MEMBER (N) ─────────────── (M)    ACCOUNT_DELEGATION [manager ↔ target]
```

---

## 10. Security Architecture

### 10.1 Authentication

| Mechanism               | Detail                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Method**              | JWT (JSON Web Tokens) via Spring Security                                            |
| **Token Lifetime**      | Access Token: 15 minutes; Refresh Token: 7 days                                      |
| **Password Storage**    | BCrypt with salt (work factor 12)                                                    |
| **Failed Login Policy** | Lock account after 5 failed attempts; Administrator must manually unlock the account |
| **Session Management**  | Stateless (JWT-based), no server-side sessions                                       |

### 10.2 Authorization

| Mechanism                       | Detail                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Model**                       | **Hybrid RBAC + Individual Permissions** — roles define defaults, individual overrides allowed   |
| **Implementation**              | Custom `PermissionEvaluator` in Spring Security; `@PreAuthorize("hasPermission(...)")` used      |
| **Hierarchy**                   | ROLE_MEMBER < ROLE_FINANCE < ROLE_PRESIDENT < ROLE_ADMIN                                         |
| **Individual Override**         | Admin can grant or revoke any individual permission for any specific user                        |
| **Financial Record Protection** | Server-side enforcement: no mutation endpoint available to ADMIN for encrypted financial records |

### 10.3 Network Security

- HTTPS only (TLS 1.3)
- CORS configured to allow only registered frontend domains
- Rate limiting on auth endpoints (prevent brute force)
- API Gateway for request validation and filtering

### 10.4 Data Protection

- Financial amounts encrypted at rest (field-level AES-256-GCM)
- PII (national IDs, phone numbers) encrypted at rest
- Database backups encrypted
- Secure document storage for contracts and proof uploads (e.g., AWS S3 with SSE or equivalent)

---

## 11. Encryption Strategy

### 11.1 Encrypted Fields

| Entity            | Encrypted Fields                                             |
| ----------------- | ------------------------------------------------------------ |
| MEMBER            | national_id, phone, email                                    |
| CONTRIBUTION      | amount                                                       |
| LOAN              | requested_amount, approved_amount, total_interest            |
| LOAN_REPAYMENT    | amount_due, amount_paid, principal_portion, interest_portion |
| PENALTY           | amount                                                       |
| INTEREST_FILE     | interest_credited                                            |
| ANNUAL_DEDUCTION  | all financial fields                                         |
| SOCIAL_FUND_CLAIM | payout_amount                                                |
| SYSTEM_CONFIG     | config_value                                                 |

### 11.2 Encryption Implementation

```
Algorithm: AES-256-GCM (authenticated encryption)
Key Management:
  - Master encryption key stored in environment variable / secrets manager
  - Keys NEVER stored in database
  - Key rotation plan: every 6 months (confirmed)

Implementation:
  - Spring Boot @Convert annotation with JPA AttributeConverter
  - Transparent encryption/decryption at entity level
  - Even DBAs cannot read raw financial data without application key

Field-Level Encryption Flow:
  [Application] → encrypt(value, AES_KEY) → [Database stores cipher text]
  [Application] → decrypt(cipher_text, AES_KEY) → [Application reads plaintext]
```

### 11.3 What Cannot Be Edited (Immutable Records)

- `AUDIT_LOG` table: **append-only, no UPDATE or DELETE** allowed at SQL level
- `LOAN` disbursement records: once status = ACTIVE, amount fields locked
- `LOAN_REPAYMENT` once status = PAID: read-only
- All immutability enforced at **application layer AND database-level triggers**

### 11.4 Audit Hash

Each audit log entry stores a `payload_hash` (SHA-256) of the action data, allowing detection of any tampering with audit records.

---

## 12. Audit & Compliance Model

### 12.1 Audit Log Events (Mandatory)

| Event                        | Trigger                                      |
| ---------------------------- | -------------------------------------------- |
| `MEMBER_CREATED`             | New member registered                        |
| `MEMBER_STATUS_CHANGED`      | Member status updated                        |
| `CONTRIBUTION_RECORDED`      | Any contribution logged                      |
| `LOAN_REQUESTED`             | Member submits loan request                  |
| `LOAN_APPROVED`              | President approves loan                      |
| `LOAN_REJECTED`              | President rejects loan                       |
| `LOAN_DISBURSED`             | Finance records disbursement                 |
| `REPAYMENT_RECORDED`         | Finance records repayment                    |
| `PENALTY_APPLIED`            | System or Finance applies penalty            |
| `PENALTY_WAIVED`             | President waives penalty                     |
| `SOCIAL_CLAIM_SUBMITTED`     | Member OR Finance submits social event claim |
| `SOCIAL_CLAIM_APPROVED`      | President approves payout                    |
| `SOCIAL_PAYOUT_RECORDED`     | Finance records payout                       |
| `ACCOUNT_SWITCH`             | Member switches to a delegated account       |
| `DELEGATION_APPROVED`        | Admin approves account delegation request    |
| `DELEGATION_REVOKED`         | Admin revokes account delegation             |
| `PERMISSION_GRANTED`         | Admin grants individual permission to user   |
| `PERMISSION_REVOKED`         | Admin revokes individual permission          |
| `ANNUAL_DEDUCTION_PROCESSED` | December deduction cycle runs                |
| `USER_LOGIN`                 | Successful authentication                    |
| `USER_LOGOUT`                | Session ended                                |
| `REPORT_EXPORTED`            | Any report exported                          |
| `ROLE_ASSIGNED`              | Admin assigns role                           |
| `CONFIG_UPDATED`             | System configuration changed                 |

### 12.2 Audit Log Storage

- **Stored in a separate, append-only database table**
- **Cannot be deleted or updated** (SQL-level constraint + application enforcement)
- Optionally mirrored to an immutable log storage (e.g., AWS CloudWatch, or a separate write-once database schema)

### 12.3 Compliance Requirements

| Requirement                       | Implementation                                                           |
| --------------------------------- | ------------------------------------------------------------------------ |
| Monthly Treasurer report by 10th  | Scheduled job (Spring `@Scheduled`)                                      |
| Annual audit                      | Report generated on demand by Finance/President                          |
| Data retention                    | Financial records retained for minimum 10 years (per confirmed decision) |
| Dual authorization on withdrawals | Multi-signatory workflow for disbursements above threshold               |

---

## 13. API Architecture Proposal

### 13.1 API Design Principles

- RESTful conventions with resource-based URLs
- JSON request/response bodies
- OpenAPI 3.0 documented (Swagger UI available in dev mode)
- Versioned: `/api/v1/`
- All responses follow uniform envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "OK",
  "timestamp": "2026-03-18T16:00:00Z"
}
```

### 13.2 Core API Endpoints

#### Authentication

```
POST   /api/v1/auth/login           -- JWT login
POST   /api/v1/auth/refresh         -- Refresh access token
POST   /api/v1/auth/logout          -- Invalidate refresh token
POST   /api/v1/auth/change-password -- Change own password
```

#### Members

```
GET    /api/v1/members              -- List all members [FINANCE, PRESIDENT, ADMIN]
POST   /api/v1/members              -- Create member [ADMIN]
GET    /api/v1/members/{id}         -- Get member details
PUT    /api/v1/members/{id}         -- Update member profile [ADMIN]
PATCH  /api/v1/members/{id}/status  -- Change member status [PRESIDENT, ADMIN]
GET    /api/v1/members/{id}/statement -- Member financial statement
```

#### Contributions

```
GET    /api/v1/contributions             -- List [FINANCE, PRESIDENT, ADMIN]
POST   /api/v1/contributions             -- Record contribution [FINANCE]
GET    /api/v1/contributions/member/{id} -- Member contributions [MEMBER=own only]
GET    /api/v1/contributions/{id}        -- Single record
```

#### Shares

```
GET    /api/v1/shares/member/{id}        -- Member share balance
GET    /api/v1/shares/eligibility/{id}   -- Loan eligibility check
```

#### Loans

```
POST   /api/v1/loans/request             -- Submit loan request [MEMBER]
GET    /api/v1/loans                     -- List all loans [FINANCE, PRESIDENT, ADMIN]
GET    /api/v1/loans/{id}                -- Loan details
GET    /api/v1/loans/member/{memberId}   -- Member loans [MEMBER=own only]
PATCH  /api/v1/loans/{id}/approve        -- Approve loan [PRESIDENT]
PATCH  /api/v1/loans/{id}/reject         -- Reject loan [PRESIDENT]
POST   /api/v1/loans/{id}/disburse       -- Record disbursement [FINANCE]
POST   /api/v1/loans/{id}/repayments     -- Record repayment [FINANCE]
GET    /api/v1/loans/{id}/repayments     -- Repayment schedule
GET    /api/v1/loans/{id}/contract       -- Download loan contract PDF
```

#### Penalties

```
GET    /api/v1/penalties                 -- All penalties [FINANCE, PRESIDENT, ADMIN]
GET    /api/v1/penalties/member/{id}     -- Member penalties
POST   /api/v1/penalties/{id}/waive      -- Waive penalty [PRESIDENT]
```

#### Social Fund

```
POST   /api/v1/social-fund/claims        -- Submit claim [MEMBER]
GET    /api/v1/social-fund/claims        -- List claims [PRESIDENT, ADMIN]
PATCH  /api/v1/social-fund/claims/{id}/approve  -- Approve [PRESIDENT]
POST   /api/v1/social-fund/claims/{id}/payout   -- Record payout [FINANCE]
```

#### Reports

```
GET    /api/v1/reports/monthly/{year}/{month}  -- Monthly report
GET    /api/v1/reports/annual/{year}           -- Annual report
GET    /api/v1/reports/member/{id}             -- Member statement
GET    /api/v1/reports/outstanding-loans       -- Outstanding loans report
POST   /api/v1/reports/export                  -- Export report (PDF/Excel)
```

#### Audit Logs

```
GET    /api/v1/audit-logs                      -- All logs [PRESIDENT, ADMIN]
GET    /api/v1/audit-logs/member/{id}          -- Member actions
```

#### System Administration

```
GET    /api/v1/admin/users                     -- User accounts [ADMIN]
PUT    /api/v1/admin/users/{id}/role           -- Assign role [ADMIN]
GET    /api/v1/admin/config                    -- System config [ADMIN]
PUT    /api/v1/admin/config/{key}              -- Update config [ADMIN]
```

### 13.3 Backend Package Structure (Spring Boot)

```
com.twisungane
├── config/          -- Security, encryption, CORS, scheduler configs
├── controller/      -- REST controllers per module
├── service/         -- Business logic layer
├── repository/      -- JPA repositories (PostgreSQL)
├── entity/          -- JPA entities with @Convert encryption
├── dto/             -- Request/Response DTOs
├── mapper/          -- MapStruct DTO-Entity mappers
├── security/        -- JWT filter, AuthService, UserDetailsService
├── exception/       -- Global exception handler (@ControllerAdvice)
├── scheduler/       -- Scheduled tasks (monthly reports, deductions)
├── audit/           -- AuditLog service, interceptors
└── util/            -- Encryption util, financial calculators
```

---

## 14. Mobile-First UX Recommendations

### 14.1 Design Principles

| Principle         | Guidance                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| **Mobile-first**  | Design for 360px width minimum, then scale up                          |
| **Offline-aware** | Show cached data with a "last synced" indicator when offline           |
| **Low bandwidth** | Paginate all lists, lazy load images, minimize payload sizes           |
| **Language**      | Support **Kinyarwanda** and English (i18n from day 1)                  |
| **Accessibility** | WCAG 2.1 AA compliance — large touch targets (min 44px), high contrast |

### 14.2 Key Screens

| Screen                | Role              | Key Actions                                           |
| --------------------- | ----------------- | ----------------------------------------------------- |
| **Dashboard**         | All               | Balance summary, pending actions, recent transactions |
| **My Account**        | MEMBER            | Shares, loans, interest, contributions history        |
| **Loan Request**      | MEMBER            | Step-by-step guided form with eligibility preview     |
| **Pending Approvals** | PRESIDENT         | List of loans/claims awaiting decision                |
| **Record Payment**    | FINANCE           | Quick entry form for contributions/repayments         |
| **Reports**           | FINANCE/PRESIDENT | Monthly/annual report viewer with export              |
| **Social Claims**     | MEMBER            | Submit claim with document upload                     |
| **Member Directory**  | FINANCE/ADMIN     | Search, filter, view member profiles                  |
| **Audit Log Viewer**  | PRESIDENT/ADMIN   | Searchable, filterable audit trail                    |

### 14.3 Navigation Structure

```
Bottom Navigation (mobile):
  🏠 Home / Dashboard
  💰 My Finances
  📋 Requests / Actions
  📊 Reports
  👤 Profile

Sidebar (tablet/desktop):
  Expanded version with all module links based on role
```

### 14.4 UX for Financial Workflows

- **Loan Request**: Wizard-style (3 steps: amount → review eligibility → submit)
- **Approval screens**: Card-based with approve/reject buttons and reason input
- **Payment recording**: Amount field with automatic interest breakdown preview
- **Reports**: Tab-based view switching between monthly/annual/member-level data

---

## 15. Future Scalability Suggestions

### 15.1 Short-Term (Phase 2 — 6-12 months)

| Feature                      | Rationale                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Mobile Money Integration** | Integrate Rwanda mobile money (MTN MoMo, Airtel Money) for digital payments and receipt confirmation                      |
| **SMS Notifications**        | Alert members on loan approvals, due dates, penalties via SMS (critically important for low-smartphone penetration areas) |
| **Automated Penalty Engine** | Daily cron job scans overdue repayments and auto-applies penalties without manual intervention                            |
| **Document Management**      | Structured storage for loan contracts, proof documents with member-accessible portal                                      |
| **Member Mobile App**        | React Native app for iOS/Android with key self-service features                                                           |

### 15.2 Medium-Term (Phase 3 — 12-24 months)

| Feature                          | Rationale                                                               |
| -------------------------------- | ----------------------------------------------------------------------- |
| **Multi-Association Support**    | Extend platform to host multiple independent associations (SaaS model)  |
| **Bank API Integration**         | Direct integration with association's bank for automated reconciliation |
| **Digital Loan Contracts**       | E-signature integration (e.g., HelloSign or local equivalent)           |
| **Advanced Analytics Dashboard** | Financial health indicators, trend analysis, default risk scoring       |
| **General Assembly Module**      | Digital voting and resolution recording for association meetings        |

### 15.3 Long-Term (Phase 4 — 24+ months)

| Feature                         | Rationale                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| **SACCO/Cooperative Licensing** | Platform meets requirements to operate as a formal SACCO       |
| **Regulatory Reporting**        | Automated reports for BNR (National Bank of Rwanda) compliance |
| **Credit Scoring**              | Internal credit scoring based on member repayment history      |
| **Microfinance API**            | Expose APIs to partner with other fintech services             |
| **Community Fintech Platform**  | Multi-tenant platform for rural cooperatives across Rwanda     |

### 15.4 Architectural Scalability

| Concern                   | Recommendation                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Service Decomposition** | Design modular services (loans, members, payments) to be extractable as microservices later |
| **Event-Driven**          | Use Spring Events (later Kafka) for audit logging and notification decoupling               |
| **Caching**               | Redis for session management, report caching, eligibility calculations                      |
| **Containerization**      | Docker from day 1; Kubernetes-ready deployment configuration                                |
| **CI/CD**                 | GitHub Actions pipeline with automated tests, build, and deployment                         |

---

## 16. Configurable System Settings

> **Design Principle:** No financial rule, threshold, amount, or waiting period is hardcoded in the source code. Everything is stored in a `SYSTEM_CONFIG` table and managed by the Administrator through the UI. This makes the platform **reusable by other similar associations** with different rules without any code changes.

### 16.1 Configuration Categories

#### Category 1: Loan Configuration

| Config Key                         | Description                                                   | Default Value |
| ---------------------------------- | ------------------------------------------------------------- | ------------- |
| `loan.monthly_principal_payment`   | Fixed monthly principal portion of installment                | 50,000 FRW    |
| `loan.monthly_interest_amount`     | Fixed monthly interest portion of installment                 | 5,000 FRW     |
| `loan.interest_rate_percent`       | Total interest as % of principal (flat)                       | 10%           |
| `loan.max_active_loans_per_member` | Max concurrent active loans per member                        | 1             |
| `loan.tier1_max_shares`            | Upper bound of Tier 1 share bracket                           | 7             |
| `loan.tier1_multiplier`            | Loan limit multiplier for Tier 1                              | 2× shares     |
| `loan.tier2_max_shares`            | Upper bound of Tier 2 share bracket                           | 10            |
| `loan.tier2_bonus_frw`             | Fixed bonus FRW added to shares value for Tier 2              | 700,000 FRW   |
| `loan.tier3_bonus_frw`             | Fixed bonus FRW added to shares value for Tier 3 (11+ shares) | 1,000,000 FRW |

#### Category 2: Membership Configuration

| Config Key                        | Description                                                      | Default Value |
| --------------------------------- | ---------------------------------------------------------------- | ------------- |
| `member.share_value_frw`          | Value of one share in FRW                                        | 100,000 FRW   |
| `member.entry_share_cost_frw`     | Initial share purchase on joining                                | 100,000 FRW   |
| `member.entry_bank_fee_frw`       | Annual bank fee paid on joining                                  | 2,000 FRW     |
| `member.entry_social_fund_frw`    | Social fund contribution on joining                              | 18,000 FRW    |
| `member.standard_loan_wait_days`  | Days shares must be active before loan (standard member)         | 15 days       |
| `member.special_loan_wait_months` | Months to wait before loan (special member — no family in group) | 6 months      |

#### Category 3: Annual Deductions

| Config Key                         | Description                                     | Default Value |
| ---------------------------------- | ----------------------------------------------- | ------------- |
| `deduction.reserve_annual_frw`     | Annual mandatory reserve deduction per member   | 25,000 FRW    |
| `deduction.social_fund_annual_frw` | Annual social fund deduction per member         | 18,000 FRW    |
| `deduction.bank_fee_annual_frw`    | Annual bank fee deduction per member            | 2,000 FRW     |
| `deduction.month`                  | Month when annual deductions are applied (1–12) | 12 (December) |

#### Category 4: Penalty Configuration

| Config Key                  | Description                                                  | Default Value |
| --------------------------- | ------------------------------------------------------------ | ------------- |
| `penalty.tier1_days`        | Days late before first penalty applies                       | 15 days       |
| `penalty.tier1_amount_frw`  | First penalty amount                                         | 2,000 FRW     |
| `penalty.tier2_days`        | Days late before second (replacement) penalty applies        | 30 days       |
| `penalty.tier2_amount_frw`  | Second penalty amount (replaces tier1)                       | 5,000 FRW     |
| `penalty.escalation_months` | Months of missed payments before General Assembly escalation | 3 months      |

#### Category 5: Social Fund Payouts

| Config Key                  | Description                                | Default Value |
| --------------------------- | ------------------------------------------ | ------------- |
| `social.wedding_member_frw` | Payout for member's own wedding            | 50,000 FRW    |
| `social.wedding_child_frw`  | Payout for member's child's wedding        | 30,000 FRW    |
| `social.birth_frw`          | Payout per child birth (max 2 children)    | 50,000 FRW    |
| `social.birth_max_children` | Maximum children eligible for birth payout | 2             |
| `social.sickness_frw`       | Payout for hospitalization                 | 50,000 FRW    |
| `social.death_member_frw`   | Total payout on member's death             | 150,000 FRW   |
| `social.death_relative_frw` | Total payout on close relative's death     | 100,000 FRW   |

#### Category 6: System & Security

| Config Key                     | Description                                | Default Value |
| ------------------------------ | ------------------------------------------ | ------------- |
| `system.default_language`      | System-wide default language               | `en`          |
| `security.max_failed_logins`   | Failed attempts before account lock        | 5             |
| `security.key_rotation_months` | Encryption key rotation interval in months | 6 months      |
| `data.retention_years`         | Financial record retention period in years | 10 years      |

### 16.2 Database Entity: SYSTEM_CONFIG

```
SYSTEM_CONFIG
  - id (UUID, PK)
  - config_key (VARCHAR UNIQUE)           -- e.g. loan.monthly_interest_amount
  - config_value (VARCHAR)                -- stored as string, cast on read
  - value_type [INTEGER, DECIMAL, STRING, BOOLEAN]  -- for proper casting
  - category (VARCHAR)                    -- loan | member | penalty | social | security | deduction
  - label_en (VARCHAR)                    -- human-readable label in English
  - label_rw (VARCHAR)                    -- human-readable label in Kinyarwanda
  - label_fr (VARCHAR)                    -- human-readable label in French
  - description_en, description_rw, description_fr (TEXT)
  - is_sensitive (BOOLEAN)                -- if true, only Admin can view value
  - last_updated_by (FK → MEMBER)
  - updated_at
```

### 16.3 How Calculations Use Configurations

All business logic reads from the config table at runtime:

```java
// Example: Loan eligibility calculation (reads from DB config, never hardcoded)
BigDecimal tier1MaxShares = configService.getDecimal("loan.tier1_max_shares");  // 7
BigDecimal tier1Multiplier = configService.getDecimal("loan.tier1_multiplier");  // 2
BigDecimal tier2Bonus = configService.getDecimal("loan.tier2_bonus_frw");        // 700000
// ...

// Example: Fixed installment (reads from DB config)
BigDecimal monthlyPrincipal = configService.getDecimal("loan.monthly_principal_payment"); // 50000
BigDecimal monthlyInterest  = configService.getDecimal("loan.monthly_interest_amount");   // 5000
BigDecimal installment = monthlyPrincipal.add(monthlyInterest);                           // 55000
```

### 16.4 Admin UI for Configuration

- A dedicated **System Settings** page accessible only to `ROLE_ADMIN`
- Organized into tabs by category (Loan, Membership, Penalties, Social Fund, Security)
- Each config entry shows: label (in user's language), current value, description, last modified by, last modified date
- Editing a config value triggers an **audit log entry** (`CONFIG_UPDATED`)
- **Change preview**: Before saving, the admin sees a preview of how the change would affect a sample calculation
- Configuration changes apply immediately to all future calculations — no system restart required
- Historical config values are archived with timestamps so old calculations can be retrospectively understood

### 16.5 API Endpoints for Configuration

```
GET    /api/v1/admin/config                  -- List all configs (grouped by category) [ADMIN]
GET    /api/v1/admin/config/{key}            -- Get single config value [ADMIN]
PUT    /api/v1/admin/config/{key}            -- Update config value [ADMIN]
GET    /api/v1/admin/config/categories       -- List all categories
GET    /api/v1/config/public                 -- Public config (language options, system name) [ALL]
```

---

## Appendix A: Glossary

| Kinyarwanda Term              | English Translation  | French Translation  | System Field                            |
| ----------------------------- | -------------------- | ------------------- | --------------------------------------- |
| Imigabane                     | Shares               | Parts/Actions       | `share_account.total_shares`            |
| Inguzanyo                     | Loan                 | Prêt                | `loan` entity                           |
| Inyungu                       | Interest             | Intérêt             | `loan_interest_entry`                   |
| Imbumbe / Reserve Obligatoire | Mandatory Reserve    | Réserve Obligatoire | `annual_deduction.reserve_deducted`     |
| Inkunga y'imibereho           | Social Fund          | Fonds Social        | `social_fund_claim`                     |
| Umusimbura / Umwishingizi     | Guarantor/Substitute | Garant              | `member.guarantor_id`                   |
| Indangamuntu                  | National ID          | Carte d'identité    | `member.national_id`                    |
| Amafaranga y'ibanki           | Bank fees            | Frais bancaires     | `annual_deduction.bank_fee_deducted`    |
| Itorero                       | Association          | Association         | The organization itself                 |
| Intebe y'amatora              | General Assembly     | Assemblée Générale  | Human governance body                   |
| Inkunga                       | Contribution         | Contribution        | `contribution` entity                   |
| Umunyamuryango                | Member               | Membre              | `member` entity                         |
| Sosiyete / Indangagaciro      | Share value          | Valeur de part      | `system_config: member.share_value_frw` |

---

## Appendix B: Confirmed Business Decisions (Answers to HCQ Queries)

> **Status:** All items below have been confirmed by the USER and are now integrated as core business logic throughout the system. These resolve the previous "Items Requiring Human Confirmation".

| ID      | Question                                    | ✅ Confirmed Answer                                                                                                                           | System Implication                                                                                                                                                                                                                               |
| ------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HCQ-001 | Interest calculation method                 | **Flat rate: 10% of total principal**                                                                                                         | Formula: `total_interest = principal × 0.10`. Monthly interest = `principal × 0.10 / term_months` = fixed 5,000 FRW per month. No reducing balance.                                                                                              |
| HCQ-002 | 15-day vs 30-day penalty stacking           | **30-day penalty REPLACES the 15-day penalty**                                                                                                | When a repayment crosses 30 days, remove 2,000 FRW penalty and apply 5,000 FRW instead. Member never pays both.                                                                                                                                  |
| HCQ-003 | Multiple concurrent loans                   | **No — must repay existing loan fully before requesting another**                                                                             | System blocks new loan request if `LOAN.status = ACTIVE` exists for the member.                                                                                                                                                                  |
| HCQ-004 | Special member definition                   | **A new member who has NO existing family member already in the group**                                                                       | Admin marks member as `SPECIAL` at registration. System applies 6-month wait (configurable) instead of 15-day wait.                                                                                                                              |
| HCQ-005 | Account unlock after failed logins          | **Account is locked and member contacts Administrator to unlock**                                                                             | Admin has a "Unlock Account" action in user management. Locked status shows in audit log.                                                                                                                                                        |
| HCQ-006 | Data retention period                       | **10 years**                                                                                                                                  | Soft-delete only. All financial records retained for minimum 10 years (configurable via `data.retention_years`). Hard deletes blocked at DB level.                                                                                               |
| HCQ-007 | Encryption key rotation                     | **Every 6 months**                                                                                                                            | Set via `security.key_rotation_months = 6`. System alerts Admin when rotation is due. Key rotation process documented separately.                                                                                                                |
| HCQ-008 | Share locking during loan                   | **Shares locked when loan is ACTIVE OR any repayment is PENDING**                                                                             | `SHARE_ACCOUNT.is_locked = true` when loan is active or overdue payment exists. Unlocked only when loan is fully SETTLED and all penalties paid.                                                                                                 |
| HCQ-009 | Interest distribution for exiting member    | **Paid interest given in December; unpaid interest entries kept and paid out when the underlying loan installments are eventually collected** | Exiting member's `LOAN_INTEREST_ENTRY` records are retained. PAID entries are disbursed at year-end (December). WAITING/UNPAID entries remain and are paid out when the borrower eventually pays each installment — even after the member exits. |
| HCQ-010 | Maximum social fund claims per year         | **No maximum**                                                                                                                                | No claim count limit enforced. Each claim still requires documented proof and President approval.                                                                                                                                                |
| HCQ-011 | Close relative definition for death benefit | **Spouse, parent, or child of the member** (first-degree kin only)                                                                            | System `SOCIAL_FUND_CLAIM` form lists valid relative types: SPOUSE, PARENT, CHILD. Other relationships are not eligible.                                                                                                                         |
| HCQ-012 | Multi-signatory bank withdrawals            | **Handled outside the system at the physical bank. In the system, each authorized signer records a digital confirmation**                     | `BANK_WITHDRAWAL_CONFIRMATION` entity stores who confirmed, when, and the disbursement reference. Does not interface with any bank API.                                                                                                          |

---

_Document Version 1.2 — Prepared from official Twisungane Association Statutes (Kinyarwanda, 26 pages) and confirmed business decisions. This document is the complete and authoritative planning reference for the TWISUNGANE Digital Management System. All HCQ items are resolved. The system is now ready for implementation planning._
