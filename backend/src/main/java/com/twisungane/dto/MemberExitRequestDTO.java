package com.twisungane.dto;

import com.twisungane.entity.MemberExitRequest;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberExitRequestDTO {
    private UUID id;
    private UUID memberId;
    private String memberName;
    private String memberEmail;
    private String memberNationalId;
    private MemberExitRequest.ExitStatus status;
    private MemberExitRequest.ExitType exitType;
    private String exitReason;
    private BigDecimal totalShareValue;
    private BigDecimal totalUnpaidPenalties;
    private BigDecimal netSettlementAmount;
    private BigDecimal totalExpectedInterest;
    private BigDecimal totalPaidInterest;
    private BigDecimal totalUnpaidInterest;
    private LocalDate expectedLastPaymentDate;
    private String initiatedByName;
    private String approvedByName;
    private LocalDateTime approvedAt;
    private String rejectionReason;
    private LocalDateTime payoutRecordedAt;
    private String payoutReference;
    private String payoutRecordedByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
