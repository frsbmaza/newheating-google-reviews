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
  await page.goto(REVIEWS_URL, { waitUntil: 'networkidle2' });

  // Handle Cookie Consent if it appears
  try {
    const cookieButton = await page.$('button[aria-label="Alles accepteren"], button[aria-label="Accept all"]');
    if (cookieButton) {
      console.log('Clicking cookie consent button...');
      await cookieButton.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('No cookie consent button found.');
  }

  try {
    console.log('Attempting to sort by newest...');
    // Use a more generic way to find the button since text can vary by language
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
      const newestBtn = buttons.find(b => 
        b.innerText.toLowerCase().includes('nieuwste') || 
        b.innerText.toLowerCase().includes('newest')
      );
      if (newestBtn) newestBtn.click();
    });
    
    // Wait for reviews to refresh
    await new Promise(r => setTimeout(r, 3000));
    
    await page.waitForSelector('.gws-localreviews__google-review', { timeout: 15000 });
  } catch (e) {
    console.log('Sort button not found or reviews slow to load, proceeding with current view.');
  }

  console.log('Extracting reviews...');
  const reviews = await page.evaluate(() => {
    // Try multiple selectors for reviews in case of UI changes
    const items = Array.from(document.querySelectorAll('.gws-localreviews__google-review, .jftiS, .WMbnYc'));
    return items.map(el => {
      const author = el.querySelector('.TSUbDb, .d4r55, .XE3o9b')?.innerText || 'Anonymous';
      const ratingText = el.querySelector('.fS74If, .kvS76c, .kvS76c')?.getAttribute('aria-label') || '';
      // Google's aria-label is usually like "Gerecycleerd 5 van de 5" or "5/5"
      const ratingMatch = ratingText.match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
      
      const text = el.querySelector('.Jtu0P, .wiI7pf, .K7oB9b')?.innerText || '';
      const date = el.querySelector('.dehbe, .rsqa9b, .f9S5nd')?.innerText || '';
      const authorImg = el.querySelector('.lSBy9, .NBa79c, .NBa79c')?.getAttribute('src') || '';
      
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
