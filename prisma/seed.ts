import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  // Create default roles if they don't exist
  const roles = [
    { name: 'admin', description: 'Project administrator with full access' },
    { name: 'member', description: 'Regular project member' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator with full access to all features',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Regular user with limited access',
    },
  });

  const projectManagerRole = await prisma.role.upsert({
    where: { name: 'PROJECT_MANAGER' },
    update: {},
    create: {
      name: 'PROJECT_MANAGER',
      description: 'User who can manage projects',
    },
  });

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

  // The sample project creation has been removed as it's no longer needed

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 