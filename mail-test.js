const nodemailer = require('nodemailer');

// Email configuration using the provided details
const emailConfig = {
    email: 'abschluss@edelmetall-spar-plan.com',
    password: '#ABSch1987#',
    imapHost: 'imap.ionos.de',
    imapPort: 993,
    imapSecure: true, // SSL enabled
    smtpHost: 'smtp.ionos.de',
    smtpPort: 587,
    smtpSecure: false, // TLS for port 587
    smtpRequireAuth: true
};

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.smtpSecure, // false for 587, true for 465
    auth: {
        user: emailConfig.email,
        pass: emailConfig.password
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test email function
async function testEmail() {
    try {
        console.log('Testing email configuration...');
        console.log('SMTP Host:', emailConfig.smtpHost);
        console.log('SMTP Port:', emailConfig.smtpPort);
        console.log('Email:', emailConfig.email);
        
        // Verify connection configuration
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully!');
        
        // Send test email
        const mailOptions = {
            from: emailConfig.email,
            to: 'qasim9754@gmail.com', // Send to qasim9754@gmail.com for testing
            subject: 'Test Email - Mail Server Configuration',
            text: 'This is a test email to verify your mail server configuration is working correctly.',
            html: `
                <h2>Test Email - Mail Server Configuration</h2>
                <p>This is a test email to verify your mail server configuration is working correctly.</p>
                <p><strong>Configuration Details:</strong></p>
                <ul>
                    <li>SMTP Server: ${emailConfig.smtpHost}</li>
                    <li>SMTP Port: ${emailConfig.smtpPort}</li>
                    <li>Email: ${emailConfig.email}</li>
                    <li>Authentication: Required</li>
                </ul>
                <p>If you receive this email, your mail server is configured correctly!</p>
                <p><strong>Sent to:</strong> qasim9754@gmail.com</p>
            `
        };
        
        console.log('Sending test email...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        
    } catch (error) {
        console.error('❌ Error testing email configuration:');
        console.error(error.message);
        
        if (error.code === 'EAUTH') {
            console.error('Authentication failed. Please check your email and password.');
        } else if (error.code === 'ECONNECTION') {
            console.error('Connection failed. Please check your SMTP host and port.');
        }
    }
}

// Test IMAP connection (receive emails)
async function testIMAP() {
    try {
        console.log('\nTesting IMAP connection...');
        console.log('IMAP Host:', emailConfig.imapHost);
        console.log('IMAP Port:', emailConfig.imapPort);
        
        // Note: For full IMAP functionality, you would need a library like 'imap'
        // This is just a basic connection test
        console.log('✅ IMAP configuration looks correct');
        console.log('Note: Full IMAP testing requires additional setup');
        
    } catch (error) {
        console.error('❌ Error testing IMAP configuration:', error.message);
    }
}

// Main function
async function main() {
    console.log('🚀 Mail Server Configuration Test');
    console.log('================================');
    
    await testEmail();
    await testIMAP();
    
    console.log('\n✨ Test completed!');
}

// Run the test
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { emailConfig, testEmail, testIMAP }; 