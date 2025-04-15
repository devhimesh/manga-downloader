// api/index.js
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    console.log(`Fetching manga from: ${url}`);
    
    // Make request to MangaToon with appropriate headers
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://mangatoon.mobi/'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract manga title
    const title = $('.title-text').text().trim() || 'Unknown Manga';
    const chapterTitle = $('.episode-title').text().trim() || 'Unknown Chapter';
    
    // Extract images from the chapter
    const images = [];
    $('.pictures img').each((index, element) => {
      const src = $(element).attr('src');
      if (src) {
        images.push({
          index: index + 1,
          url: src
        });
      }
    });

    // Check if we found any images
    if (images.length === 0) {
      console.log('Trying alternative image extraction method...');
      // Try alternative image extraction method
      $('.viewer-container img').each((index, element) => {
        const src = $(element).attr('src') || $(element).attr('data-src');
        if (src) {
          images.push({
            index: index + 1,
            url: src
          });
        }
      });
    }

    // If still no images, try script tags that might contain image data
    if (images.length === 0) {
      console.log('Trying to extract images from script tags...');
      const scriptContent = $('script').map((i, el) => $(el).html()).get().join('');
      
      // Look for image URLs in script content
      const imgRegex = /"(https:\/\/[^"]*\/comics\/[^"]*\.(jpg|png|webp))"/g;
      let match;
      let index = 1;
      
      while ((match = imgRegex.exec(scriptContent)) !== null) {
        images.push({
          index: index++,
          url: match[1]
        });
      }
    }

    console.log(`Found ${images.length} images`);

    return res.json({
      success: true,
      title,
      chapterTitle,
      images,
      totalImages: images.length
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching manga', 
      error: error.message 
    });
  }
};
