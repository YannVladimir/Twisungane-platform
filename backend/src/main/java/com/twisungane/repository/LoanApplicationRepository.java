package com.twisungane.repository;

import com.twisungane.entity.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, UUID> {
    List<LoanApplication> findByMemberId(UUID memberId);
    List<LoanApplication> findByStatus(LoanApplication.ApplicationStatus status);
    List<LoanApplication> findByGuarantorId(UUID guarantorId);
    Optional<LoanApplication> findTopByOrderByCreatedAtDesc();
}
