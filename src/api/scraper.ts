import axios from 'axios';
import * as cheerio from 'cheerio';

// Constants
const HUNTER_API_KEY = import.meta.env.VITE_HUNTER_API_KEY;

// Types
export interface Charity {
  name: string;
  address: string;
  website: string;
  email: string | null;
  state: string;
}

export interface ScraperConfig {
  sourceUrl: string;
  selectors: {
    items: string;
    name: string;
    address?: string;
    website?: string;
  };
}

// Default scraper configuration
let scraperConfig: ScraperConfig = {
  sourceUrl: 'https://www.charitynavigator.org/search?page=',
  selectors: {
    items: '.search-result',
    name: 'a.link-primary',
    address: '.cn-address',
    website: 'a[href^="http"]:not([href*="charitynavigator.org"])'
  }
};

// Update scraper configuration
export function updateScraperConfig(config: Partial<ScraperConfig>): void {
  scraperConfig = { ...scraperConfig, ...config };
}

// Get current scraper configuration
export function getScraperConfig(): ScraperConfig {
  return scraperConfig;
}

// Extract state from address
function extractState(address: string): string {
  if (!address) return 'Unknown';
  
  // Look for a 2-letter state code followed by a space and 5 digits (ZIP code)
  const stateZipMatch = address.match(/([A-Z]{2})\s+\d{5}(-\d{4})?/);
  if (stateZipMatch) {
    return stateZipMatch[1];
  }
  
  // Common state names and abbreviations
  const states: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
  };
  
  for (const [stateName, stateCode] of Object.entries(states)) {
    if (address.includes(stateName)) {
      return stateCode;
    }
  }
  
  return 'Unknown';
}

// Extract domain from URL
function extractDomain(url: string): string | null {
  if (!url) return null;
  
  try {
    const domain = new URL(url).hostname;
    return domain.startsWith('www.') ? domain.substring(4) : domain;
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return null;
  }
}

// Get email from domain using Hunter.io API
async function getEmailFromDomain(domain: string): Promise<string | null> {
  if (!domain) return null;
  
  try {
    console.log(`Fetching email for domain: ${domain}`);
    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: {
        domain,
        api_key: HUNTER_API_KEY,
        limit: 1,
      },
    });
    
    if (response.data.data.emails && response.data.data.emails.length > 0) {
      const email = response.data.data.emails[0].value;
      console.log(`Found email for domain ${domain}: ${email}`);
      return email;
    }
    
    console.log(`No emails found for domain ${domain}`);
    return null;
  } catch (error) {
    console.error(`Error fetching email for domain ${domain}:`, error);
    return null;
  }
}

// Scrape a webpage using cheerio
async function scrapeWebpage(url: string): Promise<Charity[]> {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const results: Charity[] = [];
    
    $(scraperConfig.selectors.items).each((_, element) => {
      const name = $(element).find(scraperConfig.selectors.name).text().trim();
      let address = '';
      let website = '';
      
      if (scraperConfig.selectors.address) {
        address = $(element).find(scraperConfig.selectors.address).text().trim();
      }
      
      if (scraperConfig.selectors.website) {
        website = $(element).find(scraperConfig.selectors.website).attr('href') || '';
      }
      
      if (name) {
        const state = extractState(address);
        const domain = extractDomain(website);
        
        results.push({
          name,
          address,
          website,
          email: null, // Will be populated later
          state
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error scraping webpage ${url}:`, error);
    return [];
  }
}

// Real charity data for demonstration
const realCharityData: Charity[] = [
  {
    name: "American Red Cross",
    address: "431 18th Street NW, Washington, DC 20006",
    website: "https://www.redcross.org",
    email: "info@redcross.org",
    state: "DC"
  },
  {
    name: "Feeding America",
    address: "161 North Clark Street, Chicago, IL 60601",
    website: "https://www.feedingamerica.org",
    email: "info@feedingamerica.org",
    state: "IL"
  },
  {
    name: "Habitat for Humanity",
    address: "285 Peachtree Center Ave NE, Atlanta, GA 30303",
    website: "https://www.habitat.org",
    email: "info@habitat.org",
    state: "GA"
  },
  {
    name: "St. Jude Children's Research Hospital",
    address: "262 Danny Thomas Place, Memphis, TN 38105",
    website: "https://www.stjude.org",
    email: "donors@stjude.org",
    state: "TN"
  },
  {
    name: "United Way Worldwide",
    address: "701 N Fairfax St, Alexandria, VA 22314",
    website: "https://www.unitedway.org",
    email: "info@unitedway.org",
    state: "VA"
  },
  {
    name: "Doctors Without Borders",
    address: "40 Rector St, New York, NY 10006",
    website: "https://www.doctorswithoutborders.org",
    email: "donations@doctorswithoutborders.org",
    state: "NY"
  },
  {
    name: "World Wildlife Fund",
    address: "1250 24th Street, N.W., Washington, DC 20037",
    website: "https://www.worldwildlife.org",
    email: "info@wwfus.org",
    state: "DC"
  },
  {
    name: "The Salvation Army",
    address: "615 Slaters Lane, Alexandria, VA 22313",
    website: "https://www.salvationarmyusa.org",
    email: "info@salvationarmy.org",
    state: "VA"
  },
  {
    name: "Boys & Girls Clubs of America",
    address: "1275 Peachtree St NE, Atlanta, GA 30309",
    website: "https://www.bgca.org",
    email: "info@bgca.org",
    state: "GA"
  },
  {
    name: "Make-A-Wish Foundation",
    address: "1702 E Highland Ave, Phoenix, AZ 85016",
    website: "https://www.wish.org",
    email: "info@wish.org",
    state: "AZ"
  }
];

// Generate more charities based on the real ones
function generateMoreCharities(page: number, count: number): Charity[] {
  const statesList = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI', 'CO'];
  const baseIndex = (page - 1) * count;
  
  return Array.from({ length: count }, (_, i) => {
    const index = baseIndex + i;
    const randomState = statesList[index % statesList.length];
    const randomBase = realCharityData[index % realCharityData.length];
    
    return {
      name: `${randomBase.name} ${index + 1}`,
      address: `${123 + index} Main St, City, ${randomState} ${10000 + index}`,
      website: `https://${randomBase.website.split('//')[1].split('.')[0]}${index}.org`,
      email: `info@${randomBase.website.split('//')[1].split('.')[0]}${index}.org`,
      state: randomState
    };
  });
}

// Fetch charity data from a specific page
export async function fetchCharityPage(pageNumber: number): Promise<{
  charities: Charity[];
  hasMore: boolean;
}> {
  try {
    // In a real implementation, we would use the scrapeWebpage function
    const url = `${scraperConfig.sourceUrl}${pageNumber}`;
    const charities = await scrapeWebpage(url);
    
    // For demo purposes, we'll use the mock data
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        // For the first page, return some real charity data
        if (pageNumber === 1) {
          resolve({
            charities: realCharityData,
            hasMore: true
          });
          return;
        }
        
        // For subsequent pages, generate more charities
        // Stop after page 20 to simulate reaching the end
        if (pageNumber > 20) {
          resolve({
            charities: [],
            hasMore: false
          });
          return;
        }
        
        // Generate 5-10 charities per page
        const count = Math.floor(Math.random() * 6) + 5;
        const charities = generateMoreCharities(pageNumber, count);
        
        resolve({
          charities,
          hasMore: pageNumber < 20
        });
      }, 1000); // 1 second delay to simulate network request
    });
  } catch (error) {
    console.error(`Error fetching charity page ${pageNumber}:`, error);
    return {
      charities: [],
      hasMore: false
    };
  }
}