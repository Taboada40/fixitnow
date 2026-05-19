# Supabase Configuration Guide

## Summary

Your codebase is **already fully integrated with Supabase**. There is no localStorage or mock data to remove. The backend uses Supabase for:
- Authentication (sign up, sign in, password updates)
- Profile CRUD operations
- Report management
- Notification system
- File storage (profile pictures and report images)

The 500 Internal Server Error and 403 errors you're experiencing are caused by missing Supabase environment variables.

## Quick Setup

### Step 1: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select an existing one
3. Navigate to **Settings > API**
4. Copy the following values:
   - **Project URL** (e.g., `https://your-project-id.supabase.co`)
   - **anon public** key (this is your `SUPABASE_ANON_KEY`)
   - **service_role** key (this is your `SUPABASE_SERVICE_KEY` - keep this secret!)

### Step 2: Configure Backend

1. Copy `.env.example` to `.env`:
   ```bash
   cd fixitnow-backend
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values with your actual Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-actual-anon-key
   SUPABASE_SERVICE_KEY=your-actual-service-role-key
   ```

3. Run the SQL setup script in Supabase:
   - Open `SUPABASE_SETUP.sql` in the Supabase SQL Editor
   - Execute the script to create the required tables and storage buckets
   - Buckets created: `profiles` (profile pictures) and `report_image` (issue images)

### Step 3: Configure Frontend

1. Copy `.env.example` to `.env`:
   ```bash
   cd fixitnow-frontend
   cp .env.example .env
   ```

2. (Optional) Edit `.env` if your backend runs on a different port:
   ```env
   REACT_APP_API_BASE=http://localhost:8080
   ```

### Step 4: Run the Application

**Backend:**
```bash
cd fixitnow-backend
./mvnw spring-boot:run
```

**Frontend:**
```bash
cd fixitnow-frontend
npm start
```

## Troubleshooting

### 403 Errors on `/api/profile` or `/api/profile/picture`

**Cause:** Missing or invalid Supabase credentials, or the authentication token is invalid.

**Solution:**
1. Verify your `.env` file has the correct Supabase URL and keys
2. Ensure you've run the `SUPABASE_SETUP.sql` script in Supabase
3. Check that the frontend is sending the Bearer token in the Authorization header
4. Verify the user is logged in and has a valid session

### 500 Internal Server Error

**Cause:** Backend cannot connect to Supabase or Supabase tables don't exist.

**Solution:**
1. Check backend logs for specific error messages
2. Verify Supabase credentials are correct
3. Ensure the `SUPABASE_SETUP.sql` script has been executed
4. Check that the Supabase project is active (not paused)

### Tables Not Found Errors

**Cause:** The Supabase tables haven't been created yet.

**Solution:**
1. Open the Supabase SQL Editor
2. Copy and paste the contents of `SUPABASE_SETUP.sql`
3. Execute the script to create all required tables

### Existing Database Migration (profile_picture_url)

If your `user_profiles` table already exists from an older setup, run this migration in Supabase SQL Editor:

```sql
alter table public.user_profiles add column if not exists profile_picture_url text;
```

## Security Notes

- **Never commit** `.env` files to version control
- **Never share** your `SUPABASE_SERVICE_KEY` - it has full access to your database
- The `SUPABASE_ANON_KEY` is safe to use in client-side code (frontend)
- Always use environment variables for sensitive configuration

## Architecture Overview

**Backend (Spring Boot):**
- `UserRepository` - Handles Supabase authentication (sign up, sign in, password updates)
- `SupabaseProfileRepository` - Manages profile data in Supabase
- `SupabaseReportRepository` - Manages report data in Supabase
- `SupabaseNotificationRepository` - Manages notifications in Supabase
- `SupabaseBearerTokenAuthenticationFilter` - Validates Supabase JWT tokens
- `SecurityConfig` - Configures Spring Security with Supabase authentication

**Frontend (React):**
- `profileSession.js` - In-memory session management (no localStorage)
- API calls use Bearer tokens from Supabase authentication
- All data fetched from backend API endpoints

All CRUD operations already go through Supabase - no refactoring needed.
