const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  section: {
    type: String,
    enum: ['pehla_rishta', 'naya_safar'],
    required: true
  },
  fullName:  { type: String, required: true },
  gender:    { type: String, enum: ['male', 'female'], required: true },
  dob:       { type: Date, required: true },
  city:      { type: String, required: true },
  sect:      { type: String, required: true },
  practiceLevel: { type: Number, required: true },
  education: { type: Number, required: true },
  profession: { type: String, required: true },
  whatsappNumber: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'hidden', 'suspended'],
    default: 'pending'
  },
  hasGuarantor: { type: Boolean, default: false },
  introductionRate: { type: Number, default: 3 }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);