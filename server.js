const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Profile = require('./src/models/Profile');
const { findMatches } = require('./src/matchingAlgorithm');
require('./src/cronJobs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('Humraah Backend Running');
});

app.post('/api/register', async (req, res) => {
  try {
    const profile = await Profile.create(req.body);
    res.status(201).json({ success: true, profileId: profile._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/matches/:profileId', async (req, res) => {
  try {
    const matches = await findMatches(req.params.profileId);
    res.json({ success: true, totalMatches: matches.length, matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/profile/:profileId/activate', async (req, res) => {
  try {
    await Profile.findByIdAndUpdate(req.params.profileId, { status: 'active' });
    res.json({ success: true, message: 'Profile activated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/profile/:profileId/deactivate', async (req, res) => {
  try {
    await Profile.findByIdAndUpdate(req.params.profileId, { status: 'inactive' });
    res.json({ success: true, message: 'Profile deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/profile/:profileId/update', async (req, res) => {
  try {
    const updated = await Profile.findByIdAndUpdate(
      req.params.profileId,
      { $set: req.body },
      { new: true }
    );
    res.json({ success: true, profile: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/debug/matches/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.json({ error: 'Profile not found' });

    const candidates = await Profile.find({
      _id: { $ne: profile._id },
      section: profile.section,
      gender: profile.gender === 'male' ? 'female' : 'male',
      sect: profile.sect,
      status: 'active'
    });

    res.json({
      profile: {
        id: profile._id,
        name: profile.fullName,
        section: profile.section,
        gender: profile.gender,
        sect: profile.sect,
        status: profile.status
      },
      candidatesFound: candidates.length,
      candidates: candidates.map(c => ({
        id: c._id,
        name: c.fullName,
        section: c.section,
        gender: c.gender,
        sect: c.sect,
        status: c.status,
        dob: c.dob
      }))
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});

function capitalize(str) {
  if (!str) return '—';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// TEST ONLY — manually trigger introduction for a profile
app.post('/api/test/send-introduction/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.json({ success: false, error: 'Profile not found' });

    const matches = await findMatches(profile._id);
    if (matches.length === 0) return res.json({ success: false, error: 'No matches found' });

    const topMatch = matches[0];
    const { sendWhatsApp } = require('./src/whatsapp');

    // Get full match profile details
const matchProfile = await Profile.findById(topMatch.profileId);
const age = matchProfile.dob ? Math.floor((new Date() - new Date(matchProfile.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : '—';
const eduLabel = { 1:'Below Matric', 2:'Matric/SSC', 3:'Graduate', 4:'Post Graduate', 5:'Doctorate' }[matchProfile.education] || '—';
const practiceLabel = { 1:'Casual', 2:'Moderate', 3:'Practicing' }[matchProfile.practiceLevel] || '—';
const firstName = matchProfile.fullName.split(' ')[0];
const lastInitial = matchProfile.fullName.split(' ')[1] ? matchProfile.fullName.split(' ')[1][0] + '.' : '';

await sendWhatsApp(
  profile.whatsappNumber,
  `🕌 *Humraah*\n\nAssalamu Alaikum ${profile.fullName}.\n\nYour introduction:\n\n*${firstName} ${lastInitial} · ${age} · ${matchProfile.city} · ${practiceLabel}*\n${eduLabel} · ${matchProfile.profession} · ${capitalize(matchProfile.sect)}\n\nReply *YES* · *NO* · *LATER*`
);
// Create Introduction record in database
const Introduction = require('./src/models/Introduction');
await Introduction.create({
  profileAId: profile._id,
  profileBId: topMatch.profileId,
  statusA: 'pending',
  statusB: 'not_sent',
  status: 'pending'
});

// Add to already introduced list
await Profile.findByIdAndUpdate(profile._id, {
  $addToSet: { alreadyIntroduced: topMatch.profileId }
});
    res.json({ 
      success: true, 
      message: `Introduction sent to ${profile.fullName}`,
      match: topMatch
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Send WhatsApp when Aadhaar verification completes
app.post('/api/notifications/verification-complete', async (req, res) => {
  try {
    const { profileId } = req.body;
    if (!profileId) return res.json({ success: false });

    const profile = await Profile.findById(profileId);
    if (!profile) return res.json({ success: false });

    const { sendWhatsApp } = require('./src/whatsapp');

    // Calculate next introduction day (Mon/Wed/Fri)
    const today = new Date();
    const day = today.getDay();
    const introDays = [1, 3, 5];
    let daysUntilNext = introDays.find(d => d > day);
    if (!daysUntilNext) daysUntilNext = 8 - day + 1;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + (daysUntilNext - day));
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const nextDayStr = `${dayNames[nextDate.getDay()]}, ${nextDate.getDate()} ${monthNames[nextDate.getMonth()]}`;

    const firstName = profile.fullName.split(' ')[0];

    await sendWhatsApp(
      profile.whatsappNumber,
      `🕌 *Humraah*\n\nAssalamu Alaikum ${firstName}.\n\n✓ Your Humraah profile is now live and verified.\n\nYour first introduction arrives *${nextDayStr}*.\n\nComplete your profile to help our algorithm find the right match for you:\nhttps://humraah.in/humraah-profile.html\n\n— The Humraah Team`
    );

    console.log(`Verification WhatsApp sent to ${profile.fullName}`);
    res.json({ success: true });

  } catch(error) {
    console.error('Verification notification error:', error.message);
    res.json({ success: false });
  }
});

app.use('/api/payment', require('./src/routes/payment'));

app.use('/api/introduction', require('./src/routes/introduction'));

app.use('/api/admin', require('./src/routes/admin'));

app.use('/api/decision', require('./src/routes/decision'));

app.use('/api/chat', require('./src/routes/chat'));

app.use('/api/aadhaar', require('./src/routes/aadhaar'));

app.use('/api/webhook', require('./src/routes/webhook'));

app.use('/api/guarantor', require('./src/routes/guarantor'));

app.use('/api/upload', require('./src/routes/upload'));

app.use('/uploads', express.static('uploads'));

const { sendOTP, verifyOTP } = require('./src/whatsapp');

// Send WhatsApp OTP
app.post('/api/otp/send', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    await sendOTP(whatsappNumber);
    res.json({ success: true, message: 'OTP sent to WhatsApp' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify WhatsApp OTP
app.post('/api/otp/verify', async (req, res) => {
  try {
    const { whatsappNumber, otp } = req.body;
    const result = verifyOTP(whatsappNumber, otp);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log('Server running on port ' + PORT);
    });
  })
  .catch((err) => {
    console.log('MongoDB Error:', err.message);
  });

  