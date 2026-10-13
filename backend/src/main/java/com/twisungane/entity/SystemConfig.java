package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "system_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String configKey; // e.g., LOAN_INTEREST_RATE

    @Column(nullable = false)
    private String configValue; // e.g., 0.10

    private String description;
}
