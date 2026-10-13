package com.twisungane.config;

import com.twisungane.entity.Loan;
import com.twisungane.entity.Member;
import com.twisungane.entity.Penalty;
import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.LoanRepository;
import com.twisungane.repository.LoanRepaymentRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.service.PenaltyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class AutomationScheduler {

    private final LoanRepository loanRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final PenaltyService penaltyService;
    private final SystemConfigRepository configRepository;
    private final MemberRepository memberRepository;

    /**
     * Daily check for late payments. Runs at 1 AM.
     */
    @Scheduled(cron = "0 0 1 * * ?")
    @Transactional
    public void checkLatePayments() {
        log.info("Starting automated late payment detection...");
        List<Loan> activeLoans = loanRepository.findByStatus(Loan.LoanStatus.ACTIVE);

        for (Loan loan : activeLoans) {
            processLoanPenalty(loan);
        }
    }

    private void processLoanPenalty(Loan loan) {
        // Calculate expected number of installments that SHOULD have been paid
        long daysSinceDisbursement = ChronoUnit.DAYS.between(loan.getDisbursementDate(), LocalDate.now());
        long expectedInstallments = daysSinceDisbursement / 30;
        
        // Count actual payments (excluding superseded AMENDED records)
        long actualInstallments = repaymentRepository.findByLoanId(loan.getId()).stream()
                .filter(r -> !"AMENDED".equals(r.getAmendmentStatus()))
                .count();

        if (actualInstallments < expectedInstallments) {
            // Member is late. Calculate grace period.
            LocalDate dueDate = loan.getDisbursementDate().plusDays(actualInstallments * 30 + 30);
            long daysLate = ChronoUnit.DAYS.between(dueDate, LocalDate.now());

            if (daysLate >= 30) {
                applyOrUpdatePenalty(loan, Penalty.PenaltyType.LATE_30D, "5000", daysLate);
            } else if (daysLate >= 15) {
                applyOrUpdatePenalty(loan, Penalty.PenaltyType.LATE_15D, "2000", daysLate);
            }
        }
    }

    private void applyOrUpdatePenalty(Loan loan, Penalty.PenaltyType type, String defaultAmount, long daysLate) {
        BigDecimal amount = new BigDecimal(configRepository.findByConfigKey("PENALTY_" + type.name())
                .map(SystemConfig::getConfigValue).orElse(defaultAmount));
        
        // Check if this specific penalty type already exists for this loan and is active
        boolean exists = penaltyService.getUnpaid(loan.getMember().getId()).stream()
                .anyMatch(p -> p.getLoan() != null && p.getLoan().getId().equals(loan.getId()) && p.getType() == type);

        if (!exists) {
            penaltyService.applyPenalty(
                loan.getMember(), 
                loan.getId(), 
                amount, 
                type, 
                "Automated penalty: " + daysLate + " days late on installment."
            );
        }
    }

    /**
     * Annual Deduction. Runs on December 31st at 11 PM.
     */
    @Scheduled(cron = "0 0 23 31 12 ?")
    @Transactional
    public void processAnnualDeductions() {
        log.info("Starting annual deduction cycle (December 31st)...");
        List<Member> activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.MemberStatus.ACTIVE)
                .collect(Collectors.toList());
        
        BigDecimal reserveFee = new BigDecimal(configRepository.findByConfigKey("DEDUCTION_RESERVE").map(SystemConfig::getConfigValue).orElse("25000"));
        BigDecimal socialFee = new BigDecimal(configRepository.findByConfigKey("DEDUCTION_SOCIAL").map(SystemConfig::getConfigValue).orElse("18000"));
        BigDecimal bankFee = new BigDecimal(configRepository.findByConfigKey("DEDUCTION_BANK").map(SystemConfig::getConfigValue).orElse("2000"));
        
        BigDecimal totalDeduction = reserveFee.add(socialFee).add(bankFee);

        for (Member member : activeMembers) {
            // Logic to deduct from interest balance
            // For now, we apply it as a penalty/debt if interest is unavailable
            penaltyService.applyPenalty(
                member, 
                null, 
                totalDeduction, 
                Penalty.PenaltyType.ANNUAL_DEFICIT, 
                "Mandatory Annual Deduction (Reserve/Social/Bank)"
            );
        }
    }
}
