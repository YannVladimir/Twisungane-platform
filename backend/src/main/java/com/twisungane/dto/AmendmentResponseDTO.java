package com.twisungane.dto;

import com.twisungane.entity.TransactionAmendment;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AmendmentResponseDTO {

    private UUID id;
    private TransactionAmendment.TransactionType transactionType;
    private UUID originalTransactionId;
    private BigDecimal originalAmount;
    private BigDecimal correctAmount;
    private String reason;
    private String amendmentDetails;
    private TransactionAmendment.AmendmentStatus status;
    private String requestedByName;
    private UUID requestedById;
    private String reviewedByName;
    private String rejectionReason;
    private UUID reversalTransactionId;
    private UUID correctionTransactionId;
    private LocalDateTime appliedAt;
    private LocalDateTime createdAt;
}
