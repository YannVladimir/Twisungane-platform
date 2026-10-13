package com.twisungane.controller;

import com.twisungane.dto.AmendmentRequestDTO;
import com.twisungane.dto.AmendmentResponseDTO;
import com.twisungane.entity.TransactionAmendment;
import com.twisungane.service.AmendmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/amendments")
@RequiredArgsConstructor
public class AmendmentController {

    private final AmendmentService amendmentService;

    // Any authenticated Finance, President, or Admin can request an amendment
    @PostMapping
    @PreAuthorize("hasAnyRole('FINANCE', 'PRESIDENT', 'ADMIN')")
    public ResponseEntity<AmendmentResponseDTO> requestAmendment(
            @Valid @RequestBody AmendmentRequestDTO request) {

        TransactionAmendment amendment = amendmentService.requestAmendment(
            request.getTransactionType(),
            request.getOriginalTransactionId(),
            request.getOriginalAmount(),
            request.getCorrectAmount(),
            request.getReason(),
            request.getAmendmentDetails()
        );

        return ResponseEntity.ok(toDTO(amendment));
    }

    // President only: view all pending amendment requests
    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN')")
    public ResponseEntity<List<AmendmentResponseDTO>> getPending() {
        return ResponseEntity.ok(
            amendmentService.getPendingAmendments().stream().map(this::toDTO).toList()
        );
    }

    // Full history — available to Admin, President, Finance
    @GetMapping
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<AmendmentResponseDTO>> getAll() {
        return ResponseEntity.ok(
            amendmentService.getAllAmendments().stream().map(this::toDTO).toList()
        );
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<AmendmentResponseDTO> getOne(@PathVariable UUID id) {
        return ResponseEntity.ok(toDTO(amendmentService.getAmendment(id)));
    }

    // President approves → system immediately applies the amendment
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN')")
    public ResponseEntity<AmendmentResponseDTO> approve(@PathVariable UUID id) {
        return ResponseEntity.ok(toDTO(amendmentService.approveAmendment(id)));
    }

    // President rejects with a reason
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN')")
    public ResponseEntity<AmendmentResponseDTO> reject(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {

        String reason = body.getOrDefault("reason", "No reason provided");
        return ResponseEntity.ok(toDTO(amendmentService.rejectAmendment(id, reason)));
    }

    // Requester cancels their own pending amendment
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('FINANCE', 'PRESIDENT', 'ADMIN')")
    public ResponseEntity<AmendmentResponseDTO> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(toDTO(amendmentService.cancelAmendment(id)));
    }

    private AmendmentResponseDTO toDTO(TransactionAmendment a) {
        return AmendmentResponseDTO.builder()
                .id(a.getId())
                .transactionType(a.getTransactionType())
                .originalTransactionId(a.getOriginalTransactionId())
                .originalAmount(a.getOriginalAmount())
                .correctAmount(a.getCorrectAmount())
                .reason(a.getReason())
                .amendmentDetails(a.getAmendmentDetails())
                .status(a.getStatus())
                .requestedById(a.getRequestedBy() != null ? a.getRequestedBy().getId() : null)
                .requestedByName(a.getRequestedBy() != null
                    ? a.getRequestedBy().getFirstName() + " " + a.getRequestedBy().getLastName()
                    : null)
                .reviewedByName(a.getReviewedBy() != null
                    ? a.getReviewedBy().getFirstName() + " " + a.getReviewedBy().getLastName()
                    : null)
                .rejectionReason(a.getRejectionReason())
                .reversalTransactionId(a.getReversalTransactionId())
                .correctionTransactionId(a.getCorrectionTransactionId())
                .appliedAt(a.getAppliedAt())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
