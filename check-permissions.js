// Script to check and update admin permissions
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndUpdatePermissions() {
  try {
    console.log('🔍 Checking database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Check AppSetting table
    console.log('\n🔍 Checking for AppSetting table...');
    try {
      const appSettingCount = await prisma.appSetting.count();
      console.log(`✅ AppSetting table exists and has ${appSettingCount} entries`);
    } catch (error) {
      console.error('❌ Error accessing AppSetting table:', error.message);
    }

    // Check ADMIN role
    console.log('\n🔍 Checking ADMIN role...');
    const adminRole = await prisma.role.findFirst({
      where: { name: 'ADMIN' },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!adminRole) {
      console.error('❌ ADMIN role not found');
      return;
    }

    console.log(`✅ ADMIN role found: ${adminRole.id}`);
    console.log(`Has ${adminRole.rolePermissions.length} permissions:`);
    
    adminRole.rolePermissions.forEach(rp => {
      console.log(`- ${rp.permission.name}: ${rp.permission.description || 'No description'}`);
    });

    // Create required permissions if they don't exist
    console.log('\n🔍 Checking for required permissions...');
    const requiredPermissions = [
      { name: 'MANAGE_APP_SETTINGS', description: 'Permission to manage application settings' },
      { name: 'VIEW_APP_SETTINGS', description: 'Permission to view application settings' },
      { name: 'CREATE_PROJECT', description: 'Permission to create new projects' },
      { name: 'MANAGE_USERS', description: 'Permission to manage users' },
      { name: 'USE_AI', description: 'Permission to use AI features' }
    ];

    for (const permData of requiredPermissions) {
      const existingPerm = await prisma.permission.findUnique({
        where: { name: permData.name }
      });

      if (existingPerm) {
        console.log(`✅ Permission ${permData.name} already exists`);
      } else {
        const newPerm = await prisma.permission.create({
          data: permData
        });
        console.log(`✅ Created permission: ${newPerm.name}`);
      }

      // Check if ADMIN role has this permission
      const hasPermission = adminRole.rolePermissions.some(
        rp => rp.permission.name === permData.name
      );

      if (!hasPermission) {
        // Get the permission ID
        const permission = await prisma.permission.findUnique({
          where: { name: permData.name }
        });

        // Assign permission to ADMIN role
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        });
        console.log(`✅ Assigned ${permData.name} permission to ADMIN role`);
      }
    }

    // Create app settings if they don't exist
    console.log('\n🔍 Creating default app settings if they don\'t exist...');
    const defaultSettings = [
      { key: 'APP_NAME', value: 'ATLAS', description: 'Application name' },
      { key: 'APP_DESCRIPTION', value: 'Advanced Team Learning Assistant System', description: 'Application description' },
      { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY || '', description: 'OpenAI API Key', isEncrypted: true },
      { key: 'DEFAULT_AI_MODEL', value: 'gpt-4o', description: 'Default AI model to use' }
    ];

    for (const setting of defaultSettings) {
      const existingSetting = await prisma.appSetting.findUnique({
        where: { key: setting.key }
      });

      if (existingSetting) {
        console.log(`✅ App setting ${setting.key} already exists`);
      } else {
        const newSetting = await prisma.appSetting.create({
          data: setting
        });
        console.log(`✅ Created app setting: ${newSetting.key}`);
      }
    }

    console.log('\n✅ Permissions and settings setup completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndUpdatePermissions(); 