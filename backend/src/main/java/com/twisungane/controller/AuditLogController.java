package com.twisungane.controller;

import com.twisungane.dto.AuditLogDTO;
import com.twisungane.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<Page<AuditLogDTO>> getAuditLogs(Pageable pageable) {
        return ResponseEntity.ok(auditLogRepository.findAllByOrderByTimestampDesc(pageable)
                .map(AuditLogDTO::fromEntity));
    }
}
