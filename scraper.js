const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Different URLs to try if one is blocked or fails
const URLS = [
  'https://www.google.com/maps/place/New+Heating/@51.68817,5.06817,17z/data=!4m8!3m7!1s0x47c69197577fdafb:0xe8605f2e2ceab65c!8m2!3d51.68817!4d5.06817!9m1!1b1!16s%2Fg%2F11l5clprrs?hl=nl',
  'https://www.google.com/search?q=New+Heating+Waalwijk+reviews&hl=nl&tbm=lcl',
  'https://www.google.com/search?q=New+Heating+Waalwijk+reviews&hl=nl#lrd=0x47c69197577fdafb:0xe8605f2e2ceab65c,1'
];

async function scrape() {
  console.log('Launching stealth browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=nl-NL']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  let allExtracted = [];

  for (const url of URLS) {
    if (allExtracted.length >= 5) break; // If we found some, we are good

    console.log(`Trying URL: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      
      // Handle Cookie Consent
      try {
        const cookieBtn = await page.waitForSelector('button[aria-label="Alles accepteren"], button[aria-label="Accept all"], .VfPpkd-LgbsSe', { timeout: 5000 });
        if (cookieBtn) {
          await cookieBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {}

      // Scroll to load reviews
      await page.evaluate(async () => {
        const scrollable = document.querySelector('.m6U6Mc, .review-dialog-list') || window;
        for (let i = 0; i < 3; i++) {
          if (scrollable === window) window.scrollBy(0, 500);
          else scrollable.scrollBy(0, 500);
          await new Promise(r => setTimeout(r, 1000));
        }
      });

      const extracted = await page.evaluate(() => {
        // Broad range of selectors for different Google layouts
        const items = Array.from(document.querySelectorAll('.jftiS, .WMbnYc, .m6U6Mc, .gws-localreviews__google-review, [data-review-id]'));
        
        return items.map(el => {
          const author = el.querySelector('.d4r55, .TSUbDb, .XE3o9b, .Y07Vn')?.innerText || 'Anonymous';
          const stars = el.querySelector('.kvS76c, .fS74If, .P96M6b')?.getAttribute('aria-label') || '';
          const rating = parseInt(stars.match(/\d+/) || '5');
          const text = el.querySelector('.wiI7pf, .Jtu0P, .K7oB9b, .rsqa9b')?.innerText || '';
          const date = el.querySelector('.rsqa9b, .dehbe, .f9S5nd')?.innerText || '';
          const authorImg = el.querySelector('.NBa79c, .lSBy9, .vG6uEc')?.getAttribute('src') || '';
          
          return { author, rating, text, date, authorImg };
        });
      });

      console.log(`Found ${extracted.length} items at this URL.`);
      allExtracted = [...allExtracted, ...extracted];
    } catch (err) {
      console.log(`Error at this URL: ${err.message}`);
    }
  }

  // Deduplicate by author and text
  const uniqueReviews = [];
  const seen = new Set();
  for (const r of allExtracted) {
    const id = `${r.author}-${r.text.substring(0, 20)}`;
    if (!seen.has(id) && r.text.length > 5) {
      uniqueReviews.push(r);
      seen.add(id);
    }
  }

  // Filter for 4 and 5 star reviews
  const finalReviews = uniqueReviews
    .filter(r => r.rating >= 4)
    .slice(0, 24);

  console.log(`Final count: ${finalReviews.length} reviews (4+ stars).`);

  const outputPath = path.join(__dirname, 'public', 'reviews.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalReviews, null, 2));
  console.log('Saved to public/reviews.json');

  await browser.close();
}

scrape().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
