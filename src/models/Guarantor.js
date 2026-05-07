const mongoose = require('mongoose');

const guarantorSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  guarantorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  guarantorWhatsApp: { type: String, required: true },
  guarantorName: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'expired'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  expiresAt: { type: Date },
  trackRecord: {
    profilesVouched: { type: Number, default: 0 },
    introductionsMade: { type: Number, default: 0 },
    successfulNikahs: { type: Number, default: 0 },
    reportsReceived: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Guarantor', guarantorSchema);