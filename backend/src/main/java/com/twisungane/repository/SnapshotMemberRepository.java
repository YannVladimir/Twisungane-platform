package com.twisungane.repository;

import com.twisungane.entity.Member;
import com.twisungane.entity.SnapshotMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SnapshotMemberRepository extends JpaRepository<SnapshotMember, UUID> {
    List<SnapshotMember> findBySnapshotId(UUID snapshotId);
    List<SnapshotMember> findByMemberId(UUID memberId);
    Optional<SnapshotMember> findBySnapshotIdAndMemberId(UUID snapshotId, UUID memberId);

    @Query("SELECT COALESCE(SUM(sm.cashedOutInterestAmount), 0) FROM SnapshotMember sm")
    BigDecimal sumAllCashedOut();

    @Query("SELECT COALESCE(SUM(sm.paidInterestAmount), 0) FROM SnapshotMember sm WHERE sm.snapshot.id = :snapshotId")
    BigDecimal sumPaidInterestBySnapshotId(@Param("snapshotId") UUID snapshotId);

    @Query("SELECT COUNT(sm) > 0 FROM SnapshotMember sm WHERE sm.member.id = :memberId AND sm.snapshot.loan.status = com.twisungane.entity.Loan.LoanStatus.ACTIVE")
    boolean hasActiveLoanSnapshot(@org.springframework.data.repository.query.Param("memberId") UUID memberId);

    @Query("SELECT COALESCE(SUM(sm.expectedInterestAmount), 0) FROM SnapshotMember sm WHERE sm.member.type = :type")
    BigDecimal sumExpectedInterestByMemberType(@Param("type") Member.MemberType type);
}
