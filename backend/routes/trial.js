// Trial countdown API endpoint
const express = require('express');
const pool = require('../config/database.js');
const { simpleAuth } = require('../middleware/auth-simple.js');

const router = express.Router();

// Get trial information and countdown for a user
router.get('/trial-info', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's trial information
    const [users] = await pool.query(`
      SELECT 
        id, name, phone, level, 
        trial_start_date, trial_end_date, trial_days_remaining, 
        is_trial_active, trial_expired, created_at
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Calculate real-time countdown
    const now = new Date();
    const trialEndDate = new Date(user.trial_end_date);
    
    // Calculate remaining time
    const timeRemaining = trialEndDate - now;
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60)));
    const secondsRemaining = Math.max(0, Math.ceil(timeRemaining / 1000));
    
    // Determine trial status
    const isTrialActive = timeRemaining > 0 && user.level === 0;
    const isTrialExpired = timeRemaining <= 0;
    
    // Update trial status in database if needed
    if (isTrialExpired && !user.trial_expired) {
      await pool.query(`
        UPDATE users 
        SET trial_expired = true, is_trial_active = false, trial_days_remaining = 0
        WHERE id = ?
      `, [userId]);
    }
    
    const trialInfo = {
      userId: user.id,
      userName: user.name,
      userLevel: user.level,
      isTemporaryWorker: user.level === 0,
      trialStartDate: user.trial_start_date,
      trialEndDate: user.trial_end_date,
      isTrialActive: isTrialActive,
      isTrialExpired: isTrialExpired,
      countdown: {
        days: daysRemaining,
        hours: hoursRemaining % 24,
        minutes: minutesRemaining % 60,
        seconds: secondsRemaining % 60,
        totalSeconds: Math.max(0, Math.floor(timeRemaining / 1000)),
        totalMilliseconds: Math.max(0, timeRemaining)
      },
      trialProgress: {
        totalDays: 5,
        remainingDays: daysRemaining,
        completedDays: Math.max(0, 5 - daysRemaining),
        percentageComplete: Math.min(100, Math.max(0, ((5 - daysRemaining) / 5) * 100))
      }
    };
    
    res.json({
      success: true,
      trialInfo: trialInfo,
      message: isTrialExpired ? 
        'Your free trial has expired. Please upgrade to continue.' : 
        isTrialActive ? 
        `You have ${daysRemaining} day(s) remaining in your free trial.` :
        'You are not on a free trial.'
    });
    
  } catch (error) {
    console.error('❌ Error getting trial info:', error.message);
    res.status(500).json({ error: 'Failed to get trial information' });
  }
});

// Update trial countdown (called periodically by frontend)
router.post('/update-trial-countdown', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current trial info
    const [users] = await pool.query(`
      SELECT trial_end_date, trial_expired, level
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    if (user.level !== 0) {
      return res.json({ 
        success: true, 
        message: 'User is not a temporary worker',
        isTemporaryWorker: false 
      });
    }
    
    const now = new Date();
    const trialEndDate = new Date(user.trial_end_date);
    const timeRemaining = trialEndDate - now;
    
    // Update trial status if expired
    if (timeRemaining <= 0 && !user.trial_expired) {
      await pool.query(`
        UPDATE users 
        SET trial_expired = true, is_trial_active = false, trial_days_remaining = 0
        WHERE id = ?
      `, [userId]);
      
      return res.json({
        success: true,
        trialExpired: true,
        message: 'Your free trial has expired. Please upgrade to continue.'
      });
    }
    
    // Calculate remaining time
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
    
    // Update days remaining
    await pool.query(`
      UPDATE users 
      SET trial_days_remaining = ?
      WHERE id = ?
    `, [daysRemaining, userId]);
    
    res.json({
      success: true,
      daysRemaining: daysRemaining,
      timeRemaining: Math.max(0, timeRemaining),
      isTrialActive: timeRemaining > 0
    });
    
  } catch (error) {
    console.error('❌ Error updating trial countdown:', error.message);
    res.status(500).json({ error: 'Failed to update trial countdown' });
  }
});

module.exports = router;
