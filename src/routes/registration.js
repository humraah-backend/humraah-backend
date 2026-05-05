const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');

router.post('/', async (req, res) => {
  try {
    const existing = await Profile.findOne({ 
      whatsappNumber: req.body.whatsappNumber 
    });
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'WhatsApp number already registered' 
      });
    }
    const profile = await Profile.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Profile created successfully',
      profileId: profile._id 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;