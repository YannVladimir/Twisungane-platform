package com.twisungane.dto;

import com.twisungane.entity.Member;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDTO {
    private UUID id;
    private String nationalId;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private Member.MemberStatus status;
    private Member.MemberType type;
    private String role;
    private UUID guarantorId;
    private String guarantorName;
    private LocalDate joinDate;
    private LocalDate dateOfBirth;
    private boolean isMinor;
    private BigDecimal totalShares;
    private BigDecimal totalObligatoryReserve;
    private BigDecimal totalContributions;
    private boolean isSocialAccount;
    private Double computedShareCount; // For Social member: number of 0.5-based shares
    private String signedContractPath;
}
