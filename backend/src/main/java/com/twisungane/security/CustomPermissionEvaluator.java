package com.twisungane.security;

import com.twisungane.entity.Member;
import com.twisungane.entity.UserPermission;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.RolePermissionRepository;
import com.twisungane.repository.UserPermissionRepository;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class CustomPermissionEvaluator implements PermissionEvaluator {

    private final MemberRepository memberRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final UserPermissionRepository userPermissionRepository;
    private final HmacUtil hmacUtil;

    @Override
    public boolean hasPermission(Authentication auth, Object targetDomainObject, Object permission) {
        if (auth == null || permission == null) return false;
        
        String email = auth.getName();
        String permissionCode = permission.toString();

        Optional<Member> memberOpt = memberRepository.findByEmailHash(hmacUtil.hash(email));
        if (memberOpt.isEmpty()) return false;
        
        Member member = memberOpt.get();

        // 1. Check Individual Overrides
        Optional<UserPermission> override = userPermissionRepository.findByUserIdAndPermissionCode(member.getId(), permissionCode);
        if (override.isPresent()) {
            return override.get().isGranted();
        }

        // 2. Check Role Defaults
        return rolePermissionRepository.existsByRoleNameAndPermissionCode(member.getRole().getName(), permissionCode);
    }

    @Override
    public boolean hasPermission(Authentication auth, Serializable targetId, String targetType, Object permission) {
        // Not used in this implementation but required by interface
        return hasPermission(auth, null, permission);
    }
}
