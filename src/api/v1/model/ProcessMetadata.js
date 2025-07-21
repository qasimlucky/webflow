const mongoose = require('mongoose');

const ProcessMetadataSchema = new mongoose.Schema({
  espBuchungId: { type: mongoose.Schema.Types.ObjectId, ref: 'EspBuchung' },
  transactionId: String,
  transactionCode: String,
  status: { type: String, default: 'pending' },
  error: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProcessMetadata', ProcessMetadataSchema); 