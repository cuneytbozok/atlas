import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
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

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: 'sample-project-1' },
    update: {},
    create: {
      id: 'sample-project-1',
      name: 'Sample AI Project',
      description: 'A sample project to demonstrate ATLAS capabilities',
      createdById: admin.id,
    },
  });

  console.log({ project });

  // Add project members
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: user.id,
      roleId: userRole.id,
    },
  });

  // Create a sample assistant
  const assistant = await prisma.assistant.upsert({
    where: { id: 'sample-assistant-1' },
    update: {},
    create: {
      id: 'sample-assistant-1',
      name: 'ATLAS Assistant',
      model: 'gpt-4o',
      configuration: {
        instructions: 'You are ATLAS, an AI assistant that helps with productivity tasks.',
        tools: ['code_interpreter', 'retrieval'],
      },
    },
  });

  console.log({ assistant });

  // Create a sample thread
  const thread = await prisma.thread.upsert({
    where: { id: 'sample-thread-1' },
    update: {},
    create: {
      id: 'sample-thread-1',
      title: 'Getting Started with ATLAS',
      projectId: project.id,
      assistantId: assistant.id,
    },
  });

  console.log({ thread });

  // Create sample messages
  const userMessage = await prisma.message.upsert({
    where: { id: 'sample-message-1' },
    update: {},
    create: {
      id: 'sample-message-1',
      threadId: thread.id,
      role: 'user',
      content: 'Hello ATLAS, can you help me get started with this project?',
    },
  });

  const assistantMessage = await prisma.message.upsert({
    where: { id: 'sample-message-2' },
    update: {},
    create: {
      id: 'sample-message-2',
      threadId: thread.id,
      role: 'assistant',
      content: 'Of course! I\'d be happy to help you get started with ATLAS. What specific aspect of the project would you like to explore first?',
    },
  });

  console.log({ userMessage, assistantMessage });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }); 