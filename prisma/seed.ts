import { PrismaClient, Permission } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  
  // Define the system roles with proper display names
  const systemRoles = [
    { name: 'ADMIN', description: 'Administrator with full access to all features' },
    { name: 'PROJECT_MANAGER', description: 'User who can manage projects' },
    { name: 'USER', description: 'Regular user with limited access' }
  ];

  console.log('Creating/updating system roles...');
  // Create or update system roles
  for (const roleData of systemRoles) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: roleData,
    });
    console.log(`✓ Role ${roleData.name} ensured`);
  }

  console.log('✅ Roles created successfully');

  // Get references to the created roles
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  const projectManagerRole = await prisma.role.findUnique({ where: { name: 'PROJECT_MANAGER' } });

  if (!adminRole || !userRole || !projectManagerRole) {
    throw new Error("Failed to create required roles");
  }

  // Define all permissions
  const permissions = [
    // Critical permissions first for visibility in logs
    { name: 'MANAGE_APP_SETTINGS', description: 'Permission to manage application settings' },
    { name: 'VIEW_APP_SETTINGS', description: 'Permission to view application settings' },
    
    // Other permissions
    { name: 'CREATE_PROJECT', description: 'Permission to create new projects' },
    { name: 'MANAGE_USERS', description: 'Permission to manage users' },
    { name: 'USE_AI', description: 'Permission to use AI features' },
    { name: 'MANAGE_PROJECTS', description: 'Permission to manage existing projects' },
    { name: 'DELETE_PROJECTS', description: 'Permission to delete projects' },
  ];

  console.log('Creating/updating all permissions...');
  // Create all permissions
  const createdPermissions: Record<string, Permission> = {};
  for (const permission of permissions) {
    const created = await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
    createdPermissions[permission.name] = created;
    console.log(`✓ Permission ${permission.name} ensured`);
  }

  console.log('✅ Permissions created successfully');

  console.log('Assigning permissions to roles...');
  console.log('Assigning ALL permissions to ADMIN role...');
  // Define role permission assignments - ADMIN gets ALL permissions
  for (const permission of Object.values(createdPermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
    console.log(`✓ Assigned ${permission.name} to ADMIN role`);
  }
  
  // Project Manager role permissions
  const pmPermissions = ['CREATE_PROJECT', 'MANAGE_PROJECTS', 'USE_AI'];
  console.log('Assigning permissions to PROJECT_MANAGER role...');
  for (const permName of pmPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: projectManagerRole.id,
          permissionId: createdPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: projectManagerRole.id,
        permissionId: createdPermissions[permName].id,
      },
    });
    console.log(`✓ Assigned ${permName} to PROJECT_MANAGER role`);
  }
  
  // User role permissions
  console.log('Assigning permissions to USER role...');
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: userRole.id,
        permissionId: createdPermissions['USE_AI'].id,
      },
    },
    update: {},
    create: {
      roleId: userRole.id,
      permissionId: createdPermissions['USE_AI'].id,
    },
  });
  console.log(`✓ Assigned USE_AI to USER role`);

  console.log('✅ Role permissions assigned successfully');

  // Create admin user with password 'password' as per the documentation
  const adminPassword = await hashPassword('password');
  
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
  
  console.log('✅ Admin user created successfully and assigned ADMIN role');
  
  // Create default app settings
  console.log('Creating default app settings...');
  const defaultSettings = [
    { key: 'APP_NAME', value: 'ATLAS', description: 'Application name', isEncrypted: false },
    { key: 'APP_DESCRIPTION', value: 'Advanced Team Learning Assistant System', description: 'Application description', isEncrypted: false },
    { key: 'OPENAI_API_KEY', value: '', description: 'OpenAI API Key for AI functions', isEncrypted: true },
    { key: 'DEFAULT_AI_MODEL', value: 'gpt-4o', description: 'Default AI model to use', isEncrypted: false },
    { key: 'SYSTEM_INITIALIZED', value: 'true', description: 'Whether the system has been initialized', isEncrypted: false },
  ];

  for (const setting of defaultSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { 
        value: setting.value, 
        description: setting.description, 
        isEncrypted: setting.isEncrypted 
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        isEncrypted: setting.isEncrypted
      },
    });
    console.log(`✓ App setting ${setting.key} ensured`);
  }

  console.log('✅ Default app settings created successfully');
  
  // Verify admin permissions
  const adminPermissions = await prisma.permission.findMany({
    where: {
      rolePermissions: {
        some: {
          role: {
            name: 'ADMIN'
          }
        }
      }
    }
  });
  
  console.log(`\n✅ Verified admin role has ${adminPermissions.length} permissions:`);
  for (const perm of adminPermissions) {
    console.log(` - ${perm.name}`);
  }
  
  // Verify admin user has admin role
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId: admin.id
    },
    include: {
      role: true
    }
  });
  
  console.log(`\n✅ Verified admin user has ${userRoles.length} roles:`);
  for (const userRole of userRoles) {
    console.log(` - ${userRole.role.name}`);
  }
  
  console.log('\n🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 