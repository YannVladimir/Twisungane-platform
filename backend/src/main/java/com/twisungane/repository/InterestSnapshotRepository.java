package com.twisungane.repository;

import com.twisungane.entity.InterestSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface InterestSnapshotRepository extends JpaRepository<InterestSnapshot, UUID> {
    Optional<InterestSnapshot> findByLoanId(UUID loanId);
}
