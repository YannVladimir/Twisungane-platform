-- ============================================================
-- V5 — snapshot_members.updated_at
-- Tracks when each SnapshotMember row was last touched (repayment
-- interest credit, penalty distribution, or interest top-up), so
-- a member's interest history can be shown most-recent-first.
-- Existing rows are backfilled from their snapshot's creation date
-- as the best available approximation.
-- ============================================================

ALTER TABLE snapshot_members ADD COLUMN updated_at TIMESTAMP;

UPDATE snapshot_members sm
SET updated_at = isn.snapshot_date
FROM interest_snapshots isn
WHERE sm.snapshot_id = isn.id AND sm.updated_at IS NULL;

UPDATE snapshot_members SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE snapshot_members ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE snapshot_members ALTER COLUMN updated_at SET DEFAULT now();
