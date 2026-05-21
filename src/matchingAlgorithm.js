const Profile = require('./models/Profile');

// ── Age calculator ──────────────────────────────────────────────────────────
function getAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── State extractor (crude but effective for Indian cities) ─────────────────
function getState(city = '') {
  const c = city.toLowerCase().trim();
  const stateMap = {
    // Maharashtra
    'mumbai': 'MH', 'pune': 'MH', 'nashik': 'MH', 'nagpur': 'MH', 'aurangabad': 'MH',
    'thane': 'MH', 'solapur': 'MH', 'kolhapur': 'MH', 'navi mumbai': 'MH',
    // Delhi/NCR
    'delhi': 'DL', 'new delhi': 'DL', 'noida': 'UP', 'gurgaon': 'HR', 'gurugram': 'HR',
    'faridabad': 'HR', 'ghaziabad': 'UP',
    // Karnataka
    'bangalore': 'KA', 'bengaluru': 'KA', 'mysore': 'KA', 'hubli': 'KA', 'mangalore': 'KA',
    // Tamil Nadu
    'chennai': 'TN', 'coimbatore': 'TN', 'madurai': 'TN', 'trichy': 'TN',
    // Telangana/AP
    'hyderabad': 'TS', 'secunderabad': 'TS', 'warangal': 'TS', 'vijayawada': 'AP', 'visakhapatnam': 'AP',
    // Gujarat
    'ahmedabad': 'GJ', 'surat': 'GJ', 'baroda': 'GJ', 'vadodara': 'GJ', 'rajkot': 'GJ',
    // Uttar Pradesh
    'lucknow': 'UP', 'kanpur': 'UP', 'agra': 'UP', 'varanasi': 'UP', 'allahabad': 'UP',
    // Rajasthan
    'jaipur': 'RJ', 'jodhpur': 'RJ', 'udaipur': 'RJ', 'kota': 'RJ',
    // West Bengal
    'kolkata': 'WB', 'howrah': 'WB', 'durgapur': 'WB',
    // Kerala
    'kochi': 'KL', 'thiruvananthapuram': 'KL', 'kozhikode': 'KL', 'calicut': 'KL',
    // Punjab/Haryana
    'amritsar': 'PB', 'ludhiana': 'PB', 'chandigarh': 'PB', 'jalandhar': 'PB',
    // MP/CG
    'bhopal': 'MP', 'indore': 'MP', 'raipur': 'CG',
  };
  return stateMap[c] || null;
}

// ── Sub-sect compatibility ──────────────────────────────────────────────────
function subSectScore(profile, candidate) {
  // Only applies when both are Sunni
  if (profile.sect !== 'sunni' || candidate.sect !== 'sunni') return 5;
  const ps = profile.sunniSchool   || '';
  const cs = candidate.sunniSchool || '';
  const openValues = ['no_specific', 'prefer_not', ''];
  const pOpen = openValues.includes(ps);
  const cOpen = openValues.includes(cs);
  if (pOpen || cOpen) return 5;  // at least one is open → soft match
  if (ps === cs)      return 10; // exact same school
  return 0;                       // conflicting schools
}

// ── Living arrangement compatibility ───────────────────────────────────────
function livingScore(profile, candidate) {
  const pLiving = (profile.livingArrangement  || '').toLowerCase();
  const cLiving = (candidate.livingArrangement || '').toLowerCase();
  if (!pLiving || !cLiving) return 4; // not filled → partial credit
  if (pLiving === cLiving)  return 8; // identical
  // Compatible combos
  const compatible = [
    ['nuclear', 'nuclear_close'],
    ['joint_discuss', 'joint_expected'],
    ['joint_discuss', 'nuclear'],
    ['flexible', 'nuclear'],
    ['flexible', 'joint_expected'],
    ['flexible', 'nuclear_close'],
  ];
  for (const [a, b] of compatible) {
    if ((pLiving === a && cLiving === b) || (pLiving === b && cLiving === a)) return 5;
  }
  return 0; // conflicting
}

