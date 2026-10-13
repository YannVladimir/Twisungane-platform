package com.twisungane.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class HmacUtil {

    private final byte[] keyBytes;

    public HmacUtil(@Value("${twisungane.encryption.key:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}") String secretKey) {
        byte[] raw = secretKey.getBytes(StandardCharsets.UTF_8);
        this.keyBytes = new byte[32];
        System.arraycopy(raw, 0, this.keyBytes, 0, Math.min(raw.length, 32));
    }

    /**
     * Returns a deterministic, collision-resistant HMAC-SHA256 of the input
     * value, normalized to lowercase before hashing so lookups are
     * case-insensitive. Safe to store as a search index column.
     */
    public String hash(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keyBytes, "HmacSHA256"));
            byte[] result = mac.doFinal(value.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(result);
        } catch (Exception e) {
            throw new RuntimeException("HMAC error", e);
        }
    }
}
