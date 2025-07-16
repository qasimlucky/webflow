const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'ESP Buchungen Backend is running'
  });
});

// Webflow form endpoint
app.post('/api/esp-buchungen', (req, res) => {
  try {
    console.log('🎉 Webflow form submission received!');
    console.log('📝 Form data:', JSON.stringify(req.body, null, 2));
    console.log('🔑 Headers:', JSON.stringify(req.headers, null, 2));

    // For now, just log everything and return success
    // Later we'll add validation, database storage, etc.
    
    res.status(200).json({
      success: true,
      message: 'Form submission received successfully',
      timestamp: new Date().toISOString(),
      receivedData: req.body
    });

  } catch (error) {
    console.error('❌ Error processing form submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Test endpoint to simulate Webflow form data
app.post('/test-webflow', (req, res) => {
  const testData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    message: 'This is a test submission from Webflow'
  };

  console.log('🧪 Test data:', testData);
  
  res.status(200).json({
    success: true,
    message: 'Test endpoint working',
    data: testData
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/esp-buchungen',
      'POST /test-webflow'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ESP Buchungen Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Webflow endpoint: http://localhost:${PORT}/api/esp-buchungen`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test-webflow`);
});

