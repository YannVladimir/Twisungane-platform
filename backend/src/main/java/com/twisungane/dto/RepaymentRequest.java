package com.twisungane.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class RepaymentRequest {
    @NotNull(message = "Repayment amount is required")
    @DecimalMin(value = "1.0", message = "Repayment amount must be greater than zero")
    private BigDecimal amount;

    private String transactionReference;
    private java.time.LocalDate paymentDate;
}
