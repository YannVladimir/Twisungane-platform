package com.twisungane.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class ScheduleEntryDTO {
    private int installmentNumber;
    private LocalDate dueDate;
    private BigDecimal scheduledPrincipal;
    private BigDecimal scheduledInterest;
    private BigDecimal scheduledTotal;
    private BigDecimal principalPaid;
    private BigDecimal interestPaid;
    private BigDecimal totalPaid;
    private String status; // PAID, PARTIAL, PENDING
}
