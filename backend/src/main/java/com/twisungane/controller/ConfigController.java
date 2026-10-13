package com.twisungane.controller;

import com.twisungane.entity.SystemConfig;
import com.twisungane.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/config")
@RequiredArgsConstructor
public class ConfigController {

    private final SystemConfigRepository configRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'PRESIDENT', 'FINANCE')")
    public ResponseEntity<List<SystemConfig>> getAllConfigs() {
        return ResponseEntity.ok(configRepository.findAll());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> updateConfigs(@RequestBody List<Map<String, String>> configUpdates) {
        for (Map<String, String> update : configUpdates) {
            String key = update.get("key");
            String value = update.get("value");
            if (key != null && value != null) {
                SystemConfig config = configRepository.findByConfigKey(key)
                        .orElse(SystemConfig.builder()
                                .configKey(key)
                                .build());
                config.setConfigValue(value);
                configRepository.save(config);
            }
        }
        return ResponseEntity.ok().build();
    }
}
