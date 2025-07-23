const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const ProcessMetadata = require('./src/api/v1/model/ProcessMetadata');
const resumeRoutes = require('./src/api/v1/routes/resume');
const countries = require("i18n-iso-countries");

function toAlpha3(countryCode) {
  if (!countryCode) return "DEU"; // default fallback
  if (countryCode.length === 2) {
    return countries.alpha2ToAlpha3(countryCode.toUpperCase()) || countryCode.toUpperCase();
  }
  return countryCode.toUpperCase();
}

// PXL access token cache
let pxlAccessToken = null;
let pxlTokenExpiresAt = 0;

async function getPxlAccessToken() {
  const now = Date.now();
  if (pxlAccessToken && now < pxlTokenExpiresAt) {
    console.log('🔑 Using cached PXL access token');
    return pxlAccessToken;
  }
  try {
    const url = `${process.env.PXL_API_URL}/access/token`;
    const headers = {
      Authorization: `Bearer ${process.env.PXL_API_KEY}`,
      'expires-at': 7 // adjust if needed
    };
    const data = {};

    // Log the full request
    console.log('➡️  Requesting new PXL access token...');
    console.log('🔍 Axios Request:', {
      method: 'POST',
      url,
      headers,
      data
    });

    const response = await axios.post(url, data, { headers });
    pxlAccessToken = response.data.accessToken;
    pxlTokenExpiresAt = now + 6 * 60 * 1000;
    console.log('✅ Received new PXL access token');
    return pxlAccessToken;
  } catch (err) {
    console.error('❌ Failed to get PXL access token:', err.response?.data || err.message);
    throw err;
  }
}

const dbURI = process.env.DEV_DATABASE || 'mongodb://localhost:27017/espbuchungen';

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected!'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
const EspBuchung = require('./src/api/v1/model/EspBuchung');

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
app.post('/api/esp-buchungen', async (req, res) => {
  try {
    // Map incoming fields to schema fields
    const data = req.body; // Use the request body directly

    // 1. Save EspBuchung
    const saved = await EspBuchung.create(data);

    // 2. Prepare payload for PXL
    const pxlPayload = {
      accountId: 939,
      workflowId: 33,
      personalDetails: {
        firstName: {
          value: data["ESP-Kontakt-Vorname"] || "Max",
          mandatory: true,
          editable: true
        },
        lastName: {
          value: data["ESP-Kontakt-Nachname"] || "Mustermann",
          mandatory: true,
          editable: true
        },
        maidenName: {
          value: data["ESP-Kontakt-Nachname"] || "Mustermann",
          mandatory: true,
          editable: true
        },
        gender: {
          value: "f",
          mandatory: true,
          editable: true
        },
        birthdate: {
          value: data["ESP-Geburtsdatum"] || "1994-09-10",
          mandatory: true,
          editable: true
        },
        email: {
          value: data["ESP-Kontakt-E-Mail-Adresse"] || "max@example.com",
          mandatory: true,
          editable: true
        },
        phone: {
          value: data["ESP-Kontakt-Telefon"] || "+49123456789",
          mandatory: true,
          editable: true
        },
        address: {
          street: {
            value: data["ESP-Kontakt-Strasse"] || "Musterstr. 1",
            mandatory: true,
            editable: true
          },
          houseNumber: {
            value: data["ESP-Kontakt-Hausnummer"] || "1",
            mandatory: false,
            editable: true
          },
          addressLine2: {
            value: data["ESP-Kontakt-Adresszusatz"] || "address2",
            mandatory: false,
            editable: true
          },
          zipCode: {
            value: data["ESP-Kontakt-PLZ"] || "12345",
            mandatory: true,
            editable: true
          },
          city: {
            value: data["ESP-Kontakt-Ort"] || "Musterstadt",
            mandatory: true,
            editable: false
          },
          countryCode: {
            value: toAlpha3(data["ESP Kontakt Land"]) || "DEU",
            mandatory: true,
            editable: true
          }
        },
        nationality: {
          value: toAlpha3(data["ESP-Kontakt-Nationalitaet"]) || "DEU",
          mandatory: false,
          editable: true
        }
      }
    };

    console.log('➡️ PXL Transaction Payload:', JSON.stringify(pxlPayload, null, 2));

    // 3. Get PXL access token
    const accessToken = await getPxlAccessToken();
    console.log('🔑 PXL access token:', accessToken);

    // 4. Call PXL API with retry logic
    let pxlResponse;
    let attempts = 0;
    let error;
    const transactionUrl = `${process.env.PXL_API_URL}/transactions/`;
    const transactionHeaders = { Authorization: `Bearer ${accessToken}` };
    while (attempts < 3) {
      try {
        // Log the full request
        console.log('🔍 Axios Transaction Request:', {
          method: 'POST',
          url: transactionUrl,
          headers: transactionHeaders,
          data: pxlPayload
        });
        pxlResponse = await axios.post(
          transactionUrl,
          pxlPayload,
          { headers: transactionHeaders }
        );
        break; // Success!
      } catch (err) {
        attempts++;
        error = err;
        console.error('❌ Axios Transaction Error:', err.response?.data || err.message);
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempts)));
      }
    }

    // 5. Save process metadata
    const meta = await ProcessMetadata.create({
      espBuchungId: saved._id,
      transactionId: pxlResponse?.data?.transactionId,
      transactionCode: pxlResponse?.data?.transactionCode,
      status: pxlResponse ? 'initiated' : 'failed',
      error: pxlResponse ? undefined : error?.message
    });

    res.status(200).json({
      success: true,
      message: 'Form submission and PXL transaction processed',
      id: saved._id,
      pxl: pxlResponse?.data,
      processMeta: meta
    });
  } catch (error) {
    console.error('❌ Error saving form submission:');
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Register the resume generation endpoint
app.use('/api/v1/resume', resumeRoutes);

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

