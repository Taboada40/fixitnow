package com.fixitnow.fixitnow_backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;

import com.fixitnow.fixitnow_backend.model.PasswordChangeRequest;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserRequest;
import com.fixitnow.fixitnow_backend.repository.UserRepository;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import com.fixitnow.fixitnow_backend.util.StringUtils;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final ProfileService profileService;

    @Value("${app.admin.email:}")
    private String configuredAdminEmail;

    public AuthController(UserRepository userRepository, ProfileService profileService) {
        this.userRepository = userRepository;
        this.profileService = profileService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UserRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Registration payload is required"));
        }

        try {
            request.setEmail(StringUtils.normalizeEmail(request.getEmail()));
            if (request.getEmail() == null || request.getEmail().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email or login ID is required"));
            }
            if (request.getPassword() == null || request.getPassword().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Password is required"));
            }

            ResponseEntity<Map<String, Object>> signUpResponse = userRepository.signUp(request);

            if (signUpResponse.getStatusCode().is2xxSuccessful()) {
                UserProfile savedProfile;
                try {
                    savedProfile = profileService.upsertFromRegistration(request);
                } catch (Exception profileEx) {
                    savedProfile = buildFallbackProfile(request.getEmail(), request.getUsername(), request.getFirstName(), request.getLastName(), "STUDENT");
                }

                try {
                    userRepository.syncUserMetadataByEmail(savedProfile.getEmail(), buildAuthMetadata(savedProfile));
                } catch (Exception metaEx) {
                    // Non-fatal: profile is saved; metadata sync failure should not block registration
                }

                Map<String, Object> responseBody = new LinkedHashMap<>();
                responseBody.put("message", "Registration successful");
                responseBody.put("data", signUpResponse.getBody());
                responseBody.put("profile", savedProfile);
                return ResponseEntity.status(signUpResponse.getStatusCode()).body(responseBody);
            }
            return signUpResponse;

        } catch (HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Registration Error: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Login payload is required"));
        }

        try {
            request.setEmail(StringUtils.normalizeEmail(request.getEmail()));
            if (request.getEmail() == null || request.getEmail().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email or login ID is required"));
            }
            if (request.getPassword() == null || request.getPassword().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Password is required"));
            }

            ResponseEntity<Map<String, Object>> signInResponse = userRepository.signIn(request);
            Map<String, Object> sessionBody = signInResponse.getBody();
            if (sessionBody == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("message", "Login succeeded but Supabase returned an empty session"));
            }

            String accessToken = valueAsText(sessionBody.get("access_token"));
            if (accessToken == null || accessToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("message", "Login succeeded but no access token was returned"));
            }

            UserProfile profile;
            try {
                profile = profileService.getByEmail(request.getEmail())
                        .orElseGet(() -> profileService.ensureStudentProfile(request.getEmail()));
            } catch (Exception profileEx) {
                profile = buildFallbackProfile(request.getEmail(), null, null, null, "STUDENT");
            }

            if (StringUtils.normalizeEmail(request.getEmail()).equals(StringUtils.normalizeEmail(configuredAdminEmail))) {
                try {
                    profile = profileService.ensureAdminProfile(
                            StringUtils.normalizeEmail(request.getEmail()),
                            "admin",
                            "Admin",
                            "User"
                    );
                } catch (Exception adminProfileEx) {
                    profile = buildFallbackProfile(request.getEmail(), "admin", "Admin", "User", "ADMIN");
                }
            }

            try {
                userRepository.syncUserMetadataByEmail(profile.getEmail(), buildAuthMetadata(profile));
            } catch (Exception metaEx) {
                // Non-blocking: continue login even if metadata sync fails
            }

            return ResponseEntity.ok(buildLoginResponse(sessionBody, profile));

        } catch (HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Server Error: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildLoginResponse(Map<String, Object> sessionBody, UserProfile profile) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Login successful");
        response.put("accessToken", valueAsText(sessionBody.get("access_token")));
        response.put("tokenType", valueAsText(sessionBody.get("token_type")));
        response.put("refreshToken", valueAsText(sessionBody.get("refresh_token")));
        response.put("session", sessionBody);
        response.put("profile", profile);
        return response;
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody PasswordChangeRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Password payload is required"));
        }

        String identifier = StringUtils.normalizeEmail(request.getEmail());
        if (identifier == null || identifier.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email or login ID is required"));
        }

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Current password is required"));
        }

        String newPassword = request.getNewPassword() == null ? "" : request.getNewPassword().trim();
        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be at least 6 characters"));
        }

        if (request.getCurrentPassword().equals(newPassword)) {
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be different from current password"));
        }

        try {
            UserRequest verify = new UserRequest();
            verify.setEmail(identifier);
            verify.setPassword(request.getCurrentPassword());

            ResponseEntity<Map<String, Object>> signInResponse = userRepository.signIn(verify);
            Map<String, Object> sessionBody = signInResponse.getBody();
            String accessToken = sessionBody == null ? null : valueAsText(sessionBody.get("access_token"));

            if (accessToken == null || accessToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("message", "Unable to obtain access token for password update"));
            }

            userRepository.updatePassword(accessToken, newPassword);

            return ResponseEntity.ok(Map.of(
                    "message", "Password updated successfully",
                    "email", identifier
            ));
        } catch (HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Password update failed: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildAuthMetadata(UserProfile profile) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("first_name", StringUtils.valueOrFallback(profile.getFirstName(), ""));
        metadata.put("last_name", StringUtils.valueOrFallback(profile.getLastName(), ""));
        metadata.put("username", StringUtils.valueOrFallback(profile.getUsername(), ""));
        metadata.put("phone_number", StringUtils.valueOrFallback(profile.getPhoneNumber(), ""));
        metadata.put("role", StringUtils.valueOrFallback(profile.getRole(), "STUDENT"));
        // FIX: Include profile image URL in auth metadata
        metadata.put("profile_image_url", StringUtils.valueOrFallback(profile.getProfileImageUrl(), ""));
        return metadata;
    }

    private UserProfile buildFallbackProfile(String email, String username, String firstName, String lastName, String role) {
        UserProfile profile = new UserProfile();
        String normalizedEmail = StringUtils.normalizeEmail(email);
        String fallbackUsername = username;

        if (fallbackUsername == null || fallbackUsername.isBlank()) {
            if (normalizedEmail != null && normalizedEmail.contains("@")) {
                fallbackUsername = normalizedEmail.substring(0, normalizedEmail.indexOf('@'));
            } else {
                fallbackUsername = normalizedEmail;
            }
        }

        profile.setEmail(normalizedEmail);
        profile.setUsername(StringUtils.valueOrFallback(fallbackUsername, normalizedEmail));
        profile.setFirstName(StringUtils.valueOrFallback(firstName, ""));
        profile.setLastName(StringUtils.valueOrFallback(lastName, ""));
        profile.setRole(StringUtils.valueOrFallback(role, "STUDENT").toUpperCase());
        return profile;
    }

    private String valueAsText(Object value) {
        return value == null ? null : value.toString();
    }
}