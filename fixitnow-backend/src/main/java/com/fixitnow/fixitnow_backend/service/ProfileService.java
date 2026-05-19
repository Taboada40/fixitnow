package com.fixitnow.fixitnow_backend.service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserProfileRequest;
import com.fixitnow.fixitnow_backend.model.UserRequest;
import com.fixitnow.fixitnow_backend.repository.SupabaseProfileRepository;
import com.fixitnow.fixitnow_backend.repository.UserRepository;
import com.fixitnow.fixitnow_backend.util.StringUtils;
import com.fixitnow.fixitnow_backend.util.ValidationUtils;

@Service
public class ProfileService {

    private final SupabaseProfileRepository profileRepository;
    private final UserRepository userRepository;

    public ProfileService(SupabaseProfileRepository profileRepository, UserRepository userRepository) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
    }

    public UserProfile upsertFromRegistration(UserRequest request) {
        // Validate input
        if (!ValidationUtils.isNotBlank(request.getEmail())) {
            throw new IllegalArgumentException("Email is required for registration");
        }

        // Always create a fresh profile for registration (do not merge with existing)
        UserProfile profile = new UserProfile();
        String normalizedEmail = StringUtils.normalizeEmail(request.getEmail());
        String fallbackUsername = normalizedEmail != null && normalizedEmail.contains("@")
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : normalizedEmail;

        profile.setEmail(normalizedEmail);
        profile.setUsername(StringUtils.valueOrFallback(request.getUsername(), fallbackUsername));
        profile.setFirstName(StringUtils.valueOrFallback(request.getFirstName(), ""));
        profile.setLastName(StringUtils.valueOrFallback(request.getLastName(), ""));
        profile.setRole("STUDENT");
        profile.setPhoneNumber(request.getPhoneNumber());

        return profileRepository.upsert(profile);
    }

    public Optional<UserProfile> getByEmail(String email) {
        return profileRepository.findByEmail(email);
    }

    public Optional<UserProfile> getById(Long id) {
        return profileRepository.findById(id);
    }

    public List<UserProfile> listAllProfiles() {
        return profileRepository.listAll();
    }

    public UserProfile updateProfile(UserProfileRequest request) {
        // Validate input
        if (request.getId() == null) {
            throw new IllegalArgumentException("User ID is required to update profile");
        }

        UserProfile profile = resolveProfileForUpdate(request);

        boolean isAdmin = profile.getRole() != null && profile.getRole().equalsIgnoreCase("ADMIN");

        String normalizedEmail = StringUtils.valueOrFallback(request.getEmail(), profile.getEmail());
        if (!ValidationUtils.isNotBlank(normalizedEmail)) {
            throw new IllegalArgumentException("Email is required to update profile");
        }

        // Validate username if provided (skip for locked admin usernames)
        if (!isAdmin && request.getUsername() != null && !ValidationUtils.isValidUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores");
        }

        // Validate phone if provided
        if (request.getPhoneNumber() != null && !ValidationUtils.isBlank(request.getPhoneNumber()) && 
            !ValidationUtils.isValidPhoneNumber(request.getPhoneNumber())) {
            throw new IllegalArgumentException("Invalid phone number format");
        }

        profile.setEmail(normalizedEmail);
        profile.setUsername(isAdmin
                ? profile.getUsername()
                : mergeValue(request.getUsername(), profile.getUsername(), normalizedEmail));
        profile.setFirstName(mergeValue(request.getFirstName(), profile.getFirstName(), ""));
        profile.setLastName(mergeValue(request.getLastName(), profile.getLastName(), ""));
        profile.setRole(StringUtils.valueOrFallback(profile.getRole(), "STUDENT").toUpperCase());
        profile.setPhoneNumber(mergeOptionalPhone(request.getPhoneNumber(), profile.getPhoneNumber()));
        // Note: profileImageUrl is only updated via updateProfilePicture()

        Long userId = requirePersistableId(profile, "profile update");
        UserProfile persisted = profileRepository.updateById(userId, profile);
        try {
            userRepository.syncUserMetadataByEmail(persisted.getEmail(), buildAuthMetadata(persisted));
        } catch (Exception metaEx) {
            // Non-fatal: profile data is already persisted.
        }
        return persisted;
    }

    public UserProfile ensureAdminProfile(String email, String username, String firstName, String lastName) {
        UserProfile profile = profileRepository.findByEmail(email)
                .orElseGet(UserProfile::new);

        profile.setEmail(email);
        profile.setUsername(StringUtils.valueOrFallback(profile.getUsername(), StringUtils.valueOrFallback(username, email)));
        profile.setFirstName(StringUtils.valueOrFallback(profile.getFirstName(), StringUtils.valueOrFallback(firstName, "Admin")));
        profile.setLastName(StringUtils.valueOrFallback(profile.getLastName(), StringUtils.valueOrFallback(lastName, "User")));
        profile.setRole("ADMIN");

        return profileRepository.upsert(profile);
    }

    public UserProfile ensureStudentProfile(String email) {
        Optional<UserProfile> existing = profileRepository.findByEmail(email);
        if (existing.isPresent()) {
            // Profile already exists - return it without modification to preserve user data
            return existing.get();
        }

        // Profile does not exist - create a new one with minimal defaults
        UserProfile profile = new UserProfile();
        String normalizedEmail = StringUtils.normalizeEmail(email);
        String defaultUsername = normalizedEmail != null && normalizedEmail.contains("@")
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : normalizedEmail;

        profile.setEmail(normalizedEmail);
        profile.setUsername(StringUtils.valueOrFallback(defaultUsername, normalizedEmail));
        profile.setFirstName("");
        profile.setLastName("");
        profile.setRole("STUDENT");

        return profileRepository.upsert(profile);
    }

    public UserProfile updateProfilePicture(Long userId, String fileName, String contentType, byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException("Profile image is required");
        }

        UserProfile profile = resolveProfileForImageUpdate(userId);
        String extension = resolveImageExtension(fileName, contentType);
        String identity = resolveStorageIdentity(profile);
        String objectPath = "avatars/" + identity + "/profile-" + System.currentTimeMillis() + extension;

        profileRepository.uploadProfileImage(objectPath, imageBytes, contentType);

        // Set only the public URL - this is the single source of truth for profile pictures
        String publicUrl = profileRepository.buildPublicProfileImageUrl(objectPath);
        profile.setProfileImageUrl(publicUrl);

        Long profileUserId = requirePersistableId(profile, "profile picture update");
        UserProfile persisted = profileRepository.updateById(profileUserId, profile);

        // Sync metadata including the new image URL, but do not fail the profile save if Supabase auth metadata cannot be updated.
        try {
            userRepository.syncUserMetadataByEmail(persisted.getEmail(), buildAuthMetadata(persisted));
        } catch (Exception metaEx) {
            // Non-fatal: profile data and storage upload already succeeded.
        }

        return persisted;
    }

    private String mergeValue(String requestedValue, String existingValue, String fallback) {
        // FIX: Allow explicit null to mean "no change", but allow empty string to clear
        if (requestedValue == null) {
            return existingValue != null && !existingValue.trim().isBlank() 
                ? existingValue.trim() 
                : fallback;
        }

        // Requested value is explicitly provided (including empty string "")
        String trimmed = requestedValue.trim();
        if (!trimmed.isBlank()) {
            return trimmed;
        }

        // Requested value is blank/empty - use existing if valid, else fallback
        if (existingValue != null && !existingValue.trim().isBlank()) {
            return existingValue.trim();
        }
        return fallback;
    }

    private String mergeOptionalPhone(String requestedValue, String existingValue) {
        if (requestedValue == null) {
            return existingValue;
        }
        String normalized = requestedValue.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private UserProfile resolveProfileForUpdate(UserProfileRequest request) {
        if (request.getId() == null) {
            throw new IllegalArgumentException("User ID is required to update profile");
        }

        Optional<UserProfile> byId = profileRepository.findById(request.getId());
        if (byId.isPresent()) {
            return byId.get();
        }

        throw new IllegalArgumentException("Profile not found for user ID: " + request.getId());
    }

    private UserProfile resolveProfileForImageUpdate(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required to update profile image");
        }

        Optional<UserProfile> byId = profileRepository.findById(userId);
        if (byId.isPresent()) {
            return byId.get();
        }

        throw new IllegalArgumentException("Profile not found for user ID: " + userId);
    }

    private String resolveStorageIdentity(UserProfile profile) {
        if (profile.getId() != null) {
            return "id-" + profile.getId();
        }
        String normalizedEmail = StringUtils.normalizeEmail(profile.getEmail());
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("Unable to resolve storage identity for profile image");
        }
        return normalizedEmail.replaceAll("[^a-z0-9@._-]", "_");
    }

    private Long requirePersistableId(UserProfile profile, String operation) {
        if (profile.getId() == null) {
            throw new IllegalArgumentException("User ID is required for " + operation);
        }
        return profile.getId();
    }

    private String resolveImageExtension(String fileName, String contentType) {
        String lowerFile = fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
        if (lowerFile.endsWith(".png")) {
            return ".png";
        }
        if (lowerFile.endsWith(".jpg") || lowerFile.endsWith(".jpeg")) {
            return ".jpg";
        }

        String lowerType = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if ("image/png".equals(lowerType)) {
            return ".png";
        }
        return ".jpg";
    }

    private java.util.Map<String, Object> buildAuthMetadata(UserProfile profile) {
        java.util.Map<String, Object> metadata = new java.util.HashMap<>();
        metadata.put("first_name", StringUtils.valueOrFallback(profile.getFirstName(), ""));
        metadata.put("last_name", StringUtils.valueOrFallback(profile.getLastName(), ""));
        metadata.put("username", StringUtils.valueOrFallback(profile.getUsername(), ""));
        metadata.put("phone_number", StringUtils.valueOrFallback(profile.getPhoneNumber(), ""));
        metadata.put("role", StringUtils.valueOrFallback(profile.getRole(), "STUDENT"));
        // FIX: Include profile image URL in auth metadata
        metadata.put("profile_image_url", StringUtils.valueOrFallback(profile.getProfileImageUrl(), ""));
        return metadata;
    }
}
