package com.fixitnow.fixitnow_backend.repository;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestTemplate;

import com.fixitnow.fixitnow_backend.model.UserRequest;

@Repository
public class UserRepository {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    private final RestTemplate restTemplate = new RestTemplate();

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseKey);
        headers.set("Authorization", "Bearer " + supabaseKey);
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
        // Send ONLY email + password — Supabase rejects extra/null fields
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
}