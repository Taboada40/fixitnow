package com.fixitnow.fixitnow_backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public class NotificationItem {
    private Long id;
    private Long reportId;
    private Long recipientUserId;
    private String recipientEmail;
    private String recipientRole;
    private String title;
    private String message;
    private Boolean isRead;
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getReportId() {
        return reportId;
    }

    public void setReportId(Long reportId) {
        this.reportId = reportId;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public Long getRecipientUserId() {
        return recipientUserId;
    }

    @JsonProperty("recipient_user_id")
    public Long getRecipientUserIdSnakeCase() {
        return recipientUserId;
    }

    public void setRecipientUserId(Long recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    @JsonProperty("recipient_user_id")
    public void setRecipientUserIdSnakeCase(Long recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    public void setRecipientEmail(String recipientEmail) {
        this.recipientEmail = recipientEmail;
    }

    public String getRecipientRole() {
        return recipientRole;
    }

    public void setRecipientRole(String recipientRole) {
        this.recipientRole = recipientRole;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    @JsonProperty("is_read")
    public Boolean getIsReadSnakeCase() {
        return isRead;
    }

    public void setIsRead(Boolean isRead) {
        this.isRead = isRead;
    }

    @JsonProperty("is_read")
    public void setIsReadSnakeCase(Boolean isRead) {
        this.isRead = isRead;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    @JsonProperty("created_at")
    public LocalDateTime getCreatedAtSnakeCase() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @JsonProperty("created_at")
    public void setCreatedAtSnakeCase(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
