import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load production environment variables
config({ path: path.join(__dirname, '../.env.production') });

// Import the TicketmasterService
const { TicketmasterService } = await import('./helpers/ticketmaster.ts');

async function testProductionEnvironment() {
  console.log('🧪 Testing with PRODUCTION environment variables...');
  console.log('XMTP_ENV:', process.env.XMTP_ENV);
  console.log('TICKETMASTER_API_KEY:', process.env.TICKETMASTER_API_KEY ? 'SET' : 'NOT SET');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ticketmasterService = new TicketmasterService(process.env.TICKETMASTER_API_KEY, openai);
  
  console.log('\n🔍 Testing Ludacris search...');
  try {
    const result = await ticketmasterService.aiSearch('Ludacris shows in Los Angeles');
    console.log('✅ Search successful!');
    console.log('Events found:', result.events.length);
    console.log('Search params:', result.searchParams);
    console.log('Explanation:', result.explanation);
    
    if (result.events.length > 0) {
      console.log('\n📋 First event:');
      console.log(ticketmasterService.formatEventForDisplay(result.events[0]));
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    console.error('Full error:', error);
  }
  
  console.log('\n🔍 Testing weekend search...');
  try {
    const result = await ticketmasterService.aiSearch('shows in New Orleans this weekend');
    console.log('✅ Search successful!');
    console.log('Events found:', result.events.length);
    console.log('Search params:', result.searchParams);
    console.log('Explanation:', result.explanation);
    
    if (result.events.length > 0) {
      console.log('\n📋 First event:');
      console.log(ticketmasterService.formatEventForDisplay(result.events[0]));
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    console.error('Full error:', error);
  }
}

testProductionEnvironment().catch(console.error); 