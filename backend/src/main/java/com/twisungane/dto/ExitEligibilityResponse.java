package com.twisungane.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExitEligibilityResponse {
    private boolean eligible;
    private List<String> blockers;
    private List<String> warnings;
}
