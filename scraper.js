const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const REVIEWS_URL = 'https://www.google.com/search?q=New+Heating+Waalwijk+reviews&hl=nl#lrd=0x47c69197577fdafb:0xe8605f2e2ceab65c,1';

async function scrape() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to Google Reviews...');
  // Updated URL to explicitly request newest first via sorting parameters if possible, 
  // but we will also click the button to be sure.
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2' });

  try {
    // Try to find and click the "Nieuwste" (Newest) button if not already selected
    const newestButtonSelector = 'div[role="button"]:contains("Nieuwste"), [data-sort-id="newestFirst"]';
    // Use a more generic way to find the button since text can vary by language
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      const newestBtn = buttons.find(b => b.innerText.includes('Nieuwste') || b.innerText.includes('Newest'));
      if (newestBtn) newestBtn.click();
    });
    
    // Wait for reviews to refresh
    await new Promise(r => setTimeout(r, 2000));
    
    await page.waitForSelector('.gws-localreviews__google-review', { timeout: 15000 });
  } catch (e) {
    console.log('Sort button not found or reviews slow to load, proceeding with current view.');
  }

  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.gws-localreviews__google-review'));
    return items.map(el => {
      const author = el.querySelector('.TSUbDb')?.innerText || 'Anonymous';
      const ratingText = el.querySelector('.fS74If')?.getAttribute('aria-label') || '';
      // Google's aria-label is usually like "Gerecycleerd 5 van de 5" or "5/5"
      const ratingMatch = ratingText.match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
      
      const text = el.querySelector('.Jtu0P')?.innerText || '';
      const date = el.querySelector('.dehbe')?.innerText || '';
      const authorImg = el.querySelector('.lSBy9')?.getAttribute('src') || '';
      
      return { author, rating, text, date, authorImg };
    });
  });

  // Filter for 4 and 5 star reviews ONLY
  const filteredReviews = reviews
    .filter(r => r.rating >= 4)
    .slice(0, 24);

  console.log(`Successfully extracted ${filteredReviews.length} reviews (4+ stars).`);

  const outputPath = path.join(__dirname, 'public', 'reviews.json');
  fs.writeFileSync(outputPath, JSON.stringify(filteredReviews, null, 2));
  console.log('Saved to public/reviews.json');

  await browser.close();
}

scrape().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
