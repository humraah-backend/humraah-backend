const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractBiodata } = require('../biodataExtractor');
const Profile = require('../models/Profile');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG and PNG files allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Upload and extract biodata
router.post('/biodata', upload.single('biodata'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    console.log('Processing biodata:', req.file.filename);
    const result = await extractBiodata(req.file.path, req.file.mimetype);
    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: 'Biodata extracted successfully',
      extractedFields: result.extractedFields,
      rawText: result.rawText,
      confidence: Object.keys(result.extractedFields).length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload passport / government ID
router.post('/passport', upload.fields([{ name: 'passport', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files['passport']) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'profileId required' });
    }

    const passportFile = req.files['passport'][0].filename;

    await Profile.findByIdAndUpdate(profileId, {
      verificationStatus: 'passport_pending',
      passportFile: passportFile
    });

    console.log('Passport uploaded for profile:', profileId, passportFile);

    res.json({
      success: true,
      message: 'Passport uploaded successfully. Admin will review within 24 hours.',
      filename: passportFile
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

module.exports = router;