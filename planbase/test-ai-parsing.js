import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing required environment variables: OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function testAIParsing() {
  console.log('🧪 Testing AI parsing...\n');

  const testQueries = [
    'Ludacris show in Los Angeles',
    'Upcoming Ludacris shows in LA',
    'Rock shows in Los Angeles',
    'this weekend in Los Angeles'
  ];

  for (const query of testQueries) {
    console.log(`🔍 Testing query: "${query}"`);
    
    try {
      const prompt = `Parse this event search query and extract search parameters. Return ONLY a valid JSON object with these fields:
- city: the city mentioned (or use "undefined" if no city mentioned)
- artist: any artist, band, or performer name mentioned (e.g., "Ludacris", "Taylor Swift", "The Weeknd"). If someone asks for "Ludacris show", the artist is "Ludacris".
- genre: music genre or event type (rock, jazz, pop, country, hip hop, rap, indie, folk, electronic, dance, comedy, theater, sports, etc.)
- dateRange: object with startDate and endDate in ISO format. Use CURRENT DATES:
  * "this weekend" = current Friday to Sunday
  * "next week" = next Monday to Sunday  
  * "next month" = next month's first day to last day
  * If no date mentioned, use next 30 days from today
- keywords: array of other relevant search terms

IMPORTANT: Use CURRENT dates (2025), NOT past dates (2023). Today is ${new Date().toISOString().split('T')[0]}.
IMPORTANT: If an artist name is mentioned, extract it exactly as written.
IMPORTANT: For queries like "Ludacris show in Los Angeles", the artist should be "Ludacris".

Query: "${query}"

Return ONLY the JSON object, no markdown formatting, no code blocks, no additional text.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      console.log(`🤖 AI Response: ${response}`);
      
      try {
        const parsed = JSON.parse(response);
        console.log(`✅ Parsed:`, parsed);
      } catch (parseError) {
        console.log(`❌ Parse error:`, parseError.message);
      }
      
      console.log('---\n');
    } catch (error) {
      console.error(`❌ Error testing query "${query}":`, error.message);
    }
  }
}

testAIParsing().catch(console.error); 