package com.twisungane.dto;

import com.twisungane.entity.Loan;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanDTO {
    private UUID id;
    private MemberDTO member;
    private BigDecimal principalAmount;
    private BigDecimal totalInterestAmount;
    private BigDecimal remainingPrincipal;
    private BigDecimal remainingInterest;
    private LocalDate disbursementDate;
    private LocalDate dueDate;
    private LocalDate nextPaymentDate;
    private String loanNumber;
    private Loan.LoanStatus status;
    private String signedContractPath;
}
