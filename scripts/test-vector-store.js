// Script to test vector store creation using OpenAI SDK
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const OpenAI = require('openai');

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
    
    // Initialize OpenAI client with API key from settings
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Get available client features
    console.log('OpenAI client properties:', Object.keys(openai));
    
    if (!openai.vectorStores) {
      console.error('ERROR: vectorStores is not available on the OpenAI client');
      console.log('Available properties on client:', Object.keys(openai));
      return;
    }
    
    // Try to create a vector store
    console.log('Creating test vector store...');
    const vectorStore = await openai.vectorStores.create({
      name: 'Test Vector Store ' + new Date().toISOString()
    });
    
    console.log('Vector store created successfully!');
    console.log('Vector store ID:', vectorStore.id);
    console.log('Full response:', JSON.stringify(vectorStore, null, 2));
    
    // Log all vector stores
    console.log('\nListing all vector stores:');
    const stores = await openai.vectorStores.list();
    console.log(`Found ${stores.data.length} vector stores`);
    stores.data.forEach(store => {
      console.log(`- ${store.id}: ${store.name}`);
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
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