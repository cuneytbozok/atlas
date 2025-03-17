# Atlas Permissions System

This directory contains the middleware and utilities for implementing permission checks in the Atlas application.

## Overview

Atlas uses a role-based access control (RBAC) system with the following components:

- **Roles**: System-level roles assigned to users (ADMIN, PROJECT_MANAGER, USER)
- **Permissions**: Granular capabilities that can be assigned to roles (CREATE_PROJECT, MANAGE_USERS, USE_AI)
- **Project Roles**: Roles within the context of a specific project

## Files

- `with-permission.ts`: Middleware for handling permission checks in API routes
- `permission-utils.ts`: Utilities for checking specific permissions

## Usage Examples

### Basic Role Check

To restrict an API endpoint to users with a specific role:

```typescript
import { withPermission } from "@/lib/middleware/with-permission";
import { withErrorHandling } from "@/lib/api/error-handler";

async function adminOnlyHandler(request, context) {
  // Handler logic here
}

export const GET = withErrorHandling(
  withPermission(adminOnlyHandler, { requiredRole: "ADMIN" })
);
```

### Multiple Roles Check

To allow multiple roles to access an endpoint:

```typescript
export const POST = withErrorHandling(
  withPermission(handler, {
    requiredRoles: ["PROJECT_MANAGER", "ADMIN"]
  })
);
```

### Project-specific Checks

To restrict access based on project membership:

```typescript
import { withPermission, isProjectMember } from "@/lib/middleware/with-permission";

export const PUT = withErrorHandling(
  withPermission(handler, {
    checkFunction: isProjectMember
  })
);
```

To restrict access to project admins:

```typescript
import { withPermission, isProjectAdmin } from "@/lib/middleware/with-permission";

export const PATCH = withErrorHandling(
  withPermission(handler, {
    checkFunction: isProjectAdmin
  })
);
```

### Permission-based Checks

To check specific permissions rather than roles:

```typescript
import { withPermission } from "@/lib/middleware/with-permission";
import { userHasPermission } from "@/lib/middleware/permission-utils";

// Custom check function
async function hasCreateProjectPermission(userId: string): Promise<boolean> {
  return await userHasPermission(userId, 'CREATE_PROJECT');
}

export const POST = withErrorHandling(
  withPermission(handler, {
    checkFunction: hasCreateProjectPermission
  })
);
```

## Client-side Permission Checks

For client-side permission checking, use the `useAuth` hook:

```typescript
import { useAuth } from "@/hooks/use-auth";

function MyComponent() {
  const { hasRole } = useAuth();
  
  if (hasRole("ADMIN")) {
    // Show admin-only UI
  }
  
  return (
    // Component JSX
  );
}
```

## Protected Routes

To restrict access to entire pages:

```typescript
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      {/* Page content */}
    </ProtectedRoute>
  );
}
```

## Database Schema

The permission system relies on these tables:

- `Role`: System roles (ADMIN, PROJECT_MANAGER, USER)
- `Permission`: Granular permissions (CREATE_PROJECT, MANAGE_USERS, USE_AI)
- `UserRole`: Associates users with their system roles
- `RolePermission`: Associates roles with their granted permissions
- `ProjectMember`: Associates users with roles in specific projects 