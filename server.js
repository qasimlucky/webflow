const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const nodemailer = require("nodemailer");
const ProcessMetadata = require("./src/api/v1/model/ProcessMetadata");
const WebhookData = require("./src/api/v1/model/WebhookData");
const resumeRoutes = require("./src/api/v1/routes/resume");
const countries = require("i18n-iso-countries");

function toAlpha3(countryCode) {
  if (!countryCode) return "DEU"; // default fallback
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

// Debug email configuration
console.log("📧 Email Configuration Debug:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ Set" : "❌ Missing");
console.log(
  "EMAIL_PASSWORD:",
  process.env.EMAIL_PASSWORD ? "✅ Set" : "❌ Missing"
);
console.log(
  "EMAIL_SMTP_HOST:",
  process.env.EMAIL_SMTP_HOST ? "✅ Set" : "❌ Missing"
);
console.log(
  "EMAIL_SMTP_PORT:",
  process.env.EMAIL_SMTP_PORT ? "✅ Set" : "❌ Missing"
);
console.log("EMAIL_SMTP_SECURE:", process.env.EMAIL_SMTP_SECURE);
console.log("EMAIL_SMTP_REQUIRE_AUTH:", process.env.EMAIL_SMTP_REQUIRE_AUTH);

// Show actual values (be careful with password)
console.log("🔍 Actual Values:");
console.log("EMAIL_USER value:", process.env.EMAIL_USER);
console.log(
  "EMAIL_PASSWORD value:",
  process.env.EMAIL_PASSWORD ? "***SET***" : "NOT SET"
);
console.log("EMAIL_SMTP_HOST value:", process.env.EMAIL_SMTP_HOST);
console.log("EMAIL_SMTP_PORT value:", process.env.EMAIL_SMTP_PORT);
console.log("EMAIL_SMTP_SECURE value:", process.env.EMAIL_SMTP_SECURE);
console.log(
  "EMAIL_SMTP_REQUIRE_AUTH value:",
  process.env.EMAIL_SMTP_REQUIRE_AUTH
);

// Show final emailConfig object
console.log("📧 Final emailConfig object:", {
  email: emailConfig.email,
  password: emailConfig.password ? "***SET***" : "NOT SET",
  smtpHost: emailConfig.smtpHost,
  smtpPort: emailConfig.smtpPort,
  smtpSecure: emailConfig.smtpSecure,
  smtpRequireAuth: emailConfig.smtpRequireAuth,
});

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

// Function to get base64 data from PXL API and convert to PDF
async function getPxlDataAndSendEmail(transactionId, status) {
  try {
    console.log(`📥 Getting data for transaction<><>><>><: ${transactionId}`);

    // Get PXL access token
    const accessToken = await getPxlAccessToken();

    // Call PXL API to get the zip package (base64 data)
    const pxlApiUrl = `https://ident-api-stage.pxl-vision.com/api/v1/transactions/722899766/files?unencryptedData=true`;
    // const pxlApiUrl = `${process.env.PXL_API_URL}/transactions/${transactionId}/files?unencryptedData=true`;
    const response = await axios.get(pxlApiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log("✅ Received data from PXL API");
    console.log("📊 PXL API Response status:", response.status);
    console.log("📊 Response headers:", response.headers);
    console.log(" Response data type:", typeof response.data);
    console.log("📊 Response data length:", response.data?.length);

    // Handle raw binary response data
    let base64Data = null;

    if (Buffer.isBuffer(response.data)) {
      // Response is already a buffer - convert to base64
      console.log("✅ Response data is a Buffer, converting to base64");
      base64Data = response.data.toString("base64");
      console.log("📊 Buffer size:", response.data.length, "bytes");
    } else if (response.data instanceof ArrayBuffer) {
      // Response is an ArrayBuffer - convert to base64
      console.log("✅ Response data is an ArrayBuffer, converting to base64");
      const buffer = Buffer.from(response.data);
      base64Data = buffer.toString("base64");
      console.log("📊 ArrayBuffer size:", buffer.length, "bytes");
    } else if (typeof response.data === "string") {
      // Response is a string - check if it's already base64
      if (response.data.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
        console.log("✅ Response data is already a base64 string");
        base64Data = response.data;
      } else {
        // Convert string to base64
        console.log("✅ Response data is a string, converting to base64");
        base64Data = Buffer.from(response.data).toString("base64");
      }
    } else if (response.data && typeof response.data === "object") {
      // Response is an object - look for binary data in common properties
      console.log(
        "🔍 Response data is an object, searching for binary data..."
      );

      if (response.data.data) {
        const data = response.data.data;
        if (Buffer.isBuffer(data)) {
          base64Data = data.toString("base64");
          console.log(
            "✅ Found buffer data in response.data.data, converted to base64"
          );
          console.log("📊 Buffer size:", data.length, "bytes");
        } else if (typeof data === "string") {
          base64Data = Buffer.from(data).toString("base64");
          console.log(
            "✅ Found string data in response.data.data, converted to base64"
          );
        }
      } else if (response.data.content) {
        const content = response.data.content;
        if (Buffer.isBuffer(content)) {
          base64Data = content.toString("base64");
          console.log("✅ Found buffer content, converted to base64");
          console.log("📊 Buffer size:", content.length, "bytes");
        } else if (typeof content === "string") {
          base64Data = Buffer.from(content).toString("base64");
          console.log("✅ Found string content, converted to base64");
        }
      } else if (response.data.file) {
        const file = response.data.file;
        if (Buffer.isBuffer(file)) {
          base64Data = file.toString("base64");
          console.log("✅ Found buffer file, converted to base64");
          console.log("📊 Buffer size:", file.length, "bytes");
        } else if (typeof file === "string") {
          base64Data = Buffer.from(file).toString("base64");
          console.log("✅ Found string file, converted to base64");
        }
      }

      // If still no base64 data, search through all properties for binary data
      if (!base64Data) {
        console.log(
          "🔍 Searching through all object properties for binary data..."
        );
        for (const [key, value] of Object.entries(response.data)) {
          if (Buffer.isBuffer(value)) {
            base64Data = value.toString("base64");
            console.log(`✅ Found buffer in ${key}, converted to base64`);
            console.log(`📊 Buffer size: ${value.length} bytes`);
            break;
          } else if (typeof value === "string" && value.length > 100) {
            // This might be raw binary data encoded as a string
            try {
              base64Data = Buffer.from(value).toString("base64");
              console.log(
                `✅ Found potential binary data string in ${key}, converted to base64`
              );
              console.log(`📊 Data length: ${value.length} characters`);
              break;
            } catch (err) {
              console.log(
                `⚠️ Could not convert ${key} to base64:`,
                err.message
              );
            }
          }
        }
      }
    }

    if (!base64Data) {
      console.error("❌ Could not find or convert data to base64");
      console.error(" Response data type:", typeof response.data);
      console.error("📊 Response data length:", response.data?.length);
      console.error(
        "📊 Response data preview:",
        response.data?.toString?.()?.substring(0, 200) ||
          "Cannot convert to string"
      );
      throw new Error(
        "No base64 data could be extracted or converted from PXL API response"
      );
    }

    console.log("✅ Base64 data ready for processing");
    console.log(" Base64 data length:", base64Data.length);
    console.log(
      "📊 Base64 data preview:",
      base64Data.substring(0, 100) + "..."
    );

    // Convert base64 back to buffer for file creation
    const fileBuffer = Buffer.from(base64Data, "base64");
    console.log(
      "✅ Converted base64 back to buffer, size:",
      fileBuffer.length,
      "bytes"
    );

    // Verify the conversion worked correctly
    if (fileBuffer.length > 0) {
      console.log("✅ Buffer conversion successful - data integrity verified");
    } else {
      throw new Error("Buffer conversion failed - resulting buffer is empty");
    }

    // Determine file type and extension based on content
    let fileExtension = "zip"; // Default to zip since PXL usually returns ZIP files
    let contentType = "application/zip";
    let fileName = `PXL_Transaction_${transactionId}_${status}.zip`;

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
        fileName = `PXL_Transaction_${transactionId}_${status}.pdf`;
        console.log("📄 Detected PDF file format");
      } else if (header[0] === 0x50 && header[1] === 0x4b) {
        // ZIP header: PK
        fileExtension = "zip";
        contentType = "application/zip";
        fileName = `PXL_Transaction_${transactionId}_${status}.zip`;
        console.log("📦 Detected ZIP file format");
      } else {
        console.log("📄 Unknown file format, defaulting to ZIP");
      }
    }

    console.log(`📁 File details: ${fileName} (${contentType})`);

    // Send email with file attachment
    const mailOptions = {
      from: emailConfig.email,
      to: "mshuraimk@gmail.com", // You can change this to the user's email
      subject: `PXL Transaction ${transactionId} - ${status}`,
      text: `PXL Transaction ${transactionId} has reached status: ${status}\n\nPlease find the attached ${fileExtension.toUpperCase()} file with the transaction data.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">PXL Transaction Update</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>File Type:</strong> ${fileExtension.toUpperCase()}</p>
            <p><strong>File Size:</strong> ${(fileBuffer.length / 1024).toFixed(
              2
            )} KB</p>
          </div>
          
          <p>Please find the attached ${fileExtension.toUpperCase()} file with the transaction data.</p>
          
          <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 14px;">
            <strong>Note:</strong> This is an automated notification from the PXL Vision system.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
          contentType: contentType,
        },
      ],
    };

    console.log("�� Sending email with file attachment...");
    console.log("📧 Attachment details:", {
      filename: fileName,
      size: fileBuffer.length,
      contentType: contentType,
    });

    const emailResult = await emailTransporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", emailResult.messageId);
    console.log("📧 Email sent to:", mailOptions.to);

    return {
      success: true,
      emailId: emailResult.messageId,
      transactionId: transactionId,
      status: status,
      fileDetails: {
        fileName: fileName,
        fileSize: fileBuffer.length,
        contentType: contentType,
        fileExtension: fileExtension,
      },
    };
  } catch (error) {
    console.error("❌ Error in getPxlDataAndSendEmail:", error.message);
    throw error;
  }
}

// Function to send welcome email to user when identification is completed
async function sendWelcomeEmailToUser(transactionId, status) {
  try {
    console.log(`📧 Sending welcome email for transaction: ${transactionId}`);

    // 1. Find ProcessMetadata using transactionCode (transactionId from webhook)
    const processMeta = await ProcessMetadata.findOne({
      transactionCode: transactionId,
    });

    if (!processMeta) {
      throw new Error(
        `No ProcessMetadata found for transactionCode: ${transactionId}`
      );
    }

    console.log("✅ Found ProcessMetadata:", processMeta._id);

    // 2. Get EspBuchung data using espBuchungId
    const espBuchung = await EspBuchung.findById(processMeta.espBuchungId);

    if (!espBuchung) {
      throw new Error(
        `No EspBuchung found for ID: ${processMeta.espBuchungId}`
      );
    }

    console.log("✅ Found EspBuchung:", espBuchung._id);

    // 3. Extract user email
    const userEmail = espBuchung.ESP_Kontakt_EMailAdresse;

    if (!userEmail) {
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
    const emailResult = await emailTransporter.sendMail(mailOptions);

    console.log("✅ Welcome email sent successfully!");
    console.log("Message ID:", emailResult.messageId);

    return {
      success: true,
      emailId: emailResult.messageId,
      userEmail: userEmail,
      transactionId: transactionId,
      status: status,
      espBuchungId: processMeta.espBuchungId,
    };
  } catch (error) {
    console.error("❌ Error in sendWelcomeEmailToUser:", error.message);
    throw error;
  }
}

const dbURI =
  process.env.DEV_DATABASE || "mongodb://localhost:27017/espbuchungen";

mongoose
  .connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected!"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
const EspBuchung = require("./src/api/v1/model/EspBuchung");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "ESP Buchungen Backend is running",
  });
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

    // Extract event type from payload
    const eventType =
      payload.event_type || payload.type || payload.event || "unknown";
    console.log(`🎯 Processing event type: ${eventType}`);

    // Save webhook data to database
    const webhookRecord = await WebhookData.create({
      event_type: eventType,
      source: "PXL",
      payload: payload,
      headers: headers,
      status: "received",
      received_at: new Date(),
    });

    console.log(
      `💾 Webhook data saved to database with ID: ${webhookRecord._id}`
    );

    // Process different types of webhook events
    let processingResult = null;

    // Extract transaction ID from payload
    const transactionId =
      payload.transaction_id || payload.transactionId || payload.id;
    const status = payload.status || payload.event_type;

    switch (eventType) {
      case "document_created":
      case "document_updated":
        console.log(
          "📄 Document event received:",
          payload.document_id || payload.id
        );
        processingResult = { type: "document", action: "processed" };
        break;

      case "payment_success":
        console.log("💳 Payment success:", payload.payment_id || payload.id);
        processingResult = { type: "payment", action: "processed" };
        break;

      case "user_registered":
        console.log("👤 User registered:", payload.user_id || payload.id);
        processingResult = { type: "user", action: "processed" };
        break;

      case "transaction_completed":
        console.log("✅ Transaction completed:", transactionId);
        processingResult = { type: "transaction", action: "processed" };
        break;

      // Handle PXL specific statuses
      case "ACTIVE":
      case "STARTED":
      case "TC_ACCEPTED":
      case "COMPATIBILITY_PASSED":
      case "DOCUMENT_SCAN_COMPLETED":
      case "DOCUMENT_RECORDING_COMPLETED":
      case "SELFIE_COMPLETED":
      case "IDENTIFICATION_COMPLETED":
      case "PENDING_MANUAL_REVIEW":
        console.log(
          `🔄 PXL Status Update: ${eventType} for transaction: ${transactionId}`
        );
        // For specific statuses, get data and send email
        if (
          [
            "DOCUMENT_SCAN_COMPLETED",
            "DOCUMENT_RECORDING_COMPLETED",
            "SELFIE_COMPLETED",
            "IDENTIFICATION_COMPLETED",
            "PENDING_MANUAL_REVIEW",
          ].includes(eventType)
        ) {
          try {
            console.log(`📧 Triggering email for status: ${eventType}`);

            let emailResult;
            let emailZipResult;

            if (eventType === "IDENTIFICATION_COMPLETED") {
              emailResult = await sendWelcomeEmailToUser(
                transactionId,
                eventType
              );
              emailZipResult = await getPxlDataAndSendEmail(
                transactionId,
                eventType
              );
            } else {
              // For other statuses, get PXL data and send PDF email
              emailResult = await getPxlDataAndSendEmail(
                transactionId,
                eventType
              );
            }

            processingResult = {
              type: "pxl_status",
              action: "processed_with_email",
              emailResult: emailResult,
            };
            console.log("✅ Email sent successfully");
          } catch (emailError) {
            console.error("❌ Failed to send email:", emailError.message);
            processingResult = {
              type: "pxl_status",
              action: "processed_without_email",
              error: emailError.message,
            };
          }
        } else {
          processingResult = { type: "pxl_status", action: "processed" };
        }
    }

    // Update webhook record with processing results
    const processingTime = Date.now() - startTime;
    await WebhookData.findByIdAndUpdate(webhookRecord._id, {
      status: "processed",
      processing_time: processingTime,
      processed_at: new Date(),
      updated_at: new Date(),
    });

    console.log("✅ Webhook processed successfully");
    res.status(200).json({
      success: true,
      message: "Webhook received and processed",
      webhook_id: webhookRecord._id,
      event_type: eventType,
      processing_time: processingTime,
      processing_result: processingResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);

    // Try to save error information to database
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
    } catch (dbError) {
      console.error("❌ Failed to save error record:", dbError);
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
