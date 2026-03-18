package com.fixitnow.fixitnow_backend.model;

import java.time.LocalDateTime;

public class UserDashboardSummary {
    private String email;
    private long totalReports;
    private long resolvedReports;
    private long alertsCount;
    private LocalDateTime lastReportAt;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public long getTotalReports() {
        return totalReports;
    }

    public void setTotalReports(long totalReports) {
        this.totalReports = totalReports;
    }

    public long getResolvedReports() {
        return resolvedReports;
    }

    public void setResolvedReports(long resolvedReports) {
        this.resolvedReports = resolvedReports;
    }

    public long getAlertsCount() {
        return alertsCount;
    }

    public void setAlertsCount(long alertsCount) {
        this.alertsCount = alertsCount;
    }

    public LocalDateTime getLastReportAt() {
        return lastReportAt;
    }

    public void setLastReportAt(LocalDateTime lastReportAt) {
        this.lastReportAt = lastReportAt;
    }
}
