const mongoose = require('mongoose');

const introductionSchema = new mongoose.Schema({
  profileAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  profileBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  sentToA: { type: Date, default: Date.now },
  sentToB: { type: Date },
  statusA: { type: String, enum: ['pending', 'yes', 'no', 'later'], default: 'pending' },
  statusB: { type: String, enum: ['pending', 'yes', 'no', 'later', 'not_sent'], default: 'not_sent' }, 
  status: { type: String, enum: ['pending', 'mutual_yes', 'rejected', 'closed'], default: 'pending' },
  mutualYesAt: { type: Date },
  proceedDeadline: { type: Date },
  decisionA: { type: String, enum: ['meet', 'no', null], default: null },
  decisionB: { type: String, enum: ['meet', 'no', null], default: null }
}, { timestamps: true });

module.exports = mongoose.model('Introduction', introductionSchema);