package com.twisungane.repository;

import com.twisungane.entity.Penalty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PenaltyRepository extends JpaRepository<Penalty, UUID> {
    List<Penalty> findByMemberId(UUID memberId);
    List<Penalty> findByMemberIdAndStatus(UUID memberId, Penalty.PenaltyStatus status);
    List<Penalty> findByStatus(Penalty.PenaltyStatus status);
    List<Penalty> findByLoanIdAndStatus(UUID loanId, Penalty.PenaltyStatus status);
}
