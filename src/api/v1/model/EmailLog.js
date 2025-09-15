const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema(
  {
    // Email identification
    emailId: { type: String }, // Message ID from email service
    transactionId: { type: String }, // PXL transaction ID if applicable
    espBuchungId: { type: mongoose.Schema.Types.ObjectId, ref: "EspBuchung" }, // Related ESP booking

    // Email details
    emailType: {
      type: String,
      enum: [
        "welcome_user",
        "pxl_status_update",
        "pxl_file_attachment",
        "otp_verification",
        "password_reset",
        "notification",
      ],
      required: true,
    },

    // Recipient information
    recipientEmail: { type: String, required: true },
    recipientName: { type: String },

    // Sender information
    senderEmail: { type: String, required: true },
    senderName: { type: String },

    // Email content
    subject: { type: String, required: true },
    hasAttachment: { type: Boolean, default: false },
    attachmentDetails: {
      fileName: String,
      fileSize: Number,
      fileType: String,
      downloadUrl: String,
    },

    // Email service details
    emailService: {
      type: String,
      enum: ["nodemailer", "sendgrid"],
      required: true,
    },
    smtpConfig: {
      host: String,
      port: Number,
      secure: Boolean,
    },

    // Status tracking
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "bounced", "opened"],
      default: "pending",
    },

    // Error information
    error: String,
    errorCode: String,
    errorDetails: String,
    retryCount: { type: Number, default: 0 },
    lastRetryAt: Date,

    // Performance metrics
    processingTime: Number, // Time taken to send email in milliseconds
    queueTime: Number, // Time email spent in queue

    // Tracking information
    userAgent: String,
    ipAddress: String,

    // Timestamps
    queuedAt: { type: Date, default: Date.now },
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,

    // Additional metadata
    metadata: { type: mongoose.Schema.Types.Mixed }, // Store additional context
  },
  {
    timestamps: true,
    // Optimize for performance
    writeConcern: {
      w: 1,
      j: true,
      wtimeout: 10000,
    },
  }
);

// Indexes for better query performance
EmailLogSchema.index({ emailType: 1, queuedAt: -1 });
EmailLogSchema.index({ status: 1 });
EmailLogSchema.index({ recipientEmail: 1 });
EmailLogSchema.index({ transactionId: 1 });
EmailLogSchema.index({ espBuchungId: 1 });
EmailLogSchema.index({ queuedAt: -1 });
EmailLogSchema.index({ retryCount: 1 });

// Pre-save middleware
EmailLogSchema.pre("save", function (next) {
  // If this is a retry, increment retry count and update last retry time
  if (
    this.isModified("status") &&
    this.status === "pending" &&
    this.retryCount > 0
  ) {
    this.lastRetryAt = new Date();
  }

  // Set processing time if email was sent
  if (this.isModified("status") && this.status === "sent" && this.sentAt) {
    this.processingTime = this.sentAt.getTime() - this.queuedAt.getTime();
  }

  next();
});

// Static methods
EmailLogSchema.statics.findRetryable = function () {
  return this.find({
    status: { $in: ["failed", "pending"] },
    retryCount: { $lt: 3 },
    $or: [
      { lastRetryAt: { $exists: false } },
      { lastRetryAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, // 5 minutes ago
    ],
  });
};

EmailLogSchema.statics.getEmailStats = function (startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.queuedAt = {};
    if (startDate) matchStage.queuedAt.$gte = new Date(startDate);
    if (endDate) matchStage.queuedAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { status: "$status", emailType: "$emailType" },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: "$processingTime" },
      },
    },
    { $sort: { "_id.status": 1, "_id.emailType": 1 } },
  ]);
};

module.exports = mongoose.model("EmailLog", EmailLogSchema);
