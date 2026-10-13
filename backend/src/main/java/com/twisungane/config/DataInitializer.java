package com.twisungane.config;

import com.twisungane.entity.Member;
import com.twisungane.entity.UserRole;
import com.twisungane.entity.Permission;
import com.twisungane.entity.RolePermission;
import com.twisungane.entity.SystemConfig;
import com.twisungane.entity.LoanProduct;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.UserRoleRepository;
import com.twisungane.repository.PermissionRepository;
import com.twisungane.repository.RolePermissionRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.repository.LoanProductRepository;
import com.twisungane.util.HmacUtil;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
@Order(1)
public class DataInitializer implements CommandLineRunner {

    private final MemberRepository memberRepository;
    private final UserRoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final SystemConfigRepository configRepository;
    private final LoanProductRepository productRepository;
    private final HmacUtil hmacUtil;

    public DataInitializer(MemberRepository memberRepository,
            UserRoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            PermissionRepository permissionRepository,
            RolePermissionRepository rolePermissionRepository,
            SystemConfigRepository configRepository,
            LoanProductRepository productRepository,
            HmacUtil hmacUtil) {
        this.memberRepository = memberRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.configRepository = configRepository;
        this.productRepository = productRepository;
        this.hmacUtil = hmacUtil;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedRoles();
        seedPermissions();
        seedSystemConfigs();
        seedLoanProducts();
        seedAdminUser();
        seedPresidentUser();
    }

    private void seedRoles() {
        if (roleRepository.count() == 0) {
            roleRepository.save(UserRole.builder().name("ROLE_ADMIN").description("System Administrator").build());
            roleRepository.save(UserRole.builder().name("ROLE_PRESIDENT").description("Association President").build());
            roleRepository.save(UserRole.builder().name("ROLE_FINANCE").description("Finance Officer").build());
            roleRepository.save(UserRole.builder().name("ROLE_MEMBER").description("Standard Member").build());
        }
    }

    private void seedPermissions() {
        if (permissionRepository.count() == 0) {
            // Member permissions
            Permission viewAll = savePermission("MEMBER_VIEW_ALL", "View all association members");
            Permission createMember = savePermission("MEMBER_CREATE", "Register new members");
            
            // Loan permissions
            Permission reqLoan = savePermission("LOAN_REQUEST", "Request a new loan");
            Permission appLoan = savePermission("LOAN_APPROVE", "Approve or reject loan requests");
            Permission disLoan = savePermission("LOAN_DISBURSE", "Record loan disbursement");
            Permission recPay = savePermission("REPAYMENT_RECORD", "Record loan repayments");
            
            // Social fund
            Permission subSocial = savePermission("SOCIAL_CLAIM_SUBMIT", "Submit social fund claims");
            Permission appSocial = savePermission("SOCIAL_CLAIM_APPROVE", "Approve social fund payouts");
            Permission paySocial = savePermission("SOCIAL_PAYOUT_RECORD", "Record social fund payouts");
            
            // Penalty
            Permission waivePen = savePermission("PENALTY_WAIVE", "Waive late payment penalties");
            
            // System
            Permission manageConfig = savePermission("CONFIG_MANAGE", "Manage system settings and rules");

            // Mapping to Roles
            link(role("ROLE_ADMIN"), viewAll, createMember, manageConfig);
            link(role("ROLE_PRESIDENT"), viewAll, appLoan, appSocial, waivePen);
            link(role("ROLE_FINANCE"), viewAll, disLoan, recPay, paySocial, subSocial);
            link(role("ROLE_MEMBER"), reqLoan, subSocial);
        }
    }

    private Permission savePermission(String code, String desc) {
        return permissionRepository.save(Permission.builder().code(code).description(desc).build());
    }

    private UserRole role(String name) {
        return roleRepository.findByName(name).orElseThrow();
    }

    private void link(UserRole role, Permission... perms) {
        for (Permission p : perms) {
            rolePermissionRepository.save(RolePermission.builder().role(role).permission(p).build());
        }
    }

