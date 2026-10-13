package com.twisungane.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class LoanApplicationRequest {
    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.0", message = "Amount must be greater than zero")
    private BigDecimal amount;

    private LocalDate issuedDate;

    @NotBlank(message = "Purpose is required")
    private String purpose;

    private UUID guarantorId;
    private String loanNumber;
}
