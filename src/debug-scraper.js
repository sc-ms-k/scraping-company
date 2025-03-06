import puppeteer from 'puppeteer';
import axios from 'axios';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Initialize Google Sheets API
async function initGoogleSheets() {
  try {
    console.log('Initializing Google Sheets API...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('Getting auth client...');
    const client = await auth.getClient();
    console.log('Auth client obtained successfully');
    
    const sheets = google.sheets({ version: 'v4', auth: client });
    console.log('Google Sheets API initialized successfully');
    
    return sheets;
  } catch (error) {
    console.error('Error initializing Google Sheets API:', error);
    throw error;
  }
}

// Get or create sheet for a specific state
async function getOrCreateStateSheet(sheets, state) {
  try {
    console.log(`Checking if sheet exists for state: ${state}`);
    
    // Check if the sheet already exists
    const response = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
    });

    const sheetExists = response.data.sheets.some(
      (sheet) => sheet.properties.title === state
    );

    if (!sheetExists) {
      console.log(`Sheet for state ${state} does not exist. Creating new sheet...`);
      
      // Create a new sheet for the state
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: state,
                },
              },
            },
          ],
        },
      });
      console.log(`Sheet for state ${state} created successfully`);

      // Add headers to the new sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${state}!A1:E1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Charity Name', 'Address', 'Website', 'Email', 'State']],
        },
      });
      console.log(`Headers added to sheet for state ${state}`);
    } else {
      console.log(`Sheet for state ${state} already exists`);
    }

    return state;
  } catch (error) {
    console.error(`Error creating sheet for state ${state}:`, error);
    throw error;
  }
}

// Save test data to Google Sheets
async function saveTestDataToGoogleSheets() {
  try {
    console.log('Starting test to save data to Google Sheets...');
    
    const sheets = await initGoogleSheets();
    
    // Test data for different states
    const testData = [
      { name: 'Test Charity 1', address: '123 Main St, New York, NY 10001', website: 'https://testcharity1.org', email: 'info@testcharity1.org', state: 'NY' },
      { name: 'Test Charity 2', address: '456 Oak Ave, Los Angeles, CA 90001', website: 'https://testcharity2.org', email: 'info@testcharity2.org', state: 'CA' },
      { name: 'Test Charity 3', address: '789 Pine Rd, Chicago, IL 60601', website: 'https://testcharity3.org', email: 'info@testcharity3.org', state: 'IL' }
    ];
    
    // Group test data by state
    const dataByState = {};
    for (const charity of testData) {
      if (!dataByState[charity.state]) {
        dataByState[charity.state] = [];
      }
      dataByState[charity.state].push(charity);
    }
    
    // Save each state's data to its own sheet
    for (const [state, stateCharities] of Object.entries(dataByState)) {
      console.log(`Processing ${stateCharities.length} charities for state ${state}`);
      
      // Get or create sheet for this state
      const sheetName = await getOrCreateStateSheet(sheets, state);
      
      // Get current row count to know where to append
      console.log(`Getting current row count for sheet ${sheetName}`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!A:A`,
      });
      
      const rowCount = response.data.values ? response.data.values.length : 1;
      console.log(`Current row count for sheet ${sheetName}: ${rowCount}`);
      
      // Prepare data for Google Sheets
      const values = stateCharities.map(charity => [
        charity.name,
        charity.address,
        charity.website,
        charity.email || '',
        charity.state,
      ]);
      
      console.log(`Updating sheet ${sheetName} starting at row ${rowCount + 1}`);
      console.log('Data to be written:', values);
      
      // Append data to the sheet
      const updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!A${rowCount + 1}`,
        valueInputOption: 'RAW',
        resource: { values },
      });
      
      console.log(`Update response:`, updateResponse.data);
      console.log(`Saved ${values.length} charities to sheet "${sheetName}"`);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
    
    if (error.response) {
      console.error('API Error Details:');
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error('Error Data:', error.response.data);
    }
  }
}

// Main function
async function main() {
  try {
    await saveTestDataToGoogleSheets();
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the main function
main();