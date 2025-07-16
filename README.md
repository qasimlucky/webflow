# ESP Buchungen Backend - Webflow Connection Test

This is a simple Express.js backend to test the connection between Webflow forms and your server.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

### 3. Test the Connection
```bash
# Run automated tests
npm test
```

## 📋 Available Endpoints

### Health Check
- **GET** `/health`
- Returns server status and timestamp

### Webflow Form Endpoint
- **POST** `/api/esp-buchungen`
- Receives form data from Webflow
- Logs all incoming data for debugging

### Test Endpoint
- **POST** `/test-webflow`
- Simulates form data for testing

## 🧪 Testing the Connection

### Method 1: Automated Tests
```bash
npm test
```

### Method 2: Manual Testing with curl
```bash
# Test health check
curl http://localhost:3000/health

# Test Webflow endpoint
curl -X POST http://localhost:3000/api/esp-buchungen \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "message": "Test message"
  }'
```

### Method 3: Using Postman
1. Create a new POST request to `http://localhost:3000/api/esp-buchungen`
2. Set Content-Type header to `application/json`
3. Add test data in the body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "message": "Test message from Postman"
}
```

## 🔧 Webflow Configuration

### Setting up Webflow Form Action
In your Webflow form settings:

1. **Form Action URL**: `http://localhost:3000/api/esp-buchungen`
2. **Method**: POST
3. **Encoding**: application/json

### Example Webflow Form Fields
```html
<input type="text" name="name" placeholder="Your Name" required>
<input type="email" name="email" placeholder="Your Email" required>
<input type="tel" name="phone" placeholder="Your Phone">
<textarea name="message" placeholder="Your Message"></textarea>
```

## 📊 What You'll See

When a form is submitted, you'll see detailed logs in your console:

```
🎉 Webflow form submission received!
📝 Form data: {
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "message": "Test message"
}
🔑 Headers: {
  "content-type": "application/json",
  "user-agent": "Webflow-Form/1.0",
  ...
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Server not starting**
   - Check if port 3000 is available
   - Try a different port in config.js

2. **CORS errors**
   - The server includes CORS middleware
   - Check browser console for specific errors

3. **Form data not received**
   - Check Webflow form action URL
   - Verify Content-Type header
   - Check server logs for incoming requests

4. **Connection refused**
   - Make sure server is running
   - Check firewall settings
   - Verify URL in Webflow form settings

### Debug Mode
The server logs all incoming requests with detailed information. Check the console output for:
- Request method and path
- Headers
- Request body
- Any errors

## 🔒 Security Notes

This is a development setup. For production:

1. Add proper validation
2. Implement rate limiting
3. Add authentication
4. Use HTTPS
5. Validate Webflow signatures

## 📁 Project Structure

```
├── server.js          # Main Express server
├── test-webflow.js    # Test script
├── config.js          # Configuration
├── package.json       # Dependencies
└── README.md         # This file
```

## 🎯 Next Steps

Once the basic connection is working:

1. Add form validation
2. Set up PostgreSQL database
3. Implement PXL API integration
4. Add email notifications
5. Deploy to production

## 📞 Support

If you encounter issues:
1. Check the server logs
2. Run the test script
3. Verify Webflow form configuration
4. Check network connectivity
