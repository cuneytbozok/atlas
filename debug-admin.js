// Script to check and recreate admin user
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

/**
 * Debug Admin User Script
 * 
 * HOW TO USE:
 * 1. From the container: docker-compose exec atlas-app node /app/debug-admin.js
 * 2. From host: node debug-admin.js (if you have the right node environment set up)
 * 
 * This script provides detailed diagnostics about admin user setup and will:
 * - Check database connection
 * - Verify the ADMIN role exists (creates it if missing)
 * - Check for admin user with email admin@atlas.com (creates if missing)
 * - Reset admin password to "password" 
 * - Ensure proper role assignment
 * - List all users and roles for verification
 */

async function debugAdminUser() {
  try {
    console.log('\n=== ATLAS ADMIN USER DIAGNOSTIC TOOL ===\n');
    console.log('🔍 Checking database connection...');
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
    } catch (dbError) {
      console.error('❌ Database connection failed!');
      console.error('Error details:', dbError.message);
      console.log('\n🔧 Possible solutions:');
      console.log('1. Check if your DATABASE_URL is correctly set');
      console.log('2. Verify that the database is running and accessible');
      console.log('3. Ensure PostgreSQL service is healthy');
      throw new Error('Database connection failed, cannot proceed');
    }

    console.log('\n🔍 Checking for ADMIN role...');
    let adminRole = await prisma.role.findFirst({ 
      where: { name: 'ADMIN' } 
    });
    
    if (adminRole) {
      console.log(`✅ ADMIN role found: ${adminRole.id}`);
    } else {
      console.log('❌ ADMIN role not found');
      console.log('Creating ADMIN role...');
      adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Administrator with full access to all features'
        }
      });
      console.log(`✅ ADMIN role created: ${adminRole.id}`);
    }

    console.log('\n🔍 Checking for admin user...');
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@atlas.com' },
      include: { userRoles: true }
    });

    if (adminUser) {
      console.log(`✅ Admin user found: ${adminUser.id}`);
      console.log(`Email: ${adminUser.email}`);
      console.log(`Has ${adminUser.userRoles.length} roles assigned`);
      
      if (adminUser.userRoles.length === 0) {
        console.log('❌ Admin user has no roles! Assigning ADMIN role...');
        await prisma.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: adminRole.id
          }
        });
        console.log('✅ ADMIN role assigned to user');
      } else {
        // Check if admin has the ADMIN role specifically
        const hasAdminRole = adminUser.userRoles.some(
          async (ur) => {
            const role = await prisma.role.findUnique({ where: { id: ur.roleId } });
            return role && role.name === 'ADMIN';
          }
        );
        
        if (!hasAdminRole) {
          console.log('❌ Admin user does not have the ADMIN role! Assigning it...');
          await prisma.userRole.create({
            data: {
              userId: adminUser.id,
              roleId: adminRole.id
            }
          });
          console.log('✅ ADMIN role assigned to user');
        } else {
          console.log('✅ Admin user has the ADMIN role properly assigned');
        }
      }
      
      // Reset password for admin user
      console.log('\n🔄 Resetting password for admin user...');
      const hashedPassword = await bcrypt.hash('password', 12);
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: hashedPassword }
      });
      console.log('✅ Password reset to "password"');
      
    } else {
      console.log('❌ Admin user not found');
      console.log('Creating admin user...');
      
      const hashedPassword = await bcrypt.hash('password', 12);
      const newAdminUser = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@atlas.com',
          password: hashedPassword
        }
      });
      
      console.log(`✅ Admin user created: ${newAdminUser.id}`);
      
      // Assign admin role to new user
      await prisma.userRole.create({
        data: {
          userId: newAdminUser.id,
          roleId: adminRole.id
        }
      });
      console.log('✅ ADMIN role assigned to new user');
    }
    
    // Check permissions
    console.log('\n🔍 Checking essential permissions...');
    const essentialPermissions = [
      { name: 'MANAGE_APP_SETTINGS', description: 'Permission to manage application settings' },
      { name: 'VIEW_APP_SETTINGS', description: 'Permission to view application settings' },
      { name: 'USE_AI', description: 'Permission to use AI features' }
    ];
    
    for (const permDef of essentialPermissions) {
      let permission = await prisma.permission.findFirst({ 
        where: { name: permDef.name }
      });
      
      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            name: permDef.name,
            description: permDef.description
          }
        });
        console.log(`Created permission: ${permDef.name}`);
      }
      
      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      });
      
      if (!rolePermission) {
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        });
        console.log(`Assigned permission to ADMIN role: ${permDef.name}`);
      }
    }
    
    console.log('\n🔍 Listing all users in database:');
    const allUsers = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });
    
    if (allUsers.length === 0) {
      console.log('❌ No users found in the database!');
    } else {
      allUsers.forEach(user => {
        console.log(`User: ${user.name} (${user.email})`);
        console.log(`Roles: ${user.userRoles.map(ur => ur.role?.name).join(', ') || 'None'}`);
        console.log('---');
      });
    }
    
    console.log('\n✅ Debug process completed');
    console.log('\n📝 Login credentials:');
    console.log('Email: admin@atlas.com');
    console.log('Password: password');
    console.log('\n🔐 IMPORTANT: Change this password after login for security!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAdminUser()
  .then(() => {
    console.log('\n✨ Admin diagnostic completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error during diagnosis:', error);
    console.log('\nTroubleshooting steps:');
    console.log('1. Check your DATABASE_URL environment variable');
    console.log('2. Verify database is running properly');
    console.log('3. Try running the script from within the Docker container:');
    console.log('   docker-compose exec atlas-app node /app/debug-admin.js');
    process.exit(1);
  }); 