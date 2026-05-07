package com.fixitnow.fixitnow_backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixitnow.fixitnow_backend.model.StatusUpdateRequest;
import com.fixitnow.fixitnow_backend.model.UserProfile;
import com.fixitnow.fixitnow_backend.service.NotificationService;
import com.fixitnow.fixitnow_backend.service.ProfileService;
import com.fixitnow.fixitnow_backend.service.ReportService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class IdContractControllerTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void notificationsRequireUserId() throws Exception {
        NotificationService notificationService = mock(NotificationService.class);
        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new NotificationController(notificationService))
                .build();

        mockMvc.perform(get("/api/notifications"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void notificationsLoadByUserId() throws Exception {
        NotificationService notificationService = mock(NotificationService.class);
        when(notificationService.listUserNotifications(308L)).thenReturn(List.of());
        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new NotificationController(notificationService))
                .build();

        mockMvc.perform(get("/api/notifications").param("userId", "308"))
                .andExpect(status().isOk());

        verify(notificationService).listUserNotifications(308L);
    }

    @Test
    void adminReportsAcceptAdminUserId() throws Exception {
        ReportService reportService = mock(ReportService.class);
        ProfileService profileService = mock(ProfileService.class);
        NotificationService notificationService = mock(NotificationService.class);
        when(profileService.getById(1L)).thenReturn(Optional.of(adminProfile()));
        when(reportService.listAllReports()).thenReturn(List.of());

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new AdminController(reportService, profileService, notificationService))
                .build();

        mockMvc.perform(get("/api/admin/reports").param("adminUserId", "1"))
                .andExpect(status().isOk());
    }

    @Test
    void statusUpdateAcceptsAdminUserId() throws Exception {
        ReportService reportService = mock(ReportService.class);
        ProfileService profileService = mock(ProfileService.class);
        NotificationService notificationService = mock(NotificationService.class);
        when(profileService.getById(1L)).thenReturn(Optional.of(adminProfile()));

        StatusUpdateRequest request = new StatusUpdateRequest();
        request.setAdminUserId(1L);
        request.setStatus("Fixed");

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new AdminController(reportService, profileService, notificationService))
                .build();

        mockMvc.perform(put("/api/admin/reports/10/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    private UserProfile adminProfile() {
        UserProfile profile = new UserProfile();
        profile.setId(1L);
        profile.setEmail("admin@example.com");
        profile.setRole("ADMIN");
        return profile;
    }
}
