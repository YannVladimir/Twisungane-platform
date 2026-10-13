package com.twisungane.controller;

import com.twisungane.dto.LoginRequest;
import com.twisungane.dto.UserResponse;
import com.twisungane.service.AuthService;
import com.twisungane.service.TokenBlacklistService;
import com.twisungane.util.JwtUtil;
import jakarta.validation.Valid;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final TokenBlacklistService tokenBlacklistService;

    @Value("${twisungane.cookie.secure:true}")
    private boolean cookieSecure;

    public AuthController(AuthService authService, JwtUtil jwtUtil, TokenBlacklistService tokenBlacklistService) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        UserResponse userResponse = authService.login(request);

        ResponseCookie cookie = ResponseCookie.from("jwt", userResponse.getToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ofHours(24))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // Return user metadata without the token — browser holds it in the cookie
        return ResponseEntity.ok(UserResponse.builder()
                .id(userResponse.getId())
                .email(userResponse.getEmail())
                .firstName(userResponse.getFirstName())
                .lastName(userResponse.getLastName())
                .role(userResponse.getRole())
                .preferredLanguage(userResponse.getPreferredLanguage())
                .preferredTheme(userResponse.getPreferredTheme())
                .build());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("jwt".equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    try {
                        tokenBlacklistService.invalidate(cookie.getValue(), jwtUtil.extractExpiration(cookie.getValue()));
                    } catch (Exception ignored) {
                        // token already expired or malformed — no need to blacklist
                    }
                }
            }
        }
        ResponseCookie expiredCookie = ResponseCookie.from("jwt", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<Object> getCurrentUser(
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {
        if (userDetails == null)
            return ResponseEntity.status(401).build();
        Map<String, Object> details = new HashMap<>();
        details.put("username", userDetails.getUsername());
        details.put("authorities", userDetails.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toList()));
        return ResponseEntity.ok(details);
    }
}
