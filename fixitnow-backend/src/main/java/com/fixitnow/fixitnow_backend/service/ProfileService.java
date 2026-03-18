package com.fixitnow.fixitnow_backend.service;

import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.model.UserProfileRequest;
import com.fixitnow.fixitnow_backend.model.UserRequest;
import com.fixitnow.fixitnow_backend.repository.SupabaseProfileRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProfileService {

    private final SupabaseProfileRepository profileRepository;

    public ProfileService(SupabaseProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
    }

    public UserProfile upsertFromRegistration(UserRequest request) {
        Optional<UserProfile> existing = profileRepository.findByEmail(request.getEmail());
        UserProfile profile = existing.orElseGet(UserProfile::new);

        profile.setEmail(request.getEmail());
        profile.setUsername(valueOrFallback(request.getUsername(), request.getEmail()));
        profile.setFirstName(valueOrFallback(request.getFirstName(), "First"));
        profile.setLastName(valueOrFallback(request.getLastName(), "Last"));
        profile.setRole(valueOrFallback(profile.getRole(), "STUDENT").toUpperCase());
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
        UserProfile profile = resolveProfileForUpdate(request);

        String normalizedEmail = valueOrFallback(request.getEmail(), profile.getEmail());
        profile.setEmail(normalizedEmail);
        profile.setUsername(mergeValue(request.getUsername(), profile.getUsername(), normalizedEmail));
        profile.setFirstName(mergeValue(request.getFirstName(), profile.getFirstName(), "First"));
        profile.setLastName(mergeValue(request.getLastName(), profile.getLastName(), "Last"));
        profile.setRole(valueOrFallback(profile.getRole(), "STUDENT").toUpperCase());
        profile.setPhoneNumber(mergeOptionalPhone(request.getPhoneNumber(), profile.getPhoneNumber()));

        return profileRepository.upsert(profile);
    }

    public UserProfile ensureAdminProfile(String email, String username, String firstName, String lastName) {
        UserProfile profile = profileRepository.findByEmail(email)
                .orElseGet(UserProfile::new);

        profile.setEmail(email);
        profile.setUsername(valueOrFallback(profile.getUsername(), valueOrFallback(username, email)));
        profile.setFirstName(valueOrFallback(profile.getFirstName(), valueOrFallback(firstName, "Admin")));
        profile.setLastName(valueOrFallback(profile.getLastName(), valueOrFallback(lastName, "User")));
        profile.setRole("ADMIN");

        return profileRepository.upsert(profile);
    }

    public UserProfile ensureStudentProfile(String email) {
        UserProfile profile = profileRepository.findByEmail(email)
                .orElseGet(UserProfile::new);

        String normalizedEmail = valueOrFallback(email, "").toLowerCase();
        String defaultUsername = normalizedEmail.contains("@")
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : normalizedEmail;

        profile.setEmail(normalizedEmail);
        profile.setUsername(valueOrFallback(profile.getUsername(), valueOrFallback(defaultUsername, normalizedEmail)));
        profile.setFirstName(valueOrFallback(profile.getFirstName(), "First"));
        profile.setLastName(valueOrFallback(profile.getLastName(), "Last"));
        profile.setRole(valueOrFallback(profile.getRole(), "STUDENT").toUpperCase());

        return profileRepository.upsert(profile);
    }

    private String valueOrFallback(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private String mergeValue(String requestedValue, String existingValue, String fallback) {
        if (requestedValue != null) {
            String normalized = requestedValue.trim();
            if (!normalized.isBlank()) {
                return normalized;
            }
        }

        if (existingValue != null) {
            String normalizedExisting = existingValue.trim();
            if (!normalizedExisting.isBlank()) {
                return normalizedExisting;
            }
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
        if (request.getId() != null) {
            Optional<UserProfile> byId = profileRepository.findById(request.getId());
            if (byId.isPresent()) {
                return byId.get();
            }
        }

        String requestEmail = request.getEmail();
        if (requestEmail != null && !requestEmail.isBlank()) {
            Optional<UserProfile> byEmail = profileRepository.findByEmail(requestEmail);
            if (byEmail.isPresent()) {
                return byEmail.get();
            }
        }

        UserProfile profile = new UserProfile();
        if (request.getId() != null) {
            profile.setId(request.getId());
        }
        return profile;
    }
}
