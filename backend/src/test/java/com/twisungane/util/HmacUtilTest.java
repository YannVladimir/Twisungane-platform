package com.twisungane.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * HmacUtil produces the blind-index hashes used to look up encrypted PII (email, national ID)
 * in the database without decrypting every row. If this ever becomes non-deterministic, or
 * stops being case-insensitive, member lookups (login, exit eligibility, duplicate checks)
 * silently break.
 */
class HmacUtilTest {

    private final HmacUtil hmacUtil = new HmacUtil("test-secret-key-for-unit-tests-only");

    @Test
    void hashIsDeterministicForTheSameInput() {
        String a = hmacUtil.hash("admin@twisungane.com");
        String b = hmacUtil.hash("admin@twisungane.com");
        assertEquals(a, b);
    }

    @Test
    void hashIsCaseInsensitive() {
        String lower = hmacUtil.hash("admin@twisungane.com");
        String upper = hmacUtil.hash("ADMIN@TWISUNGANE.COM");
        assertEquals(lower, upper, "Email/national-ID lookups must not depend on case");
    }

    @Test
    void differentInputsProduceDifferentHashes() {
        String a = hmacUtil.hash("admin@twisungane.com");
        String b = hmacUtil.hash("president@twisungane.com");
        assertNotEquals(a, b);
    }

    @Test
    void blankOrNullInputReturnsNull() {
        assertNull(hmacUtil.hash(null));
        assertNull(hmacUtil.hash(""));
        assertNull(hmacUtil.hash("   "));
    }

    @Test
    void differentSecretKeysProduceDifferentHashesForTheSameInput() {
        HmacUtil other = new HmacUtil("a-completely-different-secret-key");
        String a = hmacUtil.hash("admin@twisungane.com");
        String b = other.hash("admin@twisungane.com");
        assertNotEquals(a, b, "The hash must depend on the configured secret, not just the input");
    }
}
