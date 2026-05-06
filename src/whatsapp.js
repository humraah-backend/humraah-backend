const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_NUMBER;

// Send any WhatsApp message
async function sendWhatsApp(toNumber, message) {
  try {
    const msg = await client.messages.create({
      from: FROM,
      to: `whatsapp:+91${toNumber}`,
      body: message
    });
    console.log('WhatsApp sent:', msg.sid);
    return msg.sid;
  } catch (error) {
    console.error('WhatsApp error:', error.message);
    throw error;
  }
}

// Send introduction message
async function sendIntroduction(toNumber, matchName, matchCity, matchPractice, matchProfession, guarantorName) {
  const message = `🕌 *Nikah Elite*\n\nAssalamu Alaikum.\n\nYour introduction this week:\n\n*${matchName} · ${matchCity} · ${matchPractice}*\n${matchProfession}\n🤝 Vouched by: ${guarantorName}\n\nReply *YES* · *NO* · *LATER*`;
  return sendWhatsApp(toNumber, message);
}

// Send mutual YES notification
async function sendMutualYes(toNumber, otherName) {
  const message = `🎉 *Nikah Elite*\n\nAlhamdulillah! *${otherName}* has also shown interest.\n\nFull biodata has been shared. Please review with your family.\n\nReply *PROCEED* or *PASS* within 3 days.`;
  return sendWhatsApp(toNumber, message);
}

// Send guarantor request
async function sendGuarantorRequest(guarantorNumber, candidateName, candidateCity) {
  const message = `🕌 *Nikah Elite*\n\n${candidateName} from ${candidateCity} has requested you as Guarantor.\n\nDo you personally know ${candidateName} and confirm their intention is genuine marriage?\n\nReply *YES* or *NO*`;
  return sendWhatsApp(guarantorNumber, message);
}

// Send Istikhara reminder
async function sendIstikharaReminder(toNumber) {
  const message = `🤲 *A gentle reminder*\n\nAs you get to know each other, don't forget to perform Istikhara and seek Allah's guidance in this important decision. 🤲\n\n_One reminder only_`;
  return sendWhatsApp(toNumber, message);
}

// Send Nikah Mubarak
async function sendNikahMubarak(toNumber) {
  const message = `💍 *Nikah Mubarak!*\n\nAlhamdulillah! May Allah bless your union with love, mercy, and barakah. Ameen. 🤲\n\nAs agreed, a success fee of ₹21,000 is due. Payment link will be sent shortly.`;
  return sendWhatsApp(toNumber, message);
}

module.exports = {
  sendWhatsApp,
  sendIntroduction,
  sendMutualYes,
  sendGuarantorRequest,
  sendIstikharaReminder,
  sendNikahMubarak
};