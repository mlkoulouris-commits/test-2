#!/usr/bin/env node
/**
 * Barsy API Documentation Scraper
 *
 * This script logs into docs.lukanet.com and extracts all Barsy API documentation
 * Run with: node scripts/scrape-barsy-docs.js
 *
 * Prerequisites: npm install puppeteer
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  baseUrl: "https://docs.lukanet.com",
  loginUrl: "https://docs.lukanet.com/login.php",
  apiDocsUrl: "https://docs.lukanet.com/barsy.api/methods/index.html",
  credentials: {
    email: "janny.stamenov@gmail.com",
    password: "4zW?fgtN",
  },
  outputDir: path.join(__dirname, "..", "docs", "barsy-api"),
  delay: 1000, // ms between requests to be polite
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page) {
  console.log("Navigating to login page...");
  await page.goto(CONFIG.loginUrl, { waitUntil: "networkidle2" });

  // Find and fill login form
  console.log("Filling login credentials...");

  // Wait for form to be ready
  await delay(1000);

  // Get all input fields on the page
  const inputs = await page.$$("input");
  console.log(`Found ${inputs.length} input fields`);

  // The form has Email and Парола (Password) fields
  // Find inputs by their position - first text/email input, then password input
  let emailInput = null;
  let passwordInput = null;

  for (const input of inputs) {
    const type = await input.evaluate((el) => el.type);
    const name = await input.evaluate((el) => el.name);
    console.log(`  Input: type=${type}, name=${name}`);

    if (!emailInput && (type === "text" || type === "email")) {
      emailInput = input;
    } else if (!passwordInput && type === "password") {
      passwordInput = input;
    }
  }

  if (!emailInput || !passwordInput) {
    // Take screenshot for debugging
    await page.screenshot({ path: "login-page-debug.png" });
    throw new Error(
      "Could not find login form fields. Screenshot saved to login-page-debug.png"
    );
  }

  console.log("Typing credentials...");
  await emailInput.click();
  await emailInput.type(CONFIG.credentials.email);
  await passwordInput.click();
  await passwordInput.type(CONFIG.credentials.password);

  // Find and click submit button - look for button with text "Вход"
  const buttons = await page.$$("button");
  let submitButton = null;
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.textContent.trim());
    if (text === "Вход" || text.toLowerCase().includes("login")) {
      submitButton = btn;
      break;
    }
  }

  if (submitButton) {
    console.log("Clicking login button...");
    await submitButton.click();
  } else {
    console.log("No button found, pressing Enter...");
    await passwordInput.press("Enter");
  }

  await page
    .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
    .catch(() => {});
  await delay(2000);

  // Take screenshot to verify login
  await page.screenshot({ path: "after-login.png" });
  console.log("Login completed - screenshot saved to after-login.png");
}

async function extractMethodsList(page) {
  console.log("Extracting methods list...");
  await page.goto(CONFIG.apiDocsUrl, { waitUntil: "networkidle2" });

  // Extract all method links from the page
  const methods = await page.evaluate(() => {
    const links = [];
    // Look for links in the sidebar or main content
    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && (href.includes("/methods/") || href.includes(".html"))) {
        links.push({
          name: a.textContent.trim(),
          url: a.href,
        });
      }
    });
    return links;
  });

  // Also get the page content structure
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      html: document.body.innerHTML,
      text: document.body.innerText,
    };
  });

  return { methods, pageContent };
}

async function extractPageContent(page, url) {
  await page.goto(url, { waitUntil: "networkidle2" });

  const content = await page.evaluate(() => {
    // Try to find main content area
    const mainContent = document.querySelector(
      "main, article, .content, .documentation, #content, .main-content"
    );
    const target = mainContent || document.body;

    // Extract structured content
    const result = {
      title: document.title,
      url: window.location.href,
      headings: [],
      sections: [],
      codeBlocks: [],
      tables: [],
      rawText: target.innerText,
      rawHtml: target.innerHTML,
    };

    // Extract headings
    target.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      result.headings.push({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim(),
      });
    });

    // Extract code blocks
    target.querySelectorAll("pre, code").forEach((code) => {
      result.codeBlocks.push(code.textContent.trim());
    });

    // Extract tables
    target.querySelectorAll("table").forEach((table) => {
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          cells.push(cell.textContent.trim());
        });
        rows.push(cells);
      });
      result.tables.push(rows);
    });

    return result;
  });

  return content;
}

async function scrapeAllDocs(page) {
  const allDocs = {
    extractedAt: new Date().toISOString(),
    baseUrl: CONFIG.baseUrl,
    pages: [],
  };

  // First, get the main methods index
  const { methods, pageContent } = await extractMethodsList(page);

  allDocs.pages.push({
    type: "index",
    url: CONFIG.apiDocsUrl,
    content: pageContent,
  });

  console.log(`Found ${methods.length} potential method links`);

  // Filter to unique URLs within the barsy.api domain
  const uniqueUrls = [
    ...new Set(
      methods.filter((m) => m.url.includes("barsy.api")).map((m) => m.url)
    ),
  ];

  console.log(`Scraping ${uniqueUrls.length} unique pages...`);

  // Scrape each page
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    console.log(`[${i + 1}/${uniqueUrls.length}] Scraping: ${url}`);

    try {
      const content = await extractPageContent(page, url);
      allDocs.pages.push({
        type: "method",
        url,
        content,
      });
    } catch (err) {
      console.error(`  Error scraping ${url}: ${err.message}`);
    }

    await delay(CONFIG.delay);
  }

  return allDocs;
}

function formatForLLM(docs) {
  let markdown = `# Barsy API Documentation\n\n`;
  markdown += `> Extracted on: ${docs.extractedAt}\n`;
  markdown += `> Source: ${docs.baseUrl}\n\n`;
  markdown += `---\n\n`;

  for (const page of docs.pages) {
    if (page.type === "index") {
      markdown += `## Methods Index\n\n`;
      markdown += `${page.content.text}\n\n`;
    } else {
      markdown += `## ${page.content.title || page.url}\n\n`;
      markdown += `**URL:** ${page.url}\n\n`;

      if (page.content.headings.length > 0) {
        markdown += `### Structure\n`;
        for (const h of page.content.headings) {
          markdown += `${"  ".repeat(h.level - 1)}- ${h.text}\n`;
        }
        markdown += "\n";
      }

      if (page.content.codeBlocks.length > 0) {
        markdown += `### Code Examples\n`;
        for (const code of page.content.codeBlocks) {
          markdown += "```\n" + code + "\n```\n\n";
        }
      }

      if (page.content.tables.length > 0) {
        markdown += `### Tables\n`;
        for (const table of page.content.tables) {
          if (table.length > 0) {
            // Create markdown table
            const header = table[0];
            markdown += "| " + header.join(" | ") + " |\n";
            markdown += "| " + header.map(() => "---").join(" | ") + " |\n";
            for (let i = 1; i < table.length; i++) {
              markdown += "| " + table[i].join(" | ") + " |\n";
            }
            markdown += "\n";
          }
        }
      }

      markdown += `### Content\n${page.content.rawText}\n\n`;
      markdown += `---\n\n`;
    }
  }

  return markdown;
}

async function main() {
  console.log("Starting Barsy API documentation scraper...\n");

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login
    await login(page);

    // Scrape all documentation
    const docs = await scrapeAllDocs(page);

    // Save raw JSON
    const jsonPath = path.join(CONFIG.outputDir, "barsy-api-raw.json");
    fs.writeFileSync(jsonPath, JSON.stringify(docs, null, 2));
    console.log(`\nSaved raw JSON to: ${jsonPath}`);

    // Save formatted markdown
    const markdown = formatForLLM(docs);
    const mdPath = path.join(CONFIG.outputDir, "BARSY_API_REFERENCE.md");
    fs.writeFileSync(mdPath, markdown);
    console.log(`Saved formatted markdown to: ${mdPath}`);

    console.log("\nDone!");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
