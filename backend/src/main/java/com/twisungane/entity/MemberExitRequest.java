package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "member_exit_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberExitRequest {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ExitStatus status = ExitStatus.PENDING_REVIEW;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExitType exitType;

    @Column(length = 500)
    private String exitReason;

    @Column(precision = 15, scale = 2)
    private BigDecimal totalShareValue;

    @Column(precision = 15, scale = 2)
    private BigDecimal totalUnpaidPenalties;

    @Column(precision = 15, scale = 2)
    private BigDecimal netSettlementAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "initiated_by")
    private Member initiatedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private Member approvedBy;

    private LocalDateTime approvedAt;

    @Column(length = 500)
    private String rejectionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payout_recorded_by")
    private Member payoutRecordedBy;

    private LocalDateTime payoutRecordedAt;

    @Column(length = 255)
    private String payoutReference;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ExitStatus {
        PENDING_REVIEW,
        SETTLEMENT_READY,
        APPROVED,
        REJECTED,
        PAYOUT_RECORDED,
        COMPLETED
    }

    public enum ExitType {
        VOLUNTARY,
        EXPELLED
    }
}
