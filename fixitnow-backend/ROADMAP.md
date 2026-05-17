# FixItNow - Project Roadmap & File Structure

## Project Overview
FixItNow is a full-stack web application for managing maintenance requests and issue reporting. It consists of a Java Spring Boot backend and a React frontend, with Supabase as the database.

---

## 📁 Complete File Structure & Organization

### Root Configuration Files
```
fixitnow-backend/
├── pom.xml                          # Maven configuration (Java dependencies, build settings)
├── mvnw                             # Maven wrapper script (Unix/Linux)
├── mvnw.cmd                         # Maven wrapper script (Windows)
├── Dockerfile                       # Docker configuration for backend deployment
├── .gitignore                       # Git ignore rules
├── .gitattributes                   # Git attributes configuration
├── application.properties           # Spring Boot application configuration
```

### Documentation
```
├── README.md                        # Main project documentation
├── ROADMAP.md                       # This file - project roadmap and structure
├── HELP.md                          # Spring Boot help documentation
├── SUPABASE_CONFIG_GUIDE.md         # Supabase configuration guide
├── SUPABASE_SETUP.sql               # Supabase database schema and initial data
```

### IDE & Development Tools
```
├── .mvn/                            # Maven configuration directory
├── .vscode/                         # VS Code configuration
│   ├── settings.json                # VS Code workspace settings
│   └── extensions.json              # Recommended VS Code extensions
├── .idea/                           # IntelliJ IDEA configuration
│   ├── workspace.xml
│   ├── vcs.xml
│   ├── modules.xml
│   ├── misc.xml
│   └── jarRepositories.xml
├── .cursor/                         # Cursor IDE configuration
├── .vs/                             # Visual Studio configuration
```

---

## 🔵 Backend (Java Spring Boot)

### Main Application Entry Point
```
src/main/java/com/fixitnow/fixitnow_backend/
├── FixitnowBackendApplication.java  # Spring Boot application main class
```

### Configuration Layer (`config/`)
Configuration classes for application setup and security:
```
├── config/
│   ├── AdminBootstrapConfig.java                        # Admin user initialization
│   ├── ProfileMigrationConfig.java                      # User profile migration setup
│   ├── SecurityConfig.java                              # Spring Security configuration
│   └── SupabaseBearerTokenAuthenticationFilter.java     # Supabase JWT token authentication filter
```

**Purpose:** Handles application startup configuration, security policies, and authentication.

### Controller Layer (`controller/`)
REST API endpoints for handling HTTP requests:
```
├── controller/
│   ├── AdminController.java         # Admin management endpoints
│   │   └── Methods: GET, POST, PUT, DELETE for admin operations
│   ├── AuthController.java          # Authentication endpoints
│   │   └── Methods: login, register, logout, token refresh
│   ├── NotificationController.java  # Notification endpoints
│   │   └── Methods: GET notifications, mark as read/unread
│   ├── ProfileController.java       # User profile endpoints
│   │   └── Methods: GET, PUT for profile management
│   └── ReportController.java        # Report management endpoints
│       └── Methods: GET, POST, PUT for report operations
```

**Purpose:** Entry points for all client API requests. Each controller handles specific business domains.

### Model Layer (`model/`)
Data models and data transfer objects (DTOs):
```
├── model/
│   ├── NotificationItem.java        # Notification entity
│   ├── PasswordChangeRequest.java   # DTO for password change requests
│   ├── ReportItem.java              # Report entity (main report data)
│   ├── ReportRequest.java           # DTO for creating/updating reports
│   ├── ReportStatus.java            # Enum: OPEN, IN_PROGRESS, COMPLETED, CLOSED
│   ├── StatusUpdateRequest.java     # DTO for status update requests
│   ├── UserDashboardSummary.java    # DTO for dashboard statistics
│   ├── UserProfile.java             # User profile entity
│   ├── UserProfileRequest.java      # DTO for profile update requests
│   └── UserRequest.java             # DTO for user creation requests
```

**Purpose:** Defines data structures and contracts between frontend and backend.

