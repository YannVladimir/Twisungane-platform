package com.twisungane.repository;

import com.twisungane.entity.MemberExitRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MemberExitRequestRepository extends JpaRepository<MemberExitRequest, UUID> {
    List<MemberExitRequest> findByMemberId(UUID memberId);
    Optional<MemberExitRequest> findTopByMemberIdAndStatusInOrderByCreatedAtDesc(UUID memberId, List<MemberExitRequest.ExitStatus> statuses);
    List<MemberExitRequest> findByStatusOrderByCreatedAtDesc(MemberExitRequest.ExitStatus status);
    List<MemberExitRequest> findByStatusInOrderByCreatedAtDesc(List<MemberExitRequest.ExitStatus> statuses);
    boolean existsByMemberIdAndStatusIn(UUID memberId, List<MemberExitRequest.ExitStatus> statuses);
}
