package com.twisungane.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberInterestSplitDTO {
    private UUID memberId;
    private String memberName;
    private String nationalId;
    
    private BigDecimal availableInterest;
    private BigDecimal reserveAlreadyPaid; // Paid this year
    private BigDecimal reserveRemainingNeeded; // 25,000 - alreadyPaid
    
    private BigDecimal amountToReserve; // Suggested deduction
    private BigDecimal amountToCash;   // Suggested payout
    
    private boolean topupNeeded; // If reserveRemainingNeeded > availableInterest
    private BigDecimal topupAmount; // reserveRemainingNeeded - availableInterest
}
