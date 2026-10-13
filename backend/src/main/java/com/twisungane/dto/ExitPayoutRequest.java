package com.twisungane.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExitPayoutRequest {
    @NotBlank(message = "Payout reference is required")
    private String payoutReference;
}
