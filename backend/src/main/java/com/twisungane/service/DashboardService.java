package com.twisungane.service;

import com.twisungane.dto.TransactionDTO;
import com.twisungane.entity.*;
import com.twisungane.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final ContributionRepository contributionRepository;
    private final LoanRepaymentRepository loanRepaymentRepository;
    private final SocialClaimRepository socialClaimRepository;
    private final LoanApplicationRepository loanApplicationRepository;
    private final LoanRepository loanRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final GroupExpenseRepository groupExpenseRepository;

    public Page<TransactionDTO> getRecentTransactions(UUID viewerId, Pageable pageable) {
        Member viewer = memberRepository.findById(viewerId).orElseThrow();
        String role = viewer.getRole().getName();
        
        List<UUID> targetMemberIds = new ArrayList<>();
        boolean seeAll = "ROLE_ADMIN".equals(role) || "ROLE_PRESIDENT".equals(role);
        
        if (!seeAll) {
            targetMemberIds.add(viewerId);
            // Members guaranteed via Loan Applications
            List<UUID> guaranteedInLoans = loanApplicationRepository.findByGuarantorId(viewerId).stream()
                    .map(app -> app.getMember().getId())
                    .collect(Collectors.toList());
            targetMemberIds.addAll(guaranteedInLoans);
            
            // Members guaranteed via static Member link
            // (Just in case the referral link is what they meant)
            // But usually loan applications are the "Guarantor" relationship
        }

        List<TransactionDTO> allTransactions = new ArrayList<>();

        if (seeAll) {
            // Aggregating all for Admin/President
            // For performance, we only take the most recent 100 from each table
            // before merging in memory for the final page.
            allTransactions.addAll(shareRecordRepository.findAll(PageRequest.of(0, 100)).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(contributionRepository.findAll(PageRequest.of(0, 100)).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(loanRepaymentRepository.findAll(PageRequest.of(0, 100)).stream()
                    .filter(r -> !"AMENDED".equals(r.getAmendmentStatus()))
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(socialClaimRepository.findByStatus(SocialClaim.ClaimStatus.PAID).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(loanRepository.findAll(PageRequest.of(0, 100)).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
        } else {
            // Filtering for standard members
            Set<UUID> ids = new HashSet<>(targetMemberIds);
            allTransactions.addAll(shareRecordRepository.findByMemberIdIn(ids).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(contributionRepository.findByMemberIdIn(ids).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(loanRepaymentRepository.findByLoanMemberIdIn(ids).stream()
                    .filter(r -> !"AMENDED".equals(r.getAmendmentStatus()))
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(socialClaimRepository.findByMemberIdInAndStatus(ids, SocialClaim.ClaimStatus.PAID).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
            allTransactions.addAll(loanRepository.findByMemberIdIn(ids).stream()
                    .map(r -> mapToDTO(r)).collect(Collectors.toList()));
        }

        // Sort by date descending
        allTransactions.sort((a, b) -> b.getDate().compareTo(a.getDate()));

        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), allTransactions.size());
        
        if (start > allTransactions.size()) return new PageImpl<>(Collections.emptyList(), pageable, allTransactions.size());
        
        return new PageImpl<>(allTransactions.subList(start, end), pageable, allTransactions.size());
    }

    private TransactionDTO mapToDTO(ShareRecord r) {
        return TransactionDTO.builder()
                .id(r.getId())
                .type("Share Purchase")
                .amount(r.getAmount())
                .date(r.getDateBought())
                .description(r.getTransactionReference())
                .memberId(r.getMember().getId())
                .memberName(r.getMember().getFirstName() + " " + r.getMember().getLastName())
                .build();
    }

    private TransactionDTO mapToDTO(Contribution r) {
        return TransactionDTO.builder()
                .id(r.getId())
                .type("Member Contribution")
                .amount(r.getAmount())
                .date(r.getDatePaid())
                .description("Month: " + r.getMonth() + "/" + r.getYear())
                .memberId(r.getMember().getId())
                .memberName(r.getMember().getFirstName() + " " + r.getMember().getLastName())
                .build();
    }

    private TransactionDTO mapToDTO(LoanRepayment r) {
        return TransactionDTO.builder()
                .id(r.getId())
                .type("Loan Repayment")
                .amount(r.getTotalAmount())
                .date(r.getPaymentDate())
                .description("Ref: " + r.getTransactionReference())
                .memberId(r.getLoan().getMember().getId())
                .memberName(r.getLoan().getMember().getFirstName() + " " + r.getLoan().getMember().getLastName())
                .build();
    }

    private TransactionDTO mapToDTO(SocialClaim r) {
        return TransactionDTO.builder()
                .id(r.getId())
                .type("Social Claim Payout")
                .amount(r.getAmount().negate()) // Payouts are negative
                .date(r.getPaidAt() != null ? r.getPaidAt() : (r.getApprovedAt() != null ? r.getApprovedAt() : LocalDateTime.now()))
                .description(r.getEventType().toString())
                .memberId(r.getMember().getId())
                .memberName(r.getMember().getFirstName() + " " + r.getMember().getLastName())
                .build();
    }

    private TransactionDTO mapToDTO(Loan l) {
        return TransactionDTO.builder()
                .id(l.getId())
                .type("Loan Cash Out")
                .amount(l.getPrincipalAmount().negate()) // Disbursements are negative
                .date(l.getDisbursementDate() != null ? l.getDisbursementDate().atStartOfDay() : l.getCreatedAt())
                .description("Loan #: " + l.getLoanNumber())
                .memberId(l.getMember().getId())
                .memberName(l.getMember().getFirstName() + " " + l.getMember().getLastName())
                .build();
    }

    public java.math.BigDecimal calculateAvailableForLoan() {
        return calculateAvailableForLoan(LocalDate.now());
    }

    /**
     * @param asOfDate the date of the loan being considered (e.g. its disbursement date). Loans dated
     *                 before SOCIAL_FUND_LAW_EFFECTIVE_DATE (default 2025-01-01) treat the Social Fund's
     *                 full balance as available for lending, ignoring the 50,000 non-borrowable reserve —
     *                 that reserve rule only applies from the law's effective date onward.
     */
    public java.math.BigDecimal calculateAvailableForLoan(LocalDate asOfDate) {
        java.math.BigDecimal totalShares = shareRecordRepository.sumAll();

        java.math.BigDecimal socialBalance = new java.math.BigDecimal(
                systemConfigRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                        .map(SystemConfig::getConfigValue)
                        .orElse("0")
        );

        LocalDate socialFundLawDate = LocalDate.parse(systemConfigRepository.findByConfigKey("SOCIAL_FUND_LAW_EFFECTIVE_DATE")
                .map(SystemConfig::getConfigValue).orElse("2025-01-01"));
        boolean reserveFloorApplies = asOfDate == null || !asOfDate.isBefore(socialFundLawDate);

        java.math.BigDecimal reserve = new java.math.BigDecimal("50000");
        java.math.BigDecimal shareUnit = new java.math.BigDecimal("100000");
        java.math.BigDecimal socialAvailable;

        if (!reserveFloorApplies) {
            socialAvailable = socialBalance;
        } else if (socialBalance.compareTo(reserve) > 0) {
            java.math.BigDecimal available = socialBalance.subtract(reserve);
            long halfShares = available.divide(shareUnit, 10, java.math.RoundingMode.FLOOR)
                    .multiply(new java.math.BigDecimal("2"))
                    .setScale(0, java.math.RoundingMode.FLOOR)
                    .longValue();
            socialAvailable = shareUnit.multiply(java.math.BigDecimal.valueOf(halfShares / 2.0));
        } else {
            socialAvailable = java.math.BigDecimal.ZERO;
        }

        java.math.BigDecimal totalInterestCollected = loanRepaymentRepository.sumAllInterestPaid();
        java.math.BigDecimal totalCashedOutInterest = snapshotMemberRepository.sumAllCashedOut();

        java.math.BigDecimal bankFeesBalance = new java.math.BigDecimal(
                systemConfigRepository.findByConfigKey("BANK_FEES_BALANCE")
                        .map(SystemConfig::getConfigValue)
                        .orElse("0")
        );

        java.math.BigDecimal totalObligatoryReserve = contributionRepository.sumAllByType(Contribution.ContributionType.OBLIGATORY_RESERVE);

        java.math.BigDecimal totalPool = totalShares.add(socialAvailable).add(totalInterestCollected).add(getTopupInterestTotal()).add(bankFeesBalance).add(totalObligatoryReserve).subtract(totalCashedOutInterest);

        java.math.BigDecimal activeLoansOut = loanRepository.sumRemainingPrincipalByStatus(Loan.LoanStatus.ACTIVE);

        return totalPool.subtract(activeLoansOut);
    }

    /** Cash directly topped up to members' own interest accounts — real money, must count towards available liquidity. */
    private java.math.BigDecimal getTopupInterestTotal() {
        return systemConfigRepository.findByConfigKey("GLOBAL_TOPUP_SNAPSHOT_ID")
                .map(c -> snapshotMemberRepository.sumPaidInterestBySnapshotId(java.util.UUID.fromString(c.getConfigValue())))
                .orElse(java.math.BigDecimal.ZERO);
    }

    public List<Map<String, Object>> getPoolCompositionData() {
        List<Map<String, Object>> data = new ArrayList<>();

        java.math.BigDecimal totalShares = shareRecordRepository.sumAll();

        java.math.BigDecimal socialBalance = new java.math.BigDecimal(
                systemConfigRepository.findByConfigKey("SOCIAL_FUND_BALANCE").map(SystemConfig::getConfigValue).orElse("0"));

        java.math.BigDecimal interestBalance = loanRepaymentRepository.sumAllInterestPaid()
                .add(getTopupInterestTotal())
                .subtract(snapshotMemberRepository.sumAllCashedOut());

        java.math.BigDecimal obligatoryReserves = contributionRepository.sumAllByType(Contribution.ContributionType.OBLIGATORY_RESERVE);

        java.math.BigDecimal bankFees = new java.math.BigDecimal(
                systemConfigRepository.findByConfigKey("BANK_FEES_BALANCE").map(SystemConfig::getConfigValue).orElse("0"));

        data.add(createDataPoint("Share Capital", totalShares));
        data.add(createDataPoint("Social Fund", socialBalance));
        data.add(createDataPoint("Reserves", obligatoryReserves));
        data.add(createDataPoint("Interest Pool", interestBalance));
        data.add(createDataPoint("Bank Fees", bankFees));

        return data;
    }

    private Map<String, Object> createDataPoint(String name, java.math.BigDecimal value) {
        Map<String, Object> point = new HashMap<>();
        point.put("name", name);
        point.put("value", value);
        return point;
    }

    public List<Map<String, Object>> getMonthlyFlowData() {
        List<Map<String, Object>> flow = new ArrayList<>();
        java.time.LocalDate now = java.time.LocalDate.now();

        for (int i = 5; i >= 0; i--) {
            java.time.LocalDate target = now.minusMonths(i);
            int month = target.getMonthValue();
            int year = target.getYear();

            java.time.LocalDate from = java.time.LocalDate.of(year, month, 1);
            java.time.LocalDate to = from.plusMonths(1);
            java.time.LocalDateTime fromDt = from.atStartOfDay();
            java.time.LocalDateTime toDt = to.atStartOfDay();

            java.math.BigDecimal income = java.math.BigDecimal.ZERO;
            java.math.BigDecimal expense = java.math.BigDecimal.ZERO;

            income = income.add(contributionRepository.sumByMonthAndYear(month, year));
            income = income.add(shareRecordRepository.sumByDateBoughtRange(fromDt, toDt));
            income = income.add(loanRepaymentRepository.sumTotalAmountByDateRange(fromDt, toDt));

            expense = expense.add(loanRepository.sumPrincipalByDisbursementDateRange(from, to));
            expense = expense.add(socialClaimRepository.sumAmountByStatusAndPaidAtRange(SocialClaim.ClaimStatus.PAID, fromDt, toDt));
            expense = expense.add(groupExpenseRepository.sumAmountByDateRange(from, to));

            Map<String, Object> point = new HashMap<>();
            point.put("month", target.getMonth().name().substring(0, 3));
            point.put("income", income);
            point.put("expense", expense);
            flow.add(point);
        }

        return flow;
    }

    public List<Map<String, Object>> getUpcomingPayments() {
        List<Map<String, Object>> allPayments = new ArrayList<>();
        
        loanRepository.findByStatus(Loan.LoanStatus.ACTIVE).forEach(loan -> {
            if (loan.getDisbursementDate() == null) return;
            
            java.math.BigDecimal totalInitial = loan.getPrincipalAmount().add(loan.getTotalInterestAmount());
            java.math.BigDecimal totalRemaining = loan.getRemainingPrincipal().add(loan.getRemainingInterest());
            java.math.BigDecimal totalPaid = totalInitial.subtract(totalRemaining).max(java.math.BigDecimal.ZERO);
            
            long installmentsPaid = totalPaid.divide(new java.math.BigDecimal("55000"), 0, java.math.RoundingMode.FLOOR).longValue();
            long remainingInstallments = Math.max(1, totalRemaining.divide(new java.math.BigDecimal("55000"), 0, java.math.RoundingMode.CEILING).longValue());
            
            for (long i = 0; i < remainingInstallments; i++) {
                java.time.LocalDate payDate = loan.getDisbursementDate().plusMonths(installmentsPaid + 1 + i);
                
                // Last installment may be a smaller amount
                java.math.BigDecimal installmentAmount = new java.math.BigDecimal("55000");
                if (i == remainingInstallments - 1) {
                    java.math.BigDecimal alreadyCovered = new java.math.BigDecimal("55000").multiply(new java.math.BigDecimal(remainingInstallments - 1));
                    java.math.BigDecimal remainder = totalRemaining.subtract(alreadyCovered);
                    if (remainder.compareTo(java.math.BigDecimal.ZERO) > 0 && remainder.compareTo(new java.math.BigDecimal("55000")) < 0) {
                        installmentAmount = remainder;
                    }
                }
                
                Map<String, Object> entry = new HashMap<>();
                entry.put("id", loan.getId().toString() + "-" + i);
                entry.put("member", loan.getMember().getFirstName() + " " + loan.getMember().getLastName());
                entry.put("loanNumber", loan.getLoanNumber());
                entry.put("dueDate", payDate.toString());
                entry.put("amountExpected", installmentAmount);
                allPayments.add(entry);
            }
        });
        
        allPayments.sort((a, b) -> ((String) a.get("dueDate")).compareTo((String) b.get("dueDate")));
        return allPayments;
    }

    public List<Map<String, Object>> getInterestProjection() {
        List<Map<String, Object>> chart = new ArrayList<>();
        int currentYear = java.time.LocalDate.now().getYear();
        int currentMonthValue = java.time.LocalDate.now().getMonthValue();
        String[] monthNames = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        
        java.util.Map<Integer, java.math.BigDecimal> paidInterest = new HashMap<>();
        java.util.Map<Integer, java.math.BigDecimal> projectedInterest = new HashMap<>();
        for (int i = 1; i <= 12; i++) {
            paidInterest.put(i, java.math.BigDecimal.ZERO);
            projectedInterest.put(i, java.math.BigDecimal.ZERO);
        }
        
        // Accumulate Historical Interest Paid (from actual repayment records this year)
        java.time.LocalDateTime yearStart = java.time.LocalDateTime.of(currentYear, 1, 1, 0, 0);
        java.time.LocalDateTime yearEnd = java.time.LocalDateTime.of(currentYear + 1, 1, 1, 0, 0);
        loanRepaymentRepository.findByPaymentDateBetween(yearStart, yearEnd).stream()
            .filter(r -> r.getPaymentDate() != null && !"AMENDED".equals(r.getAmendmentStatus()))
            .forEach(r -> {
                int month = r.getPaymentDate().getMonthValue();
                if (r.getInterestPaid() != null) {
                    paidInterest.put(month, paidInterest.get(month).add(r.getInterestPaid()));
                }
            });
            
        // Distribute expected future interest from ACTIVE loans
        loanRepository.findByStatus(Loan.LoanStatus.ACTIVE).forEach(loan -> {
            if (loan.getDisbursementDate() != null && loan.getRemainingInterest() != null) {
                java.math.BigDecimal totalInitial = loan.getPrincipalAmount().add(loan.getTotalInterestAmount());
                java.math.BigDecimal totalRemaining = loan.getRemainingPrincipal().add(loan.getRemainingInterest());
                java.math.BigDecimal totalPaid = totalInitial.subtract(totalRemaining);
                
                // How many installments already paid
                long installmentsPaid = totalPaid.max(java.math.BigDecimal.ZERO)
                    .divide(new java.math.BigDecimal("55000"), 0, java.math.RoundingMode.FLOOR).longValue();
                // How many installments remain
                long remainingInstallments = Math.max(1, totalRemaining
                    .divide(new java.math.BigDecimal("55000"), 0, java.math.RoundingMode.CEILING).longValue());
                // Interest per installment (e.g. 5,000 for a 200k loan over 4 months)
                java.math.BigDecimal interestPerInstallment = loan.getRemainingInterest()
                    .divide(new java.math.BigDecimal(remainingInstallments), 2, java.math.RoundingMode.HALF_UP);
                
                // Distribute interest into each future installment month
                java.time.LocalDate nextPayment = loan.getDisbursementDate().plusMonths(installmentsPaid + 1);
                for (long j = 0; j < remainingInstallments; j++) {
                    java.time.LocalDate payDate = nextPayment.plusMonths(j);
                    if (payDate.getYear() == currentYear) {
                        int fMonth = payDate.getMonthValue();
                        projectedInterest.put(fMonth, projectedInterest.get(fMonth).add(interestPerInstallment));
                    }
                }
            }
        });
        
        // Assemble into DTO map array
        for (int i = 1; i <= 12; i++) {
            Map<String, Object> point = new HashMap<>();
            point.put("month", monthNames[i-1]);
            
            if (i < currentMonthValue) {
                point.put("historical", paidInterest.get(i));
                point.put("projected", 0);
            } else if (i == currentMonthValue) {
                point.put("historical", paidInterest.get(i));
                point.put("projected", projectedInterest.get(i));
            } else {
                point.put("historical", 0);
                point.put("projected", projectedInterest.get(i));
            }
            chart.add(point);
        }
        return chart;
    }

    public List<Map<String, Object>> getEquityGrowthChart() {
        List<ShareRecord> allRecords = shareRecordRepository.findAll();
        allRecords.sort(Comparator.comparing(ShareRecord::getDateBought));
        
        List<Map<String, Object>> chart = new ArrayList<>();
        java.math.BigDecimal cumulativeTotal = java.math.BigDecimal.ZERO;
        
        // Group by month
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("MMM yy");
        java.util.LinkedHashMap<String, java.math.BigDecimal> monthlySums = new java.util.LinkedHashMap<>();
        
        for (ShareRecord record : allRecords) {
            String monthKey = record.getDateBought().format(formatter);
            monthlySums.put(monthKey, monthlySums.getOrDefault(monthKey, java.math.BigDecimal.ZERO).add(record.getAmount()));
        }
        
        for (java.util.Map.Entry<String, java.math.BigDecimal> entry : monthlySums.entrySet()) {
            cumulativeTotal = cumulativeTotal.add(entry.getValue());
            Map<String, Object> point = new HashMap<>();
            point.put("month", entry.getKey());
            point.put("total", cumulativeTotal);
            chart.add(point);
        }
        
        return chart;
    }
}
