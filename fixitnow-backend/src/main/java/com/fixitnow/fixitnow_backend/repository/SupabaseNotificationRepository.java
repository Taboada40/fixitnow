package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.model.NotificationItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class SupabaseNotificationRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public NotificationItem insert(NotificationItem notification) {
        String url = supabaseUrl + "/rest/v1/notifications";

        Map<String, Object> body = new HashMap<>();
        body.put("report_id", notification.getReportId());
        body.put("recipient_user_id", notification.getRecipientUserId());
        body.put("recipient_email", notification.getRecipientEmail());
        body.put("recipient_role", notification.getRecipientRole());
        body.put("title", notification.getTitle());
        body.put("message", notification.getMessage());
        body.put("is_read", Boolean.TRUE.equals(notification.getIsRead()));

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
            String responseBody = e.getResponseBodyAsString();
            if (body.get("recipient_user_id") != null && responseBody.contains("recipient_user_id")) {
                body.remove("recipient_user_id");
                HttpEntity<Map<String, Object>> fallbackEntity = new HttpEntity<>(body, createInsertHeaders());
                try {
                    response = restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            fallbackEntity,
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {}
                    );
                } catch (HttpClientErrorException fallbackError) {
                    throw mapClientError("notifications", fallbackError);
                }
            } else {
                throw mapClientError("notifications", e);
            }
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return notification;
        }

        return mapRow(rows.get(0));
    }

    public List<NotificationItem> listForUser(Long userId, String email) {
        if (userId != null) {
            List<NotificationItem> byId = listForUserById(userId);
            if (!byId.isEmpty()) {
                return byId;
            }
        }

        return listForUserByEmail(email);
    }

    private List<NotificationItem> listForUserById(Long userId) {
        String url = supabaseUrl + "/rest/v1/notifications?select=*&recipient_role=eq.USER&recipient_user_id=eq."
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
            String responseBody = e.getResponseBodyAsString();
            if (responseBody.contains("recipient_user_id")) {
                return List.of();
            }
            throw mapClientError("notifications", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
    }

    private List<NotificationItem> listForUserByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.isBlank()) {
            return List.of();
        }

        String url = supabaseUrl + "/rest/v1/notifications?select=*&recipient_role=eq.USER&recipient_email=eq."
                + UriUtils.encode(normalizedEmail, StandardCharsets.UTF_8)
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
            throw mapClientError("notifications", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
    }

    public List<NotificationItem> listForAdmin() {
        String url = supabaseUrl + "/rest/v1/notifications?select=*&recipient_role=eq.ADMIN&order=created_at.desc";

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
            throw mapClientError("notifications", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
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

    private NotificationItem mapRow(Map<String, Object> row) {
        NotificationItem item = new NotificationItem();
        item.setId(toLong(row.get("id")));
        item.setReportId(toLong(row.get("report_id")));
        item.setRecipientUserId(toLong(row.get("recipient_user_id")));
        item.setRecipientEmail(toText(row.get("recipient_email")));
        item.setRecipientRole(toText(row.get("recipient_role")));
        item.setTitle(toText(row.get("title")));
        item.setMessage(toText(row.get("message")));
        item.setIsRead(toBoolean(row.get("is_read")));
        item.setCreatedAt(parseDateTime(row.get("created_at")));
        return item;
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

    private Boolean toBoolean(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean b) {
            return b;
        }
        return Boolean.parseBoolean(value.toString());
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return "";
        }
        String input = value.trim().toLowerCase();
        if (input.isBlank()) {
            return input;
        }
        return input.contains("@") ? input : input + "@project.local";
    }

    private IllegalStateException mapClientError(String tableName, HttpClientErrorException e) {
        String response = e.getResponseBodyAsString();
        if (e.getStatusCode().value() == 404 || response.contains("PGRST205")) {
            return new IllegalStateException("Supabase table '" + tableName + "' is missing. Run SUPABASE_SETUP.sql in Supabase SQL Editor.");
        }
        return new IllegalStateException("Supabase request failed for table '" + tableName + "': " + response);
    }
}
