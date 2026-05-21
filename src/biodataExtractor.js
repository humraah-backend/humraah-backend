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
  let cleaned = text.replace(/   +/g, '§');
  cleaned = cleaned.replace(/  /g, '§');
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/([A-Za-z0-9]) ([A-Za-z0-9])/g, '$1$2');
  }
  cleaned = cleaned.replace(/§/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(
    /(Name|Date of Birth|City|Education|Profession|Sect|Gender|Mobile|WhatsApp|DOB|Phone|Contact|Occupation|Degree|Qualification|Location|Height|Native|Biradari|Community|Father|Mother|Siblings|Brothers|Sisters|Specialisation|Specialization|Field|Income)\s*:/gi,
    '\n$1:'
  );
  cleaned = cleaned.replace(/\b([A-Z]) ([a-z]+)/g, '$1$2');
  return cleaned;
}

// ── Education text → numeric dropdown value (1–10) ─────────────────
function mapEducation(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (t.includes('below matric') || t.includes('primary'))          return '1';
  if (t.includes('matric') || t.includes('ssc') || t.includes('10th')) return '2';
  if (t.includes('hsc') || t.includes('12th') || t.includes('intermediate') || t.includes('higher secondary')) return '3';
  if (t.includes('diploma'))                                         return '4';
  if (t.includes('b.e') || t.includes('b.tech') || t.includes('be ') || t.includes('btech') || t.includes('engineering')) return '6';
  if (t.includes('mbbs') || t.includes('ca') || t.includes('llb') || t.includes('chartered') || t.includes('medical') || t.includes('lawyer')) return '9';
  if (t.includes('phd') || t.includes('doctorate') || t.includes('ph.d')) return '8';
  if (t.includes('master') || t.includes('m.sc') || t.includes('m.com') || t.includes('m.a') || t.includes('mba') || t.includes('mca') || t.includes('m.e') || t.includes('m.tech')) return '7';
  if (t.includes('bachelor') || t.includes('b.sc') || t.includes('b.com') || t.includes('b.a') || t.includes('bsc') || t.includes('bcom') || t.includes('ba ') || t.includes('graduate')) return '5';
  if (t.includes('other'))                                           return '10';
  return '';
}

// ── Biradari text → standard key ──────────────────────────────────
function mapBiradari(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (t.includes('syed') || t.includes('syyed') || t.includes('sayyid') || t.includes('saiyad')) return 'syed';
  if (t.includes('sheikh') || t.includes('shaikh') || t.includes('shekh'))                      return 'sheikh';
  if (t.includes('pathan') || t.includes('patan') || t.includes('pashtun') || t.includes('khan')) return 'pathan';
  if (t.includes('qureshi') || t.includes('quraishi') || t.includes('kureshi'))                  return 'qureshi';
  if (t.includes('ansari'))                                                                       return 'ansari';
  if (t.includes('mughal') || t.includes('moghul'))                                              return 'mughal';
  if (t.includes('memon') || t.includes('memon'))                                                return 'memon';
  if (t.includes('bohra') || t.includes('bohri'))                                                return 'bohra';
  return 'other';
}

// ── Sect text → standard key ───────────────────────────────────────
function mapSect(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (t.includes('sunni'))    return 'sunni';
  if (t.includes('shia') || t.includes('shi\'a') || t.includes('shiah')) return 'shia';
  if (t.includes('bohra') || t.includes('dawoodi')) return 'bohra';
  if (t.includes('ismaili') || t.includes('ismail')) return 'ismaili';
  return 'other';
}

// ── Sunni school → standard key ───────────────────────────────────
function mapSunniSchool(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (t.includes('barelvi') || t.includes('brelwi') || t.includes('sunni barelvi')) return 'barelvi';
  if (t.includes('deobandi') || t.includes('deoband'))                               return 'deobandi';
  if (t.includes('ahle hadees') || t.includes('ahl-e-hadith') || t.includes('salafi')) return 'ahle_hadees';
  if (t.includes('tablighi') || t.includes('tabligh'))                               return 'tablighi';
  return 'no_specific';
}

