const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");
const ProcessMetadata = require("./src/api/v1/model/ProcessMetadata");
const WebhookData = require("./src/api/v1/model/WebhookData");
const EmailLog = require("./src/api/v1/model/EmailLog");
const resumeRoutes = require("./src/api/v1/routes/resume");
const espBuchungRoutes = require("./src/api/v1/routes/espBuchung");
const webhookDataRoutes = require("./src/api/v1/routes/webhookData");
const countries = require("i18n-iso-countries");
const EspBuchung = require("./src/api/v1/model/EspBuchung");

function toAlpha3(countryCode) {
  if (!countryCode) return "DEU";
  if (countryCode.length === 2) {
    return (
      countries.alpha2ToAlpha3(countryCode.toUpperCase()) ||
      countryCode.toUpperCase()
    );
  }
  return countryCode.toUpperCase();
}

// PXL access token cache
let pxlAccessToken = null;
let pxlTokenExpiresAt = 0;

async function getPxlAccessToken() {
  const now = Date.now();
  if (pxlAccessToken && now < pxlTokenExpiresAt) {
    console.log("🔑 Using cached PXL access token");
    return pxlAccessToken;
  }
  try {
    const url = `${process.env.PXL_API_URL}/access/token`;
    const headers = {
      Authorization: `Bearer ${process.env.PXL_API_KEY}`,
      "expires-at": 7, // adjust if needed
    };
    const data = {};

    // Log the full request
    console.log("➡️  Requesting new PXL access token...");
    console.log("🔍 Axios Request:", {
      method: "POST",
      url,
      headers,
      data,
    });

    const response = await axios.post(url, data, { headers });
    pxlAccessToken = response.data.accessToken;
    pxlTokenExpiresAt = now + 6 * 60 * 1000;
    console.log("✅ Received new PXL access token");
    return pxlAccessToken;
  } catch (err) {
    console.error(
      "❌ Failed to get PXL access token:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// Email configuration using environment variables
const emailConfig = {
  email: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  smtpHost: process.env.EMAIL_SMTP_HOST,
  smtpPort: parseInt(process.env.EMAIL_SMTP_PORT),
  smtpSecure: process.env.EMAIL_SMTP_SECURE === "true",
  smtpRequireAuth: process.env.EMAIL_SMTP_REQUIRE_AUTH !== "false",
};

// Create email transporter
const emailTransporter = nodemailer.createTransport({
  host: emailConfig.smtpHost,
  port: emailConfig.smtpPort,
  secure: emailConfig.smtpSecure,
  auth: {
    user: emailConfig.email,
    pass: emailConfig.password,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Email logging utility functions
async function createEmailLog(emailData) {
  try {
    const emailLog = await EmailLog.create({
      emailType: emailData.emailType,
      transactionId: emailData.transactionId,
      espBuchungId: emailData.espBuchungId,
      recipientEmail: emailData.recipientEmail,
      recipientName: emailData.recipientName,
      senderEmail: emailData.senderEmail,
      senderName: emailData.senderName,
      subject: emailData.subject,
      hasAttachment: emailData.hasAttachment || false,
      attachmentDetails: emailData.attachmentDetails,
      emailService: emailData.emailService || "nodemailer",
      smtpConfig: emailData.smtpConfig,
      status: "pending",
      metadata: emailData.metadata,
      userAgent: emailData.userAgent,
      ipAddress: emailData.ipAddress,
    });

    console.log(`📧 Email log created with ID: ${emailLog._id}`);
    return emailLog;
  } catch (error) {
    console.error("❌ Error creating email log:", error.message);
    return null;
  }
}

async function updateEmailLogStatus(emailLogId, status, additionalData = {}) {
  try {
    const updateData = {
      status,
      ...additionalData,
    };

    if (status === "sent") {
      updateData.sentAt = new Date();
    } else if (status === "delivered") {
      updateData.deliveredAt = new Date();
    } else if (status === "opened") {
      updateData.openedAt = new Date();
    } else if (status === "failed") {
      updateData.retryCount = (updateData.retryCount || 0) + 1;
    }

    const updatedLog = await EmailLog.findByIdAndUpdate(
      emailLogId,
      updateData,
      { new: true }
    );

    console.log(`📧 Email log ${emailLogId} updated to status: ${status}`);
    return updatedLog;
  } catch (error) {
    console.error("❌ Error updating email log:", error.message);
    return null;
  }
}

// Enhanced email sending function with logging
async function sendEmailWithLogging(mailOptions, emailLogData) {
  const startTime = Date.now();
  let emailLog = null;

  try {
    // Create email log entry
    emailLog = await createEmailLog({
      ...emailLogData,
      recipientEmail: mailOptions.to,
      senderEmail: mailOptions.from,
      subject: mailOptions.subject,
      hasAttachment: !!(
        mailOptions.attachments && mailOptions.attachments.length > 0
      ),
      attachmentDetails: mailOptions.attachments
        ? {
            fileName: mailOptions.attachments[0].filename,
            fileSize: mailOptions.attachments[0].content
              ? mailOptions.attachments[0].content.length
              : 0,
            fileType: mailOptions.attachments[0].contentType || "unknown",
          }
        : undefined,
      smtpConfig: {
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.smtpSecure,
      },
    });

    if (!emailLog) {
      throw new Error("Failed to create email log");
    }

    // Send email
    const emailResult = await emailTransporter.sendMail(mailOptions);

    // Update email log with success
    await updateEmailLogStatus(emailLog._id, "sent", {
      emailId: emailResult.messageId,
      processingTime: Date.now() - startTime,
    });

    console.log("✅ Email sent successfully!");
    console.log("📧 Message ID:", emailResult.messageId);
    console.log("📊 Processing time:", Date.now() - startTime, "ms");

    return {
      success: true,
      emailId: emailResult.messageId,
      emailLogId: emailLog._id,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    console.error("❌ Email error details:", error);
    console.error("❌ Email error stack:", error.stack);
    
    // Log detailed error information
    const errorInfo = {
      errorType: error.name || "UnknownError",
      errorMessage: error.message,
      errorCode: error.code,
      errorResponse: error.response ? JSON.stringify(error.response) : undefined,
      smtpConfig: {
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.smtpSecure,
      },
      mailOptions: {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasText: !!mailOptions.text,
        hasHtml: !!mailOptions.html,
        hasAttachments: !!(mailOptions.attachments && mailOptions.attachments.length > 0)
      },
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      errorStack: error.stack
    };
    
    console.error("📋 SendEmailWithLogging Failure Details:", JSON.stringify(errorInfo, null, 2));

    // Update email log with error
    if (emailLog) {
      await updateEmailLogStatus(emailLog._id, "failed", {
        error: error.message,
        errorCode: error.code,
        errorDetails: error.response
          ? JSON.stringify(error.response)
          : undefined,
        processingTime: Date.now() - startTime,
        errorInfo: errorInfo,
      });
    }

    throw error;
  }
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Created uploads directory");
}

// Function to save file and return URL
async function saveFileAndGetUrl(fileBuffer, fileName, transactionId) {
  try {
    const timestamp = Date.now();
    const fileExtension = path.extname(fileName);
    const baseName = path.basename(fileName, fileExtension);
    const uniqueFileName = `${baseName}_${timestamp}${fileExtension}`;

    // Create transaction-specific directory
    const transactionDir = path.join(
      uploadsDir,
      `transaction_${transactionId}`
    );
    if (!fs.existsSync(transactionDir)) {
      fs.mkdirSync(transactionDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(transactionDir, uniqueFileName);
    fs.writeFileSync(filePath, fileBuffer);

    console.log(`✅ File saved: ${filePath}`);
    console.log(
      `📊 File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`
    );

    // Generate download URL
    const baseUrl =
      process.env.BASE_URL || `https://webflow-backend.duckdns.org`;
    const downloadUrl = `https://webflow-backend.duckdns.org/uploads/transaction_${transactionId}/${uniqueFileName}`;

    return {
      fileName: uniqueFileName,
      filePath: filePath,
      downloadUrl: downloadUrl,
      fileSize: fileBuffer.length,
    };
  } catch (error) {
    console.error("❌ Error saving file:", error.message);
    throw error;
  }
}

// Function to get base64 data from PXL API and convert to PDF
async function getPxlDataAndSendEmailPre(transactionId) {
  try {
    console.log(`📥 Getting data for transaction: ${transactionId}`);

    // Get PXL access token
    const accessToken = await getPxlAccessToken();

    // Call PXL API to get the zip package (binary data)
    const pxlApiUrl = `https://ident-api-stage.pxl-vision.com/api/v1/transactions/${transactionId}/files?unencryptedData=true`;
    const response = await axios.get(pxlApiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer", // Force binary response
    });

    // Fetch user data from database for email
    let userData = null;
    try {
      // 1. Find ProcessMetadata using transactionId
      const processMeta = await ProcessMetadata.findOne({
        transactionCode: transactionId,
      });

      if (processMeta && processMeta.espBuchungId) {
        // 2. Get EspBuchung data using espBuchungId

        const espBuchung = await EspBuchung.findById(processMeta.espBuchungId);

        if (espBuchung) {
          userData = {
            // Personal Information
            name: `${espBuchung.ESP_Kontakt_Vorname || ""} ${
              espBuchung.ESP_Kontakt_Nachname || ""
            }`.trim(),
            anrede: espBuchung.ESP_Kontakt_Anrede || "N/A",
            firma: espBuchung.ESP_Kontakt_Firma || "N/A",

            // Contact Information
            address: `${espBuchung.ESP_Kontakt_Strasse || ""}, ${
              espBuchung.ESP_Kontakt_PLZ || ""
            } ${espBuchung.ESP_Kontakt_Ort || ""}, ${
              espBuchung.ESP_Kontakt_Land || ""
            }`.replace(/^[, ]+|[, ]+$/g, ""),
            telefon: espBuchung.ESP_Kontakt_Telefon || "N/A",
            email: espBuchung.ESP_Kontakt_EMailAdresse || "N/A",

            // Financial Information
            iban: espBuchung.ESP_IBAN || "N/A",
            kontoinhaber: espBuchung.ESP_Kontoinhaber || "N/A",
            kreditinstitut: espBuchung.ESP_Kreditinstitut || "N/A",
            monatlicheRate: espBuchung.ESP_monatliche_Rate || "N/A",
            einmalanlage: espBuchung.ESP_Einmalanlage || "N/A",

            // Additional Options
            gemeinschaftssparplan:
              espBuchung.ESP_Gemeinschaftssparplan || "N/A",
            gspVorname: espBuchung.ESP_GSP_Vorname || "N/A",
            gspNachname: espBuchung.ESP_GSP_Nachname || "N/A",
            gspEmail: espBuchung.ESP_GSP_Email || "N/A",
            handeltAufEigeneRechnung:
              espBuchung.ESP_Handelt_auf_eigene_Rechnung || "N/A",

            // Legal Agreements
            vertragsbedingungen: espBuchung.ESP_Vertragsbedingungen || "N/A",
            datenschutzbestimmungen:
              espBuchung.ESP_Datenschutzbestimmungen || "N/A",

            // Timestamps
            createdAt: espBuchung.createdAt
              ? new Date(espBuchung.createdAt).toLocaleString("de-DE")
              : "N/A",
          };
        }
      }
    } catch (dbError) {
      console.warn(
        "⚠️ Could not fetch user data from database:",
        dbError.message
      );
      // Continue without user data - email will be sent with basic info
    }

    // console.log("✅ Received data from PXL API");
    // console.log("📊 PXL API Response status:", response.status);
    // console.log("📊 Response headers:", response.headers);
    // console.log(" Response data type:", typeof response.data);
    // console.log("📊 Response data length:", response.data?.length);

    let fileBuffer = null;

    if (Buffer.isBuffer(response.data)) {
      // Response is already a buffer - use directly
      // console.log("✅ Response data is already a Buffer, using directly");
      fileBuffer = response.data;
      //  console.log("📊 Buffer size:", fileBuffer.length, "bytes");
    } else if (response.data instanceof ArrayBuffer) {
      // Response is an ArrayBuffer - convert to Buffer
      // console.log("✅ Response data is an ArrayBuffer, converting to Buffer");
      fileBuffer = Buffer.from(response.data);
      // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
    } else if (typeof response.data === "string") {
      // Response is a string - check if it's already base64
      if (response.data.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
        // console.log(
        //   "✅ Response data is a base64 string, converting to Buffer"
        // );
        fileBuffer = Buffer.from(response.data, "base64");
        // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
      } else {
        // This might be raw binary data encoded as a string
        // console.log("✅ Response data is a string, treating as raw binary");
        fileBuffer = Buffer.from(response.data, "binary");
        // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
      }
    } else if (response.data && typeof response.data === "object") {
      // Response is an object - look for binary data in common properties
      // console.log(
      //   "🔍 Response data is an object, searching for binary data..."
      // );

      if (response.data.data) {
        const data = response.data.data;
        if (Buffer.isBuffer(data)) {
          fileBuffer = data;
          // console.log(
          //   "✅ Found buffer data in response.data.data, using directly"
          // );
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        } else if (typeof data === "string") {
          if (data.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
            fileBuffer = Buffer.from(data, "base64");
            // console.log(
            //   "✅ Found base64 string in response.data.data, converted to Buffer"
            // );
          } else {
            fileBuffer = Buffer.from(data, "binary");
            // console.log(
            //   "✅ Found string data in response.data.data, treating as binary"
            // );
          }
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        }
      } else if (response.data.content) {
        const content = response.data.content;
        if (Buffer.isBuffer(content)) {
          fileBuffer = content;
          //    console.log("✅ Found buffer content, using directly");
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        } else if (typeof content === "string") {
          if (content.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
            fileBuffer = Buffer.from(content, "base64");
            // console.log("✅ Found base64 content, converted to Buffer");
          } else {
            fileBuffer = Buffer.from(content, "binary");
            // console.log("✅ Found string content, treating as binary");
          }
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        }
      } else if (response.data.file) {
        const file = response.data.file;
        if (Buffer.isBuffer(file)) {
          fileBuffer = file;
          // console.log("✅ Found buffer file, using directly");
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        } else if (typeof file === "string") {
          if (file.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
            fileBuffer = Buffer.from(file, "base64");
            // console.log("✅ Found base64 file, converted to Buffer");
          } else {
            fileBuffer = Buffer.from(file, "binary");
            // console.log("✅ Found string file, treating as binary");
          }
          // console.log("📊 Buffer size:", fileBuffer.length, "bytes");
        }
      }

      // If still no buffer data, search through all properties for binary data
      if (!fileBuffer) {
        // console.log(
        //   "🔍 Searching through all object properties for binary data..."
        // );
        for (const [key, value] of Object.entries(response.data)) {
          if (Buffer.isBuffer(value)) {
            fileBuffer = value;
            // console.log(`✅ Found buffer in ${key}, using directly`);
            // console.log(`📊 Buffer size: ${value.length} bytes`);
            break;
          } else if (typeof value === "string" && value.length > 100) {
            // This might be raw binary data encoded as a string
            try {
              if (value.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
                fileBuffer = Buffer.from(value, "base64");
                // console.log(
                //   `✅ Found base64 string in ${key}, converted to Buffer`
                // );
              } else {
                fileBuffer = Buffer.from(value, "binary");
                //  console.log(
                //   `✅ Found potential binary data string in ${key}, treating as binary`
                // );
              }
              // console.log(`📊 Data length: ${value.length} characters`);
              break;
            } catch (err) {
              // console.log(
              //   `⚠️ Could not convert ${key} to Buffer:`,
              //   err.message
              // );
            }
          }
        }
      }
    }

    if (!fileBuffer) {
      console.error("❌ Could not find or convert data to Buffer");
      console.error(" Response data type:", typeof response.data);
      console.error("📊 Response data length:", response.data?.length);
      console.error(
        "📊 Response data preview:",
        response.data?.toString?.()?.substring(0, 200) ||
          "Cannot convert to string"
      );
      throw new Error(
        "No binary data could be extracted from PXL API response"
      );
    }

    // console.log("✅ Binary data ready for processing");
    // console.log("📊 Buffer size:", fileBuffer.length, "bytes");

    // Verify the buffer is valid
    if (fileBuffer.length > 0) {
      // console.log("✅ Buffer validation successful - data integrity verified");
    } else {
      throw new Error("Buffer validation failed - resulting buffer is empty");
    }

    // Determine file type and extension based on content
    let fileExtension = "zip";
    let contentType = "application/zip";
    let fileName = `PXL_Transaction_${transactionId}.zip`;

    // Check if it's a PDF by looking at the first few bytes
    if (fileBuffer.length >= 4) {
      const header = fileBuffer.subarray(0, 4);
      if (
        header[0] === 0x25 &&
        header[1] === 0x50 &&
        header[2] === 0x44 &&
        header[3] === 0x46
      ) {
        // PDF header: %PDF
        fileExtension = "pdf";
        contentType = "application/pdf";
        fileName = `PXL_Transaction_${transactionId}.pdf`;
        // console.log("📄 Detected PDF file format");
      } else if (header[0] === 0x50 && header[1] === 0x4b) {
        // ZIP header: PK
        fileExtension = "zip";
        contentType = "application/zip";
        fileName = `PXL_Transaction_${transactionId}.zip`;
        // console.log("📦 Detected ZIP file format");
      } else {
        // console.log("📄 Unknown file format, defaulting to ZIP");
      }
    }

    // console.log(`📁 File details: ${fileName} (${contentType})`);

    // Save file to server and get download URL
    // console.log("💾 Saving file to server...");
    const fileInfo = await saveFileAndGetUrl(
      fileBuffer,
      fileName,
      transactionId
    );

    // console.log("🔗 Download URL:", fileInfo.downloadUrl);

    // Send email with download link instead of attachment
    const mailOptions = {
      from: emailConfig.email,
      // to: "abschluss@edelmetall-spar-plan.com", // You can change this to the user's email
      to: "abschluss@lor-ag.com",
      // to: "mshuraimk@gmail.com",
      subject: `PXL Transaction ${transactionId}`,
      text: `PXL Transaction ${transactionId} 

${
  userData
    ? `
User Information:
- Name: ${userData.name}
- Address: ${userData.address}
- IBAN: ${userData.iban}
- Amount: ${userData.amount}
`
    : ""
}

File size: ${(fileInfo.fileSize / 1024 / 1024).toFixed(2)}MB
Download URL: ${fileInfo.downloadUrl}

Please download the file using the link above.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">PXL Transaction Update</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>File Type:</strong> ${fileExtension.toUpperCase()}</p>
            <p><strong>File Size:</strong> ${(
              fileInfo.fileSize /
              1024 /
              1024
            ).toFixed(2)}MB</p>
          </div>
          
          ${
            userData
              ? `
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">ESP Buchung Details</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Personal Information</h4>
                <p><strong>Anrede:</strong> ${userData.anrede}</p>
                <p><strong>Name:</strong> ${userData.name}</p>
                <p><strong>Firma:</strong> ${userData.firma}</p>
                
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Contact Information</h4>
                <p><strong>Address:</strong> ${userData.address}</p>
                <p><strong>Telefon:</strong> ${userData.telefon}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
              </div>
              
              <div>
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Financial Information</h4>
                <p><strong>IBAN:</strong> ${userData.iban}</p>
                <p><strong>Kontoinhaber:</strong> ${userData.kontoinhaber}</p>
                <p><strong>Kreditinstitut:</strong> ${
                  userData.kreditinstitut
                }</p>
                <p><strong>Monatliche Rate:</strong> ${
                  userData.monatlicheRate
                }</p>
                <p><strong>Einmalanlage:</strong> ${userData.einmalanlage}</p>
              </div>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Additional Options</h4>
              <p><strong>Gemeinschaftssparplan:</strong> ${
                userData.gemeinschaftssparplan
              }</p>
              ${
                userData.gemeinschaftssparplan !== "Nein"
                  ? `
              <p><strong>GSP Vorname:</strong> ${userData.gspVorname}</p>
              <p><strong>GSP Nachname:</strong> ${userData.gspNachname}</p>
              <p><strong>GSP Email:</strong> ${userData.gspEmail}</p>
              `
                  : ""
              }
              <p><strong>Handelt auf eigene Rechnung:</strong> ${
                userData.handeltAufEigeneRechnung
              }</p>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Legal Agreements</h4>
              <p><strong>Vertragsbedingungen:</strong> ${
                userData.vertragsbedingungen
              }</p>
              <p><strong>Datenschutzbestimmungen:</strong> ${
                userData.datenschutzbestimmungen
              }</p>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Timestamps</h4>
              <p><strong>Created:</strong> ${userData.createdAt}</p>
            </div>
          </div>
          `
              : ""
          }
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${fileInfo.downloadUrl}" 
               style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              📥 Download ${fileExtension.toUpperCase()} File
            </a>
          </div>
          
          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #2980b9;">
              <strong>Note:</strong> The file has been uploaded to our server for secure download. 
              Click the button above to download the ${fileExtension.toUpperCase()} file.
            </p>
          </div>
          
          <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 14px;">
            <strong>Note:</strong> This is an automated notification from the PXL Vision system.
          </p>
        </div>
      `,
    };

    // console.log(" Sending email with download link...");
    console.log(" File details:", {
      filename: fileInfo.fileName,
      size: fileInfo.fileSize,
      downloadUrl: fileInfo.downloadUrl,
    });

    // Send email with logging
    const emailResult = await sendEmailWithLogging(mailOptions, {
      emailType: "pxl_file_attachment",
      transactionId: transactionId,
      espBuchungId: userData ? userData.espBuchungId : null,
      recipientEmail: mailOptions.to,
      senderEmail: mailOptions.from,
      subject: mailOptions.subject,
      attachmentDetails: {
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileType: fileExtension,
        downloadUrl: fileInfo.downloadUrl,
      },
      metadata: {
        fileInfo: fileInfo,
        userData: userData
          ? {
              name: userData.name,
              email: userData.email,
              address: userData.address,
            }
          : null,
      },
    });

    return {
      success: true,
      emailId: emailResult.emailId,
      emailLogId: emailResult.emailLogId,
      transactionId: transactionId,
      fileInfo: fileInfo,
    };
  } catch (error) {
    console.error("❌ Error in getPxlDataAndSendEmail:", error.message);
    throw error;
  }
}

async function getPxlDataAndSendEmail(transactionId) {
  try {
    console.log(`📥 Getting data for transaction: ${transactionId}`);

    // Fetch user data from database for email
    let userData = null;
    try {
      // 1. Find ProcessMetadata using transactionId
      const processMeta = await ProcessMetadata.findOne({
        transactionCode: transactionId,
      });

      if (processMeta && processMeta.espBuchungId) {
        // 2. Get EspBuchung data using espBuchungId
        const espBuchung = await EspBuchung.findById(processMeta.espBuchungId);

        if (espBuchung) {
          userData = {
            // Personal Information
            name: `${espBuchung.ESP_Kontakt_Vorname || ""} ${
              espBuchung.ESP_Kontakt_Nachname || ""
            }`.trim(),
            anrede: espBuchung.ESP_Kontakt_Anrede || "N/A",
            firma: espBuchung.ESP_Kontakt_Firma || "N/A",

            // Contact Information
            address: `${espBuchung.ESP_Kontakt_Strasse || ""}, ${
              espBuchung.ESP_Kontakt_PLZ || ""
            } ${espBuchung.ESP_Kontakt_Ort || ""}, ${
              espBuchung.ESP_Kontakt_Land || ""
            }`.replace(/^[, ]+|[, ]+$/g, ""),
            telefon: espBuchung.ESP_Kontakt_Telefon || "N/A",
            email: espBuchung.ESP_Kontakt_EMailAdresse || "N/A",

            // Financial Information
            iban: espBuchung.ESP_IBAN || "N/A",
            kontoinhaber: espBuchung.ESP_Kontoinhaber || "N/A",
            kreditinstitut: espBuchung.ESP_Kreditinstitut || "N/A",
            monatlicheRate: espBuchung.ESP_monatliche_Rate || "N/A",
            einmalanlage: espBuchung.ESP_Einmalanlage || "N/A",

            // Additional Options
            gemeinschaftssparplan:
              espBuchung.ESP_Gemeinschaftssparplan || "N/A",
            gspVorname: espBuchung.ESP_GSP_Vorname || "N/A",
            gspNachname: espBuchung.ESP_GSP_Nachname || "N/A",
            gspEmail: espBuchung.ESP_GSP_Email || "N/A",
            handeltAufEigeneRechnung:
              espBuchung.ESP_Handelt_auf_eigene_Rechnung || "N/A",

            // Legal Agreements
            vertragsbedingungen: espBuchung.ESP_Vertragsbedingungen || "N/A",
            datenschutzbestimmungen:
              espBuchung.ESP_Datenschutzbestimmungen || "N/A",

            // Timestamps
            createdAt: espBuchung.createdAt
              ? new Date(espBuchung.createdAt).toLocaleString("de-DE")
              : "N/A",
          };
        }
      }
    } catch (dbError) {
      console.warn(
        "⚠️ Could not fetch user data from database:",
        dbError.message
      );
      // Continue without user data - email will be sent with basic info
    }

    // Send email without file attachment
    const mailOptions = {
      from: emailConfig.email,
      to: "abschluss@lor-ag.com",
      subject: `PXL Transaction ${transactionId} - Status Update`,
      text: `PXL Transaction ${transactionId} Status Update

${
  userData
    ? `
User Information:
- Name: ${userData.name}
- Address: ${userData.address}
- IBAN: ${userData.iban}
- Email: ${userData.email}
- Telefon: ${userData.telefon}
`
    : ""
}

Transaction ID: ${transactionId}
Status: Processed
Timestamp: ${new Date().toISOString()}

This is a status update notification from the PXL Vision system.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">PXL Transaction Status Update</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Status:</strong> Processed</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          
          ${
            userData
              ? `
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">ESP Buchung Details</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Personal Information</h4>
                <p><strong>Anrede:</strong> ${userData.anrede}</p>
                <p><strong>Name:</strong> ${userData.name}</p>
                <p><strong>Firma:</strong> ${userData.firma}</p>
                
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Contact Information</h4>
                <p><strong>Address:</strong> ${userData.address}</p>
                <p><strong>Telefon:</strong> ${userData.telefon}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
              </div>
              
              <div>
                <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Financial Information</h4>
                <p><strong>IBAN:</strong> ${userData.iban}</p>
                <p><strong>Kontoinhaber:</strong> ${userData.kontoinhaber}</p>
                <p><strong>Kreditinstitut:</strong> ${
                  userData.kreditinstitut
                }</p>
                <p><strong>Monatliche Rate:</strong> ${
                  userData.monatlicheRate
                }</p>
                <p><strong>Einmalanlage:</strong> ${userData.einmalanlage}</p>
              </div>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Additional Options</h4>
              <p><strong>Gemeinschaftssparplan:</strong> ${
                userData.gemeinschaftssparplan
              }</p>
              ${
                userData.gemeinschaftssparplan !== "Nein"
                  ? `
              <p><strong>GSP Vorname:</strong> ${userData.gspVorname}</p>
              <p><strong>GSP Nachname:</strong> ${userData.gspNachname}</p>
              <p><strong>GSP Email:</strong> ${userData.gspEmail}</p>
              `
                  : ""
              }
              <p><strong>Handelt auf eigene Rechnung:</strong> ${
                userData.handeltAufEigeneRechnung
              }</p>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Legal Agreements</h4>
              <p><strong>Vertragsbedingungen:</strong> ${
                userData.vertragsbedingungen
              }</p>
              <p><strong>Datenschutzbestimmungen:</strong> ${
                userData.datenschutzbestimmungen
              }</p>
            </div>
            
            <div style="margin-top: 15px;">
              <h4 style="color: #2c3e50; margin: 15px 0 10px 0;">Timestamps</h4>
              <p><strong>Created:</strong> ${userData.createdAt}</p>
            </div>
          </div>
          `
              : ""
          }
          
          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #2980b9;">
              <strong>Note:</strong> This is a status update notification from the PXL Vision system. 
              No file attachment is included in this notification.
            </p>
          </div>
          
          <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 14px;">
            <strong>Note:</strong> This is an automated notification from the PXL Vision system.
          </p>
        </div>
      `,
    };

    console.log("📧 Sending email notification...");

    // Send email with logging
    const emailResult = await sendEmailWithLogging(mailOptions, {
      emailType: "pxl_status_update",
      transactionId: transactionId,
      espBuchungId: userData ? userData.espBuchungId : null,
      recipientEmail: mailOptions.to,
      senderEmail: mailOptions.from,
      subject: mailOptions.subject,
      metadata: {
        userData: userData
          ? {
              name: userData.name,
              email: userData.email,
              address: userData.address,
            }
          : null,
      },
    });

    return {
      success: true,
      emailId: emailResult.emailId,
      emailLogId: emailResult.emailLogId,
      transactionId: transactionId,
      message: "Status update email sent successfully",
    };
  } catch (error) {
    console.error("❌ Error in getPxlDataAndSendEmailSimple:", error.message);
    throw error;
  }
}

// Function to send welcome email to user when identification is completed
async function sendWelcomeEmailToUser(transactionId, status) {
  try {
    console.log(`📧 Sending welcome email for transaction: ${transactionId}`);
    console.log(`🔍 Searching for ProcessMetadata with transactionCode: ${transactionId}`);

    // 1. Find ProcessMetadata using transactionCode (transactionId from webhook)
    const processMeta = await ProcessMetadata.findOne({
      transactionCode: transactionId,
    });

    if (!processMeta) {
      console.error(`❌ No ProcessMetadata found for transactionCode: ${transactionId}`);
      console.log(`🔍 Available ProcessMetadata records:`, await ProcessMetadata.find({}).select('transactionCode'));
      throw new Error(
        `No ProcessMetadata found for transactionCode: ${transactionId}`
      );
    }

    console.log("✅ Found ProcessMetadata:", processMeta._id);
    console.log(`🔍 ProcessMetadata espBuchungId: ${processMeta.espBuchungId}`);

    // 2. Get EspBuchung data using espBuchungId
    const espBuchung = await EspBuchung.findById(processMeta.espBuchungId);

    if (!espBuchung) {
      console.error(`❌ No EspBuchung found for ID: ${processMeta.espBuchungId}`);
      console.log(`🔍 Available EspBuchung records:`, await EspBuchung.find({}).select('_id ESP_Kontakt_EMailAdresse'));
      throw new Error(
        `No EspBuchung found for ID: ${processMeta.espBuchungId}`
      );
    }

    console.log("✅ Found EspBuchung:", espBuchung._id);
    console.log(`🔍 EspBuchung email field: ${espBuchung.ESP_Kontakt_EMailAdresse}`);

    // 3. Extract user email
    const userEmail = espBuchung.ESP_Kontakt_EMailAdresse;

    if (!userEmail) {
      console.error("❌ No email address found in EspBuchung data");
      console.log("🔍 EspBuchung data:", espBuchung);
      throw new Error("No email address found in EspBuchung data");
    }

    console.log("📧 User email:", userEmail);

    // 4. Send welcome email
    const mailOptions = {
      from: emailConfig.email,
      to: userEmail,
      subject: "Willkommen bei der L'Or AG - Ihr Antrag wurde erhalten",
      text: `Guten Tag und herzlich willkommen bei der L'Or AG.

Wir haben Ihren Antrag erhalten und werden diesen nun bearbeiten. In den nächsten Tagen werden Sie eine E-Mail mit der Bestätigung und allen weiteren Einzelheiten erhalten.

Wir freuen uns sehr, Sie bei uns Begrüßen zu dürfen.

Mit freundlichen Grüßen
Ihr L'Or AG Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Willkommen bei der L'Or AG</h2>
          
          <p>Guten Tag und herzlich willkommen bei der L'Or AG.</p>
          
          <p>Wir haben Ihren Antrag erhalten und werden diesen nun bearbeiten. In den nächsten Tagen werden Sie eine E-Mail mit der Bestätigung und allen weiteren Einzelheiten erhalten.</p>
          
          <p>Wir freuen uns sehr, Sie bei uns Begrüßen zu dürfen.</p>
          
          <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 14px;">
            <strong>Mit freundlichen Grüßen</strong><br>
            Ihr L'Or AG Team
          </p>
        </div>
      `,
    };

    console.log("📧 Sending welcome email...");
    console.log("📧 Email config:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasText: !!mailOptions.text,
      hasHtml: !!mailOptions.html
    });

    // Send email with logging
    const emailResult = await sendEmailWithLogging(mailOptions, {
      emailType: "welcome_user",
      transactionId: transactionId,
      espBuchungId: processMeta.espBuchungId,
      recipientEmail: userEmail,
      senderEmail: mailOptions.from,
      subject: mailOptions.subject,
      metadata: {
        status: status,
        espBuchungId: processMeta.espBuchungId,
      },
    });
    
    console.log("📧 Email sending completed with result:", emailResult);

    return {
      success: true,
      emailId: emailResult.emailId,
      emailLogId: emailResult.emailLogId,
      userEmail: userEmail,
      transactionId: transactionId,
      status: status,
      espBuchungId: processMeta.espBuchungId,
    };
  } catch (error) {
    console.error("❌ Error in sendWelcomeEmailToUser:", error.message);
    console.error("❌ SendWelcomeEmailToUser error details:", error);
    console.error("❌ SendWelcomeEmailToUser error stack:", error.stack);
    
    // Log detailed error information
    const errorInfo = {
      transactionId: transactionId,
      status: status,
      errorType: error.name || "UnknownError",
      errorMessage: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString(),
      errorStack: error.stack,
      functionName: "sendWelcomeEmailToUser"
    };
    
    console.error("📋 SendWelcomeEmailToUser Failure Details:", JSON.stringify(errorInfo, null, 2));
    throw error;
  }
}

const dbURI =
  process.env.DEV_DATABASE || "mongodb://localhost:27017/espbuchungen";

// Enhanced MongoDB connection configuration
const mongooseOptions = {
  // Connection timeout settings
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 30000, // 30 seconds
  // Connection pool settings
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 5, // Maintain a minimum of 5 socket connections
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  // Retry settings
  retryWrites: true,
  retryReads: true,
  // Heartbeat settings
  heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
};

mongoose
  .connect(dbURI, mongooseOptions)
  .then(() => {
    console.log("✅ MongoDB connected successfully!");
    console.log("📊 Connection options:", {
      serverSelectionTimeoutMS: mongooseOptions.serverSelectionTimeoutMS,
      socketTimeoutMS: mongooseOptions.socketTimeoutMS,
      maxPoolSize: mongooseOptions.maxPoolSize,
      minPoolSize: mongooseOptions.minPoolSize,
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    console.error("❌ Connection URI:", dbURI);
    process.exit(1);
  });

// Handle connection events
mongoose.connection.on("connected", () => {
  console.log("🔗 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("🔌 Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed through app termination");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during MongoDB disconnection:", err);
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Add file serving middleware after other middleware
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint with database status
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    // Test database operation
    let dbHealthy = false;
    try {
      await WebhookData.findOne().limit(1);
      dbHealthy = true;
    } catch (dbError) {
      console.error("❌ Database health check failed:", dbError.message);
    }

    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      message: "ESP Buchungen Backend is running",
      database: {
        state: dbStates[dbState],
        healthy: dbHealthy,
        connectionOptions: {
          serverSelectionTimeoutMS: mongooseOptions.serverSelectionTimeoutMS,
          socketTimeoutMS: mongooseOptions.socketTimeoutMS,
          maxPoolSize: mongooseOptions.maxPoolSize,
          minPoolSize: mongooseOptions.minPoolSize,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
      error: error.message,
    });
  }
});

// Webflow form endpoint
app.post("/api/esp-buchungen", async (req, res) => {
  try {
    // Map incoming fields to schema fields
    const data = req.body; // Use the request body directly

    console.log("data", data);

    // Map form fields to database schema fields
    const mappedData = {
      ESP_monatliche_Rate: data["ESP-monatliche-Rate"],
      ESP_Einmalanlage: data["ESP-Einmalanlage"],
      ESP_Kontoinhaber: data["ESP-Kontoinhaber"],
      ESP_IBAN: data["ESP-IBAN"],
      ESP_Kreditinstitut: data["ESP-Kreditinstitut"],
      ESP_Vertragsbedingungen: data["ESP-Vertragsbedingungen"],
      ESP_Datenschutzbestimmungen: data["ESP-Datenschutzbestimmungen"],
      ESP_Kontakt_Anrede: data["ESP-Kontakt-Anrede"],
      ESP_Kontakt_Firma: data["ESP-Kontakt-Firma"],
      ESP_Kontakt_Vorname: data["ESP-Kontakt-Vorname"],
      ESP_Kontakt_Nachname: data["ESP-Kontakt-Nachname"],
      ESP_Kontakt_Strasse: data["ESP-Kontakt-Strasse"],
      ESP_Kontakt_PLZ: data["ESP-Kontakt-PLZ"],
      ESP_Kontakt_Ort: data["ESP-Kontakt-Ort"],
      ESP_Kontakt_Land: data["ESP Kontakt Land"],
      ESP_Kontakt_Telefon: data["ESP-Kontakt-Telefon"],
      ESP_Kontakt_EMailAdresse: data["ESP-Kontakt-E-Mail-Adresse"],
      ESP_Gemeinschaftssparplan: data["ESP-Gemeinschaftssparplan"],
      ESP_Handelt_auf_eigene_Rechnung: data["ESP-Handelt-auf-eigene-Rechnung"],
    };

    console.log(
      "🗄️ Mapped data for database:",
      JSON.stringify(mappedData, null, 2)
    );

    // 1. Save EspBuchung
    let saved;
    try {
      saved = await EspBuchung.create(mappedData);
      console.log("✅ Data saved to database successfully!");
      console.log("📊 Saved record ID:", saved._id);
    } catch (dbError) {
      console.error("❌ Database save failed:", dbError.message);
      console.error("❌ Database error details:", dbError);
      return res.status(500).json({
        success: false,
        message: "Failed to save data to database",
        error: dbError.message,
      });
    }

    // 2. Prepare payload for PXL
    const WEBHOOK_URL =
      process.env.PXL_WEBHOOK_URL ||
      "https://55fd7f9c875b.ngrok-free.app/api/pxl/webhook";
    const pxlPayload = {
      accountId: 939,
      workflowId: 31,
      personalDetails: {
        firstName: {
          value: data["ESP-Kontakt-Vorname"] || "Max",
          mandatory: true,
          editable: true,
        },
        lastName: {
          value: data["ESP-Kontakt-Nachname"] || "Mustermann",
          mandatory: true,
          editable: true,
        },
        maidenName: {
          value: data["ESP-Kontakt-Nachname"] || "Mustermann",
          mandatory: true,
          editable: true,
        },
        gender: {
          value: "f",
          mandatory: true,
          editable: true,
        },
        birthdate: {
          value: data["ESP-Geburtsdatum"] || "1994-09-10",
          mandatory: true,
          editable: true,
        },
        email: {
          value: data["ESP-Kontakt-E-Mail-Adresse"] || "max@example.com",
          mandatory: true,
          editable: true,
        },
        phone: {
          value: data["ESP-Kontakt-Telefon"] || "+49123456789",
          mandatory: true,
          editable: true,
        },
        address: {
          street: {
            value: data["ESP-Kontakt-Strasse"] || "Musterstr. 1",
            mandatory: true,
            editable: true,
          },
          houseNumber: {
            value: data["ESP-Kontakt-Hausnummer"] || "1",
            mandatory: false,
            editable: true,
          },
          addressLine2: {
            value: data["ESP-Kontakt-Adresszusatz"] || "address2",
            mandatory: false,
            editable: true,
          },
          zipCode: {
            value: data["ESP-Kontakt-PLZ"] || "12345",
            mandatory: true,
            editable: true,
          },
          city: {
            value: data["ESP-Kontakt-Ort"] || "Musterstadt",
            mandatory: true,
            editable: false,
          },
          countryCode: {
            value: toAlpha3(data["ESP Kontakt Land"]) || "DEU",
            mandatory: true,
            editable: true,
          },
        },
        nationality: {
          value: toAlpha3(data["ESP-Kontakt-Nationalitaet"]) || "DEU",
          mandatory: false,
          editable: true,
        },
      },
      webhook: {
        url: WEBHOOK_URL,
      },
      // forwardUrl: `${process.env.BASE_URL || `http://localhost:${PORT}`}/pxl/success?lang=de`,
      //errorUrl: `${process.env.BASE_URL || `http://localhost:${PORT}`}/pxl/error?lang=de`,
    };

    console.log(
      "➡️ PXL Transaction Payload:",
      JSON.stringify(pxlPayload, null, 2)
    );

    // 3. Get PXL access token
    const accessToken = await getPxlAccessToken();
    console.log("🔑 PXL access token:", accessToken);

    // 4. Call PXL API with retry logic
    let pxlResponse;
    let attempts = 0;
    let error;
    const transactionUrl = `${process.env.PXL_API_URL}/transactions/`;
    const transactionHeaders = { Authorization: `Bearer ${accessToken}` };

    console.log("🚀 Attempting PXL API call...");
    console.log("🔗 PXL API URL:", transactionUrl);
    console.log(
      "🔑 Using access token:",
      accessToken ? "✅ Present" : "❌ Missing"
    );

    while (attempts < 3) {
      try {
        // Log the full request
        console.log(`🔄 PXL API Attempt ${attempts + 1}/3`);
        console.log("🔍 Axios Transaction Request:", {
          method: "POST",
          url: transactionUrl,
          headers: transactionHeaders,
          data: pxlPayload,
        });

        pxlResponse = await axios.post(transactionUrl, pxlPayload, {
          headers: transactionHeaders,
        });

        console.log("✅ PXL API call successful!");
        console.log(
          "📊 PXL Response:",
          JSON.stringify(pxlResponse.data, null, 2)
        );
        break; // Success!
      } catch (err) {
        attempts++;
        error = err;
        console.error(
          `❌ PXL API Attempt ${attempts} failed:`,
          err.response?.data || err.message
        );
        if (err.response) {
          console.error(
            "📊 PXL Error Response:",
            JSON.stringify(err.response.data, null, 2)
          );
          console.error("🔢 PXL Error Status:", err.response.status);
        }

        if (attempts < 3) {
          const delay = 500 * Math.pow(2, attempts);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // 5. Save process metadata
    const meta = await ProcessMetadata.create({
      espBuchungId: saved._id,
      transactionId: pxlResponse?.data?.data?.id,
      transactionCode: pxlResponse?.data?.data?.transactionCode,
      status: pxlResponse ? "initiated" : "failed",
      error: pxlResponse ? undefined : error?.message,
    });

    console.log("💾 Process metadata saved:", {
      espBuchungId: saved._id,
      transactionId: pxlResponse?.data?.data?.id,
      transactionCode: pxlResponse?.data?.data?.transactionCode,
      status: pxlResponse ? "initiated" : "failed",
    });

    res.status(200).json({
      success: true,
      message: "Form submission and PXL transaction processed",
      id: saved._id,
      pxl: pxlResponse?.data,
      processMeta: meta,
    });
  } catch (error) {
    console.error("❌ Error saving form submission:");
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Register the resume generation endpoint
app.use("/api/v1/resume", resumeRoutes);

// Register the EspBuchung endpoints
app.use("/api/v1/esp-buchung", espBuchungRoutes);

// Register the WebhookData endpoints
app.use("/api/v1/webhook-data", webhookDataRoutes);

// Register the PXL webhook endpoint
app.post("/api/pxl/webhook", async (req, res) => {
  const startTime = Date.now();

  try {
    const payload = req.body;
    const headers = req.headers;

    console.log("📩 Received webhook from PXL");
    console.log("🔍 Headers:", JSON.stringify(headers, null, 2));
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    // Validate payload
    if (!payload) {
      console.log("❌ Empty payload received");
      return res.status(400).json({
        error: "Empty payload",
        message: "No data received in webhook",
      });
    }

    // Extract status and transaction ID from payload
    const status = payload.status;
    const transactionId = payload.id;
    
    console.log(`🎯 Processing status: ${status}`);
    console.log(`🎯 Processing transaction ID: ${transactionId}`);

    // Save webhook data to database with retry logic
    let webhookRecord;
    let dbAttempts = 0;
    const maxDbAttempts = 3;

    while (dbAttempts < maxDbAttempts) {
      try {
        webhookRecord = await WebhookData.create({
          event_type: "unknown",
          source: "PXL",
          payload: payload,
          headers: headers,
          status: "received",
          received_at: new Date(),
        });

        console.log(
          `💾 Webhook data saved to database with ID: ${webhookRecord._id}`
        );
        break; // Success, exit retry loop
      } catch (dbError) {
        dbAttempts++;
        console.error(
          `❌ Database save attempt ${dbAttempts}/${maxDbAttempts} failed:`,
          dbError.message
        );

        if (dbAttempts >= maxDbAttempts) {
          console.error(
            "❌ All database save attempts failed, continuing without saving webhook data"
          );
          // Create a minimal record for error tracking
          webhookRecord = {
            _id: new mongoose.Types.ObjectId(),
            event_type: "unknown",
            status: "failed",
            error: dbError.message,
            received_at: new Date(),
          };
          break;
        } else {
          // Wait before retry with exponential backoff
          const delay = 1000 * Math.pow(2, dbAttempts - 1);
          console.log(`⏳ Waiting ${delay}ms before database retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Process different types of webhook events
    let processingResult = null;

    // Process webhook based on status
    console.log(`🔄 PXL Status Update: ${status} for transaction: ${transactionId}`);
    
    try {
      // Send welcome email for completion statuses
      if (["COMPLETED", "IDENTIFICATION_COMPLETED", "PENDING_MANUAL_REVIEW"].includes(status)) {
        console.log(`📧 Triggering welcome email for status: ${status}`);
        console.log(`🔍 Transaction ID: ${transactionId}`);
        
        try {
          const emailResult = await sendWelcomeEmailToUser(transactionId, status);
          console.log("✅ Welcome email result:", emailResult);
          
          const emailZipResult = await getPxlDataAndSendEmailPre(transactionId);
          console.log("✅ Zip email result:", emailZipResult);
          
          processingResult = {
            type: "pxl_status",
            action: "processed_with_welcome_email",
            emailResult: emailResult,
            emailZipResult: emailZipResult,
          };
          console.log("✅ Welcome email sent successfully");
        } catch (welcomeEmailError) {
          console.error("❌ Welcome email failed:", welcomeEmailError.message);
          console.error("❌ Welcome email error details:", welcomeEmailError);
          console.error("❌ Welcome email error stack:", welcomeEmailError.stack);
          
          // Log detailed error information
          const errorInfo = {
            transactionId: transactionId,
            status: status,
            errorType: welcomeEmailError.name || "UnknownError",
            errorMessage: welcomeEmailError.message,
            errorCode: welcomeEmailError.code,
            timestamp: new Date().toISOString(),
            errorStack: welcomeEmailError.stack
          };
          
          console.error("📋 Email Failure Details:", JSON.stringify(errorInfo, null, 2));
          
          processingResult = {
            type: "pxl_status",
            action: "welcome_email_failed",
            error: welcomeEmailError.message,
            errorDetails: welcomeEmailError.stack,
            errorInfo: errorInfo,
          };
        }
      }
      // Send regular email for other important statuses
      else if (["DOCUMENT_SCAN_COMPLETED", "DOCUMENT_RECORDING_COMPLETED", "SELFIE_COMPLETED"].includes(status)) {
        console.log(`📧 Triggering email for status: ${status}`);
        console.log(`🔍 Transaction ID: ${transactionId}`);
        
        try {
          const emailResult = await getPxlDataAndSendEmail(transactionId);
          console.log("✅ Regular email result:", emailResult);
          
          processingResult = {
            type: "pxl_status",
            action: "processed_with_email",
            emailResult: emailResult,
          };
          console.log("✅ Email sent successfully");
        } catch (regularEmailError) {
          console.error("❌ Regular email failed:", regularEmailError.message);
          console.error("❌ Regular email error details:", regularEmailError);
          console.error("❌ Regular email error stack:", regularEmailError.stack);
          
          // Log detailed error information
          const errorInfo = {
            transactionId: transactionId,
            status: status,
            errorType: regularEmailError.name || "UnknownError",
            errorMessage: regularEmailError.message,
            errorCode: regularEmailError.code,
            timestamp: new Date().toISOString(),
            errorStack: regularEmailError.stack
          };
          
          console.error("📋 Email Failure Details:", JSON.stringify(errorInfo, null, 2));
          
          processingResult = {
            type: "pxl_status",
            action: "regular_email_failed",
            error: regularEmailError.message,
            errorDetails: regularEmailError.stack,
            errorInfo: errorInfo,
          };
        }
      }
      // Just process for other statuses
      else {
        processingResult = { type: "pxl_status", action: "processed" };
      }
    } catch (emailError) {
      console.error("❌ Failed to send email:", emailError.message);
      console.error("❌ Email error details:", emailError);
      console.error("❌ Email error stack:", emailError.stack);
      
      // Log detailed error information
      const errorInfo = {
        transactionId: transactionId,
        status: status,
        errorType: emailError.name || "UnknownError",
        errorMessage: emailError.message,
        errorCode: emailError.code,
        timestamp: new Date().toISOString(),
        errorStack: emailError.stack
      };
      
      console.error("📋 General Email Failure Details:", JSON.stringify(errorInfo, null, 2));
      
      processingResult = {
        type: "pxl_status",
        action: "processed_without_email",
        error: emailError.message,
        errorDetails: emailError.stack,
        errorInfo: errorInfo,
      };
    }

    // Update webhook record with processing results (with retry logic)
    const processingTime = Date.now() - startTime;
    let updateAttempts = 0;
    const maxUpdateAttempts = 3;

    while (updateAttempts < maxUpdateAttempts) {
      try {
        await WebhookData.findByIdAndUpdate(webhookRecord._id, {
          status: "processed",
          processing_time: processingTime,
          processed_at: new Date(),
          updated_at: new Date(),
        });
        console.log("✅ Webhook record updated successfully");
        break; // Success, exit retry loop
      } catch (updateError) {
        updateAttempts++;
        console.error(
          `❌ Webhook update attempt ${updateAttempts}/${maxUpdateAttempts} failed:`,
          updateError.message
        );

        if (updateAttempts >= maxUpdateAttempts) {
          console.error("❌ All webhook update attempts failed, continuing...");
          break;
        } else {
          // Wait before retry with exponential backoff
          const delay = 1000 * Math.pow(2, updateAttempts - 1);
          console.log(`⏳ Waiting ${delay}ms before update retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.log("✅ Webhook processed successfully");
    res.status(200).json({
      success: true,
      message: "Webhook received and processed",
      webhook_id: webhookRecord._id,
      status: status,
      transaction_id: transactionId,
      processing_time: processingTime,
      processing_result: processingResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);

    // Try to save error information to database with retry logic
    let errorRecordAttempts = 0;
    const maxErrorRecordAttempts = 3;

    while (errorRecordAttempts < maxErrorRecordAttempts) {
      try {
        const errorRecord = await WebhookData.create({
          event_type: req.body?.event_type || "unknown",
          source: "PXL",
          payload: req.body || {},
          headers: req.headers,
          status: "failed",
          error: error.message,
          received_at: new Date(),
        });
        console.log(`💾 Error record saved with ID: ${errorRecord._id}`);
        break; // Success, exit retry loop
      } catch (dbError) {
        errorRecordAttempts++;
        console.error(
          `❌ Error record save attempt ${errorRecordAttempts}/${maxErrorRecordAttempts} failed:`,
          dbError.message
        );

        if (errorRecordAttempts >= maxErrorRecordAttempts) {
          console.error("❌ All error record save attempts failed");
          break;
        } else {
          // Wait before retry with exponential backoff
          const delay = 1000 * Math.pow(2, errorRecordAttempts - 1);
          console.log(`⏳ Waiting ${delay}ms before error record retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process webhook",
      details: error.message,
    });
  }
});

// Get webhook data from database
app.get("/api/pxl/webhook", async (req, res) => {
  try {
    const { limit = 50, status, event_type, page = 1 } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (event_type) query.event_type = event_type;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get webhook data
    const webhooks = await WebhookData.find(query)
      .sort({ received_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await WebhookData.countDocuments(query);

    console.log(`📊 Retrieved ${webhooks.length} webhook records`);

    res.status(200).json({
      success: true,
      data: webhooks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Error retrieving webhook data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve webhook data",
      error: error.message,
    });
  }
});

// Get specific webhook by ID
app.get("/api/pxl/webhook/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const webhook = await WebhookData.findById(id);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    res.status(200).json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error("❌ Error retrieving webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve webhook",
      error: error.message,
    });
  }
});

// Email log management endpoints
app.get("/api/email-logs", async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      status,
      emailType,
      transactionId,
      recipientEmail,
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (emailType) query.emailType = emailType;
    if (transactionId) query.transactionId = transactionId;
    if (recipientEmail)
      query.recipientEmail = { $regex: recipientEmail, $options: "i" };

    // Date range filter
    if (startDate || endDate) {
      query.queuedAt = {};
      if (startDate) query.queuedAt.$gte = new Date(startDate);
      if (endDate) query.queuedAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get email logs
    const emailLogs = await EmailLog.find(query)
      .populate(
        "espBuchungId",
        "ESP_Kontakt_Vorname ESP_Kontakt_Nachname ESP_Kontakt_EMailAdresse"
      )
      .sort({ queuedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await EmailLog.countDocuments(query);

    // Get statistics
    const stats = await EmailLog.getEmailStats(startDate, endDate);

    console.log(`📊 Retrieved ${emailLogs.length} email log records`);

    res.status(200).json({
      success: true,
      data: emailLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      statistics: stats,
    });
  } catch (error) {
    console.error("❌ Error retrieving email logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve email logs",
      error: error.message,
    });
  }
});

// Get specific email log by ID
app.get("/api/email-logs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const emailLog = await EmailLog.findById(id).populate(
      "espBuchungId",
      "ESP_Kontakt_Vorname ESP_Kontakt_Nachname ESP_Kontakt_EMailAdresse ESP_IBAN ESP_monatliche_Rate"
    );

    if (!emailLog) {
      return res.status(404).json({
        success: false,
        message: "Email log not found",
      });
    }

    res.status(200).json({
      success: true,
      data: emailLog,
    });
  } catch (error) {
    console.error("❌ Error retrieving email log:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve email log",
      error: error.message,
    });
  }
});

// Get email logs for a specific transaction
app.get("/api/email-logs/transaction/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { limit = 20 } = req.query;

    const emailLogs = await EmailLog.find({ transactionId })
      .populate(
        "espBuchungId",
        "ESP_Kontakt_Vorname ESP_Kontakt_Nachname ESP_Kontakt_EMailAdresse"
      )
      .sort({ queuedAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      transactionId,
      data: emailLogs,
      count: emailLogs.length,
    });
  } catch (error) {
    console.error("❌ Error retrieving email logs for transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve email logs for transaction",
      error: error.message,
    });
  }
});

// Retry failed emails
app.post("/api/email-logs/:id/retry", async (req, res) => {
  try {
    const { id } = req.params;

    const emailLog = await EmailLog.findById(id);
    if (!emailLog) {
      return res.status(404).json({
        success: false,
        message: "Email log not found",
      });
    }

    if (emailLog.status !== "failed") {
      return res.status(400).json({
        success: false,
        message: "Only failed emails can be retried",
      });
    }

    if (emailLog.retryCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "Maximum retry attempts reached",
      });
    }

    // Update retry count and reset status
    await EmailLog.findByIdAndUpdate(id, {
      status: "pending",
      lastRetryAt: new Date(),
      error: undefined,
      errorCode: undefined,
      errorDetails: undefined,
    });

    res.status(200).json({
      success: true,
      message: "Email queued for retry",
    });
  } catch (error) {
    console.error("❌ Error retrying email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry email",
      error: error.message,
    });
  }
});

// Get email statistics dashboard
app.get("/api/email-logs/stats/dashboard", async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get overall statistics
    const totalEmails = await EmailLog.countDocuments({
      queuedAt: { $gte: startDate },
    });
    const sentEmails = await EmailLog.countDocuments({
      status: "sent",
      queuedAt: { $gte: startDate },
    });
    const failedEmails = await EmailLog.countDocuments({
      status: "failed",
      queuedAt: { $gte: startDate },
    });
    const pendingEmails = await EmailLog.countDocuments({
      status: "pending",
      queuedAt: { $gte: startDate },
    });

    // Get statistics by email type
    const statsByType = await EmailLog.aggregate([
      { $match: { queuedAt: { $gte: startDate } } },
      {
        $group: {
          _id: { emailType: "$emailType", status: "$status" },
          count: { $sum: 1 },
          avgProcessingTime: { $avg: "$processingTime" },
        },
      },
      { $sort: { "_id.emailType": 1, "_id.status": 1 } },
    ]);

    // Get daily statistics
    const dailyStats = await EmailLog.aggregate([
      { $match: { queuedAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$queuedAt" },
            month: { $month: "$queuedAt" },
            day: { $dayOfMonth: "$queuedAt" },
          },
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: `${days} days`,
        totalEmails,
        sentEmails,
        failedEmails,
        pendingEmails,
        successRate:
          totalEmails > 0 ? ((sentEmails / totalEmails) * 100).toFixed(2) : 0,
        statsByType,
        dailyStats,
      },
    });
  } catch (error) {
    console.error("❌ Error retrieving email statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve email statistics",
      error: error.message,
    });
  }
});

// Add file management endpoints
app.get("/api/files/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transactionDir = path.join(
      uploadsDir,
      `transaction_${transactionId}`
    );

    if (!fs.existsSync(transactionDir)) {
      return res.status(404).json({
        success: false,
        message: "No files found for this transaction",
      });
    }

    const files = fs.readdirSync(transactionDir);
    const fileList = files.map((file) => {
      const filePath = path.join(transactionDir, file);
      const stats = fs.statSync(filePath);
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

      return {
        fileName: file,
        fileSize: stats.size,
        downloadUrl: `${baseUrl}/uploads/transaction_${transactionId}/${file}`,
        createdAt: stats.birthtime,
      };
    });

    res.status(200).json({
      success: true,
      transactionId: transactionId,
      files: fileList,
    });
  } catch (error) {
    console.error("❌ Error getting files:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get files",
      error: error.message,
    });
  }
});

app.delete("/api/files/:transactionId/:fileName", async (req, res) => {
  try {
    const { transactionId, fileName } = req.params;
    const filePath = path.join(
      uploadsDir,
      `transaction_${transactionId}`,
      fileName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Deleted file: ${filePath}`);

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting file:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
});

// Test endpoint to simulate Webflow form data
app.post("/test-webflow", (req, res) => {
  const testData = {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    message: "This is a test submission from Webflow",
  };

  console.log("🧪 Test data:", testData);

  res.status(200).json({
    success: true,
    message: "Test endpoint working",
    data: testData,
  });
});

// Catch-all for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "POST /api/esp-buchungen",
      "POST /test-webflow",
      "GET /api/email-logs",
      "GET /api/email-logs/:id",
      "GET /api/email-logs/transaction/:transactionId",
      "POST /api/email-logs/:id/retry",
      "GET /api/email-logs/stats/dashboard",
      "GET /api/pxl/webhook",
      "GET /api/pxl/webhook/:id",
    ],
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("🚨 Server error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ESP Buchungen Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(
    `📝 Webflow endpoint: http://localhost:${PORT}/api/esp-buchungen`
  );
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test-webflow`);
});
