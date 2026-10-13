package com.twisungane.service;

import com.twisungane.entity.Member;
import com.twisungane.entity.Penalty;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.PenaltyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PenaltyService {

    private final PenaltyRepository penaltyRepository;
    private final MemberRepository memberRepository;

    @Transactional
    public void applyPenalty(Member member, UUID loanId, BigDecimal amount, Penalty.PenaltyType type, String description) {
        // Replacement Logic for Late Payments
        if (type == Penalty.PenaltyType.LATE_30D) {
            List<Penalty> existing15D = penaltyRepository.findByLoanIdAndStatus(loanId, Penalty.PenaltyStatus.ACTIVE)
                    .stream()
                    .filter(p -> p.getType() == Penalty.PenaltyType.LATE_15D)
                    .toList();
            
            // Replaces 15D penalties
            for (Penalty p : existing15D) {
                p.setStatus(Penalty.PenaltyStatus.WAIVED);
                p.setDescription("Replaced by 30D Penalty");
                penaltyRepository.save(p);
            }
        }

        Penalty penalty = Penalty.builder()
                .member(member)
                .loan(loanId != null ? com.twisungane.entity.Loan.builder().id(loanId).build() : null)
                .amount(amount)
                .type(type)
                .status(Penalty.PenaltyStatus.ACTIVE)
                .description(description)
                .build();

        penaltyRepository.save(penalty);
    }

    @Transactional
    public void waivePenalty(UUID penaltyId, UUID presidentId) {
        Penalty penalty = penaltyRepository.findById(penaltyId).orElseThrow();
        Member president = memberRepository.findById(presidentId).orElseThrow();

        penalty.setStatus(Penalty.PenaltyStatus.WAIVED);
        penalty.setWaivedBy(president);
        penalty.setWaivedAt(LocalDateTime.now());
        penalty.setDescription(penalty.getDescription() + " (Waived by President)");

        penaltyRepository.save(penalty);
    }

    public List<Penalty> getUnpaid(UUID memberId) {
        return penaltyRepository.findByMemberIdAndStatus(memberId, Penalty.PenaltyStatus.ACTIVE);
    }

    @Transactional
    public void markAsPaid(Penalty penalty) {
        penalty.setStatus(Penalty.PenaltyStatus.PAID);
        penalty.setPaidAt(LocalDateTime.now());
        penaltyRepository.save(penalty);
    }
}
