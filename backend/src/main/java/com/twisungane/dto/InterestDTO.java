package com.twisungane.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class InterestDTO {
    private UUID memberId;
    private String memberName;
    private String nationalId;
    private boolean isSocialAccount;
    
    private BigDecimal totalExpectedInterest;
    private BigDecimal totalPaidInterest;
    private BigDecimal totalUnpaidInterest;
    private BigDecimal totalCashedOutInterest;

    private BigDecimal totalCapitalInterest;
    private BigDecimal totalReserveInterest;
    
    private List<InterestDetailDTO> details;
}
