# PXL Configuration Update

## Updated Configuration Details

Based on the PXL communication, the following configuration has been updated:

### Account Information
- **Account ID**: 939 (unchanged)
- **Workflow ID**: 31 (updated from 33)
- **Access Token**: unchanged
- **Backend URL**: https://ident-api-stage.pxl-vision.com/api/v1 (unchanged)
- **Application URL**: https://qes-stage.pxl-vision.com/ (NEW - QES application)

### Required Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# PXL API Configuration
PXL_API_KEY=your_pxl_api_key_here
PXL_API_URL=https://ident-api-stage.pxl-vision.com/api/v1
PXL_QES_APP_URL=https://qes-stage.pxl-vision.com/
PXL_WEBHOOK_URL=https://your-domain.com/api/pxl/webhook
PXL_WEBHOOK_SECRET=your_webhook_secret_here
```

### Changes Made

1. **Updated Workflow ID**: Changed from 33 to 31 in `server.js`
2. **Added QES Application URL**: Added `PXL_QES_APP_URL` configuration in `config.js`

### Next Steps Required

1. **Notification URL**: Provide PXL with your backend notification URL for status updates
2. **Testing**: Coordinate with PXL for complete user journey testing including decryption
3. **URL Parameters**: Consider which parameters to append to forwardUrl and errorUrl for user session management

### Important Notes

- The application is now using the QES (Qualified Electronic Signature) application
- Decryption step is currently disabled for testing purposes
- Sample decryption script available: JavaSample_decrypt.zip
- Refer to "Using URL Parameters in Forward URLs" section in the technical specification for supported parameters

### Files Modified

- `server.js`: Updated workflowId from 33 to 31
- `config.js`: Added PXL_QES_APP_URL configuration 