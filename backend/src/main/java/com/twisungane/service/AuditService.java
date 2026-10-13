package com.twisungane.service;

import com.twisungane.entity.AuditLog;
import com.twisungane.entity.Member;
import com.twisungane.repository.AuditLogRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final MemberRepository memberRepository;
    private final HmacUtil hmacUtil;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, String targetType, String targetId, String message) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Member actor = memberRepository.findByEmailHash(hmacUtil.hash(email)).orElse(null);

        AuditLog log = AuditLog.builder()
                .actor(actor)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();

        auditLogRepository.save(log);
    }
}
