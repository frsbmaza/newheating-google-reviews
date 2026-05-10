const axios = require('axios');
const fs = require('fs');
const path = require('path');

// SerpApi Configuration
const API_KEY = process.env.SERP_API_KEY;
const DATA_ID = '0x47c69197577fdafb:0xe8605f2e2ceab65c';

async function scrape() {
  console.log('Fetching reviews via SerpApi...');
  
  try {
    const url = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${DATA_ID}&sort_by=newestFirst&api_key=${API_KEY}&hl=nl`;
    
    const response = await axios.get(url);
    const reviewsRaw = response.data.reviews || [];
    
    console.log(`Found ${reviewsRaw.length} reviews at SerpApi.`);

    const extracted = reviewsRaw.map(r => ({
      author: r.user.name,
      rating: r.rating,
      text: r.snippet || '',
      date: r.date,
      authorImg: r.user.thumbnail || ''
    }));

    // Filter for 4 and 5 star reviews
    const finalReviews = extracted
      .filter(r => r.rating >= 4)
      .slice(0, 24);

    console.log(`Final count: ${finalReviews.length} reviews (4+ stars).`);

    const outputPath = path.join(__dirname, 'public', 'reviews.json');
    
    // Ensure public directory exists
    if (!fs.existsSync(path.join(__dirname, 'public'))) {
      fs.mkdirSync(path.join(__dirname, 'public'));
    }

    fs.writeFileSync(outputPath, JSON.stringify(finalReviews, null, 2));
    console.log('Saved to public/reviews.json');

  } catch (error) {
    console.error('Scrape failed:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

scrape();
