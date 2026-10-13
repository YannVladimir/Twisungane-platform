package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "social_claims")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialClaim {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType eventType;

    @Column(nullable = false)
    private BigDecimal amount;

    private String evidenceReference; // Text-based reference (e.g., Certificate ID)
    
    @Builder.Default
    @Enumerated(EnumType.STRING)
    private ClaimStatus status = ClaimStatus.PENDING;

    private String presidentComments;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime paidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private Member approvedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum EventType {
        MEMBER_WEDDING,
        CHILD_WEDDING,
        BIRTH,
        HOSPITALIZATION,
        MEMBER_DEATH,
        RELATIVE_DEATH
    }

    public enum ClaimStatus {
        PENDING,
        APPROVED,
        REJECTED,
        PAID
    }
}
