#!/usr/bin/env node
/**
 * Barsy API Complete Documentation Scraper
 *
 * Scrapes ALL pages by first collecting all links from index pages,
 * then visiting each one to get complete documentation.
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
  outputDir: path.join(__dirname, "..", "docs", "barsy-api"),
  delay: 300,
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!emailInput && (type === "text" || type === "email"))
      emailInput = input;
    else if (!passwordInput && type === "password") passwordInput = input;
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

  await page
    .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
    .catch(() => {});
  await delay(2000);
  console.log("Logged in successfully");
}

async function collectAllLinks(page) {
  const allLinks = new Set();

  // Start from the main methods index
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
            !href.includes("_sources")
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
      console.log(`  Error: ${e.message}`);
    }
  }

  return [...allLinks];
}

async function scrapePage(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  } catch (e) {
    return null;
  }

  const data = await page.evaluate(() => {
    const main =
      document.querySelector('[role="main"]') ||
      document.querySelector(".document") ||
      document.body;

    // Get method signature
    const sigEl = main.querySelector(
      "dl.py.method dt.sig, dl.method dt, .sig-name"
    );
    const signature = sigEl ? sigEl.textContent.trim() : null;

    // Get description
    const descEl = main.querySelector(
      "dl.py.method dd, dl.method dd, .method-description"
    );
    const description = descEl
      ? descEl.textContent.trim().substring(0, 1000)
      : null;

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

    // Get code examples
    const codeBlocks = [];
    main.querySelectorAll("pre, .highlight").forEach((pre) => {
      const code = pre.textContent.trim();
      if (code.length > 20 && code.length < 5000) {
        codeBlocks.push(code);
      }
    });

    // Get definition lists (parameters)
    const definitions = [];
    main.querySelectorAll("dl.field-list dt, dl.simple dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        definitions.push({
          name: dt.textContent.trim(),
          value: dd.textContent.trim().substring(0, 500),
        });
      }
    });

    // Get full text content (cleaned)
    let fullText = main.innerText;
    // Remove navigation and footer
    fullText = fullText.replace(/Луканет Библиотека[\s\S]*?Изход/g, "");
    fullText = fullText.replace(/© Copyright[\s\S]*?Read the Docs\./g, "");
    fullText = fullText.replace(/Previous\s*Next/g, "");
    fullText = fullText.replace(/\n{3,}/g, "\n\n").trim();

    return {
      url: window.location.href,
      title: document.title
        .replace(" — Barsy API Docs 2.0 documentation", "")
        .trim(),
      signature,
      description,
      tables,
      codeBlocks,
      definitions,
      content: fullText,
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
      if (page.definitions.length > 0) {
        md += `**Parameters:**\n`;
        for (const def of page.definitions) {
          md += `- **${def.name}**: ${def.value}\n`;
        }
        md += "\n";
      }

      // Code examples
      if (page.codeBlocks.length > 0) {
        md += `**Examples:**\n`;
        for (const code of page.codeBlocks.slice(0, 3)) {
          md += `\`\`\`\n${code}\n\`\`\`\n\n`;
        }
      }

      // Full content
      if (page.content && page.content.length > 100) {
        md += `**Full Content:**\n\n${page.content.substring(0, 4000)}\n\n`;
      }

      md += `---\n\n`;
    }
  }

  return md;
}

async function main() {
  console.log("Starting complete Barsy API documentation scraper...\n");

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

    await login(page);

    // Phase 1: Collect all links
    console.log("\n=== Phase 1: Collecting all links ===\n");
    const allLinks = await collectAllLinks(page);
    console.log(`\nFound ${allLinks.length} unique pages to scrape\n`);

    // Phase 2: Scrape each page
    console.log("=== Phase 2: Scraping all pages ===\n");
    const allPages = [];

    for (let i = 0; i < allLinks.length; i++) {
      const url = allLinks[i];
      console.log(`[${i + 1}/${allLinks.length}] ${url}`);

      const data = await scrapePage(page, url);
      if (data) {
        allPages.push(data);
      }

      await delay(CONFIG.delay);
    }

    console.log(`\nSuccessfully scraped ${allPages.length} pages\n`);

    // Save raw JSON
    const jsonPath = path.join(CONFIG.outputDir, "barsy-api-full.json");
    fs.writeFileSync(jsonPath, JSON.stringify(allPages, null, 2));
    console.log(`Saved JSON: ${jsonPath}`);

    // Save markdown
    const markdown = generateMarkdown(allPages);
    const mdPath = path.join(CONFIG.outputDir, "BARSY_API_FULL.md");
    fs.writeFileSync(mdPath, markdown);
    console.log(`Saved Markdown: ${mdPath}`);

    console.log("\nDone!");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
