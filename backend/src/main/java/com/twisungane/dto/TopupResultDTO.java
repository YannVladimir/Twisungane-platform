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
public class TopupResultDTO {
    private UUID memberId;
    private String memberName;
    private BigDecimal totalTopup;
    private BigDecimal reservePortion;
    private BigDecimal socialPortion;
    private BigDecimal reserveTargetPerYear;
    private BigDecimal reserveAlreadyPaidBeforeTopup;
    private BigDecimal reserveTotalAfterTopup;
}
