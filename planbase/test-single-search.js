import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { TicketmasterService } from './helpers/ticketmaster.ts';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

if (!OPENAI_API_KEY || !TICKETMASTER_API_KEY) {
  console.error('Missing required environment variables: OPENAI_API_KEY, TICKETMASTER_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const ticketmasterService = new TicketmasterService(TICKETMASTER_API_KEY, openai);

async function testSingleSearch() {
  console.log('🧪 Testing single AI-powered Ticketmaster search...\n');

  const query = 'Find rock concerts in Los Angeles';
  console.log(`🔍 Testing query: "${query}"`);
  
  try {
    const result = await ticketmasterService.aiSearch(query);
    
    console.log(`✅ Search parameters:`, result.searchParams);
    console.log(`📊 Found ${result.events.length} events`);
    console.log(`💬 Explanation: ${result.explanation}`);
    
    if (result.events.length > 0) {
      console.log(`🎫 Sample events:`);
      result.events.slice(0, 3).forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.name} at ${event._embedded?.venues?.[0]?.name || 'TBD'}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Error testing query "${query}":`, error.message);
  }
}

testSingleSearch().catch(console.error); 