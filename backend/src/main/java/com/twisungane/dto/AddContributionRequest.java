package com.twisungane.dto;

import com.twisungane.entity.Contribution;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class AddContributionRequest {
    private UUID memberId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    private BigDecimal amount;
    private Contribution.ContributionType type;
    private Integer month;
    private Integer year;
    private java.time.LocalDate datePaid;
    private String details;
}
