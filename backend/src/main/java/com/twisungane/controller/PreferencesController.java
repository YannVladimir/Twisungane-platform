package com.twisungane.controller;

import com.twisungane.dto.MemberDTO;
import com.twisungane.dto.PreferenceUpdateRequest;
import com.twisungane.entity.Member;
import com.twisungane.repository.MemberRepository;
import com.twisungane.service.MemberService;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/preferences")
@RequiredArgsConstructor
public class PreferencesController {

    private final MemberService memberService;
    private final MemberRepository memberRepository;
    private final HmacUtil hmacUtil;

    @PatchMapping
    public ResponseEntity<MemberDTO> updatePreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody PreferenceUpdateRequest request) {

        Member member = memberRepository.findByEmailHash(hmacUtil.hash(userDetails.getUsername()))
                .orElseThrow(() -> new RuntimeException("User not found"));

        MemberDTO updatedMember = memberService.updatePreferences(member.getId(), request);
        return ResponseEntity.ok(updatedMember);
    }
}
