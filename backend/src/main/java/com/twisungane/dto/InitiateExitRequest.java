package com.twisungane.dto;

import com.twisungane.entity.MemberExitRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class InitiateExitRequest {
    @NotNull(message = "Exit type is required")
    private MemberExitRequest.ExitType exitType;

    @NotBlank(message = "Exit reason is required")
    private String exitReason;
}
