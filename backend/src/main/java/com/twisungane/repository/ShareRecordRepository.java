package com.twisungane.repository;

import com.twisungane.entity.Member;
import com.twisungane.entity.ShareRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ShareRecordRepository extends JpaRepository<ShareRecord, UUID> {
    List<ShareRecord> findByMemberId(UUID memberId);
    List<ShareRecord> findByMemberIdIn(java.util.Collection<UUID> memberIds);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM ShareRecord r")
    BigDecimal sumAll();

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM ShareRecord r WHERE r.member.type <> :type")
    BigDecimal sumByMemberTypeNot(@Param("type") Member.MemberType type);

    @Query("SELECT r.member.id FROM ShareRecord r WHERE r.member.type <> :type GROUP BY r.member.id HAVING SUM(r.amount) >= :minAmount")
    List<UUID> findMemberIdsWithSharesAtLeast(@Param("type") Member.MemberType type, @Param("minAmount") BigDecimal minAmount);

    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM ShareRecord r WHERE r.dateBought >= :from AND r.dateBought < :to")
    BigDecimal sumByDateBoughtRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
