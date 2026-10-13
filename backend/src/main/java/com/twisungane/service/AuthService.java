package com.twisungane.service;

import com.twisungane.dto.LoginRequest;
import com.twisungane.dto.UserResponse;
import com.twisungane.entity.Member;
import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.util.HmacUtil;
import com.twisungane.util.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final MemberRepository memberRepository;
    private final JwtUtil jwtUtil;
    private final HmacUtil hmacUtil;
    private final SystemConfigRepository systemConfigRepository;

    public AuthService(AuthenticationManager authenticationManager,
            UserDetailsService userDetailsService,
            MemberRepository memberRepository,
            JwtUtil jwtUtil,
            HmacUtil hmacUtil,
            SystemConfigRepository systemConfigRepository) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.memberRepository = memberRepository;
        this.jwtUtil = jwtUtil;
        this.hmacUtil = hmacUtil;
        this.systemConfigRepository = systemConfigRepository;
    }

    public UserResponse login(LoginRequest request) {
        String emailHash = hmacUtil.hash(request.getEmail());
        Member member = memberRepository.findByEmailHash(emailHash)
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Invalid email or password"));

        if (member.isLocked()) {
            if (member.getLockedUntil() != null && member.getLockedUntil().isBefore(java.time.LocalDateTime.now())) {
                member.setLocked(false);
                member.setLockedUntil(null);
                member.setFailedLoginAttempts(0);
                memberRepository.save(member);
            } else {
                throw new org.springframework.security.authentication.LockedException("Account is locked. Please try again later.");
            }
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
            
            // Reset attempts on success
            member.setFailedLoginAttempts(0);
            memberRepository.save(member);
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            int attempts = member.getFailedLoginAttempts() + 1;
            member.setFailedLoginAttempts(attempts);
            if (attempts >= getConfigInt("LOGIN_MAX_ATTEMPTS", 5)) {
                member.setLocked(true);
                member.setLockedUntil(java.time.LocalDateTime.now().plusMinutes(getConfigInt("LOGIN_LOCKOUT_MINUTES", 15)));
            }
            memberRepository.save(member);
            throw e;
        }

        final UserDetails userDetails = userDetailsService.loadUserByUsername(request.getEmail());
        final String jwt = jwtUtil.generateToken(userDetails);

        return UserResponse.builder()
                .id(member.getId())
                .email(member.getEmail())
                .firstName(member.getFirstName())
                .lastName(member.getLastName())
                .role(member.getRole().getName())
                .token(jwt)
                .preferredLanguage(member.getPreferredLanguage())
                .preferredTheme(member.getPreferredTheme())
                .build();
    }

    private int getConfigInt(String key, int defaultValue) {
        return systemConfigRepository.findByConfigKey(key)
                .map(c -> Integer.parseInt(c.getConfigValue()))
                .orElse(defaultValue);
    }
}
