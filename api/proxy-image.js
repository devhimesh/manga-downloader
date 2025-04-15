// api/proxy-image.js
const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send('Image URL is required');
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }
    
    // Only allow image URLs
    const imageExtensions = /\.(jpe?g|png|gif|webp)(\?.*)?$/i;
    if (!imageExtensions.test(url)) {
      return res.status(400).send('URL does not appear to be an image');
    }
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://mangatoon.mobi/'
      },
      timeout: 8000, // 8 second timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB max
      validateStatus: function (status) {
        return status === 200; // Only accept 200 OK
      }
    });
    
    // Set the content type header based on the URL extension
    let contentType = 'image/jpeg'; // Default
    if (url.match(/\.png(\?.*)?$/i)) contentType = 'image/png';
    if (url.match(/\.gif(\?.*)?$/i)) contentType = 'image/gif';
    if (url.match(/\.webp(\?.*)?$/i)) contentType = 'image/webp';
    
    // Override with actual content type if available
    if (response.headers['content-type'] && response.headers['content-type'].startsWith('image/')) {
      contentType = response.headers['content-type'];
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Send the image data
    return res.send(Buffer.from(response.data, 'binary'));
  } catch (error) {
    console.error('Error proxying image:', error.message);
    
    // Create a simple error image with text
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'image/svg+xml');
      const errorSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="150">
          <rect width="300" height="150" fill="#f8d7da" />
          <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#721c24" text-anchor="middle">
            Error loading image
          </text>
        </svg>
      `;
      return res.send(Buffer.from(errorSVG));
    }
    
    return res.status(500).send('Error fetching image');
  }
};
