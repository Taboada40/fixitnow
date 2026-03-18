package com.fixitnow.fixitnow_backend.service;

import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportRequest;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import com.fixitnow.fixitnow_backend.repository.SupabaseReportRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

@Service
public class ReportService {

    private static final Logger LOGGER = Logger.getLogger(ReportService.class.getName());

    private final SupabaseReportRepository reportRepository;
    private final NotificationService notificationService;
    private final ProfileService profileService;

    public ReportService(SupabaseReportRepository reportRepository,
                         NotificationService notificationService,
                         ProfileService profileService) {
        this.reportRepository = reportRepository;
        this.notificationService = notificationService;
        this.profileService = profileService;
    }

    public List<ReportItem> listReports(Long userId) {
        return reportRepository.listByUserId(userId);
    }

    public ReportItem createReport(ReportRequest request) {
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("User ID is required");
        }

        UserProfile user = profileService.getById(request.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User profile not found for the provided ID"));

        ReportItem item = new ReportItem();
        item.setUserId(user.getId());
        item.setEmail(normalizeEmail(user.getEmail()));
        String normalizedDescription = normalizeDescription(request.getDescription());
        String normalizedLocation = normalizeLocation(request.getLocation());
        item.setTitle(normalizeTitle(request.getTitle(), normalizedDescription, normalizedLocation));
        item.setDescription(normalizedDescription);
        item.setLocation(normalizedLocation);
        item.setImageName(normalizeImageName(request.getImageName()));
        item.setStatus(normalizeStatus(request.getStatus()));
        ReportItem saved = reportRepository.insert(item);
        try {
            notificationService.notifyAdminNewReport(saved);
        } catch (Exception ex) {
            // Notifications are a side effect and should not fail report creation.
            LOGGER.log(Level.WARNING, "Failed to create admin notification for report {0}", saved.getId());
        }
        return saved;
    }

    public List<ReportItem> listAllReports() {
        return reportRepository.listAll();
    }

    public UserDashboardSummary getUserDashboardSummary(Long userId) {
        return reportRepository.getUserDashboardSummary(userId);
    }

    public ReportItem updateReportStatus(Long reportId, String status) {
        String normalizedStatus = normalizeStatus(status);
        ReportItem updated = reportRepository.updateStatus(reportId, normalizedStatus);
        if (updated != null) {
            try {
                notificationService.notifyUserStatusUpdate(updated);
            } catch (Exception ex) {
                // Notifications are a side effect and should not fail status updates.
                LOGGER.log(Level.WARNING, "Failed to create user notification for report {0}", updated.getId());
            }
        }
        return updated;
    }

    public boolean deleteReport(Long id, Long userId) {
        return reportRepository.deleteByIdAndUserId(id, userId);
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return null;
        }
        String input = value.trim().toLowerCase();
        return input;
    }

    private String normalizeTitle(String value, String description, String location) {
        if (value != null && !value.isBlank()) {
            return value.trim();
        }
        if (description != null && !description.isBlank()) {
            String compact = description.replaceAll("\\s+", " ").trim();
            return compact.length() > 60 ? compact.substring(0, 60) + "..." : compact;
        }
        if (location != null && !location.isBlank()) {
            return "Issue at " + location;
        }
        return "Untitled report";
    }

    private String normalizeDescription(String value) {
        if (value == null || value.isBlank()) {
            return "No description provided.";
        }
        return value.trim();
    }

    private String normalizeLocation(String value) {
        if (value == null || value.isBlank()) {
            return "Unspecified location";
        }
        return value.trim();
    }

    private String normalizeImageName(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeStatus(String value) {
        if (value == null || value.isBlank()) {
            return "Pending";
        }
        String normalized = value.trim();
        if ("In-Progress".equalsIgnoreCase(normalized)) {
            return "In-Progress";
        }
        if ("Fixed".equalsIgnoreCase(normalized)) {
            return "Fixed";
        }
        if ("Cancelled".equalsIgnoreCase(normalized)) {
            return "Cancelled";
        }
        return "Pending";
    }
}
