const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Profile = require('../models/Profile');

// Blocked patterns
const BLOCKED_PATTERNS = [
  /\d{10}/g,
  /@gmail|@yahoo|@hotmail/gi,
  /instagram|facebook|snapchat|telegram/gi,
  /http[s]?:\/\//gi
];

function containsBlockedContent(text) {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(text));
}

function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// Open chat after mutual YES
router.post('/open', async (req, res) => {
  try {
    const { introductionId, profileAId, profileBId } = req.body;

    const existing = await Chat.findOne({ introductionId });
    if (existing) {
      return res.json({ success: false, message: 'Chat already exists', chatId: existing._id });
    }

    const closesAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const chat = await Chat.create({
      introductionId,
      profileAId,
      profileBId,
      closesAt,
      status: 'open'
    });

    res.json({
      success: true,
      message: 'Chat opened. Closes in 5 days.',
      chatId: chat._id,
      closesAt
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { chatId, senderId, content } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    // Check if chat is still open
    if (chat.status !== 'open') {
      return res.json({ success: false, message: 'Chat is closed' });
    }

    // Check if chat has expired
    if (new Date() > chat.closesAt) {
      chat.status = 'closed';
      await chat.save();
      return res.json({ success: false, message: 'Chat has closed automatically after 5 days' });
    }

    const isA = chat.profileAId.toString() === senderId;
    const countField = isA ? 'messageCounts.profileA' : 'messageCounts.profileB';
    const dateField = isA ? 'messageCounts.profileADate' : 'messageCounts.profileBDate';
    const currentCount = isA ? chat.messageCounts.profileA : chat.messageCounts.profileB;
    const lastDate = isA ? chat.messageCounts.profileADate : chat.messageCounts.profileBDate;

    // Reset count if new day
    if (!lastDate || !isSameDay(lastDate, new Date())) {
      if (isA) { chat.messageCounts.profileA = 0; chat.messageCounts.profileADate = new Date(); }
      else { chat.messageCounts.profileB = 0; chat.messageCounts.profileBDate = new Date(); }
    }

    // Check daily limit
    const updatedCount = isA ? chat.messageCounts.profileA : chat.messageCounts.profileB;
    if (updatedCount >= 10) {
      return res.json({
        success: false,
        message: 'Daily limit reached. You can send 10 messages per day.'
      });
    }

    // Check blocked content
    if (containsBlockedContent(content)) {
      chat.reports.push({ reporterProfileId: senderId, reason: 'blocked_content' });
      await chat.save();

      if (chat.reports.length >= 3) {
        chat.status = 'suspended';
        await chat.save();
        return res.json({ success: false, message: 'Chat suspended due to violations.' });
      }

      return res.json({
        success: false,
        message: 'Message blocked. Personal contact details are not allowed.'
      });
    }

    // Add message
    chat.messages.push({ senderId, content, sentAt: new Date() });
    if (isA) chat.messageCounts.profileA += 1;
    else chat.messageCounts.profileB += 1;

    await chat.save();

    const remainingMessages = 10 - (isA ? chat.messageCounts.profileA : chat.messageCounts.profileB);

    res.json({
      success: true,
      message: 'Message sent',
      remainingToday: remainingMessages,
      totalMessages: chat.messages.length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chat messages
router.get('/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    const daysLeft = Math.ceil((new Date(chat.closesAt) - new Date()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      status: chat.status,
      daysLeft: daysLeft > 0 ? daysLeft : 0,
      totalMessages: chat.messages.length,
      messages: chat.messages
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Report chat
router.post('/report', async (req, res) => {
  try {
    const { chatId, reporterProfileId, reason } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    chat.reports.push({ reporterProfileId, reason });

    if (chat.reports.length >= 3) {
      chat.status = 'suspended';
      await chat.save();
      return res.json({ success: true, message: 'Chat suspended after 3 reports. Team will investigate.' });
    }

    await chat.save();
    res.json({ success: true, message: `Report recorded. ${3 - chat.reports.length} more reports will suspend this chat.` });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;