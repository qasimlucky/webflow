const axios = require('axios');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// Test data that simulates Webflow form submission
const testFormData = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+49 123 456 789',
  company: 'Test Company GmbH',
  message: 'This is a test message from Webflow form',
  // Add any other fields your Webflow form might send
  formId: 'webflow-form-123',
  timestamp: new Date().toISOString()
};

async function testHealthCheck() {
  try {
    console.log('🏥 Testing health check...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testWebflowEndpoint() {
  try {
    console.log('\n📝 Testing Webflow endpoint...');
    const response = await axios.post(`${BASE_URL}/api/esp-buchungen`, testFormData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webflow-Form/1.0'
      }
    });
    
    console.log('✅ Webflow endpoint test passed!');
    console.log('📊 Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Webflow endpoint test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function testTestEndpoint() {
  try {
    console.log('\n🧪 Testing test endpoint...');
    const response = await axios.post(`${BASE_URL}/test-webflow`);
    
    console.log('✅ Test endpoint passed!');
    console.log('📊 Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Test endpoint failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Webflow connection tests...');
  console.log(`📍 Testing server at: ${BASE_URL}\n`);
  
  const healthCheck = await testHealthCheck();
  const webflowTest = await testWebflowEndpoint();
  const testEndpoint = await testTestEndpoint();
  
  console.log('\n📋 Test Results:');
  console.log(`Health Check: ${healthCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webflow Endpoint: ${webflowTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test Endpoint: ${testEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  
  if (healthCheck && webflowTest && testEndpoint) {
    console.log('\n🎉 All tests passed! Your Webflow connection is working.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the server logs for details.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testWebflowEndpoint,
  testTestEndpoint,
  runAllTests
}; 