### Repository Layer (`repository/`)
Data access objects for database operations:
```
├── repository/
│   ├── UserRepository.java                  # User database queries
│   │   └── Methods: findByEmail, save, delete, etc.
│   ├── SupabaseProfileRepository.java       # Supabase profile queries
│   │   └── Methods: Direct Supabase API calls for profiles
│   ├── SupabaseReportRepository.java        # Supabase report queries
│   │   └── Methods: Direct Supabase API calls for reports
│   └── SupabaseNotificationRepository.java  # Supabase notification queries
│       └── Methods: Direct Supabase API calls for notifications
```

**Purpose:** Abstracts database access logic. Supabase repositories handle direct REST API calls.

### Service Layer (`service/`)
Business logic and core application operations:
```
├── service/
│   ├── NotificationService.java    # Notification handling business logic
│   │   └── Methods: create, retrieve, mark read/unread notifications
│   ├── ProfileService.java         # User profile operations
│   │   └── Methods: update profile, fetch user data
│   └── ReportService.java          # Report management business logic
│       └── Methods: create report, update status, retrieve history
```

**Purpose:** Core application logic, data validation, and business rule enforcement.

### Utility Layer (`util/`)
Helper and utility functions:
```
├── util/
│   ├── StringUtils.java            # String manipulation utilities
│   ├── SupabaseRowUtils.java       # Supabase row parsing and data conversion
│   └── ValidationUtils.java        # Input validation utilities
```

**Purpose:** Reusable utility functions across the application.

### Resources
```
├── src/main/resources/
│   └── application.properties       # Spring Boot configuration properties
```

---

## 🧪 Test Layer

### Unit & Integration Tests
```
src/test/java/com/fixitnow/fixitnow_backend/
├── FixitnowBackendApplicationTests.java     # Main application tests
├── controller/
│   └── IdContractControllerTests.java       # Controller endpoint tests
└── config/
    └── ProfileSecurityConfigTests.java      # Security configuration tests
```

**Purpose:** Automated testing for backend functionality and security.

---

## 🔴 Frontend (React)

### Root Frontend Configuration
```
fixitnow-frontend/
├── package.json                    # Node.js dependencies and scripts
├── package-lock.json               # Dependency lock file
├── Dockerfile                      # Docker configuration for frontend deployment
├── .gitignore                      # Git ignore rules for frontend
├── .env.example                    # Example environment variables
├── README.md                       # Frontend documentation
```

### Public Assets
```
├── public/
│   ├── index.html                  # Main HTML entry point
│   ├── manifest.json               # PWA manifest configuration
│   ├── robots.txt                  # SEO robots configuration
│   ├── fixitnow-logo.svg           # Application logo
```

**Purpose:** Static assets and HTML shell for the React application.

### Main Application Code
```
├── src/
│   ├── index.js                    # React DOM entry point
│   ├── App.js                      # Root React component
│   ├── App.css                     # Main application styles
│   ├── index.css                   # Global styles
│   ├── App.test.js                 # App component tests
│   ├── setupTests.js               # Test configuration
│   ├── reportWebVitals.js          # Performance monitoring
│   ├── logo.svg                    # React logo/assets
```

**Purpose:** Core React application configuration and global styling.

### Components (`src/components/`)
Reusable React UI components:
```
├── src/components/
│   ├── AdminDashboard.js           # Admin dashboard page
│   ├── AdminNotifications.js       # Admin notification management UI
│   ├── Dashboard.js                # User dashboard page
│   ├── Login.js                    # Login page/form
│   ├── Register.js                 # User registration page/form
│   ├── Profile.js                  # User profile page
│   ├── ReportIssue.js              # Report submission form
│   ├── ReportHistory.js            # Report history/list view
│   ├── TopNavBar.js                # Navigation bar component
│   └── UserNotifications.js        # User notification center UI
```

**Purpose:** Modular React components for different views and features.

### Custom Hooks (`src/hooks/`)
Reusable React logic:
```
├── src/hooks/
│   ├── useApi.js                   # API call hook (fetch wrapper)
│   └── useDebounce.js              # Debounce hook for form inputs
```

**Purpose:** Encapsulate common React logic for state management and API calls.

### Utilities (`src/utils/`)
Helper functions and constants:
```
├── src/utils/
│   ├── constants.js                # Application constants, API endpoints, etc.
│   └── profileSession.js           # Session and profile management utilities
```

