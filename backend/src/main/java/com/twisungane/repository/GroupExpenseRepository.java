package com.twisungane.repository;

import com.twisungane.entity.GroupExpense;
import com.twisungane.entity.ExpenseType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface GroupExpenseRepository extends JpaRepository<GroupExpense, UUID> {
    List<GroupExpense> findByType(ExpenseType type);
    List<GroupExpense> findByTypeOrderByDateDesc(ExpenseType type);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM GroupExpense e WHERE e.date >= :from AND e.date < :to")
    BigDecimal sumAmountByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM GroupExpense e WHERE e.type = :type")
    BigDecimal sumByType(@Param("type") ExpenseType type);
}
