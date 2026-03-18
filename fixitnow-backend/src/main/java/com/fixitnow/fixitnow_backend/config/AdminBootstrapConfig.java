package com.fixitnow.fixitnow_backend.config;

import com.fixitnow.fixitnow_backend.model.UserRequest;
import com.fixitnow.fixitnow_backend.repository.UserRepository;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;

import java.util.Locale;
import java.util.Map;

@Component
public class AdminBootstrapConfig {

    private final UserRepository userRepository;
    private final ProfileService profileService;

    @Value("${app.admin.bootstrap.enabled:true}")
    private boolean bootstrapEnabled;

    @Value("${app.admin.email:admin@cit.edu}")
    private String adminEmail;

    @Value("${app.admin.password:admin12345}")
    private String adminPassword;

    public AdminBootstrapConfig(UserRepository userRepository, ProfileService profileService) {
        this.userRepository = userRepository;
        this.profileService = profileService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureAdminAccount() {
        if (!bootstrapEnabled) {
            return;
        }

        String normalizedEmail = normalizeEmail(adminEmail);
        if (normalizedEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            return;
        }

        UserRequest adminRequest = new UserRequest();
        adminRequest.setEmail(normalizedEmail);
        adminRequest.setPassword(adminPassword);
        adminRequest.setUsername("admin");
        adminRequest.setFirstName("Admin");
        adminRequest.setLastName("User");
        adminRequest.setPhoneNumber("");

        try {
            ResponseEntity<Map<String, Object>> response = userRepository.signUp(adminRequest);
            if (response.getStatusCode().is2xxSuccessful()) {
                profileService.ensureAdminProfile(normalizedEmail, "admin", "Admin", "User");
                return;
            }
        } catch (HttpClientErrorException e) {
            String body = e.getResponseBodyAsString();
            if (body != null && body.toLowerCase(Locale.ROOT).contains("already")) {
                profileService.ensureAdminProfile(normalizedEmail, "admin", "Admin", "User");
                return;
            }
        } catch (Exception ignored) {
            return;
        }

        profileService.ensureAdminProfile(normalizedEmail, "admin", "Admin", "User");
    }

    private String normalizeEmail(String value) {
        if (value == null) {
            return "";
        }
        String input = value.trim().toLowerCase(Locale.ROOT);
        if (input.isBlank()) {
            return input;
        }
        return input.contains("@") ? input : input + "@project.local";
    }
}
