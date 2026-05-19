package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.exception.SupabaseRequestException;
import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.ReportStatus;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import com.fixitnow.fixitnow_backend.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toDateTime;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toLong;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toLongOrZero;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toText;

@Repository
public class SupabaseReportRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.service-key:}")
    private String supabaseServiceKey;

    @Value("${supabase.storage.report-bucket:report_image}")
    private String reportBucket;

    private final RestTemplate restTemplate;

    public SupabaseReportRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<ReportItem> listByUserId(Long userId) {
        if (userId == null) {
            return List.of();
        }

        String url = supabaseUrl + "/rest/v1/report_items?select=*&user_id=eq."
                + userId
                + "&order=created_at.desc";

        HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
    }

    public List<ReportItem> listAll() {
        String url = supabaseUrl + "/rest/v1/report_items?select=*&order=created_at.desc";

        HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
    }

    public ReportItem insert(ReportItem item) {
        String url = supabaseUrl + "/rest/v1/report_items";

        Map<String, Object> body = new HashMap<>();
        body.put("user_id", item.getUserId());
        body.put("email", StringUtils.normalizeEmail(item.getEmail()));
        body.put("title", item.getTitle());
        body.put("description", item.getDescription());
        body.put("location", item.getLocation());
        body.put("image_name", item.getImageName());
        body.put("image_path", item.getImagePath());
        body.put("image_url", item.getImageUrl());
        body.put("status", item.getStatus());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createInsertHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return item;
        }

        return mapRow(rows.get(0));
    }

    public boolean deleteByIdAndUserId(Long id, Long userId) {
        if (id == null || userId == null) {
            return false;
        }

        String url = supabaseUrl + "/rest/v1/report_items?id=eq." + id + "&user_id=eq." + userId;

        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "return=representation");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        return rows != null && !rows.isEmpty();
    }

    public ReportItem updateStatus(Long id, String status) {
        String url = supabaseUrl + "/rest/v1/report_items?id=eq." + id;

        Map<String, Object> body = new HashMap<>();
        body.put("status", status);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createPatchHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return null;
        }

        return mapRow(rows.get(0));
    }

    public UserDashboardSummary getUserDashboardSummary(Long userId) {
        if (userId == null) {
            return new UserDashboardSummary();
        }

        String url = supabaseUrl + "/rest/v1/user_dashboard_summary?select=*&user_id=eq." + userId;

        HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );

            List<Map<String, Object>> rows = response.getBody();
            if (rows != null && !rows.isEmpty()) {
                return mapSummaryRow(rows.get(0), userId);
            }
        } catch (HttpStatusCodeException e) {
            String response = e.getResponseBodyAsString();
            if (!(e.getStatusCode().value() == 404 || (response != null && response.contains("PGRST205")))) {
                throw mapClientError("user_dashboard_summary", e);
            }
        }

        return computeSummaryFromReports(userId);
    }

    private HttpHeaders createHeaders() {
        String key = supabaseServiceKey == null || supabaseServiceKey.isBlank() ? supabaseKey : supabaseServiceKey;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        return headers;
    }

    private HttpHeaders createInsertHeaders() {
        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "return=representation");
        return headers;
    }

    private HttpHeaders createPatchHeaders() {
        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "return=representation");
        return headers;
    }

    public void uploadReportImage(String objectPath, byte[] imageBytes, String contentType) {
        if (objectPath == null || objectPath.isBlank()) {
            throw new IllegalArgumentException("Storage object path is required");
        }
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Report image bytes are required");
        }

        String encodedPath = UriUtils.encodePath(objectPath, StandardCharsets.UTF_8);
        String url = supabaseUrl + "/storage/v1/object/" + reportBucket + "/" + encodedPath;

        HttpHeaders headers = createStorageHeaders(contentType);
        headers.set("x-upsert", "true");
        HttpEntity<byte[]> entity = new HttpEntity<>(imageBytes, headers);
        try {
            restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
        } catch (HttpStatusCodeException e) {
            throw new IllegalStateException("Supabase storage upload failed: " + e.getResponseBodyAsString());
        }
    }

    public String buildPublicReportImageUrl(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return null;
        }
        String encodedPath = UriUtils.encodePath(objectPath, StandardCharsets.UTF_8);
        return supabaseUrl + "/storage/v1/object/public/" + reportBucket + "/" + encodedPath;
    }

    private HttpHeaders createStorageHeaders(String contentType) {
        String key = supabaseServiceKey == null || supabaseServiceKey.isBlank() ? supabaseKey : supabaseServiceKey;
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        headers.setContentType(MediaType.parseMediaType(
                contentType == null || contentType.isBlank() ? MediaType.APPLICATION_OCTET_STREAM_VALUE : contentType
        ));
        return headers;
    }

    private ReportItem mapRow(Map<String, Object> row) {
        ReportItem item = new ReportItem();
        item.setId(toLong(row.get("id")));
        item.setUserId(toLong(row.get("user_id")));
        item.setEmail(toText(row.get("email")));
        item.setTitle(toText(row.get("title")));
        item.setDescription(toText(row.get("description")));
        item.setLocation(toText(row.get("location")));
        String imageName = toText(row.get("image_name"));
        String imagePath = toText(row.get("image_path"));
        String imageUrl = toText(row.get("image_url"));
        if ((imageUrl == null || imageUrl.isBlank()) && imagePath != null && !imagePath.isBlank()) {
            imageUrl = buildPublicReportImageUrl(imagePath);
        }
        if ((imageUrl == null || imageUrl.isBlank()) && imageName != null && isHttpUrl(imageName)) {
            imageUrl = imageName.trim();
        }
        item.setImageName(imageName);
        item.setImagePath(imagePath);
        item.setImageUrl(imageUrl);
        item.setStatus(toText(row.get("status")));
        item.setCreatedAt(toDateTime(row.get("created_at")));
        item.setUpdatedAt(toDateTime(row.get("updated_at")));
        return item;
    }

    private UserDashboardSummary mapSummaryRow(Map<String, Object> row, Long userId) {
        UserDashboardSummary summary = new UserDashboardSummary();
        summary.setUserId(userId);
        summary.setEmail(valueOrFallback(toText(row.get("email")), ""));
        summary.setTotalReports(toLongOrZero(row.get("total_reports")));
        summary.setResolvedReports(toLongOrZero(row.get("resolved_reports")));
        summary.setAlertsCount(toLongOrZero(row.get("alerts_count")));
        summary.setLastReportAt(toDateTime(row.get("last_report_at")));
        return summary;
    }

    private UserDashboardSummary computeSummaryFromReports(Long userId) {
        List<ReportItem> reports = listByUserId(userId);

        UserDashboardSummary summary = new UserDashboardSummary();
        summary.setUserId(userId);
        summary.setEmail(reports.stream().map(ReportItem::getEmail).filter(v -> v != null && !v.isBlank()).findFirst().orElse(""));
        summary.setTotalReports(reports.size());
        summary.setResolvedReports(reports.stream()
                .filter(r -> "Fixed".equalsIgnoreCase(valueOrFallback(r.getStatus(), "")))
                .count());
        summary.setAlertsCount(reports.stream()
                .filter(r -> {
                    return ReportStatus.isActive(r.getStatus());
                })
                .count());
        summary.setLastReportAt(reports.stream()
                .map(ReportItem::getCreatedAt)
                .filter(v -> v != null)
                .max(LocalDateTime::compareTo)
                .orElse(null));

        return summary;
    }

    private String valueOrFallback(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private boolean isHttpUrl(String value) {
        String trimmed = value == null ? "" : value.trim().toLowerCase();
        return trimmed.startsWith("http://") || trimmed.startsWith("https://");
    }

    private SupabaseRequestException mapClientError(String tableName, HttpStatusCodeException e) {
        String response = e.getResponseBodyAsString();
        HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
        if (status == HttpStatus.NOT_FOUND || (response != null && response.contains("PGRST205"))) {
            return new SupabaseRequestException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Supabase table '" + tableName + "' is missing. Run SUPABASE_SETUP.sql in Supabase SQL Editor.",
                    e
            );
        }
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String message = response == null || response.isBlank()
                ? "Supabase request failed for table '" + tableName + "'."
                : "Supabase request failed for table '" + tableName + "': " + response;
        return new SupabaseRequestException(status, message, e);
    }
}
