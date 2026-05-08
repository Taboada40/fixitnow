# FixItNow

## 📁 Project Roadmap

### Backend (Java Spring Boot)
- **src/main/java/com/fixitnow/fixitnow_backend/**
  - **FixitnowBackendApplication.java** - Main Spring Boot application entry point
  
  - **config/** - Configuration classes
    - `AdminBootstrapConfig.java` - Admin user initialization configuration
    - `ProfileMigrationConfig.java` - User profile migration setup
    - `SecurityConfig.java` - Spring Security configuration
    - `SupabaseBearerTokenAuthenticationFilter.java` - Authentication filter for Supabase tokens
  
  - **controller/** - REST API endpoints
    - `AdminController.java` - Admin management endpoints
    - `AuthController.java` - Authentication endpoints
    - `NotificationController.java` - Notification endpoints
    - `ProfileController.java` - User profile endpoints
    - `ReportController.java` - Report management endpoints
  
  - **model/** - Data models and request/response objects
    - `NotificationItem.java` - Notification entity
    - `PasswordChangeRequest.java` - Password change request DTO
    - `ReportItem.java` - Report entity
    - `ReportRequest.java` - Report creation request DTO
    - `ReportStatus.java` - Report status enum
    - `StatusUpdateRequest.java` - Status update request DTO
    - `UserDashboardSummary.java` - Dashboard summary DTO
    - `UserProfile.java` - User profile entity
    - `UserProfileRequest.java` - Profile update request DTO
    - `UserRequest.java` - User creation request DTO
  
  - **repository/** - Data access layer
    - `SupabaseNotificationRepository.java` - Supabase notification queries
    - `SupabaseProfileRepository.java` - Supabase profile queries
    - `SupabaseReportRepository.java` - Supabase report queries
    - `UserRepository.java` - User database queries
  
  - **service/** - Business logic layer
    - `NotificationService.java` - Notification handling logic
    - `ProfileService.java` - User profile operations
    - `ReportService.java` - Report management logic
  
  - **util/** - Utility classes
    - `StringUtils.java` - String manipulation utilities
    - `SupabaseRowUtils.java` - Supabase row parsing utilities
    - `ValidationUtils.java` - Input validation utilities

### Frontend (React)
- **fixitnow-frontend/src/**
  - **App.js** - Main React application component
  - **index.js** - React DOM entry point
  - **App.css** - Main application styles
  - **index.css** - Global styles
  - **reportWebVitals.js** - Performance monitoring
  - **setupTests.js** - Test configuration
  
  - **components/** - React UI components
    - `AdminDashboard.js` - Admin dashboard page
    - `AdminNotifications.js` - Admin notification management
    - `Dashboard.js` - User dashboard
    - `Login.js` - Login page
    - `Profile.js` - User profile page
    - `Register.js` - User registration page
    - `ReportHistory.js` - Report history view
    - `ReportIssue.js` - Report submission form
    - `TopNavBar.js` - Navigation bar
    - `UserNotifications.js` - User notification center
  
  - **hooks/** - Custom React hooks
    - `useApi.js` - API call hook
    - `useDebounce.js` - Debounce hook for form inputs
  
  - **utils/** - Utility functions
    - `constants.js` - Application constants
    - `profileSession.js` - Session/profile management
  
  - **styles/** - Component-specific styles

### Configuration & Documentation
- **pom.xml** - Maven project configuration
- **application.properties** - Spring Boot application properties
- **SUPABASE_CONFIG_GUIDE.md** - Supabase setup documentation
- **SUPABASE_SETUP.sql** - Database schema and initial data
- **fixitnow-frontend/package.json** - Node.js dependencies