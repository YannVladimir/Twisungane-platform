package com.twisungane.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterestSplitPreviewDTO {
    private List<MemberInterestSplitDTO> splits;
    private BigDecimal totalInterestToCash;
    private BigDecimal totalInterestToReserve;
    private int year;
}
