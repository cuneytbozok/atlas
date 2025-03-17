// Migration script to clean up roles
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting role cleanup migration...');

  try {
    // 1. Find the lowercase roles that need to be removed
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    const memberRole = await prisma.role.findUnique({ where: { name: 'member' } });
    
    // 2. Find the uppercase roles that will replace them
    const ADMIN_ROLE = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const USER_ROLE = await prisma.role.findUnique({ where: { name: 'USER' } });
    
    if (!ADMIN_ROLE || !USER_ROLE) {
      console.error('Required uppercase roles not found. Please run the seed script first.');
      return;
    }

    // 3. Update project members using lowercase roles to use uppercase roles
    if (adminRole) {
      console.log(`Migrating project members from 'admin' to 'ADMIN' role...`);
      const adminMembers = await prisma.projectMember.findMany({
        where: { roleId: adminRole.id }
      });
      
      console.log(`Found ${adminMembers.length} project members with 'admin' role`);
      
      for (const member of adminMembers) {
        await prisma.projectMember.update({
          where: { id: member.id },
          data: { roleId: ADMIN_ROLE.id }
        });
      }
    }
    
    if (memberRole) {
      console.log(`Migrating project members from 'member' to 'USER' role...`);
      const memberMembers = await prisma.projectMember.findMany({
        where: { roleId: memberRole.id }
      });
      
      console.log(`Found ${memberMembers.length} project members with 'member' role`);
      
      for (const member of memberMembers) {
        await prisma.projectMember.update({
          where: { id: member.id },
          data: { roleId: USER_ROLE.id }
        });
      }
    }

    // 4. Delete the lowercase roles
    if (adminRole) {
      console.log(`Deleting 'admin' role...`);
      // Check if there are any remaining references to this role
      const remainingAdminMembers = await prisma.projectMember.count({
        where: { roleId: adminRole.id }
      });
      
      if (remainingAdminMembers > 0) {
        console.log(`Cannot delete 'admin' role: still used by ${remainingAdminMembers} project members`);
      } else {
        // Also check for any user roles using this role
        const userRoles = await prisma.userRole.findMany({
          where: { roleId: adminRole.id }
        });
        
        // Delete any user roles using this role
        if (userRoles.length > 0) {
          console.log(`Updating ${userRoles.length} user roles from 'admin' to 'ADMIN'...`);
          for (const userRole of userRoles) {
            await prisma.userRole.update({
              where: { id: userRole.id },
              data: { roleId: ADMIN_ROLE.id }
            });
          }
        }
        
        // Now we can safely delete the role
        await prisma.role.delete({ where: { id: adminRole.id } });
        console.log(`'admin' role deleted successfully`);
      }
    }
    
    if (memberRole) {
      console.log(`Deleting 'member' role...`);
      // Check if there are any remaining references to this role
      const remainingMemberMembers = await prisma.projectMember.count({
        where: { roleId: memberRole.id }
      });
      
      if (remainingMemberMembers > 0) {
        console.log(`Cannot delete 'member' role: still used by ${remainingMemberMembers} project members`);
      } else {
        // Also check for any user roles using this role
        const userRoles = await prisma.userRole.findMany({
          where: { roleId: memberRole.id }
        });
        
        // Delete any user roles using this role
        if (userRoles.length > 0) {
          console.log(`Updating ${userRoles.length} user roles from 'member' to 'USER'...`);
          for (const userRole of userRoles) {
            await prisma.userRole.update({
              where: { id: userRole.id },
              data: { roleId: USER_ROLE.id }
            });
          }
        }
        
        // Now we can safely delete the role
        await prisma.role.delete({ where: { id: memberRole.id } });
        console.log(`'member' role deleted successfully`);
      }
    }

    console.log('Role cleanup migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 