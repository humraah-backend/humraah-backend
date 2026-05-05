const express = require('express');
const router = express.Router();
const Decision = require('../models/Decision');
const Introduction = require('../models/Introduction');
const Profile = require('../models/Profile');

// Submit MEET or NO decision after chat
router.post('/submit', async (req, res) => {
  try {
    const { introductionId, profileId, decision } = req.body;

    const intro = await Introduction.findById(introductionId);
    if (!intro) return res.status(404).json({ success: false, error: 'Introduction not found' });

    // Find or create decision record
    let decisionRecord = await Decision.findOne({ introductionId });
    if (!decisionRecord) {
      decisionRecord = await Decision.create({
        introductionId,
        profileAId: intro.profileAId,
        profileBId: intro.profileBId
      });
    }

    const isA = intro.profileAId.toString() === profileId;
    if (isA) decisionRecord.decisionA = decision;
    else decisionRecord.decisionB = decision;

    // Both said MEET
    if (decisionRecord.decisionA === 'meet' && decisionRecord.decisionB === 'meet') {
      decisionRecord.status = 'numbers_exchanged';
      decisionRecord.numbersExchangedAt = new Date();
      decisionRecord.followUpAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await decisionRecord.save();

      // Get both profiles for number exchange
      const profileA = await Profile.findById(intro.profileAId);
      const profileB = await Profile.findById(intro.profileBId);

      return res.json({
        success: true,
        status: 'numbers_exchanged',
        message: 'Alhamdulillah! Both families want to meet.',
        familyA: {
          name: profileA.fullName,
          whatsapp: profileA.whatsappNumber
        },
        familyB: {
          name: profileB.fullName,
          whatsapp: profileB.whatsappNumber
        },
        followUpDate: decisionRecord.followUpAt
      });
    }

    // Either said NO
    if (decisionRecord.decisionA === 'no' || decisionRecord.decisionB === 'no') {
      decisionRecord.status = 'closed';
      await decisionRecord.save();

      // Both profiles back to queue
      await Profile.findByIdAndUpdate(intro.profileAId, {
        $pull: { alreadyIntroduced: intro.profileBId }
      });

      return res.json({
        success: true,
        status: 'closed',
        message: 'JazakAllah Khair. Both profiles re-enter introduction queue.'
      });
    }

    await decisionRecord.save();
    res.json({
      success: true,
      status: 'pending',
      message: `Decision recorded. Waiting for other family.`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 30-day follow up outcome
router.post('/outcome', async (req, res) => {
  try {
    const { introductionId, outcome } = req.body;

    const decisionRecord = await Decision.findOne({ introductionId });
    if (!decisionRecord) {
      return res.status(404).json({ success: false, error: 'Decision not found' });
    }

    decisionRecord.outcome = outcome;

    if (outcome === 'nikah') {
      decisionRecord.followUpSent = true;

      await decisionRecord.save();

      return res.json({
        success: true,
        outcome: 'nikah',
        message: 'Nikah Mubarak! Alhamdulillah!',
        successFee: {
          amount: 21000,
          currency: 'INR',
          message: 'Success fee of ₹21,000 is due. Payment link will be sent.'
        }
      });
    }

    if (outcome === 'ongoing') {
      decisionRecord.followUpAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      decisionRecord.followUpSent = false;

      await decisionRecord.save();

      return res.json({
        success: true,
        outcome: 'ongoing',
        message: 'We will follow up again in 30 days.'
      });
    }

    if (outcome === 'no') {
      const intro = await Introduction.findById(introductionId);
      await Profile.findByIdAndUpdate(intro.profileAId, {
        $pull: { alreadyIntroduced: intro.profileBId }
      });
      await Profile.findByIdAndUpdate(intro.profileBId, {
        $pull: { alreadyIntroduced: intro.profileAId }
      });

      await decisionRecord.save();

      return res.json({
        success: true,
        outcome: 'no',
        message: 'Both profiles re-enter introduction flow. Algorithm learns.'
      });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get decision status
router.get('/status/:introductionId', async (req, res) => {
  try {
    const decisionRecord = await Decision.findOne({
      introductionId: req.params.introductionId
    });
    if (!decisionRecord) {
      return res.status(404).json({ success: false, error: 'No decision found' });
    }
    res.json({ success: true, decision: decisionRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;