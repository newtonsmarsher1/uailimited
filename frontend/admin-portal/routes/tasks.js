const express = require('express');
const { pool } = require('../config/database');
const { verifyAdminToken } = require('../middleware/auth');

const router = express.Router();

// Get all tasks
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, title, bond_level_required, reward, videoUrl, question, expected_answer,
        is_active, created_at
      FROM tasks 
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        id, title, bond_level_required, reward, videoUrl, question, expected_answer,
        is_active, created_at
      FROM tasks 
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create new task
router.post('/', verifyAdminToken, async (req, res) => {
  try {
    const { title, bond_level_required, reward, videoUrl, question, expected_answer } = req.body;
    
    if (!title || !bond_level_required || !reward) {
      return res.status(400).json({ error: 'Title, bond level, and reward are required' });
    }
    
    const [result] = await pool.query(`
      INSERT INTO tasks (title, bond_level_required, reward, videoUrl, question, expected_answer, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [title, bond_level_required, reward, videoUrl, question, expected_answer]);
    
    res.json({ 
      success: true, 
      message: 'Task created successfully',
      taskId: result.insertId
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, bond_level_required, reward, videoUrl, question, expected_answer, is_active } = req.body;
    
    await pool.query(`
      UPDATE tasks 
      SET title = ?, bond_level_required = ?, reward = ?, videoUrl = ?, 
          question = ?, expected_answer = ?, is_active = ?
      WHERE id = ?
    `, [title, bond_level_required, reward, videoUrl, question, expected_answer, is_active, id]);
    
    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
