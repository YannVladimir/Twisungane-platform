package com.twisungane.config;

import com.twisungane.entity.Member;
import com.twisungane.entity.SystemConfig;
import com.twisungane.entity.UserRole;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.repository.UserRoleRepository;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;

/**
 * Idempotent initializer that seeds the Social Fund pseudo-member and the
 * SOCIAL_FUND_BALANCE config key on every application startup.
 * Must run after DataInitializer (@Order(1)) so roles are already seeded.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class SocialMemberInitializer implements ApplicationRunner {

    private static final String SOCIAL_NATIONAL_ID = "SOCIAL-000";
    private static final String SOCIAL_EMAIL       = "social@twisungane.internal";
    private static final String SOCIAL_FUND_KEY    = "SOCIAL_FUND_BALANCE";

    private final MemberRepository       memberRepository;
    private final UserRoleRepository     roleRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JdbcTemplate           jdbcTemplate;
    private final HmacUtil               hmacUtil;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        fixDatabaseConstraints();
        seedSocialFundBalance();
        seedSocialMember();
    }

    private void fixDatabaseConstraints() {
        try {
            jdbcTemplate.execute("ALTER TABLE members DROP CONSTRAINT IF EXISTS members_type_check");
            log.info("SocialMemberInitializer: Dropped members_type_check constraint if it existed.");
        } catch (Exception e) {
            log.warn("SocialMemberInitializer: Could not drop constraint - {}", e.getMessage());
        }
    }

    private void seedSocialFundBalance() {
        if (systemConfigRepository.findByConfigKey(SOCIAL_FUND_KEY).isEmpty()) {
            systemConfigRepository.save(
                SystemConfig.builder()
                    .configKey(SOCIAL_FUND_KEY)
                    .configValue("0")
                    .description("Current balance of the Social Fund account (FRW). " +
                                 "50,000 FRW is always reserved. Money above that is treated as shares.")
                    .build()
            );
            log.info("SocialMemberInitializer: Created SOCIAL_FUND_BALANCE config key with default value 0.");
        }
    }

    private void seedSocialMember() {
        boolean exists = memberRepository.findByNationalIdHash(hmacUtil.hash(SOCIAL_NATIONAL_ID)).isPresent();
        if (exists) {
            log.info("SocialMemberInitializer: Social Fund member already exists, skipping creation.");
            return;
        }

        UserRole memberRole = roleRepository.findByName("ROLE_MEMBER")
                .orElseThrow(() -> new IllegalStateException("ROLE_MEMBER not found — cannot seed Social member."));

        Member social = Member.builder()
                .nationalId(SOCIAL_NATIONAL_ID)
                .nationalIdHash(hmacUtil.hash(SOCIAL_NATIONAL_ID))
                .firstName("Social")
                .lastName("Fund")
                .email(SOCIAL_EMAIL)
                .emailHash(hmacUtil.hash(SOCIAL_EMAIL))
                .phone("000000000")
                .password(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                .role(memberRole)
                .type(Member.MemberType.SOCIAL)
                .status(Member.MemberStatus.ACTIVE)
                .isLocked(true)
                .joinDate(LocalDate.now())
                .build();

        memberRepository.save(social);
        log.info("SocialMemberInitializer: Social Fund member seeded successfully.");
    }
}
