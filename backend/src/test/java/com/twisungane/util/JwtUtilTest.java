package com.twisungane.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * JwtUtil issues and validates the session tokens every authenticated request relies on
 * (JwtRequestFilter). These tests exercise it directly — bypassing Spring context startup,
 * which now intentionally fails without a real JWT_SECRET env var (see SEC-003 fix) — by
 * injecting test values into the @Value-backed fields with ReflectionTestUtils, the same way
 * Spring itself would populate them at runtime.
 */
class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "unit-test-only-jwt-signing-secret-0123456789");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 86_400_000L);
    }

    private UserDetails user(String email) {
        return new User(email, "irrelevant-password-hash", Collections.singletonList(
                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_MEMBER")));
    }

    @Test
    void generatedTokenContainsTheUsernameAsSubject() {
        UserDetails member = user("member@twisungane.com");
        String token = jwtUtil.generateToken(member);

        assertEquals("member@twisungane.com", jwtUtil.extractUsername(token));
    }

    @Test
    void generatedTokenValidatesAgainstTheSameUser() {
        UserDetails member = user("member@twisungane.com");
        String token = jwtUtil.generateToken(member);

        assertTrue(jwtUtil.validateToken(token, member));
    }

    @Test
    void tokenDoesNotValidateAgainstADifferentUser() {
        UserDetails member = user("member@twisungane.com");
        UserDetails someoneElse = user("someone-else@twisungane.com");
        String token = jwtUtil.generateToken(member);

        assertFalse(jwtUtil.validateToken(token, someoneElse));
    }

    @Test
    void expirationIsSetRoughlyExpirationMillisInTheFuture() {
        UserDetails member = user("member@twisungane.com");
        long before = System.currentTimeMillis();
        String token = jwtUtil.generateToken(member);

        Date expiration = jwtUtil.extractExpiration(token);
        long expectedExpiry = before + 86_400_000L;

        // Allow a small tolerance for test execution time between capturing `before` and signing.
        assertTrue(Math.abs(expiration.getTime() - expectedExpiry) < 5_000,
                "Expiration should be ~24h after token creation");
    }

    @Test
    void tokenSignedWithADifferentSecretFailsToParse() {
        UserDetails member = user("member@twisungane.com");
        String token = jwtUtil.generateToken(member);

        JwtUtil differentSecretUtil = new JwtUtil();
        ReflectionTestUtils.setField(differentSecretUtil, "secret", "a-totally-different-secret-value-0987654321");
        ReflectionTestUtils.setField(differentSecretUtil, "expiration", 86_400_000L);

        org.junit.jupiter.api.Assertions.assertThrows(
                io.jsonwebtoken.security.SignatureException.class,
                () -> differentSecretUtil.extractUsername(token),
                "A token must not validate under a different signing secret — this is what SEC-003 protects");
    }
}
