const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  content: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  isBlocked: { type: Boolean, default: false }
});

const chatSchema = new mongoose.Schema({
  introductionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introduction', required: true },
  profileAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  profileBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  status: {
    type: String,
    enum: ['open', 'closed', 'suspended'],
    default: 'open'
  },
  messages: [messageSchema],
  messageCounts: {
    profileA: { type: Number, default: 0 },
    profileB: { type: Number, default: 0 },
    profileADate: { type: Date },
    profileBDate: { type: Date }
  },
  openedAt: { type: Date, default: Date.now },
  closesAt: { type: Date },
  istikharareminderSent: { type: Boolean, default: false },
  reports: [{
    reporterProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    reason: String,
    reportedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);