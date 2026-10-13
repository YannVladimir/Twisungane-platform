package com.twisungane.repository;

import com.twisungane.entity.TransactionAmendment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionAmendmentRepository extends JpaRepository<TransactionAmendment, UUID> {

    List<TransactionAmendment> findByStatus(TransactionAmendment.AmendmentStatus status);

    List<TransactionAmendment> findByRequestedById(UUID memberId);

    List<TransactionAmendment> findByStatusOrderByCreatedAtDesc(TransactionAmendment.AmendmentStatus status);

    List<TransactionAmendment> findAllByOrderByCreatedAtDesc();

    Optional<TransactionAmendment> findByOriginalTransactionIdAndStatusIn(
        UUID originalTransactionId,
        List<TransactionAmendment.AmendmentStatus> statuses
    );
}
