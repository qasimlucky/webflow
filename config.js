require('dotenv').config();

module.exports = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Webflow Configuration (for later use)
  WEBFLOW_SECRET: process.env.WEBFLOW_SECRET || 'your_webflow_secret_here',
  
  // Database Configuration (for later use)
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/esp_buchungen',
  
  // PXL API Configuration (for later use)
  PXL_API_KEY: process.env.PXL_API_KEY || 'your_pxl_api_key_here',
  PXL_API_URL: process.env.PXL_API_URL || 'https://api.pxl.com',
  
  // Email Configuration (for later use)
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || 'your_mailgun_api_key_here',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || 'your_mailgun_domain_here'
}; 