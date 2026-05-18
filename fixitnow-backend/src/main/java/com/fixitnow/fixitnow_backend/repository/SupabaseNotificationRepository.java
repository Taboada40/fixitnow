package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.exception.SupabaseRequestException;
import com.fixitnow.fixitnow_backend.model.NotificationItem;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toBoolean;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toDateTime;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toLong;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toText;

@Repository
public class SupabaseNotificationRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.service-key:}")
    private String supabaseServiceKey;

    private final RestTemplate restTemplate;

    public SupabaseNotificationRepository(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

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
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString();
            if (body.get("recipient_user_id") != null && responseBody != null && responseBody.contains("recipient_user_id")) {
                body.remove("recipient_user_id");
                HttpEntity<Map<String, Object>> fallbackEntity = new HttpEntity<>(body, createInsertHeaders());
                try {
                    response = restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            fallbackEntity,
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {}
                    );
                } catch (HttpStatusCodeException fallbackError) {
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

    public List<NotificationItem> listForUser(Long userId) {
        if (userId == null) {
            return List.of();
        }
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
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString();
            if (responseBody != null && responseBody.contains("recipient_user_id")) {
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
        } catch (HttpStatusCodeException e) {
            throw mapClientError("notifications", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
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
        item.setCreatedAt(toDateTime(row.get("created_at")));
        return item;
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