// ── Height parser: "5'8\"" or "5 feet 8 inches" or "175 cm" ───────
function parseHeight(text) {
  if (!text) return { ft: '', in: '' };
  const t = text.toLowerCase();

  // Pattern: 5'8 or 5'8" or 5' 8"
  const feetInchSymbol = t.match(/(\d)\s*[''']\s*(\d{1,2})\s*[""""]?/);
  if (feetInchSymbol) return { ft: feetInchSymbol[1], in: feetInchSymbol[2] };

  // Pattern: 5 feet 8 inches / 5 ft 8 in
  const feetInchWords = t.match(/(\d)\s*(?:feet|foot|ft)[\s,]*(\d{1,2})\s*(?:inches?|in)?/i);
  if (feetInchWords) return { ft: feetInchWords[1], in: feetInchWords[2] };

  // Pattern: cm → convert to ft/in
  const cm = t.match(/(\d{3})\s*cm/);
  if (cm) {
    const totalInches = Math.round(parseInt(cm[1]) / 2.54);
    return { ft: String(Math.floor(totalInches / 12)), in: String(totalInches % 12) };
  }

  return { ft: '', in: '' };
}

// ── Parse all fields from cleaned text ────────────────────────────
function parseFields(text) {
  const data = {};

  // ── 1. Full Name ───────────────────────────────────────────────
  for (const p of [/(?:full\s+)?name\s*:\s*([^\n]+)/i, /naam\s*:\s*([^\n]+)/i]) {
    const m = text.match(p);
    if (m) { data.fullName = m[1].trim(); break; }
  }

  // ── 2. Gender ─────────────────────────────────────────────────
  for (const p of [/gender\s*:\s*([^\n]+)/i, /sex\s*:\s*([^\n]+)/i]) {
    const m = text.match(p);
    if (m) {
      const g = m[1].trim().toLowerCase();
      data.gender = g.includes('female') ? 'female' : g.includes('male') ? 'male' : '';
      break;
    }
  }

  // ── 3. Date of Birth ──────────────────────────────────────────
  for (const p of [
    /(?:date\s+of\s+birth|dob|born)\s*:\s*(\d{1,2}[\s/-][A-Za-z]+[\s/-]\d{2,4})/i,
    /(?:date\s+of\s+birth|dob|born)\s*:\s*(\d{1,2}[\s/-]\d{1,2}[\s/-]\d{2,4})/i,
    /(?:date\s+of\s+birth|dob|born)\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.dob = m[1].trim(); break; }
  }

  // ── 4. Height ─────────────────────────────────────────────────
  for (const p of [
    /height\s*:\s*([^\n]+)/i,
    /(\d[''']\d{1,2}["""]?)/,            // inline e.g. 5'8"
    /(\d\s*(?:feet|ft)[\s,]*\d{1,2}\s*(?:inches?|in)?)/i,
    /(\d{3}\s*cm)/i
  ]) {
    const m = text.match(p);
    if (m) {
      const h = parseHeight(m[1]);
      if (h.ft) { data.heightFt = h.ft; data.heightIn = h.in; break; }
    }
  }

  // ── 5. Current City ───────────────────────────────────────────
  for (const p of [
    /(?:current\s+)?city\s*:\s*([^\n]+)/i,
    /location\s*:\s*([^\n]+)/i,
    /residing\s+in\s*:\s*([^\n]+)/i,
    /resident\s+of\s*:\s*([^\n]+)/i,
    /currently\s+(?:living|staying|based)\s+in\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.city = m[1].trim(); break; }
  }

  // ── 6. Native / Ancestral City ────────────────────────────────
  for (const p of [
    /native\s+(?:city|place|town|state)\s*:\s*([^\n]+)/i,
    /ancestral\s+(?:city|place|state)\s*:\s*([^\n]+)/i,
    /hometown\s*:\s*([^\n]+)/i,
    /originally\s+from\s*:\s*([^\n]+)/i,
    /hailing\s+from\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.nativeCity = m[1].trim(); break; }
  }

  // ── 7. Education ──────────────────────────────────────────────
  for (const p of [
    /(?:highest\s+)?(?:education|qualification|degree)\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) {
      data.educationText  = m[1].trim();
      data.educationValue = mapEducation(m[1]);
      break;
    }
  }

  // ── 8. Field / Specialisation ─────────────────────────────────
  for (const p of [
    /(?:field|speciali[sz]ation|stream|subject|branch|major)\s*:\s*([^\n]+)/i,
    /studied\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.fieldSpec = m[1].trim(); break; }
  }

  // ── 9. Profession / Occupation ────────────────────────────────
  for (const p of [
    /(?:profession|occupation|job|designation|position)\s*:\s*([^\n]+)/i,
    /working\s+as\s*:\s*([^\n]+)/i,
    /employed\s+(?:as|at|with)\s*:\s*([^\n]+)/i,
    /currently\s+working\s*(?:as|at)?\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.profession = m[1].trim(); break; }
  }

  // ── 10. Annual Income ─────────────────────────────────────────
  for (const p of [
    /(?:annual\s+)?income\s*:\s*([^\n]+)/i,
    /salary\s*:\s*([^\n]+)/i,
    /package\s*:\s*([^\n]+)/i,
    /ctc\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.income = m[1].trim(); break; }
  }

  // ── 11. Sect ──────────────────────────────────────────────────
  for (const p of [
    /sect\s*:\s*([^\n]+)/i,
    /maslak\s*:\s*([^\n]+)/i,
    /madhab\s*:\s*([^\n]+)/i,
    /(?:muslim\s+)?community\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.sect = mapSect(m[1]); break; }
  }
  // Fallback: scan full text for sect keywords
  if (!data.sect) {
    const full = text.toLowerCase();
    if (full.includes('sunni'))   data.sect = 'sunni';
    else if (full.includes('shia'))    data.sect = 'shia';
    else if (full.includes('bohra'))   data.sect = 'bohra';
    else if (full.includes('ismaili')) data.sect = 'ismaili';
  }

  // ── 12. Sunni School (only if sect = sunni) ───────────────────
  if (data.sect === 'sunni') {
    for (const p of [
      /(?:school\s+of\s+thought|maslak|madhab)\s*:\s*([^\n]+)/i
    ]) {
      const m = text.match(p);
      if (m) { data.sunniSchool = mapSunniSchool(m[1]); break; }
    }
    // Fallback: scan text for school keywords
    if (!data.sunniSchool) {
      const full = text.toLowerCase();
      if (full.includes('barelvi'))   data.sunniSchool = 'barelvi';
      else if (full.includes('deobandi')) data.sunniSchool = 'deobandi';
      else if (full.includes('ahle hadees') || full.includes('salafi')) data.sunniSchool = 'ahle_hadees';
      else if (full.includes('tablighi')) data.sunniSchool = 'tablighi';
    }
  }

  // ── 13. Biradari / Community ──────────────────────────────────
  for (const p of [
    /biradari\s*:\s*([^\n]+)/i,
    /caste\s*:\s*([^\n]+)/i,
    /sub\s*[-\s]?caste\s*:\s*([^\n]+)/i,
    /(?:family\s+)?community\s*:\s*([^\n]+)/i,
    /zaat\s*:\s*([^\n]+)/i,
    /qaum\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.biradari = mapBiradari(m[1]); break; }
  }
  // Fallback: scan full text for biradari keywords
  if (!data.biradari) {
    const full = text.toLowerCase();
    if (full.includes('syed') || full.includes('sayyid'))  data.biradari = 'syed';
    else if (full.includes('sheikh') || full.includes('shaikh')) data.biradari = 'sheikh';
    else if (full.includes('qureshi'))  data.biradari = 'qureshi';
    else if (full.includes('ansari'))   data.biradari = 'ansari';
    else if (full.includes('mughal'))   data.biradari = 'mughal';
    else if (full.includes('memon'))    data.biradari = 'memon';
    else if (full.includes('pathan') || full.includes('khan')) data.biradari = 'pathan';
  }

  // ── 14. Father Name & Occupation ─────────────────────────────
  for (const p of [
    /father['s]*\s+name\s*:\s*([^\n]+)/i,
    /father\s*:\s*([^\n]+)/i,
    /walid\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.fatherName = m[1].trim(); break; }
  }
  for (const p of [
    /father['s]*\s+occupation\s*:\s*([^\n]+)/i,
    /father['s]*\s+(?:profession|business|job|work)\s*:\s*([^\n]+)/i,
    /paternal\s+occupation\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.fatherOccupation = m[1].trim(); break; }
  }

  // ── 15. Mother Background ─────────────────────────────────────
  for (const p of [
    /mother['s]*\s+(?:occupation|profession|background|work)\s*:\s*([^\n]+)/i,
    /mother\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) {
      const t = m[1].trim().toLowerCase();
      if (t.includes('homemaker') || t.includes('housewife') || t.includes('home maker')) {
        data.motherBackground = 'homemaker';
      } else if (t.includes('retired')) {
        data.motherBackground = 'retired';
      } else if (t.includes('deceased') || t.includes('late') || t.includes('passed')) {
        data.motherBackground = 'deceased';
      } else if (m[1].trim().length > 2) {
        data.motherBackground = 'working';
      }
      break;
    }
  }

  // ── 16. Siblings ──────────────────────────────────────────────
  for (const p of [
    /siblings\s*:\s*([^\n]+)/i,
    /brothers?\s+(?:&|and)\s+sisters?\s*:\s*([^\n]+)/i,
    /(?:no\.?\s+of\s+)?brothers?\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) { data.siblings = m[1].trim(); break; }
  }
  // Build siblings string from individual counts
  if (!data.siblings) {
    const bro = text.match(/(?:no\.?\s+of\s+)?brothers?\s*:\s*(\d+)/i);
    const sis = text.match(/(?:no\.?\s+of\s+)?sisters?\s*:\s*(\d+)/i);
    if (bro || sis) {
      const parts = [];
      if (bro) parts.push(bro[1] + ' brother' + (parseInt(bro[1]) !== 1 ? 's' : ''));
      if (sis) parts.push(sis[1] + ' sister' + (parseInt(sis[1]) !== 1 ? 's' : ''));
      data.siblings = parts.join(', ');
    }
  }

  // ── 17. WhatsApp / Mobile ─────────────────────────────────────
  for (const p of [
    /whatsapp\s*:\s*([^\n]+)/i,
    /mobile\s*:\s*([^\n]+)/i,
    /phone\s*:\s*([^\n]+)/i,
    /contact\s*(?:no\.?)?\s*:\s*([^\n]+)/i,
    /(?:mob|cell)\s*:\s*([^\n]+)/i
  ]) {
    const m = text.match(p);
    if (m) {
      const digits = m[1].replace(/\D/g, '').slice(-10);
      if (digits.length === 10) { data.whatsappNumber = digits; break; }
    }
  }

  return data;
}

// ── Main export ───────────────────────────────────────────────────
async function extractBiodata(filePath, fileType) {
  let text = '';

  if (fileType === 'application/pdf') {
    text = await extractFromPDF(filePath);
    text = cleanSpacedText(text);
  } else {
    text = await extractFromImage(filePath);
  }

  console.log('Cleaned text:\n', text);

  const extractedFields = parseFields(text);

  console.log('Extracted fields:', extractedFields);

  return { rawText: text, extractedFields };
}

module.exports = { extractBiodata };