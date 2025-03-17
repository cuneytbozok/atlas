import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  // Define the system roles with proper display names
  const systemRoles = [
    { name: 'ADMIN', description: 'Administrator with full access to all features' },
    { name: 'PROJECT_MANAGER', description: 'User who can manage projects' },
    { name: 'USER', description: 'Regular user with limited access' }
  ];

  // Create or update system roles
  for (const roleData of systemRoles) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: roleData,
    });
  }

  // Get references to the created roles
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  const projectManagerRole = await prisma.role.findUnique({ where: { name: 'PROJECT_MANAGER' } });

  if (!adminRole || !userRole || !projectManagerRole) {
    throw new Error("Failed to create required roles");
  }

  console.log({ adminRole, userRole, projectManagerRole });

  // Create permissions
  const createProjectPermission = await prisma.permission.upsert({
    where: { name: 'CREATE_PROJECT' },
    update: {},
    create: {
      name: 'CREATE_PROJECT',
      description: 'Permission to create new projects',
    },
  });

  const manageUsersPermission = await prisma.permission.upsert({
    where: { name: 'MANAGE_USERS' },
    update: {},
    create: {
      name: 'MANAGE_USERS',
      description: 'Permission to manage users',
    },
  });

  const useAIPermission = await prisma.permission.upsert({
    where: { name: 'USE_AI' },
    update: {},
    create: {
      name: 'USE_AI',
      description: 'Permission to use AI features',
    },
  });

  console.log({ createProjectPermission, manageUsersPermission, useAIPermission });

  // Assign permissions to roles
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: createProjectPermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: createProjectPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: manageUsersPermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: manageUsersPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: useAIPermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: useAIPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: projectManagerRole.id,
        permissionId: createProjectPermission.id,
      },
    },
    update: {},
    create: {
      roleId: projectManagerRole.id,
      permissionId: createProjectPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: userRole.id,
        permissionId: useAIPermission.id,
      },
    },
    update: {},
    create: {
      roleId: userRole.id,
      permissionId: useAIPermission.id,
    },
  });

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@atlas.com' },
    update: {},
    create: {
      email: 'admin@atlas.com',
      name: 'Admin User',
      password: adminPassword,
    },
  });
  
  // Assign admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });
  
  console.log({ admin });
  
  // Create regular user
  const userPassword = await hashPassword('user123');
  
  const user = await prisma.user.upsert({
    where: { email: 'user@atlas.com' },
    update: {},
    create: {
      email: 'user@atlas.com',
      name: 'Regular User',
      password: userPassword,
    },
  });
  
  // Assign user role to regular user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: userRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: userRole.id,
    },
  });
  
  console.log({ user });

  // Create project manager user
  const pmPassword = await hashPassword('manager123');
  
  const projectManager = await prisma.user.upsert({
    where: { email: 'manager@atlas.com' },
    update: {},
    create: {
      email: 'manager@atlas.com',
      name: 'Project Manager',
      password: pmPassword,
    },
  });
  
  // Assign project manager role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: projectManager.id,
        roleId: projectManagerRole.id,
      },
    },
    update: {},
    create: {
      userId: projectManager.id,
      roleId: projectManagerRole.id,
    },
  });
  
  console.log({ projectManager });

  // Instead of trying to delete roles directly, log a message about using the cleanup script
  console.log('\nNOTE: To clean up any lowercase duplicate roles (admin, member), please run:');
  console.log('npm run fix-roles\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 