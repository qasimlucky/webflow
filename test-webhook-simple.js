const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5700';
const WEBHOOK_ENDPOINT = '/api/pxl/webhook';

// Test payloads
const testPayloads = [
  {
    name: 'IDENTIFICATION_COMPLETED',
    payload: {
      event_type: 'IDENTIFICATION_COMPLETED',
      transaction_data: {
        id: '357589807',
        status: 'COMPLETED',
        created_at: '2025-01-10T23:58:26.425Z',
        updated_at: '2025-01-10T23:58:26.425Z'
      },
      payload: {
        transaction_id: '357589807',
        user_id: 'user_123',
        document_type: 'passport',
        verification_status: 'verified',
        confidence_score: 0.95
      },
      metadata: {
        source: 'PXL_Vision',
        version: '1.0',
        timestamp: '2025-01-10T23:58:26.425Z'
      }
    }
  },
  {
    name: 'DOCUMENT_SCAN_COMPLETED',
    payload: {
      event_type: 'DOCUMENT_SCAN_COMPLETED',
      transaction_data: {
        id: '357589807',
        status: 'DOCUMENT_SCAN_COMPLETED',
        created_at: '2025-01-10T23:55:00.000Z',
        updated_at: '2025-01-10T23:55:00.000Z'
      },
      payload: {
        transaction_id: '357589807',
        document_id: 'doc_456',
        scan_quality: 'high',
        extracted_data: {
          name: 'John Doe',
          document_number: 'A12345678',
          expiry_date: '2030-12-31'
        }
      },
      metadata: {
        source: 'PXL_Vision',
        version: '1.0',
        timestamp: '2025-01-10T23:55:00.000Z'
      }
    }
  },
  {
    name: 'COMPLETED',
    payload: {
      event_type: 'COMPLETED',
      transaction_data: {
        id: '357589807',
        status: 'COMPLETED',
        created_at: '2025-01-10T23:58:26.425Z',
        updated_at: '2025-01-10T23:58:26.425Z'
      },
      payload: {
        transaction_id: '357589807',
        verification_result: 'success',
        final_score: 0.95,
        completion_time: '2025-01-10T23:58:26.425Z'
      },
      metadata: {
        source: 'PXL_Vision',
        version: '1.0',
        timestamp: '2025-01-10T23:58:26.425Z'
      }
    }
  }
];

async function testWebhookEndpoint() {
  console.log('🚀 Testing PXL Webhook Endpoint');
  console.log('================================\n');

  // Check if server is running
  try {
    console.log('🔍 Checking if server is running...');
    const healthCheck = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running\n');
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('Please start the server with: npm start or node server.js\n');
    return;
  }

  // Test each payload
  for (const test of testPayloads) {
    console.log(`📤 Testing: ${test.name}`);
    console.log('----------------------------------------');
    
    try {
      const response = await axios.post(`${BASE_URL}${WEBHOOK_ENDPOINT}`, test.payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PXL-Webhook/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('✅ Status:', response.status);
      console.log('📦 Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Error:', error.message);
      if (error.response) {
        console.log('📦 Error Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    console.log('\n');
    
    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('🏁 Testing completed!');
}

// Run the tests
testWebhookEndpoint().catch(console.error);
