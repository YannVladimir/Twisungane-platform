package com.twisungane.controller;

import com.twisungane.dto.MemberDTO;
import com.twisungane.dto.MemberRegistrationRequest;
import com.twisungane.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<List<MemberDTO>> getAllMembers() {
        return ResponseEntity.ok(memberService.getAllMembers());
    }

    @GetMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<com.twisungane.entity.UserRole>> getRoles() {
        return ResponseEntity.ok(memberService.getAllRoles());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MemberDTO> registerMember(
            @RequestPart("request") @Valid MemberRegistrationRequest request,
            @RequestPart(value = "contract", required = false) MultipartFile contract) {
        return ResponseEntity.ok(memberService.registerMember(request, contract));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MemberDTO> updateMember(
            @PathVariable UUID id, 
            @RequestPart("request") MemberDTO memberDTO,
            @RequestPart(value = "contract", required = false) MultipartFile contract) {
        return ResponseEntity.ok(memberService.updateMember(id, memberDTO, contract));
    }

    @GetMapping("/{id}/contract")
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<Resource> downloadContract(@PathVariable UUID id) {
        Resource resource = memberService.getContractResource(id);
        String filename = resource.getFilename();
        MediaType contentType = MediaType.APPLICATION_OCTET_STREAM;
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".pdf")) {
                contentType = MediaType.APPLICATION_PDF;
            } else if (lower.endsWith(".docx")) {
                contentType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            } else if (lower.endsWith(".doc")) {
                contentType = MediaType.parseMediaType("application/msword");
            } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
                contentType = MediaType.IMAGE_JPEG;
            } else if (lower.endsWith(".png")) {
                contentType = MediaType.IMAGE_PNG;
            } else if (lower.endsWith(".webp")) {
                contentType = MediaType.parseMediaType("image/webp");
            } else if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
                contentType = MediaType.parseMediaType("image/heic");
            } else if (lower.endsWith(".bmp")) {
                contentType = MediaType.parseMediaType("image/bmp");
            } else if (lower.endsWith(".tiff") || lower.endsWith(".tif")) {
                contentType = MediaType.parseMediaType("image/tiff");
            }
        }
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(resource);
    }

    @PostMapping("/{memberId}/shares")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> addShares(
            @PathVariable UUID memberId,
            @RequestParam BigDecimal amount,
            @RequestParam(required = false) String reference,
            @RequestParam(required = false) java.time.LocalDate datePurchased) {
        memberService.recordSharePurchase(memberId, amount, reference, datePurchased);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{fromId}/transfer/{toId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> transferShares(
            @PathVariable UUID fromId,
            @PathVariable UUID toId,
            @RequestParam BigDecimal amount,
            @RequestParam(required = false) String reference) {
        memberService.transferShares(fromId, toId, amount, reference);
        return ResponseEntity.ok().build();
    }
}
