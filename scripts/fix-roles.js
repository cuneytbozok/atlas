// Script to fix roles in the database
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import and run the migration script
require('../prisma/migrations/cleanup-roles.js'); 