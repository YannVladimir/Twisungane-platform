package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "contributions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contribution {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private Integer month;

    @Column(nullable = false)
    private Integer year;

    @Column(nullable = false)
    private LocalDateTime datePaid;

    @Column(length = 500)
    private String details;

    private String signedContractPath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'SOCIAL'")
    @Builder.Default
    private ContributionType type = ContributionType.SOCIAL;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String amendmentStatus = "ORIGINAL";

    @PrePersist
    protected void onCreate() {
        if (datePaid == null) {
            datePaid = LocalDateTime.now();
        }
    }

    public enum ContributionType {
        PENALTY, SOCIAL, FRAIS_BANCAIRE, OBLIGATORY_RESERVE
    }
}
