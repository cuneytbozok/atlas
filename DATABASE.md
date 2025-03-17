# ATLAS Database Schema

This document outlines the database schema for the ATLAS application. The schema is designed to support user authentication, project management, AI integration, and logging/analytics.

## Database Configuration

The application uses PostgreSQL as the database. The connection is configured in the `.env` file:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atlas?schema=public"
```

## Schema Overview

### 1. Users and Authentication

- **User**: Stores user information including credentials and profile data
- **Session**: Manages user sessions for authentication
- **RefreshToken**: Stores refresh tokens for JWT authentication
- **Role**: Defines user roles (ADMIN, USER, PROJECT_MANAGER)
- **Permission**: Defines permissions for various actions
- **UserRole**: Maps users to roles (many-to-many)
- **RolePermission**: Maps roles to permissions (many-to-many)

### 2. Project Management

- **Project**: Stores project information
- **ProjectMember**: Maps users to projects with specific roles
- **ProjectSetting**: Stores project-specific settings

### 3. AI Integration

- **Assistant**: Stores information about AI assistants
- **Thread**: Represents conversation threads
- **Message**: Stores messages within threads
- **File**: Stores file metadata
- **FileAssociation**: Polymorphic association for files with assistants, threads, or messages

### 4. Logging and Analytics

- **ActivityLog**: Logs user activities
- **ApiUsageLog**: Tracks API usage and costs
- **ErrorLog**: Logs application errors

## Entity Relationships

### User Relationships
- A User can have multiple Sessions
- A User can have multiple RefreshTokens
- A User can have multiple UserRoles
- A User can create multiple Projects
- A User can be a member of multiple Projects through ProjectMember
- A User can have multiple ActivityLogs
- A User can have multiple ApiUsageLogs
- A User can upload multiple Files

### Role and Permission Relationships
- A Role can have multiple UserRoles
- A Role can have multiple RolePermissions
- A Permission can have multiple RolePermissions

### Project Relationships
- A Project is created by one User
- A Project can have multiple ProjectMembers
- A Project can have multiple ProjectSettings
- A Project can have multiple Threads

### AI Integration Relationships
- An Assistant can have multiple Threads
- A Thread belongs to one Project (optional)
- A Thread belongs to one Assistant (optional)
- A Thread can have multiple Messages
- A File can be associated with multiple entities through FileAssociation
- A Message belongs to one Thread

## Indices and Performance

The schema includes appropriate indices for foreign keys and frequently queried fields to ensure optimal performance:

- User email (unique)
- Session token (unique)
- RefreshToken token (unique)
- Role name (unique)
- Permission name (unique)
- UserRole userId and roleId (composite unique)
- RolePermission roleId and permissionId (composite unique)
- ProjectMember projectId and userId (composite unique)
- ProjectSetting projectId and settingKey (composite unique)
- Thread openaiThreadId (unique)
- Message openaiMessageId (unique)
- File openaiFileId (unique)
- FileAssociation fileId, associableType, and associableId (composite unique)

## Seed Data

The database is seeded with initial data:

- Roles: ADMIN, USER, PROJECT_MANAGER
- Permissions: CREATE_PROJECT, MANAGE_USERS, USE_AI
- Users: Admin, Regular User, Project Manager
- Sample Project, Assistant, Thread, and Messages

## Database Utilities

The application includes utility functions for database operations in `src/lib/db.ts`:

- `executeDbOperation`: Safely executes database operations with error handling
- `executeTransaction`: Executes operations in a transaction
- `checkDbConnection`: Checks if the database connection is healthy 