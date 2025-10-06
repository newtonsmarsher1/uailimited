const express = require('express');
const pool = require('../config/database.js');
const { simpleAuth } = require('../middleware/auth-simple.js');

const router = express.Router();

// Get user notifications
router.get('/', simpleAuth, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT id, message, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Clear all notifications
router.delete('/clear-all', simpleAuth, async (req, res) => {
  try {
    // Delete all notifications for the user
    await pool.query(
      'DELETE FROM notifications WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Delete notification
router.delete('/:id', simpleAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Verify the notification belongs to the user
    const [notification] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    
    if (!notification.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Delete the notification
    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
