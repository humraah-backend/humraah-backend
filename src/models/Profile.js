const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  section: {
    type: String,
    enum: ['pehla_rishta', 'naya_safar'],
    required: true
  },
  fullName:      { type: String, required: true },
  gender:        { type: String, enum: ['male', 'female'], required: true },
  dob:           { type: Date, required: true },
  city:          { type: String, required: true },
  sect:          { type: String, required: true },
  practiceLevel: { type: Number, required: true },
  education:     { type: Number, required: true },
  profession:    { type: String, required: true },
  whatsappNumber:{ type: String, required: true },
  familyType:    { type: String },
  managedBy:     { type: String, default: 'self' },
  openToRelocation: { type: Boolean, default: false },
  partnerPrefs: {
    ageMin: { type: Number },
    ageMax: { type: Number },
    notes:  { type: String }
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'active', 'hidden', 'suspended', 'inactive', 'pending_verification'],
    default: 'pending'
  },

  // Payment
  paymentStatus:  { type: String, default: 'unpaid' },
  paymentId:      { type: String },
  orderId:        { type: String },

  // Verification
  verificationStatus: { type: String, default: 'not_verified' },
  passportFile:       { type: String },

  // Aadhaar verified fields
  verifiedName:   { type: String },
  verifiedGender: { type: String },
  verifiedYOB:    { type: String },
  aadhaarHash:    { type: String },

  // Guarantor
  hasGuarantor:   { type: Boolean, default: false },
  guarantorName:  { type: String },

  // Introductions
  introductionRate:    { type: Number, default: 3 },
  alreadyIntroduced:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],

}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);