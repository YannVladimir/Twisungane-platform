package com.twisungane.controller;

import com.twisungane.dto.*;
import com.twisungane.service.MemberExitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
public class MemberExitController {

    private final MemberExitService memberExitService;

    @GetMapping("/{memberId}/exit/eligibility")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT')")
    public ResponseEntity<ExitEligibilityResponse> checkEligibility(@PathVariable UUID memberId) {
        return ResponseEntity.ok(memberExitService.checkEligibility(memberId));
    }

    @GetMapping("/{memberId}/exit/settlement")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<ExitSettlementResponse> getSettlement(@PathVariable UUID memberId) {
        return ResponseEntity.ok(memberExitService.calculateSettlement(memberId));
    }

    @PostMapping("/{memberId}/exit/initiate")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT')")
    public ResponseEntity<MemberExitRequestDTO> initiateExit(
            @PathVariable UUID memberId,
            @Valid @RequestBody InitiateExitRequest request) {
        return ResponseEntity.ok(memberExitService.initiateExit(memberId, request));
    }

    @GetMapping("/{memberId}/exit/history")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<List<MemberExitRequestDTO>> getMemberExitHistory(@PathVariable UUID memberId) {
        return ResponseEntity.ok(memberExitService.getMemberExitHistory(memberId));
    }

    @PostMapping("/exit-requests/{exitRequestId}/approve")
    @PreAuthorize("hasRole('PRESIDENT')")
    public ResponseEntity<MemberExitRequestDTO> approveExit(
            @PathVariable UUID exitRequestId,
            @Valid @RequestBody(required = false) ExitDecisionRequest request) {
        String note = request != null ? request.getRejectionReason() : null;
        return ResponseEntity.ok(memberExitService.approveExit(exitRequestId, note));
    }

    @PostMapping("/exit-requests/{exitRequestId}/reject")
    @PreAuthorize("hasRole('PRESIDENT')")
    public ResponseEntity<MemberExitRequestDTO> rejectExit(
            @PathVariable UUID exitRequestId,
            @Valid @RequestBody(required = false) ExitDecisionRequest request) {
        String reason = request != null ? request.getRejectionReason() : "No reason provided";
        return ResponseEntity.ok(memberExitService.rejectExit(exitRequestId, reason));
    }

    @PostMapping("/exit-requests/{exitRequestId}/payout")
    @PreAuthorize("hasRole('FINANCE')")
    public ResponseEntity<MemberExitRequestDTO> recordPayout(
            @PathVariable UUID exitRequestId,
            @Valid @RequestBody ExitPayoutRequest request) {
        return ResponseEntity.ok(memberExitService.recordPayout(exitRequestId, request.getPayoutReference()));
    }

    @GetMapping("/exit-requests/pending")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<List<MemberExitRequestDTO>> getPendingExitRequests() {
        return ResponseEntity.ok(memberExitService.getPendingExitRequests());
    }

    @GetMapping("/exit-requests")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT')")
    public ResponseEntity<List<MemberExitRequestDTO>> getAllExitRequests() {
        return ResponseEntity.ok(memberExitService.getAllExitRequests());
    }
}
