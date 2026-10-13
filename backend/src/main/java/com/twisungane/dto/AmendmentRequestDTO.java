package com.twisungane.dto;

import com.twisungane.entity.TransactionAmendment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AmendmentRequestDTO {

    @NotNull(message = "Transaction type is required")
    private TransactionAmendment.TransactionType transactionType;

    @NotNull(message = "Original transaction ID is required")
    private UUID originalTransactionId;

    @NotNull(message = "Original amount is required")
    private BigDecimal originalAmount;

    @NotNull(message = "Correct amount is required")
    private BigDecimal correctAmount;

    @NotBlank(message = "Reason is required")
    private String reason;

    // Optional JSON string for extra type-specific fields
    private String amendmentDetails;
}
