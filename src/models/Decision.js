const mongoose = require('mongoose');

const decisionSchema = new mongoose.Schema({
  introductionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introduction', required: true },
  profileAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  profileBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  decisionA: { type: String, enum: ['meet', 'no', null], default: null },
  decisionB: { type: String, enum: ['meet', 'no', null], default: null },
  status: {
    type: String,
    enum: ['pending', 'numbers_exchanged', 'closed'],
    default: 'pending'
  },
  numbersExchangedAt: { type: Date },
  followUpAt: { type: Date },
  followUpSent: { type: Boolean, default: false },
  outcome: {
    type: String,
    enum: ['nikah', 'ongoing', 'no', null],
    default: null
  },
  successFeePaid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Decision', decisionSchema);