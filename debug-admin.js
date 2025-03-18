// Script to check and recreate admin user
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function debugAdminUser() {
  try {
    console.log('🔍 Checking database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

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
    
    allUsers.forEach(user => {
      console.log(`User: ${user.name} (${user.email})`);
      console.log(`Roles: ${user.userRoles.map(ur => ur.role?.name).join(', ') || 'None'}`);
      console.log('---');
    });
    
    console.log('\n✅ Debug process completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAdminUser(); 