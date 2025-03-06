import puppeteer from 'puppeteer';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

/**
 * Scrapes the company list from a Charity Navigator filtered page.
 * @param {string} url - The Charity Navigator filtered URL.
 * @returns {Promise<Array>} - List of company detail page links.
 */
async function getCompanyLinks(url) {
  const browser = await puppeteer.launch({ headless: false, slowMo: 50 }); // Slow motion for debugging
  const page = await browser.newPage();

  try {
      console.log(`🔍 Opening page: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      // Wait for a reliable element that always appears when results are loaded
      await page.waitForSelector("a[href*='/company/']", { timeout: 20000 });

      // Extract company links
      const companyLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href*='/company/']")).map(link => link.href);
      });

      console.log(`✅ Found ${companyLinks.length} companies`);
      await browser.close();
      return companyLinks;
  } catch (error) {
      console.error("❌ Error fetching company links:", error);
      await browser.close();
      return [];
  }
}

/**
 * Scrapes company details (name, URL, phone number) from a company detail page.
 * @param {string} url - The company detail page URL.
 * @param {object} browser - Puppeteer browser instance.
 * @returns {Promise<object>} - Extracted company details.
 */
async function scrapeCompanyDetails(url, browser) {
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // Extract company name
        const companyName = await page.evaluate(() => {
            return document.querySelector(".profile-header-title")?.innerText || "Unknown";
        });

        // Extract company website URL
        const companyURL = await page.evaluate(() => {
            return document.querySelector(".visit-website-btn")?.href || "Not Found";
        });

        // Extract phone number
        // const phoneNumber = await page.evaluate(() => {
        //     const text = document.body.innerText;
        //     const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}/;
        //     const match = text.match(phoneRegex);
        //     return match ? match[0] : "Not Found";
        // });

        await page.close();
        // return { companyName, companyURL, phoneNumber };
        return { companyName, companyURL };
    } catch (error) {
        console.error(`Error scraping details from ${url}:`, error);
        await page.close();
        return null;
    }
}

/**
 * Fetches company email using Hunter.io API.
 * @param {string} domain - The company domain.
 * @returns {Promise<string>} - Found email or "Not Found".
 */
async function getCompanyEmail(domain) {
    try {
        const response = await axios.get("https://api.hunter.io/v2/domain-search", {
            params: { domain, api_key: HUNTER_API_KEY },
        });

        if (response.data && response.data.data.emails.length > 0) {
            return response.data.data.emails[0].value; // Get first found email
        }
    } catch (error) {
        console.error(`Error fetching email for ${domain}:`, error);
    }
    return "Not Found";
}

/**
 * Saves scraped data to a CSV file.
 * @param {Array} data - The list of company details.
 */
function saveToCSV(data) {
    const headers = "Company Name,Company URL,Phone Number,Company Email\n";
    const rows = data.map(row => `${row.companyName},${row.companyURL},${row.companyEmail}`).join("\n");

    fs.writeFileSync("charity_companies.csv", headers + rows, "utf8");
    console.log("✅ Data saved to charity_companies.csv");
}

/**
 * Main function to scrape and fetch company data.
 * @param {string} filteredURL - The input filtered Charity Navigator URL.
 */
async function main(filteredURL) {
    console.log("🔍 Fetching company links...");
    const companyLinks = await getCompanyLinks(filteredURL);

    if (companyLinks.length === 0) {
        console.log("No company links found. Check the URL and try again.");
        return;
    }

    console.log(`📋 Found ${companyLinks.length} companies. Scraping details...`);
    const browser = await puppeteer.launch({ headless: true });

    const results = [];
    for (const link of companyLinks) {
      console.log(link)
        const companyData = await scrapeCompanyDetails(link, browser);
        console.log("companyData", companyData)
        if (companyData && companyData.companyURL !== "Not Found") {
          const domain = new URL(companyData.companyURL).hostname;
            // companyData.companyEmail = await getCompanyEmail(domain);
        } else {
            companyData.companyEmail = "Not Found";
        }
        results.push(companyData);
    }

    await browser.close();
    saveToCSV(results);
}

// Example usage
const inputURL = "https://www.goodfirms.co/it-services/ukraine?services%5B18%5D=23"; // Replace with actual filtered URL
main(inputURL);
