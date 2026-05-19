const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Profile = require('../models/Profile');

function generateToken(profileId, whatsappNo) {
  return jwt.sign(
    { profileId, whatsappNo },
    process.env.JWT_SECRET || 'secret_key',
    { expiresIn: '30d' }
  );
}

router.post('/login-test', async (req, res) => {
  try {
    const { whatsappNo } = req.body;
    const profile = await Profile.findOne({ whatsappNumber: whatsappNo });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const token = generateToken(profile._id, whatsappNo);
    res.json({ success: true, message: 'Login successful', token, profileId: profile._id, fullName: profile.fullName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { router, verifyToken };