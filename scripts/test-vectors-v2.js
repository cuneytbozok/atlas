// Script to test vector store creation using the vectors=v2 beta flag
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = require('node-fetch');

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
      // For simplicity in this test script, if it's encrypted we'll need to use the main app's services
      console.error('API key is encrypted - use the app UI to test instead');
      return;
    }
    
    console.log('Creating test vector store with vectors=v2 beta flag...');
    const response = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'vectors=v2'
      },
      body: JSON.stringify({
        name: 'Test Vector Store ' + new Date().toISOString()
      })
    });
    
    const responseBody = await response.json();
    
    if (!response.ok) {
      console.error('Failed to create vector store:', JSON.stringify(responseBody, null, 2));
      return;
    }
    
    console.log('Vector store created successfully!');
    console.log('Vector store ID:', responseBody.id);
    console.log('Full response:', JSON.stringify(responseBody, null, 2));
    
    // List all vector stores
    console.log('\nListing all vector stores:');
    const listResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'vectors=v2'
      }
    });
    
    const stores = await listResponse.json();
    
    if (!listResponse.ok) {
      console.error('Failed to list vector stores:', JSON.stringify(stores, null, 2));
      return;
    }
    
    console.log(`Found ${stores.data.length} vector stores`);
    stores.data.forEach(store => {
      console.log(`- ${store.id}: ${store.name}`);
    });
    
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