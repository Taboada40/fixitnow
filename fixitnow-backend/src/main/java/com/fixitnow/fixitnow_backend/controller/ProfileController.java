package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserProfileRequest;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestParam("email") String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }

        return profileService.getByEmail(normalizedEmail)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.ok(profileService.ensureStudentProfile(normalizedEmail)));
    }

    @GetMapping("/authenticated")
    public ResponseEntity<?> getAuthenticatedProfile(@RequestParam("identifier") String identifier) {
        String resolvedEmail = resolveIdentifierToEmail(identifier);
        if (resolvedEmail == null || resolvedEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid identifier is required"));
        }

        UserProfile profile = profileService.getByEmail(resolvedEmail)
                .orElseGet(() -> profileService.ensureStudentProfile(resolvedEmail));

        return ResponseEntity.ok(profile);
    }

    @GetMapping("/by-id")
    public ResponseEntity<?> getProfileById(@RequestParam("userId") Long userId) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }

        return profileService.getById(userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("message", "Profile not found")));
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestBody UserProfileRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Profile payload is required"));
        }

        String normalizedEmail = normalizeEmail(request.getEmail());
        if (request.getId() == null && (normalizedEmail == null || normalizedEmail.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID or email is required"));
        }

        if (normalizedEmail != null && !normalizedEmail.isBlank()) {
            request.setEmail(normalizedEmail);
        } else {
            request.setEmail(null);
        }

        UserProfile persisted = profileService.updateProfile(request);

        return ResponseEntity.ok(persisted);
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return null;
        }
        String input = value.trim().toLowerCase();
        return input;
    }

    private String resolveIdentifierToEmail(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String raw = value.trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = normalizeEmail(raw);

        Optional<UserProfile> byEmail = profileService.getByEmail(normalizedEmail);
        if (byEmail.isPresent()) {
            return normalizedEmail;
        }

        String loginId = raw.contains("@") ? raw.substring(0, raw.indexOf('@')) : raw;
        return profileService.listAllProfiles().stream()
                .filter(profile -> profile.getUsername() != null && profile.getUsername().trim().equalsIgnoreCase(loginId))
                .map(UserProfile::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .map(this::normalizeEmail)
                .findFirst()
                .orElse(normalizedEmail);
    }
}
