package com.twisungane.service;

import com.twisungane.entity.*;
import com.twisungane.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportingService {

    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final LoanRepository loanRepository;
    private final LoanRepaymentRepository loanRepaymentRepository;
    private final ContributionRepository contributionRepository;
    private final SocialClaimRepository socialClaimRepository;
    private final GroupExpenseRepository groupExpenseRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final PenaltyRepository penaltyRepository;
    private final InterestSnapshotRepository interestSnapshotRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final LoanApplicationRepository loanApplicationRepository;
    private final AuditLogRepository auditLogRepository;

    public Map<String, Object> getMonthlyStatusData(int month, int year) {
        Map<String, Object> data = new HashMap<>();

        BigDecimal totalShares = shareRecordRepository.findAll().stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Only active loans principal remaining
        BigDecimal totalLoans = loanRepository.findAll().stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE)
                .map(Loan::getRemainingPrincipal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Exclude SOCIAL members and members with 0 shares
        long memberCount = memberRepository.findAll().stream()
                .filter(m -> m.getType() != Member.MemberType.SOCIAL)
                .filter(m -> shareRecordRepository.findByMemberId(m.getId()).stream()
                        .map(ShareRecord::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .compareTo(BigDecimal.ZERO) > 0)
                .count();

        data.put("totalShares", totalShares);
        data.put("totalLoans", totalLoans);
        data.put("memberCount", memberCount);
        data.put("month", month);
        data.put("year", year);

        List<Map<String, Object>> composition = new ArrayList<>();
        composition.add(createDataPoint("Shares", totalShares));
        composition.add(createDataPoint("Active Loans", totalLoans));
        data.put("composition", composition);

        return data;
    }

    public List<Map<String, Object>> getMemberBalances() {
        return memberRepository.findAll().stream()
                .filter(m -> m.getType() != Member.MemberType.SOCIAL)
                .map(m -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", m.getId());
                    map.put("name", m.getFirstName() + " " + m.getLastName());

                    BigDecimal shares = shareRecordRepository.findByMemberId(m.getId()).stream()
                            .map(ShareRecord::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    map.put("shares", shares);

                    BigDecimal loanBalance = loanRepository.findByMemberId(m.getId()).stream()
                            .filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE)
                            .map(l -> l.getRemainingPrincipal().add(l.getRemainingInterest()))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    map.put("loanBalance", loanBalance);

                    return map;
                })
                .filter(m -> ((BigDecimal) m.get("shares")).compareTo(BigDecimal.ZERO) > 0)
                .sorted((a, b) -> ((BigDecimal) b.get("shares")).compareTo((BigDecimal) a.get("shares")))
                .collect(Collectors.toList());
    }

    public long countActiveContributingMembers() {
        return memberRepository.findAll().stream()
                .filter(m -> m.getType() != Member.MemberType.SOCIAL)
                .filter(m -> shareRecordRepository.findByMemberId(m.getId()).stream()
                        .map(ShareRecord::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .compareTo(BigDecimal.ZERO) > 0)
                .count();
    }

    public List<Map<String, Object>> getLoanAgingData() {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> aging = new ArrayList<>();
        
        long healthy = 0;
        long late15 = 0;
        long late30 = 0;
        long defaulted = 0;

        for (Loan loan : loanRepository.findByStatus(Loan.LoanStatus.ACTIVE)) {
            LocalDate baseDate = loan.getDueDate();
            if (baseDate == null) {
                baseDate = loan.getDisbursementDate() != null ? loan.getDisbursementDate().plusDays(30) : loan.getCreatedAt().toLocalDate().plusDays(30);
            }
            
            long daysLate = ChronoUnit.DAYS.between(baseDate, today);

            if (daysLate <= 15) {
                healthy++;
            } else if (daysLate <= 30) {
                late15++;
            } else if (daysLate <= 60) {
                late30++;
            } else {
                defaulted++;
            }
        }

        aging.add(createDataPoint("Healthy", new BigDecimal(healthy)));
        aging.add(createDataPoint("Late (15d)", new BigDecimal(late15)));
        aging.add(createDataPoint("Late (30d)", new BigDecimal(late30)));
        aging.add(createDataPoint("Defaulted", new BigDecimal(defaulted)));

        return aging;
    }

    // ── Loan Demand Forecast ─────────────────────────────────────────────────
    public Map<String, Object> getLoanDemandForecast() {
        BigDecimal totalSharesPool = shareRecordRepository.findAll().stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal activeLoansOutstanding = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE).stream()
                .map(Loan::getRemainingPrincipal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal availableCash = totalSharesPool.subtract(activeLoansOutstanding);

        List<LoanApplication> pendingQueue = loanApplicationRepository.findAll().stream()
                .filter(app -> app.getStatus() == LoanApplication.ApplicationStatus.PENDING || app.getStatus() == LoanApplication.ApplicationStatus.APPROVED)
                .sorted(Comparator.comparing(LoanApplication::getCreatedAt))
                .collect(Collectors.toList());

        List<Map<String, Object>> queue = new ArrayList<>();
        BigDecimal cumulativeDemand = BigDecimal.ZERO;

        for (LoanApplication app : pendingQueue) {
            cumulativeDemand = cumulativeDemand.add(app.getRequestedAmount());
            boolean canFund = availableCash.compareTo(cumulativeDemand) >= 0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("memberName", app.getMember().getFirstName() + " " + app.getMember().getLastName());
            row.put("requestedAmount", app.getRequestedAmount());
            row.put("status", app.getStatus().name());
            row.put("applicationDate", app.getCreatedAt() != null ? app.getCreatedAt().toLocalDate().toString() : "N/A");
            row.put("canFund", canFund);
            queue.add(row);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("availableCash", availableCash);
        data.put("totalDemand", cumulativeDemand);
        data.put("deficit", availableCash.subtract(cumulativeDemand).min(BigDecimal.ZERO));
        data.put("fundableCount", queue.stream().filter(r -> (Boolean) r.get("canFund")).count());
        data.put("queue", queue);

        return data;
    }

    // ── Yield Analysis ────────────────────────────────────────────────────────
    public Map<String, Object> getYieldAnalysisData(int year) {
        BigDecimal deduction = systemConfigRepository.findByConfigKey("ANNUAL_INTEREST_DEDUCTION")
                .map(c -> new BigDecimal(c.getConfigValue()))
                .orElse(new BigDecimal("45000"));

        List<Map<String, Object>> membersYield = new ArrayList<>();
        BigDecimal totalNetYield = BigDecimal.ZERO;

        for (Member m : memberRepository.findAll()) {
            if (m.getType() == Member.MemberType.SOCIAL) continue;

            BigDecimal earnedInterest = snapshotMemberRepository.findByMemberId(m.getId()).stream()
                    .filter(sm -> sm.getSnapshot().getSnapshotDate() != null && sm.getSnapshot().getSnapshotDate().getYear() == year)
                    .map(SnapshotMember::getPaidInterestAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal socialPaid = contributionRepository.findAll().stream()
                    .filter(c -> c.getYear() != null && c.getYear() == year)
                    .filter(c -> c.getMember().getId().equals(m.getId()))
                    .filter(c -> c.getType() == Contribution.ContributionType.SOCIAL)
                    .map(Contribution::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal bankFeesPaid = contributionRepository.findAll().stream()
                    .filter(c -> c.getYear() != null && c.getYear() == year)
                    .filter(c -> c.getMember().getId().equals(m.getId()))
                    .filter(c -> c.getType() == Contribution.ContributionType.FRAIS_BANCAIRE)
                    .map(Contribution::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal netYield = earnedInterest.subtract(deduction).subtract(socialPaid).subtract(bankFeesPaid);
            totalNetYield = totalNetYield.add(netYield);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("memberName", m.getFirstName() + " " + m.getLastName());
            row.put("earnedInterest", earnedInterest);
            row.put("deduction", deduction);
            row.put("socialPaid", socialPaid);
            row.put("bankFeesPaid", bankFeesPaid);
            row.put("netYield", netYield);
            membersYield.add(row);
        }

        membersYield.sort((a, b) -> ((BigDecimal) b.get("netYield")).compareTo((BigDecimal) a.get("netYield")));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("year", year);
        data.put("yields", membersYield);
        data.put("totalNetYield", totalNetYield);
        return data;
    }

    // ── Outstanding Loans ────────────────────────────────────────────────────
    public List<Map<String, Object>> getOutstandingLoansData() {
        return loanRepository.findByStatus(Loan.LoanStatus.ACTIVE).stream()
                .map(loan -> {
                    Member m = loan.getMember();
                    BigDecimal totalRemaining = loan.getRemainingPrincipal().add(loan.getRemainingInterest());
                    long monthsActive = loan.getDisbursementDate() != null
                            ? ChronoUnit.MONTHS.between(loan.getDisbursementDate(), LocalDate.now()) : 0;
                    BigDecimal paid = loan.getPrincipalAmount().subtract(loan.getRemainingPrincipal());
                    int progress = loan.getPrincipalAmount().compareTo(BigDecimal.ZERO) > 0
                            ? paid.multiply(BigDecimal.valueOf(100))
                                  .divide(loan.getPrincipalAmount(), 0, RoundingMode.HALF_UP).intValue()
                            : 0;
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("memberName", m.getFirstName() + " " + m.getLastName());
                    row.put("loanNumber", loan.getLoanNumber() != null ? loan.getLoanNumber()
                            : loan.getId().toString().substring(0, 8).toUpperCase());
                    row.put("principalAmount", loan.getPrincipalAmount());
                    row.put("remainingPrincipal", loan.getRemainingPrincipal());
                    row.put("remainingInterest", loan.getRemainingInterest());
                    row.put("totalRemaining", totalRemaining);
                    row.put("disbursementDate", loan.getDisbursementDate() != null
                            ? loan.getDisbursementDate().toString() : "N/A");
                    row.put("monthsActive", monthsActive);
                    row.put("progressPercent", progress);
                    return row;
                })
                .sorted((a, b) -> ((BigDecimal) b.get("totalRemaining"))
                        .compareTo((BigDecimal) a.get("totalRemaining")))
                .collect(Collectors.toList());
    }

    // ── Social Fund ──────────────────────────────────────────────────────────
    public Map<String, Object> getSocialFundData() {
        Map<String, String> eventLabels = new LinkedHashMap<>();
        eventLabels.put("MEMBER_WEDDING",  "Member Wedding");
        eventLabels.put("CHILD_WEDDING",   "Child Wedding");
        eventLabels.put("BIRTH",           "Birth");
        eventLabels.put("HOSPITALIZATION", "Hospitalization");
        eventLabels.put("MEMBER_DEATH",    "Member Death");
        eventLabels.put("RELATIVE_DEATH",  "Relative Death");

        List<SocialClaim> all = socialClaimRepository.findAll();
        List<SocialClaim> paid = all.stream()
                .filter(c -> c.getStatus() == SocialClaim.ClaimStatus.PAID)
                .collect(Collectors.toList());
        long pending = all.stream()
                .filter(c -> c.getStatus() == SocialClaim.ClaimStatus.PENDING
                          || c.getStatus() == SocialClaim.ClaimStatus.APPROVED)
                .count();

        BigDecimal totalPaid = paid.stream().map(SocialClaim::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = paid.isEmpty() ? BigDecimal.ZERO
                : totalPaid.divide(BigDecimal.valueOf(paid.size()), 0, RoundingMode.HALF_UP);

        List<Map<String, Object>> byType = eventLabels.entrySet().stream().map(e -> {
            List<SocialClaim> typed = paid.stream()
                    .filter(c -> c.getEventType().name().equals(e.getKey()))
                    .collect(Collectors.toList());
            BigDecimal total = typed.stream().map(SocialClaim::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> pt = new LinkedHashMap<>();
            pt.put("type", e.getKey()); pt.put("name", e.getValue());
            pt.put("count", typed.size()); pt.put("value", total);
            return pt;
        }).filter(pt -> (int) pt.get("count") > 0).collect(Collectors.toList());

        List<Map<String, Object>> recent = all.stream()
                .sorted(Comparator.comparing((SocialClaim c) -> {
                    if (c.getPaidAt() != null) return c.getPaidAt();
                    if (c.getApprovedAt() != null) return c.getApprovedAt();
                    return c.getCreatedAt();
                }).reversed())
                .limit(15)
                .map(c -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("memberName", c.getMember().getFirstName() + " " + c.getMember().getLastName());
                    row.put("label", eventLabels.getOrDefault(c.getEventType().name(), c.getEventType().name()));
                    row.put("amount", c.getAmount());
                    row.put("status", c.getStatus().name());
                    LocalDateTime displayDate = c.getPaidAt() != null ? c.getPaidAt()
                            : c.getApprovedAt() != null ? c.getApprovedAt() : c.getCreatedAt();
                    row.put("date", displayDate.toLocalDate().toString());
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalPaid", totalPaid);
        data.put("totalClaims", paid.size());
        data.put("pendingClaims", pending);
        data.put("avgPerClaim", avg);
        data.put("byEventType", byType);
        data.put("recentClaims", recent);
        return data;
    }

    // ── Contribution Ledger ──────────────────────────────────────────────────
    public Map<String, Object> getContributionLedgerData() {
        List<Contribution> all = contributionRepository.findAll();
        String[] colors = {"#3b82f6", "#10b981", "#f59e0b", "#ef4444"};
        Map<String, String> typeLabels = new LinkedHashMap<>();
        typeLabels.put("SOCIAL",            "Cotisation Sociale");
        typeLabels.put("FRAIS_BANCAIRE",     "Frais Bancaires");
        typeLabels.put("OBLIGATORY_RESERVE", "Réserve Obligatoire");
        typeLabels.put("PENALTY",            "Pénalités");

        BigDecimal totalCollected = BigDecimal.ZERO;
        List<Map<String, Object>> summary = new ArrayList<>();
        int ci = 0;
        for (Map.Entry<String, String> e : typeLabels.entrySet()) {
            List<Contribution> typed = all.stream()
                    .filter(c -> c.getType().name().equals(e.getKey()))
                    .collect(Collectors.toList());
            BigDecimal total = typed.stream().map(Contribution::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalCollected = totalCollected.add(total);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("type", e.getKey()); row.put("name", e.getValue());
            row.put("total", total); row.put("count", typed.size());
            row.put("color", colors[ci % colors.length]);
            summary.add(row); ci++;
        }

        List<Map<String, Object>> recent = all.stream()
                .sorted(Comparator.comparing(Contribution::getDatePaid).reversed())
                .limit(20)
                .map(c -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("memberName", c.getMember().getFirstName() + " " + c.getMember().getLastName());
                    row.put("label", typeLabels.getOrDefault(c.getType().name(), c.getType().name()));
                    row.put("type", c.getType().name());
                    row.put("amount", c.getAmount());
                    row.put("period", c.getMonth() + "/" + c.getYear());
                    row.put("date", c.getDatePaid().toLocalDate().toString());
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("summary", summary);
        data.put("totalCollected", totalCollected);
        data.put("recentContributions", recent);
        return data;
    }

    // ── Penalty Summary ──────────────────────────────────────────────────────
    public Map<String, Object> getPenaltySummaryData() {
        List<Penalty> all = penaltyRepository.findAll();
        BigDecimal amtActive = BigDecimal.ZERO, amtPaid = BigDecimal.ZERO, amtWaived = BigDecimal.ZERO;
        int cntActive = 0, cntPaid = 0, cntWaived = 0;
        for (Penalty p : all) {
            switch (p.getStatus()) {
                case ACTIVE -> { amtActive = amtActive.add(p.getAmount()); cntActive++; }
                case PAID   -> { amtPaid   = amtPaid.add(p.getAmount());   cntPaid++;   }
                case WAIVED -> { amtWaived = amtWaived.add(p.getAmount()); cntWaived++; }
            }
        }

        Map<String, String> typeLabels = new LinkedHashMap<>();
        typeLabels.put("LATE_15D",       "Late 15 Days");
        typeLabels.put("LATE_30D",       "Late 30 Days");
        typeLabels.put("ANNUAL_DEFICIT", "Annual Deficit");
        typeLabels.put("OTHER",          "Other");

        List<Map<String, Object>> breakdown = typeLabels.entrySet().stream().map(e -> {
            List<Penalty> typed = all.stream()
                    .filter(p -> p.getType().name().equals(e.getKey()))
                    .collect(Collectors.toList());
            if (typed.isEmpty()) return null;
            BigDecimal collected = typed.stream()
                    .filter(p -> p.getStatus() == Penalty.PenaltyStatus.PAID)
                    .map(Penalty::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("label", e.getValue());
            row.put("active", (int) typed.stream().filter(p -> p.getStatus() == Penalty.PenaltyStatus.ACTIVE).count());
            row.put("paid",   (int) typed.stream().filter(p -> p.getStatus() == Penalty.PenaltyStatus.PAID).count());
            row.put("waived", (int) typed.stream().filter(p -> p.getStatus() == Penalty.PenaltyStatus.WAIVED).count());
            row.put("collected", collected);
            return row;
        }).filter(Objects::nonNull).collect(Collectors.toList());

        List<Map<String, Object>> active = all.stream()
                .filter(p -> p.getStatus() == Penalty.PenaltyStatus.ACTIVE)
                .sorted(Comparator.comparing(Penalty::getCreatedAt).reversed())
                .map(p -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("memberName", p.getMember().getFirstName() + " " + p.getMember().getLastName());
                    row.put("label", typeLabels.getOrDefault(p.getType().name(), p.getType().name()));
                    row.put("amount", p.getAmount());
                    // Use paidAt if settled, otherwise show the issue date (createdAt)
                    LocalDateTime displayDate = p.getPaidAt() != null ? p.getPaidAt() : p.getCreatedAt();
                    row.put("date", displayDate.toLocalDate().toString());
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("countActive", cntActive); data.put("countPaid", cntPaid); data.put("countWaived", cntWaived);
        data.put("amountOutstanding", amtActive); data.put("amountCollected", amtPaid); data.put("amountWaived", amtWaived);
        data.put("breakdown", breakdown);
        data.put("activePenalties", active);
        return data;
    }

    // ── Annual Audit Report ──────────────────────────────────────────────────
    public Map<String, Object> getAnnualAuditData(int year) {
        // Overview
        long memberCount = countActiveContributingMembers();
        BigDecimal totalSharesPool = shareRecordRepository.findAll().stream()
                .map(ShareRecord::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sharesAddedInYear = shareRecordRepository.findAll().stream()
                .filter(s -> s.getDateBought() != null && s.getDateBought().getYear() == year)
                .map(ShareRecord::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal activeLoansOutstanding = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE).stream()
                .map(Loan::getRemainingPrincipal).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Loans disbursed in year
        List<Loan> loansInYear = loanRepository.findAll().stream()
                .filter(l -> l.getDisbursementDate() != null && l.getDisbursementDate().getYear() == year)
                .collect(Collectors.toList());
        BigDecimal totalPrincipalDisbursed = loansInYear.stream()
                .map(Loan::getPrincipalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Repayments collected in year
        List<LoanRepayment> repaymentsInYear = loanRepaymentRepository.findAll().stream()
                .filter(r -> r.getPaymentDate() != null && r.getPaymentDate().getYear() == year
                        && !"AMENDED".equals(r.getAmendmentStatus()))
                .collect(Collectors.toList());
        BigDecimal totalPrincipalRepaid = repaymentsInYear.stream()
                .map(LoanRepayment::getPrincipalPaid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInterestRepaid = repaymentsInYear.stream()
                .map(LoanRepayment::getInterestPaid).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Interest snapshots in year
        List<InterestSnapshot> snapshotsInYear = interestSnapshotRepository.findAll().stream()
                .filter(s -> s.getSnapshotDate() != null && s.getSnapshotDate().getYear() == year)
                .collect(Collectors.toList());
        BigDecimal totalInterestExpected = BigDecimal.ZERO;
        BigDecimal totalInterestDistributed = BigDecimal.ZERO;
        for (InterestSnapshot snap : snapshotsInYear) {
            for (SnapshotMember sm : snap.getMembers()) {
                totalInterestExpected = totalInterestExpected.add(sm.getExpectedInterestAmount());
                totalInterestDistributed = totalInterestDistributed.add(sm.getPaidInterestAmount());
            }
        }

        // Contributions by type in year
        List<Contribution> contribsInYear = contributionRepository.findAll().stream()
                .filter(c -> c.getYear() != null && c.getYear() == year)
                .collect(Collectors.toList());
        Map<String, BigDecimal> contribsByType = new LinkedHashMap<>();
        for (Contribution.ContributionType ct : Contribution.ContributionType.values()) {
            BigDecimal sum = contribsInYear.stream()
                    .filter(c -> c.getType() == ct)
                    .map(Contribution::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            contribsByType.put(ct.name(), sum);
        }
        BigDecimal totalContributions = contribsByType.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        // Social fund payouts in year — filter by paidAt so the year reflects when money left
        List<SocialClaim> socialInYear = socialClaimRepository.findAll().stream()
                .filter(c -> c.getStatus() == SocialClaim.ClaimStatus.PAID
                        && c.getPaidAt() != null && c.getPaidAt().getYear() == year)
                .collect(Collectors.toList());
        BigDecimal socialPaid = socialInYear.stream()
                .map(SocialClaim::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long socialClaimsCount = (long) socialInYear.size();

        // Expenses in year
        BigDecimal totalExpenses = groupExpenseRepository.findAll().stream()
                .filter(e -> e.getDate() != null && e.getDate().getYear() == year)
                .map(GroupExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long expenseCount = groupExpenseRepository.findAll().stream()
                .filter(e -> e.getDate() != null && e.getDate().getYear() == year).count();

        // Penalties issued in year (by creation/issue date)
        List<Penalty> penaltiesInYear = penaltyRepository.findAll().stream()
                .filter(p -> p.getCreatedAt() != null && p.getCreatedAt().getYear() == year)
                .collect(Collectors.toList());
        BigDecimal penaltiesIssued = penaltiesInYear.stream()
                .map(Penalty::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        // Penalties collected in year — filter by paidAt so the year reflects when money was received
        BigDecimal penaltiesCollected = penaltyRepository.findAll().stream()
                .filter(p -> p.getStatus() == Penalty.PenaltyStatus.PAID
                        && p.getPaidAt() != null && p.getPaidAt().getYear() == year)
                .map(Penalty::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Net income = interest collected + contributions - social payouts - expenses
        BigDecimal netIncome = totalInterestRepaid.add(totalContributions)
                .subtract(socialPaid).subtract(totalExpenses);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("year", year);
        data.put("memberCount", memberCount);
        data.put("totalSharesPool", totalSharesPool);
        data.put("sharesAddedInYear", sharesAddedInYear);
        data.put("activeLoansOutstanding", activeLoansOutstanding);
        data.put("loansCount", (long) loansInYear.size());
        data.put("totalPrincipalDisbursed", totalPrincipalDisbursed);
        data.put("totalPrincipalRepaid", totalPrincipalRepaid);
        data.put("totalInterestRepaid", totalInterestRepaid);
        data.put("repaymentCount", (long) repaymentsInYear.size());
        data.put("snapshotCount", (long) snapshotsInYear.size());
        data.put("totalInterestExpected", totalInterestExpected);
        data.put("totalInterestDistributed", totalInterestDistributed);
        data.put("contribsByType", contribsByType);
        data.put("totalContributions", totalContributions);
        data.put("socialPaid", socialPaid);
        data.put("socialClaimsCount", socialClaimsCount);
        data.put("totalExpenses", totalExpenses);
        data.put("expenseCount", expenseCount);
        data.put("penaltiesIssued", penaltiesIssued);
        data.put("penaltiesCollected", penaltiesCollected);
        data.put("penaltyCount", (long) penaltiesInYear.size());
        data.put("netIncome", netIncome);
        data.put("memberShares", getMemberBalances());
        return data;
    }

    // ── Interest Accrual & Distribution ─────────────────────────────────────
    public Map<String, Object> getInterestAccrualData() {
        List<InterestSnapshot> snapshots = interestSnapshotRepository.findAll();
        BigDecimal totalExpected = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        List<Map<String, Object>> snapshotList = new ArrayList<>();

        for (InterestSnapshot snapshot : snapshots) {
            Loan loan = snapshot.getLoan();
            if (loan == null) continue;
            Member borrower = loan.getMember();
            BigDecimal snapshotExpected = BigDecimal.ZERO;
            BigDecimal snapshotPaid = BigDecimal.ZERO;
            List<Map<String, Object>> distributions = new ArrayList<>();

            for (SnapshotMember sm : snapshot.getMembers()) {
                snapshotExpected = snapshotExpected.add(sm.getExpectedInterestAmount());
                snapshotPaid = snapshotPaid.add(sm.getPaidInterestAmount());
                BigDecimal pending = sm.getExpectedInterestAmount()
                        .subtract(sm.getPaidInterestAmount()).max(BigDecimal.ZERO);
                Map<String, Object> dist = new LinkedHashMap<>();
                dist.put("memberName", sm.getMember().getFirstName() + " " + sm.getMember().getLastName());
                dist.put("sharesAtTime", sm.getSharesAtTime());
                dist.put("expectedInterest", sm.getExpectedInterestAmount());
                dist.put("paidInterest", sm.getPaidInterestAmount());
                dist.put("cashedOut", sm.getCashedOutInterestAmount());
                dist.put("pending", pending);
                distributions.add(dist);
            }
            distributions.sort((a, b) ->
                    ((BigDecimal) b.get("expectedInterest")).compareTo((BigDecimal) a.get("expectedInterest")));

            totalExpected = totalExpected.add(snapshotExpected);
            totalPaid = totalPaid.add(snapshotPaid);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("loanNumber", loan.getLoanNumber() != null ? loan.getLoanNumber()
                    : loan.getId().toString().substring(0, 8).toUpperCase());
            row.put("borrowerName", borrower.getFirstName() + " " + borrower.getLastName());
            row.put("principalAmount", loan.getPrincipalAmount());
            row.put("totalInterest", loan.getTotalInterestAmount());
            row.put("snapshotDate", snapshot.getSnapshotDate() != null
                    ? snapshot.getSnapshotDate().toLocalDate().toString() : "N/A");
            row.put("loanStatus", loan.getStatus().name());
            row.put("snapshotExpected", snapshotExpected);
            row.put("snapshotPaid", snapshotPaid);
            row.put("snapshotPending", snapshotExpected.subtract(snapshotPaid).max(BigDecimal.ZERO));
            row.put("distributionCount", (long) distributions.size());
            row.put("distributions", distributions);
            snapshotList.add(row);
        }
        snapshotList.sort((a, b) -> ((String) b.get("snapshotDate")).compareTo((String) a.get("snapshotDate")));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("snapshots", snapshotList);
        data.put("totalExpected", totalExpected);
        data.put("totalPaid", totalPaid);
        data.put("totalPending", totalExpected.subtract(totalPaid).max(BigDecimal.ZERO));
        data.put("totalLoans", (long) snapshotList.size());
        return data;
    }

    // ── Guarantor (Umuwishingizi) Report ─────────────────────────────────────
    public List<Map<String, Object>> getGuarantorData() {
        List<LoanApplication> applications = loanApplicationRepository.findAll().stream()
                .filter(app -> app.getGuarantor() != null
                        && app.getStatus() == LoanApplication.ApplicationStatus.DISBURSED)
                .collect(Collectors.toList());

        Map<UUID, List<LoanApplication>> byGuarantor = applications.stream()
                .collect(Collectors.groupingBy(app -> app.getGuarantor().getId()));

        return byGuarantor.entrySet().stream().map(entry -> {
            Member guarantor = entry.getValue().get(0).getGuarantor();
            List<Map<String, Object>> loans = entry.getValue().stream().map(app -> {
                Optional<Loan> activeLoan = loanRepository.findByMemberIdAndStatus(
                        app.getMember().getId(), Loan.LoanStatus.ACTIVE);
                Loan loan = activeLoan.orElse(
                        loanRepository.findByMemberId(app.getMember().getId()).stream()
                                .max(Comparator.comparing(l ->
                                        l.getCreatedAt() != null ? l.getCreatedAt() : LocalDateTime.MIN))
                                .orElse(null));
                BigDecimal remaining = loan != null
                        ? loan.getRemainingPrincipal().add(loan.getRemainingInterest())
                        : BigDecimal.ZERO;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("borrowerName", app.getMember().getFirstName() + " " + app.getMember().getLastName());
                row.put("loanNumber", loan != null && loan.getLoanNumber() != null ? loan.getLoanNumber()
                        : app.getLoanNumber() != null ? app.getLoanNumber()
                        : app.getId().toString().substring(0, 8).toUpperCase());
                row.put("principalAmount", app.getRequestedAmount());
                row.put("loanStatus", loan != null ? loan.getStatus().name() : "ACTIVE");
                row.put("remainingAmount", remaining);
                row.put("applicationDate", app.getCreatedAt() != null
                        ? app.getCreatedAt().toLocalDate().toString() : "N/A");
                return row;
            }).collect(Collectors.toList());

            BigDecimal totalExposure = loans.stream()
                    .map(l -> (BigDecimal) l.get("remainingAmount"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            boolean hasActive = loans.stream()
                    .anyMatch(l -> "ACTIVE".equals(l.get("loanStatus")));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("guarantorName", guarantor.getFirstName() + " " + guarantor.getLastName());
            row.put("guaranteedLoans", loans);
            row.put("totalLoans", (long) loans.size());
            row.put("totalExposure", totalExposure);
            row.put("hasActive", hasActive);
            return row;
        })
        .sorted((a, b) -> ((BigDecimal) b.get("totalExposure")).compareTo((BigDecimal) a.get("totalExposure")))
        .collect(Collectors.toList());
    }

    // ── Negative Interest Report ─────────────────────────────────────────────
    public Map<String, Object> getNegativeInterestData(int year) {
        BigDecimal threshold = systemConfigRepository.findByConfigKey("ANNUAL_INTEREST_DEDUCTION")
                .map(c -> new BigDecimal(c.getConfigValue()))
                .orElse(new BigDecimal("45000"));

        List<Map<String, Object>> members = new ArrayList<>();
        BigDecimal totalDeficit = BigDecimal.ZERO;

        for (Member m : memberRepository.findAll()) {
            if (m.getType() == Member.MemberType.SOCIAL) continue;
            BigDecimal annualInterest = snapshotMemberRepository.findByMemberId(m.getId()).stream()
                    .filter(sm -> sm.getSnapshot().getSnapshotDate() != null
                            && sm.getSnapshot().getSnapshotDate().getYear() == year)
                    .map(SnapshotMember::getPaidInterestAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (annualInterest.compareTo(threshold) < 0) {
                BigDecimal deficit = threshold.subtract(annualInterest);
                totalDeficit = totalDeficit.add(deficit);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("memberName", m.getFirstName() + " " + m.getLastName());
                row.put("earned", annualInterest);
                row.put("deficit", deficit);
                members.add(row);
            }
        }
        members.sort((a, b) -> ((BigDecimal) b.get("deficit")).compareTo((BigDecimal) a.get("deficit")));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("year", year);
        data.put("threshold", threshold);
        data.put("members", members);
        data.put("totalDeficit", totalDeficit);
        data.put("affectedCount", (long) members.size());
        return data;
    }

    // ── Audit Log ─────────────────────────────────────────────────────────────
    public Map<String, Object> getAuditLogData(int page) {
        int size = 50;
        org.springframework.data.domain.Page<AuditLog> pageResult =
                auditLogRepository.findAllByOrderByTimestampDesc(PageRequest.of(page, size));
        List<Map<String, Object>> logs = pageResult.getContent().stream().map(log -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("actorName", log.getActor() != null
                    ? log.getActor().getFirstName() + " " + log.getActor().getLastName()
                    : "System");
            row.put("action", log.getAction());
            row.put("targetType", log.getTargetType());
            row.put("targetId", log.getTargetId() != null ? log.getTargetId() : "");
            row.put("message", log.getMessage() != null ? log.getMessage() : "");
            row.put("timestamp", log.getTimestamp().toString());
            return row;
        }).collect(Collectors.toList());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("logs", logs);
        data.put("total", pageResult.getTotalElements());
        data.put("page", page);
        data.put("totalPages", pageResult.getTotalPages());
        return data;
    }

    private Map<String, Object> createDataPoint(String name, BigDecimal value) {
        Map<String, Object> point = new HashMap<>();
        point.put("name", name);
        point.put("value", value);
        return point;
    }
}
