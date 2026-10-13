package com.twisungane.controller;

import com.twisungane.dto.AddContributionRequest;
import com.twisungane.dto.ContributionDTO;
import com.twisungane.dto.MemberInterestSplitDTO;
import com.twisungane.dto.TopupResultDTO;
import com.twisungane.entity.Contribution;
import com.twisungane.entity.Member;
import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.ContributionRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.service.AuditService;
import com.twisungane.exception.ResourceNotFoundException;
import com.twisungane.service.FileStorageService;
import com.twisungane.service.InterestService;
import com.twisungane.service.PdfService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionRepository contributionRepository;
    private final MemberRepository memberRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final InterestService interestService;
    private final AuditService auditService;
    private final FileStorageService fileStorageService;
    private final PdfService pdfService;

    @GetMapping
    public ResponseEntity<List<ContributionDTO>> getAllContributions() {
        return ResponseEntity.ok(contributionRepository.findAll().stream()
                .map(ContributionDTO::fromEntity)
                .collect(Collectors.toList()));
    }

    @PostMapping(consumes = { MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_JSON_VALUE })
    public ResponseEntity<ContributionDTO> addContribution(
            @jakarta.validation.Valid @RequestPart("request") AddContributionRequest req,
            @RequestPart(value = "contract", required = false) MultipartFile contract) {

        Member member = memberRepository.findById(req.getMemberId())
                .orElseThrow(() -> new ResourceNotFoundException("Member not found"));

        java.time.LocalDateTime dateToUse = req.getDatePaid() != null ? req.getDatePaid().atStartOfDay() : java.time.LocalDateTime.now();
        Integer monthToUse = req.getMonth() != null ? req.getMonth() : dateToUse.getMonthValue();
        Integer yearToUse = req.getYear() != null ? req.getYear() : dateToUse.getYear();

        Contribution contribution = Contribution.builder()
                .member(member)
                .amount(req.getAmount())
                .type(req.getType())
                .month(monthToUse)
                .year(yearToUse)
                .datePaid(dateToUse)
                .details(req.getDetails())
                .signedContractPath(fileStorageService.store(contract))
                .build();

        Contribution saved = contributionRepository.save(contribution);

        String typeLabel = req.getType().name().replace("_", " ");
        auditService.log(
            "CONTRIBUTION_RECORDED",
            "CONTRIBUTION",
            saved.getId().toString(),
            String.format("Recorded %s for %s %s: %s FRW", typeLabel, member.getFirstName(), member.getLastName(), req.getAmount())
        );

        if (req.getType() == Contribution.ContributionType.SOCIAL) {
            updateBalance("SOCIAL_FUND_BALANCE", req.getAmount());
        } else if (req.getType() == Contribution.ContributionType.FRAIS_BANCAIRE) {
            updateBalance("BANK_FEES_BALANCE", req.getAmount());
        } else if (req.getType() == Contribution.ContributionType.PENALTY) {
            interestService.distributePenaltyAsInterest(req.getAmount());
        }

        return ResponseEntity.ok(ContributionDTO.fromEntity(saved));
    }

    @PostMapping(value = "/{id}/contract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ContributionDTO> uploadContract(
            @PathVariable UUID id,
            @RequestPart("contract") MultipartFile contract) {

        Contribution contribution = contributionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contribution not found"));

        if (contribution.getSignedContractPath() != null) {
            fileStorageService.delete(contribution.getSignedContractPath());
        }
        contribution.setSignedContractPath(fileStorageService.store(contract));
        return ResponseEntity.ok(ContributionDTO.fromEntity(contributionRepository.save(contribution)));
    }

    @GetMapping("/{id}/contract")
    public ResponseEntity<Resource> getContract(@PathVariable UUID id) {
        Contribution contribution = contributionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contribution not found"));

        if (contribution.getSignedContractPath() == null) {
            throw new RuntimeException("No contract uploaded for this contribution");
        }

        Resource resource = fileStorageService.loadAsResource(contribution.getSignedContractPath());
        String filename = resource.getFilename();
        MediaType contentType = MediaType.APPLICATION_OCTET_STREAM;
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".pdf")) contentType = MediaType.APPLICATION_PDF;
            else if (lower.endsWith(".docx")) contentType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            else if (lower.endsWith(".doc")) contentType = MediaType.parseMediaType("application/msword");
            else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = MediaType.IMAGE_JPEG;
            else if (lower.endsWith(".png")) contentType = MediaType.IMAGE_PNG;
            else if (lower.endsWith(".webp")) contentType = MediaType.parseMediaType("image/webp");
            else if (lower.endsWith(".heic") || lower.endsWith(".heif")) contentType = MediaType.parseMediaType("image/heic");
            else if (lower.endsWith(".bmp")) contentType = MediaType.parseMediaType("image/bmp");
            else if (lower.endsWith(".tiff") || lower.endsWith(".tif")) contentType = MediaType.parseMediaType("image/tiff");
        }
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(resource);
    }

    @GetMapping("/{id}/receipt")
    public ResponseEntity<byte[]> downloadReceipt(@PathVariable UUID id) {
        Contribution contribution = contributionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contribution not found"));

        byte[] pdf = pdfService.generateContributionReceipt(contribution);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=receipt_" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/interest-topup/preview/{memberId}")
    public ResponseEntity<MemberInterestSplitDTO> getTopupPreview(@PathVariable UUID memberId) {
        return ResponseEntity.ok(interestService.getMemberTopupInfo(memberId));
    }

    @PostMapping("/interest-topup")
    public ResponseEntity<TopupResultDTO> recordTopup(@RequestBody java.util.Map<String, Object> body) {
        UUID memberId = UUID.fromString(body.get("memberId").toString());
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        int month = Integer.parseInt(body.get("month").toString());
        int year = Integer.parseInt(body.get("year").toString());
        return ResponseEntity.ok(interestService.recordTopup(memberId, amount, month, year));
    }

    private void updateBalance(String configKey, BigDecimal amount) {
        SystemConfig config = systemConfigRepository.findByConfigKey(configKey)
                .orElseGet(() -> SystemConfig.builder().configKey(configKey).configValue("0").build());

        BigDecimal current = new BigDecimal(config.getConfigValue());
        config.setConfigValue(current.add(amount).toString());
        systemConfigRepository.save(config);
    }
}
