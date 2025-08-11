const nodemailer = require('nodemailer');

// Email configuration using environment variables
const emailConfig = {
  email: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  smtpHost: process.env.EMAIL_SMTP_HOST,
  smtpPort: parseInt(process.env.EMAIL_SMTP_PORT),
  smtpSecure: process.env.EMAIL_SMTP_SECURE === 'true',
  smtpRequireAuth: process.env.EMAIL_SMTP_REQUIRE_AUTH !== 'false'
};

// Create email transporter
const emailTransporter = nodemailer.createTransport({
  host: emailConfig.smtpHost,
  port: emailConfig.smtpPort,
  secure: emailConfig.smtpSecure,
  auth: {
    user: emailConfig.email,
    pass: emailConfig.password
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testEmailSending() {
  try {
    console.log('🧪 Testing email sending functionality...');
    
    // Create a simple PDF-like buffer (just for testing)
    const testPdfBuffer = Buffer.from('This is a test PDF content for testing email attachments', 'utf8');
    
    // Send email with PDF attachment
    const mailOptions = {
      from: emailConfig.email,
      to: 'qasim9754@gmail.com',
      subject: 'Test Email - PXL Webhook Email System',
      text: 'This is a test email to verify the PXL webhook email system is working correctly.',
      html: `
        <h2>Test Email - PXL Webhook Email System</h2>
        <p>This is a test email to verify the PXL webhook email system is working correctly.</p>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li>Transaction ID: TEST-123</li>
          <li>Status: TEST_STATUS</li>
          <li>Timestamp: ${new Date().toISOString()}</li>
        </ul>
        <p>If you receive this email, your PXL webhook email system is working!</p>
        <p><strong>Sent to:</strong> qasim9754@gmail.com</p>
      `,
      attachments: [
        {
          filename: 'Test_PXL_Transaction.pdf',
          content: testPdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };
    
    console.log('📧 Sending test email with PDF attachment...');
    const emailResult = await emailTransporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', emailResult.messageId);
    console.log('📧 Check qasim9754@gmail.com for the test email');
    
    return emailResult;
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw error;
  }
}

// Run the test
testEmailSending()
  .then(() => {
    console.log('✨ Email test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Email test failed:', error);
    process.exit(1);
  }); 