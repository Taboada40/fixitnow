package com.fixitnow.fixitnow_backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ReportRequest {
    private Long userId;
    private String title;
    private String description;
    private String location;
    private String imageName;
    private String imagePath;
    private String imageUrl;
    private String status;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getImageName() {
        return imageName;
    }

    public void setImageName(String imageName) {
        this.imageName = imageName;
    }

    public String getImagePath() {
        return imagePath;
    }

    @JsonProperty("image_path")
    public String getImagePathSnakeCase() {
        return imagePath;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    @JsonProperty("image_path")
    public void setImagePathSnakeCase(String imagePath) {
        this.imagePath = imagePath;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    @JsonProperty("image_url")
    public String getImageUrlSnakeCase() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    @JsonProperty("image_url")
    public void setImageUrlSnakeCase(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
