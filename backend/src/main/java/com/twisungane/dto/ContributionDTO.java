package com.twisungane.dto;

import com.twisungane.entity.Contribution;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ContributionDTO {
    private UUID id;
    private UUID memberId;
    private String memberName;
    private BigDecimal amount;
    private Contribution.ContributionType type;
    private Integer month;
    private Integer year;
    private LocalDateTime datePaid;
    private String details;
    private String signedContractPath;

    public static ContributionDTO fromEntity(Contribution c) {
        return ContributionDTO.builder()
                .id(c.getId())
                .memberId(c.getMember() != null ? c.getMember().getId() : null)
                .memberName(c.getMember() != null ? c.getMember().getFirstName() + " " + c.getMember().getLastName() : "System")
                .amount(c.getAmount())
                .type(c.getType())
                .month(c.getMonth())
                .year(c.getYear())
                .datePaid(c.getDatePaid())
                .details(c.getDetails())
                .signedContractPath(c.getSignedContractPath())
                .build();
    }
}
