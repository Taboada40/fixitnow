package com.fixitnow.fixitnow_backend.controller;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserProfileRequest;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import com.fixitnow.fixitnow_backend.util.StringUtils;
import com.fixitnow.fixitnow_backend.util.ValidationUtils;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@RequestParam("email") String email) {
        String normalizedEmail = StringUtils.normalizeEmail(email);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }

        return profileService.getByEmail(normalizedEmail)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("message", "Profile not found")));
    }

    @GetMapping("/authenticated")
    public ResponseEntity<?> getAuthenticatedProfile(@RequestParam("identifier") String identifier) {
        String resolvedEmail = resolveIdentifierToEmail(identifier);
        if (resolvedEmail == null || resolvedEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid identifier is required"));
        }

        UserProfile profile = profileService.getByEmail(resolvedEmail)
                .orElse(null);

        if (profile == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Profile not found"));
        }
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

        if (request.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }

        String normalizedEmail = StringUtils.normalizeEmail(request.getEmail());
        if (normalizedEmail != null && !normalizedEmail.isBlank()) {
            request.setEmail(normalizedEmail);
        } else {
            request.setEmail(null);
        }

        try {
            UserProfile persisted = profileService.updateProfile(request);
            return ResponseEntity.ok(persisted);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping(value = "/picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfilePicture(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Profile image file is required"));
        }

        if (!isAllowedImage(file)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Only .jpg, .jpeg, and .png images are supported"));
        }

        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }

        try {
            UserProfile profile = profileService.updateProfilePicture(
                    userId,
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getBytes()
            );

            String fileReference = buildFileReference(profile);
            return ResponseEntity.ok(Map.of(
                    "message", "Profile picture uploaded successfully",
                    "fileReference", fileReference,
                    "profile", profile
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed to read uploaded file"));
        }
    }

    private String buildFileReference(UserProfile profile) {
        if (profile == null || profile.getProfileImageUrl() == null || profile.getProfileImageUrl().isBlank()) {
            return "profile-picture:unknown:image";
        }
        // Return the public URL as-is (it's the single source of truth)
        return profile.getProfileImageUrl();
    }

    private String resolveIdentifierToEmail(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String raw = value.trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = StringUtils.normalizeEmail(raw);

        try {
            // First try direct email lookup
            Optional<UserProfile> byEmail = profileService.getByEmail(normalizedEmail);
            if (byEmail.isPresent()) {
                return normalizedEmail;
            }

            // If not found and contains @, try username lookup
            String loginId = raw.contains("@") ? raw.substring(0, raw.indexOf('@')) : raw;
            return profileService.listAllProfiles().stream()
                    .filter(profile -> profile.getUsername() != null && profile.getUsername().trim().equalsIgnoreCase(loginId))
                    .map(UserProfile::getEmail)
                    .filter(email -> email != null && !email.isBlank())
                    .map(StringUtils::normalizeEmail)
                    .findFirst()
                    .orElse(normalizedEmail);
        } catch (RuntimeException ex) {
            return normalizedEmail;
        }
    }

    private boolean isAllowedImage(MultipartFile file) {
        return ValidationUtils.isAllowedImageType(file.getContentType(), file.getOriginalFilename());
    }
}
