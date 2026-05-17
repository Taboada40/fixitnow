package com.fixitnow.fixitnow_backend.repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.net.http.HttpClient;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;

import com.fixitnow.fixitnow_backend.model.UserRequest;
import com.fixitnow.fixitnow_backend.util.StringUtils;

@Repository
public class UserRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.service-key:}")
    private String supabaseServiceKey;

    private final RestTemplate restTemplate = new RestTemplate(new JdkClientHttpRequestFactory(HttpClient.newHttpClient()));

    /**
     * Headers for PUBLIC auth endpoints (signup, login).
     * Only sends apikey header. Do NOT send publishable key in Authorization
     * because sb_publishable_... is not a JWT.
     */
    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseKey);
        return headers;
    }

    private HttpHeaders createUserAuthHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseKey);
        headers.set("Authorization", "Bearer " + accessToken);
        return headers;
    }

    private HttpHeaders createServiceHeaders() {
        String key = supabaseServiceKey == null || supabaseServiceKey.isBlank() ? supabaseKey : supabaseServiceKey;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", key);
        headers.set("Authorization", "Bearer " + key);
        return headers;
    }

    public ResponseEntity<Map<String, Object>> signUp(UserRequest userRequest) {
        String url = supabaseUrl + "/auth/v1/signup";
        Map<String, Object> data = new HashMap<>();
        data.put("username", userRequest.getUsername() != null ? userRequest.getUsername() : "");
        data.put("first_name", userRequest.getFirstName() != null ? userRequest.getFirstName() : "");
        data.put("last_name", userRequest.getLastName() != null ? userRequest.getLastName() : "");
        data.put("phone_number", userRequest.getPhoneNumber() != null ? userRequest.getPhoneNumber() : "");
        data.put("role", "STUDENT");
        Map<String, Object> body = Map.of(
                "email", userRequest.getEmail(),
                "password", userRequest.getPassword(),
                "data", data
        );
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createHeaders());
        return restTemplate.exchange(
            url,
            HttpMethod.POST,
            entity,
            new ParameterizedTypeReference<Map<String, Object>>() {
            }
        );
    }

    public ResponseEntity<Map<String, Object>> signIn(UserRequest userRequest) {
        String url = supabaseUrl + "/auth/v1/token?grant_type=password";
        Map<String, String> body = Map.of(
                "email", userRequest.getEmail(),
                "password", userRequest.getPassword()
        );
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, createHeaders());
        return restTemplate.exchange(
            url,
            HttpMethod.POST,
            entity,
            new ParameterizedTypeReference<Map<String, Object>>() {
            }
        );
    }

    public ResponseEntity<Map<String, Object>> updatePassword(String accessToken, String newPassword) {
        String url = supabaseUrl + "/auth/v1/user";
        Map<String, String> body = Map.of("password", newPassword);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, createUserAuthHeaders(accessToken));
        return restTemplate.exchange(
                url,
                HttpMethod.PUT,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {
                }
        );
    }

    public Map<String, Object> getAuthenticatedUser(String accessToken) {
        String url = supabaseUrl + "/auth/v1/user";
        HttpEntity<Void> entity = new HttpEntity<>(createUserAuthHeaders(accessToken));
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {
                }
        );
        return response.getBody() == null ? Map.of() : response.getBody();
    }

    public void syncUserMetadataByEmail(String email, Map<String, Object> userMetadata) {
        String normalizedEmail = StringUtils.normalizeEmail(email);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("Email is required to sync user metadata");
        }

        String userId = findAuthUserIdByEmail(normalizedEmail);
        if (userId == null || userId.isBlank()) {
            throw new IllegalStateException("Unable to resolve auth user for email: " + normalizedEmail);
        }

        String url = supabaseUrl + "/auth/v1/admin/users/" + userId;
        Map<String, Object> body = Map.of(
                "user_metadata",
                userMetadata == null ? Map.of() : userMetadata
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, createServiceHeaders());
        restTemplate.exchange(
                url,
                HttpMethod.PUT,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {
                }
        );
    }

    private String findAuthUserIdByEmail(String normalizedEmail) {
        String url = supabaseUrl + "/auth/v1/admin/users?page=1&per_page=1000";
        HttpEntity<Void> entity = new HttpEntity<>(createServiceHeaders());
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Map<String, Object>>() {
                }
        );

        List<Map<String, Object>> users = extractUsers(response.getBody());
        return users.stream()
                .filter(Objects::nonNull)
                .filter(user -> normalizedEmail.equals(StringUtils.normalizeEmail(asString(user.get("email")))))
                .map(user -> asString(user.get("id")))
                .filter(id -> id != null && !id.isBlank())
                .findFirst()
                .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractUsers(Map<String, Object> body) {
        if (body == null) {
            return List.of();
        }
        Object users = body.get("users");
        if (!(users instanceof List<?> list)) {
            return List.of();
        }
        return (List<Map<String, Object>>) (List<?>) list;
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }
}