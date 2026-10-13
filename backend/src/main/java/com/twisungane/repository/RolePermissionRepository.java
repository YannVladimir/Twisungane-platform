package com.twisungane.repository;

import com.twisungane.entity.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    List<RolePermission> findByRoleId(Long roleId);
    boolean existsByRoleNameAndPermissionCode(String roleName, String permissionCode);
}
