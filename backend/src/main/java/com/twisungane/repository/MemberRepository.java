package com.twisungane.repository;

import com.twisungane.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MemberRepository extends JpaRepository<Member, UUID> {
    Optional<Member> findByEmailHash(String emailHash);

    List<Member> findByStatusIn(Collection<Member.MemberStatus> statuses);

    Optional<Member> findByNationalIdHash(String nationalIdHash);

    boolean existsByEmailHash(String emailHash);

    boolean existsByNationalIdHash(String nationalIdHash);

    long countByRoleNameNot(String roleName);

    java.util.List<Member> findByRoleNameNot(String roleName);

    java.util.List<Member> findByGuarantorId(UUID guarantorId);
}
