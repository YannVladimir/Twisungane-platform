package com.twisungane.repository;

import com.twisungane.entity.LoanRepayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface LoanRepaymentRepository extends JpaRepository<LoanRepayment, UUID> {
    List<LoanRepayment> findByLoanId(UUID loanId);
    List<LoanRepayment> findByLoanMemberIdIn(java.util.Collection<UUID> memberIds);
    List<LoanRepayment> findByPaymentDateBetween(LocalDateTime from, LocalDateTime to);

    @Query("SELECT COALESCE(SUM(r.interestPaid), 0) FROM LoanRepayment r WHERE r.amendmentStatus != 'AMENDED'")
    BigDecimal sumAllInterestPaid();

    @Query("SELECT COALESCE(SUM(r.totalAmount), 0) FROM LoanRepayment r WHERE r.paymentDate >= :from AND r.paymentDate < :to AND r.amendmentStatus != 'AMENDED'")
    BigDecimal sumTotalAmountByDateRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
