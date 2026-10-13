package com.twisungane.service;

import com.twisungane.entity.*;
import com.twisungane.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Handles historical data import operations that have no equivalent
 * in the normal workflow.  Balance updates bypass the insufficient-funds
 * guard because past balances were sometimes temporarily negative before
 * the next deposit arrived.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    private final LedgerAdjustmentRepository adjustmentRepository;
    private final GroupExpenseRepository groupExpenseRepository;
    private final SystemConfigRepository configRepository;
    private final MemberRepository memberRepository;
    private final ShareRecordRepository shareRecordRepository;
    private final MemberExitRequestRepository exitRequestRepository;
    private final AuditService auditService;

    // ─── Ledger adjustment ────────────────────────────────────────────────────

    @Transactional
    public LedgerAdjustment recordAdjustment(
            BigDecimal amount,
            String direction,
            String balanceKey,
            String adjustmentType,
            String description,
            LocalDate date,
            UUID memberId,
            String reference,
            Integer sourceRow) {

        LedgerAdjustment adj = LedgerAdjustment.builder()
                .amount(amount)
                .direction(direction)
                .balanceKey(balanceKey)
                .adjustmentType(adjustmentType)
                .description(description)
                .date(date)
                .reference(reference)
                .sourceRow(sourceRow)
                .build();

        if (memberId != null) {
            memberRepository.findById(memberId).ifPresent(adj::setMember);
        }

        if (balanceKey != null && !balanceKey.isBlank()) {
            adjustBalanceUnchecked(balanceKey, amount, direction);
        }

        LedgerAdjustment saved = adjustmentRepository.save(adj);

        auditService.log(
                "IMPORT_ADJUSTMENT",
                "LEDGER_ADJUSTMENT",
                saved.getId().toString(),
                String.format("IMPORT %s %s: %s FRW on %s — %s (source row %s)",
                        direction, adjustmentType, amount, date, description, sourceRow)
        );

        return saved;
    }

    // ─── Share transfer ───────────────────────────────────────────────────────

    @Transactional
    public void recordShareTransfer(
            UUID fromMemberId,
            UUID toMemberId,
            BigDecimal amount,
            LocalDate date,
            String reference) {

        Member from = memberRepository.findById(fromMemberId)
                .orElseThrow(() -> new RuntimeException("From-member not found: " + fromMemberId));
        Member to = memberRepository.findById(toMemberId)
                .orElseThrow(() -> new RuntimeException("To-member not found: " + toMemberId));

        LocalDateTime ts = date.atStartOfDay();
        String fromName = from.getFirstName() + " " + from.getLastName();
        String toName   = to.getFirstName()   + " " + to.getLastName();

        shareRecordRepository.save(ShareRecord.builder()
                .member(from)
                .amount(amount.negate())
                .dateBought(ts)
                .transactionReference(reference + " (TRANSFER OUT → " + toName + ")")
                .build());

        shareRecordRepository.save(ShareRecord.builder()
                .member(to)
                .amount(amount)
                .dateBought(ts)
                .transactionReference(reference + " (TRANSFER IN ← " + fromName + ")")
                .build());

        auditService.log(
                "IMPORT_SHARE_TRANSFER",
                "SHARE_RECORD",
                from.getId().toString(),
                String.format("IMPORT share transfer %s FRW from %s to %s — %s",
                        amount, fromName, toName, reference)
        );
    }

    // ─── Member exit (bypasses PRESIDENT approval) ────────────────────────────

    @Transactional
    public void forceExitMember(
            UUID memberId,
            String exitType,
            LocalDate exitDate,
            String exitReason,
            BigDecimal netSettlement) {

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found: " + memberId));

        if (member.getStatus() == Member.MemberStatus.EXITED) {
            // Already exited — idempotent
            return;
        }

        BigDecimal totalShareBalance = shareRecordRepository.findByMemberId(memberId).stream()
                .map(ShareRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalShareBalance.compareTo(BigDecimal.ZERO) > 0) {
            shareRecordRepository.save(ShareRecord.builder()
                    .member(member)
                    .amount(totalShareBalance.negate())
                    .dateBought(exitDate.atStartOfDay())
                    .transactionReference("EXIT SETTLEMENT (historical import) — " + exitReason)
                    .build());
        }

        MemberExitRequest exitRequest = MemberExitRequest.builder()
                .member(member)
                .exitType(MemberExitRequest.ExitType.valueOf(exitType))
                .exitReason(exitReason)
                .status(MemberExitRequest.ExitStatus.COMPLETED)
                .totalShareValue(totalShareBalance.max(BigDecimal.ZERO))
                .totalUnpaidPenalties(BigDecimal.ZERO)
                .netSettlementAmount(
                        netSettlement != null ? netSettlement : totalShareBalance.max(BigDecimal.ZERO))
                .build();
        exitRequestRepository.save(exitRequest);

        member.setLocked(true);
        member.setStatus(Member.MemberStatus.EXITED);
        memberRepository.save(member);

        auditService.log(
                "IMPORT_MEMBER_EXIT",
                "MEMBER",
                member.getId().toString(),
                String.format("IMPORT: member %s %s exited (%s) on %s. Net settlement: %s FRW.",
                        member.getFirstName(), member.getLastName(), exitType, exitDate, netSettlement)
        );
    }

    // ─── Group expense (bypasses insufficient-funds guard) ────────────────────

    @Transactional
    public void recordGroupExpense(
            BigDecimal amount, ExpenseType type, String description, LocalDate date) {

        GroupExpense expense = GroupExpense.builder()
                .amount(amount)
                .type(type)
                .description(description)
                .date(date)
                .build();
        groupExpenseRepository.save(expense);

        String balanceKey = (type == ExpenseType.SOCIAL) ? "SOCIAL_FUND_BALANCE"
                          : (type == ExpenseType.BANK)   ? "BANK_FEES_BALANCE"
                          : null;
        if (balanceKey != null) {
            adjustBalanceUnchecked(balanceKey, amount, "OUT");
        }

        auditService.log(
                "IMPORT_GROUP_EXPENSE",
                "EXPENSE",
                expense.getId() != null ? expense.getId().toString() : "?",
                String.format("IMPORT %s expense: %s FRW — %s", type, amount, description)
        );
    }

    // ─── Balance helper (no insufficient-funds guard) ─────────────────────────

    private void adjustBalanceUnchecked(String key, BigDecimal amount, String direction) {
        SystemConfig config = configRepository.findByConfigKey(key)
                .orElseThrow(() -> new RuntimeException("Config key not found: " + key));
        BigDecimal current = new BigDecimal(config.getConfigValue());
        BigDecimal updated = "IN".equalsIgnoreCase(direction)
                ? current.add(amount)
                : current.subtract(amount);
        config.setConfigValue(updated.toPlainString());
        configRepository.save(config);
    }
}
