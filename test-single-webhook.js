const axios = require('axios');

async function testSingleWebhook() {
  try {
    console.log('🧪 Testing single webhook with real transaction ID...');
    
    const webhookPayload = {
      event_type: 'IDENTIFICATION_COMPLETED',
      transaction_id: '722899766',
      status: 'IDENTIFICATION_COMPLETED',
      timestamp: new Date().toISOString(),
      transaction_data: {
        id: '722899766',
        status: 'IDENTIFICATION_COMPLETED',
        created_at: new Date().toISOString()
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
testSingleWebhook()
  .then(() => {
    console.log('✨ Test completed!');
    console.log('📧 Check your server logs for PXL API response details');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 