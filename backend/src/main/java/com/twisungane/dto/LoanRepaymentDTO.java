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
public class LoanRepaymentDTO {
    private UUID id;
    private BigDecimal totalAmount;
    private BigDecimal principalPaid;
    private BigDecimal interestPaid;
    private LocalDateTime paymentDate;
    private String transactionReference;
    private String amendmentStatus;
}
