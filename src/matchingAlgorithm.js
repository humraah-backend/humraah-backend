const Profile = require('./models/Profile');

// Calculate age from date of birth
function getAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Score two profiles against each other
function scoreProfiles(profile, candidate) {
  let score = 0;

  // City Compatibility — 30 points
  if (candidate.city === profile.city) {
    score += 30;
  } else if (profile.openToRelocation || candidate.openToRelocation) {
    score += 15;
  }

  // Practice Level — 25 points
  const practiceDiff = Math.abs(candidate.practiceLevel - profile.practiceLevel);
  if (practiceDiff === 0) score += 25;
  else if (practiceDiff === 1) score += 15;
  else if (practiceDiff === 2) score += 5;

  // Age Range — 25 points
  const candidateAge = getAge(candidate.dob);
  const prefs = profile.partnerPrefs;
  if (prefs && prefs.ageMin && prefs.ageMax) {
    if (candidateAge >= prefs.ageMin && candidateAge <= prefs.ageMax) {
      score += 25;
    } else {
      const buffer = Math.min(
        Math.abs(candidateAge - prefs.ageMin),
        Math.abs(candidateAge - prefs.ageMax)
      );
      if (buffer <= 1) score += 20;
      else if (buffer <= 2) score += 12;
      else if (buffer <= 3) score += 5;
    }
  }

  // Education — 20 points
  const eduDiff = Math.abs(candidate.education - profile.education);
  if (eduDiff === 0) score += 20;
  else if (eduDiff === 1) score += 14;
  else if (eduDiff === 2) score += 7;

  return score;
}

// Main matching function
async function findMatches(profileId) {
  const profile = await Profile.findById(profileId);
  if (!profile) return [];

  // HARD FILTERS — must match exactly
  const candidates = await Profile.find({
    _id: { $ne: profileId },
    section: profile.section,
    gender: profile.gender === 'male' ? 'female' : 'male',
    sect: profile.sect,
    status: 'active',
    _id: { $nin: profile.alreadyIntroduced || [] }
  });

  // Score each candidate
  const scored = candidates.map(candidate => ({
    profileId: candidate._id,
    name: candidate.fullName,
    city: candidate.city,
    score: scoreProfiles(profile, candidate)
  }));

  // Only return scores 60 and above
  const filtered = scored
    .filter(m => m.score >= 60)
    .sort((a, b) => b.score - a.score);

  return filtered;
}

module.exports = { findMatches, scoreProfiles };