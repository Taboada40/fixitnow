package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportRequest;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import com.fixitnow.fixitnow_backend.service.ReportService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
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
        List<ReportItem> reports = reportService.listReports(userId);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getUserSummary(@RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        UserDashboardSummary summary;
        try {
            summary = reportService.getUserDashboardSummary(userId);
        } catch (RuntimeException ex) {
            // Fallback to in-memory aggregation when the DB summary view is unavailable.
            summary = buildSummaryFromReports(reportService.listReports(userId));
        }
        return ResponseEntity.ok(summary);
    }

    @PostMapping
    public ResponseEntity<?> createReport(@RequestBody ReportRequest request) {
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
        ReportItem saved = reportService.createReport(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteReport(@PathVariable("id") Long id, @RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        boolean deleted = reportService.deleteReport(id, userId);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Report not found"));
        }
        return ResponseEntity.ok(Map.of("message", "Deleted"));
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
    summary.setEmail(reports.stream()
        .map(ReportItem::getEmail)
        .filter(value -> value != null && !value.isBlank())
        .findFirst()
        .orElse(""));
        summary.setTotalReports(totalReports);
        summary.setResolvedReports(resolvedReports);
        summary.setAlertsCount(Math.max(totalReports - resolvedReports, 0));
        summary.setLastReportAt(lastReportAt);
        return summary;
    }
}
