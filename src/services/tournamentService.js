// Live API call to fetch tournament details
async function getTournamentById(id) {
  // Try both endpoints - first try screen, then fall back to clock if needed
  const screenUrl = `${API_BASE_URL}/tournaments/${id}/screen`;
  const clockUrl = `${API_BASE_URL}/tournaments/${id}/clock`;
  
  try {
    // First try the screen endpoint
    console.log(`Attempting to fetch from: ${screenUrl}`);
    const screenResponse = await fetch(screenUrl);
    
    if (screenResponse.ok) {
      const screenResult = await screenResponse.json();
      if (screenResult && screenResult.data) {
        console.log('Successfully fetched data from screen endpoint');
        return screenResult.data;
      }
    }
    
    // If we get here, the screen endpoint failed, try the clock endpoint
    console.log('Screen endpoint failed, trying clock endpoint...');
    const clockResponse = await fetch(clockUrl);
    
    if (!clockResponse.ok) {
      let errorDetails = `HTTP error ${clockResponse.status}: ${clockResponse.statusText}`;
      try {
        // Try to parse more detailed error from response body if available
        const errorData = await clockResponse.json();
        if (errorData && errorData.message) {
          errorDetails = `API Error: ${errorData.message}`;
        } else if (typeof errorData === 'string' && errorData.length > 0 && errorData.length < 500) {
          errorDetails = `API Error: ${errorData}`;
        } else {
          // If errorData is not helpful, try getting raw text but limit length
          const rawText = await clockResponse.text();
          errorDetails += `. Response: ${rawText.substring(0, 200)}${rawText.length > 200 ? '...' : ''}`;
        }
      } catch (e) {
        // If parsing fails or body is not JSON, include status text and potentially start of raw body
        try {
          const rawText = await clockResponse.text();
          errorDetails += `. Response: ${rawText.substring(0, 200)}${rawText.length > 200 ? '...' : ''}`;
        } catch (textErr) {
          // Failed to get text body either
        }
      }
      console.error(`Error fetching tournament ${id} from both endpoints: ${errorDetails}`);
      throw new Error(`Failed to fetch tournament data. ${errorDetails}`);
    }
    
    // Process the clock endpoint response
    const clockResult = await clockResponse.json();
    if (clockResult && clockResult.data) {
      console.log('Successfully fetched data from clock endpoint');
      return clockResult.data;
    } else {
      const errorMessage = (clockResult && clockResult.message) ? clockResult.message : 'Malformed API response or no data field.';
      console.error(`API error for tournament ${id}: ${errorMessage}`, clockResult);
      throw new Error(errorMessage);
    }
  } catch (error) {
    // Catches fetch errors (network issues) or errors thrown from above
    console.error(`Network or parsing error when fetching tournament ${id}:`, error.message);
    throw error; // Re-throw to be handled by the Vue component or calling code
  }
}

// API base URLs
const API_HOST = 'https://new.buscoffeeandtea.com.vn';
// const API_HOST = 'http://localhost:8080';

const API_BASE_URL = `${API_HOST}/api/v1`; // Direct API URL for production use

// Named export for getTournamentById
export { getTournamentById };

export default {
  getTournamentById,
  // The following methods relied on mockTournaments and are now commented out.
  // They would need to be updated to work with a live API.
  /*
  getTournamentIds() {
    // Example: This might fetch a list of all tournament IDs from an endpoint like /api/v1/tournaments
    console.warn('getTournamentIds is not implemented for the live API yet.');
    // Return a Promise for consistency if other methods are async
    return Promise.resolve([]); 
  },
  
  getTournamentInfo(id) {
    // Example: This could potentially be derived from the full tournament data fetched by getTournamentById,
    // or it might require its own API endpoint if only partial info is needed for a list.
    console.warn(`getTournamentInfo for id ${id} is not implemented for the live API yet.`);
    // Return a Promise for consistency
    return Promise.resolve(null); 
  }
  */
};
