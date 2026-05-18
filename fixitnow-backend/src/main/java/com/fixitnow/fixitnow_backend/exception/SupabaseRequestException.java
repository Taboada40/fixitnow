package com.fixitnow.fixitnow_backend.exception;

import org.springframework.http.HttpStatus;

public class SupabaseRequestException extends RuntimeException {

    private final HttpStatus status;

    public SupabaseRequestException(HttpStatus status, String message) {
        super(message);
        this.status = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
    }

    public SupabaseRequestException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
