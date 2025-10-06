const express = require('express');
const pool = require('../config/database.js');
const router = express.Router();

// Validate invitation code
router.post('/validate', async (req, res) => {
  const { code } = req.body;
  
  try {
    if (!code || !code.trim()) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Invitation code is required' 
      });
    }

    const trimmedCode = code.trim().toUpperCase();
    
    // Check if code length is valid (6+ characters)
    if (trimmedCode.length < 6) {
      return res.json({ 
        valid: false, 
        message: 'Invitation code must be at least 6 characters' 
      });
    }

    // Check if invitation code exists in users table
    const [rows] = await pool.query(
      'SELECT id, name FROM users WHERE invitation_code = ?',
      [trimmedCode]
    );

    if (rows.length === 0) {
      return res.json({ 
        valid: false, 
        message: 'Invalid invitation code' 
      });
    }

    res.json({ 
      valid: true, 
      message: 'Invitation code is valid' 
    });

  } catch (error) {
    console.error('Error validating invitation code:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Error validating invitation code' 
    });
  }
});

// Get available invitation codes (for admin)
router.get('/available', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT code, created_at FROM invitation_codes WHERE is_used = FALSE ORDER BY created_at ASC LIMIT 10'
    );

    res.json({ 
      codes: rows,
      count: rows.length 
    });

  } catch (error) {
    console.error('Error getting available invitation codes:', error);
    res.status(500).json({ 
      error: 'Error getting available invitation codes' 
    });
  }
});

// Generate new invitation codes (for admin)
router.post('/generate', async (req, res) => {
  const { count = 1 } = req.body;
  
  try {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      let code;
      let isUnique = false;
      
      // Generate unique code
      while (!isUnique) {
        code = generateInvitationCode();
        const [existing] = await pool.query(
          'SELECT id FROM invitation_codes WHERE code = ?',
          [code]
        );
        if (existing.length === 0) {
          isUnique = true;
        }
      }
      
      // Insert code into database
      await pool.query(
        'INSERT INTO invitation_codes (code) VALUES (?)',
        [code]
      );
      
      codes.push(code);
    }

    res.json({ 
      success: true,
      codes: codes,
      message: `Generated ${count} invitation code(s)` 
    });

  } catch (error) {
    console.error('Error generating invitation codes:', error);
    res.status(500).json({ 
      error: 'Error generating invitation codes' 
    });
  }
});

// Function to generate 8-character alphanumeric invitation code
function generateInvitationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = router;
