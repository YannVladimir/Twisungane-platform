package com.twisungane.dto;

import com.twisungane.entity.LoanApplication;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanApplicationDTO {
    private UUID id;
    private UUID memberId;
    private String memberName;
    private String memberNationalId;
    private Long productId;
    private String productName;
    private BigDecimal requestedAmount;
    private LocalDate issuedDate;
    private String purpose;
    private LoanApplication.ApplicationStatus status;
    private String rejectionReason;
    private String guarantorName;
    private String loanNumber;
    private LocalDateTime createdAt;
}
