package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transaction_amendments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionAmendment {

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TransactionType transactionType;

    @Column(nullable = false)
    private UUID originalTransactionId;

    @Column(nullable = false, columnDefinition = "text")
    private String reason;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal originalAmount;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal correctAmount;

    // JSON blob for type-specific extra fields (correct reference, correct date, etc.)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String amendmentDetails;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AmendmentStatus status = AmendmentStatus.PENDING_REVIEW;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_id", nullable = false)
    private Member requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    private Member reviewedBy;

    @Column(columnDefinition = "text")
    private String rejectionReason;

    // UUIDs of the reversal and correction records created on apply
    private UUID reversalTransactionId;
    private UUID correctionTransactionId;

    private LocalDateTime appliedAt;
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

    public enum AmendmentStatus {
        PENDING_REVIEW, APPROVED, REJECTED, APPLIED, CANCELLED
    }

    public enum TransactionType {
        SHARE_RECORD, CONTRIBUTION, LOAN_REPAYMENT, GROUP_EXPENSE, PENALTY, SOCIAL_CLAIM
    }
}
