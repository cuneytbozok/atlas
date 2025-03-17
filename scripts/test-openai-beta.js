// Script to test various OpenAI beta flags
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = require('node-fetch');

// List of beta flags to try
const betaFlags = [
  '',                // No beta flag
  'assistants=v1',   // Known working assistants flag
  'vector-stores=v1',
  'vector_stores=v1',
  'vectorstores=v1',
  'vectors=v1',
  'vectors=v2',
  'vector=v1'
];

async function testBetaFlag(apiKey, flag) {
  console.log(`\n🔍 Testing beta flag: ${flag || '(none)'}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  if (flag) {
    headers['OpenAI-Beta'] = flag;
  }
  
  try {
    // Just try to list vector stores (read-only operation)
    const response = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'GET',
      headers
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS with flag "${flag}"`);
      console.log(`Found ${result.data?.length || 0} vector stores`);
      return true;
    } else {
      console.log(`❌ FAILED with flag "${flag}": ${result.error?.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`💥 ERROR with flag "${flag}": ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    // Get the API key from our database SettingsService
    const apiKeySetting = await prisma.appSetting.findUnique({
      where: { key: 'openai.api.key' }
    });
    
    if (!apiKeySetting || !apiKeySetting.value) {
      console.error('OpenAI API key not found in database settings');
      return;
    }
    
    // Decrypt the API key if it's encrypted
    let apiKey = apiKeySetting.value;
    if (apiKeySetting.isEncrypted) {
      console.error('API key is encrypted - use the app UI to test instead');
      return;
    }
    
    console.log('🚀 Starting OpenAI Beta flag test');
    
    // Test each beta flag
    const results = {};
    for (const flag of betaFlags) {
      results[flag || '(none)'] = await testBetaFlag(apiKey, flag);
    }
    
    // Print summary
    console.log('\n📊 Results Summary:');
    Object.entries(results).forEach(([flag, success]) => {
      console.log(`${success ? '✅' : '❌'} ${flag}`);
    });
    
    const workingFlags = Object.entries(results)
      .filter(([_, success]) => success)
      .map(([flag]) => flag);
    
    if (workingFlags.length > 0) {
      console.log('\n✨ Working beta flags:');
      workingFlags.forEach(flag => console.log(`- ${flag}`));
    } else {
      console.log('\n⚠️ No working beta flags found');
    }
    
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main()
  .then(() => console.log('Test completed'))
  .catch(e => {
    console.error('Unhandled error:', e);
    return prisma.$disconnect().then(() => process.exit(1));
  }); 