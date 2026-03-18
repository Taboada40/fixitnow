package com.fixitnow.fixitnow_backend.model;

public class StatusUpdateRequest {
    private String adminEmail;
    private String status;

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
