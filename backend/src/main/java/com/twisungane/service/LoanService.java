package com.twisungane.service;

import com.twisungane.entity.*;
import com.twisungane.dto.LoanApplicationDTO;
import com.twisungane.dto.LoanDTO;
import com.twisungane.dto.LoanRepaymentDTO;
import com.twisungane.dto.ScheduleEntryDTO;
import com.twisungane.repository.*;
import com.twisungane.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanApplicationRepository applicationRepository;
    private final LoanRepository loanRepository;
    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final InterestSnapshotRepository snapshotRepository;
    private final SystemConfigRepository configRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final LoanProductRepository productRepository;
    private final MemberService memberService;
    private final DashboardService dashboardService;
    private final AuditService auditService;
    private final FileStorageService fileStorageService;

    public List<LoanDTO> getAllLoans(UUID memberId) {
        List<Loan> loans = memberId != null ? 
                loanRepository.findByMemberId(memberId) : 
                loanRepository.findAll();
        return loans.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    public List<LoanApplicationDTO> getApplications(UUID memberId) {
        List<LoanApplication> apps = memberId != null ? 
                applicationRepository.findByMemberId(memberId) : 
                applicationRepository.findAll();
        return apps.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    public BigDecimal calculateMaxLoanAmount(UUID memberId) {
        Member member = memberRepository.findById(memberId).orElseThrow();
        BigDecimal totalShares = getTotalShares(member);
        
        // Rules from statutes (Art. 2.3) — thresholds and bonuses are configurable
        double shareCount = totalShares.divide(getConfig("SHARE_PRICE", "100000"), 2, RoundingMode.DOWN).doubleValue();

        if (shareCount < 1) return BigDecimal.ZERO;
        if (shareCount <= 7.5) return totalShares.multiply(getConfig("LOAN_ELIGIBILITY_MULTIPLIER", "2"));
        if (shareCount <= 10.5) return totalShares.add(getConfig("LOAN_ELIGIBILITY_BONUS_MID", "700000"));
        return totalShares.add(getConfig("LOAN_ELIGIBILITY_BONUS_HIGH", "1000000"));
    }

    public String checkEligibility(UUID memberId, boolean isAdmin) {
        Member member = memberRepository.findById(memberId).orElseThrow();
        
        // 1. Check for active loans (skip for admin — historical import replays sequential loans)
        if (!isAdmin && loanRepository.findByMemberIdAndStatus(memberId, Loan.LoanStatus.ACTIVE).isPresent()) {
            return "Member has an active loan in repayment.";
        }

        // 2. [Obligatory Reserve check disabled — introduced retroactively, not enforced during historical data entry]

        // 3. Check wait period (180 days for SPECIAL, 15 days standard)
        if (!isAdmin) {
            long daysActive = ChronoUnit.DAYS.between(member.getJoinDate(), LocalDate.now());
            if (member.getType() == Member.MemberType.SPECIAL) {
                if (daysActive < 180) {
                    return "SPECIAL members must wait 180 days before applying for a loan (Joined: " + member.getJoinDate() + ").";
                }
            } else {
                if (daysActive < 15) {
                    return "Member is still in the 15-day waiting period (Joined: " + member.getJoinDate() + ").";
                }
            }
        }

        return null; // Eligible
    }

    @Transactional
    public LoanApplicationDTO apply(UUID memberId, Long productId, BigDecimal amount, String purpose, boolean isAdmin, LocalDate issuedDate, String loanNumber, UUID guarantorId) {
        String ineligibilityReason = checkEligibility(memberId, isAdmin);
        if (ineligibilityReason != null) throw new RuntimeException(ineligibilityReason);
        
        // Amount limit and increment checks are skipped for admin (historical import bypasses these)
        if (!isAdmin) {
            LocalDate cutoff = LocalDate.of(2025, 1, 1);
            boolean applyLimit = issuedDate == null || !issuedDate.isBefore(cutoff);
            if (applyLimit) {
                BigDecimal max = calculateMaxLoanAmount(memberId);
                if (amount.compareTo(max) > 0) throw new RuntimeException("Requested amount exceeds limit of " + max);
            }

            BigDecimal fiftyK = new BigDecimal("50000");
            if (amount.remainder(fiftyK).compareTo(BigDecimal.ZERO) != 0) {
                throw new RuntimeException("Loan amount must be a multiple of 50,000 FRW.");
            }
        }

        Member member = memberRepository.findById(memberId).orElseThrow();
        LoanProduct product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Loan product not found"));
        
        Member guarantor = null;
        if (guarantorId != null) {
            if (guarantorId.equals(memberId)) {
                throw new RuntimeException("A member cannot be their own guarantor.");
            }
            guarantor = memberRepository.findById(guarantorId)
                    .orElseThrow(() -> new RuntimeException("Guarantor not found."));
            if (guarantor.getStatus() != Member.MemberStatus.ACTIVE) {
                throw new RuntimeException("Guarantor must be an ACTIVE member.");
            }
        } else if (product.isRequiresGuarantor() && !isAdmin) {
            throw new RuntimeException("This loan product requires a guarantor.");
        }

        LoanApplication app = LoanApplication.builder()
                .member(member)
                .product(product)
                .requestedAmount(amount)
                .issuedDate(issuedDate != null ? issuedDate : LocalDate.now())
                .purpose(purpose)
                .loanNumber(loanNumber)
                .guarantor(guarantor)
                .status(LoanApplication.ApplicationStatus.PENDING)
                .build();
        
        LoanApplication saved = applicationRepository.save(app);

        auditService.log(
            "LOAN_APPLICATION_SUBMITTED",
            "LOAN_APPLICATION",
            saved.getId().toString(),
            String.format("New loan application submitted for %s: %s FRW (%s)", member.getFirstName(), amount, product.getName())
        );

        // HISTORICAL-IMPORT SHORTCUT: admin applications skip approve/disburse steps
        // and are disbursed immediately. Remove this block once manual historical
        // entry is complete to restore the normal approve -> disburse workflow.
        if (isAdmin) {
            saved.setStatus(LoanApplication.ApplicationStatus.APPROVED);
            saved = applicationRepository.save(saved);
            disburse(saved.getId(), null, true);
            saved = applicationRepository.findById(saved.getId()).orElseThrow();
        }

        return convertToDTO(saved);
    }

    public LoanApplicationDTO convertToDTO(LoanApplication app) {
        return LoanApplicationDTO.builder()
                .id(app.getId())
                .memberId(app.getMember().getId())
                .memberName(app.getMember().getFirstName() + " " + app.getMember().getLastName())
                .memberNationalId(app.getMember().getNationalId())
                .productId(app.getProduct().getId())
                .productName(app.getProduct().getName())
                .requestedAmount(app.getRequestedAmount())
                .issuedDate(app.getIssuedDate())
                .purpose(app.getPurpose())
                .status(app.getStatus())
                .rejectionReason(app.getRejectionReason())
                .guarantorName(
                    app.getGuarantor() != null 
                        ? (app.getGuarantor().getFirstName() + " " + app.getGuarantor().getLastName())
                        : (app.getMember().getGuarantor() != null 
                            ? (app.getMember().getGuarantor().getFirstName() + " " + app.getMember().getGuarantor().getLastName())
                            : null)
                )
                .loanNumber(app.getLoanNumber())
                .createdAt(app.getCreatedAt())
                .build();
    }

    public LoanDTO convertToDTO(Loan loan) {
        return LoanDTO.builder()
                .id(loan.getId())
                .member(memberService.convertToDTO(loan.getMember()))
                .principalAmount(loan.getPrincipalAmount())
                .totalInterestAmount(loan.getTotalInterestAmount())
                .remainingPrincipal(loan.getRemainingPrincipal())
                .remainingInterest(loan.getRemainingInterest())
                .disbursementDate(loan.getDisbursementDate())
                .dueDate(loan.getDueDate())
                .status(loan.getStatus())
                .loanNumber(loan.getLoanNumber())
                .nextPaymentDate(calculateNextPaymentDate(loan))
                .signedContractPath(loan.getSignedContractPath())
                .build();
    }

    @Transactional
    public LoanDTO uploadSignedContract(UUID loanId, MultipartFile contract) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (loan.getSignedContractPath() != null) {
            fileStorageService.delete(loan.getSignedContractPath());
        }
        loan.setSignedContractPath(fileStorageService.store(contract));
        return convertToDTO(loanRepository.save(loan));
    }

    public org.springframework.core.io.Resource getSignedContractResource(UUID loanId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (loan.getSignedContractPath() == null) {
            throw new RuntimeException("No signed contract uploaded for this loan");
        }
        return fileStorageService.loadAsResource(loan.getSignedContractPath());
    }

    private java.time.LocalDate calculateNextPaymentDate(Loan loan) {
        if (loan.getStatus() == Loan.LoanStatus.PAID) return null;
        if (loan.getDisbursementDate() == null) return null;

        BigDecimal totalInitial = loan.getPrincipalAmount().add(loan.getTotalInterestAmount());
        BigDecimal totalRemaining = loan.getRemainingPrincipal().add(loan.getRemainingInterest());
        BigDecimal totalPaid = totalInitial.subtract(totalRemaining);

        long installmentsPaid = totalPaid.divide(getConfig("STANDARD_INSTALLMENT", "55000"), 0, RoundingMode.FLOOR).longValue();
        return loan.getDisbursementDate().plusMonths(installmentsPaid + 1);
    }

    public LoanRepaymentDTO convertToDTO(LoanRepayment repayment) {
        return LoanRepaymentDTO.builder()
                .id(repayment.getId())
                .totalAmount(repayment.getTotalAmount())
                .principalPaid(repayment.getPrincipalPaid())
                .interestPaid(repayment.getInterestPaid())
                .paymentDate(repayment.getPaymentDate())
                .transactionReference(repayment.getTransactionReference())
                .amendmentStatus(repayment.getAmendmentStatus())
                .build();
    }

    public List<LoanRepaymentDTO> getRepayments(UUID loanId) {
        return repaymentRepository.findByLoanId(loanId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<ScheduleEntryDTO> getSchedule(UUID loanId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new com.twisungane.exception.ResourceNotFoundException("Loan not found"));

        int term = 12;
        if (loan.getApplication() != null && loan.getApplication().getProduct() != null) {
            term = loan.getApplication().getProduct().getMaxTermMonths();
        }

        BigDecimal principal = loan.getPrincipalAmount();
        BigDecimal interest = loan.getTotalInterestAmount();
        BigDecimal total = principal.add(interest);

        BigDecimal schedPrincipal = principal.divide(BigDecimal.valueOf(term), 0, RoundingMode.FLOOR);
        BigDecimal schedInterest = interest.divide(BigDecimal.valueOf(term), 0, RoundingMode.FLOOR);
        BigDecimal schedInstallment = schedPrincipal.add(schedInterest);

        // Adjust last installment to cover any rounding remainder
        BigDecimal lastPrincipal = principal.subtract(schedPrincipal.multiply(BigDecimal.valueOf(term - 1)));
        BigDecimal lastInterest = interest.subtract(schedInterest.multiply(BigDecimal.valueOf(term - 1)));

        List<LoanRepayment> repayments = repaymentRepository.findByLoanId(loanId).stream()
                .filter(r -> !"AMENDED".equals(r.getAmendmentStatus()))
                .collect(Collectors.toList());
        BigDecimal cumulativePrincipalPaid = repayments.stream()
                .map(LoanRepayment::getPrincipalPaid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cumulativeInterestPaid = repayments.stream()
                .map(LoanRepayment::getInterestPaid).reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDate startDate = loan.getDisbursementDate() != null ? loan.getDisbursementDate() : LocalDate.now();

        List<ScheduleEntryDTO> schedule = new ArrayList<>();
        BigDecimal runningPrincipalBudget = cumulativePrincipalPaid;
        BigDecimal runningInterestBudget = cumulativeInterestPaid;

        for (int i = 1; i <= term; i++) {
            boolean isLast = (i == term);
            BigDecimal sp = isLast ? lastPrincipal : schedPrincipal;
            BigDecimal si = isLast ? lastInterest : schedInterest;
            BigDecimal st = sp.add(si);

            BigDecimal pPaid = runningPrincipalBudget.min(sp);
            BigDecimal iPaid = runningInterestBudget.min(si);
            BigDecimal tPaid = pPaid.add(iPaid);

            runningPrincipalBudget = runningPrincipalBudget.subtract(pPaid);
            runningInterestBudget = runningInterestBudget.subtract(iPaid);

            String status;
            if (tPaid.compareTo(st) >= 0) {
                status = "PAID";
            } else if (tPaid.compareTo(BigDecimal.ZERO) > 0) {
                status = "PARTIAL";
            } else {
                status = "PENDING";
            }

            schedule.add(ScheduleEntryDTO.builder()
                    .installmentNumber(i)
                    .dueDate(startDate.plusMonths(i))
                    .scheduledPrincipal(sp)
                    .scheduledInterest(si)
                    .scheduledTotal(st)
                    .principalPaid(pPaid)
                    .interestPaid(iPaid)
                    .totalPaid(tPaid)
                    .status(status)
                    .build());
        }

        return schedule;
    }

    @Transactional
    public Loan disburse(UUID applicationId, MultipartFile contract) {
        return disburse(applicationId, contract, false);
    }

    @Transactional
    public Loan disburse(UUID applicationId, MultipartFile contract, boolean isAdmin) {
        LoanApplication app = applicationRepository.findById(applicationId).orElseThrow();
        if (app.getStatus() != LoanApplication.ApplicationStatus.APPROVED) {
            throw new RuntimeException("Only approved applications can be disbursed");
        }

        if (!isAdmin) {
            BigDecimal availableStock = dashboardService.calculateAvailableForLoan(app.getIssuedDate());
            if (app.getRequestedAmount().compareTo(availableStock) > 0) {
                throw new RuntimeException("Requested amount (" + app.getRequestedAmount() + ") exceeds group's total available funds (" + availableStock + ").");
            }
        }

        BigDecimal interestRate = new BigDecimal(configRepository.findByConfigKey("LOAN_INTEREST_RATE")
                .map(SystemConfig::getConfigValue).orElse("0.10"));

        BigDecimal totalInterest = app.getRequestedAmount().multiply(interestRate);

        Loan loan = Loan.builder()
                .member(app.getMember())
                .application(app)
                .principalAmount(app.getRequestedAmount())
                .totalInterestAmount(totalInterest)
                .remainingPrincipal(app.getRequestedAmount())
                .remainingInterest(totalInterest)
                .loanNumber(app.getLoanNumber())
                .disbursementDate(app.getIssuedDate())
                .status(Loan.LoanStatus.ACTIVE)
                .signedContractPath(fileStorageService.store(contract))
                .build();

        loan = loanRepository.save(loan);
        app.setStatus(LoanApplication.ApplicationStatus.DISBURSED);
        applicationRepository.save(app);

        // TRIGGER SNAPSHOT
        createInterestSnapshot(loan);

        auditService.log(
            "LOAN_DISBURSED",
            "LOAN",
            loan.getId().toString(),
            String.format("Disbursed loan #%s to %s %s: %s FRW", loan.getLoanNumber(), app.getMember().getFirstName(), app.getMember().getLastName(), app.getRequestedAmount())
        );

        return loan;
    }

    private void createInterestSnapshot(Loan loan) {
        // The Social Fund only became entitled to interest under the law effective SOCIAL_FUND_LAW_EFFECTIVE_DATE
        // (default 2025-01-01). Loans disbursed before that date must not credit the Social Fund any interest.
        LocalDate socialFundLawDate = getSocialFundLawEffectiveDate();
        boolean socialFundEligible = loan.getDisbursementDate() != null && !loan.getDisbursementDate().isBefore(socialFundLawDate);

        List<Member> activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.MemberStatus.ACTIVE)
                .filter(m -> socialFundEligible || m.getType() != Member.MemberType.SOCIAL)
                .collect(Collectors.toList());

        BigDecimal totalGroupShares = BigDecimal.ZERO;
        BigDecimal totalGroupReserves = BigDecimal.ZERO;
        
        InterestSnapshot snapshot = InterestSnapshot.builder()
                .loan(loan)
                .totalSharesAtTime(BigDecimal.ZERO)
                .totalReserveSharesAtTime(BigDecimal.ZERO)
                .build();
        
        snapshot = snapshotRepository.save(snapshot);

        // Pass 1: find denominator group sums
        for (Member m : activeMembers) {
            BigDecimal mShares = getTotalShares(m);
            if (m.getType() == Member.MemberType.SOCIAL) {
                // Round to smallest 50,000 for interest calculation weight
                BigDecimal fiftyK = new BigDecimal("50000");
                mShares = mShares.divide(fiftyK, 0, java.math.RoundingMode.FLOOR).multiply(fiftyK);
            }
            BigDecimal mReserves = memberService.getObligatoryReserveBalance(m.getId());
            
            totalGroupShares = totalGroupShares.add(mShares);
            totalGroupReserves = totalGroupReserves.add(mReserves);
        }

        BigDecimal totalWeight = totalGroupShares.add(totalGroupReserves);

        if (totalWeight.compareTo(BigDecimal.ZERO) > 0) {
            // Pass 2: find expected slice
            List<Member> eligibleMembers = new ArrayList<>();
            List<BigDecimal> eligibleShares = new ArrayList<>();
            List<BigDecimal> eligibleReserves = new ArrayList<>();
            List<BigDecimal> eligibleWeights = new ArrayList<>();

            for (Member m : activeMembers) {
                BigDecimal mShares = getTotalShares(m);
                if (m.getType() == Member.MemberType.SOCIAL) {
                    BigDecimal fiftyK = new BigDecimal("50000");
                    mShares = mShares.divide(fiftyK, 0, java.math.RoundingMode.FLOOR).multiply(fiftyK);
                }

                BigDecimal mReserves = memberService.getObligatoryReserveBalance(m.getId());
                BigDecimal mWeight = mShares.add(mReserves);

                if (mWeight.compareTo(BigDecimal.ZERO) > 0) {
                    eligibleMembers.add(m);
                    eligibleShares.add(mShares);
                    eligibleReserves.add(mReserves);
                    eligibleWeights.add(mWeight);
                }
            }

            List<BigDecimal> expectedAmounts = com.twisungane.util.ProportionalSplitter.splitExactly(loan.getTotalInterestAmount(), eligibleWeights);

            for (int i = 0; i < eligibleMembers.size(); i++) {
                snapshotMemberRepository.save(SnapshotMember.builder()
                        .snapshot(snapshot)
                        .member(eligibleMembers.get(i))
                        .sharesAtTime(eligibleShares.get(i))
                        .reserveSharesAtTime(eligibleReserves.get(i))
                        .expectedInterestAmount(expectedAmounts.get(i))
                        .paidInterestAmount(BigDecimal.ZERO)
                        .build());
            }
        }

        snapshot.setTotalSharesAtTime(totalGroupShares);
        snapshot.setTotalReserveSharesAtTime(totalGroupReserves);
        snapshotRepository.save(snapshot);
    }

    private BigDecimal getConfig(String key, String defaultValue) {
        return new BigDecimal(configRepository.findByConfigKey(key)
                .map(SystemConfig::getConfigValue).orElse(defaultValue));
    }

    private LocalDate getSocialFundLawEffectiveDate() {
        return LocalDate.parse(configRepository.findByConfigKey("SOCIAL_FUND_LAW_EFFECTIVE_DATE")
                .map(SystemConfig::getConfigValue).orElse("2025-01-01"));
    }

    /** Suggests the next loan number by incrementing the trailing digit run of the most recently entered one (e.g. "20-005" -> "20-006"). Returns "" if there's no prior loan to base it on, or its number has no trailing digits to increment. */
    public String getSuggestedNextLoanNumber() {
        return applicationRepository.findTopByOrderByCreatedAtDesc()
                .map(LoanApplication::getLoanNumber)
                .filter(n -> n != null && !n.isBlank())
                .map(this::incrementTrailingNumber)
                .orElse("");
    }

    private String incrementTrailingNumber(String loanNumber) {
        Matcher matcher = Pattern.compile("^(.*?)(\\d+)$").matcher(loanNumber);
        if (!matcher.matches()) return "";
        String prefix = matcher.group(1);
        String digits = matcher.group(2);
        long next = Long.parseLong(digits) + 1;
        String padded = String.format("%0" + digits.length() + "d", next);
        return prefix + padded;
    }

    private BigDecimal getTotalShares(Member member) {
        return memberService.convertToDTO(member).getTotalShares();
    }

    @Transactional
    public Optional<LoanRepayment> recordRepayment(UUID loanId, BigDecimal amount, String reference, java.time.LocalDate paymentDate) {
        return recordRepayment(loanId, amount, reference, paymentDate, false);
    }

    @Transactional
    public Optional<LoanRepayment> recordRepayment(UUID loanId, BigDecimal amount, String reference, java.time.LocalDate paymentDate, boolean isAdmin) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found: " + loanId));
        if (!isAdmin && loan.getStatus() != Loan.LoanStatus.ACTIVE) {
            throw new RuntimeException("Cannot pay towards a non-active loan");
        }

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Repayment amount must be greater than zero.");
        }

        BigDecimal totalOutstanding = loan.getRemainingPrincipal().add(
                loan.getRemainingInterest() != null ? loan.getRemainingInterest() : BigDecimal.ZERO);
        if (!isAdmin && amount.compareTo(totalOutstanding) > 0) {
            throw new IllegalArgumentException(
                    "Repayment of " + amount + " FRW exceeds the outstanding balance of " + totalOutstanding + " FRW.");
        }

        // Penalties are no longer auto-deducted from loan repayments — they are settled manually via PenaltyService.
        // Logic based on the 55,000 FRW installment rule
        BigDecimal principalPortion = amount.multiply(new BigDecimal("0.90909")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal interestPortion = amount.subtract(principalPortion);

        // Cap interest paid to total remaining interest
        if (interestPortion.compareTo(loan.getRemainingInterest()) > 0) {
            interestPortion = loan.getRemainingInterest();
            principalPortion = amount.subtract(interestPortion);
        }

        // Cap principal paid to remaining principal
        if (principalPortion.compareTo(loan.getRemainingPrincipal()) > 0) {
            principalPortion = loan.getRemainingPrincipal();
        }

        loan.setRemainingPrincipal(loan.getRemainingPrincipal().subtract(principalPortion));
        loan.setRemainingInterest(loan.getRemainingInterest().subtract(interestPortion));

        if (loan.getRemainingPrincipal().compareTo(BigDecimal.ZERO) <= 0 && loan.getRemainingInterest().compareTo(BigDecimal.ZERO) <= 0) {
            loan.setStatus(Loan.LoanStatus.PAID);
        }

        loanRepository.save(loan);

        // If the loan was paid off, check if any snapshot members were EXITING and can now be EXITED
        if (loan.getStatus() == Loan.LoanStatus.PAID) {
            InterestSnapshot snapshot = snapshotRepository.findByLoanId(loan.getId()).orElse(null);
            if (snapshot != null && snapshot.getMembers() != null) {
                for (SnapshotMember sm : snapshot.getMembers()) {
                    Member m = sm.getMember();
                    if (m.getStatus() == Member.MemberStatus.EXITING) {
                        boolean stillHasActiveSnapshots = snapshotMemberRepository.hasActiveLoanSnapshot(m.getId());
                        if (!stillHasActiveSnapshots) {
                            m.setStatus(Member.MemberStatus.EXITED);
                            memberRepository.save(m);
                            auditService.log(
                                "MEMBER_EXITED",
                                "MEMBER",
                                m.getId().toString(),
                                String.format("Member %s %s has transitioned to EXITED after all pending interest snapshots were settled.",
                                        m.getFirstName(), m.getLastName())
                            );
                        }
                    }
                }
            }
        }

        LoanRepayment repayment = LoanRepayment.builder()
                .loan(loan)
                .totalAmount(amount)
                .principalPaid(principalPortion)
                .interestPaid(interestPortion)
                .paymentDate(paymentDate != null ? paymentDate.atStartOfDay() : java.time.LocalDateTime.now())
                .transactionReference(reference)
                .build();

        repayment = repaymentRepository.save(repayment);

        auditService.log(
            "LOAN_REPAYMENT", 
            "LOAN", 
            loan.getId().toString(), 
            String.format("Recorded repayment of %s FRW for %s %s (Loan #%s)", amount, loan.getMember().getFirstName(), loan.getMember().getLastName(), loan.getLoanNumber())
        );

        if (interestPortion.compareTo(BigDecimal.ZERO) > 0) {
            distributeInterestToSnapshotMembers(loan, interestPortion);
        }

        return Optional.of(repayment);
    }

    private void distributeInterestToSnapshotMembers(Loan loan, BigDecimal interestPaidAmount) {
        InterestSnapshot snapshot = snapshotRepository.findByLoanId(loan.getId()).orElse(null);
        if (snapshot == null || snapshot.getTotalSharesAtTime().compareTo(BigDecimal.ZERO) == 0) return;

        List<SnapshotMember> members = snapshot.getMembers();
        List<BigDecimal> weights = members.stream().map(SnapshotMember::getSharesAtTime).collect(Collectors.toList());
        List<BigDecimal> amounts = com.twisungane.util.ProportionalSplitter.splitExactly(interestPaidAmount, weights);

        for (int i = 0; i < members.size(); i++) {
            SnapshotMember sm = members.get(i);
            BigDecimal proportionalInterest = amounts.get(i);

            sm.setPaidInterestAmount(sm.getPaidInterestAmount().add(proportionalInterest));
            snapshotMemberRepository.save(sm);

            if (sm.getMember().getType() == Member.MemberType.SOCIAL) {
                SystemConfig socialConfig = configRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                        .orElseThrow(() -> new RuntimeException("SOCIAL_FUND_BALANCE config missing"));
                BigDecimal currentBalance = new BigDecimal(socialConfig.getConfigValue());
                BigDecimal newBalance = currentBalance.add(proportionalInterest);
                socialConfig.setConfigValue(newBalance.setScale(0, RoundingMode.HALF_UP).toPlainString());
                configRepository.save(socialConfig);
            }
        }
    }
}
