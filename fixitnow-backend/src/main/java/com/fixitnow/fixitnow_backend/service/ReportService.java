package com.fixitnow.fixitnow_backend.service;

import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportRequest;
import com.fixitnow.fixitnow_backend.model.ReportStatus;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import com.fixitnow.fixitnow_backend.repository.SupabaseReportRepository;
import com.fixitnow.fixitnow_backend.util.StringUtils;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
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
        return createReportInternal(request, null, null, null);
    }

    public ReportItem createReportWithImage(ReportRequest request, String fileName, String contentType, byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            return createReportInternal(request, null, null, null);
        }
        return createReportInternal(request, fileName, contentType, imageBytes);
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

    private String normalizeImagePath(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeImageUrl(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeStatus(String value) {
        return ReportStatus.from(value).label();
    }

    private ReportItem createReportInternal(ReportRequest request, String fileName, String contentType, byte[] imageBytes) {
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("User ID is required");
        }

        UserProfile user = profileService.getById(request.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User profile not found for the provided ID"));

        ReportItem item = new ReportItem();
        item.setUserId(user.getId());
        item.setEmail(StringUtils.normalizeEmail(user.getEmail()));
        String normalizedDescription = normalizeDescription(request.getDescription());
        String normalizedLocation = normalizeLocation(request.getLocation());
        item.setTitle(normalizeTitle(request.getTitle(), normalizedDescription, normalizedLocation));
        item.setDescription(normalizedDescription);
        item.setLocation(normalizedLocation);
        item.setStatus(normalizeStatus(request.getStatus()));

        String imageName = normalizeImageName(request.getImageName());
        String imagePath = normalizeImagePath(request.getImagePath());
        String imageUrl = normalizeImageUrl(request.getImageUrl());
        if (imageUrl == null && imagePath != null) {
            imageUrl = reportRepository.buildPublicReportImageUrl(imagePath);
        }
        if (imageUrl == null && imageName != null && isHttpUrl(imageName)) {
            imageUrl = imageName.trim();
        }
        item.setImageName(imageName);
        item.setImagePath(imagePath);
        item.setImageUrl(imageUrl);

        if (imageBytes != null && imageBytes.length > 0) {
            String extension = resolveImageExtension(fileName, contentType);
            String identity = resolveStorageIdentity(user);
            String objectPath = "reports/" + identity + "/issue-" + System.currentTimeMillis() + extension;
            reportRepository.uploadReportImage(objectPath, imageBytes, contentType);
            item.setImageName(normalizeImageName(fileName));
            item.setImagePath(objectPath);
            item.setImageUrl(reportRepository.buildPublicReportImageUrl(objectPath));
        }

        ReportItem saved = reportRepository.insert(item);
        try {
            notificationService.notifyAdminNewReport(saved);
        } catch (Exception ex) {
            // Notifications are a side effect and should not fail report creation.
            LOGGER.log(Level.WARNING, "Failed to create admin notification for report {0}", saved.getId());
        }
        return saved;
    }

    private String resolveStorageIdentity(UserProfile profile) {
        if (profile.getId() != null) {
            return "id-" + profile.getId();
        }
        String normalizedEmail = StringUtils.normalizeEmail(profile.getEmail());
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("Unable to resolve storage identity for report image");
        }
        return normalizedEmail.replaceAll("[^a-z0-9@._-]", "_");
    }

    private String resolveImageExtension(String fileName, String contentType) {
        String lowerFile = fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
        if (lowerFile.endsWith(".png")) {
            return ".png";
        }
        if (lowerFile.endsWith(".jpg") || lowerFile.endsWith(".jpeg")) {
            return ".jpg";
        }

        String lowerType = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if ("image/png".equals(lowerType)) {
            return ".png";
        }
        return ".jpg";
    }

    private boolean isHttpUrl(String value) {
        String trimmed = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return trimmed.startsWith("http://") || trimmed.startsWith("https://");
    }
}
