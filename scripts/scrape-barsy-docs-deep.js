#!/usr/bin/env node
/**
 * Barsy API Documentation Deep Scraper
 *
 * Recursively crawls all pages in the barsy.api documentation
 * Run with: node scripts/scrape-barsy-docs-deep.js
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  baseUrl: "https://docs.lukanet.com",
  loginUrl: "https://docs.lukanet.com/login.php",
  startUrls: [
    "https://docs.lukanet.com/barsy.api/index.html",
    "https://docs.lukanet.com/barsy.api/methods/index.html",
    "https://docs.lukanet.com/barsy.api/objects/index.html",
  ],
  credentials: {
    email: "janny.stamenov@gmail.com",
    password: "4zW?fgtN",
  },
  outputDir: path.join(__dirname, "..", "docs", "barsy-api"),
  delay: 500,
};

const visitedUrls = new Set();
const allPages = [];

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page) {
  console.log("Navigating to login page...");
  await page.goto(CONFIG.loginUrl, { waitUntil: "networkidle2" });
  await delay(1000);

  const inputs = await page.$$("input");
  let emailInput = null;
  let passwordInput = null;

  for (const input of inputs) {
    const type = await input.evaluate((el) => el.type);
    if (!emailInput && (type === "text" || type === "email")) {
      emailInput = input;
    } else if (!passwordInput && type === "password") {
      passwordInput = input;
    }
  }

  if (!emailInput || !passwordInput) {
    throw new Error("Could not find login form fields");
  }

  await emailInput.click();
  await emailInput.type(CONFIG.credentials.email);
  await passwordInput.click();
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
  console.log("Login completed");
}

async function extractPageData(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (e) {
    console.log(`  Timeout/error loading ${url}`);
    return null;
  }

  const data = await page.evaluate(() => {
    // Get all links for further crawling
    const links = [];
    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.includes("barsy.api") && href.endsWith(".html")) {
        links.push(new URL(href, window.location.href).href);
      }
    });

    // Find main content - Sphinx uses specific structure
    const mainContent =
      document.querySelector('[role="main"]') ||
      document.querySelector(".document") ||
      document.querySelector("main") ||
      document.body;

    // Extract method signature if present
    const methodSig = document.querySelector(".sig, .method-sig, dt.sig");

    // Extract parameters table
    const paramTables = [];
    document.querySelectorAll("table").forEach((table) => {
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          cells.push(cell.textContent.trim().replace(/\s+/g, " "));
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0) paramTables.push(rows);
    });

    // Extract code examples
    const codeExamples = [];
    document.querySelectorAll("pre, .highlight").forEach((pre) => {
      const code = pre.textContent.trim();
      if (code.length > 10) {
        codeExamples.push(code);
      }
    });

    // Extract definition lists (often used for parameters)
    const definitions = [];
    document.querySelectorAll("dl").forEach((dl) => {
      dl.querySelectorAll("dt").forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === "DD") {
          definitions.push({
            term: dt.textContent.trim(),
            definition: dd.textContent.trim(),
          });
        }
      });
    });

    return {
      url: window.location.href,
      title: document.title
        .replace(" — Barsy API Docs 2.0 documentation", "")
        .trim(),
      links: [...new Set(links)],
      methodSignature: methodSig ? methodSig.textContent.trim() : null,
      content: mainContent.innerText.trim(),
      tables: paramTables,
      codeExamples,
      definitions,
    };
  });

  return data;
}

async function crawl(page, url, depth = 0) {
  if (visitedUrls.has(url) || depth > 3) return;
  if (!url.includes("barsy.api")) return;
  if (url.includes("_sources")) return;

  visitedUrls.add(url);

  const indent = "  ".repeat(depth);
  console.log(`${indent}[${visitedUrls.size}] ${url}`);

  const data = await extractPageData(page, url);
  if (!data) return;

  allPages.push(data);

  await delay(CONFIG.delay);

  // Crawl linked pages
  for (const link of data.links) {
    await crawl(page, link, depth + 1);
  }
}

function formatAsMarkdown(pages) {
  // Group pages by category
  const categories = {
    intro: [],
    methods: {},
    objects: [],
    examples: [],
    faq: [],
    other: [],
  };

  for (const page of pages) {
    const url = page.url;
    if (url.includes("/methods/")) {
      // Extract method category
      const match = url.match(/\/methods\/([^/]+)\//);
      const category = match ? match[1] : "general";
      if (!categories.methods[category]) {
        categories.methods[category] = [];
      }
      categories.methods[category].push(page);
    } else if (url.includes("/objects/")) {
      categories.objects.push(page);
    } else if (url.includes("/examples/")) {
      categories.examples.push(page);
    } else if (url.includes("/faq/")) {
      categories.faq.push(page);
    } else if (url.includes("/intro/")) {
      categories.intro.push(page);
    } else {
      categories.other.push(page);
    }
  }

  let md = `# Barsy API Documentation\n\n`;
  md += `> Complete API reference extracted from docs.lukanet.com\n`;
  md += `> Extracted: ${new Date().toISOString()}\n`;
  md += `> Total pages: ${pages.length}\n\n`;
  md += `---\n\n`;

  // Table of contents
  md += `## Table of Contents\n\n`;
  md += `- [Introduction](#introduction)\n`;
  md += `- [Methods](#methods)\n`;
  Object.keys(categories.methods)
    .sort()
    .forEach((cat) => {
      md += `  - [${cat}](#${cat})\n`;
    });
  md += `- [Objects](#objects)\n`;
  md += `- [Examples](#examples)\n`;
  md += `- [FAQ](#faq)\n\n`;
  md += `---\n\n`;

  // Introduction
  if (categories.intro.length > 0 || categories.other.length > 0) {
    md += `## Introduction\n\n`;
    for (const page of [...categories.intro, ...categories.other]) {
      md += formatPage(page);
    }
  }

  // Methods
  md += `## Methods\n\n`;
  const sortedCategories = Object.keys(categories.methods).sort();
  for (const cat of sortedCategories) {
    md += `### ${cat}\n\n`;
    for (const page of categories.methods[cat]) {
      md += formatPage(page);
    }
  }

  // Objects
  if (categories.objects.length > 0) {
    md += `## Objects\n\n`;
    for (const page of categories.objects) {
      md += formatPage(page);
    }
  }

  // Examples
  if (categories.examples.length > 0) {
    md += `## Examples\n\n`;
    for (const page of categories.examples) {
      md += formatPage(page);
    }
  }

  // FAQ
  if (categories.faq.length > 0) {
    md += `## FAQ\n\n`;
    for (const page of categories.faq) {
      md += formatPage(page);
    }
  }

  return md;
}

function formatPage(page) {
  let md = `#### ${page.title}\n\n`;
  md += `**URL:** \`${page.url}\`\n\n`;

  if (page.methodSignature) {
    md += `**Signature:**\n\`\`\`\n${page.methodSignature}\n\`\`\`\n\n`;
  }

  // Add tables (parameters, etc.)
  if (page.tables.length > 0) {
    for (const table of page.tables) {
      if (table.length > 0) {
        const header = table[0];
        md += `| ${header.join(" | ")} |\n`;
        md += `| ${header.map(() => "---").join(" | ")} |\n`;
        for (let i = 1; i < table.length; i++) {
          md += `| ${table[i].join(" | ")} |\n`;
        }
        md += "\n";
      }
    }
  }

  // Add definitions
  if (page.definitions.length > 0) {
    md += `**Parameters/Properties:**\n\n`;
    for (const def of page.definitions) {
      md += `- **${def.term}**: ${def.definition.substring(0, 500)}${
        def.definition.length > 500 ? "..." : ""
      }\n`;
    }
    md += "\n";
  }

  // Add code examples
  if (page.codeExamples.length > 0) {
    md += `**Code Examples:**\n\n`;
    for (const code of page.codeExamples.slice(0, 5)) {
      md += `\`\`\`\n${code.substring(0, 2000)}\n\`\`\`\n\n`;
    }
  }

  // Add content summary (cleaned up)
  const cleanContent = page.content
    .replace(/Луканет Библиотека[\s\S]*?Изход/g, "")
    .replace(/© Copyright[\s\S]*?Read the Docs\./g, "")
    .replace(/Previous\s*Next/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleanContent.length > 100) {
    md += `**Content:**\n\n${cleanContent.substring(0, 3000)}${
      cleanContent.length > 3000 ? "\n\n[Content truncated...]" : ""
    }\n\n`;
  }

  md += `---\n\n`;
  return md;
}

async function main() {
  console.log("Starting deep Barsy API documentation scraper...\n");

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

    // Start crawling from multiple entry points
    for (const startUrl of CONFIG.startUrls) {
      await crawl(page, startUrl, 0);
    }

    console.log(`\nTotal pages scraped: ${allPages.length}`);

    // Save raw JSON
    const jsonPath = path.join(CONFIG.outputDir, "barsy-api-complete.json");
    fs.writeFileSync(jsonPath, JSON.stringify(allPages, null, 2));
    console.log(`Saved raw JSON to: ${jsonPath}`);

    // Save formatted markdown
    const markdown = formatAsMarkdown(allPages);
    const mdPath = path.join(CONFIG.outputDir, "BARSY_API_COMPLETE.md");
    fs.writeFileSync(mdPath, markdown);
    console.log(`Saved formatted markdown to: ${mdPath}`);

    // Also create a quick reference file with just method signatures
    let quickRef = `# Barsy API Quick Reference\n\n`;
    quickRef += `> Method signatures and endpoints\n\n`;

    for (const page of allPages) {
      if (page.methodSignature) {
        quickRef += `## ${page.title}\n`;
        quickRef += `\`\`\`\n${page.methodSignature}\n\`\`\`\n`;
        quickRef += `URL: ${page.url}\n\n`;
      }
    }

    const quickRefPath = path.join(CONFIG.outputDir, "BARSY_API_QUICK_REF.md");
    fs.writeFileSync(quickRefPath, quickRef);
    console.log(`Saved quick reference to: ${quickRefPath}`);

    console.log("\nDone!");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
