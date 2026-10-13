package com.twisungane.repository;

import com.twisungane.entity.SocialClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SocialClaimRepository extends JpaRepository<SocialClaim, UUID> {
    List<SocialClaim> findByMemberId(UUID memberId);
    List<SocialClaim> findByStatus(SocialClaim.ClaimStatus status);
    List<SocialClaim> findByMemberIdInAndStatus(java.util.Collection<UUID> memberIds, SocialClaim.ClaimStatus status);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM SocialClaim c WHERE c.status = :status AND c.paidAt >= :from AND c.paidAt < :to")
    BigDecimal sumAmountByStatusAndPaidAtRange(@Param("status") SocialClaim.ClaimStatus status, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
