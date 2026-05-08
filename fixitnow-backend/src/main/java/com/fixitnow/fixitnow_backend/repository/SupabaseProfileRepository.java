package com.fixitnow.fixitnow_backend.repository;

import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.util.StringUtils;
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
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toDateTime;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toLong;
import static com.fixitnow.fixitnow_backend.util.SupabaseRowUtils.toText;

@Repository
public class SupabaseProfileRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.service-key:}")
    private String supabaseServiceKey;

    @Value("${supabase.storage.profile-bucket:profiles}")
    private String profileBucket;

    private final RestTemplate restTemplate = new RestTemplate(new JdkClientHttpRequestFactory(HttpClient.newHttpClient()));

    public Optional<UserProfile> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }

        Optional<UserProfile> canonical = findByIdFromTable("user_profiles", id);
        if (canonical.isPresent()) {
            return canonical;
        }

        return findByIdFromTable("profiles", id);
    }

    public Optional<UserProfile> findByEmail(String email) {
        String normalized = StringUtils.normalizeEmail(email);
        if (normalized.isBlank()) {
            return Optional.empty();
        }

        Optional<UserProfile> canonical = findByEmailFromTable("user_profiles", normalized);
        if (canonical.isPresent()) {
            return canonical;
        }

        return findByEmailFromTable("profiles", normalized);
    }

    public UserProfile upsert(UserProfile profile) {
        if (profile.getId() != null) {
            return updateById(profile.getId(), profile);
        }

        String url = supabaseUrl + "/rest/v1/user_profiles?on_conflict=email";
        Map<String, Object> body = buildProfileBody(profile);

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

        // If response body is empty, fetch the profile we just upserted
        return findByEmail(profile.getEmail()).orElse(profile);
    }

    public UserProfile updateById(Long id, UserProfile profile) {
        if (id == null) {
            throw new IllegalArgumentException("User ID is required for profile update");
        }
        String url = supabaseUrl + "/rest/v1/user_profiles?id=eq." + id;
        Map<String, Object> body = buildProfileBody(profile);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createUpdateHeaders());
        ResponseEntity<List<Map<String, Object>>> response;
        try {
            response = restTemplate.exchange(
                    url,
                    HttpMethod.PATCH,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
        } catch (HttpClientErrorException e) {
            throw mapClientError("user_profiles", e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            throw new IllegalStateException("Profile update failed for user ID: " + id);
        }
        return mapRow(rows.get(0));
    }

    public void uploadProfileImage(String objectPath, byte[] imageBytes, String contentType) {
        if (objectPath == null || objectPath.isBlank()) {
            throw new IllegalArgumentException("Storage object path is required");
        }
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Profile image bytes are required");
        }

        String encodedPath = UriUtils.encodePath(objectPath, StandardCharsets.UTF_8);
        String url = supabaseUrl + "/storage/v1/object/" + profileBucket + "/" + encodedPath;

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
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("Supabase storage upload failed: " + e.getResponseBodyAsString());
        }
    }

    public void deleteProfileImage(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return;
        }

        String encodedPath = UriUtils.encodePath(objectPath, StandardCharsets.UTF_8);
        String url = supabaseUrl + "/storage/v1/object/" + profileBucket + "/" + encodedPath;
        HttpEntity<Void> entity = new HttpEntity<>(createStorageHeaders(null));
        try {
            restTemplate.exchange(
                    url,
                    HttpMethod.DELETE,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().value() != 404) {
                throw new IllegalStateException("Supabase storage delete failed: " + e.getResponseBodyAsString());
            }
        }
    }

    public String buildPublicProfileImageUrl(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return null;
        }
        String encodedPath = UriUtils.encodePath(objectPath, StandardCharsets.UTF_8);
        return supabaseUrl + "/storage/v1/object/public/" + profileBucket + "/" + encodedPath;
    }

    public List<UserProfile> listAll() {
        List<UserProfile> canonical = listAllFromTable("user_profiles");
        List<UserProfile> legacy = listAllFromTable("profiles");

        Map<String, UserProfile> mergedByEmail = new HashMap<>();
        for (UserProfile profile : canonical) {
            String key = StringUtils.normalizeEmail(profile.getEmail());
            if (key != null && !key.isBlank()) {
                mergedByEmail.put(key, profile);
            }
        }

        for (UserProfile profile : legacy) {
            String key = StringUtils.normalizeEmail(profile.getEmail());
            if (key == null || key.isBlank()) {
                continue;
            }
            mergedByEmail.putIfAbsent(key, profile);
        }

        return List.copyOf(mergedByEmail.values());
    }

    public int migrateLegacyProfiles() {
        List<UserProfile> canonical = listAll();
        Set<String> existingEmails = canonical.stream()
                .map(UserProfile::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .map(StringUtils::normalizeEmail)
                .collect(Collectors.toCollection(HashSet::new));

        List<UserProfile> legacyProfiles = listLegacyProfiles();
        int migrated = 0;

        for (UserProfile legacy : legacyProfiles) {
            String email = StringUtils.normalizeEmail(legacy.getEmail());
            if (email.isBlank() || existingEmails.contains(email)) {
                continue;
            }

            UserProfile toUpsert = new UserProfile();
            toUpsert.setEmail(email);
            toUpsert.setUsername(StringUtils.valueOrFallback(legacy.getUsername(), email));
            toUpsert.setFirstName(StringUtils.valueOrFallback(legacy.getFirstName(), ""));
            toUpsert.setLastName(StringUtils.valueOrFallback(legacy.getLastName(), ""));
            toUpsert.setRole(StringUtils.valueOrFallback(legacy.getRole(), "STUDENT").toUpperCase());
            toUpsert.setPhoneNumber(legacy.getPhoneNumber());

            upsert(toUpsert);
            existingEmails.add(email);
            migrated++;
        }

        return migrated;
    }

    private List<UserProfile> listLegacyProfiles() {
        return listAllFromTable("profiles");
    }

    private Optional<UserProfile> findByIdFromTable(String table, Long id) {
        String url = supabaseUrl + "/rest/v1/" + table + "?select=*&id=eq." + id;

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
                return Optional.empty();
            }
            throw mapClientError(table, e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapRow(rows.get(0)));
    }

    private Optional<UserProfile> findByEmailFromTable(String table, String normalizedEmail) {
        String url = supabaseUrl + "/rest/v1/" + table + "?select=*&email=eq."
                + UriUtils.encode(normalizedEmail, StandardCharsets.UTF_8);

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
                return Optional.empty();
            }
            throw mapClientError(table, e);
        }

        List<Map<String, Object>> rows = response.getBody();
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapRow(rows.get(0)));
    }

    private List<UserProfile> listAllFromTable(String table) {
        String url = supabaseUrl + "/rest/v1/" + table + "?select=*";

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
            throw mapClientError(table, e);
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

    private HttpHeaders createUpsertHeaders() {
        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "resolution=merge-duplicates,return=representation");
        return headers;
    }

    private HttpHeaders createUpdateHeaders() {
        HttpHeaders headers = createHeaders();
        headers.set("Prefer", "return=representation");
        return headers;
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

    private UserProfile mapRow(Map<String, Object> row) {
        UserProfile profile = new UserProfile();
        profile.setId(toLong(row.get("id")));
        profile.setEmail(toText(row.get("email")));
        profile.setUsername(toText(row.get("username")));
        profile.setFirstName(toText(row.get("first_name")));
        profile.setLastName(toText(row.get("last_name")));
        profile.setRole(toText(row.get("role")));
        profile.setPhoneNumber(toText(row.get("phone_number")));
        String imagePath = toText(row.get("profile_image_path"));
        String persistedImageUrl = toText(row.get("profile_picture_url"));
        profile.setProfileImageUrl(
                persistedImageUrl == null || persistedImageUrl.isBlank()
                        ? buildPublicProfileImageUrl(imagePath)
                        : persistedImageUrl
        );
        profile.setCreatedAt(toDateTime(row.get("created_at")));
        profile.setUpdatedAt(toDateTime(row.get("updated_at")));
        return profile;
    }

    private Map<String, Object> buildProfileBody(UserProfile profile) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", StringUtils.normalizeEmail(profile.getEmail()));
        body.put("username", profile.getUsername());
        body.put("first_name", profile.getFirstName());
        body.put("last_name", profile.getLastName());
        body.put("role", profile.getRole());
        // FIX: Only include phone_number if it's not null to avoid overwriting with null
        if (profile.getPhoneNumber() != null) {
            body.put("phone_number", profile.getPhoneNumber());
        }
        // FIX: Only include profile_picture_url if it's not null to avoid overwriting with null
        if (profile.getProfileImageUrl() != null) {
            body.put("profile_picture_url", profile.getProfileImageUrl());
        }
        return body;
    }

    private IllegalStateException mapClientError(String tableName, HttpClientErrorException e) {
        String response = e.getResponseBodyAsString();
        if (e.getStatusCode().value() == 404 || response.contains("PGRST205")) {
            return new IllegalStateException("Supabase table '" + tableName + "' is missing. Run SUPABASE_SETUP.sql in Supabase SQL Editor.");
        }
        return new IllegalStateException("Supabase request failed for table '" + tableName + "': " + response);
    }
}