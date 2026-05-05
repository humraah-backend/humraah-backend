const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const Introduction = require('../models/Introduction');

// Get all profiles
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await Profile.find()
      .select('-aadhaarHash')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      total: profiles.length,
      profiles
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single profile
router.get('/profiles/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId)
      .select('-aadhaarHash');

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Suspend profile
router.patch('/profiles/:profileId/suspend', async (req, res) => {
  try {
    await Profile.findByIdAndUpdate(req.params.profileId, {
      status: 'suspended'
    });
    res.json({ success: true, message: 'Profile suspended' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reactivate profile
router.patch('/profiles/:profileId/reactivate', async (req, res) => {
  try {
    await Profile.findByIdAndUpdate(req.params.profileId, {
      status: 'active'
    });
    res.json({ success: true, message: 'Profile reactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalProfiles = await Profile.countDocuments();
    const activeProfiles = await Profile.countDocuments({ status: 'active' });
    const pendingProfiles = await Profile.countDocuments({ status: 'pending' });
    const suspendedProfiles = await Profile.countDocuments({ status: 'suspended' });
    const pehlaRishta = await Profile.countDocuments({ section: 'pehla_rishta' });
    const nayaSafar = await Profile.countDocuments({ section: 'naya_safar' });
    const totalIntroductions = await Introduction.countDocuments();
    const mutualYes = await Introduction.countDocuments({ status: 'mutual_yes' });

    res.json({
      success: true,
      stats: {
        totalProfiles,
        activeProfiles,
        pendingProfiles,
        suspendedProfiles,
        pehlaRishta,
        nayaSafar,
        totalIntroductions,
        mutualYes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all introductions
router.get('/introductions', async (req, res) => {
  try {
    const introductions = await Introduction.find()
      .populate('profileAId', 'fullName city')
      .populate('profileBId', 'fullName city')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      total: introductions.length,
      introductions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;