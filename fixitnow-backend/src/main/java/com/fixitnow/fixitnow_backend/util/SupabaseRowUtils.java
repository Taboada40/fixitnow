package com.fixitnow.fixitnow_backend.util;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public final class SupabaseRowUtils {

    private SupabaseRowUtils() {
    }

    public static LocalDateTime toDateTime(Object value) {
        if (value == null) {
            return null;
        }

        String text = value.toString();
        try {
            return OffsetDateTime.parse(text).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(text);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    public static String toText(Object value) {
        return value == null ? null : value.toString();
    }

    public static Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.valueOf(value.toString());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    public static long toLongOrZero(Object value) {
        Long parsed = toLong(value);
        return parsed == null ? 0L : parsed;
    }

    public static Boolean toBoolean(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(value.toString());
    }
}
