package com.fixitnow.fixitnow_backend.config;

import com.fixitnow.fixitnow_backend.controller.ProfileController;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.repository.UserRepository;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProfileController.class)
@Import(SecurityConfig.class)
class ProfileSecurityConfigTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProfileService profileService;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    void profileByIdRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/profile/by-id").param("userId", "308"))
                .andExpect(status().isForbidden());
    }

    @Test
    void profileByIdAllowsValidBearerToken() throws Exception {
        UserProfile profile = new UserProfile();
        profile.setId(308L);
        profile.setEmail("student@example.com");

        when(userRepository.getAuthenticatedUser("valid-token"))
                .thenReturn(Map.of("id", "auth-user-id", "email", "student@example.com"));
        when(profileService.getById(308L)).thenReturn(Optional.of(profile));

        mockMvc.perform(get("/api/profile/by-id")
                        .param("userId", "308")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer valid-token"))
                .andExpect(status().isOk());
    }

    @Test
    void corsPreflightAllowsAuthorizationHeaderFromFrontendOrigin() throws Exception {
        mockMvc.perform(options("/api/profile/by-id")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, "authorization"));
    }

}
