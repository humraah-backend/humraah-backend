const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const Introduction = require('../models/Introduction');
const Decision = require('../models/Decision');
const { sendWhatsApp } = require('../whatsapp');

// Twilio sends all incoming WhatsApp messages here
router.post('/', async (req, res) => {
  try {
    const { From, Body } = req.body;

    // Extract phone number (remove whatsapp:+91)
    const phone = From.replace('whatsapp:+91', '').trim();
    const reply = Body.trim().toUpperCase();

    console.log(`Received from ${phone}: ${reply}`);

    // Find profile by WhatsApp number
    const profile = await Profile.findOne({ whatsappNumber: phone });
    if (!profile) {
      console.log('Profile not found for:', phone);
      return res.sendStatus(200);
    }

    // Handle YES/NO/LATER — Introduction response
    if (['YES', 'NO', 'LATER'].includes(reply)) {
      await handleIntroductionResponse(profile, reply);
    }

    // Handle PROCEED/PASS — Biodata review response
    else if (['PROCEED', 'PASS'].includes(reply)) {
      await handleBiodataResponse(profile, reply);
    }

    // Handle MEET/NO — Decision after chat
    else if (reply === 'MEET') {
      await handleMeetResponse(profile);
    }

    // Handle NIKAH/ONGOING — 30 day follow up
    else if (['NIKAH', 'ONGOING'].includes(reply)) {
      await handleOutcomeResponse(profile, reply);
    }

    // Handle REPORT
    else if (reply === 'REPORT') {
      await sendWhatsApp(phone, 'Your report has been received. Our team will review within 24 hours. JazakAllah Khair.');
    }

    // Unknown reply
    else {
      await sendWhatsApp(phone, 'Please reply with YES, NO, or LATER to respond to your introduction. JazakAllah Khair. 🕌');
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.sendStatus(200);
  }
});

// Handle YES/NO/LATER for introductions
async function handleIntroductionResponse(profile, reply) {
  const intro = await Introduction.findOne({
    $or: [
      { profileAId: profile._id, statusA: 'pending' },
      { profileBId: profile._id, statusB: 'pending' }
    ],
    status: 'pending'
  }).sort({ createdAt: -1 });

  if (!intro) {
    await sendWhatsApp(profile.whatsappNumber, 'No pending introduction found. You will receive your next introduction soon. 🕌');
    return;
  }

  const isA = intro.profileAId.toString() === profile._id.toString();

  if (reply === 'YES') {
    if (isA) {
      intro.statusA = 'yes';
      intro.sentToB = new Date();
      intro.statusB = 'pending';
    } else {
      intro.statusB = 'yes';
    }

    // Check mutual YES
    if (intro.statusA === 'yes' && intro.statusB === 'yes') {
      intro.status = 'mutual_yes';
      intro.mutualYesAt = new Date();
      await intro.save();

      // Notify both families
      const profileA = await Profile.findById(intro.profileAId);
      const profileB = await Profile.findById(intro.profileBId);

      await sendWhatsApp(profileA.whatsappNumber, `🎉 *Mutual Interest Confirmed!*\n\nAlhamdulillah! Both families have shown interest.\n\nFull biodata has been shared. Please review with your family for 3 days.\n\nReply *PROCEED* or *PASS*`);
      await sendWhatsApp(profileB.whatsappNumber, `🎉 *Mutual Interest Confirmed!*\n\nAlhamdulillah! Both families have shown interest.\n\nFull biodata has been shared. Please review with your family for 3 days.\n\nReply *PROCEED* or *PASS*`);

    } else {
      await intro.save();
      await sendWhatsApp(profile.whatsappNumber, '✅ Interest noted. JazakAllah Khair. We will notify you if there is mutual interest. 🕌');
    }

  } else if (reply === 'NO') {
    if (isA) intro.statusA = 'no';
    else intro.statusB = 'no';
    await intro.save();
    await sendWhatsApp(profile.whatsappNumber, '🤝 JazakAllah Khair. We will send your next introduction soon.');

  } else if (reply === 'LATER') {
    if (isA) intro.statusA = 'later';
    else intro.statusB = 'later';
    await intro.save();
    await sendWhatsApp(profile.whatsappNumber, '⏭ Noted. We will resend this introduction in your next slot.');
  }
}

// Handle PROCEED/PASS for biodata review
async function handleBiodataResponse(profile, reply) {
  if (reply === 'PROCEED') {
    await sendWhatsApp(profile.whatsappNumber, '✅ Proceeding. A 5-day chat will open shortly with the other family. Text only — maximum 10 messages per day. JazakAllah Khair. 🕌');
  } else {
    await sendWhatsApp(profile.whatsappNumber, '🤝 JazakAllah Khair. You will be re-entered into the introduction queue. May Allah facilitate ease for you. Ameen.');
  }
}

// Handle MEET response
async function handleMeetResponse(profile) {
  await sendWhatsApp(profile.whatsappNumber, '✅ Alhamdulillah! We are checking the other family\'s decision. We will notify you shortly. 🕌');
}

// Handle NIKAH/ONGOING outcome
async function handleOutcomeResponse(profile, reply) {
  if (reply === 'NIKAH') {
    await sendWhatsApp(profile.whatsappNumber, '💍 *Nikah Mubarak!*\n\nAlhamdulillah! May Allah bless your union with love, mercy, and barakah. Ameen. 🤲\n\nA success fee of ₹21,000 is due. Payment link will be sent shortly.');
  } else if (reply === 'ONGOING') {
    await sendWhatsApp(profile.whatsappNumber, '🤝 JazakAllah Khair for the update. We will follow up again in 30 days. May Allah put barakah in your journey. Ameen. 🕌');
  }
}

module.exports = router;