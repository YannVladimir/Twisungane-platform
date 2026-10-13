package com.twisungane.controller;

import com.twisungane.dto.GroupExpenseDTO;
import com.twisungane.entity.ExpenseType;
import com.twisungane.entity.GroupExpense;
import com.twisungane.entity.Member;
import com.twisungane.repository.GroupExpenseRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.exception.ResourceNotFoundException;
import com.twisungane.service.ExpenseService;
import com.twisungane.service.FileStorageService;
import com.twisungane.util.HmacUtil;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/expenses")
@RequiredArgsConstructor
public class GroupExpenseController {

    private final ExpenseService expenseService;
    private final MemberRepository memberRepository;
    private final GroupExpenseRepository expenseRepository;
    private final FileStorageService fileStorageService;
    private final HmacUtil hmacUtil;

    @PostMapping(consumes = { MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_JSON_VALUE })
    public ResponseEntity<GroupExpenseDTO> recordExpense(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestPart("request") ExpenseRequest request,
            @RequestPart(value = "slip", required = false) MultipartFile slip) {

        Member recordedBy = memberRepository.findByEmailHash(hmacUtil.hash(userDetails.getUsername()))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        GroupExpenseDTO expense = expenseService.recordExpense(
                request.getAmount(),
                request.getType(),
                request.getDescription(),
                request.getDate(),
                recordedBy,
                fileStorageService.store(slip)
        );

        return ResponseEntity.ok(expense);
    }

    @PostMapping(value = "/{id}/slip", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<GroupExpenseDTO> uploadSlip(
            @PathVariable UUID id,
            @RequestPart("slip") MultipartFile slip) {

        GroupExpense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));

        if (expense.getSlipPath() != null) {
            fileStorageService.delete(expense.getSlipPath());
        }
        expense.setSlipPath(fileStorageService.store(slip));
        return ResponseEntity.ok(expenseService.convertToDTO(expenseRepository.save(expense)));
    }

    @GetMapping("/{id}/slip")
    public ResponseEntity<Resource> getSlip(@PathVariable UUID id) {
        GroupExpense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));

        if (expense.getSlipPath() == null) {
            throw new RuntimeException("No slip uploaded for this expense");
        }

        Resource resource = fileStorageService.loadAsResource(expense.getSlipPath());
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

    @GetMapping
    public ResponseEntity<List<GroupExpenseDTO>> getAllExpenses() {
        return ResponseEntity.ok(expenseService.getAllExpenses());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<GroupExpenseDTO>> getExpensesByType(@PathVariable ExpenseType type) {
        return ResponseEntity.ok(expenseService.getExpensesByType(type));
    }

    @Data
    public static class ExpenseRequest {
        private BigDecimal amount;
        private ExpenseType type;
        private String description;
        private LocalDate date;
    }
}
