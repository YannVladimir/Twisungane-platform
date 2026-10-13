package com.twisungane.service;

import com.twisungane.dto.*;
import com.twisungane.entity.*;
import com.twisungane.repository.*;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberExitService {

    private final MemberRepository memberRepository;
    private final MemberExitRequestRepository exitRequestRepository;
    private final LoanRepository loanRepository;
    private final PenaltyRepository penaltyRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final AuditService auditService;
    private final HmacUtil hmacUtil;
    private final SnapshotMemberRepository snapshotMemberRepository;

    public ExitEligibilityResponse checkEligibility(UUID memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Must be ACTIVE to exit
        if (member.getStatus() == Member.MemberStatus.EXITED) {
            blockers.add("Member has already exited the association.");
        }
        if (member.getStatus() == Member.MemberStatus.EXPELLED) {
            blockers.add("Member has already been expelled.");
        }

        // Check for an active exit request already in progress
        boolean exitInProgress = exitRequestRepository.existsByMemberIdAndStatusIn(
                memberId,
                List.of(MemberExitRequest.ExitStatus.PENDING_REVIEW,
                        MemberExitRequest.ExitStatus.SETTLEMENT_READY,
                        MemberExitRequest.ExitStatus.APPROVED)
        );
        if (exitInProgress) {
            blockers.add("An exit request for this member is already in progress.");
        }

        // Check for active loan
        loanRepository.findByMemberIdAndStatus(memberId, Loan.LoanStatus.ACTIVE)
                .ifPresent(loan -> blockers.add(
                        "Member has an active loan of " + loan.getPrincipalAmount() + " FRW. The loan must be fully repaid before exit."
                ));

        // Check for unpaid penalties
        List<Penalty> activePenalties = penaltyRepository.findByMemberIdAndStatus(memberId, Penalty.PenaltyStatus.ACTIVE);
        if (!activePenalties.isEmpty()) {
            BigDecimal totalPenalties = activePenalties.stream()
                    .map(Penalty::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            blockers.add(
                    "Member has " + activePenalties.size() + " unpaid penalty/penalties totalling " + totalPenalties + " FRW. These must be paid or waived before exit."
            );
        }

        // Check if this member is a guarantor for another member's active loan
        List<Member> guaranteedMembers = memberRepository.findByGuarantorId(memberId);
        for (Member gm : guaranteedMembers) {
            loanRepository.findByMemberIdAndStatus(gm.getId(), Loan.LoanStatus.ACTIVE)
                    .ifPresent(loan -> warnings.add(
                            "This member is listed as guarantor (umwishingizi) for " +
                            gm.getFirstName() + " " + gm.getLastName() +
                            "'s active loan. A new guarantor must be assigned after exit."
                    ));
        }

        return ExitEligibilityResponse.builder()
                .eligible(blockers.isEmpty())
                .blockers(blockers)
                .warnings(warnings)
                .build();
    }

    public ExitSettlementResponse calculateSettlement(UUID memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        BigDecimal sharePrice = new BigDecimal(
                systemConfigRepository.findByConfigKey("SHARE_PRICE")
                        .map(SystemConfig::getConfigValue)
                        .orElse("100000")
        );

        BigDecimal totalShareValue = shareRecordRepository.findByMemberId(memberId).stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal shareCount = sharePrice.compareTo(BigDecimal.ZERO) > 0
                ? totalShareValue.divide(sharePrice, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal totalUnpaidPenalties = penaltyRepository
                .findByMemberIdAndStatus(memberId, Penalty.PenaltyStatus.ACTIVE)
                .stream()
                .map(Penalty::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netSettlement = totalShareValue.subtract(totalUnpaidPenalties)
                .max(BigDecimal.ZERO);

        return ExitSettlementResponse.builder()
                .totalShareValue(totalShareValue)
                .shareCount(shareCount)
                .sharePricePerUnit(sharePrice)
                .totalUnpaidPenalties(totalUnpaidPenalties)
                .netSettlementAmount(netSettlement)
                .memberName(member.getFirstName() + " " + member.getLastName())
                .memberEmail(member.getEmail())
                .memberNationalId(member.getNationalId())
                .build();
    }

    @Transactional
    public MemberExitRequestDTO initiateExit(UUID memberId, InitiateExitRequest request) {
        ExitEligibilityResponse eligibility = checkEligibility(memberId);
        if (!eligibility.isEligible()) {
            throw new RuntimeException("Member is not eligible for exit: " + String.join("; ", eligibility.getBlockers()));
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        Member actor = getCurrentActor();
        ExitSettlementResponse settlement = calculateSettlement(memberId);

        MemberExitRequest exitRequest = MemberExitRequest.builder()
                .member(member)
                .exitType(request.getExitType())
                .exitReason(request.getExitReason())
                .status(MemberExitRequest.ExitStatus.SETTLEMENT_READY)
                .totalShareValue(settlement.getTotalShareValue())
                .totalUnpaidPenalties(settlement.getTotalUnpaidPenalties())
                .netSettlementAmount(settlement.getNetSettlementAmount())
                .initiatedBy(actor)
                .build();

        MemberExitRequest saved = exitRequestRepository.save(exitRequest);

        auditService.log(
                "MEMBER_EXIT_INITIATED",
                "MEMBER_EXIT",
                saved.getId().toString(),
                String.format("Exit initiated for %s %s. Net settlement: %s FRW. Type: %s.",
                        member.getFirstName(), member.getLastName(),
                        settlement.getNetSettlementAmount(), request.getExitType())
        );

        return toDTO(saved);
    }

    @Transactional
    public MemberExitRequestDTO approveExit(UUID exitRequestId, String approverNote) {
        MemberExitRequest exitRequest = exitRequestRepository.findById(exitRequestId)
                .orElseThrow(() -> new RuntimeException("Exit request not found"));

        if (exitRequest.getStatus() != MemberExitRequest.ExitStatus.SETTLEMENT_READY) {
            throw new RuntimeException("Exit request is not in SETTLEMENT_READY state.");
        }

        Member approver = getCurrentActor();
        Member member = exitRequest.getMember();

        // Deduct member's shares from the pool by writing one negative settlement record
        BigDecimal totalShareBalance = shareRecordRepository.findByMemberId(member.getId()).stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalShareBalance.compareTo(BigDecimal.ZERO) > 0) {
            ShareRecord settlementRecord = ShareRecord.builder()
                    .member(member)
                    .amount(totalShareBalance.negate())
                    .transactionReference("EXIT SETTLEMENT — approved by president")
                    .dateBought(LocalDateTime.now())
                    .build();
            shareRecordRepository.save(settlementRecord);
        }

        // Lock account and update member status
        member.setLocked(true);
        boolean hasActiveLoansInSnapshot = snapshotMemberRepository.hasActiveLoanSnapshot(member.getId());
        if (hasActiveLoansInSnapshot) {
            member.setStatus(Member.MemberStatus.EXITING);
        } else {
            member.setStatus(Member.MemberStatus.EXITED);
        }
        memberRepository.save(member);

        // Mark the exit request as APPROVED
        exitRequest.setStatus(MemberExitRequest.ExitStatus.APPROVED);
        exitRequest.setApprovedBy(approver);
        exitRequest.setApprovedAt(LocalDateTime.now());

        MemberExitRequest saved = exitRequestRepository.save(exitRequest);

        auditService.log(
                "MEMBER_EXIT_APPROVED",
                "MEMBER_EXIT",
                saved.getId().toString(),
                String.format("Exit approved for %s %s. Settlement: %s FRW. Shares deducted. Status: %s.",
                        member.getFirstName(), member.getLastName(),
                        saved.getNetSettlementAmount(), member.getStatus())
        );

        return toDTO(saved);
    }

    @Transactional
    public MemberExitRequestDTO rejectExit(UUID exitRequestId, String rejectionReason) {
        MemberExitRequest exitRequest = exitRequestRepository.findById(exitRequestId)
                .orElseThrow(() -> new RuntimeException("Exit request not found"));

        if (exitRequest.getStatus() != MemberExitRequest.ExitStatus.SETTLEMENT_READY
                && exitRequest.getStatus() != MemberExitRequest.ExitStatus.PENDING_REVIEW) {
            throw new RuntimeException("Exit request cannot be rejected in its current state.");
        }

        exitRequest.setStatus(MemberExitRequest.ExitStatus.REJECTED);
        exitRequest.setRejectionReason(rejectionReason);

        MemberExitRequest saved = exitRequestRepository.save(exitRequest);

        auditService.log(
                "MEMBER_EXIT_REJECTED",
                "MEMBER_EXIT",
                saved.getId().toString(),
                String.format("Exit rejected for %s %s. Reason: %s.",
                        saved.getMember().getFirstName(), saved.getMember().getLastName(),
                        rejectionReason)
        );

        return toDTO(saved);
    }

    @Transactional
    public MemberExitRequestDTO recordPayout(UUID exitRequestId, String payoutReference) {
        MemberExitRequest exitRequest = exitRequestRepository.findById(exitRequestId)
                .orElseThrow(() -> new RuntimeException("Exit request not found"));

        if (exitRequest.getStatus() != MemberExitRequest.ExitStatus.APPROVED) {
            throw new RuntimeException("Exit request must be APPROVED before recording payout.");
        }

        Member finance = getCurrentActor();
        exitRequest.setStatus(MemberExitRequest.ExitStatus.COMPLETED);
        exitRequest.setPayoutRecordedBy(finance);
        exitRequest.setPayoutRecordedAt(LocalDateTime.now());
        exitRequest.setPayoutReference(payoutReference);

        // Re-evaluate final status now that interests may have been settled since approval
        Member member = exitRequest.getMember();
        boolean hasActiveLoansInSnapshot = snapshotMemberRepository.hasActiveLoanSnapshot(member.getId());
        if (!hasActiveLoansInSnapshot) {
            member.setStatus(Member.MemberStatus.EXITED);
            memberRepository.save(member);
        }

        MemberExitRequest saved = exitRequestRepository.save(exitRequest);

        auditService.log(
                "MEMBER_EXIT_PAYOUT_RECORDED",
                "MEMBER_EXIT",
                saved.getId().toString(),
                String.format("Payout of %s FRW recorded for exiting member %s %s. Reference: %s.",
                        saved.getNetSettlementAmount(),
                        member.getFirstName(), member.getLastName(),
                        payoutReference)
        );

        if (hasActiveLoansInSnapshot) {
            auditService.log(
                    "MEMBER_EXITING",
                    "MEMBER",
                    member.getId().toString(),
                    String.format("Member %s %s has initiated exit and is in EXITING status pending active loan snapshot settlement. Account locked.",
                            member.getFirstName(), member.getLastName())
            );
        } else {
            auditService.log(
                    "MEMBER_EXITED",
                    "MEMBER",
                    member.getId().toString(),
                    String.format("Member %s %s has officially exited the association. Account locked.",
                            member.getFirstName(), member.getLastName())
            );
        }

        return toDTO(saved);
    }

    public List<MemberExitRequestDTO> getPendingExitRequests() {
        return exitRequestRepository
                .findByStatusInOrderByCreatedAtDesc(
                        List.of(MemberExitRequest.ExitStatus.SETTLEMENT_READY, MemberExitRequest.ExitStatus.APPROVED))
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<MemberExitRequestDTO> getAllExitRequests() {
        return exitRequestRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<MemberExitRequestDTO> getMemberExitHistory(UUID memberId) {
        return exitRequestRepository.findByMemberId(memberId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private Member getCurrentActor() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return memberRepository.findByEmailHash(hmacUtil.hash(email))
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    private MemberExitRequestDTO toDTO(MemberExitRequest e) {
        UUID memberId = e.getMember().getId();

        List<SnapshotMember> snapshots = snapshotMemberRepository.findByMemberId(memberId);
        BigDecimal totalExpected = snapshots.stream()
                .map(SnapshotMember::getExpectedInterestAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = snapshots.stream()
                .map(SnapshotMember::getPaidInterestAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalUnpaid = totalExpected.subtract(totalPaid).max(BigDecimal.ZERO);

        LocalDate expectedLastPaymentDate = null;
        var activeLoan = loanRepository.findByMemberIdAndStatus(memberId, Loan.LoanStatus.ACTIVE);
        if (activeLoan.isPresent()) {
            Loan loan = activeLoan.get();
            if (loan.getDisbursementDate() != null && loan.getPrincipalAmount() != null
                    && loan.getPrincipalAmount().compareTo(BigDecimal.ZERO) > 0) {
                long totalMonths = (long) Math.ceil(loan.getPrincipalAmount().doubleValue() / 50000.0);
                expectedLastPaymentDate = loan.getDisbursementDate().plusMonths(totalMonths);
            }
        }

        return MemberExitRequestDTO.builder()
                .id(e.getId())
                .memberId(memberId)
                .memberName(e.getMember().getFirstName() + " " + e.getMember().getLastName())
                .memberEmail(e.getMember().getEmail())
                .memberNationalId(e.getMember().getNationalId())
                .status(e.getStatus())
                .exitType(e.getExitType())
                .exitReason(e.getExitReason())
                .totalShareValue(e.getTotalShareValue())
                .totalUnpaidPenalties(e.getTotalUnpaidPenalties())
                .netSettlementAmount(e.getNetSettlementAmount())
                .totalExpectedInterest(totalExpected)
                .totalPaidInterest(totalPaid)
                .totalUnpaidInterest(totalUnpaid)
                .expectedLastPaymentDate(expectedLastPaymentDate)
                .initiatedByName(e.getInitiatedBy() != null
                        ? e.getInitiatedBy().getFirstName() + " " + e.getInitiatedBy().getLastName() : null)
                .approvedByName(e.getApprovedBy() != null
                        ? e.getApprovedBy().getFirstName() + " " + e.getApprovedBy().getLastName() : null)
                .approvedAt(e.getApprovedAt())
                .rejectionReason(e.getRejectionReason())
                .payoutRecordedAt(e.getPayoutRecordedAt())
                .payoutReference(e.getPayoutReference())
                .payoutRecordedByName(e.getPayoutRecordedBy() != null
                        ? e.getPayoutRecordedBy().getFirstName() + " " + e.getPayoutRecordedBy().getLastName() : null)
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
