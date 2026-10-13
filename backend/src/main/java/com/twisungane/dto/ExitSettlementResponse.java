package com.twisungane.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExitSettlementResponse {
    private BigDecimal totalShareValue;
    private BigDecimal shareCount;
    private BigDecimal sharePricePerUnit;
    private BigDecimal totalUnpaidPenalties;
    private BigDecimal netSettlementAmount;
    private String memberName;
    private String memberEmail;
    private String memberNationalId;
}
