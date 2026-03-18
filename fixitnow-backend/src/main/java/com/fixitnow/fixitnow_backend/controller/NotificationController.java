package com.fixitnow.fixitnow_backend.controller;

import com.fixitnow.fixitnow_backend.model.NotificationItem;
import com.fixitnow.fixitnow_backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<?> getUserNotifications(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "email", required = false) String email
    ) {
        if (userId == null && (email == null || email.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("message", "User ID or email is required"));
        }

        List<NotificationItem> notifications = notificationService.listUserNotifications(userId, email);
        return ResponseEntity.ok(notifications);
    }
}
