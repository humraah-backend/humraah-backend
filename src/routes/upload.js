const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractBiodata } = require('../biodataExtractor');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// File filter — only PDF and images
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Upload and extract biodata
router.post('/biodata', upload.single('biodata'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log('Processing biodata:', req.file.filename);

    // Extract fields from document
    const result = await extractBiodata(req.file.path, req.file.mimetype);

    // Delete file after extraction
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

module.exports = router;