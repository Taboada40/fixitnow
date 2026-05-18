package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.exception.SupabaseRequestException;
import com.fixitnow.fixitnow_backend.model.NotificationItem;
import com.fixitnow.fixitnow_backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<?> getUserNotifications(
            @RequestParam(value = "userId", required = false) Long userId
    ) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID is required"));
        }
        try {
            List<NotificationItem> notifications = notificationService.listUserNotifications(userId);
            return ResponseEntity.ok(notifications);
        } catch (SupabaseRequestException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(Map.of("message", "Failed to load notifications: " + ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(500).body(Map.of("message", "Failed to load notifications: " + ex.getMessage()));
        }
    }
}
