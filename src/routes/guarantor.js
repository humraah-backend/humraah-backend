const express = require('express');
const router = express.Router();
const Guarantor = require('../models/Guarantor');
const Profile = require('../models/Profile');
const { sendGuarantorRequest, sendWhatsApp } = require('../whatsapp');

// Request a guarantor
router.post('/request', async (req, res) => {
  try {
    const { profileId, guarantorWhatsApp } = req.body;

    const profile = await Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // Check if guarantor is already registered on platform
    const guarantorProfile = await Profile.findOne({ whatsappNumber: guarantorWhatsApp });

    // Create guarantor request
    const guarantorRequest = await Guarantor.create({
      profileId,
      guarantorProfileId: guarantorProfile ? guarantorProfile._id : null,
      guarantorWhatsApp,
      guarantorName: guarantorProfile ? guarantorProfile.fullName : 'Community Member',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
    });

    // Send WhatsApp request to guarantor
    await sendGuarantorRequest(
      guarantorWhatsApp,
      profile.fullName,
      profile.city
    );

    res.json({
      success: true,
      message: 'Guarantor request sent via WhatsApp',
      guarantorRequestId: guarantorRequest._id
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm guarantor — called when guarantor replies YES
router.patch('/confirm/:guarantorRequestId', async (req, res) => {
  try {
    const guarantorRequest = await Guarantor.findById(req.params.guarantorRequestId);
    if (!guarantorRequest) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Update guarantor request
    guarantorRequest.status = 'confirmed';
    guarantorRequest.respondedAt = new Date();
    await guarantorRequest.save();

    // Update profile — add guarantor, upgrade introduction rate
    await Profile.findByIdAndUpdate(guarantorRequest.profileId, {
      hasGuarantor: true,
      guarantorId: guarantorRequest._id,
      introductionRate: 7
    });

    // Update guarantor track record
    if (guarantorRequest.guarantorProfileId) {
      await Guarantor.findOneAndUpdate(
        { profileId: guarantorRequest.guarantorProfileId },
        { $inc: { 'trackRecord.profilesVouched': 1 } }
      );
    }

    // Notify candidate
    const profile = await Profile.findById(guarantorRequest.profileId);
    await sendWhatsApp(
      profile.whatsappNumber,
      `✅ *Guarantor Confirmed!*\n\nAlhamdulillah! ${guarantorRequest.guarantorName} has vouched for you.\n\nYou will now receive *7 introductions per week* instead of 3.\n\nJazakAllah Khair. 🕌`
    );

    res.json({
      success: true,
      message: 'Guarantor confirmed. Profile upgraded to 7 introductions per week.'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject guarantor — called when guarantor replies NO
router.patch('/reject/:guarantorRequestId', async (req, res) => {
  try {
    const guarantorRequest = await Guarantor.findById(req.params.guarantorRequestId);
    if (!guarantorRequest) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    guarantorRequest.status = 'rejected';
    guarantorRequest.respondedAt = new Date();
    await guarantorRequest.save();

    // Notify candidate
    const profile = await Profile.findById(guarantorRequest.profileId);
    await sendWhatsApp(
      profile.whatsappNumber,
      `⚠️ *Guarantor Update*\n\nYour guarantor could not confirm at this time.\n\nPlease find another Guarantor to unlock 7 introductions per week. Reply GUARANTOR to learn more. 🕌`
    );

    res.json({
      success: true,
      message: 'Guarantor rejected. Candidate notified.'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guarantor status
router.get('/status/:profileId', async (req, res) => {
  try {
    const guarantorRequest = await Guarantor.findOne({
      profileId: req.params.profileId
    }).sort({ createdAt: -1 });

    if (!guarantorRequest) {
      return res.json({ success: true, hasGuarantor: false });
    }

    res.json({
      success: true,
      hasGuarantor: guarantorRequest.status === 'confirmed',
      status: guarantorRequest.status,
      guarantorName: guarantorRequest.guarantorName
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;