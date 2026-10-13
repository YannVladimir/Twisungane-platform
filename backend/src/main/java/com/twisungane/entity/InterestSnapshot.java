package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "interest_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterestSnapshot {

    @Id
    @GeneratedValue
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", unique = true, nullable = true)
    private Loan loan;

    @Column(nullable = false)
    private BigDecimal totalSharesAtTime;

    @Column(nullable = false, precision = 15, scale = 2, columnDefinition = "numeric(15,2) default 0.00")
    @Builder.Default
    private BigDecimal totalReserveSharesAtTime = BigDecimal.ZERO;

    private LocalDateTime snapshotDate;

    @OneToMany(mappedBy = "snapshot", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SnapshotMember> members = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        snapshotDate = LocalDateTime.now();
    }
}
