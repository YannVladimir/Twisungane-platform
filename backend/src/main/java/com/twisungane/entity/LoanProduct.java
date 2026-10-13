package com.twisungane.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "loan_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name; // e.g., ORDINARY_LOAN, EMERGENCY_LOAN

    private String description;

    @Column(nullable = false)
    private BigDecimal multiplier; // e.g., 2.0 or 3.0

    @Column(nullable = false)
    private Integer maxTermMonths;

    @Column(nullable = false)
    private boolean requiresGuarantor;
    
    @Column(nullable = false)
    private Integer waitPeriodDays;
}
