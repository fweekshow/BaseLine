const TICKETMASTER_API_KEY = 'pwVOubncyA3A5fYKSNBPAsPxyaP0gC4G';

async function testTicketmasterAPI() {
  console.log('Testing Ticketmaster API with updated parameters...');
  
  try {
    // Test with Detroit (which was causing the 400 error)
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&size=5&city=Detroit&sort=date,asc&includeTBA=no&includeTBD=no`;
    
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Success! Found events:', data._embedded?.events?.length || 0);
    
    if (data._embedded?.events) {
      data._embedded.events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name} - ${event.dates.start.localDate}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing Ticketmaster API:', error);
  }
}

testTicketmasterAPI(); 