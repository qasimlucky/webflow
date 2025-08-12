const axios = require('axios');

async function testWebhookWithPayload() {
  try {
    console.log('🧪 Testing webhook with IDENTIFICATION_COMPLETED payload...');
    
    // This is the exact payload from your image
    const webhookPayload = {
      event_type: "IDENTIFICATION_COMPLETED",
      transaction_id: "123456789",
      status: "IDENTIFICATION_COMPLETED",
      timestamp: "2025-08-10T23:58:26.425Z",
      transaction_data: {
        id: "123456789",
        status: "IDENTIFICATION_COMPLETED",
        created_at: "2025-08-10T23:58:26.425Z"
      }
    };
    
    console.log('📦 Webhook payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('📡 Sending to server...');
    
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

// Run the test
testWebhookWithPayload()
  .then(() => {
    console.log('✨ Test completed!');
    console.log('📧 Check your server logs for email sending details');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 