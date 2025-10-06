const express = require('express');
const pool = require('../config/database.js');
const { simpleAuth } = require('../middleware/auth-simple.js');
const { admin } = require('../middleware/auth.js');

const router = express.Router();

// Submit appeal (public access - no authentication required)
router.post('/submit-public', async (req, res) => {
  try {
    const { appeal_reason, appeal_description, user_name, user_phone } = req.body;
    
    // Validate input
    if (!appeal_reason || !appeal_description) {
      return res.status(400).json({ error: 'Appeal reason and description are required' });
    }
    
    // Use provided user info or defaults
    const userName = user_name || 'Anonymous User';
    const userPhone = user_phone || '0000000000';
    
    // Create appeal
    const [result] = await pool.query(`
      INSERT INTO appeals (user_id, user_name, user_phone, appeal_reason, appeal_description, status, appeal_fee, payment_status)
      VALUES (NULL, ?, ?, ?, ?, 'pending', 560.00, 'pending')
    `, [userName, userPhone, appeal_reason, appeal_description]);
    
    console.log(`📝 Public appeal submitted by ${userName} (${userPhone})`);
    
    res.json({
      success: true,
      message: 'Appeal submitted successfully',
      appeal_id: result.insertId
    });
    
  } catch (error) {
    console.error('Appeal submission error:', error);
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

// Submit appeal
router.post('/submit', simpleAuth, async (req, res) => {
  try {
    const { appeal_reason, appeal_description } = req.body;
    
    // Validate input
    if (!appeal_reason || !appeal_description) {
      return res.status(400).json({ error: 'Appeal reason and description are required' });
    }
    
    // Get user information
    const [userRows] = await pool.query(`
      SELECT id, name, phone, is_active 
      FROM users 
      WHERE id = ?
    `, [req.user.id]);
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    
    // Check if user is actually suspended
    if (user.is_active === 1) {
      return res.status(400).json({ error: 'Your account is not suspended. No appeal needed.' });
    }
    
    // Check if user already has a pending appeal
    const [existingAppeals] = await pool.query(`
      SELECT id FROM appeals 
      WHERE user_id = ? AND status IN ('pending', 'under_review')
    `, [req.user.id]);
    
    if (existingAppeals.length > 0) {
      return res.status(400).json({ 
        error: 'You already have a pending appeal. Please wait for it to be reviewed.' 
      });
    }
    
    // Create appeal
    const [result] = await pool.query(`
      INSERT INTO appeals (user_id, user_name, user_phone, appeal_reason, appeal_description, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [req.user.id, user.name, user.phone, appeal_reason, appeal_description]);
    
    console.log(`📝 Appeal submitted by user ${user.name} (ID: ${req.user.id})`);
    
    res.json({
      success: true,
      message: 'Appeal submitted successfully',
      appeal_id: result.insertId
    });
    
  } catch (error) {
    console.error('Appeal submission error:', error);
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

// Get random financial manager for appeal payment
router.get('/random-financial-manager', async (req, res) => {
  try {
    // Get random financial manager from admin_users table
    const [managers] = await pool.query(`
      SELECT id, name, mobile, bank_name, account_number, branch, swift_code, reference_code
      FROM admin_users 
      WHERE role = 'Financial Manager' AND is_active = 1
      ORDER BY RAND()
      LIMIT 1
    `);
    
    if (!managers.length) {
      // Fallback to any active admin user if no financial managers found
      const [fallbackManagers] = await pool.query(`
        SELECT id, name, mobile, bank_name, account_number, branch, swift_code, reference_code
        FROM admin_users 
        WHERE is_active = 1
        ORDER BY RAND()
        LIMIT 1
      `);
      
      if (!fallbackManagers.length) {
        return res.status(404).json({ error: 'No financial managers available' });
      }
      
      const manager = fallbackManagers[0];
      res.json({
        success: true,
        financialManager: {
          name: manager.name,
          phone: manager.mobile,
          accountNumber: manager.account_number || '0114710035',
          bankName: manager.bank_name || 'UAI Agency'
        }
      });
      return;
    }
    
    const manager = managers[0];
    res.json({
      success: true,
      financialManager: {
        name: manager.name,
        phone: manager.mobile,
        accountNumber: manager.account_number || '0114710035',
        bankName: manager.bank_name || 'UAI Agency'
      }
    });
    
  } catch (error) {
    console.error('Error fetching random financial manager:', error);
    res.status(500).json({ error: 'Failed to fetch financial manager' });
  }
});

// Submit payment proof (public access - no authentication required)
router.post('/payment-proof-public', async (req, res) => {
  try {
    const { appeal_id, payment_message, payment_reference } = req.body;
    
    // Validate input
    if (!appeal_id || !payment_message || !payment_reference) {
      return res.status(400).json({ error: 'Appeal ID, payment message, and payment reference are required' });
    }
    
    // Check if appeal exists
    const [appealRows] = await pool.query(`
      SELECT * FROM appeals 
      WHERE id = ?
    `, [appeal_id]);
    
    if (!appealRows.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    const appeal = appealRows[0];
    
    // Check if payment proof already submitted
    if (appeal.payment_status !== 'pending') {
      return res.status(400).json({ 
        error: 'Payment proof already submitted for this appeal' 
      });
    }
    
    // Update appeal with payment proof - set to pending approval
    await pool.query(`
      UPDATE appeals 
      SET payment_proof = ?, payment_status = 'pending_approval', status = 'payment_pending'
      WHERE id = ?
    `, [payment_message, appeal_id]);
    
    console.log(`💰 Public payment proof submitted for appeal ${appeal_id} - PENDING APPROVAL`);
    
    res.json({
      success: true,
      message: 'Payment proof submitted successfully',
      appeal_id: appeal_id
    });
    
  } catch (error) {
    console.error('Payment proof submission error:', error);
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
});

// Submit payment proof for appeal
router.post('/payment-proof', simpleAuth, async (req, res) => {
  try {
    const { appeal_id, payment_message, payment_reference } = req.body;
    
    // Validate input
    if (!appeal_id || !payment_message || !payment_reference) {
      return res.status(400).json({ error: 'Appeal ID, payment message, and payment reference are required' });
    }
    
    // Check if appeal exists and belongs to user
    const [appealRows] = await pool.query(`
      SELECT * FROM appeals 
      WHERE id = ? AND user_id = ?
    `, [appeal_id, req.user.id]);
    
    if (!appealRows.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    const appeal = appealRows[0];
    
    // Check if payment proof already submitted
    if (appeal.payment_status !== 'pending') {
      return res.status(400).json({ 
        error: 'Payment proof already submitted for this appeal' 
      });
    }
    
    // Update appeal with payment proof - set to pending approval
    await pool.query(`
      UPDATE appeals 
      SET payment_proof = ?, payment_status = 'pending_approval', status = 'payment_pending'
      WHERE id = ?
    `, [payment_message, appeal_id]);
    
    console.log(`💰 Payment proof submitted for appeal ${appeal_id} by user ${req.user.id} - PENDING APPROVAL`);
    
    res.json({
      success: true,
      message: 'Payment proof submitted successfully',
      appeal_id: appeal_id
    });
    
  } catch (error) {
    console.error('Payment proof submission error:', error);
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
});

// Get user's appeals
router.get('/my-appeals', simpleAuth, async (req, res) => {
  try {
    const [appeals] = await pool.query(`
      SELECT id, appeal_reason, appeal_description, status, admin_response, 
             reviewed_at, created_at, updated_at, payment_status, payment_proof, appeal_fee
      FROM appeals 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.user.id]);
    
    res.json({
      success: true,
      appeals: appeals
    });
    
  } catch (error) {
    console.error('Get appeals error:', error);
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// Get appeal status
router.get('/status/:appealId', simpleAuth, async (req, res) => {
  try {
    const { appealId } = req.params;
    
    const [appeals] = await pool.query(`
      SELECT id, appeal_reason, appeal_description, status, admin_response, 
             reviewed_at, created_at, updated_at, payment_status, payment_proof, appeal_fee
      FROM appeals 
      WHERE id = ? AND user_id = ?
    `, [appealId, req.user.id]);
    
    if (!appeals.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    res.json({
      success: true,
      appeal: appeals[0]
    });
    
  } catch (error) {
    console.error('Get appeal status error:', error);
    res.status(500).json({ error: 'Failed to fetch appeal status' });
  }
});

// Get appeal status (public access - no authentication required)
router.get('/status-public/:appealId', async (req, res) => {
  try {
    const { appealId } = req.params;
    
    const [appeals] = await pool.query(`
      SELECT id, appeal_reason, appeal_description, status, admin_response, 
             reviewed_at, created_at, updated_at, payment_status, payment_proof, appeal_fee,
             user_name, user_phone
      FROM appeals 
      WHERE id = ?
    `, [appealId]);
    
    if (!appeals.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    res.json({
      success: true,
      appeal: appeals[0]
    });
    
  } catch (error) {
    console.error('Get appeal status error:', error);
    res.status(500).json({ error: 'Failed to fetch appeal status' });
  }
});

// Approve payment for appeal (Admin only)
router.post('/approve-payment/:appealId', simpleAuth, admin, async (req, res) => {
  try {
    const { appealId } = req.params;
    
    // Get appeal details
    const [appeals] = await pool.query(`
      SELECT id, user_name, user_phone, payment_status, status, payment_proof
      FROM appeals 
      WHERE id = ?
    `, [appealId]);
    
    if (!appeals.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    const appeal = appeals[0];
    
    // Check if payment is pending approval
    if (appeal.payment_status !== 'pending_approval') {
      return res.status(400).json({ 
        error: 'Payment is not pending approval',
        current_status: appeal.payment_status
      });
    }
    
    // Update appeal status to approved payment and under review
    await pool.query(`
      UPDATE appeals 
      SET payment_status = 'paid', status = 'under_review', reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ?
    `, [req.user.id, appealId]);
    
    console.log(`✅ Payment approved for appeal ${appealId} by admin ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Payment approved successfully',
      appeal_id: appealId
    });
    
  } catch (error) {
    console.error('Payment approval error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// Reject payment for appeal (Admin only)
router.post('/reject-payment/:appealId', simpleAuth, admin, async (req, res) => {
  try {
    const { appealId } = req.params;
    const { reason } = req.body;
    
    // Get appeal details
    const [appeals] = await pool.query(`
      SELECT id, user_name, user_phone, payment_status, status
      FROM appeals 
      WHERE id = ?
    `, [appealId]);
    
    if (!appeals.length) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    const appeal = appeals[0];
    
    // Check if payment is pending approval
    if (appeal.payment_status !== 'pending_approval') {
      return res.status(400).json({ 
        error: 'Payment is not pending approval',
        current_status: appeal.payment_status
      });
    }
    
    // Update appeal status to rejected payment
    await pool.query(`
      UPDATE appeals 
      SET payment_status = 'pending', status = 'pending', 
          admin_response = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ?
    `, [reason || 'Payment proof rejected. Please submit a valid payment proof.', req.user.id, appealId]);
    
    console.log(`❌ Payment rejected for appeal ${appealId} by admin ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Payment rejected successfully',
      appeal_id: appealId
    });
    
  } catch (error) {
    console.error('Payment rejection error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

module.exports = router;
