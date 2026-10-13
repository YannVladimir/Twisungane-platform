-- ============================================================
-- V1 Baseline Schema — Twisungane SACCO Management System
-- Generated from Hibernate entity definitions (Spring Boot 3.4.3 / Hibernate 6)
-- Run on fresh DB. On existing DB, baseline-on-migrate=true skips this file.
-- ============================================================

-- Independent tables first (no foreign keys to other app tables)

CREATE TABLE user_roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE permissions (
    id          UUID         NOT NULL PRIMARY KEY,
    code        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE system_config (
    id           BIGSERIAL    PRIMARY KEY,
    config_key   VARCHAR(255) NOT NULL UNIQUE,
    config_value VARCHAR(255) NOT NULL,
    description  VARCHAR(255)
);

CREATE TABLE loan_products (
    id                BIGSERIAL    PRIMARY KEY,
    name              VARCHAR(255) NOT NULL UNIQUE,
    description       VARCHAR(255),
    multiplier        NUMERIC(19, 2) NOT NULL,
    max_term_months   INTEGER      NOT NULL,
    requires_guarantor BOOLEAN     NOT NULL,
    wait_period_days  INTEGER      NOT NULL
);

-- Members table (self-referencing FK for guarantor handled after)
CREATE TABLE members (
    id                    UUID         NOT NULL PRIMARY KEY,
    national_id           VARCHAR(255) NOT NULL UNIQUE,
    first_name            VARCHAR(255) NOT NULL,
    last_name             VARCHAR(255) NOT NULL,
    email                 VARCHAR(255) UNIQUE,
    phone                 VARCHAR(255),
    password              VARCHAR(255) NOT NULL,
    status                VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    type                  VARCHAR(50)  NOT NULL DEFAULT 'STANDARD',
    date_of_birth         DATE,
    is_minor              BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    is_locked             BOOLEAN      NOT NULL DEFAULT FALSE,
    locked_until          TIMESTAMP,
    wait_period_start     DATE,
    join_date             DATE,
    created_at            TIMESTAMP,
    updated_at            TIMESTAMP,
    preferred_language    VARCHAR(10)  DEFAULT 'en',
    preferred_theme       VARCHAR(10)  DEFAULT 'dark',
    signed_contract_path  VARCHAR(255),
    guarantor_id          UUID,
    role_id               BIGINT,
    CONSTRAINT fk_members_guarantor FOREIGN KEY (guarantor_id) REFERENCES members (id),
    CONSTRAINT fk_members_role      FOREIGN KEY (role_id)      REFERENCES user_roles (id)
);

-- Role and user permission mapping tables
CREATE TABLE role_permissions (
    id            BIGSERIAL NOT NULL PRIMARY KEY,
    role_id       BIGINT    NOT NULL,
    permission_id UUID      NOT NULL,
    CONSTRAINT fk_roleperm_role       FOREIGN KEY (role_id)       REFERENCES user_roles (id),
    CONSTRAINT fk_roleperm_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
);

CREATE TABLE user_permissions (
    id            UUID      NOT NULL PRIMARY KEY,
    granted       BOOLEAN   NOT NULL,
    granted_at    TIMESTAMP,
    user_id       UUID      NOT NULL,
    permission_id UUID      NOT NULL,
    granted_by    UUID,
    CONSTRAINT fk_userperm_user       FOREIGN KEY (user_id)       REFERENCES members (id),
    CONSTRAINT fk_userperm_permission FOREIGN KEY (permission_id) REFERENCES permissions (id),
    CONSTRAINT fk_userperm_grantedby  FOREIGN KEY (granted_by)    REFERENCES members (id)
);

-- Loan lifecycle tables
CREATE TABLE loan_applications (
    id               UUID           NOT NULL PRIMARY KEY,
    loan_number      VARCHAR(255),
    requested_amount NUMERIC(19, 2) NOT NULL,
    issued_date      DATE,
    purpose          VARCHAR(255),
    status           VARCHAR(50)    NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(500),
    created_at       TIMESTAMP,
    updated_at       TIMESTAMP,
    member_id        UUID           NOT NULL,
    product_id       BIGINT         NOT NULL,
    guarantor_id     UUID,
    CONSTRAINT fk_loanapp_member    FOREIGN KEY (member_id)    REFERENCES members (id),
    CONSTRAINT fk_loanapp_product   FOREIGN KEY (product_id)   REFERENCES loan_products (id),
    CONSTRAINT fk_loanapp_guarantor FOREIGN KEY (guarantor_id) REFERENCES members (id)
);

CREATE TABLE loans (
    id                    UUID           NOT NULL PRIMARY KEY,
    loan_number           VARCHAR(255),
    principal_amount      NUMERIC(19, 2) NOT NULL,
    total_interest_amount NUMERIC(19, 2) NOT NULL,
    remaining_principal   NUMERIC(19, 2) NOT NULL,
    remaining_interest    NUMERIC(19, 2) NOT NULL,
    disbursement_date     DATE,
    due_date              DATE,
    signed_contract_path  VARCHAR(255),
    status                VARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    created_at            TIMESTAMP,
    updated_at            TIMESTAMP,
    member_id             UUID           NOT NULL,
    application_id        UUID           UNIQUE,
    CONSTRAINT fk_loans_member      FOREIGN KEY (member_id)      REFERENCES members (id),
    CONSTRAINT fk_loans_application FOREIGN KEY (application_id) REFERENCES loan_applications (id)
);

CREATE TABLE loan_repayments (
    id                    UUID           NOT NULL PRIMARY KEY,
    total_amount          NUMERIC(19, 2) NOT NULL,
    principal_paid        NUMERIC(19, 2) NOT NULL,
    interest_paid         NUMERIC(19, 2) NOT NULL,
    payment_date          TIMESTAMP,
    transaction_reference VARCHAR(255),
    loan_id               UUID           NOT NULL,
    CONSTRAINT fk_repayment_loan FOREIGN KEY (loan_id) REFERENCES loans (id)
);

-- Contributions and shares
CREATE TABLE contributions (
    id                   UUID           NOT NULL PRIMARY KEY,
    amount               NUMERIC(19, 2) NOT NULL,
    month                INTEGER        NOT NULL,
    year                 INTEGER        NOT NULL,
    date_paid            TIMESTAMP      NOT NULL,
    details              VARCHAR(500),
    signed_contract_path VARCHAR(255),
    type                 VARCHAR(50)    NOT NULL DEFAULT 'SOCIAL',
    member_id            UUID           NOT NULL,
    CONSTRAINT fk_contribution_member FOREIGN KEY (member_id) REFERENCES members (id)
);

CREATE TABLE share_records (
    id                    UUID           NOT NULL PRIMARY KEY,
    amount                NUMERIC(19, 2) NOT NULL,
    date_bought           TIMESTAMP      NOT NULL,
    transaction_reference VARCHAR(255),
    member_id             UUID           NOT NULL,
    CONSTRAINT fk_sharerecord_member FOREIGN KEY (member_id) REFERENCES members (id)
);

-- Penalties
CREATE TABLE penalties (
    id          UUID           NOT NULL PRIMARY KEY,
    amount      NUMERIC(19, 2) NOT NULL,
    type        VARCHAR(50)    NOT NULL,
    status      VARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    description VARCHAR(255),
    created_at  TIMESTAMP,
    paid_at     TIMESTAMP,
    waived_at   TIMESTAMP,
    member_id   UUID           NOT NULL,
    loan_id     UUID,
    waived_by   UUID,
    CONSTRAINT fk_penalty_member   FOREIGN KEY (member_id) REFERENCES members (id),
    CONSTRAINT fk_penalty_loan     FOREIGN KEY (loan_id)   REFERENCES loans (id),
    CONSTRAINT fk_penalty_waivedby FOREIGN KEY (waived_by) REFERENCES members (id)
);

-- Group expenses
CREATE TABLE group_expenses (
    id             UUID           NOT NULL PRIMARY KEY,
    amount         NUMERIC(19, 2) NOT NULL,
    date           DATE           NOT NULL,
    type           VARCHAR(50)    NOT NULL,
    description    VARCHAR(255)   NOT NULL,
    slip_path      VARCHAR(255),
    created_at     TIMESTAMP,
    recorded_by_id UUID,
    CONSTRAINT fk_expense_recordedby FOREIGN KEY (recorded_by_id) REFERENCES members (id)
);

-- Social fund claims
CREATE TABLE social_claims (
    id                 UUID           NOT NULL PRIMARY KEY,
    event_type         VARCHAR(50)    NOT NULL,
    amount             NUMERIC(19, 2) NOT NULL,
    evidence_reference VARCHAR(255),
    status             VARCHAR(50)    NOT NULL DEFAULT 'PENDING',
    president_comments VARCHAR(255),
    created_at         TIMESTAMP,
    updated_at         TIMESTAMP,
    approved_at        TIMESTAMP,
    paid_at            TIMESTAMP,
    member_id          UUID           NOT NULL,
    approved_by        UUID,
    CONSTRAINT fk_socialclaim_member     FOREIGN KEY (member_id)   REFERENCES members (id),
    CONSTRAINT fk_socialclaim_approvedby FOREIGN KEY (approved_by) REFERENCES members (id)
);

-- Interest distribution (snapshot model)
CREATE TABLE interest_snapshots (
    id                        UUID           NOT NULL PRIMARY KEY,
    total_shares_at_time      NUMERIC(19, 2) NOT NULL,
    total_reserve_shares_at_time NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    snapshot_date             TIMESTAMP,
    loan_id                   UUID           UNIQUE,
    CONSTRAINT fk_snapshot_loan FOREIGN KEY (loan_id) REFERENCES loans (id)
);

CREATE TABLE snapshot_members (
    id                       UUID           NOT NULL PRIMARY KEY,
    shares_at_time           NUMERIC(19, 2) NOT NULL,
    reserve_shares_at_time   NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    expected_interest_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_interest_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cashed_out_interest_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    snapshot_id              UUID           NOT NULL,
    member_id                UUID           NOT NULL,
    CONSTRAINT fk_snapshotmember_snapshot FOREIGN KEY (snapshot_id) REFERENCES interest_snapshots (id),
    CONSTRAINT fk_snapshotmember_member   FOREIGN KEY (member_id)   REFERENCES members (id)
);

-- Member exit workflow
CREATE TABLE member_exit_requests (
    id                   UUID           NOT NULL PRIMARY KEY,
    status               VARCHAR(50)    NOT NULL DEFAULT 'PENDING_REVIEW',
    exit_type            VARCHAR(50)    NOT NULL,
    exit_reason          VARCHAR(500),
    total_share_value    NUMERIC(15, 2),
    total_unpaid_penalties NUMERIC(15, 2),
    net_settlement_amount NUMERIC(15, 2),
    approved_at          TIMESTAMP,
    rejection_reason     VARCHAR(500),
    payout_recorded_at   TIMESTAMP,
    payout_reference     VARCHAR(255),
    created_at           TIMESTAMP,
    updated_at           TIMESTAMP,
    member_id            UUID           NOT NULL,
    initiated_by         UUID,
    approved_by          UUID,
    payout_recorded_by   UUID,
    CONSTRAINT fk_exit_member          FOREIGN KEY (member_id)          REFERENCES members (id),
    CONSTRAINT fk_exit_initiatedby     FOREIGN KEY (initiated_by)       REFERENCES members (id),
    CONSTRAINT fk_exit_approvedby      FOREIGN KEY (approved_by)        REFERENCES members (id),
    CONSTRAINT fk_exit_payoutrecordedby FOREIGN KEY (payout_recorded_by) REFERENCES members (id)
);

-- Audit trail
CREATE TABLE audit_logs (
    id          UUID         NOT NULL PRIMARY KEY,
    action      VARCHAR(255) NOT NULL,
    target_type VARCHAR(255) NOT NULL,
    target_id   VARCHAR(255),
    message     VARCHAR(1000),
    timestamp   TIMESTAMP    NOT NULL,
    actor_id    UUID,
    CONSTRAINT fk_auditlog_actor FOREIGN KEY (actor_id) REFERENCES members (id)
);

-- Indexes for common lookup patterns
CREATE INDEX idx_members_email       ON members (email);
CREATE INDEX idx_members_national_id ON members (national_id);
CREATE INDEX idx_loans_member        ON loans (member_id);
CREATE INDEX idx_loans_status        ON loans (status);
CREATE INDEX idx_repayments_loan     ON loan_repayments (loan_id);
CREATE INDEX idx_contributions_member ON contributions (member_id);
CREATE INDEX idx_share_records_member ON share_records (member_id);
CREATE INDEX idx_penalties_member    ON penalties (member_id);
CREATE INDEX idx_penalties_status    ON penalties (status);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
