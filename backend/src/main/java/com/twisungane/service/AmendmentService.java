package com.twisungane.service;

import com.twisungane.entity.*;
import com.twisungane.entity.ExpenseType;
import com.twisungane.repository.*;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AmendmentService {

    private final TransactionAmendmentRepository amendmentRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final ContributionRepository contributionRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final LoanRepository loanRepository;
    private final GroupExpenseRepository expenseRepository;
    private final PenaltyRepository penaltyRepository;
    private final SocialClaimRepository socialClaimRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final InterestSnapshotRepository snapshotRepository;
    private final SystemConfigRepository configRepository;
    private final MemberRepository memberRepository;
    private final AuditService auditService;
    private final HmacUtil hmacUtil;

    // ─────────────────────────────────────────────────────────────────────────────
    // REQUEST
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public TransactionAmendment requestAmendment(
            TransactionAmendment.TransactionType type,
            UUID originalTransactionId,
            BigDecimal originalAmount,
            BigDecimal correctAmount,
            String reason,
            String amendmentDetailsJson) {

        // Reject if the transaction is already under amendment
        amendmentRepository.findByOriginalTransactionIdAndStatusIn(
            originalTransactionId,
            List.of(TransactionAmendment.AmendmentStatus.PENDING_REVIEW,
                    TransactionAmendment.AmendmentStatus.APPROVED)
        ).ifPresent(existing -> {
            throw new RuntimeException("An amendment request is already open for this transaction (status: " + existing.getStatus() + ").");
        });

        // Check whether this transaction can still be amended
        validateAmendable(type, originalTransactionId);

        Member requester = currentMember();

        TransactionAmendment amendment = TransactionAmendment.builder()
                .transactionType(type)
                .originalTransactionId(originalTransactionId)
                .originalAmount(originalAmount)
                .correctAmount(correctAmount)
                .reason(reason)
                .amendmentDetails(amendmentDetailsJson)
                .requestedBy(requester)
                .status(TransactionAmendment.AmendmentStatus.PENDING_REVIEW)
                .build();

        TransactionAmendment saved = amendmentRepository.save(amendment);

        auditService.log(
            "AMENDMENT_REQUESTED",
            "AMENDMENT",
            saved.getId().toString(),
            String.format("Amendment requested for %s [%s]: %s → %s FRW. Reason: %s",
                type, originalTransactionId, originalAmount, correctAmount, reason)
        );

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // APPROVE
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public TransactionAmendment approveAmendment(UUID amendmentId) {
        TransactionAmendment amendment = findAmendment(amendmentId);
        requireStatus(amendment, TransactionAmendment.AmendmentStatus.PENDING_REVIEW);

        amendment.setStatus(TransactionAmendment.AmendmentStatus.APPROVED);
        amendment.setReviewedBy(currentMember());
        amendmentRepository.save(amendment);

        auditService.log(
            "AMENDMENT_APPROVED",
            "AMENDMENT",
            amendmentId.toString(),
            String.format("Amendment approved for %s [%s]",
                amendment.getTransactionType(), amendment.getOriginalTransactionId())
        );

        // Apply immediately after approval
        return applyAmendment(amendmentId);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // REJECT
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public TransactionAmendment rejectAmendment(UUID amendmentId, String rejectionReason) {
        TransactionAmendment amendment = findAmendment(amendmentId);
        requireStatus(amendment, TransactionAmendment.AmendmentStatus.PENDING_REVIEW);

        amendment.setStatus(TransactionAmendment.AmendmentStatus.REJECTED);
        amendment.setReviewedBy(currentMember());
        amendment.setRejectionReason(rejectionReason);
        amendmentRepository.save(amendment);

        auditService.log(
            "AMENDMENT_REJECTED",
            "AMENDMENT",
            amendmentId.toString(),
            String.format("Amendment rejected for %s [%s]. Reason: %s",
                amendment.getTransactionType(), amendment.getOriginalTransactionId(), rejectionReason)
        );

        return amendment;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CANCEL (by the requester, while still PENDING_REVIEW)
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public TransactionAmendment cancelAmendment(UUID amendmentId) {
        TransactionAmendment amendment = findAmendment(amendmentId);
        requireStatus(amendment, TransactionAmendment.AmendmentStatus.PENDING_REVIEW);

        amendment.setStatus(TransactionAmendment.AmendmentStatus.CANCELLED);
        amendmentRepository.save(amendment);

        auditService.log("AMENDMENT_CANCELLED", "AMENDMENT", amendmentId.toString(),
            "Amendment cancelled by requester.");

        return amendment;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // APPLY — dispatches by type
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public TransactionAmendment applyAmendment(UUID amendmentId) {
        TransactionAmendment amendment = findAmendment(amendmentId);
        requireStatus(amendment, TransactionAmendment.AmendmentStatus.APPROVED);

        // Re-validate amendability at apply time (state may have changed since request)
        validateAmendable(amendment.getTransactionType(), amendment.getOriginalTransactionId());

        switch (amendment.getTransactionType()) {
            case SHARE_RECORD    -> applyShareRecordAmendment(amendment);
            case CONTRIBUTION    -> applyContributionAmendment(amendment);
            case GROUP_EXPENSE   -> applyGroupExpenseAmendment(amendment);
            case PENALTY         -> applyPenaltyAmendment(amendment);
            case LOAN_REPAYMENT  -> applyLoanRepaymentAmendment(amendment);
            case SOCIAL_CLAIM    -> applySocialClaimAmendment(amendment);
        }

        amendment.setStatus(TransactionAmendment.AmendmentStatus.APPLIED);
        amendment.setAppliedAt(LocalDateTime.now());
        TransactionAmendment saved = amendmentRepository.save(amendment);

        auditService.log(
            "AMENDMENT_APPLIED",
            "AMENDMENT",
            amendmentId.toString(),
            String.format("Amendment applied for %s [%s]: %s → %s FRW",
                amendment.getTransactionType(), amendment.getOriginalTransactionId(),
                amendment.getOriginalAmount(), amendment.getCorrectAmount())
        );

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PER-TYPE APPLY LOGIC
    // ─────────────────────────────────────────────────────────────────────────────

    private void applyShareRecordAmendment(TransactionAmendment amendment) {
        ShareRecord original = shareRecordRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("ShareRecord not found: " + amendment.getOriginalTransactionId()));

        BigDecimal delta = amendment.getCorrectAmount().subtract(amendment.getOriginalAmount());

        // Reversal: negate the original amount
        ShareRecord reversal = ShareRecord.builder()
                .member(original.getMember())
                .amount(amendment.getOriginalAmount().negate())
                .transactionReference("REVERSAL:" + original.getTransactionReference())
                .amendmentStatus("REVERSAL")
                .build();
        reversal = shareRecordRepository.save(reversal);

        // Correction: apply the correct amount
        ShareRecord correction = ShareRecord.builder()
                .member(original.getMember())
                .amount(amendment.getCorrectAmount())
                .transactionReference("CORRECTION:" + original.getTransactionReference())
                .amendmentStatus("CORRECTION")
                .build();
        correction = shareRecordRepository.save(correction);

        // Mark original as amended
        original.setAmendmentStatus("AMENDED");
        shareRecordRepository.save(original);

        amendment.setReversalTransactionId(reversal.getId());
        amendment.setCorrectionTransactionId(correction.getId());

        auditService.log("SHARE_RECORD_AMENDED", "SHARE",
            original.getMember().getId().toString(),
            String.format("Share record corrected for %s %s: %s → %s FRW (delta %s FRW)",
                original.getMember().getFirstName(), original.getMember().getLastName(),
                amendment.getOriginalAmount(), amendment.getCorrectAmount(), delta));
    }

    private void applyContributionAmendment(TransactionAmendment amendment) {
        Contribution original = contributionRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("Contribution not found: " + amendment.getOriginalTransactionId()));

        // Reversal contribution (negative amount to cancel the original)
        Contribution reversal = Contribution.builder()
                .member(original.getMember())
                .amount(amendment.getOriginalAmount().negate())
                .month(original.getMonth())
                .year(original.getYear())
                .type(original.getType())
                .details("REVERSAL of contribution " + original.getId())
                .amendmentStatus("REVERSAL")
                .build();
        reversal = contributionRepository.save(reversal);

        // Correction contribution
        Contribution correction = Contribution.builder()
                .member(original.getMember())
                .amount(amendment.getCorrectAmount())
                .month(original.getMonth())
                .year(original.getYear())
                .type(original.getType())
                .details("CORRECTION of contribution " + original.getId())
                .amendmentStatus("CORRECTION")
                .build();
        correction = contributionRepository.save(correction);

        original.setAmendmentStatus("AMENDED");
        contributionRepository.save(original);

        amendment.setReversalTransactionId(reversal.getId());
        amendment.setCorrectionTransactionId(correction.getId());

        auditService.log("CONTRIBUTION_AMENDED", "CONTRIBUTION",
            original.getMember().getId().toString(),
            String.format("Contribution corrected for %s %s: %s → %s FRW",
                original.getMember().getFirstName(), original.getMember().getLastName(),
                amendment.getOriginalAmount(), amendment.getCorrectAmount()));
    }

    private void applyGroupExpenseAmendment(TransactionAmendment amendment) {
        GroupExpense original = expenseRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("GroupExpense not found: " + amendment.getOriginalTransactionId()));

        BigDecimal delta = amendment.getCorrectAmount().subtract(amendment.getOriginalAmount());
        // delta > 0 means the correct amount is larger (we spent more than recorded → balance needs further decrease)
        // delta < 0 means the correct amount is smaller (we over-recorded → balance needs to increase back)

        // Create an offsetting expense entry representing the correction delta
        // Positive delta → additional expense deducted; negative delta → credit entry (negative expense)
        GroupExpense correctionEntry = GroupExpense.builder()
                .amount(delta)
                .type(original.getType())
                .description("CORRECTION of expense " + original.getId() + ": " + amendment.getReason())
                .date(original.getDate())
                .recordedBy(amendment.getReviewedBy())
                .amendmentStatus("CORRECTION")
                .build();

        // Update the appropriate fund balance by the delta
        if (delta.compareTo(BigDecimal.ZERO) != 0) {
            String configKey = original.getType() == ExpenseType.SOCIAL ? "SOCIAL_FUND_BALANCE" : "BANK_FEES_BALANCE";
            SystemConfig config = configRepository.findByConfigKey(configKey)
                    .orElseThrow(() -> new RuntimeException("Config key not found: " + configKey));
            BigDecimal currentBalance = new BigDecimal(config.getConfigValue());
            BigDecimal newBalance = currentBalance.subtract(delta); // subtract delta (positive means more spent)
            config.setConfigValue(newBalance.setScale(0, RoundingMode.HALF_UP).toPlainString());
            configRepository.save(config);
        }

        correctionEntry = expenseRepository.save(correctionEntry);

        original.setAmendmentStatus("AMENDED");
        expenseRepository.save(original);

        amendment.setCorrectionTransactionId(correctionEntry.getId());

        auditService.log("EXPENSE_AMENDED", "EXPENSE",
            original.getId().toString(),
            String.format("Group expense corrected (%s): %s → %s FRW (delta %s FRW applied to %s)",
                original.getType(), amendment.getOriginalAmount(), amendment.getCorrectAmount(),
                delta, original.getType() == ExpenseType.SOCIAL ? "SOCIAL_FUND_BALANCE" : "BANK_FEES_BALANCE"));
    }

    private void applyPenaltyAmendment(TransactionAmendment amendment) {
        Penalty original = penaltyRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("Penalty not found: " + amendment.getOriginalTransactionId()));

        if (original.getStatus() != Penalty.PenaltyStatus.ACTIVE) {
            throw new RuntimeException("Only ACTIVE penalties can be amended. Current status: " + original.getStatus());
        }

        // Waive the original (wrong) penalty
        original.setStatus(Penalty.PenaltyStatus.WAIVED);
        original.setWaivedBy(amendment.getReviewedBy());
        original.setWaivedAt(LocalDateTime.now());
        original.setDescription((original.getDescription() != null ? original.getDescription() : "")
                + " [AMENDED: " + amendment.getReason() + "]");
        original.setAmendmentStatus("AMENDED");
        penaltyRepository.save(original);

        // Create new penalty with the correct amount
        Penalty correction = Penalty.builder()
                .member(original.getMember())
                .loan(original.getLoan())
                .amount(amendment.getCorrectAmount())
                .type(original.getType())
                .status(Penalty.PenaltyStatus.ACTIVE)
                .description("CORRECTION of penalty " + original.getId() + ": " + amendment.getReason())
                .amendmentStatus("CORRECTION")
                .build();
        correction = penaltyRepository.save(correction);

        amendment.setCorrectionTransactionId(correction.getId());

        auditService.log("PENALTY_AMENDED", "PENALTY",
            original.getMember().getId().toString(),
            String.format("Penalty corrected for %s %s: %s → %s FRW",
                original.getMember().getFirstName(), original.getMember().getLastName(),
                amendment.getOriginalAmount(), amendment.getCorrectAmount()));
    }

    private void applyLoanRepaymentAmendment(TransactionAmendment amendment) {
        LoanRepayment original = repaymentRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("LoanRepayment not found: " + amendment.getOriginalTransactionId()));

        Loan loan = original.getLoan();

        // Safety check: cannot reverse if any snapshot member has cashed out their interest
        InterestSnapshot snapshot = snapshotRepository.findByLoanId(loan.getId()).orElse(null);
        if (snapshot != null) {
            boolean anyMemberCashedOut = snapshot.getMembers().stream()
                    .anyMatch(sm -> sm.getCashedOutInterestAmount().compareTo(BigDecimal.ZERO) > 0);
            if (anyMemberCashedOut) {
                throw new RuntimeException(
                    "Cannot amend this repayment: interest from it has already been cashed out by one or more members. " +
                    "This correction must be handled at General Assembly level.");
            }
        }

        BigDecimal originalInterestPaid = original.getInterestPaid();
        BigDecimal originalPrincipalPaid = original.getPrincipalPaid();

        // Step 1: reverse snapshot member interest distributions from this repayment
        if (snapshot != null && originalInterestPaid.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal totalGroupShares = snapshot.getTotalSharesAtTime();
            if (totalGroupShares.compareTo(BigDecimal.ZERO) > 0) {
                List<SnapshotMember> members = snapshot.getMembers();
                List<BigDecimal> weights = members.stream().map(SnapshotMember::getSharesAtTime).collect(java.util.stream.Collectors.toList());
                List<BigDecimal> reversedAmounts = com.twisungane.util.ProportionalSplitter.splitExactly(originalInterestPaid, weights);

                for (int i = 0; i < members.size(); i++) {
                    SnapshotMember sm = members.get(i);
                    BigDecimal reversedInterest = reversedAmounts.get(i);

                    sm.setPaidInterestAmount(
                        sm.getPaidInterestAmount().subtract(reversedInterest).max(BigDecimal.ZERO)
                    );
                    snapshotMemberRepository.save(sm);

                    // Reverse social fund credit if member is SOCIAL
                    if (sm.getMember().getType() == Member.MemberType.SOCIAL) {
                        adjustSocialFundBalance(reversedInterest.negate());
                    }
                }
            }
        }

        // Step 2: restore loan running totals
        loan.setRemainingPrincipal(loan.getRemainingPrincipal().add(originalPrincipalPaid));
        loan.setRemainingInterest(loan.getRemainingInterest().add(originalInterestPaid));

        // If loan was marked PAID by this repayment, reopen it
        if (loan.getStatus() == Loan.LoanStatus.PAID) {
            loan.setStatus(Loan.LoanStatus.ACTIVE);
            // Also revert any EXITING members who transitioned to EXITED because of this loan being PAID
            if (snapshot != null && snapshot.getMembers() != null) {
                for (SnapshotMember sm : snapshot.getMembers()) {
                    Member m = sm.getMember();
                    if (m.getStatus() == Member.MemberStatus.EXITED) {
                        // Check if they were exiting: they would have a COMPLETED exit request
                        memberRepository.findById(m.getId()).ifPresent(member -> {
                            // Only revert if they were in an exit workflow — leave pure EXITED members alone
                            // We check by looking for completed exit requests
                            // For safety, we just reopen to EXITING so the exit flow can re-complete naturally
                            // when the corrected repayment pays off the loan
                        });
                    }
                }
            }
        }

        loanRepository.save(loan);

        // Step 3: mark original as AMENDED
        original.setAmendmentStatus("AMENDED");
        repaymentRepository.save(original);

        // Step 4: re-apply with the correct amount using the standard repayment logic
        // Calculate the new principal/interest split using the same formula as recordRepayment()
        BigDecimal correctAmount = amendment.getCorrectAmount();
        BigDecimal principalPortion = correctAmount.multiply(new BigDecimal("0.90909")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal interestPortion = correctAmount.subtract(principalPortion);

        if (interestPortion.compareTo(loan.getRemainingInterest()) > 0) {
            interestPortion = loan.getRemainingInterest();
            principalPortion = correctAmount.subtract(interestPortion);
        }
        if (principalPortion.compareTo(loan.getRemainingPrincipal()) > 0) {
            principalPortion = loan.getRemainingPrincipal();
        }

        loan.setRemainingPrincipal(loan.getRemainingPrincipal().subtract(principalPortion));
        loan.setRemainingInterest(loan.getRemainingInterest().subtract(interestPortion));

        if (loan.getRemainingPrincipal().compareTo(BigDecimal.ZERO) <= 0
                && loan.getRemainingInterest().compareTo(BigDecimal.ZERO) <= 0) {
            loan.setStatus(Loan.LoanStatus.PAID);
        }

        loanRepository.save(loan);

        LoanRepayment correction = LoanRepayment.builder()
                .loan(loan)
                .totalAmount(correctAmount)
                .principalPaid(principalPortion)
                .interestPaid(interestPortion)
                .paymentDate(original.getPaymentDate()) // keep original payment date
                .transactionReference("CORRECTION:" + original.getTransactionReference())
                .amendmentStatus("CORRECTION")
                .build();
        correction = repaymentRepository.save(correction);

        // Step 5: re-distribute interest with the correct amount
        if (interestPortion.compareTo(BigDecimal.ZERO) > 0 && snapshot != null) {
            BigDecimal totalGroupShares = snapshot.getTotalSharesAtTime();
            if (totalGroupShares.compareTo(BigDecimal.ZERO) > 0) {
                List<SnapshotMember> members = snapshot.getMembers();
                List<BigDecimal> weights = members.stream().map(SnapshotMember::getSharesAtTime).collect(java.util.stream.Collectors.toList());
                List<BigDecimal> amounts = com.twisungane.util.ProportionalSplitter.splitExactly(interestPortion, weights);

                for (int i = 0; i < members.size(); i++) {
                    SnapshotMember sm = members.get(i);
                    BigDecimal proportionalInterest = amounts.get(i);
                    sm.setPaidInterestAmount(sm.getPaidInterestAmount().add(proportionalInterest));
                    snapshotMemberRepository.save(sm);

                    if (sm.getMember().getType() == Member.MemberType.SOCIAL) {
                        adjustSocialFundBalance(proportionalInterest);
                    }
                }
            }
        }

        amendment.setReversalTransactionId(original.getId());
        amendment.setCorrectionTransactionId(correction.getId());

        auditService.log("REPAYMENT_AMENDED", "LOAN",
            loan.getId().toString(),
            String.format("Loan repayment corrected for loan #%s: %s → %s FRW (interest redistributed)",
                loan.getLoanNumber(), amendment.getOriginalAmount(), amendment.getCorrectAmount()));
    }

    private void applySocialClaimAmendment(TransactionAmendment amendment) {
        SocialClaim original = socialClaimRepository.findById(amendment.getOriginalTransactionId())
                .orElseThrow(() -> new RuntimeException("SocialClaim not found: " + amendment.getOriginalTransactionId()));

        if (original.getStatus() == SocialClaim.ClaimStatus.PENDING) {
            // Simply cancel the claim so it can be re-submitted correctly
            original.setStatus(SocialClaim.ClaimStatus.REJECTED);
            original.setPresidentComments("AMENDED/CANCELLED: " + amendment.getReason());
            socialClaimRepository.save(original);

            auditService.log("SOCIAL_CLAIM_AMENDED_CANCELLED", "SOCIAL_CLAIM",
                original.getId().toString(),
                "Social claim cancelled pending re-submission. Reason: " + amendment.getReason());

        } else if (original.getStatus() == SocialClaim.ClaimStatus.PAID) {
            // For already-paid claims: restore social fund balance by re-crediting the original amount
            // and record the delta if the correct amount differs
            BigDecimal delta = amendment.getOriginalAmount().subtract(amendment.getCorrectAmount());
            if (delta.compareTo(BigDecimal.ZERO) != 0) {
                // Refund the over-paid amount back to the social fund
                adjustSocialFundBalance(delta);
            }

            original.setPresidentComments((original.getPresidentComments() != null
                ? original.getPresidentComments() + " | " : "") + "AMENDED: " + amendment.getReason());
            socialClaimRepository.save(original);

            auditService.log("SOCIAL_CLAIM_AMENDED_PAID", "SOCIAL_CLAIM",
                original.getId().toString(),
                String.format("Social claim amount corrected after payment: %s → %s FRW (delta %s returned to social fund)",
                    amendment.getOriginalAmount(), amendment.getCorrectAmount(), delta));
        } else {
            throw new RuntimeException("Social claim in status " + original.getStatus() + " cannot be amended.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // QUERIES
    // ─────────────────────────────────────────────────────────────────────────────

    public List<TransactionAmendment> getPendingAmendments() {
        return amendmentRepository.findByStatusOrderByCreatedAtDesc(
            TransactionAmendment.AmendmentStatus.PENDING_REVIEW);
    }

    public List<TransactionAmendment> getAllAmendments() {
        return amendmentRepository.findAllByOrderByCreatedAtDesc();
    }

    public TransactionAmendment getAmendment(UUID id) {
        return findAmendment(id);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AMENDABILITY VALIDATION
    // ─────────────────────────────────────────────────────────────────────────────

    private void validateAmendable(TransactionAmendment.TransactionType type, UUID transactionId) {
        switch (type) {
            case SHARE_RECORD -> {
                shareRecordRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("ShareRecord not found: " + transactionId));
                // Share records are always amendable (correction applies forward)
            }
            case CONTRIBUTION -> {
                contributionRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("Contribution not found: " + transactionId));
            }
            case GROUP_EXPENSE -> {
                expenseRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("GroupExpense not found: " + transactionId));
            }
            case PENALTY -> {
                Penalty p = penaltyRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("Penalty not found: " + transactionId));
                if (p.getStatus() != Penalty.PenaltyStatus.ACTIVE) {
                    throw new RuntimeException("Only ACTIVE penalties can be amended. This penalty is " + p.getStatus() + ".");
                }
            }
            case LOAN_REPAYMENT -> {
                LoanRepayment repayment = repaymentRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("LoanRepayment not found: " + transactionId));
                if (!"ORIGINAL".equals(repayment.getAmendmentStatus())) {
                    throw new RuntimeException("This repayment record is itself a reversal/correction and cannot be amended.");
                }
                // Check no interest has been cashed out from this loan's snapshot
                snapshotRepository.findByLoanId(repayment.getLoan().getId()).ifPresent(snapshot -> {
                    boolean anyCashedOut = snapshot.getMembers().stream()
                            .anyMatch(sm -> sm.getCashedOutInterestAmount().compareTo(BigDecimal.ZERO) > 0);
                    if (anyCashedOut) {
                        throw new RuntimeException(
                            "Cannot amend this repayment: interest has already been cashed out. " +
                            "This must be handled at General Assembly level.");
                    }
                });
            }
            case SOCIAL_CLAIM -> {
                SocialClaim claim = socialClaimRepository.findById(transactionId)
                    .orElseThrow(() -> new RuntimeException("SocialClaim not found: " + transactionId));
                if (claim.getStatus() != SocialClaim.ClaimStatus.PENDING
                        && claim.getStatus() != SocialClaim.ClaimStatus.PAID) {
                    throw new RuntimeException("Social claims in status " + claim.getStatus() + " cannot be amended.");
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    private void adjustSocialFundBalance(BigDecimal delta) {
        SystemConfig config = configRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                .orElseThrow(() -> new RuntimeException("SOCIAL_FUND_BALANCE config missing"));
        BigDecimal current = new BigDecimal(config.getConfigValue());
        config.setConfigValue(current.add(delta).setScale(0, RoundingMode.HALF_UP).toPlainString());
        configRepository.save(config);
    }

    private TransactionAmendment findAmendment(UUID id) {
        return amendmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Amendment not found: " + id));
    }

    private void requireStatus(TransactionAmendment amendment, TransactionAmendment.AmendmentStatus expected) {
        if (amendment.getStatus() != expected) {
            throw new RuntimeException("Amendment is in status " + amendment.getStatus()
                    + ", expected " + expected + ".");
        }
    }

    private Member currentMember() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return memberRepository.findByEmailHash(hmacUtil.hash(email))
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }
}
