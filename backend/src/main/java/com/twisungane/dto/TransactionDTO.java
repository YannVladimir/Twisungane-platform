package com.twisungane.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionDTO {
    private UUID id;
    private String type; // e.g., "Member Contribution", "Loan Repayment", "Share Purchase", "Social Claim"
    private BigDecimal amount;
    private LocalDateTime date;
    private String description;
    private String memberName;
    private UUID memberId;
}
