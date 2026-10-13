package com.twisungane.controller;

import com.twisungane.dto.*;
import com.twisungane.entity.Member;
import com.twisungane.entity.SnapshotMember;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SnapshotMemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.service.InterestService;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import java.math.RoundingMode;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/interests")
@RequiredArgsConstructor
public class InterestController {

    private final SnapshotMemberRepository snapshotMemberRepository;
    private final MemberRepository memberRepository;
    private final InterestService interestService;
    private final HmacUtil hmacUtil;
    private final SystemConfigRepository configRepository;

    private String resolveLoanReference(SnapshotMember sm) {
        if (sm.getSnapshot().getLoan() != null) {
            String loanId = sm.getSnapshot().getLoan().getId().toString();
            return "..." + loanId.substring(loanId.length() - 6);
        }
        java.util.Optional<String> topupSnapshotId = configRepository.findByConfigKey("GLOBAL_TOPUP_SNAPSHOT_ID")
                .map(c -> c.getConfigValue());
        if (topupSnapshotId.isPresent() && topupSnapshotId.get().equals(sm.getSnapshot().getId().toString())) {
            return "TOP-UP";
        }
        return "GLOBAL-PENALTY";
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    public ResponseEntity<List<InterestDTO>> getAllInterests() {
        // Group all snapshot records by member
        List<SnapshotMember> allRecords = snapshotMemberRepository.findAll();
        Map<Member, List<SnapshotMember>> groupedByMember = allRecords.stream()
                .collect(Collectors.groupingBy(SnapshotMember::getMember));

        List<InterestDTO> dtos = new ArrayList<>();

        // Ensure we include members who might have 0 interest right now? 
        // The prompt says "show interests of each individual including the social member".
        // Let's iterate over ALL active members instead.
        List<Member> allActive = memberRepository.findByStatusIn(
                java.util.List.of(Member.MemberStatus.ACTIVE, Member.MemberStatus.EXITING, Member.MemberStatus.EXITED));

        for (Member m : allActive) {
            List<SnapshotMember> records = groupedByMember.getOrDefault(m, new ArrayList<>());

            BigDecimal totalExpected = records.stream()
                    .map(SnapshotMember::getExpectedInterestAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalPaid = records.stream()
                    .map(SnapshotMember::getPaidInterestAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalCashedOut = records.stream()
                    .map(SnapshotMember::getCashedOutInterestAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalCapitalInterest = records.stream()
                    .map(sm -> {
                        BigDecimal weight = sm.getSharesAtTime().add(sm.getReserveSharesAtTime());
                        if (weight.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
                        return sm.getPaidInterestAmount()
                                .multiply(sm.getSharesAtTime())
                                .divide(weight, 2, RoundingMode.HALF_UP);
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal totalReserveInterest = records.stream()
                    .map(sm -> {
                        BigDecimal weight = sm.getSharesAtTime().add(sm.getReserveSharesAtTime());
                        if (weight.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
                        return sm.getPaidInterestAmount()
                                .multiply(sm.getReserveSharesAtTime())
                                .divide(weight, 2, RoundingMode.HALF_UP);
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            List<InterestDetailDTO> details = records.stream().map(sm -> {
                BigDecimal weight = sm.getSharesAtTime().add(sm.getReserveSharesAtTime());
                BigDecimal capInt = BigDecimal.ZERO;
                BigDecimal resInt = BigDecimal.ZERO;
                if (weight.compareTo(BigDecimal.ZERO) > 0) {
                    capInt = sm.getPaidInterestAmount().multiply(sm.getSharesAtTime()).divide(weight, 2, RoundingMode.HALF_UP);
                    resInt = sm.getPaidInterestAmount().subtract(capInt); // use subtraction for precision
                }

                return InterestDetailDTO.builder()
                        .loanReference(resolveLoanReference(sm))
                        .snapshotDate(sm.getUpdatedAt())
                        .expectedInterest(sm.getExpectedInterestAmount())
                        .paidInterest(sm.getPaidInterestAmount())
                        .cashedOutInterest(sm.getCashedOutInterestAmount())
                        .capitalInterest(capInt)
                        .reserveInterest(resInt)
                        .build();
            }).sorted(java.util.Comparator.comparing(InterestDetailDTO::getSnapshotDate).reversed())
              .collect(Collectors.toList());

            BigDecimal totalUnpaid = totalExpected.subtract(totalPaid);

            // Exiting/exited members only appear while they still have interest not yet hand-distributed
            if (m.getStatus() == Member.MemberStatus.EXITING || m.getStatus() == Member.MemberStatus.EXITED) {
                BigDecimal pending = totalPaid.subtract(totalCashedOut);
                if (pending.compareTo(BigDecimal.ZERO) <= 0) continue;
            }

            dtos.add(InterestDTO.builder()
                    .memberId(m.getId())
                    .memberName(m.getFirstName() + " " + m.getLastName())
                    .nationalId(m.getNationalId())
                    .isSocialAccount(m.getType() == Member.MemberType.SOCIAL)
                    .totalExpectedInterest(totalExpected)
                    .totalPaidInterest(totalPaid)
                    .totalUnpaidInterest(totalUnpaid)
                    .totalCashedOutInterest(totalCashedOut)
                    .totalCapitalInterest(totalCapitalInterest)
                    .totalReserveInterest(totalReserveInterest)
                    .details(details)
                    .build());
        }
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/my-portfolio")
    public ResponseEntity<InterestDTO> getMyInterestPortfolio(Principal principal) {
        Member member = memberRepository.findByEmailHash(hmacUtil.hash(principal.getName()))
                .orElseThrow(() -> new RuntimeException("Member not found"));

        List<SnapshotMember> records = snapshotMemberRepository.findByMemberId(member.getId());

        BigDecimal totalExpected = records.stream()
                .map(SnapshotMember::getExpectedInterestAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = records.stream()
                .map(SnapshotMember::getPaidInterestAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCashedOut = records.stream()
                .map(SnapshotMember::getCashedOutInterestAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalUnpaid = totalExpected.subtract(totalPaid);

        List<InterestDetailDTO> details = records.stream().map(sm -> InterestDetailDTO.builder()
                .loanReference(resolveLoanReference(sm))
                .snapshotDate(sm.getUpdatedAt())
                .expectedInterest(sm.getExpectedInterestAmount())
                .paidInterest(sm.getPaidInterestAmount())
                .cashedOutInterest(sm.getCashedOutInterestAmount())
                .build())
                .sorted(java.util.Comparator.comparing(InterestDetailDTO::getSnapshotDate).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(InterestDTO.builder()
                .memberId(member.getId())
                .memberName(member.getFirstName() + " " + member.getLastName())
                .nationalId(member.getNationalId())
                .isSocialAccount(member.getType() == Member.MemberType.SOCIAL)
                .totalExpectedInterest(totalExpected)
                .totalPaidInterest(totalPaid)
                .totalUnpaidInterest(totalUnpaid)
                .totalCashedOutInterest(totalCashedOut)
                .details(details)
                .build());
    }

    @PostMapping("/distribute/all")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> distributeAll() {
        List<SnapshotMember> members = snapshotMemberRepository.findAll();
        for (SnapshotMember sm : members) {
            BigDecimal diff = sm.getPaidInterestAmount().subtract(sm.getCashedOutInterestAmount());
            if (diff.compareTo(BigDecimal.ZERO) > 0) {
                sm.setCashedOutInterestAmount(sm.getPaidInterestAmount());
                snapshotMemberRepository.save(sm);
            }
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/distribute/{memberId}")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> distributeForMember(@PathVariable java.util.UUID memberId) {
        List<SnapshotMember> records = snapshotMemberRepository.findByMemberId(memberId);
        for (SnapshotMember sm : records) {
            BigDecimal diff = sm.getPaidInterestAmount().subtract(sm.getCashedOutInterestAmount());
            if (diff.compareTo(BigDecimal.ZERO) > 0) {
                sm.setCashedOutInterestAmount(sm.getPaidInterestAmount());
                snapshotMemberRepository.save(sm);
            }
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/split-preview")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    public ResponseEntity<InterestSplitPreviewDTO> getSplitPreview() {
        return ResponseEntity.ok(interestService.getInterestSplitPreview());
    }

    @PostMapping("/topup/{memberId}")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    public ResponseEntity<Void> recordInterestTopup(
            @PathVariable java.util.UUID memberId,
            @RequestBody Map<String, Object> body) {
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        interestService.recordInterestTopup(memberId, amount);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/split-execute")
    @PreAuthorize("hasAnyRole('PRESIDENT', 'FINANCE', 'ADMIN')")
    public ResponseEntity<?> executeSplit(@RequestBody List<MemberInterestSplitDTO> selections) {
        interestService.executeInterestSplit(selections);
        return ResponseEntity.ok().build();
    }
}
