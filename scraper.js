const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const REVIEWS_URL = 'https://www.google.com/maps/place/New+Heating/@51.68817,5.06817,17z/data=!4m8!3m7!1s0x47c69197577fdafb:0xe8605f2e2ceab65c!8m2!3d51.68817!4d5.06817!9m1!1b1!16s%2Fg%2F11l5clprrs?hl=nl';

async function scrape() {
  console.log('Launching stealth browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  
  // Set a realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Navigating to Google Maps Reviews...');
  try {
    await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('Initial navigation timeout, retrying...');
    await page.goto(REVIEWS_URL, { waitUntil: 'domcontentloaded' });
  }

  // Handle Cookie Consent if it appears
  try {
    const cookieButton = await page.waitForSelector('button[aria-label="Alles accepteren"], button[aria-label="Accept all"]', { timeout: 5000 });
    if (cookieButton) {
      console.log('Clicking cookie consent button...');
      await cookieButton.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('No cookie consent button found.');
  }

  // Wait for the reviews list to be visible
  console.log('Waiting for reviews list...');
  try {
    await page.waitForSelector('.jftiS, .WMbnYc, .m6U6Mc', { timeout: 15000 });
  } catch (e) {
    console.log('Standard review selectors not found, taking screenshot for debug.');
    await page.screenshot({ path: 'debug_view.png' });
    console.log('Page Title at failure:', await page.title());
  }

  console.log('Extracting reviews...');
  const data = await page.evaluate(() => {
    // Selectors for Google Maps layout
    const items = Array.from(document.querySelectorAll('.jftiS, .WMbnYc, .m6U6Mc, [data-review-id]'));
    
    const extracted = items.map(el => {
      const author = el.querySelector('.d4r55, .TSUbDb, .XE3o9b')?.innerText || 'Anonymous';
      
      // Rating extraction from stars
      const stars = el.querySelector('.kvS76c, .fS74If')?.getAttribute('aria-label') || '';
      const rating = parseInt(stars.match(/\d+/) || '5');
      
      const text = el.querySelector('.wiI7pf, .Jtu0P, .K7oB9b')?.innerText || '';
      const date = el.querySelector('.rsqa9b, .dehbe, .f9S5nd')?.innerText || '';
      const authorImg = el.querySelector('.NBa79c, .lSBy9')?.getAttribute('src') || '';
      
      return { author, rating, text, date, authorImg };
    });

    return { 
      extracted, 
      pageTitle: document.title,
      itemCount: items.length
    };
  });

  console.log('Page Title:', data.pageTitle);
  console.log('Total items found:', data.itemCount);

  // Filter for 4 and 5 star reviews
  const filteredReviews = data.extracted
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
