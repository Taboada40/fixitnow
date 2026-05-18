package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.model.NotificationItem;
import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportStatus;
import com.fixitnow.fixitnow_backend.model.StatusUpdateRequest;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.service.NotificationService;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import com.fixitnow.fixitnow_backend.service.ReportService;
import com.fixitnow.fixitnow_backend.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ReportService reportService;
    private final ProfileService profileService;
    private final NotificationService notificationService;

    @Value("${app.admin.email:}")
    private String configuredAdminEmail;

    public AdminController(ReportService reportService, ProfileService profileService, NotificationService notificationService) {
        this.reportService = reportService;
        this.profileService = profileService;
        this.notificationService = notificationService;
    }

    @GetMapping("/reports")
    public ResponseEntity<?> getAllReports(
            @RequestParam(value = "adminUserId", required = false) Long adminUserId,
            @RequestParam(value = "adminEmail", required = false) String adminEmail
    ) {
        if (!isAdmin(adminUserId, adminEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }

        List<ReportItem> reports = reportService.listAllReports();
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary(
            @RequestParam(value = "adminUserId", required = false) Long adminUserId,
            @RequestParam(value = "adminEmail", required = false) String adminEmail
    ) {
        if (!isAdmin(adminUserId, adminEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }

        List<UserProfile> profiles = profileService.listAllProfiles();
        List<ReportItem> reports = reportService.listAllReports();

        long usersCount = profiles.stream()
                .filter(p -> p.getRole() == null || !p.getRole().equalsIgnoreCase("ADMIN"))
                .count();
        long reportsCount = reports.size();
        long inProgressCount = reports.stream().filter(r -> "In-Progress".equalsIgnoreCase(r.getStatus())).count();
        long fixedCount = reports.stream().filter(r -> "Fixed".equalsIgnoreCase(r.getStatus())).count();

        return ResponseEntity.ok(Map.of(
                "usersCount", usersCount,
                "reportsCount", reportsCount,
                "inProgressCount", inProgressCount,
                "fixedCount", fixedCount
        ));
    }

    @PutMapping("/reports/{id}/status")
    public ResponseEntity<?> updateReportStatus(@PathVariable("id") Long id, @RequestBody StatusUpdateRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status payload is required"));
        }
        if (!isAdmin(request.getAdminUserId(), request.getAdminEmail())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }
        if (request.getStatus() == null || request.getStatus().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status is required"));
        }

        if (!ReportStatus.isAllowed(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status value"));
        }

        try {
            ReportItem updated = reportService.updateReportStatus(id, request.getStatus());
            if (updated == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Report not found"));
            }

            return ResponseEntity.ok(updated);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to update report status: " + ex.getMessage()));
        }
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getAdminNotifications(
            @RequestParam(value = "adminUserId", required = false) Long adminUserId,
            @RequestParam(value = "adminEmail", required = false) String adminEmail
    ) {
        if (!isAdmin(adminUserId, adminEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Admin access required"));
        }

        List<NotificationItem> notifications = notificationService.listAdminNotifications();
        return ResponseEntity.ok(notifications);
    }

    private boolean isAdmin(Long userId, String email) {
        try {
            if (userId != null) {
                return profileService.getById(userId)
                        .map(UserProfile::getRole)
                        .map(role -> role != null && role.equalsIgnoreCase("ADMIN"))
                        .orElse(false);
            }

            String normalizedEmail = StringUtils.normalizeEmail(email);
            if (normalizedEmail.isBlank()) {
                return false;
            }

            if (!StringUtils.normalizeEmail(configuredAdminEmail).isBlank()
                    && normalizedEmail.equals(StringUtils.normalizeEmail(configuredAdminEmail))) {
                profileService.ensureAdminProfile(normalizedEmail, "admin", "Admin", "User");
                return true;
            }

            return profileService.getByEmail(normalizedEmail)
                    .map(UserProfile::getRole)
                    .map(role -> role != null && role.equalsIgnoreCase("ADMIN"))
                    .orElse(false);
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
