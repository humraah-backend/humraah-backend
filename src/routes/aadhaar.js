const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Profile = require('../models/Profile');

// Step 1 — Initialize DigiLocker verification
router.post('/initialize', async (req, res) => {
  try {
    const { profileId } = req.body;

    const response = await axios.post(
      'https://sandbox.surepass.app/api/v1/digilocker/initialize',
      {
        data: {
          signup_flow: true,
          logo_url: 'https://humraah.in/logo.png',
          redirect_url: 'https://humraah.in/verify-success',
          skip_main_screen: false
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const clientId = response.data.data.client_id;
    const redirectUrl = response.data.data.url;

    // Save client_id to profile
    await Profile.findByIdAndUpdate(profileId, {
      aadhaarClientId: clientId
    });

    res.json({
      success: true,
      clientId,
      redirectUrl
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 2 — Download Aadhaar after DigiLocker verification
router.post('/download', async (req, res) => {
  try {
    const { profileId, clientId } = req.body;

    const response = await axios.get(
      `https://sandbox.surepass.app/api/v1/digilocker/download-aadhaar/${clientId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`
        }
      }
    );

    const data = response.data.data;

    // Create Aadhaar hash — never store full number
    const aadhaarHash = crypto
      .createHash('sha256')
      .update(clientId + process.env.AADHAAR_SALT)
      .digest('hex');

    // Check if already used
    const existing = await Profile.findOne({ aadhaarHash });
    if (existing && existing._id.toString() !== profileId) {
      return res.status(409).json({
        success: false,
        error: 'This Aadhaar is already linked to another profile'
      });
    }

    // Update profile with verified data
    await Profile.findByIdAndUpdate(profileId, {
      verifiedName: data.full_name,
      verifiedGender: data.gender,
      verifiedYOB: data.dob ? new Date(data.dob).getFullYear() : null,
      verificationStatus: 'aadhaar_verified',
      verificationTimestamp: new Date(),
      aadhaarHash,
      status: 'active',
      $unset: { aadhaarClientId: 1 }
    });

    res.json({
      success: true,
      message: 'Aadhaar verified successfully. Profile is now active.',
      verifiedName: data.full_name,
      verifiedGender: data.gender
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;