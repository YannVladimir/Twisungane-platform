package com.twisungane.controller;

import com.twisungane.dto.LoanApplicationDTO;
import com.twisungane.dto.RepaymentRequest;
import com.twisungane.entity.Loan;
import com.twisungane.entity.LoanApplication;
import com.twisungane.exception.ResourceNotFoundException;
import com.twisungane.repository.LoanApplicationRepository;
import com.twisungane.service.AuditService;
import com.twisungane.service.LoanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final LoanApplicationRepository applicationRepository;
    private final LoanService loanService;
    private final AuditService auditService;

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    public ResponseEntity<List<LoanApplicationDTO>> getPending() {
        List<LoanApplication> pending = applicationRepository.findByStatus(LoanApplication.ApplicationStatus.PENDING);
        return ResponseEntity.ok(pending.stream().map(loanService::convertToDTO).toList());
    }

    @PostMapping("/loans/{id}/approve")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN')")
    public ResponseEntity<Void> approveLoan(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        LoanApplication app = applicationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Loan application not found: " + id));

        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        // Skip active-loan guard for admin (historical import replays loans in order)
        if (!isAdmin) {
            boolean hasActiveLoan = loanService.getAllLoans(app.getMember().getId())
                    .stream().anyMatch(l -> l.getStatus() == Loan.LoanStatus.ACTIVE);
            if (hasActiveLoan) {
                throw new RuntimeException("Member already has an ACTIVE loan. Cannot approve another.");
            }
        }

        app.setStatus(LoanApplication.ApplicationStatus.APPROVED);
        applicationRepository.save(app);

        auditService.log(
            "LOAN_APPROVED", 
            "LOAN_APPLICATION", 
            app.getId().toString(), 
            String.format("Approved loan application #%s for %s %s", app.getLoanNumber(), app.getMember().getFirstName(), app.getMember().getLastName())
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping("/loans/{id}/reject")
    @PreAuthorize("hasRole('PRESIDENT')")
    public ResponseEntity<Void> rejectLoan(@PathVariable UUID id) {
        LoanApplication app = applicationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Loan application not found: " + id));
        app.setStatus(LoanApplication.ApplicationStatus.REJECTED);
        applicationRepository.save(app);

        auditService.log(
            "LOAN_REJECTED", 
            "LOAN_APPLICATION", 
            app.getId().toString(), 
            String.format("Rejected loan application #%s for %s %s", app.getLoanNumber(), app.getMember().getFirstName(), app.getMember().getLastName())
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping("/loans/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT')")
    public ResponseEntity<Void> cancelLoan(@PathVariable UUID id) {
        LoanApplication app = applicationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Loan application not found: " + id));
        // Cancellation by Admin/President before approval
        if (app.getStatus() != LoanApplication.ApplicationStatus.PENDING) {
            throw new RuntimeException("Only pending applications can be cancelled.");
        }
        app.setStatus(LoanApplication.ApplicationStatus.REJECTED);
        app.setRejectionReason("Cancelled by Administrator");
        applicationRepository.save(app);

        auditService.log(
            "LOAN_CANCELLED", 
            "LOAN_APPLICATION", 
            app.getId().toString(), 
            String.format("Cancelled pending loan application #%s for %s %s", app.getLoanNumber(), app.getMember().getFirstName(), app.getMember().getLastName())
        );

        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/loans/{id}/disburse", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_OCTET_STREAM_VALUE, "*/*" })
    @PreAuthorize("hasAnyRole('FINANCE', 'PRESIDENT', 'ADMIN')")
    public ResponseEntity<Void> disburseLoan(
            @PathVariable UUID id,
            @RequestPart(value = "contract", required = false) MultipartFile contract,
            @AuthenticationPrincipal UserDetails userDetails) {
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        loanService.disburse(id, contract, isAdmin);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/repayment/{loanId}")
    @PreAuthorize("hasAnyRole('FINANCE', 'PRESIDENT', 'ADMIN')")
    public ResponseEntity<Void> recordRepayment(
            @PathVariable UUID loanId,
            @Valid @RequestBody RepaymentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        loanService.recordRepayment(loanId, request.getAmount(), request.getTransactionReference(), request.getPaymentDate(), isAdmin);
        return ResponseEntity.ok().build();
    }
}
