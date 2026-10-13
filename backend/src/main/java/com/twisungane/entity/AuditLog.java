package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private Member actor;

    @Column(nullable = false)
    private String action; // e.g., "LOAN_DISBURSED", "CONTRIBUTION_RECORDED"

    @Column(nullable = false)
    private String targetType; // e.g., "LOAN", "CONTRIBUTION", "MEMBER"

    private String targetId;

    @Column(length = 1000)
    private String message;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
