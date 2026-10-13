package com.twisungane.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class InterestDetailDTO {
    private String loanReference; // e.g., "...1f3a"
    private LocalDateTime snapshotDate;
    private BigDecimal expectedInterest;
    private BigDecimal paidInterest;
    private BigDecimal cashedOutInterest;
    private BigDecimal capitalInterest;
    private BigDecimal reserveInterest;
}
