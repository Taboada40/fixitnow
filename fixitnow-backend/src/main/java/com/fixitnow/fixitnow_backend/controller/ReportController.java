package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.exception.SupabaseRequestException;
import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportRequest;
import com.fixitnow.fixitnow_backend.model.ReportStatus;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import com.fixitnow.fixitnow_backend.service.ReportService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public ResponseEntity<?> getReports(@RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        try {
            List<ReportItem> reports = reportService.listReports(userId);
            return ResponseEntity.ok(reports);
        } catch (SupabaseRequestException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(Map.of("message", "Failed to load reports: " + ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to load reports: " + ex.getMessage()));
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getUserSummary(@RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        try {
            UserDashboardSummary summary = reportService.getUserDashboardSummary(userId);
            return ResponseEntity.ok(summary);
        } catch (SupabaseRequestException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(Map.of("message", "Failed to load report summary: " + ex.getMessage()));
        } catch (RuntimeException ex) {
            try {
                // Fallback to in-memory aggregation when the DB summary view is unavailable.
                UserDashboardSummary summary = buildSummaryFromReports(reportService.listReports(userId));
                return ResponseEntity.ok(summary);
            } catch (SupabaseRequestException innerEx) {
                return ResponseEntity.status(innerEx.getStatus())
                        .body(Map.of("message", "Failed to load report summary: " + innerEx.getMessage()));
            } catch (RuntimeException innerEx) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Failed to load report summary: " + innerEx.getMessage()));
            }
        }
    }

    @PostMapping
    public ResponseEntity<?> createReport(@RequestBody ReportRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Report payload is required"));
        }
        if (request.getUserId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        boolean missingTitle = request.getTitle() == null || request.getTitle().isBlank();
        boolean missingDescription = request.getDescription() == null || request.getDescription().isBlank();
        if (missingTitle && missingDescription) {
            return ResponseEntity.badRequest().body(Map.of("message", "Description is required"));
        }
        if (request.getLocation() == null || request.getLocation().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Location is required"));
        }
        try {
            ReportItem saved = reportService.createReport(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException ex) {
            String message = ex.getMessage() == null ? "Invalid report payload" : ex.getMessage();
            int status = message.toLowerCase().contains("not found") ? HttpStatus.NOT_FOUND.value() : HttpStatus.BAD_REQUEST.value();
            return ResponseEntity.status(status).body(Map.of("message", message));
        } catch (SupabaseRequestException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(Map.of("message", "Failed to create report: " + ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to create report: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteReport(@PathVariable("id") Long id, @RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        try {
            boolean deleted = reportService.deleteReport(id, userId);
            if (!deleted) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Report not found"));
            }
            return ResponseEntity.ok(Map.of("message", "Deleted"));
        } catch (SupabaseRequestException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(Map.of("message", "Failed to delete report: " + ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to delete report: " + ex.getMessage()));
        }
    }

    private UserDashboardSummary buildSummaryFromReports(List<ReportItem> reports) {
        long totalReports = reports.size();
        long resolvedReports = reports.stream()
                .filter(report -> "fixed".equalsIgnoreCase(String.valueOf(report.getStatus())))
                .count();
        LocalDateTime lastReportAt = reports.stream()
                .map(ReportItem::getCreatedAt)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        UserDashboardSummary summary = new UserDashboardSummary();
        summary.setUserId(reports.stream()
                .map(ReportItem::getUserId)
                .filter(value -> value != null)
                .findFirst()
                .orElse(null));
        summary.setEmail(reports.stream()
                .map(ReportItem::getEmail)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(""));
        summary.setTotalReports(totalReports);
        summary.setResolvedReports(resolvedReports);
        summary.setAlertsCount(reports.stream()
                .filter(report -> {
                    return ReportStatus.isActive(report.getStatus());
                })
                .count());
        summary.setLastReportAt(lastReportAt);
        return summary;
    }
}
