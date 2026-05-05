const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const Introduction = require('../models/Introduction');
const { findMatches } = require('../matchingAlgorithm');

// Send introduction to a profile
router.post('/send/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Find matches
    const matches = await findMatches(req.params.profileId);
    if (matches.length === 0) {
      return res.json({ success: false, message: 'No matches found yet' });
    }

    // Take top match
    const topMatch = matches[0];

    // Check if introduction already exists
    const existing = await Introduction.findOne({
      profileAId: req.params.profileId,
      profileBId: topMatch.profileId,
      status: 'pending'
    });

    if (existing) {
      return res.json({ success: false, message: 'Introduction already sent' });
    }

    // Create introduction
    const intro = await Introduction.create({
      profileAId: req.params.profileId,
      profileBId: topMatch.profileId,
      statusA: 'pending',
      statusB: 'not_sent'
    });

    // Add to already introduced list
    await Profile.findByIdAndUpdate(req.params.profileId, {
      $addToSet: { alreadyIntroduced: topMatch.profileId }
    });

    res.json({
      success: true,
      message: 'Introduction sent',
      introductionId: intro._id,
      matchedWith: topMatch.name,
      city: topMatch.city,
      score: topMatch.score
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle YES/NO/LATER response
router.patch('/respond/:introductionId', async (req, res) => {
  try {
    const { profileId, response } = req.body;
    const intro = await Introduction.findById(req.params.introductionId);
    if (!intro) return res.status(404).json({ success: false, error: 'Introduction not found' });

    const isA = intro.profileAId.toString() === profileId;

    if (isA) {
      intro.statusA = response;
      if (response === 'yes') {
        intro.sentToB = new Date();
        intro.statusB = 'pending';
      }
    } else {
      intro.statusB = response;
    }

    // Check mutual YES
    if (intro.statusA === 'yes' && intro.statusB === 'yes') {
      intro.status = 'mutual_yes';
      intro.mutualYesAt = new Date();
      intro.proceedDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    }

    await intro.save();

    const message = intro.status === 'mutual_yes'
      ? 'Mutual interest confirmed! Biodata will be shared.'
      : `Response recorded: ${response}`;

    res.json({ success: true, message, status: intro.status });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get introduction status
router.get('/status/:introductionId', async (req, res) => {
  try {
    const intro = await Introduction.findById(req.params.introductionId);
    if (!intro) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, intro });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;