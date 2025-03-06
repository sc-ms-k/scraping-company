import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google Sheet ID from environment variables
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function testGoogleSheetsConnection() {
  try {
    console.log('Testing Google Sheets API connection...');
    console.log(`Using Sheet ID: ${GOOGLE_SHEET_ID}`);
    
    // Initialize auth with service account
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    console.log('Authenticating with service account...');
    const client = await auth.getClient();
    console.log('Authentication successful!');
    
    // Initialize sheets API
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Test 1: Get spreadsheet info
    console.log('\nTest 1: Retrieving spreadsheet information...');
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
    });
    
    console.log('✅ Successfully retrieved spreadsheet information:');
    console.log(`Title: ${spreadsheetInfo.data.properties.title}`);
    console.log(`Sheets: ${spreadsheetInfo.data.sheets.map(s => s.properties.title).join(', ')}`);
    
    // Test 2: Create a test sheet
    console.log('\nTest 2: Creating a test sheet...');
    const testSheetName = `Test_${new Date().getTime()}`;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: testSheetName,
              },
            },
          },
        ],
      },
    });
    
    console.log(`✅ Successfully created test sheet: ${testSheetName}`);
    
    // Test 3: Write data to the test sheet
    console.log('\nTest 3: Writing data to test sheet...');
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${testSheetName}!A1:C2`,
      valueInputOption: 'RAW',
      resource: {
        values: [
          ['Test Column 1', 'Test Column 2', 'Test Column 3'],
          ['Test Value 1', 'Test Value 2', 'Test Value 3'],
        ],
      },
    });
    
    console.log('✅ Successfully wrote data to test sheet');
    
    // Test 4: Read data from the test sheet
    console.log('\nTest 4: Reading data from test sheet...');
    
    const readResult = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${testSheetName}!A1:C2`,
    });
    
    console.log('✅ Successfully read data from test sheet:');
    console.log(readResult.data.values);
    
    console.log('\n✅ All tests passed! Google Sheets API connection is working correctly.');
    console.log('You can check the test sheet in your Google Sheets document.');
    
  } catch (error) {
    console.error('❌ Error testing Google Sheets connection:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nAPI Error Details:');
      console.error(`Status: ${error.response.status}`);
      console.error(`Status Text: ${error.response.statusText}`);
      console.error('Error Data:', error.response.data);
      
      if (error.response.status === 403) {
        console.error('\nPermission Error: The service account does not have permission to access this spreadsheet.');
        console.error('Make sure you have shared the spreadsheet with the service account email:');
        
        try {
          const credentialsPath = path.join(__dirname, '../credentials.json');
          const credentials = require(credentialsPath);
          console.error(`Service Account Email: ${credentials.client_email}`);
          console.error('\nPlease share your Google Sheet with this email address with Editor permissions.');
        } catch (e) {
          console.error('Could not read service account email from credentials file.');
        }
      }
    }
  }
}

// Run the test
testGoogleSheetsConnection();