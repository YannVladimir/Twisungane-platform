package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    @GeneratedValue
    private UUID id;

    @Convert(converter = com.twisungane.util.EncryptionConverter.class)
    @Column(nullable = false)
    private String nationalId;

    // HMAC-SHA256 blind index for equality lookups (replaces ECB deterministic encryption)
    @Column(name = "national_id_hash", unique = true, nullable = false)
    private String nationalIdHash;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Convert(converter = com.twisungane.util.EncryptionConverter.class)
    private String email;

    // HMAC-SHA256 blind index for equality lookups
    @Column(name = "email_hash", unique = true)
    private String emailHash;

    @Convert(converter = com.twisungane.util.EncryptionConverter.class)
    private String phone;

    @Column(nullable = false)
    private String password;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    private MemberStatus status = MemberStatus.ACTIVE;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    private MemberType type = MemberType.STANDARD;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guarantor_id")
    private Member guarantor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id")
    private UserRole role;

    private LocalDate dateOfBirth;
    
    @Builder.Default
    private boolean isMinor = false;

    @Builder.Default
    private int failedLoginAttempts = 0;

    @Builder.Default
    private boolean isLocked = false;

    private LocalDateTime lockedUntil;

    private LocalDate waitPeriodStart;

    private LocalDate joinDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Builder.Default
    @Column(length = 10)
    private String preferredLanguage = "en";

    @Builder.Default
    @Column(length = 10)
    private String preferredTheme = "dark";

    private String signedContractPath;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (joinDate == null)
            joinDate = LocalDate.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum MemberStatus {
        ACTIVE, SUSPENDED, EXPELLED, EXITING, EXITED
    }

    public enum MemberType {
        STANDARD, SPECIAL, SOCIAL
    }
}
