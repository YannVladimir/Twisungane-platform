package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "penalties")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Penalty {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id")
    private Loan loan;

    @Column(nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PenaltyType type;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    private PenaltyStatus status = PenaltyStatus.ACTIVE;

    private String description;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String amendmentStatus = "ORIGINAL";

    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private LocalDateTime waivedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "waived_by")
    private Member waivedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum PenaltyType {
        LATE_15D, LATE_30D, ANNUAL_DEFICIT, OTHER
    }

    public enum PenaltyStatus {
        ACTIVE, PAID, WAIVED
    }
}
