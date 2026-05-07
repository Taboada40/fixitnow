package com.fixitnow.fixitnow_backend.util;

import java.util.regex.Pattern;

/**
 * Utility class for common validation operations
 * Follows Single Responsibility Principle by focusing only on validation
 */
public class ValidationUtils {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );
    
    private static final Pattern PHONE_PATTERN = Pattern.compile(
        "^[+]?[0-9]{10,15}$"
    );

    /**
     * Validates if a string is a valid email format
     */
    public static boolean isValidEmail(String email) {
        return email != null && EMAIL_PATTERN.matcher(email.trim()).matches();
    }

    /**
     * Validates if a string is a valid phone number format
     */
    public static boolean isValidPhoneNumber(String phone) {
        return phone != null && PHONE_PATTERN.matcher(phone.trim()).matches();
    }

    /**
     * Validates if a password meets minimum security requirements
     */
    public static boolean isValidPassword(String password) {
        return password != null && password.trim().length() >= 6;
    }

    /**
     * Validates if a username meets the requirements
     */
    public static boolean isValidUsername(String username) {
        return username != null && 
               username.trim().length() >= 3 && 
               username.trim().length() <= 50 &&
               username.trim().matches("^[A-Za-z0-9_.-]+$");
    }

    /**
     * Validates if a file is an allowed image type
     */
    public static boolean isAllowedImageType(String contentType, String fileName) {
        if (contentType == null && fileName == null) {
            return false;
        }

        String lowerContentType = contentType == null ? "" : contentType.toLowerCase();
        String lowerFileName = fileName == null ? "" : fileName.toLowerCase();

        boolean allowedType = lowerContentType.equals("image/jpeg") || 
                             lowerContentType.equals("image/jpg") || 
                             lowerContentType.equals("image/png");

        boolean allowedExtension = lowerFileName.endsWith(".jpg") || 
                                  lowerFileName.endsWith(".jpeg") || 
                                  lowerFileName.endsWith(".png");

        return allowedType && allowedExtension;
    }

    /**
     * Validates if a string is not null or blank
     */
    public static boolean isNotBlank(String value) {
        return value != null && !value.trim().isBlank();
    }

    /**
     * Validates if a string is null or blank
     */
    public static boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }
}