// ── Main scoring function ──────────────────────────────────────────────────
function scoreProfiles(profile, candidate) {
  const breakdown = {};
  let total = 0;

  // ── 1. City Compatibility — 20 pts ──────────────────────
  const pCity   = (profile.city   || '').toLowerCase().trim();
  const cCity   = (candidate.city || '').toLowerCase().trim();
  const pState  = getState(profile.city);
  const cState  = getState(candidate.city);
  const sameCity  = pCity === cCity;
  const sameState = pState && cState && pState === cState && !sameCity;

  let cityPts = 0;
  let cityReason = '';
  if (sameCity) {
    cityPts = 20; cityReason = 'Same city';
  } else if (sameState) {
    cityPts = 14; cityReason = 'Same state';
  } else if (profile.openToRelocation || candidate.openToRelocation) {
    cityPts = 10; cityReason = 'Open to relocation';
  } else {
    cityPts = 0; cityReason = 'Different state, no relocation';
  }
  breakdown.city = { points: cityPts, max: 20, reason: cityReason };
  total += cityPts;

  // ── 2. Practice Level — 20 pts ──────────────────────────
  const practiceDiff = Math.abs((candidate.practiceLevel || 2) - (profile.practiceLevel || 2));
  let practicePts = 0;
  let practiceReason = '';
  if      (practiceDiff === 0) { practicePts = 20; practiceReason = 'Same practice level'; }
  else if (practiceDiff === 1) { practicePts = 12; practiceReason = '1 level apart'; }
  else if (practiceDiff === 2) { practicePts = 4;  practiceReason = '2 levels apart'; }
  else                         { practicePts = 0;  practiceReason = '3+ levels apart'; }
  breakdown.practice = { points: practicePts, max: 20, reason: practiceReason };
  total += practicePts;

  // ── 3. Age Within Range — 20 pts ────────────────────────
  let agePts = 0;
  let ageReason = '';
  if (candidate.dob) {
    const candidateAge = getAge(candidate.dob);
    const prefs = profile.partnerPrefs;
    if (prefs && prefs.ageMin && prefs.ageMax) {
      if (candidateAge >= prefs.ageMin && candidateAge <= prefs.ageMax) {
        agePts = 20; ageReason = 'Within preferred range';
      } else {
        const buffer = Math.min(
          Math.abs(candidateAge - prefs.ageMin),
          Math.abs(candidateAge - prefs.ageMax)
        );
        if      (buffer <= 1) { agePts = 15; ageReason = '1 yr outside range'; }
        else if (buffer <= 2) { agePts = 8;  ageReason = '2 yrs outside range'; }
        else if (buffer <= 3) { agePts = 3;  ageReason = '3 yrs outside range'; }
        else                  { agePts = 0;  ageReason = 'Beyond age range'; }
      }
    } else {
      agePts = 10; ageReason = 'No age preference set (partial)';
    }
  }
  breakdown.age = { points: agePts, max: 20, reason: ageReason };
  total += agePts;

  // ── 4. Education — 15 pts ───────────────────────────────
  const eduDiff = Math.abs((candidate.education || 3) - (profile.education || 3));
  let eduPts = 0;
  let eduReason = '';
  if      (eduDiff === 0) { eduPts = 15; eduReason = 'Same education level'; }
  else if (eduDiff === 1) { eduPts = 10; eduReason = '1 level apart'; }
  else if (eduDiff === 2) { eduPts = 5;  eduReason = '2 levels apart'; }
  else                    { eduPts = 0;  eduReason = '3+ levels apart'; }
  breakdown.education = { points: eduPts, max: 15, reason: eduReason };
  total += eduPts;

  // ── 5. Sub-sect Compatibility — 10 pts ─────────────────
  const subSectPts = subSectScore(profile, candidate);
  const subSectReason =
    subSectPts === 10 ? 'Same school of thought' :
    subSectPts === 5  ? 'Open / not specified' :
    'Conflicting schools';
  breakdown.subSect = { points: subSectPts, max: 10, reason: subSectReason };
  total += subSectPts;

  // ── 6. Living Arrangement — 8 pts ──────────────────────
  const livingPts = livingScore(profile, candidate);
  const livingReason =
    livingPts === 8 ? 'Same arrangement preference' :
    livingPts === 5 ? 'Compatible arrangements' :
    livingPts === 4 ? 'Not filled — partial' :
    'Conflicting arrangements';
  breakdown.living = { points: livingPts, max: 8, reason: livingReason };
  total += livingPts;

  // ── 7. Native / Regional Origin — 7 pts ────────────────
  const pNative = (profile.nativeCity   || '').toLowerCase().trim();
  const cNative = (candidate.nativeCity || '').toLowerCase().trim();
  const pNativeState = getState(profile.nativeCity);
  const cNativeState = getState(candidate.nativeCity);
  let nativePts = 0;
  let nativeReason = '';
  if (!pNative || !cNative) {
    nativePts = 0; nativeReason = 'Native city not filled';
  } else if (pNative === cNative) {
    nativePts = 7; nativeReason = 'Same native city';
  } else if (pNativeState && cNativeState && pNativeState === cNativeState) {
    nativePts = 4; nativeReason = 'Same native state';
  } else {
    nativePts = 0; nativeReason = 'Different native origin';
  }
  breakdown.native = { points: nativePts, max: 7, reason: nativeReason };
  total += nativePts;

  return { total, breakdown };
}

// ── Main matching function ─────────────────────────────────────────────────
async function findMatches(profileId) {
  const profile = await Profile.findById(profileId);
  if (!profile) return [];

  // HARD FILTERS — must match exactly
  const candidates = await Profile.find({
    _id: {
      $ne: profileId,
      $nin: profile.alreadyIntroduced || []
    },
    section: profile.section,
    gender:  profile.gender === 'male' ? 'female' : 'male',
    sect:    profile.sect,
    status:  'active'
  });

  // Score every candidate
  const scored = candidates.map(candidate => {
    const { total, breakdown } = scoreProfiles(profile, candidate);
    const tier =
      total >= 80 ? 'priority' :
      total >= 60 ? 'good'     : 'hidden';

    return {
      profileId:  candidate._id,
      name:       candidate.fullName,
      city:       candidate.city,
      age:        candidate.dob ? getAge(candidate.dob) : null,
      score:      total,
      tier,
      breakdown   // detailed point breakdown
    };
  });

  // Only return 60+ scores, sorted highest first
  return scored
    .filter(m => m.score >= 60)
    .sort((a, b) => b.score - a.score);
}

module.exports = { findMatches, scoreProfiles, getAge };