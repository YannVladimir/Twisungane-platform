package com.twisungane.controller;

import com.twisungane.entity.*;
import com.twisungane.repository.*;
import com.twisungane.service.PdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportingController {

    private final PdfService pdfService;
    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final LoanRepository loanRepository;
    private final PenaltyRepository penaltyRepository;
    private final ContributionRepository contributionRepository;
    private final GroupExpenseRepository groupExpenseRepository;
    private final com.twisungane.service.ReportingService reportingService;

    @GetMapping("/data/my-shares")
    public ResponseEntity<Map<String, Object>> getMyShares(@RequestParam UUID memberId) {
        java.math.BigDecimal total = shareRecordRepository.findByMemberId(memberId).stream()
                .map(com.twisungane.entity.ShareRecord::getAmount)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("hasShares", total.compareTo(java.math.BigDecimal.ZERO) > 0);
        result.put("totalShares", total);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/member-statement")
    public ResponseEntity<byte[]> getMemberStatement(@RequestParam UUID memberId) {
        Member m = memberRepository.findById(memberId).orElseThrow();
        
        byte[] pdf = pdfService.generateMemberStatement(
            m,
            shareRecordRepository.findByMemberId(memberId),
            loanRepository.findByMemberId(memberId),
            penaltyRepository.findByMemberId(memberId)
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=statement_" + memberId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/monthly-status")
    public ResponseEntity<byte[]> getMonthlyStatus(@RequestParam int month, @RequestParam int year) {
        BigDecimal totalShares = shareRecordRepository.findAll().stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalLoans = loanRepository.findAll().stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE)
                .map(Loan::getRemainingPrincipal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int memberCount = (int) reportingService.countActiveContributingMembers();

        // Per-member shares breakdown, sorted descending by value
        BigDecimal shareUnit = new BigDecimal("100000");
        List<Map<String, Object>> memberSharesList = memberRepository.findAll().stream()
                .filter(m -> m.getType() != Member.MemberType.SOCIAL)
                .map(m -> {
                    BigDecimal value = shareRecordRepository.findByMemberId(m.getId()).stream()
                            .map(ShareRecord::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", m.getFirstName() + " " + m.getLastName());
                    row.put("count", value.divideToIntegralValue(shareUnit).intValue());
                    row.put("value", value);
                    return row;
                })
                .filter(row -> ((BigDecimal) row.get("value")).compareTo(BigDecimal.ZERO) > 0)
                .sorted((a, b) -> ((BigDecimal) b.get("value")).compareTo((BigDecimal) a.get("value")))
                .collect(Collectors.toList());

        // Contributions for the month, grouped by type
        List<Contribution> monthContribs = contributionRepository.findByMonthAndYear(month, year);
        Map<String, BigDecimal> contribTotals = new LinkedHashMap<>();
        for (Contribution.ContributionType ct : Contribution.ContributionType.values()) {
            BigDecimal sum = monthContribs.stream()
                    .filter(c -> c.getType() == ct)
                    .map(Contribution::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            contribTotals.put(ct.name(), sum);
        }

        // Expenditures for the month
        List<GroupExpense> monthExpenses = groupExpenseRepository.findAll().stream()
                .filter(e -> e.getDate().getMonthValue() == month && e.getDate().getYear() == year)
                .sorted(Comparator.comparing(GroupExpense::getDate))
                .collect(Collectors.toList());

        byte[] pdf = pdfService.generateMonthlyStatusReport(
            month, year, totalShares, totalLoans, memberCount,
            memberSharesList, contribTotals, monthExpenses
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=monthly_report_" + month + "_" + year + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/data/monthly-status")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getMonthlyStatusData(@RequestParam int month, @RequestParam int year) {
        return ResponseEntity.ok(reportingService.getMonthlyStatusData(month, year));
    }

    @GetMapping("/data/member-balances")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<Map<String, Object>>> getMemberBalancesData() {
        return ResponseEntity.ok(reportingService.getMemberBalances());
    }

    @GetMapping("/data/loan-aging")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<Map<String, Object>>> getLoanAgingData() {
        return ResponseEntity.ok(reportingService.getLoanAgingData());
    }

    @GetMapping("/data/loan-demand")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getLoanDemandForecast() {
        return ResponseEntity.ok(reportingService.getLoanDemandForecast());
    }

    @GetMapping("/data/yield-analysis")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getYieldAnalysisData(
            @RequestParam(defaultValue = "2025") int year) {
        return ResponseEntity.ok(reportingService.getYieldAnalysisData(year));
    }

    @GetMapping("/data/outstanding-loans")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<Map<String, Object>>> getOutstandingLoans() {
        return ResponseEntity.ok(reportingService.getOutstandingLoansData());
    }

    @GetMapping("/data/social-fund")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getSocialFundData() {
        return ResponseEntity.ok(reportingService.getSocialFundData());
    }

    @GetMapping("/data/contribution-ledger")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getContributionLedger() {
        return ResponseEntity.ok(reportingService.getContributionLedgerData());
    }

    @GetMapping("/data/penalty-summary")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getPenaltySummary() {
        return ResponseEntity.ok(reportingService.getPenaltySummaryData());
    }

    @GetMapping("/data/annual-audit")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getAnnualAuditData(
            @RequestParam(defaultValue = "2025") int year) {
        return ResponseEntity.ok(reportingService.getAnnualAuditData(year));
    }

    @GetMapping("/annual-audit")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<byte[]> downloadAnnualAudit(@RequestParam int year) {
        Map<String, Object> d = reportingService.getAnnualAuditData(year);

        List<GroupExpense> expenses = groupExpenseRepository.findAll().stream()
                .filter(e -> e.getDate() != null && e.getDate().getYear() == year)
                .sorted(java.util.Comparator.comparing(GroupExpense::getDate))
                .collect(java.util.stream.Collectors.toList());

        @SuppressWarnings("unchecked")
        java.util.List<Map<String, Object>> memberShares =
                (java.util.List<Map<String, Object>>) d.get("memberShares");

        byte[] pdf = pdfService.generateAnnualAuditReport(
                year,
                ((Number) d.get("memberCount")).longValue(),
                (BigDecimal) d.get("totalSharesPool"),
                (BigDecimal) d.get("sharesAddedInYear"),
                (BigDecimal) d.get("activeLoansOutstanding"),
                ((Number) d.get("loansCount")).longValue(),
                (BigDecimal) d.get("totalPrincipalDisbursed"),
                (BigDecimal) d.get("totalPrincipalRepaid"),
                (BigDecimal) d.get("totalInterestRepaid"),
                ((Number) d.get("snapshotCount")).longValue(),
                (BigDecimal) d.get("totalInterestExpected"),
                (BigDecimal) d.get("totalInterestDistributed"),
                (java.util.Map<String, BigDecimal>) d.get("contribsByType"),
                (BigDecimal) d.get("totalContributions"),
                (BigDecimal) d.get("socialPaid"),
                ((Number) d.get("socialClaimsCount")).longValue(),
                expenses,
                (BigDecimal) d.get("totalExpenses"),
                (BigDecimal) d.get("penaltiesIssued"),
                (BigDecimal) d.get("penaltiesCollected"),
                ((Number) d.get("penaltyCount")).longValue(),
                (BigDecimal) d.get("netIncome"),
                memberShares
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=annual_audit_" + year + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/data/interest-accrual")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getInterestAccrualData() {
        return ResponseEntity.ok(reportingService.getInterestAccrualData());
    }

    @GetMapping("/data/guarantors")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<Map<String, Object>>> getGuarantorData() {
        return ResponseEntity.ok(reportingService.getGuarantorData());
    }

    @GetMapping("/data/negative-interest")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Map<String, Object>> getNegativeInterestData(
            @RequestParam(defaultValue = "2025") int year) {
        return ResponseEntity.ok(reportingService.getNegativeInterestData(year));
    }

    @GetMapping("/data/audit-log")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getAuditLogData(
            @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(reportingService.getAuditLogData(page));
    }
}
