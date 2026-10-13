package com.twisungane.repository;

import com.twisungane.entity.Contribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ContributionRepository extends JpaRepository<Contribution, UUID> {
    List<Contribution> findByMemberId(UUID memberId);
    List<Contribution> findByMemberIdIn(java.util.Collection<UUID> memberIds);
    List<Contribution> findByType(Contribution.ContributionType type);

    @org.springframework.data.jpa.repository.Query("SELECT c FROM Contribution c WHERE c.month = :month AND c.year = :year")
    List<Contribution> findByMonthAndYear(
        @org.springframework.data.repository.query.Param("month") int month,
        @org.springframework.data.repository.query.Param("year") int year);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.member.id = :memberId AND c.type = :type AND c.year = :year")
    java.math.BigDecimal sumByMemberIdTypeAndYear(UUID memberId, Contribution.ContributionType type, Integer year);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.member.id = :memberId AND c.type = :type")
    java.math.BigDecimal sumByMemberIdAndType(UUID memberId, Contribution.ContributionType type);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.type = :type")
    java.math.BigDecimal sumAllByType(@org.springframework.data.repository.query.Param("type") Contribution.ContributionType type);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.month = :month AND c.year = :year")
    java.math.BigDecimal sumByMonthAndYear(@org.springframework.data.repository.query.Param("month") int month, @org.springframework.data.repository.query.Param("year") int year);
}
