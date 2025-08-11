# Mail Server Configuration Test

This application tests your email server configuration using the provided IONOS email details.

## Configuration Details

- **IMAP Server**: imap.ionos.de (Port 993, SSL enabled)
- **SMTP Server**: smtp.ionos.de (Port 587, TLS enabled)
- **Authentication**: Required

## Prerequisites

You need to install the `nodemailer` package:

```bash
npm install nodemailer
```

## Testing the Mail Server

### Option 1: Using npm script
```bash
npm run test:mail
```

### Option 2: Direct execution
```bash
node mail-test.js
```

## What the Test Does

1. **SMTP Connection Test**: Verifies connection to the SMTP server
2. **Authentication Test**: Tests login with your credentials
3. **Email Send Test**: Sends a test email to yourself
4. **IMAP Configuration Check**: Validates IMAP settings

## Expected Output

If successful, you should see:
```
🚀 Mail Server Configuration Test
================================
Testing email configuration...

Email: abschluss@edelmetall-spar-plan.com
✅ SMTP connection verified successfully!
Sending test email...
✅ Test email sent successfully!
Message ID: <random-message-id>
Preview URL: https://ethereal.email/message/...

Testing IMAP connection...
IMAP Host: imap.ionos.de
IMAP Port: 993
✅ IMAP configuration looks correct
Note: Full IMAP testing requires additional setup

✨ Test completed!
```

## Troubleshooting

### Common Issues:

1. **Authentication Failed (EAUTH)**
   - Check your email and password
   - Ensure 2FA is disabled or app-specific password is used

2. **Connection Failed (ECONNECTION)**
   - Check your internet connection
   - Verify SMTP host and port
   - Check firewall settings

3. **TLS/SSL Issues**
   - Port 587 uses STARTTLS (not SSL)
   - Port 465 uses SSL
   - Port 993 (IMAP) uses SSL

## Security Notes

- The password is hardcoded for testing purposes only
- In production, use environment variables
- Consider using OAuth2 for better security

## Next Steps

After successful testing, you can:
1. Integrate this mail configuration into your main application
2. Create email templates for different purposes
3. Set up email receiving functionality using IMAP
4. Implement email scheduling and queuing 