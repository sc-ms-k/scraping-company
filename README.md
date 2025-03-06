# Charity Navigator Scraper

This application scrapes charity data from Charity Navigator, retrieves email addresses using Hunter.io API, and stores the data in Google Sheets.

## Features

- Scrapes charity information from Charity Navigator search results
- Extracts charity name, address, and website
- Uses Hunter.io API to find email addresses from website domains
- Organizes data by US state in separate Google Sheets tabs
- Processes charities in batches of 1000
- Sorts charities alphabetically (A-Z)
- Provides a user interface to control the scraping process

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Make sure the `.env` file contains:
   ```
   GOOGLE_SHEET_ID=your_google_sheet_id
   HUNTER_API_KEY=your_hunter_api_key
   ```
4. Ensure `credentials.json` contains your Google Service Account credentials

## Usage

### Running the Scraper

To run the scraper directly:

```
npm run start
```

This will start the scraping process and prompt you to continue after each batch of 1000 charities.

### Using the Web Interface

To use the web interface:

```
npm run dev
```

Then open the provided URL in your browser to access the control panel.

## How It Works

1. The scraper visits Charity Navigator search results pages
2. For each charity, it:
   - Extracts the charity name
   - Visits the charity's profile page
   - Extracts the address and website
   - Determines the US state from the address
   - Uses Hunter.io to find an email address from the website domain
3. Charities are sorted alphabetically and grouped by state
4. Data is saved to Google Sheets with separate tabs for each state

## Technologies Used

- Node.js
- Puppeteer (for web scraping)
- Google Sheets API
- Hunter.io API
- React (for the web interface)
- Tailwind CSS (for styling)