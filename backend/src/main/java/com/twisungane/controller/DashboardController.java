package com.twisungane.controller;

import com.twisungane.dto.DashboardStatsDTO;
import com.twisungane.dto.TransactionDTO;
import com.twisungane.entity.Contribution;
import com.twisungane.entity.Loan;
import com.twisungane.entity.Member;
import com.twisungane.repository.ContributionRepository;
import com.twisungane.repository.GroupExpenseRepository;
import com.twisungane.repository.LoanRepository;
import com.twisungane.repository.LoanRepaymentRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.ShareRecordRepository;
import com.twisungane.repository.SnapshotMemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.service.DashboardService;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final LoanRepository loanRepository;
    private final LoanRepaymentRepository loanRepaymentRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final DashboardService dashboardService;
    private final ContributionRepository contributionRepository;
    private final GroupExpenseRepository groupExpenseRepository;
    private final HmacUtil hmacUtil;

    @GetMapping("/stats")
    public DashboardStatsDTO getStats() {
        long totalMembers = memberRepository.count();

        BigDecimal minShareAmount = new BigDecimal("100000");
        long activeMembers = shareRecordRepository.findMemberIdsWithSharesAtLeast(Member.MemberType.SOCIAL, minShareAmount).size();

        long activeLoanUsers = loanRepository.countDistinctMembersByStatus(Loan.LoanStatus.ACTIVE);

        BigDecimal totalShares = shareRecordRepository.sumByMemberTypeNot(Member.MemberType.SOCIAL);

        // Social Fund calculation
        BigDecimal socialBalance = new BigDecimal(
                systemConfigRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                        .map(c -> c.getConfigValue())
                        .orElse("0")
        );
        
        BigDecimal reserve = new BigDecimal("50000");
        BigDecimal shareUnit = new BigDecimal("100000");
        BigDecimal socialAvailable = BigDecimal.ZERO;
        Double computedShareCount = 0.0;
        
        if (socialBalance.compareTo(reserve) > 0) {
            socialAvailable = socialBalance.subtract(reserve);
            computedShareCount = socialAvailable.divide(shareUnit, 10, java.math.RoundingMode.HALF_UP).doubleValue();
        }

        BigDecimal totalInterestCollected = loanRepaymentRepository.sumAllInterestPaid();

        BigDecimal topupInterestTotal = systemConfigRepository.findByConfigKey("GLOBAL_TOPUP_SNAPSHOT_ID")
                .map(c -> snapshotMemberRepository.sumPaidInterestBySnapshotId(java.util.UUID.fromString(c.getConfigValue())))
                .orElse(BigDecimal.ZERO);

        BigDecimal totalCashedOutInterest = snapshotMemberRepository.sumAllCashedOut();

        BigDecimal remainingInterestPool = totalInterestCollected.add(topupInterestTotal).subtract(totalCashedOutInterest);

        BigDecimal bankFeesBalance = new BigDecimal(
                systemConfigRepository.findByConfigKey("BANK_FEES_BALANCE")
                        .map(c -> c.getConfigValue())
                        .orElse("0")
        );

        BigDecimal obligatoryReservePool = contributionRepository.sumAllByType(Contribution.ContributionType.OBLIGATORY_RESERVE);

        BigDecimal totalPool = totalShares.add(socialAvailable).add(remainingInterestPool).add(bankFeesBalance).add(obligatoryReservePool);

        BigDecimal activeLoansOut = loanRepository.sumRemainingPrincipalByStatus(Loan.LoanStatus.ACTIVE);

        BigDecimal availableForLoan = totalPool.subtract(activeLoansOut);

        // Informational total for the dashboard card: counts the FULL social fund balance (no 50,000
        // non-borrowable reserve floor) — unlike availableForLoan, this is never used to cap a loan disbursement.
        BigDecimal totalLiquidity = totalShares.add(socialBalance).add(remainingInterestPool).add(bankFeesBalance).add(obligatoryReservePool).subtract(activeLoansOut);

        // --- NEW Financial Breakdown logic ---
        
        // Social Fund Breakdown
        BigDecimal socialCollected = contributionRepository.sumAllByType(Contribution.ContributionType.SOCIAL);
        BigDecimal socialSpent = groupExpenseRepository.sumByType(com.twisungane.entity.ExpenseType.SOCIAL);
        BigDecimal socialInterest = snapshotMemberRepository.sumExpectedInterestByMemberType(Member.MemberType.SOCIAL);

        // Bank Fees Breakdown
        BigDecimal bankCollected = contributionRepository.sumAllByType(Contribution.ContributionType.FRAIS_BANCAIRE);
        BigDecimal bankSpent = groupExpenseRepository.sumByType(com.twisungane.entity.ExpenseType.BANK);

        double totalShareCount = totalShares.divide(shareUnit, 2, java.math.RoundingMode.FLOOR).doubleValue();

        return DashboardStatsDTO.builder()
                .totalMembers(totalMembers)
                .activeMembers(activeMembers)
                .activeLoanUsers(activeLoanUsers)
                .totalShareCount(totalShareCount)
                .totalShares(totalShares)
                .activeLoans(activeLoansOut)
                .socialFundTotal(socialBalance)
                .availableForLoan(availableForLoan)
                .totalLiquidity(totalLiquidity)
                .socialFundBalance(socialBalance)
                .socialShareCount(computedShareCount)
                .socialFundCredit(socialAvailable)
                .interestPool(remainingInterestPool)
                .sharesPool(totalShares)
                .bankFeesBalance(bankFeesBalance)
                .obligatoryReservePool(obligatoryReservePool)
                // New fields
                .socialCollected(socialCollected)
                .socialSpent(socialSpent)
                .socialInterest(socialInterest)
                .bankCollected(bankCollected)
                .bankSpent(bankSpent)
                .trendSocial("+0%")
                .flowChart(dashboardService.getMonthlyFlowData())
                .compositionChart(dashboardService.getPoolCompositionData())
                .upcomingPayments(dashboardService.getUpcomingPayments())
                .interestProjectionChart(dashboardService.getInterestProjection())
                .equityGrowthChart(dashboardService.getEquityGrowthChart())
                .build();
    }

    @GetMapping("/transactions")
    public ResponseEntity<Page<TransactionDTO>> getTransactions(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Member viewer = memberRepository.findByEmailHash(hmacUtil.hash(userDetails.getUsername()))
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.ok(dashboardService.getRecentTransactions(viewer.getId(), PageRequest.of(page, size)));
    }
}
