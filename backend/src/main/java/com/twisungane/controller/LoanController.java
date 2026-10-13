package com.twisungane.controller;

import com.twisungane.dto.LoanApplicationDTO;
import com.twisungane.dto.LoanApplicationRequest;
import com.twisungane.dto.LoanDTO;
import com.twisungane.dto.LoanRepaymentDTO;
import com.twisungane.dto.ScheduleEntryDTO;
import com.twisungane.entity.Loan;
import com.twisungane.entity.LoanApplication;
import com.twisungane.entity.LoanProduct;
import com.twisungane.repository.LoanApplicationRepository;
import com.twisungane.repository.LoanProductRepository;
import com.twisungane.repository.LoanRepository;
import com.twisungane.service.LoanService;
import com.twisungane.service.PdfService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;
    private final PdfService pdfService;
    private final LoanRepository loanRepository;
    private final LoanApplicationRepository applicationRepository;
    private final LoanProductRepository productRepository;

    @GetMapping("/products")
    public ResponseEntity<List<LoanProduct>> getProducts() {
        return ResponseEntity.ok(productRepository.findAll());
    }

    @GetMapping("/eligibility")
    public ResponseEntity<BigDecimal> checkEligibility(@RequestParam UUID memberId) {
        return ResponseEntity.ok(loanService.calculateMaxLoanAmount(memberId));
    }

    @GetMapping("/history")
    public ResponseEntity<List<LoanDTO>> getHistory(@RequestParam(required = false) UUID memberId) {
        return ResponseEntity.ok(loanService.getAllLoans(memberId));
    }

    @GetMapping("/applications")
    public ResponseEntity<List<LoanApplicationDTO>> getApplications(@RequestParam(required = false) UUID memberId) {
        return ResponseEntity.ok(loanService.getApplications(memberId));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT')")
    public ResponseEntity<List<LoanDTO>> getAllLoans() {
        return ResponseEntity.ok(loanService.getAllLoans(null));
    }

    @GetMapping("/next-loan-number")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<java.util.Map<String, String>> getSuggestedNextLoanNumber() {
        return ResponseEntity.ok(java.util.Map.of("loanNumber", loanService.getSuggestedNextLoanNumber()));
    }

    @PostMapping("/apply")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LoanApplicationDTO> apply(
            @RequestParam UUID memberId,
            @Valid @RequestBody LoanApplicationRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        return ResponseEntity.ok(loanService.apply(
                memberId, 
                request.getProductId(), 
                request.getAmount(), 
                request.getPurpose(),
                isAdmin,
                request.getIssuedDate(),
                request.getLoanNumber(),
                request.getGuarantorId()));
    }

    @GetMapping("/{loanId}/contract")
    public ResponseEntity<byte[]> downloadContract(@PathVariable UUID loanId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        
        byte[] pdf = pdfService.generateLoanContract(loan);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=loan_contract_" + loanId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{loanId}/repayments")
    public ResponseEntity<List<LoanRepaymentDTO>> getRepayments(@PathVariable UUID loanId) {
        return ResponseEntity.ok(loanService.getRepayments(loanId));
    }

    @GetMapping("/{loanId}/schedule")
    public ResponseEntity<List<ScheduleEntryDTO>> getSchedule(@PathVariable UUID loanId) {
        return ResponseEntity.ok(loanService.getSchedule(loanId));
    }

    @PostMapping(value = "/{loanId}/signed-contract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<LoanDTO> uploadSignedContract(
            @PathVariable UUID loanId,
            @RequestPart("contract") MultipartFile contract) {
        return ResponseEntity.ok(loanService.uploadSignedContract(loanId, contract));
    }

    @GetMapping("/{loanId}/signed-contract")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE', 'MEMBER')")
    public ResponseEntity<Resource> getSignedContract(@PathVariable UUID loanId) {
        Resource resource = loanService.getSignedContractResource(loanId);
        String filename = resource.getFilename();
        MediaType contentType = MediaType.APPLICATION_OCTET_STREAM;
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".pdf")) contentType = MediaType.APPLICATION_PDF;
            else if (lower.endsWith(".docx")) contentType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            else if (lower.endsWith(".doc")) contentType = MediaType.parseMediaType("application/msword");
            else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = MediaType.IMAGE_JPEG;
            else if (lower.endsWith(".png")) contentType = MediaType.IMAGE_PNG;
            else if (lower.endsWith(".webp")) contentType = MediaType.parseMediaType("image/webp");
            else if (lower.endsWith(".heic") || lower.endsWith(".heif")) contentType = MediaType.parseMediaType("image/heic");
            else if (lower.endsWith(".bmp")) contentType = MediaType.parseMediaType("image/bmp");
            else if (lower.endsWith(".tiff") || lower.endsWith(".tif")) contentType = MediaType.parseMediaType("image/tiff");
        }
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(resource);
    }
}
