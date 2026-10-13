package com.twisungane.service;

import com.twisungane.dto.GroupExpenseDTO;
import com.twisungane.entity.ExpenseType;
import com.twisungane.entity.GroupExpense;
import com.twisungane.entity.Member;
import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.GroupExpenseRepository;
import com.twisungane.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final GroupExpenseRepository expenseRepository;
    private final SystemConfigRepository configRepository;
    private final AuditService auditService;

    @Transactional
    public GroupExpenseDTO recordExpense(
            BigDecimal amount,
            ExpenseType type,
            String description,
            LocalDate date,
            Member recordedBy,
            String slipPath) {

        GroupExpense expense = GroupExpense.builder()
                .amount(amount)
                .type(type)
                .description(description)
                .date(date)
                .recordedBy(recordedBy)
                .slipPath(slipPath)
                .build();
        
        GroupExpense saved = recordExpense(expense);

        auditService.log(
            "EXPENSE_RECORDED",
            "EXPENSE",
            saved.getId().toString(),
            String.format("Recorded %s expense: %s FRW - %s", type, amount, description)
        );

        return convertToDTO(saved);
    }

    @Transactional
    public GroupExpense recordExpense(GroupExpense expense) {
        if (expense.getType() == ExpenseType.SOCIAL) {
            updateBalance("SOCIAL_FUND_BALANCE", expense.getAmount());
        } else if (expense.getType() == ExpenseType.BANK) {
            updateBalance("BANK_FEES_BALANCE", expense.getAmount());
        }
        
        return expenseRepository.save(expense);
    }

    private void updateBalance(String key, BigDecimal amount) {
        SystemConfig config = configRepository.findByConfigKey(key)
                .orElseThrow(() -> new RuntimeException("Configuration key not found: " + key));
        
        BigDecimal currentBalance = new BigDecimal(config.getConfigValue());
        if (currentBalance.compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient funds in " + key);
        }
        
        config.setConfigValue(currentBalance.subtract(amount).toString());
        configRepository.save(config);
    }

    public List<GroupExpenseDTO> getAllExpenses() {
        return expenseRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<GroupExpenseDTO> getExpensesByType(ExpenseType type) {
        return expenseRepository.findByTypeOrderByDateDesc(type).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public Map<ExpenseType, BigDecimal> getSummaryByType() {
        return expenseRepository.findAll().stream()
                .collect(Collectors.groupingBy(
                        GroupExpense::getType,
                        Collectors.mapping(GroupExpense::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))
                ));
    }

    public GroupExpenseDTO convertToDTO(GroupExpense expense) {
        return GroupExpenseDTO.builder()
                .id(expense.getId())
                .amount(expense.getAmount())
                .date(expense.getDate())
                .type(expense.getType())
                .description(expense.getDescription())
                .recordedByName(expense.getRecordedBy() != null ?
                    expense.getRecordedBy().getFirstName() + " " + expense.getRecordedBy().getLastName() : "System")
                .createdAt(expense.getCreatedAt())
                .slipPath(expense.getSlipPath())
                .build();
    }
}
