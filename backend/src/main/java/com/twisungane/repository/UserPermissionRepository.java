package com.twisungane.repository;

import com.twisungane.entity.UserPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserPermissionRepository extends JpaRepository<UserPermission, UUID> {
    List<UserPermission> findByUserId(UUID userId);
    Optional<UserPermission> findByUserIdAndPermissionCode(UUID userId, String permissionCode);
}
