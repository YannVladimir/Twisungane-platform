-- ============================================================
-- V3 — Transaction Amendment System
-- Adds amendment_requests table and amendment_status tracking
-- to all mutable transaction tables.
-- ============================================================

-- Core amendment requests table
CREATE TABLE transaction_amendments (
    id                          UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type            VARCHAR(40)  NOT NULL,
    -- SHARE_RECORD | CONTRIBUTION | LOAN_REPAYMENT | GROUP_EXPENSE | PENALTY | SOCIAL_CLAIM
    original_transaction_id     UUID         NOT NULL,
    reason                      TEXT         NOT NULL,
    original_amount             NUMERIC(15,2) NOT NULL,
    correct_amount              NUMERIC(15,2) NOT NULL,
    amendment_details           JSONB,
    -- type-specific overrides: e.g. {"correct_reference":"X","correct_date":"2026-01-15"}
    status                      VARCHAR(20)  NOT NULL DEFAULT 'PENDING_REVIEW',
    -- PENDING_REVIEW | APPROVED | REJECTED | APPLIED | CANCELLED
    requested_by_id             UUID         NOT NULL REFERENCES members(id),
    reviewed_by_id              UUID         REFERENCES members(id),
    rejection_reason            TEXT,
    reversal_transaction_id     UUID,
    correction_transaction_id   UUID,
    applied_at                  TIMESTAMP,
    created_at                  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_amendments_status        ON transaction_amendments(status);
CREATE INDEX idx_amendments_type_original ON transaction_amendments(transaction_type, original_transaction_id);
CREATE INDEX idx_amendments_requested_by  ON transaction_amendments(requested_by_id);

-- amendment_status column on each transaction table
-- Values: ORIGINAL | AMENDED | REVERSAL | CORRECTION
ALTER TABLE share_records    ADD COLUMN amendment_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE contributions    ADD COLUMN amendment_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE loan_repayments  ADD COLUMN amendment_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE group_expenses   ADD COLUMN amendment_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE penalties        ADD COLUMN amendment_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';
