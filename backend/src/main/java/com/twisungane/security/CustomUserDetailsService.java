package com.twisungane.security;

import com.twisungane.entity.Member;
import com.twisungane.repository.MemberRepository;
import com.twisungane.util.HmacUtil;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final MemberRepository memberRepository;
    private final HmacUtil hmacUtil;

    public CustomUserDetailsService(MemberRepository memberRepository, HmacUtil hmacUtil) {
        this.memberRepository = memberRepository;
        this.hmacUtil = hmacUtil;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Member member = memberRepository.findByEmailHash(hmacUtil.hash(email))
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        return new User(
                member.getEmail(),
                member.getPassword(),
                member.getStatus() == Member.MemberStatus.ACTIVE || member.getStatus() == Member.MemberStatus.EXITING,
                true,
                true,
                !member.isLocked(),
                Collections.singletonList(new SimpleGrantedAuthority(member.getRole().getName())));
    }
}
