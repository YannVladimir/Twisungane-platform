package com.twisungane.controller;

import com.twisungane.entity.Penalty;
import com.twisungane.service.PenaltyService;
import com.twisungane.repository.PenaltyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/penalties")
@RequiredArgsConstructor
public class PenaltyController {

    private final PenaltyService penaltyService;
    private final PenaltyRepository penaltyRepository;

    @GetMapping("/my")
    public ResponseEntity<List<Penalty>> getMemberPenalties(@RequestParam UUID memberId) {
        return ResponseEntity.ok(penaltyService.getUnpaid(memberId));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'ADMIN', 'FINANCE')")
    public ResponseEntity<List<Penalty>> getAllPenalties(@RequestParam(required = false) Penalty.PenaltyStatus status) {
        if (status != null) {
            return ResponseEntity.ok(penaltyRepository.findByStatus(status));
        }
        return ResponseEntity.ok(penaltyRepository.findAll());
    }

    @PostMapping("/{penaltyId}/waive")
    @PreAuthorize("hasRole('PRESIDENT')")
    public ResponseEntity<Void> waive(@PathVariable UUID penaltyId, @RequestParam UUID presidentId) {
        penaltyService.waivePenalty(penaltyId, presidentId);
        return ResponseEntity.ok().build();
    }
}
