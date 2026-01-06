#!/usr/bin/env node
/**
 * Barsy API Documentation Scraper - Improved Version
 *
 * Improvements over original:
 * 1. Captures raw HTML for each page (for verification)
 * 2. No code block size limits
 * 3. Better content extraction for integration pages
 * 4. Retry logic for failed pages
 * 5. Incremental save (resume on failure)
 * 6. Extracts admonitions (Warning, Note, Important, Attention)
 * 7. Better handling of nested content
 *
 * Run with: node scripts/scrape-docs.js
 * Prerequisites: npm install puppeteer
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  baseUrl: "https://docs.lukanet.com",
  loginUrl: "https://docs.lukanet.com/login.php",
  credentials: {
    email: "janny.stamenov@gmail.com",
    password: "4zW?fgtN",
  },
  outputDir: path.join(__dirname, "..", "..", "barsy", "data"),
  delay: 400,
  retryAttempts: 3,
  retryDelay: 2000,
};

// Progress tracking for resume capability
let progress = {
  visitedUrls: new Set(),
  failedUrls: [],
  pages: [],
};

const progressFile = path.join(CONFIG.outputDir, "scrape-progress.json");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(progressFile)) {
      const data = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
      progress.visitedUrls = new Set(data.visitedUrls || []);
      progress.failedUrls = data.failedUrls || [];
      progress.pages = data.pages || [];
      console.log(`Resuming from previous progress: ${progress.pages.length} pages already scraped`);
      return true;
    }
  } catch (e) {
    console.log("No previous progress found, starting fresh");
  }
  return false;
}

function saveProgress() {
  const data = {
    visitedUrls: [...progress.visitedUrls],
    failedUrls: progress.failedUrls,
    pages: progress.pages,
    lastSaved: new Date().toISOString(),
  };
  fs.writeFileSync(progressFile, JSON.stringify(data, null, 2));
}

async function login(page) {
  console.log("Logging in...");
  await page.goto(CONFIG.loginUrl, { waitUntil: "networkidle2" });
  await delay(1000);

  const inputs = await page.$$("input");
  let emailInput = null,
    passwordInput = null;

  for (const input of inputs) {
    const type = await input.evaluate((el) => el.type);
    if (!emailInput && (type === "text" || type === "email")) emailInput = input;
    else if (!passwordInput && type === "password") passwordInput = input;
  }

  if (!emailInput || !passwordInput) {
    throw new Error("Could not find login form fields");
  }

  await emailInput.type(CONFIG.credentials.email);
  await passwordInput.type(CONFIG.credentials.password);

  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await btn.evaluate((el) => el.textContent.trim());
    if (text === "Вход") {
      await btn.click();
      break;
    }
  }

  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
  await delay(2000);
  console.log("Logged in successfully");
}

async function collectAllLinks(page) {
  const allLinks = new Set();

  // Start from multiple entry points to ensure complete coverage
  const startPages = [
    "https://docs.lukanet.com/barsy.api/index.html",
    "https://docs.lukanet.com/barsy.api/methods/index.html",
    "https://docs.lukanet.com/barsy.api/objects/index.html",
    "https://docs.lukanet.com/barsy.api/examples/index.html",
    "https://docs.lukanet.com/barsy.api/faq/index.html",
    "https://docs.lukanet.com/barsy.api/intro/index.html",
    "https://docs.lukanet.com/barsy.api/integrations/index.html",
    "https://docs.lukanet.com/barsy.api/usage/index.html",
    "https://docs.lukanet.com/barsy.api/sparams/index.html",
    "https://docs.lukanet.com/barsy.api/helpme/index.html",
  ];

  const visited = new Set();
  const toVisit = [...startPages];

  while (toVisit.length > 0) {
    const url = toVisit.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`Collecting links from: ${url}`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

      const links = await page.evaluate(() => {
        const found = [];
        document.querySelectorAll("a").forEach((a) => {
          const href = a.href;
          if (
            href &&
            href.includes("barsy.api") &&
            href.endsWith(".html") &&
            !href.includes("_sources") &&
            !href.includes("#")
          ) {
            found.push(href);
          }
        });
        return found;
      });

      for (const link of links) {
        allLinks.add(link);
        // Add index pages to visit for more link discovery
        if (link.endsWith("index.html") && !visited.has(link)) {
          toVisit.push(link);
        }
      }

      await delay(200);
    } catch (e) {
      console.log(`  Error collecting links: ${e.message}`);
    }
  }

  return [...allLinks];
}

async function scrapePageWithRetry(page, url, attempt = 1) {
  try {
    return await scrapePage(page, url);
  } catch (e) {
    if (attempt < CONFIG.retryAttempts) {
      console.log(`  Retry ${attempt + 1}/${CONFIG.retryAttempts} for ${url}`);
      await delay(CONFIG.retryDelay);
      return scrapePageWithRetry(page, url, attempt + 1);
    }
    console.log(`  Failed after ${CONFIG.retryAttempts} attempts: ${url}`);
    return null;
  }
}

async function scrapePage(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  const data = await page.evaluate(() => {
    const main =
      document.querySelector('[role="main"]') ||
      document.querySelector(".document") ||
      document.body;

    // Capture raw HTML for verification
    const rawHtml = main.innerHTML;

    // Get method signature - try multiple selectors
    const sigSelectors = [
      "dl.py.method dt.sig",
      "dl.method dt",
      ".sig-name",
      ".sig",
      "dl.py dt.sig",
    ];
    let signature = null;
    for (const sel of sigSelectors) {
      const sigEl = main.querySelector(sel);
      if (sigEl) {
        signature = sigEl.textContent.trim();
        break;
      }
    }

    // Get description
    const descEl = main.querySelector("dl.py.method dd, dl.method dd, .method-description");
    const description = descEl ? descEl.textContent.trim() : null;

    // Get all tables (parameters, returns, etc.)
    const tables = [];
    main.querySelectorAll("table").forEach((table) => {
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          cells.push(cell.textContent.trim().replace(/\s+/g, " "));
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0) tables.push(rows);
    });

    // Get code examples - NO SIZE LIMIT
    const codeBlocks = [];
    main.querySelectorAll("pre, .highlight").forEach((pre) => {
      const code = pre.textContent.trim();
      if (code.length > 10) {
        // Detect language from class
        let language = "text";
        const classes = pre.className || "";
        if (classes.includes("php") || code.includes("<?php")) language = "php";
        else if (classes.includes("json") || code.startsWith("{") || code.startsWith("[")) language = "json";
        else if (classes.includes("javascript") || classes.includes("js")) language = "javascript";
        else if (classes.includes("bash") || classes.includes("shell")) language = "bash";
        else if (classes.includes("python")) language = "python";

        codeBlocks.push({ code, language });
      }
    });

    // Get definition lists (parameters)
    const definitions = [];
    main.querySelectorAll("dl.field-list dt, dl.simple dt, dl dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        definitions.push({
          name: dt.textContent.trim(),
          value: dd.textContent.trim(),
        });
      }
    });

    // Extract admonitions (Warning, Note, Important, Attention)
    const admonitions = [];
    main.querySelectorAll(".admonition, .warning, .note, .important, .attention, .hint, .tip").forEach((adm) => {
      const titleEl = adm.querySelector(".admonition-title, p:first-child strong");
      const contentEl = adm.querySelector("p:not(:first-child)") || adm;
      admonitions.push({
        type: titleEl ? titleEl.textContent.trim().toLowerCase() : "note",
        content: contentEl ? contentEl.textContent.trim() : adm.textContent.trim(),
      });
    });

    // Get full text content (cleaned)
    let fullText = main.innerText;
    // Remove navigation and footer artifacts
    fullText = fullText.replace(/Луканет Библиотека[\s\S]*?Изход/g, "");
    fullText = fullText.replace(/© Copyright[\s\S]*?Read the Docs\./g, "");
    fullText = fullText.replace(/Previous\s*Next/g, "");
    fullText = fullText.replace(/\n{3,}/g, "\n\n").trim();

    // Get breadcrumbs/navigation path
    const breadcrumbs = [];
    document.querySelectorAll(".breadcrumb li, .wy-breadcrumbs li, nav.wy-nav-top a").forEach((li) => {
      const text = li.textContent.trim();
      if (text && text !== "»" && text !== "/") {
        breadcrumbs.push(text);
      }
    });

    // Get section links (for index pages)
    const sectionLinks = [];
    main.querySelectorAll(".toctree-wrapper a, .toctree a, .contents a").forEach((a) => {
      sectionLinks.push({
        title: a.textContent.trim(),
        href: a.href,
      });
    });

    return {
      url: window.location.href,
      title: document.title.replace(" — Barsy API Docs 2.0 documentation", "").trim(),
      signature,
      description,
      tables,
      codeBlocks,
      definitions,
      admonitions,
      breadcrumbs,
      sectionLinks,
      content: fullText,
      rawHtml,
      scrapedAt: new Date().toISOString(),
    };
  });

  return data;
}

function generateMarkdown(pages) {
  // Organize pages by category
  const categories = {};

  for (const page of pages) {
    if (!page) continue;

    let category = "other";
    const url = page.url;

    if (url.includes("/methods/")) {
      const match = url.match(/\/methods\/([^/]+)\//);
      category = match ? `methods/${match[1]}` : "methods/general";
    } else if (url.includes("/objects/")) {
      category = "objects";
    } else if (url.includes("/examples/")) {
      category = "examples";
    } else if (url.includes("/faq/")) {
      category = "faq";
    } else if (url.includes("/intro/")) {
      category = "intro";
    } else if (url.includes("/integrations/")) {
      category = "integrations";
    } else if (url.includes("/usage/")) {
      category = "usage";
    } else if (url.includes("/sparams/")) {
      category = "sparams";
    } else if (url.includes("/helpme/")) {
      category = "helpme";
    }

    if (!categories[category]) categories[category] = [];
    categories[category].push(page);
  }

  let md = `# Barsy API Complete Documentation\n\n`;
  md += `> Extracted: ${new Date().toISOString()}\n`;
  md += `> Total pages: ${pages.filter((p) => p).length}\n\n`;

  // Table of contents
  md += `## Table of Contents\n\n`;
  const sortedCats = Object.keys(categories).sort();
  for (const cat of sortedCats) {
    md += `- [${cat}](#${cat.replace(/\//g, "-")})\n`;
  }
  md += `\n---\n\n`;

  // Content by category
  for (const cat of sortedCats) {
    md += `## ${cat}\n\n`;

    for (const page of categories[cat]) {
      md += `### ${page.title}\n\n`;
      md += `**URL:** \`${page.url}\`\n\n`;

      if (page.signature) {
        md += `**Method Signature:**\n\`\`\`\n${page.signature}\n\`\`\`\n\n`;
      }

      if (page.description) {
        md += `**Description:** ${page.description}\n\n`;
      }

      // Admonitions
      for (const adm of page.admonitions || []) {
        md += `> **${adm.type.toUpperCase()}:** ${adm.content}\n\n`;
      }

      // Tables
      for (const table of page.tables) {
        if (table.length > 0) {
          md += `| ${table[0].join(" | ")} |\n`;
          md += `| ${table[0].map(() => "---").join(" | ")} |\n`;
          for (let i = 1; i < table.length; i++) {
            md += `| ${table[i].join(" | ")} |\n`;
          }
          md += "\n";
        }
      }

      // Definitions
      if (page.definitions && page.definitions.length > 0) {
        md += `**Parameters:**\n`;
        for (const def of page.definitions) {
          md += `- **${def.name}**: ${def.value}\n`;
        }
        md += "\n";
      }

      // Code examples
      if (page.codeBlocks && page.codeBlocks.length > 0) {
        md += `**Examples:**\n`;
        for (const block of page.codeBlocks) {
          const lang = typeof block === "object" ? block.language : "text";
          const code = typeof block === "object" ? block.code : block;
          md += `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
        }
      }

      // Full content
      if (page.content && page.content.length > 100) {
        md += `**Full Content:**\n\n${page.content}\n\n`;
      }

      md += `---\n\n`;
    }
  }

  return md;
}

async function main() {
  console.log("Starting improved Barsy API documentation scraper...\n");

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Check for previous progress
  const hasProgress = loadProgress();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await login(page);

    // Phase 1: Collect all links
    console.log("\n=== Phase 1: Collecting all links ===\n");
    const allLinks = await collectAllLinks(page);
    console.log(`\nFound ${allLinks.length} unique pages to scrape\n`);

    // Filter out already visited pages if resuming
    const linksToScrape = allLinks.filter((url) => !progress.visitedUrls.has(url));
    console.log(`Pages to scrape (excluding already visited): ${linksToScrape.length}\n`);

    // Phase 2: Scrape each page
    console.log("=== Phase 2: Scraping all pages ===\n");

    for (let i = 0; i < linksToScrape.length; i++) {
      const url = linksToScrape[i];
      const totalProgress = progress.pages.length + 1;
      console.log(`[${totalProgress}/${allLinks.length}] ${url}`);

      const data = await scrapePageWithRetry(page, url);
      if (data) {
        progress.pages.push(data);
        progress.visitedUrls.add(url);
      } else {
        progress.failedUrls.push(url);
      }

      // Save progress every 10 pages
      if ((i + 1) % 10 === 0) {
        saveProgress();
        console.log(`  [Progress saved: ${progress.pages.length} pages]`);
      }

      await delay(CONFIG.delay);
    }

    console.log(`\nSuccessfully scraped ${progress.pages.length} pages\n`);
    if (progress.failedUrls.length > 0) {
      console.log(`Failed pages: ${progress.failedUrls.length}`);
      progress.failedUrls.forEach((url) => console.log(`  - ${url}`));
    }

    // Save final results
    const jsonPath = path.join(CONFIG.outputDir, "barsy-api-full.json");
    fs.writeFileSync(jsonPath, JSON.stringify(progress.pages, null, 2));
    console.log(`\nSaved JSON: ${jsonPath}`);

    // Save raw HTML separately (large file)
    const rawData = progress.pages.map((p) => ({
      url: p.url,
      title: p.title,
      rawHtml: p.rawHtml,
    }));
    const rawPath = path.join(CONFIG.outputDir, "barsy-api-raw.json");
    fs.writeFileSync(rawPath, JSON.stringify(rawData, null, 2));
    console.log(`Saved raw HTML: ${rawPath}`);

    // Save markdown
    const markdown = generateMarkdown(progress.pages);
    const mdPath = path.join(CONFIG.outputDir, "BARSY_API_FULL.md");
    fs.writeFileSync(mdPath, markdown);
    console.log(`Saved Markdown: ${mdPath}`);

    // Clean up progress file on success
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
    }

    // Print summary
    console.log("\n=== SUMMARY ===");
    console.log(`Total pages scraped: ${progress.pages.length}`);
    console.log(`Pages with tables: ${progress.pages.filter((p) => p.tables && p.tables.length > 0).length}`);
    console.log(`Pages with code: ${progress.pages.filter((p) => p.codeBlocks && p.codeBlocks.length > 0).length}`);
    console.log(`Pages with admonitions: ${progress.pages.filter((p) => p.admonitions && p.admonitions.length > 0).length}`);
    console.log(`Failed pages: ${progress.failedUrls.length}`);

    console.log("\nDone!");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