    private void seedSystemConfigs() {
        if (configRepository.count() == 0) {
            configRepository.save(SystemConfig.builder()
                    .configKey("LOAN_INTEREST_RATE")
                    .configValue("0.10")
                    .description("Flat interest rate on loan principal")
                    .build());
            configRepository.save(SystemConfig.builder()
                    .configKey("MONTHLY_PRINCIPAL_BASE")
                    .configValue("50000")
                    .description("Fixed monthly principal repayment amount")
                    .build());
            configRepository.save(SystemConfig.builder()
                    .configKey("MIN_MONTHLY_INSTALLMENT")
                    .configValue("55000")
                    .description("Minimum monthly payment (Principal + Interest)")
                    .build());

            // Social Payout Rates
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_MEMBER_WEDDING").configValue("50000").description("Payout for member's wedding").build());
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_CHILD_WEDDING").configValue("30000").description("Payout for member's child wedding").build());
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_BIRTH").configValue("50000").description("Payout for birth of child").build());
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_HOSPITALIZATION").configValue("50000").description("Payout for hospitalization").build());
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_MEMBER_DEATH").configValue("150000").description("Payout for member's death").build());
            configRepository.save(SystemConfig.builder().configKey("SOCIAL_PAYOUT_RELATIVE_DEATH").configValue("100000").description("Payout for spouse/parent/child death").build());

            // Registration Config
            configRepository.save(SystemConfig.builder()
                    .configKey("SHARE_PRICE")
                    .configValue("100000")
                    .description("Value of a single share in FRW")
                    .build());

            configRepository.save(SystemConfig.builder()
                    .configKey("BANK_FEES_BALANCE")
                    .configValue("0")
                    .description("Central ledger for accumulated bank fees (loanable)")
                    .build());
        }

        // Added independently of the block above (not gated by count()==0) so it seeds correctly
        // even in an already-initialized database.
        if (configRepository.findByConfigKey("SOCIAL_FUND_LAW_EFFECTIVE_DATE").isEmpty()) {
            configRepository.save(SystemConfig.builder()
                    .configKey("SOCIAL_FUND_LAW_EFFECTIVE_DATE")
                    .configValue("2025-01-01")
                    .description("Loans disbursed before this date: Social Fund does not participate in interest distribution, and its full balance (not just the amount above the 50,000 reserve) counts as available for lending. On/after this date, the normal rules apply.")
                    .build());
        }
    }

    private void seedLoanProducts() {
        if (productRepository.count() == 0) {
            productRepository.save(LoanProduct.builder()
                    .name("ORDINARY_LOAN")
                    .description("Standard loan for members with 1+ shares")
                    .multiplier(new java.math.BigDecimal("2.0"))
                    .maxTermMonths(24)
                    .requiresGuarantor(true)
                    .waitPeriodDays(15)
                    .build());
        }
    }

    private void seedAdminUser() {
        if (memberRepository.findByEmailHash(hmacUtil.hash("admin@twisungane.com")).isEmpty()) {
            UserRole adminRole = role("ROLE_ADMIN");

            Member admin = Member.builder()
                    .firstName("Admin")
                    .lastName("Twisungane")
                    .email("admin@twisungane.com")
                    .emailHash(hmacUtil.hash("admin@twisungane.com"))
                    .nationalId("1199000000000010")
                    .nationalIdHash(hmacUtil.hash("1199000000000010"))
                    .password(passwordEncoder.encode("admin123"))
                    .role(adminRole)
                    .status(Member.MemberStatus.ACTIVE)
                    .type(Member.MemberType.STANDARD)
                    .joinDate(LocalDate.now())
                    .dateOfBirth(LocalDate.of(1990, 1, 1))
                    .build();

            memberRepository.save(admin);
        }
    }

    private void seedPresidentUser() {
        if (memberRepository.findByEmailHash(hmacUtil.hash("president@twisungane.com")).isEmpty()) {
            UserRole presidentRole = role("ROLE_PRESIDENT");

            Member president = Member.builder()
                    .firstName("President")
                    .lastName("Twisungane")
                    .email("president@twisungane.com")
                    .emailHash(hmacUtil.hash("president@twisungane.com"))
                    .nationalId("1199000000000011")
                    .nationalIdHash(hmacUtil.hash("1199000000000011"))
                    .password(passwordEncoder.encode("president123"))
                    .role(presidentRole)
                    .status(Member.MemberStatus.ACTIVE)
                    .type(Member.MemberType.STANDARD)
                    .joinDate(LocalDate.now())
                    .dateOfBirth(LocalDate.of(1985, 5, 15))
                    .build();

            memberRepository.save(president);
        }
    }
}
