package com.fixitnow.fixitnow_backend.model;

import java.util.Arrays;

public enum ReportStatus {
    PENDING("Pending"),
    IN_PROGRESS("In-Progress"),
    FIXED("Fixed"),
    CANCELLED("Cancelled");

    private final String label;

    ReportStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static ReportStatus from(String value) {
        if (value == null || value.isBlank()) {
            return PENDING;
        }

        String normalized = value.trim();
        return Arrays.stream(values())
                .filter(status -> status.label.equalsIgnoreCase(normalized)
                        || status.name().replace('_', '-').equalsIgnoreCase(normalized))
                .findFirst()
                .orElse(PENDING);
    }

    public static boolean isAllowed(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.trim();
        return Arrays.stream(values())
                .anyMatch(status -> status.label.equalsIgnoreCase(normalized)
                        || status.name().replace('_', '-').equalsIgnoreCase(normalized));
    }

    public static boolean isActive(String value) {
        ReportStatus status = from(value);
        return status == PENDING || status == IN_PROGRESS;
    }
}
