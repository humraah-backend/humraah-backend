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
    const existing = await Profile.findOne({ whatsappNumber: req.body.whatsappNumber });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Already registered' });
    }
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

app.use('/api/payment', require('./src/routes/payment'));

app.use('/api/introduction', require('./src/routes/introduction'));

app.use('/api/admin', require('./src/routes/admin'));

app.use('/api/decision', require('./src/routes/decision'));

app.use('/api/chat', require('./src/routes/chat'));

app.use('/api/aadhaar', require('./src/routes/aadhaar'));

app.use('/api/webhook', require('./src/routes/webhook'));

app.use('/api/guarantor', require('./src/routes/guarantor'));

app.use('/api/upload', require('./src/routes/upload'));

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