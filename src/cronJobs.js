const cron = require('node-cron');
const Profile = require('./models/Profile');
const Introduction = require('./models/Introduction');
const Decision = require('./models/Decision');
const { findMatches } = require('./matchingAlgorithm');
const { sendWhatsApp, sendIntroduction } = require('./whatsapp');

// ── 1. SEND INTRODUCTIONS — Mon, Wed, Fri at 9 AM ─────────────────
cron.schedule('0 9 * * 1,3,5', async () => {
  console.log('Running introduction cron job...');

  try {
    const activeProfiles = await Profile.find({ status: 'active' });

    for (const profile of activeProfiles) {
      const matches = await findMatches(profile._id);
      if (matches.length === 0) continue;

      const topMatch = matches[0];

      // Check no pending introduction exists
      const existing = await Introduction.findOne({
        profileAId: profile._id,
        profileBId: topMatch.profileId,
        status: 'pending'
      });
      if (existing) continue;

      // Create introduction
      const intro = await Introduction.create({
        profileAId: profile._id,
        profileBId: topMatch.profileId,
        statusA: 'pending',
        statusB: 'not_sent'
      });

      // Add to already introduced list
      await Profile.findByIdAndUpdate(profile._id, {
        $addToSet: { alreadyIntroduced: topMatch.profileId }
      });

      // Send WhatsApp introduction
      await sendWhatsApp(
        profile.whatsappNumber,
        `*Nikah Elite*\n\nAssalamu Alaikum ${profile.fullName}.\n\nYour introduction:\n\n*${topMatch.name} · ${topMatch.city}*\nScore: ${topMatch.score}/100\n\nReply *YES* · *NO* · *LATER*`
      );

      console.log(`Introduction sent to ${profile.fullName} — matched with ${topMatch.name}`);
    }

  } catch (error) {
    console.error('Introduction cron error:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// ── 2. NIGHTLY MATCHING — Every night at 11 PM ────────────────────
cron.schedule('0 23 * * *', async () => {
  console.log('Running nightly matching algorithm...');

  try {
    const activeProfiles = await Profile.find({ status: 'active' });
    console.log(`Scoring ${activeProfiles.length} profiles...`);

    for (const profile of activeProfiles) {
      const matches = await findMatches(profile._id);
      console.log(`${profile.fullName}: ${matches.length} matches found`);
    }

    console.log('Nightly matching complete');

  } catch (error) {
    console.error('Matching cron error:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// ── 3. 30-DAY FOLLOW UP — Every day at 10 AM ─────────────────────
cron.schedule('0 10 * * *', async () => {
  console.log('Running 30-day follow-up cron...');

  try {
    const due = await Decision.find({
      status: 'numbers_exchanged',
      followUpAt: { $lte: new Date() },
      followUpSent: false
    });

    for (const decision of due) {
      const profileA = await Profile.findById(decision.profileAId);
      const profileB = await Profile.findById(decision.profileBId);

      const message = `*Nikah Elite*\n\nAssalamu Alaikum. We connected you with a family 30 days ago. How did it go?\n\nReply:\n💍 *NIKAH* — Alhamdulillah!\n🤝 *ONGOING* — Still in talks\n🙏 *NO* — It didn't work out`;

      await sendWhatsApp(profileA.whatsappNumber, message);
      await sendWhatsApp(profileB.whatsappNumber, message);

      await Decision.findByIdAndUpdate(decision._id, { followUpSent: true });

      console.log(`Follow-up sent to ${profileA.fullName} and ${profileB.fullName}`);
    }

  } catch (error) {
    console.error('Follow-up cron error:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// ── 4. WIDEN FILTERS — Every Sunday at 9 AM ──────────────────────
cron.schedule('0 9 * * 0', async () => {
  console.log('Running filter widening check...');

  try {
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

    const stuckProfiles = await Profile.find({
      status: 'active',
      lastMutualYes: null,
      activatedAt: { $lt: threeWeeksAgo }
    });

    for (const profile of stuckProfiles) {
      await sendWhatsApp(
        profile.whatsappNumber,
        ` *Nikah Elite*\n\nAssalamu Alaikum ${profile.fullName}.\n\nYou have been receiving introductions for 3 weeks. Would you like to slightly expand your preferences to see more matches?\n\nReply *YES* to expand or *NO* to keep current preferences.`
      );

      console.log(`Filter widening prompt sent to ${profile.fullName}`);
    }

  } catch (error) {
    console.error('Filter widening error:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

console.log('All cron jobs scheduled');

module.exports = {};