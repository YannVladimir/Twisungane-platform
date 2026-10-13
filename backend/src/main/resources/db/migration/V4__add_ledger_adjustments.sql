-- ============================================================
-- V4 — Ledger Adjustments
-- Historical import support: tracks balance adjustments that
-- have no equivalent in the normal transaction workflow.
-- Types: REGULARISATION, BANK_WITHDRAWAL, SOCIAL_CLAIM_PAYOUT,
--        BANK_CORRECTION, BANK_WITHDRAWAL_INTEREST,
--        CONTRIBUTION_SOCIAL_GENERIC
-- ============================================================

CREATE TABLE ledger_adjustments (
    id              UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    amount          NUMERIC(15,2) NOT NULL,
    direction       VARCHAR(10)   NOT NULL,  -- 'IN' or 'OUT'
    adjustment_type VARCHAR(50)   NOT NULL,
    balance_key     VARCHAR(60),             -- system_config key that was updated (nullable)
    description     TEXT,
    date            DATE          NOT NULL,
    member_id       UUID          REFERENCES members(id),
    reference       VARCHAR(100),
    source_row      INTEGER,
    created_at      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_adj_date ON ledger_adjustments(date);
CREATE INDEX idx_ledger_adj_type ON ledger_adjustments(adjustment_type);
CREATE INDEX idx_ledger_adj_member ON ledger_adjustments(member_id);
