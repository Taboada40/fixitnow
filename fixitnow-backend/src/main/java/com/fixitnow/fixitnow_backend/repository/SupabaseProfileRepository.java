package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.model.UserProfile;
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
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
public class SupabaseProfileRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public Optional<UserProfile> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }

        String url = supabaseUrl + "/rest/v1/user_profiles?select=*&id=eq." + id;

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
            throw mapClientError("user_profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapRow(rows.get(0)));
    }

    public Optional<UserProfile> findByEmail(String email) {
        String normalized = normalizeEmail(email);
        String url = supabaseUrl + "/rest/v1/user_profiles?select=*&email=eq."
                + UriUtils.encode(normalized, StandardCharsets.UTF_8);

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
            throw mapClientError("user_profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapRow(rows.get(0)));
    }

    public UserProfile upsert(UserProfile profile) {
        String url = supabaseUrl + "/rest/v1/user_profiles?on_conflict=email";

        Map<String, Object> body = new HashMap<>();
        body.put("email", normalizeEmail(profile.getEmail()));
        body.put("username", profile.getUsername());
        body.put("first_name", profile.getFirstName());
        body.put("last_name", profile.getLastName());
        body.put("role", profile.getRole());
        body.put("phone_number", profile.getPhoneNumber());
        body.put("profile_image", toByteaLiteral(profile.getProfileImage()));
        body.put("profile_image_name", profile.getProfileImageName());
        body.put("profile_image_content_type", profile.getProfileImageContentType());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createUpsertHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpClientErrorException e) {
            throw mapClientError("user_profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows != null && !rows.isEmpty()) {
            return mapRow(rows.get(0));
        }

        return findByEmail(profile.getEmail()).orElse(profile);
    }

    public List<UserProfile> listAll() {
        String url = supabaseUrl + "/rest/v1/user_profiles?select=*";

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
            throw mapClientError("user_profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapRow).collect(Collectors.toList());
    }

    public int migrateLegacyProfiles() {
        List<UserProfile> canonical = listAll();
        Set<String> existingEmails = canonical.stream()
                .map(UserProfile::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .map(this::normalizeEmail)
                .collect(Collectors.toCollection(HashSet::new));

        List<UserProfile> legacyProfiles = listLegacyProfiles();
        int migrated = 0;

        for (UserProfile legacy : legacyProfiles) {
            String email = normalizeEmail(legacy.getEmail());
            if (email.isBlank() || existingEmails.contains(email)) {
                continue;
            }

            UserProfile toUpsert = new UserProfile();
            toUpsert.setEmail(email);
            toUpsert.setUsername(valueOrFallback(legacy.getUsername(), email));
            toUpsert.setFirstName(valueOrFallback(legacy.getFirstName(), "First"));
            toUpsert.setLastName(valueOrFallback(legacy.getLastName(), "Last"));
            toUpsert.setRole(valueOrFallback(legacy.getRole(), "STUDENT").toUpperCase());
            toUpsert.setPhoneNumber(legacy.getPhoneNumber());

            upsert(toUpsert);
            existingEmails.add(email);
            migrated++;
        }

        return migrated;
    }

    private List<UserProfile> listLegacyProfiles() {
        String url = supabaseUrl + "/rest/v1/profiles?select=*";

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
            if (e.getStatusCode().value() == 404 || responseBody.contains("PGRST205")) {
                return List.of();
            }
            throw mapClientError("profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null) {
            return List.of();
        }

        return rows.stream().map(this::mapLegacyRow).collect(Collectors.toList());
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseKey);
        headers.set("Authorization", "Bearer " + supabaseKey);
        return headers;
    }

    private HttpHeaders createUpsertHeaders() {
        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "resolution=merge-duplicates,return=representation");
        return headers;
    }

    private UserProfile mapRow(Map<String, Object> row) {
        UserProfile profile = new UserProfile();
        profile.setId(toLong(row.get("id")));
        profile.setEmail(toText(row.get("email")));
        profile.setUsername(toText(row.get("username")));
        profile.setFirstName(toText(row.get("first_name")));
        profile.setLastName(toText(row.get("last_name")));
        profile.setRole(toText(row.get("role")));
        profile.setPhoneNumber(toText(row.get("phone_number")));
        profile.setProfileImage(toBytes(row.get("profile_image")));
        profile.setProfileImageName(toText(row.get("profile_image_name")));
        profile.setProfileImageContentType(toText(row.get("profile_image_content_type")));
        profile.setCreatedAt(parseDateTime(row.get("created_at")));
        profile.setUpdatedAt(parseDateTime(row.get("updated_at")));
        return profile;
    }

    private UserProfile mapLegacyRow(Map<String, Object> row) {
        UserProfile profile = new UserProfile();
        profile.setEmail(toText(row.get("email")));
        profile.setUsername(toText(row.get("username")));
        profile.setFirstName(toText(row.get("first_name")));
        profile.setLastName(toText(row.get("last_name")));
        profile.setRole(toText(row.get("role")));
        profile.setPhoneNumber(toText(row.get("phone_number")));
        profile.setCreatedAt(parseDateTime(row.get("created_at")));
        profile.setUpdatedAt(parseDateTime(row.get("updated_at")));
        return profile;
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
        if (value instanceof String text) {
            return Long.valueOf(text);
        }
        return Long.valueOf(String.valueOf(value));
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase();
    }

    private String valueOrFallback(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private String toByteaLiteral(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return null;
        }

        StringBuilder builder = new StringBuilder("\\x");
        for (byte b : bytes) {
            builder.append(String.format("%02x", b));
        }
        return builder.toString();
    }

    private byte[] toBytes(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof byte[] bytes) {
            return bytes;
        }

        String text = value.toString();
        if (text.isBlank()) {
            return null;
        }

        String normalized = text.startsWith("\\x") ? text.substring(2)
                : text.startsWith("0x") ? text.substring(2)
                : null;

        if (normalized != null && normalized.length() % 2 == 0 && normalized.matches("[0-9a-fA-F]+")) {
            byte[] bytes = new byte[normalized.length() / 2];
            for (int i = 0; i < normalized.length(); i += 2) {
                bytes[i / 2] = (byte) Integer.parseInt(normalized.substring(i, i + 2), 16);
            }
            return bytes;
        }

        try {
            return Base64.getDecoder().decode(text);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private IllegalStateException mapClientError(String tableName, HttpClientErrorException e) {
        String response = e.getResponseBodyAsString();
        if (e.getStatusCode().value() == 404 || response.contains("PGRST205")) {
            return new IllegalStateException("Supabase table '" + tableName + "' is missing. Run SUPABASE_SETUP.sql in Supabase SQL Editor.");
        }
        return new IllegalStateException("Supabase request failed for table '" + tableName + "': " + response);
    }
}
