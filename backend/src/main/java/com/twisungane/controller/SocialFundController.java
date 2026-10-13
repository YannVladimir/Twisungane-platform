package com.twisungane.controller;

import com.twisungane.entity.SocialClaim;
import com.twisungane.service.SocialFundService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/social")
@RequiredArgsConstructor
public class SocialFundController {

    private final SocialFundService socialFundService;

    @PostMapping("/claim")
    public ResponseEntity<SocialClaim> submitClaim(
            @RequestParam UUID memberId,
            @RequestParam SocialClaim.EventType type,
            @RequestParam String reference) {
        return ResponseEntity.ok(socialFundService.submitClaim(memberId, type, reference));
    }

    @GetMapping("/my")
    public ResponseEntity<List<SocialClaim>> getMyClaims(@RequestParam UUID memberId) {
        return ResponseEntity.ok(socialFundService.getMyClaims(memberId));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<SocialClaim>> getPending() {
        return ResponseEntity.ok(socialFundService.getAllPending());
    }

    @PostMapping("/{claimId}/approve")
    @PreAuthorize("hasRole('PRESIDENT')")
    public ResponseEntity<SocialClaim> approve(
            @PathVariable UUID claimId,
            @RequestParam UUID presidentId,
            @RequestBody(required = false) String comments) {
        return ResponseEntity.ok(socialFundService.approveClaim(claimId, presidentId, comments));
    }

    @PostMapping("/{claimId}/disburse")
    @PreAuthorize("hasRole('FINANCE')")
    public ResponseEntity<SocialClaim> disburse(@PathVariable UUID claimId) {
        return ResponseEntity.ok(socialFundService.disbursePayout(claimId));
    }
}
