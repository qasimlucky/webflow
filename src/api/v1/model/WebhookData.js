const mongoose = require('mongoose');

const WebhookDataSchema = new mongoose.Schema({
  // Basic webhook info
  event_type: { type: String, required: true },
  source: { type: String, default: 'PXL' },
  
  // Raw payload data
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  
  // Headers information
  headers: { type: mongoose.Schema.Types.Mixed },
  
  // Processing status
  status: { 
    type: String, 
    enum: ['received', 'processed', 'failed', 'pending'],
    default: 'received' 
  },
  
  // Error information if any
  error: String,
  
  // Processing metadata
  processing_time: Number,
  
  // Timestamps
  received_at: { type: Date, default: Date.now },
  processed_at: Date,
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for better query performance
WebhookDataSchema.index({ event_type: 1, received_at: -1 });
WebhookDataSchema.index({ status: 1 });

module.exports = mongoose.model('WebhookData', WebhookDataSchema); 