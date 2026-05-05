const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Profile = require('../models/Profile');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create payment order
router.post('/create-order', async (req, res) => {
  try {
    const { profileId } = req.body;

    const profile = await Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const order = await razorpay.orders.create({
      amount: 49900,
      currency: 'INR',
      receipt: `nikah_${profileId}`,
      notes: { profileId: profileId.toString() }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      profileId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, profileId } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    await Profile.findByIdAndUpdate(profileId, {
      status: 'pending_verification',
      paymentId: razorpay_payment_id
    });

    res.json({
      success: true,
      message: 'Payment confirmed. Proceed to verification.',
      profileId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;