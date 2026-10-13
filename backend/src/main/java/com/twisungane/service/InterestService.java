package com.twisungane.service;

import com.twisungane.dto.InterestSplitPreviewDTO;
import com.twisungane.dto.MemberInterestSplitDTO;
import com.twisungane.dto.TopupResultDTO;
import com.twisungane.entity.*;
import com.twisungane.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterestService {

    private final MemberRepository memberRepository;
    private final InterestSnapshotRepository snapshotRepository;
    private final SnapshotMemberRepository snapshotMemberRepository;
    private final SystemConfigRepository configRepository;
    private final ContributionRepository contributionRepository;
    private final MemberService memberService;
    private final AuditService auditService;

    @Transactional
    public void distributePenaltyAsInterest(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) return;

        // Find or create the Global Interest Snapshot
        InterestSnapshot snapshot = getOrCreateGlobalSnapshot();
        
        List<Member> activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.MemberStatus.ACTIVE)
                .collect(Collectors.toList());

        BigDecimal totalGroupWeight = BigDecimal.ZERO;
        for (Member m : activeMembers) {
            BigDecimal mShares = getTotalShares(m);
            BigDecimal mReserves = memberService.getObligatoryReserveBalance(m.getId());
            totalGroupWeight = totalGroupWeight.add(mShares).add(mReserves);
        }

        if (totalGroupWeight.compareTo(BigDecimal.ZERO) == 0) return;

        List<Member> eligibleMembers = new ArrayList<>();
        List<BigDecimal> eligibleShares = new ArrayList<>();
        List<BigDecimal> eligibleReserves = new ArrayList<>();
        List<BigDecimal> eligibleWeights = new ArrayList<>();
        for (Member m : activeMembers) {
            BigDecimal mShares = getTotalShares(m);
            BigDecimal mReserves = memberService.getObligatoryReserveBalance(m.getId());
            BigDecimal mWeight = mShares.add(mReserves);
            if (mWeight.compareTo(BigDecimal.ZERO) > 0) {
                eligibleMembers.add(m);
                eligibleShares.add(mShares);
                eligibleReserves.add(mReserves);
                eligibleWeights.add(mWeight);
            }
        }

        List<BigDecimal> amounts = com.twisungane.util.ProportionalSplitter.splitExactly(amount, eligibleWeights);

        for (int idx = 0; idx < eligibleMembers.size(); idx++) {
            Member m = eligibleMembers.get(idx);
            BigDecimal mShares = eligibleShares.get(idx);
            BigDecimal mReserves = eligibleReserves.get(idx);
            BigDecimal proportionalInterest = amounts.get(idx);

            SnapshotMember sm = snapshotMemberRepository.findBySnapshotIdAndMemberId(snapshot.getId(), m.getId())
                    .orElseGet(() -> SnapshotMember.builder()
                            .snapshot(snapshot)
                            .member(m)
                            .sharesAtTime(mShares)
                            .reserveSharesAtTime(mReserves)
                            .expectedInterestAmount(BigDecimal.ZERO)
                            .paidInterestAmount(BigDecimal.ZERO)
                            .build());

            // Update shares at time for record keeping
            sm.setSharesAtTime(mShares);
            sm.setReserveSharesAtTime(mReserves);
            sm.setPaidInterestAmount(sm.getPaidInterestAmount().add(proportionalInterest));
            sm.setExpectedInterestAmount(sm.getExpectedInterestAmount().add(proportionalInterest));
            snapshotMemberRepository.save(sm);

            // If it's the social account, update its balance too
            if (m.getType() == Member.MemberType.SOCIAL) {
                SystemConfig socialConfig = configRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                        .orElseThrow(() -> new RuntimeException("SOCIAL_FUND_BALANCE config missing"));
                BigDecimal currentBalance = new BigDecimal(socialConfig.getConfigValue());
                BigDecimal newBalance = currentBalance.add(proportionalInterest);
                socialConfig.setConfigValue(newBalance.setScale(0, RoundingMode.HALF_UP).toPlainString());
                configRepository.save(socialConfig);
            }
        }

        auditService.log(
            "INTEREST_DISTRIBUTED",
            "INTEREST",
            snapshot.getId().toString(),
            String.format("Distributed %s FRW as interest among all active members.", amount)
        );
    }

    private InterestSnapshot getOrCreateGlobalSnapshot() {
        Optional<SystemConfig> config = configRepository.findByConfigKey("GLOBAL_INTEREST_SNAPSHOT_ID");
        if (config.isPresent()) {
            return snapshotRepository.findById(UUID.fromString(config.get().getConfigValue()))
                    .orElseGet(this::createGlobalSnapshot);
        } else {
            return createGlobalSnapshot();
        }
    }

    private InterestSnapshot createGlobalSnapshot() {
        InterestSnapshot snapshot = InterestSnapshot.builder()
                .totalSharesAtTime(BigDecimal.ZERO)
                .build();
        snapshot = snapshotRepository.save(snapshot);
        
        // Save the snapshot ID in config for persistence
        SystemConfig config = configRepository.findByConfigKey("GLOBAL_INTEREST_SNAPSHOT_ID")
                .orElseGet(() -> SystemConfig.builder().configKey("GLOBAL_INTEREST_SNAPSHOT_ID").build());
        
        config.setConfigValue(snapshot.getId().toString());
        config.setDescription("Snapshot ID for global interest distributions (Penalties, etc.)");
        configRepository.save(config);
        
        return snapshot;
    }

    private BigDecimal getTotalShares(Member m) {
        return memberService.convertToDTO(m).getTotalShares();
    }

    /**
     * A direct cash top-up to a member's own interest balance — distinct from the obligatory
     * reserve requirement (recorded separately as a Contribution) and from the social fund.
     * The amount is simply credited as interest the member now has available (for cash-out or
     * to count towards their reserve later, same as loan/penalty-earned interest).
     */
    @Transactional
    public void recordInterestTopup(UUID memberId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Top-up amount must be greater than zero.");
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        InterestSnapshot snapshot = getOrCreateTopupSnapshot();

        SnapshotMember sm = snapshotMemberRepository.findBySnapshotIdAndMemberId(snapshot.getId(), memberId)
                .orElseGet(() -> SnapshotMember.builder()
                        .snapshot(snapshot)
                        .member(member)
                        .sharesAtTime(getTotalShares(member))
                        .reserveSharesAtTime(memberService.getObligatoryReserveBalance(member.getId()))
                        .expectedInterestAmount(BigDecimal.ZERO)
                        .paidInterestAmount(BigDecimal.ZERO)
                        .cashedOutInterestAmount(BigDecimal.ZERO)
                        .build());

        sm.setPaidInterestAmount(sm.getPaidInterestAmount().add(amount));
        sm.setExpectedInterestAmount(sm.getExpectedInterestAmount().add(amount));
        snapshotMemberRepository.save(sm);

        auditService.log("INTEREST_TOPUP_RECORDED", "INTEREST", memberId.toString(),
                String.format("Recorded a %s FRW interest top-up for %s %s.", amount, member.getFirstName(), member.getLastName()));
    }

    private InterestSnapshot getOrCreateTopupSnapshot() {
        Optional<SystemConfig> config = configRepository.findByConfigKey("GLOBAL_TOPUP_SNAPSHOT_ID");
        if (config.isPresent()) {
            return snapshotRepository.findById(UUID.fromString(config.get().getConfigValue()))
                    .orElseGet(this::createTopupSnapshot);
        } else {
            return createTopupSnapshot();
        }
    }

    private InterestSnapshot createTopupSnapshot() {
        InterestSnapshot snapshot = InterestSnapshot.builder()
                .totalSharesAtTime(BigDecimal.ZERO)
                .build();
        snapshot = snapshotRepository.save(snapshot);

        SystemConfig config = configRepository.findByConfigKey("GLOBAL_TOPUP_SNAPSHOT_ID")
                .orElseGet(() -> SystemConfig.builder().configKey("GLOBAL_TOPUP_SNAPSHOT_ID").build());

        config.setConfigValue(snapshot.getId().toString());
        config.setDescription("Snapshot ID for direct member interest top-ups.");
        configRepository.save(config);

        return snapshot;
    }

    public MemberInterestSplitDTO getMemberTopupInfo(UUID memberId) {
        int currentYear = LocalDate.now().getYear();
        BigDecimal yearlyRequirement = new BigDecimal("25000");

        Member m = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        List<SnapshotMember> records = snapshotMemberRepository.findByMemberId(m.getId());
        BigDecimal availableInterest = records.stream()
                .map(sm -> sm.getPaidInterestAmount().subtract(sm.getCashedOutInterestAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal alreadyPaid = contributionRepository.sumByMemberIdTypeAndYear(
                m.getId(), Contribution.ContributionType.OBLIGATORY_RESERVE, currentYear);
        BigDecimal remainingNeeded = yearlyRequirement.subtract(alreadyPaid).max(BigDecimal.ZERO);

        BigDecimal deduct = availableInterest.min(remainingNeeded);
        BigDecimal cash = availableInterest.subtract(deduct);
        BigDecimal topupAmount = remainingNeeded.subtract(deduct).max(BigDecimal.ZERO);

        return MemberInterestSplitDTO.builder()
                .memberId(m.getId())
                .memberName(m.getFirstName() + " " + m.getLastName())
                .nationalId(m.getNationalId())
                .availableInterest(availableInterest)
                .reserveAlreadyPaid(alreadyPaid)
                .reserveRemainingNeeded(remainingNeeded)
                .amountToReserve(deduct)
                .amountToCash(cash)
                .topupNeeded(topupAmount.compareTo(BigDecimal.ZERO) > 0)
                .topupAmount(topupAmount)
                .build();
    }

    @Transactional
    public TopupResultDTO recordTopup(UUID memberId, BigDecimal totalAmount, int month, int year) {
        BigDecimal yearlyRequirement = new BigDecimal("25000");

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        BigDecimal alreadyPaid = contributionRepository.sumByMemberIdTypeAndYear(
                memberId, Contribution.ContributionType.OBLIGATORY_RESERVE, year);
        BigDecimal reserveStillNeeded = yearlyRequirement.subtract(alreadyPaid).max(BigDecimal.ZERO);

        BigDecimal reservePortion = totalAmount.min(reserveStillNeeded);
        BigDecimal socialPortion = totalAmount.subtract(reservePortion);

        LocalDateTime now = LocalDateTime.now();

        if (reservePortion.compareTo(BigDecimal.ZERO) > 0) {
            contributionRepository.save(Contribution.builder()
                    .member(member)
                    .amount(reservePortion)
                    .type(Contribution.ContributionType.OBLIGATORY_RESERVE)
                    .month(month)
                    .year(year)
                    .datePaid(now)
                    .details("Interest top-up – reserve shortfall (" + year + ")")
                    .build());
        }

        if (socialPortion.compareTo(BigDecimal.ZERO) > 0) {
            contributionRepository.save(Contribution.builder()
                    .member(member)
                    .amount(socialPortion)
                    .type(Contribution.ContributionType.SOCIAL)
                    .month(month)
                    .year(year)
                    .datePaid(now)
                    .details("Interest top-up – social portion (" + year + ")")
                    .build());

            SystemConfig socialConfig = configRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                    .orElseGet(() -> SystemConfig.builder().configKey("SOCIAL_FUND_BALANCE").configValue("0").build());
            BigDecimal newBalance = new BigDecimal(socialConfig.getConfigValue()).add(socialPortion);
            socialConfig.setConfigValue(newBalance.setScale(0, RoundingMode.HALF_UP).toPlainString());
            configRepository.save(socialConfig);
        }

        auditService.log("INTEREST_TOPUP_RECORDED", "CONTRIBUTION", member.getId().toString(),
                String.format("Interest top-up of %s FRW for %s %s: %s to reserve, %s to social (%d)",
                        totalAmount, member.getFirstName(), member.getLastName(),
                        reservePortion, socialPortion, year));

        return TopupResultDTO.builder()
                .memberId(memberId)
                .memberName(member.getFirstName() + " " + member.getLastName())
                .totalTopup(totalAmount)
                .reservePortion(reservePortion)
                .socialPortion(socialPortion)
                .reserveTargetPerYear(yearlyRequirement)
                .reserveAlreadyPaidBeforeTopup(alreadyPaid)
                .reserveTotalAfterTopup(alreadyPaid.add(reservePortion))
                .build();
    }

    public InterestSplitPreviewDTO getInterestSplitPreview() {
        int currentYear = LocalDate.now().getYear();
        BigDecimal yearlyRequirement = new BigDecimal("25000");

        List<Member> activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.MemberStatus.ACTIVE && m.getType() == Member.MemberType.STANDARD)
                .collect(Collectors.toList());

        List<SnapshotMember> allRecords = snapshotMemberRepository.findAll();
        Map<UUID, List<SnapshotMember>> groupedByMember = allRecords.stream()
                .collect(Collectors.groupingBy(sm -> sm.getMember().getId()));

        List<MemberInterestSplitDTO> splits = new ArrayList<>();
        BigDecimal totalToCash = BigDecimal.ZERO;
        BigDecimal totalToReserve = BigDecimal.ZERO;

        for (Member m : activeMembers) {
            BigDecimal totalShares = getTotalShares(m);
            if (totalShares.compareTo(BigDecimal.ZERO) <= 0) continue;

            List<SnapshotMember> records = groupedByMember.getOrDefault(m.getId(), new ArrayList<>());
            BigDecimal availableInterest = records.stream()
                    .map(sm -> sm.getPaidInterestAmount().subtract(sm.getCashedOutInterestAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (availableInterest.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal alreadyPaid = contributionRepository.sumByMemberIdTypeAndYear(m.getId(), Contribution.ContributionType.OBLIGATORY_RESERVE, currentYear);
            BigDecimal remainingNeeded = yearlyRequirement.subtract(alreadyPaid);
            if (remainingNeeded.compareTo(BigDecimal.ZERO) < 0) remainingNeeded = BigDecimal.ZERO;

            BigDecimal deduct = availableInterest.min(remainingNeeded);
            BigDecimal cash = availableInterest.subtract(deduct);

            splits.add(MemberInterestSplitDTO.builder()
                    .memberId(m.getId())
                    .memberName(m.getFirstName() + " " + m.getLastName())
                    .nationalId(m.getNationalId())
                    .availableInterest(availableInterest)
                    .reserveAlreadyPaid(alreadyPaid)
                    .reserveRemainingNeeded(remainingNeeded)
                    .amountToReserve(deduct)
                    .amountToCash(cash)
                    .topupNeeded(remainingNeeded.compareTo(availableInterest) > 0)
                    .topupAmount(remainingNeeded.subtract(deduct))
                    .build());

            totalToCash = totalToCash.add(cash);
            totalToReserve = totalToReserve.add(deduct);
        }

        return InterestSplitPreviewDTO.builder()
                .splits(splits)
                .totalInterestToCash(totalToCash)
                .totalInterestToReserve(totalToReserve)
                .year(currentYear)
                .build();
    }

    @Transactional
    public void executeInterestSplit(List<MemberInterestSplitDTO> selections) {
        int currentYear = LocalDate.now().getYear();
        LocalDateTime now = LocalDateTime.now();

        for (MemberInterestSplitDTO split : selections) {
            Member member = memberRepository.findById(split.getMemberId()).orElseThrow();
            
            // 1. Mark as cashed out in snapshots
            List<SnapshotMember> records = snapshotMemberRepository.findByMemberId(member.getId());
            for (SnapshotMember sm : records) {
                sm.setCashedOutInterestAmount(sm.getPaidInterestAmount());
                snapshotMemberRepository.save(sm);
            }

            // 2. If split to reserve, record contribution
            if (split.getAmountToReserve().compareTo(BigDecimal.ZERO) > 0) {
                Contribution c = Contribution.builder()
                        .member(member)
                        .amount(split.getAmountToReserve())
                        .type(Contribution.ContributionType.OBLIGATORY_RESERVE)
                        .year(currentYear)
                        .month(LocalDate.now().getMonthValue())
                        .datePaid(now)
                        .details("Interest-to-Reserve Split (" + currentYear + ")")
                        .build();
                contributionRepository.save(c);
            }

            auditService.log(
                "INTEREST_CASHED_OUT",
                "INTEREST",
                member.getId().toString(),
                String.format("Interest split executed for %s: %s FRW cashed, %s FRW to reserve.", member.getFirstName(), split.getAmountToCash(), split.getAmountToReserve())
            );
        }
    }
}
