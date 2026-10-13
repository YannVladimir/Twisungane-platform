package com.twisungane.controller;

import com.twisungane.entity.ExpenseType;
import com.twisungane.service.ImportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Admin-only endpoints used exclusively by the historical data import script.
 * These bypass normal workflow guards (e.g. PRESIDENT approval, insufficient-funds check)
 * to allow replaying historical transactions in chronological order.
 */
@RestController
@RequestMapping("/api/v1/admin/import")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ImportController {

    private final ImportService importService;

    // ─── Group expense (bypasses balance check) ───────────────────────────────

    @PostMapping("/group-expense")
    public ResponseEntity<Void> recordGroupExpense(@RequestBody GroupExpenseRequest req) {
        importService.recordGroupExpense(
                req.getAmount(),
                req.getType(),
                req.getDescription(),
                req.getDate()
        );
        return ResponseEntity.ok().build();
    }

    // ─── Balance adjustment ───────────────────────────────────────────────────

    @PostMapping("/adjustment")
    public ResponseEntity<Void> recordAdjustment(@RequestBody AdjustmentRequest req) {
        importService.recordAdjustment(
                req.getAmount(),
                req.getDirection(),
                req.getBalanceKey(),
                req.getAdjustmentType(),
                req.getDescription(),
                req.getDate(),
                req.getMemberId(),
                req.getReference(),
                req.getSourceRow()
        );
        return ResponseEntity.ok().build();
    }

    // ─── Share transfer ───────────────────────────────────────────────────────

    @PostMapping("/share-transfer")
    public ResponseEntity<Void> recordShareTransfer(@RequestBody ShareTransferRequest req) {
        importService.recordShareTransfer(
                req.getFromMemberId(),
                req.getToMemberId(),
                req.getAmount(),
                req.getDate(),
                req.getReference()
        );
        return ResponseEntity.ok().build();
    }

    // ─── Member exit ──────────────────────────────────────────────────────────

    @PostMapping("/member-exit")
    public ResponseEntity<Void> forceExitMember(@RequestBody MemberExitRequest req) {
        importService.forceExitMember(
                req.getMemberId(),
                req.getExitType(),
                req.getExitDate(),
                req.getExitReason(),
                req.getNetSettlementAmount()
        );
        return ResponseEntity.ok().build();
    }

    // ─── Request DTOs ────────────────────────────────────────────────────────

    @Data
    public static class GroupExpenseRequest {
        private BigDecimal amount;
        private ExpenseType type;   // BANK, SOCIAL, OTHER
        private String description;
        private LocalDate date;
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Data
    public static class AdjustmentRequest {
        private BigDecimal amount;
        private String direction;        // "IN" or "OUT"
        private String balanceKey;       // system_config key (nullable = no balance update)
        private String adjustmentType;
        private String description;
        private LocalDate date;
        private UUID memberId;           // nullable
        private String reference;
        private Integer sourceRow;
    }

    @Data
    public static class ShareTransferRequest {
        private UUID fromMemberId;
        private UUID toMemberId;
        private BigDecimal amount;
        private LocalDate date;
        private String reference;
    }

    @Data
    public static class MemberExitRequest {
        private UUID memberId;
        private String exitType;          // "VOLUNTARY" or "EXPELLED"
        private LocalDate exitDate;
        private String exitReason;
        private BigDecimal netSettlementAmount;  // nullable — computed from shares if absent
    }
}
