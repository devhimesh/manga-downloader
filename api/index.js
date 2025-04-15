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
        'Referer': 'https://mangatoon.mobi/',
        'Cookie': 'locale=en'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: function (status) {
        return status < 500; // Accept any status code less than 500
      }
    });

    if (response.status !== 200) {
      return res.status(response.status).json({
        success: false,
        message: `MangaToon returned status code: ${response.status}`
      });
    }

    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract manga title
    const title = $('.title-text').text().trim() || 'Unknown Manga';
    const chapterTitle = $('.episode-title').text().trim() || 'Unknown Chapter';
    
    // Extract images from the chapter
    const images = [];
    
    // Method 1: Direct image tags
    $('.pictures img').each((index, element) => {
      const src = $(element).attr('src');
      if (src && src.includes('://')) {
        images.push({
          index: index + 1,
          url: src
        });
      }
    });

    // Method 2: Viewer container
    if (images.length === 0) {
      $('.viewer-container img').each((index, element) => {
        const src = $(element).attr('src') || $(element).attr('data-src');
        if (src && src.includes('://')) {
          images.push({
            index: index + 1,
            url: src
          });
        }
      });
    }

    // Method 3: Script tags with image data
    if (images.length === 0) {
      const scriptContent = $('script').map((i, el) => $(el).html()).get().join('');
      
      // More comprehensive regex for image URLs
      const imgRegex = /(https?:\/\/[^"'\s]+\/comics\/[^"'\s]+\.(jpe?g|png|webp|gif))/gi;
      let match;
      let index = 1;
      
      while ((match = imgRegex.exec(scriptContent)) !== null) {
        images.push({
          index: index++,
          url: match[1]
        });
      }
    }
    
    // Method 4: Look for data in JSON objects within scripts
    if (images.length === 0) {
      $('script').each((i, el) => {
        const content = $(el).html() || '';
        if (content.includes('comicImgs') || content.includes('imageList')) {
          try {
            // Try to extract JSON data
            const jsonMatch = content.match(/(\{.*"comicImgs".*\}|\{.*"imageList".*\})/s);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const jsonData = JSON.parse(jsonStr);
              
              // Extract images from various possible structures
              const imgList = jsonData.comicImgs || jsonData.imageList || 
                             (jsonData.data && (jsonData.data.comicImgs || jsonData.data.imageList));
              
              if (Array.isArray(imgList)) {
                imgList.forEach((img, idx) => {
                  if (typeof img === 'string' && img.includes('://')) {
                    images.push({
                      index: idx + 1,
                      url: img
                    });
                  } else if (img.url && img.url.includes('://')) {
                    images.push({
                      index: idx + 1,
                      url: img.url
                    });
                  }
                });
              }
            }
          } catch (e) {
            console.log('Error parsing script JSON:', e.message);
          }
        }
      });
    }

    console.log(`Found ${images.length} images`);

    // If no images found, return a useful error
    if (images.length === 0) {
      return res.json({
        success: false,
        message: 'No images found in the chapter. Website structure may have changed.',
        html: html.substring(0, 200) + '...' // Return a small sample of HTML for debugging
      });
    }

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
      message: 'Error fetching manga: ' + error.message
    });
  }
};
