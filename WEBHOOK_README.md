# PXL Webhook Integration with PDF Generation & Email

This system now automatically processes PXL webhook status updates and sends PDF attachments via email when specific statuses are reached.

## How It Works

### 1. Webhook Reception
- PXL sends webhook notifications to `/api/pxl/webhook`
- All webhook data is saved to MongoDB
- Status updates are processed automatically

### 2. Status-Based Processing
The system handles these PXL statuses:

**Basic Statuses (Logged Only):**
- `ACTIVE` - Transaction is active
- `STARTED` - Transaction has started
- `TC_ACCEPTED` - Terms & Conditions accepted
- `COMPATIBILITY_PASSED` - Compatibility check passed

**Email-Triggering Statuses (PDF + Email):**
- `DOCUMENT_SCAN_COMPLETED` - Document scanning finished
- `DOCUMENT_RECORDING_COMPLETED` - Document recording finished
- `SELFIE_COMPLETED` - Selfie verification completed
- `IDENTIFICATION_COMPLETED` - Full identification completed
- `PENDING_MANUAL_REVIEW` - Ready for manual review

### 3. PDF Generation & Email
When an email-triggering status is received:
1. **API Call**: Calls PXL API to get base64 data
2. **PDF Creation**: Converts base64 to PDF
3. **Email Sending**: Sends PDF as attachment to qasim9754@gmail.com

## Configuration


```

### PXL API Settings
```bash
PXL_API_URL=https://ident-api-stage.pxl-vision.com/api/v1
PXL_API_KEY=your_pxl_api_key_here
```

## API Endpoints

### Webhook Endpoint
```
POST /api/pxl/webhook
```

**Expected Payload:**
```json
{
  "event_type": "DOCUMENT_SCAN_COMPLETED",
  "transaction_id": "123456789",
  "status": "DOCUMENT_SCAN_COMPLETED",
  "timestamp": "2025-08-08T11:42:36.559Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received and processed",
  "webhook_id": "webhook_id_here",
  "event_type": "DOCUMENT_SCAN_COMPLETED",
  "processing_time": 1500,
  "processing_result": {
    "type": "pxl_status",
    "action": "processed_with_email",
    "emailResult": {
      "success": true,
      "emailId": "email_message_id",
      "transactionId": "123456789",
      "status": "DOCUMENT_SCAN_COMPLETED"
    }
  },
  "timestamp": "2025-08-08T11:42:38.000Z"
}
```

### Webhook Data Retrieval
```
GET /api/pxl/webhook?limit=50&status=processed&event_type=DOCUMENT_SCAN_COMPLETED
GET /api/pxl/webhook/:id
```

## Testing

### Test Individual Webhook
```bash
npm run test:webhook
```

This will test all PXL statuses sequentially.

### Test Specific Status
```javascript
const { testWebhook } = require('./test-webhook');
await testWebhook('DOCUMENT_SCAN_COMPLETED', '123456789');
```

## Workflow Example

1. **PXL sends webhook**: `DOCUMENT_SCAN_COMPLETED` for transaction `123456789`
2. **System receives webhook**: Saves to database, extracts transaction ID
3. **API call to PXL**: Gets base64 data from `/transactions/123456789/files?unencryptedData=true`
4. **PDF generation**: Converts base64 to PDF buffer
5. **Email sending**: Sends PDF attachment to qasim9754@gmail.com
6. **Response**: Returns success with email details

## Monitoring

### Logs to Watch For
```
🔄 PXL Status Update: DOCUMENT_SCAN_COMPLETED for transaction: 123456789
📧 Triggering PDF generation and email for status: DOCUMENT_SCAN_COMPLETED
📥 Getting data for transaction: 123456789
✅ Received data from PXL API
📧 Sending email with PDF attachment...
✅ Email sent successfully!
Message ID: <email_message_id>
✅ PDF generated and email sent successfully
```

### Database Records
- All webhooks are saved in `WebhookData` collection
- Status: `received` → `processed`
- Processing results include email success/failure details

## Error Handling

### Common Issues
1. **PXL API failure**: Logs error, continues processing
2. **Email failure**: Logs error, webhook still marked as processed
3. **Invalid transaction ID**: Logs error, skips PDF generation

### Error Response Example
```json
{
  "processing_result": {
    "type": "pxl_status",
    "action": "processed_without_email",
    "error": "Failed to get PXL data: No base64 data received"
  }
}
```

## Next Steps

1. **Dynamic Email Recipients**: Get user email from transaction data
2. **PDF Templates**: Use proper PDF generation libraries (pdfkit, puppeteer)
3. **Email Templates**: Customize email content based on status
4. **Retry Logic**: Add retry mechanism for failed emails
5. **Rate Limiting**: Prevent spam when multiple statuses arrive quickly 