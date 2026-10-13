package com.twisungane.repository;

import com.twisungane.entity.Loan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoanRepository extends JpaRepository<Loan, UUID> {
    List<Loan> findByMemberId(UUID memberId);
    Optional<Loan> findByMemberIdAndStatus(UUID memberId, Loan.LoanStatus status);
    List<Loan> findByStatus(Loan.LoanStatus status);
    List<Loan> findByMemberIdIn(java.util.Collection<java.util.UUID> memberIds);

    @Query("SELECT COALESCE(SUM(l.remainingPrincipal), 0) FROM Loan l WHERE l.status = :status")
    BigDecimal sumRemainingPrincipalByStatus(@Param("status") Loan.LoanStatus status);

    @Query("SELECT COUNT(DISTINCT l.member.id) FROM Loan l WHERE l.status = :status")
    long countDistinctMembersByStatus(@Param("status") Loan.LoanStatus status);

    @Query("SELECT COALESCE(SUM(l.principalAmount), 0) FROM Loan l WHERE l.disbursementDate >= :from AND l.disbursementDate < :to")
    BigDecimal sumPrincipalByDisbursementDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
