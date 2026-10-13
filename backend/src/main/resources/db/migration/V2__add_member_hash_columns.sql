-- Replace ECB deterministic encryption with HMAC blind-index columns.
-- email and national_id columns now use AES/GCM (non-deterministic); these
-- new _hash columns hold HMAC-SHA256 values used for equality lookups.
ALTER TABLE members ADD COLUMN email_hash        VARCHAR(255);
ALTER TABLE members ADD COLUMN national_id_hash  VARCHAR(255) NOT NULL DEFAULT '';

-- Unique constraints match the application-level uniqueness rules
ALTER TABLE members ADD CONSTRAINT uq_members_email_hash        UNIQUE (email_hash);
ALTER TABLE members ADD CONSTRAINT uq_members_national_id_hash  UNIQUE (national_id_hash);

-- Indexes for fast lookups
CREATE INDEX idx_members_email_hash        ON members (email_hash);
CREATE INDEX idx_members_national_id_hash  ON members (national_id_hash);

-- Drop the old NOT NULL default placeholder
ALTER TABLE members ALTER COLUMN national_id_hash DROP DEFAULT;
