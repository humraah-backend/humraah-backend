const Tesseract = require('tesseract.js');
const fs = require('fs');
const { PdfReader } = require('pdfreader');

// Extract text from image
async function extractFromImage(filePath) {
  const result = await Tesseract.recognize(filePath, 'eng', {
    logger: m => console.log(m)
  });
  return result.data.text;
}

// Extract text from PDF
async function extractFromPDF(filePath) {
  return new Promise((resolve, reject) => {
    let text = '';
    let itemCount = 0;
    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) {
        console.log('PDF read error:', err);
        resolve('');
      }
      else if (!item) {
        console.log('PDF reading complete. Items found:', itemCount);
        resolve(text);
      }
      else if (item.text) {
        text += item.text + ' ';
        itemCount++;
      }
    });
  });
}

// Clean spaced-out text from PDF reader
function cleanSpacedText(text) {
  // Step 1: Mark word boundaries (3+ spaces) with placeholder
  let cleaned = text.replace(/   +/g, '§');
  
  // Step 2: Also mark 2-space gaps as word boundaries except within known broken words
  cleaned = cleaned.replace(/  /g, '§');

  // Step 3: Join single-spaced individual characters
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/([A-Za-z0-9]) ([A-Za-z0-9])/g, '$1$2');
  }

  // Step 4: Restore word boundaries as spaces
  cleaned = cleaned.replace(/§/g, ' ');

  // Step 5: Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

 // Step 6: Add newlines before field labels
cleaned = cleaned.replace(/(Name|Date of Birth|City|Education|Profession|Sect|Gender|Mobile|WhatsApp|DOB|Phone|Contact|Occupation|Degree|Qualification|Location)\s*:/gi, '\n$1:');
  // Fix isolated capital letters before words (C ity -> City, G ender -> Gender)
cleaned = cleaned.replace(/\b([A-Z]) ([a-z]+)/g, '$1$2');

  return cleaned;
}

// Parse extracted text into profile fields
function parseFields(text) {
  const data = {};

  const namePatterns = [
    /name\s*:\s*([^\n]+)/i,
    /full name\s*:\s*([^\n]+)/i,
    /naam\s*:\s*([^\n]+)/i
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) { data.fullName = match[1].trim(); break; }
  }

  const dobPatterns = [
    /date of birth\s*:\s*([0-9]+\s+[A-Za-z]+\s+[0-9]+)/i,
    /dob\s*:\s*([0-9]+\s+[A-Za-z]+\s+[0-9]+)/i,
    /born\s*:\s*([0-9]+\s+[A-Za-z]+\s+[0-9]+)/i,
    /date of birth\s*:\s*([^\n]+)/i,
    /dob\s*:\s*([^\n]+)/i
  ];
  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) { data.dob = match[1].trim(); break; }
  }

  const cityPatterns = [
    /city\s*:\s*([^\n]+)/i,
    /location\s*:\s*([^\n]+)/i,
    /residing in\s*:\s*([^\n]+)/i,
    /resident of\s*:\s*([^\n]+)/i
  ];
  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match) { data.city = match[1].trim(); break; }
  }

  const educationPatterns = [
    /education\s*:\s*([^\n]+)/i,
    /qualification\s*:\s*([^\n]+)/i,
    /degree\s*:\s*([^\n]+)/i
  ];
  for (const pattern of educationPatterns) {
    const match = text.match(pattern);
    if (match) { data.educationText = match[1].trim(); break; }
  }

  const professionPatterns = [
    /profession\s*:\s*([^\n]+)/i,
    /occupation\s*:\s*([^\n]+)/i,
    /job\s*:\s*([^\n]+)/i,
    /working as\s*:\s*([^\n]+)/i,
    /employed as\s*:\s*([^\n]+)/i
  ];
  for (const pattern of professionPatterns) {
    const match = text.match(pattern);
    if (match) { data.profession = match[1].trim(); break; }
  }

  const sectPatterns = [
    /sect\s*:\s*([^\n]+)/i,
    /maslak\s*:\s*([^\n]+)/i,
    /madhab\s*:\s*([^\n]+)/i
  ];
  for (const pattern of sectPatterns) {
    const match = text.match(pattern);
    if (match) {
      const sectText = match[1].trim().toLowerCase();
      if (sectText.includes('sunni')) data.sect = 'sunni';
      else if (sectText.includes('shia')) data.sect = 'shia';
      else if (sectText.includes('bohra')) data.sect = 'bohra';
      break;
    }
  }

  const genderPatterns = [
    /gender\s*:\s*([^\n]+)/i,
    /sex\s*:\s*([^\n]+)/i
  ];
  for (const pattern of genderPatterns) {
    const match = text.match(pattern);
    if (match) {
      const genderText = match[1].trim().toLowerCase();
      if (genderText.includes('male') && !genderText.includes('female')) {
        data.gender = 'male';
      } else if (genderText.includes('female')) {
        data.gender = 'female';
      }
      break;
    }
  }

  const phonePatterns = [
    /whatsapp\s*:\s*([^\n]+)/i,
    /mobile\s*:\s*([^\n]+)/i,
    /phone\s*:\s*([^\n]+)/i,
    /contact\s*:\s*([^\n]+)/i
  ];
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const phone = match[1].trim().replace(/\D/g, '').slice(-10);
      if (phone.length === 10) { data.whatsappNumber = phone; break; }
    }
  }

  return data;
}

async function extractBiodata(filePath, fileType) {
  let text = '';
  if (fileType === 'application/pdf') {
    text = await extractFromPDF(filePath);
    text = cleanSpacedText(text);
  } else {
    text = await extractFromImage(filePath);
  }
  console.log('Cleaned text:', text);
  const extractedFields = parseFields(text);
  return { rawText: text, extractedFields };
}

module.exports = { extractBiodata };