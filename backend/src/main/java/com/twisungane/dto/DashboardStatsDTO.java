package com.twisungane.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDTO {
    private long totalMembers;
    private long activeMembers;
    private long activeLoanUsers;
    private double totalShareCount;
    private BigDecimal totalShares;
    private BigDecimal activeLoans;
    private BigDecimal socialFundTotal;
    private BigDecimal availableForLoan;   // totalPool - activeLoansOutstanding (social fund floored at 50,000 non-borrowable reserve)
    private BigDecimal totalLiquidity;     // same as availableForLoan but counts the FULL social fund balance, ignoring the 50,000 reserve floor — informational total, not a lending cap
    private BigDecimal socialFundBalance;  // raw SOCIAL_FUND_BALANCE config value
    private Double     socialShareCount;   // computed 0.5-step share count for Social member
    private BigDecimal socialFundCredit;   // Actual amount social fund contributes to loan pool
    private BigDecimal interestPool;       // Total interest collected available for reinvestment
    private BigDecimal sharesPool;         // Total member shares available in pool
    private BigDecimal bankFeesBalance;    // Total accumulated bank fees for liquidity pool
    private BigDecimal obligatoryReservePool;
    
    // Financial Breakdown for Contributions Page
    private BigDecimal socialCollected;
    private BigDecimal socialSpent;
    private BigDecimal socialInterest;
    private BigDecimal bankCollected;
    private BigDecimal bankSpent;

    private String trendSocial;

    // Charts & Infographics Data
    private java.util.List<java.util.Map<String, Object>> flowChart;
    private java.util.List<java.util.Map<String, Object>> compositionChart;
    
    // Calendar Data
    private java.util.List<java.util.Map<String, Object>> upcomingPayments;
    
    // Projections
    private java.util.List<java.util.Map<String, Object>> interestProjectionChart;
    private java.util.List<java.util.Map<String, Object>> equityGrowthChart;
}
