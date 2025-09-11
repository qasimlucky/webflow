const mongoose = require("mongoose");

const WebhookDataSchema = new mongoose.Schema(
  {
    // Basic webhook info
    event_type: { type: String, required: true },
    source: { type: String, default: "PXL" },

    // Raw payload data
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    // Headers information
    headers: { type: mongoose.Schema.Types.Mixed },

    // Processing status
    status: {
      type: String,
      enum: ["received", "processed", "failed", "pending", "timeout"],
      default: "received",
    },

    // Error information if any
    error: String,
    error_details: String, // Additional error context

    // Processing metadata
    processing_time: Number,
    retry_count: { type: Number, default: 0 },
    last_retry_at: Date,

    // Timestamps
    received_at: { type: Date, default: Date.now },
    processed_at: Date,
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    // Optimize for performance
    writeConcern: {
      w: 1, // Acknowledge write operations
      j: true, // Request acknowledgment that the write operation has been written to the journal
      wtimeout: 10000, // 10 second timeout for write concern
    },
  }
);

// Index for better query performance
WebhookDataSchema.index({ event_type: 1, received_at: -1 });
WebhookDataSchema.index({ status: 1 });
WebhookDataSchema.index({ received_at: -1 });
WebhookDataSchema.index({ retry_count: 1 });

// Pre-save middleware to handle timeouts
WebhookDataSchema.pre("save", function (next) {
  // Set updated_at timestamp
  this.updated_at = new Date();

  // If this is a retry, increment retry count
  if (
    this.isModified("status") &&
    this.status === "received" &&
    this.retry_count > 0
  ) {
    this.last_retry_at = new Date();
  }

  next();
});

// Static method to find records that need retry
WebhookDataSchema.statics.findRetryable = function () {
  return this.find({
    status: { $in: ["failed", "timeout"] },
    retry_count: { $lt: 3 },
    $or: [
      { last_retry_at: { $exists: false } },
      { last_retry_at: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, // 5 minutes ago
    ],
  });
};

module.exports = mongoose.model("WebhookData", WebhookDataSchema);