**Purpose:** Configuration and utility functions for session, API, and data handling.

### Styles (`src/styles/`)
Component-specific styling:
```
├── src/styles/
│   └── (Component-specific .css files as needed)
```

**Purpose:** Organized styling for individual components.

---

## 🗄️ Database Schema

The database schema is defined in:
- **`SUPABASE_SETUP.sql`** - Complete database schema including:
  - `users` table
  - `user_profiles` table
  - `reports` table
  - `notifications` table
  - Relationships and constraints

Setup instructions available in: **`SUPABASE_CONFIG_GUIDE.md`**

---

## 🔗 API Architecture

### Backend APIs (Java Spring Boot)
- Base URL: `http://localhost:8080` (development)
- Security: Supabase JWT Bearer Token Authentication
- Format: JSON request/response

### Controllers & Endpoints
1. **AuthController** - `/api/auth/*`
   - POST `/login` - User login
   - POST `/register` - User registration
   - POST `/logout` - User logout

2. **ProfileController** - `/api/profiles/*`
   - GET `/{id}` - Get user profile
   - PUT `/{id}` - Update user profile

3. **ReportController** - `/api/reports/*`
   - GET - List reports
   - POST - Create report
   - PUT `/{id}` - Update report status

4. **NotificationController** - `/api/notifications/*`
   - GET - List notifications
   - PUT `/{id}/read` - Mark notification as read

5. **AdminController** - `/api/admin/*`
   - Admin management endpoints

---

## 🚀 Deployment & Docker

### Backend Deployment
- `Dockerfile` - Containerizes Java Spring Boot application
- Multi-stage build for optimized image size
- Port: 8080 (default)

### Frontend Deployment
- `fixitnow-frontend/Dockerfile` - Containerizes React application
- Port: 3000 (default)

### Orchestration
- Docker Compose (if available) for local multi-container setup

---

## 📦 Dependencies

### Backend (Maven)
Configured in `pom.xml`:
- Spring Boot 3.5.11
- Spring Security
- Spring Web
- Spring Validation
- Spring Test
- Java 17

### Frontend (Node.js/npm)
Configured in `fixitnow-frontend/package.json`:
- React
- React Router
- Axios (or similar for API calls)
- Testing libraries

---

## 🔐 Security

### Authentication Flow
1. User credentials → Login endpoint
2. Backend validates with Supabase
3. JWT token issued by Supabase
4. Token stored in frontend session
5. Token included in Authorization header for subsequent requests

### Configuration
- `SecurityConfig.java` - Spring Security policies
- `SupabaseBearerTokenAuthenticationFilter.java` - JWT token validation

---

## 📊 Project Statistics

- **Languages**: Java, JavaScript/React, SQL
- **Main Framework**: Spring Boot 3.5.11
- **Frontend Framework**: React
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase JWT
- **Containerization**: Docker

---

## 🎯 Key Features

1. **User Authentication** - Register, login, password management
2. **Report Management** - Create, update, track maintenance requests
3. **User Profiles** - Manage user information and preferences
4. **Notifications** - Real-time notification system
5. **Admin Dashboard** - Administrative oversight and management
6. **Report History** - Track completed and ongoing reports

---

## 📝 Development Workflow

### Backend Development
1. Modify Java files in `src/main/java/com/fixitnow/fixitnow_backend/`
2. Run tests: `./mvnw test`
3. Build: `./mvnw clean install`
4. Run: `./mvnw spring-boot:run`

### Frontend Development
1. Modify React files in `fixitnow-frontend/src/`
2. Start dev server: `npm start`
3. Run tests: `npm test`
4. Build: `npm run build`

### Database
- Schema updates in `SUPABASE_SETUP.sql`
- Apply migrations to Supabase instance
- Reference guide: `SUPABASE_CONFIG_GUIDE.md`

---

## 📌 Important Conventions

- **Backend**: Package structure follows domain-driven design (controllers, services, models, repositories)
- **Frontend**: Component-based architecture with custom hooks for logic reuse
- **Database**: Supabase-hosted PostgreSQL with REST API access
- **Configuration**: Environment-based properties in `application.properties`

---

**Last Updated**: 2026-05-17
**Project**: FixItNow - Maintenance Request Management System
