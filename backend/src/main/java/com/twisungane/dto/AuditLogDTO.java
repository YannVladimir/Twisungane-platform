package com.twisungane.dto;

import com.twisungane.entity.AuditLog;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class AuditLogDTO {
    private UUID id;
    private String actorName;
    private String action;
    private String targetType;
    private String targetId;
    private String message;
    private LocalDateTime timestamp;

    public static AuditLogDTO fromEntity(AuditLog log) {
        return AuditLogDTO.builder()
                .id(log.getId())
                .actorName(log.getActor() != null ? log.getActor().getFirstName() + " " + log.getActor().getLastName() : "System")
                .action(log.getAction())
                .targetType(log.getTargetType())
                .targetId(log.getTargetId())
                .message(log.getMessage())
                .timestamp(log.getTimestamp())
                .build();
    }
}
