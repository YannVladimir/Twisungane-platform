package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "share_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShareRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDateTime dateBought;

    private String transactionReference;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String amendmentStatus = "ORIGINAL";

    @PrePersist
    protected void onCreate() {
        if (dateBought == null) {
            dateBought = LocalDateTime.now();
        }
    }
}
