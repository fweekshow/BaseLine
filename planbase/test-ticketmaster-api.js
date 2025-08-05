import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment from the main project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

async function testTicketmasterAPI() {
  console.log('🧪 Testing Ticketmaster API directly...\n');

  // Test 1: Search for Ludacris attraction
  console.log('1️⃣ Searching for Ludacris attraction...');
  const attractionUrl = `https://app.ticketmaster.com/discovery/v2/attractions.json?apikey=${TICKETMASTER_API_KEY}&keyword=Ludacris&classificationName=Music`;
  console.log(`URL: ${attractionUrl}`);
  
  try {
    const attractionResponse = await fetch(attractionUrl);
    const attractionData = await attractionResponse.json();
    console.log('Attraction Response:', JSON.stringify(attractionData, null, 2));
    
    if (attractionData._embedded?.attractions?.length > 0) {
      const attractionId = attractionData._embedded.attractions[0].id;
      console.log(`✅ Found attraction ID: ${attractionId}`);
      
      // Test 2: Search for Ludacris events in Los Angeles
      console.log('\n2️⃣ Searching for Ludacris events in Los Angeles...');
      const eventsUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&size=10&city=Los%20Angeles&attractionId=${attractionId}&startDateTime=2025-08-07T00%3A00%3A00Z&endDateTime=2025-09-04T00%3A00%3A00Z&sort=date,asc&includeTBA=no&includeTBD=no`;
      console.log(`URL: ${eventsUrl}`);
      
      const eventsResponse = await fetch(eventsUrl);
      const eventsData = await eventsResponse.json();
      console.log('Events Response:', JSON.stringify(eventsData, null, 2));
      
      if (eventsData._embedded?.events?.length > 0) {
        console.log(`✅ Found ${eventsData._embedded.events.length} events`);
        eventsData._embedded.events.forEach((event, index) => {
          console.log(`${index + 1}. ${event.name} - ${event.dates?.start?.localDate} at ${event._embedded?.venues?.[0]?.name || 'Unknown venue'}`);
        });
      } else {
        console.log('❌ No events found');
      }
      
      // Test 3: Search for Ludacris events nationwide (no city filter)
      console.log('\n3️⃣ Searching for Ludacris events nationwide...');
      const nationwideUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&size=10&attractionId=${attractionId}&startDateTime=2025-08-07T00%3A00%3A00Z&endDateTime=2025-09-04T00%3A00%3A00Z&sort=date,asc&includeTBA=no&includeTBD=no`;
      console.log(`URL: ${nationwideUrl}`);
      
      const nationwideResponse = await fetch(nationwideUrl);
      const nationwideData = await nationwideResponse.json();
      console.log('Nationwide Response:', JSON.stringify(nationwideData, null, 2));
      
      if (nationwideData._embedded?.events?.length > 0) {
        console.log(`✅ Found ${nationwideData._embedded.events.length} events nationwide`);
        nationwideData._embedded.events.forEach((event, index) => {
          console.log(`${index + 1}. ${event.name} - ${event.dates?.start?.localDate} at ${event._embedded?.venues?.[0]?.name || 'Unknown venue'} in ${event._embedded?.venues?.[0]?.city?.name || 'Unknown city'}`);
        });
      } else {
        console.log('❌ No events found nationwide');
      }
      
    } else {
      console.log('❌ No attractions found for Ludacris');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testTicketmasterAPI(); 