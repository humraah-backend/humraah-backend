const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Profile = require('../models/Profile');

// Step 1 — Send Aadhaar OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { profileId, aadhaarNumber } = req.body;

    // Check if Aadhaar already used
    const aadhaarHash = crypto
      .createHash('sha256')
      .update(aadhaarNumber + process.env.AADHAAR_SALT)
      .digest('hex');

    const existing = await Profile.findOne({ aadhaarHash });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'This Aadhaar is already linked to another profile'
      });
    }

    // Send OTP via Surepass
    const response = await axios.post(
      'https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp',
      { id_number: aadhaarNumber },
      { headers: { Authorization: `Bearer ${process.env.SUREPASS_TOKEN}` } }
    );

    const clientId = response.data.data.client_id;

    // Store client_id and last 4 digits temporarily
    await Profile.findByIdAndUpdate(profileId, {
      aadhaarClientId: clientId,
      aadhaarLast4: aadhaarNumber.slice(-4)
    });

    res.json({
      success: true,
      message: 'OTP sent to Aadhaar linked mobile number',
      clientId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 2 — Verify Aadhaar OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { profileId, clientId, otp, aadhaarNumber } = req.body;

    // Verify OTP via Surepass
    const response = await axios.post(
      'https://kyc-api.surepass.io/api/v1/aadhaar-v2/submit-otp',
      { client_id: clientId, otp },
      { headers: { Authorization: `Bearer ${process.env.SUREPASS_TOKEN}` } }
    );

    const data = response.data.data;

    // Create Aadhaar hash — never store full number
    const aadhaarHash = crypto
      .createHash('sha256')
      .update(aadhaarNumber + process.env.AADHAAR_SALT)
      .digest('hex');

    // Store only minimum data — NEVER full Aadhaar
    await Profile.findByIdAndUpdate(profileId, {
      verifiedName: data.full_name,
      verifiedGender: data.gender,
      verifiedYOB: new Date(data.dob).getFullYear(),
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