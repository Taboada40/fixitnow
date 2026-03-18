package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.model.UserDashboardSummary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.net.http.HttpClient;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class SupabaseReportRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

        private final RestTemplate restTemplate = new RestTemplate(
            new JdkClientHttpRequestFactory(HttpClient.newHttpClient())
        );

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
        } catch (HttpClientErrorException e) {
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
        } catch (HttpClientErrorException e) {
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
        body.put("email", normalizeEmail(item.getEmail()));
        body.put("title", item.getTitle());
        body.put("description", item.getDescription());
        body.put("location", item.getLocation());
        body.put("image_name", item.getImageName());
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
        } catch (HttpClientErrorException e) {
            throw mapClientError("report_items", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return item;
        }

        return mapRow(rows.get(0));
    }

    public boolean deleteByIdAndUserId(Long id, Long userId) {
        if (userId == null) {
            return false;
        }

        String url = supabaseUrl + "/rest/v1/report_items?id=eq." + id + "&user_id=eq." + userId;

        HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(url, HttpMethod.DELETE, entity, String.class);
        } catch (HttpClientErrorException e) {
            throw mapClientError("report_items", e);
        }
        return response.getStatusCode().is2xxSuccessful();
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
        } catch (HttpClientErrorException e) {
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
        } catch (HttpClientErrorException e) {
            String response = e.getResponseBodyAsString();
            if (!(e.getStatusCode().value() == 404 || response.contains("PGRST205"))) {
                throw mapClientError("user_dashboard_summary", e);
            }
        }

        return computeSummaryFromReports(userId);
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseKey);
        headers.set("Authorization", "Bearer " + supabaseKey);
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

    private ReportItem mapRow(Map<String, Object> row) {
        ReportItem item = new ReportItem();
        item.setId(toLong(row.get("id")));
        item.setUserId(toLong(row.get("user_id")));
        item.setEmail(toText(row.get("email")));
        item.setTitle(toText(row.get("title")));
        item.setDescription(toText(row.get("description")));
        item.setLocation(toText(row.get("location")));
        item.setImageName(toText(row.get("image_name")));
        item.setStatus(toText(row.get("status")));
        item.setCreatedAt(parseDateTime(row.get("created_at")));
        item.setUpdatedAt(parseDateTime(row.get("updated_at")));
        return item;
    }

    private UserDashboardSummary mapSummaryRow(Map<String, Object> row, Long userId) {
        UserDashboardSummary summary = new UserDashboardSummary();
        summary.setEmail(valueOrFallback(toText(row.get("email")), ""));
        summary.setTotalReports(toLongOrZero(row.get("total_reports")));
        summary.setResolvedReports(toLongOrZero(row.get("resolved_reports")));
        summary.setAlertsCount(toLongOrZero(row.get("alerts_count")));
        summary.setLastReportAt(parseDateTime(row.get("last_report_at")));
        return summary;
    }

    private UserDashboardSummary computeSummaryFromReports(Long userId) {
        List<ReportItem> reports = listByUserId(userId);

        UserDashboardSummary summary = new UserDashboardSummary();
        summary.setEmail(reports.stream().map(ReportItem::getEmail).filter(v -> v != null && !v.isBlank()).findFirst().orElse(""));
        summary.setTotalReports(reports.size());
        summary.setResolvedReports(reports.stream()
                .filter(r -> "Fixed".equalsIgnoreCase(valueOrFallback(r.getStatus(), "")))
                .count());
        summary.setAlertsCount(reports.stream()
                .filter(r -> {
                    String status = valueOrFallback(r.getStatus(), "").trim();
                    return "Pending".equalsIgnoreCase(status) || "In-Progress".equalsIgnoreCase(status);
                })
                .count());
        summary.setLastReportAt(reports.stream()
                .map(ReportItem::getCreatedAt)
                .filter(v -> v != null)
                .max(LocalDateTime::compareTo)
                .orElse(null));

        return summary;
    }

    private LocalDateTime parseDateTime(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        try {
            return OffsetDateTime.parse(text).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(text);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    private String toText(Object value) {
        return value == null ? null : value.toString();
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(value.toString());
    }

    private long toLongOrZero(Object value) {
        if (value == null) {
            return 0L;
        }
        try {
            if (value instanceof Number number) {
                return number.longValue();
            }
            return Long.parseLong(value.toString());
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return "";
        }
        String input = value.trim().toLowerCase();
        return input;
    }

    private String valueOrFallback(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private IllegalStateException mapClientError(String tableName, HttpClientErrorException e) {
        String response = e.getResponseBodyAsString();
        if (e.getStatusCode().value() == 404 || response.contains("PGRST205")) {
            return new IllegalStateException("Supabase table '" + tableName + "' is missing. Run SUPABASE_SETUP.sql in Supabase SQL Editor.");
        }
        return new IllegalStateException("Supabase request failed for table '" + tableName + "': " + response);
    }
}
