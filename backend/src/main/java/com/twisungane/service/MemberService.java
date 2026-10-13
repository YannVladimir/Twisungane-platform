package com.twisungane.service;

import com.twisungane.dto.MemberDTO;
import com.twisungane.dto.MemberRegistrationRequest;
import com.twisungane.entity.Contribution;
import com.twisungane.entity.Member;
import com.twisungane.entity.ShareRecord;
import com.twisungane.entity.UserRole;
import com.twisungane.entity.Loan;
import com.twisungane.repository.ContributionRepository;
import com.twisungane.repository.MemberRepository;
import com.twisungane.repository.ShareRecordRepository;
import com.twisungane.repository.SystemConfigRepository;
import com.twisungane.repository.UserRoleRepository;
import com.twisungane.repository.LoanRepository;
import com.twisungane.util.HmacUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberService {

        private final MemberRepository memberRepository;
        private final ShareRecordRepository shareRecordRepository;
        private final ContributionRepository contributionRepository;
        private final UserRoleRepository roleRepository;
        private final SystemConfigRepository systemConfigRepository;
        private final PasswordEncoder passwordEncoder;
        private final AuditService auditService;
        private final FileStorageService fileStorageService;
        private final HmacUtil hmacUtil;
        private final LoanRepository loanRepository;

        public List<UserRole> getAllRoles() {
            return roleRepository.findAll();
        }

        public List<MemberDTO> getAllMembers() {
                return memberRepository.findAll().stream()
                                .map(this::convertToDTO)
                                .collect(Collectors.toList());
        }

        @Transactional
        public MemberDTO registerMember(MemberRegistrationRequest request, MultipartFile contract) {
                // Pre-save duplicate checks using HMAC blind indexes
                if (request.getNationalId() != null && !request.getNationalId().isBlank()
                        && memberRepository.existsByNationalIdHash(hmacUtil.hash(request.getNationalId()))) {
                    throw new RuntimeException("A member with this National ID already exists.");
                }
                if (request.getEmail() != null && !request.getEmail().isBlank()
                        && memberRepository.existsByEmailHash(hmacUtil.hash(request.getEmail()))) {
                    throw new RuntimeException("A member with this email address already exists.");
                }

                UserRole memberRole = roleRepository.findByName("ROLE_MEMBER")
                                .orElseThrow(() -> new RuntimeException("Default member role not found"));

                Member guarantor = null;
                if (request.getGuarantorId() != null) {
                        guarantor = memberRepository.findById(request.getGuarantorId())
                                        .orElseThrow(() -> new RuntimeException("Guarantor not found"));
                }

                UserRole assignedRole = memberRole;
                if (request.getRole() != null) {
                    assignedRole = roleRepository.findByName(request.getRole())
                            .orElse(memberRole);
                }

                Member member = Member.builder()
                                .nationalId(request.getNationalId())
                                .nationalIdHash(hmacUtil.hash(request.getNationalId()))
                                .firstName(request.getFirstName())
                                .lastName(request.getLastName())
                                .email(request.getEmail())
                                .emailHash(hmacUtil.hash(request.getEmail()))
                                .phone(request.getPhone())
                                .password(passwordEncoder.encode(request.getPassword()))
                                .role(assignedRole)
                                .guarantor(guarantor)
                                .joinDate(request.getJoinDate())
                                .dateOfBirth(request.getDateOfBirth())
                                .isMinor(request.getDateOfBirth() != null &&
                                        request.getDateOfBirth().plusYears(18).isAfter(LocalDate.now()))
                                .status(Member.MemberStatus.ACTIVE)
                                .type(Member.MemberType.STANDARD)
                                .waitPeriodStart(LocalDate.now())
                                .signedContractPath(fileStorageService.store(contract))
                                .build();

                Member savedMember = memberRepository.save(member);

                // Handle Mandatory Initial Shares
                BigDecimal sharePrice = new BigDecimal(systemConfigRepository.findByConfigKey("SHARE_PRICE")
                        .map(c -> c.getConfigValue())
                        .orElse("100000"));
                Double initialShares = (request.getInitialShares() != null && request.getInitialShares() > 0) 
                        ? request.getInitialShares() : 1.0;
                
                BigDecimal totalInitialAmount = sharePrice.multiply(BigDecimal.valueOf(initialShares));

                ShareRecord initialRecord = ShareRecord.builder()
                        .member(savedMember)
                        .amount(totalInitialAmount)
                        .transactionReference(request.getTransactionReference())
                        .dateBought(java.time.LocalDateTime.now())
                        .build();
                
                shareRecordRepository.save(initialRecord);

                auditService.log(
                    "MEMBER_REGISTERED",
                    "MEMBER",
                    savedMember.getId().toString(),
                    String.format("New member registered: %s %s with %.1f initial shares.", savedMember.getFirstName(), savedMember.getLastName(), initialShares)
                );

                return convertToDTO(savedMember);
        }

        @Transactional
        public MemberDTO updateMember(UUID id, MemberDTO updateRequest, MultipartFile contract) {
                Member member = memberRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                member.setFirstName(updateRequest.getFirstName());
                member.setLastName(updateRequest.getLastName());
                member.setEmail(updateRequest.getEmail());
                member.setEmailHash(hmacUtil.hash(updateRequest.getEmail()));
                member.setPhone(updateRequest.getPhone());
                member.setNationalId(updateRequest.getNationalId());
                member.setNationalIdHash(hmacUtil.hash(updateRequest.getNationalId()));
                member.setJoinDate(updateRequest.getJoinDate());
                member.setDateOfBirth(updateRequest.getDateOfBirth());
                member.setMinor(updateRequest.getDateOfBirth() != null && 
                                updateRequest.getDateOfBirth().plusYears(18).isAfter(LocalDate.now()));

                if (updateRequest.getGuarantorId() != null) {
                        if (updateRequest.getGuarantorId().equals(id)) {
                                throw new IllegalArgumentException("A member cannot be their own guarantor.");
                        }
                        Member guarantor = memberRepository.findById(updateRequest.getGuarantorId())
                                        .orElseThrow(() -> new RuntimeException("Guarantor not found"));
                        member.setGuarantor(guarantor);
                } else {
                        member.setGuarantor(null);
                }

                if (updateRequest.getRole() != null) {
                        UserRole assignedRole = roleRepository.findByName(updateRequest.getRole())
                                        .orElse(member.getRole());
                        member.setRole(assignedRole);
                }

                if (contract != null && !contract.isEmpty()) {
                    // Delete old file if exists
                    if (member.getSignedContractPath() != null) {
                        fileStorageService.delete(member.getSignedContractPath());
                    }
                    String newPath = fileStorageService.store(contract);
                    member.setSignedContractPath(newPath);
                }

                return convertToDTO(memberRepository.save(member));
        }

        public org.springframework.core.io.Resource getContractResource(UUID memberId) {
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new RuntimeException("Member not found"));
            
            if (member.getSignedContractPath() == null) {
                throw new RuntimeException("Member has no contract uploaded");
            }

            return fileStorageService.loadAsResource(member.getSignedContractPath());
        }

        public MemberDTO convertToDTO(Member member) {
                boolean isSocial = member.getType() == Member.MemberType.SOCIAL;

                BigDecimal totalShares;
                Double computedShareCount = null;

                if (isSocial || "ROLE_ADMIN".equals(member.getRole().getName())) {
                        if (isSocial) {
                                // Compute virtual shares from Social Fund balance
                                BigDecimal socialBalance = new BigDecimal(
                                        systemConfigRepository.findByConfigKey("SOCIAL_FUND_BALANCE")
                                                .map(c -> c.getConfigValue())
                                                .orElse("0")
                                );
                                BigDecimal reserve = new BigDecimal("50000");
                                BigDecimal shareUnit = new BigDecimal("100000");

                                if (socialBalance.compareTo(reserve) > 0) {
                                        BigDecimal available = socialBalance.subtract(reserve);
                                        totalShares = available;
                                        
                                        // Interest-eligible share count: floor to nearest 0.5 share (50k block)
                                        BigDecimal fiftyK = new BigDecimal("50000");
                                        long halfShares = available.divide(fiftyK, 0, java.math.RoundingMode.FLOOR).longValue();
                                        computedShareCount = halfShares * 0.5;
                                } else {
                                        computedShareCount = 0.0;
                                        totalShares = BigDecimal.ZERO;
                                }
                        } else {
                                // Admin account - force 0 shares
                                totalShares = BigDecimal.ZERO;
                                computedShareCount = 0.0;
                        }
                } else {
                        totalShares = shareRecordRepository.findByMemberId(member.getId()).stream()
                                        .map(ShareRecord::getAmount)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                }

                BigDecimal totalObligatoryReserve = isSocial ? BigDecimal.ZERO : 
                        contributionRepository.sumByMemberIdAndType(member.getId(), Contribution.ContributionType.OBLIGATORY_RESERVE);

                String guarantorName = member.getGuarantor() != null
                                ? member.getGuarantor().getFirstName() + " " + member.getGuarantor().getLastName()
                                : null;
                UUID guarantorId = member.getGuarantor() != null ? member.getGuarantor().getId() : null;

                return MemberDTO.builder()
                                .id(member.getId())
                                .nationalId(member.getNationalId())
                                .firstName(member.getFirstName())
                                .lastName(member.getLastName())
                                .email(member.getEmail())
                                .phone(member.getPhone())
                                .status(member.getStatus())
                                .type(member.getType())
                                .role(member.getRole().getName())
                                .joinDate(member.getJoinDate())
                                .dateOfBirth(member.getDateOfBirth())
                                .isMinor(member.isMinor())
                                .guarantorId(guarantorId)
                                .guarantorName(guarantorName)
                                .totalShares(totalShares)
                                .totalObligatoryReserve(totalObligatoryReserve)
                                .totalContributions(BigDecimal.ZERO)
                                .isSocialAccount(isSocial)
                                .computedShareCount(computedShareCount)
                                .signedContractPath(member.getSignedContractPath())
                                .build();
        }

        public BigDecimal getObligatoryReserveBalance(UUID memberId, Integer year) {
            return contributionRepository.sumByMemberIdTypeAndYear(memberId, Contribution.ContributionType.OBLIGATORY_RESERVE, year);
        }

        public BigDecimal getObligatoryReserveBalance(UUID memberId) {
            return contributionRepository.sumByMemberIdAndType(memberId, Contribution.ContributionType.OBLIGATORY_RESERVE);
        }

        @Transactional
        public void recordSharePurchase(UUID memberId, BigDecimal amount, String reference, java.time.LocalDate datePurchased) {
                Member member = memberRepository.findById(memberId)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                ShareRecord record = ShareRecord.builder()
                                .member(member)
                                .amount(amount)
                                .transactionReference(reference)
                                .dateBought(datePurchased != null ? datePurchased.atStartOfDay() : null)
                                .build();

                ShareRecord saved = shareRecordRepository.save(record);

                auditService.log(
                    "SHARE_PURCHASE",
                    "SHARE",
                    saved.getId().toString(),
                    String.format("Share purchase recorded for %s %s: %s FRW", member.getFirstName(), member.getLastName(), amount)
                );
        }

        @Transactional
        public void transferShares(UUID fromId, UUID toId, BigDecimal amountFRW, String reference) {
                Member fromMember = memberRepository.findById(fromId)
                                .orElseThrow(() -> new RuntimeException("Sender not found"));
                Member toMember = memberRepository.findById(toId)
                                .orElseThrow(() -> new RuntimeException("Recipient not found"));

                // Check if sender has an active loan (shares are locked)
                if (loanRepository.findByMemberIdAndStatus(fromId, Loan.LoanStatus.ACTIVE).isPresent()) {
                        throw new RuntimeException("Sender has an active loan. Shares are locked until the loan is fully repaid.");
                }

                // Validate balance
                BigDecimal senderBalance = shareRecordRepository.findByMemberId(fromId).stream()
                                .map(ShareRecord::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (senderBalance.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Sender has no shares to transfer.");
                }
                if (senderBalance.compareTo(amountFRW) < 0) {
                        throw new IllegalArgumentException(
                                "Transfer of " + amountFRW + " FRW exceeds sender's available balance of " + senderBalance + " FRW.");
                }

                java.time.LocalDateTime now = java.time.LocalDateTime.now();

                // 1. Negative record for sender
                ShareRecord senderRecord = ShareRecord.builder()
                                .member(fromMember)
                                .amount(amountFRW.negate())
                                .transactionReference("Transfer to " + toMember.getFirstName() + " " + toMember.getLastName() + (reference != null && !reference.isEmpty() ? ": " + reference : ""))
                                .dateBought(now)
                                .build();

                // 2. Positive record for recipient
                ShareRecord recipientRecord = ShareRecord.builder()
                                .member(toMember)
                                .amount(amountFRW)
                                .transactionReference("Transfer from " + fromMember.getFirstName() + " " + fromMember.getLastName() + (reference != null && !reference.isEmpty() ? ": " + reference : ""))
                                .dateBought(now)
                                .build();

                shareRecordRepository.save(senderRecord);
                shareRecordRepository.save(recipientRecord);

                auditService.log(
                    "SHARE_TRANSFER",
                    "SHARE_TRANSFER",
                    senderRecord.getId().toString(),
                    String.format("Transferred %s FRW from %s to %s", amountFRW, fromMember.getFirstName(), toMember.getFirstName())
                );
        }
        @Transactional
        public MemberDTO updatePreferences(UUID id, com.twisungane.dto.PreferenceUpdateRequest updateRequest) {
                Member member = memberRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Member not found"));

                if (updateRequest.getLanguage() != null) {
                        member.setPreferredLanguage(updateRequest.getLanguage());
                }
                if (updateRequest.getTheme() != null) {
                        member.setPreferredTheme(updateRequest.getTheme());
                }

                return convertToDTO(memberRepository.save(member));
        }
}
