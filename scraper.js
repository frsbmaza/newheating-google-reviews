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
  
  // Set a realistic viewport
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to Google Reviews...');
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2' });

  // Wait for the reviews container
  try {
    await page.waitForSelector('.gws-localreviews__google-review', { timeout: 10000 });
  } catch (e) {
    console.error('Reviews selector not found. Google might have changed the layout or blocked the request.');
    await page.screenshot({ path: 'error.png' });
    await browser.close();
    process.exit(1);
  }

  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.gws-localreviews__google-review'));
    return items.slice(0, 24).map(el => {
      const author = el.querySelector('.TSUbDb')?.innerText || 'Anonymous';
      const ratingText = el.querySelector('.fS74If')?.getAttribute('aria-label') || '';
      const rating = parseInt(ratingText.match(/\d+/) || '5');
      const text = el.querySelector('.Jtu0P')?.innerText || '';
      const date = el.querySelector('.dehbe')?.innerText || '';
      const authorImg = el.querySelector('.lSBy9')?.getAttribute('src') || '';
      
      return { author, rating, text, date, authorImg };
    });
  });

  console.log(`Successfully extracted ${reviews.length} reviews.`);

  const outputPath = path.join(__dirname, 'public', 'reviews.json');
  
  // Ensure public directory exists
  if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'));
  }

  fs.writeFileSync(outputPath, JSON.stringify(reviews, null, 2));
  console.log('Saved to public/reviews.json');

  await browser.close();
}

scrape().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
