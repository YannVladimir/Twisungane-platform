package com.twisungane.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenBlacklistService {

    private final ConcurrentHashMap<String, Instant> blacklist = new ConcurrentHashMap<>();

    public void invalidate(String token, Date expiry) {
        blacklist.put(token, expiry.toInstant());
    }

    public boolean isBlacklisted(String token) {
        return blacklist.containsKey(token);
    }

    // Remove expired entries every hour to prevent unbounded memory growth
    @Scheduled(fixedRate = 3_600_000)
    public void purgeExpired() {
        Instant now = Instant.now();
        blacklist.entrySet().removeIf(e -> e.getValue().isBefore(now));
    }
}
