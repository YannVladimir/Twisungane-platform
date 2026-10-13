package com.twisungane.service;

import com.twisungane.entity.Member;
import com.twisungane.entity.SocialClaim;
import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SocialClaimRepository;
import com.twisungane.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SocialFundService {

    private final SocialClaimRepository claimRepository;
    private final MemberRepository memberRepository;
    private final SystemConfigRepository configRepository;
    private final AuditService auditService;

    @Transactional
    public SocialClaim submitClaim(UUID memberId, SocialClaim.EventType type, String reference) {
        Member member = memberRepository.findById(memberId).orElseThrow();
        
        // Lookup amount from config
        String configKey = "SOCIAL_PAYOUT_" + type.name();
        BigDecimal amount = new BigDecimal(configRepository.findByConfigKey(configKey)
                .map(SystemConfig::getConfigValue)
                .orElse("0"));

        SocialClaim claim = SocialClaim.builder()
                .member(member)
                .eventType(type)
                .amount(amount)
                .evidenceReference(reference)
                .status(SocialClaim.ClaimStatus.PENDING)
                .build();
        
        SocialClaim saved = claimRepository.save(claim);

        auditService.log(
            "SOCIAL_CLAIM_SUBMITTED",
            "SOCIAL_CLAIM",
            saved.getId().toString(),
            String.format("New social claim submitted by %s for %s: %s FRW", member.getFirstName(), type, amount)
        );

        return saved;
    }

    @Transactional
    public SocialClaim approveClaim(UUID claimId, UUID presidentId, String comments) {
        SocialClaim claim = claimRepository.findById(claimId).orElseThrow();
        Member president = memberRepository.findById(presidentId).orElseThrow();

        if (claim.getStatus() != SocialClaim.ClaimStatus.PENDING) {
            throw new RuntimeException("Claim is no longer pending.");
        }

        claim.setStatus(SocialClaim.ClaimStatus.APPROVED);
        claim.setApprovedBy(president);
        claim.setApprovedAt(LocalDateTime.now());
        claim.setPresidentComments(comments);

        SocialClaim saved = claimRepository.save(claim);

        auditService.log(
            "SOCIAL_CLAIM_APPROVED",
            "SOCIAL_CLAIM",
            saved.getId().toString(),
            String.format("Social claim approved by %s for %s: %s FRW", president.getFirstName(), saved.getMember().getFirstName(), saved.getAmount())
        );

        return saved;
    }

    @Transactional
    public SocialClaim disbursePayout(UUID claimId) {
        SocialClaim claim = claimRepository.findById(claimId).orElseThrow();
        if (claim.getStatus() != SocialClaim.ClaimStatus.APPROVED) {
            throw new RuntimeException("Claim must be approved before payout");
        }

        claim.setStatus(SocialClaim.ClaimStatus.PAID);
        claim.setPaidAt(LocalDateTime.now());

        SocialClaim saved = claimRepository.save(claim);

        auditService.log(
            "SOCIAL_CLAIM_PAID",
            "SOCIAL_CLAIM",
            saved.getId().toString(),
            String.format("Social payout disbursed to %s: %s FRW", saved.getMember().getFirstName(), saved.getAmount())
        );

        return saved;
    }

    public List<SocialClaim> getMyClaims(UUID memberId) {
        return claimRepository.findByMemberId(memberId);
    }

    public List<SocialClaim> getAllPending() {
        return claimRepository.findByStatus(SocialClaim.ClaimStatus.PENDING);
    }
}
