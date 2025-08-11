const axios = require('axios');

// Test webhook endpoint with different PXL statuses
async function testWebhook(status, transactionId = '722899766') {
  try {
    console.log(`🧪 Testing webhook with status: ${status}`);
    
    const webhookPayload = {
      event_type: status,
      transaction_id: transactionId,
      status: status,
      timestamp: new Date().toISOString(),
      // Add other fields that might be in the PXL webhook
      transaction_data: {
        id: transactionId,
        status: status,
        created_at: new Date().toISOString()
      }
    };
    
    console.log('📦 Webhook payload:', JSON.stringify(webhookPayload, null, 2));
    
    const response = await axios.post('http://localhost:5700/api/pxl/webhook', webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PXL-Webhook-Test'
      }
    });
    
    console.log('✅ Webhook test successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Test different PXL statuses
async function runTests() {
  console.log('🚀 Starting PXL Webhook Tests');
  console.log('================================');
  
  const testStatuses = [
    'ACTIVE',
    'STARTED', 
    'TC_ACCEPTED',
    'COMPATIBILITY_PASSED',
    'DOCUMENT_SCAN_COMPLETED',  // This should trigger PDF + email
    'DOCUMENT_RECORDING_COMPLETED', // This should trigger PDF + email
    'SELFIE_COMPLETED', // This should trigger PDF + email
    'IDENTIFICATION_COMPLETED', // This should trigger PDF + email
    'PENDING_MANUAL_REVIEW' // This should trigger PDF + email
  ];
  
  for (const status of testStatuses) {
    console.log(`\n--- Testing ${status} ---`);
    await testWebhook(status, '722899766');
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✨ All webhook tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebhook }; 