package com.twisungane.repository;

import com.twisungane.entity.LedgerAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LedgerAdjustmentRepository extends JpaRepository<LedgerAdjustment, UUID> {
    List<LedgerAdjustment> findByAdjustmentTypeOrderByDateAsc(String adjustmentType);
    List<LedgerAdjustment> findByMemberIdOrderByDateAsc(UUID memberId);
}
