const express = require('express');
const pool = require('../config/database.js');
const { pushNotification } = require('../services/notificationService.js');
const { getInvestmentStats } = require('../services/investmentService.js');
const { simpleAuth } = require('../middleware/auth-simple.js');

const router = express.Router();

// Create investment
router.post('/invest', simpleAuth, async (req, res) => {
  try {
    const { amount, fundName, walletType } = req.body;
    const userId = req.user.id;

    if (!amount || !fundName || !walletType) {
      return res.status(400).json({ error: 'Amount, fund name, and wallet type are required' });
    }

    const investmentAmount = parseFloat(amount);
    if (isNaN(investmentAmount) || investmentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid investment amount' });
    }

    // Get fund configuration from database
    const [fundConfigRows] = await pool.query(
      'SELECT * FROM fund_configurations WHERE fund_name = ? AND is_active = TRUE',
      [fundName]
    );

    if (fundConfigRows.length === 0) {
      return res.status(400).json({ error: 'Invalid fund name or fund is not active' });
    }

    const fundConfig = fundConfigRows[0];

    // Validate investment amount against fund limits
    if (investmentAmount < fundConfig.min_investment) {
      return res.status(400).json({ 
        error: `Minimum investment amount is KES ${fundConfig.min_investment}`,
        minAmount: fundConfig.min_investment
      });
    }

    if (investmentAmount > fundConfig.max_investment) {
      return res.status(400).json({ 
        error: `Maximum investment amount is KES ${fundConfig.max_investment}`,
        maxAmount: fundConfig.max_investment
      });
    }

    // Check fund capacity based on actual investments
    const [currentInvestments] = await pool.query(`
      SELECT SUM(amount) as total_invested
      FROM investments 
      WHERE fund_name = ? AND status = 'active'
    `, [fundName]);

    const currentUsedCapacity = currentInvestments[0].total_invested || 0;
    const newUsedCapacity = currentUsedCapacity + investmentAmount;
    const newPercentageFilled = (newUsedCapacity / fundConfig.max_capacity) * 100;

    if (newUsedCapacity > fundConfig.max_capacity) {
      return res.status(400).json({ 
        error: 'Fund is full! No more investments can be accepted.',
        availableCapacity: fundConfig.max_capacity - currentUsedCapacity,
        requestedAmount: investmentAmount,
        currentPercentage: (currentUsedCapacity / fundConfig.max_capacity) * 100
      });
    }

    // Get user's current wallet balance
    const [userRows] = await pool.query(
      'SELECT wallet_balance FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBalance = parseFloat(userRows[0].wallet_balance || 0);

    // Check if user has sufficient balance
    if (currentBalance < investmentAmount) {
      return res.status(400).json({ 
        error: 'Insufficient funds in wallet',
        currentBalance: currentBalance,
        requiredAmount: investmentAmount
      });
    }

    // Start transaction for data consistency
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deduct amount from wallet
      const newBalance = currentBalance - investmentAmount;
      await connection.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, userId]);

      // Create investment record
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + fundConfig.duration_days);
      
      await connection.query(
        'INSERT INTO investments (user_id, fund_name, amount, roi_percentage, duration_days, wallet_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, "active")',
        [userId, fundName, investmentAmount, fundConfig.roi_percentage, fundConfig.duration_days, walletType, endDate]
      );

      await connection.commit();

      // Send notification to user (outside transaction to avoid lock timeout)
      try {
        const expectedReturn = investmentAmount * (1 + (fundConfig.roi_percentage / 100) * fundConfig.duration_days);
        const isFundFull = newPercentageFilled >= 100;
        const capacityMessage = isFundFull ? 
          `🎉 Fund is now FULL (${newPercentageFilled.toFixed(1)}%)! New cycle will start after payouts.` : 
          `📊 Fund capacity: ${newPercentageFilled.toFixed(1)}% filled`;
        
        await pushNotification(userId, 
          `Investment of KES ${investmentAmount.toFixed(2)} in ${fundName} processed successfully. Expected return: KES ${expectedReturn.toFixed(2)}. ${capacityMessage}`, 
          'success'
        );
      } catch (notificationError) {
        console.log('⚠️ Notification failed, but investment was successful:', notificationError.message);
      }

      const response = {
        success: true,
        message: 'Investment processed successfully',
        newBalance: newBalance,
        investment: {
          fundName,
          amount: investmentAmount,
          roi: fundConfig.roi_percentage,
          duration: fundConfig.duration_days,
          expectedReturn: investmentAmount * (1 + (fundConfig.roi_percentage / 100) * fundConfig.duration_days)
        },
        fundCapacity: {
          used: newUsedCapacity,
          total: fundConfig.max_capacity,
          percentage: newPercentageFilled,
          isFull: newPercentageFilled >= 100
        }
      };

      res.json(response);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error processing investment:', error);
    res.status(500).json({ error: 'Failed to process investment: ' + error.message });
  }
});

// Get user's investment history
router.get('/', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔍 DEBUG: Getting investments for user ID:', userId);
    console.log('🔍 DEBUG: User from token:', req.user);

    const [investmentRows] = await pool.query(`
      SELECT 
        id,
        fund_name,
        amount,
        roi_percentage,
        duration_days,
        start_date,
        end_date,
        wallet_type,
        status,
        created_at,
        total_earned,
        user_id,
        CASE 
          WHEN status = 'completed' THEN amount + (amount * (roi_percentage / 100) * duration_days)
          WHEN end_date <= NOW() THEN amount + (amount * (roi_percentage / 100) * duration_days)
          ELSE amount
        END as current_value,
        CASE 
          WHEN status = 'completed' THEN (amount * (roi_percentage / 100) * duration_days)
          WHEN end_date <= NOW() THEN (amount * (roi_percentage / 100) * duration_days)
          ELSE 0
        END as earned_interest
      FROM investments 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [userId]);

    console.log('🔍 DEBUG: Found investments:', investmentRows.length);
    console.log('🔍 DEBUG: Investment details:', investmentRows.map(inv => ({
      id: inv.id,
      fund_name: inv.fund_name,
      amount: inv.amount,
      user_id: inv.user_id
    })));

    res.json({
      success: true,
      investments: investmentRows
    });

  } catch (error) {
    console.error('Error getting investment history:', error);
    
    // Send a proper JSON response even on error
    try {
      res.status(500).json({ 
        error: 'Failed to get investment history',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } catch (jsonError) {
      // If JSON response fails, send plain text
      res.status(500).set('Content-Type', 'text/plain');
      res.send('Failed to get investment history');
    }
  }
});

// Get fund information (private - no other users' data)
router.get('/fund-info', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [fundConfigs] = await pool.query(`
      SELECT 
        fc.fund_name,
        fc.max_capacity,
        fc.min_investment,
        fc.max_investment,
        fc.roi_percentage,
        fc.duration_days,
        fc.is_active
      FROM fund_configurations fc
      WHERE fc.is_active = TRUE
      ORDER BY fc.fund_name
    `);

    // Get user's own investments for each fund
    const [userInvestments] = await pool.query(`
      SELECT 
        fund_name,
        COUNT(*) as user_investment_count,
        SUM(amount) as user_total_invested
      FROM investments 
      WHERE user_id = ? AND status = 'active'
      GROUP BY fund_name
    `, [userId]);

    // Create a map of user's investments by fund
    const userInvestmentMap = {};
    userInvestments.forEach(inv => {
      userInvestmentMap[inv.fund_name] = {
        count: inv.user_investment_count,
        total: inv.user_total_invested
      };
    });

    res.json({
      success: true,
      funds: fundConfigs.map(fund => {
        const userInvestment = userInvestmentMap[fund.fund_name] || { count: 0, total: 0 };
        
        return {
          name: fund.fund_name,
          maxCapacity: fund.max_capacity,
          minInvestment: fund.min_investment,
          maxInvestment: fund.max_investment,
          roi: fund.roi_percentage,
          duration: fund.duration_days,
          // Only show user's own investment data
          userInvestmentCount: userInvestment.count,
          userTotalInvested: userInvestment.total,
          userAvailableCapacity: fund.max_capacity - userInvestment.total,
          // Simple availability status without revealing other users' data
          isAvailable: true // Always show as available, let backend handle capacity limits
        };
      })
    });

  } catch (error) {
    console.error('Error getting fund info:', error);
    res.status(500).json({ error: 'Failed to get fund information' });
  }
});

// Get investment statistics
router.get('/stats', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getInvestmentStats(userId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting investment stats:', error);
    res.status(500).json({ error: 'Failed to get investment statistics' });
  }
});

// Process payouts for matured investments
router.post('/process-payouts', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get matured investments that haven't been processed yet
    const [maturedInvestments] = await pool.query(`
      SELECT 
        id,
        fund_name,
        amount,
        roi_percentage,
        duration_days,
        start_date,
        end_date,
        wallet_type
      FROM investments 
      WHERE user_id = ? 
        AND end_date <= NOW() 
        AND status = 'active'
    `, [userId]);

    if (maturedInvestments.length === 0) {
      return res.json({
        success: true,
        message: 'No matured investments to process',
        processedCount: 0
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let totalPayout = 0;
      const processedInvestments = [];

      for (const investment of maturedInvestments) {
        // Calculate payout amount
        const payoutAmount = investment.amount + (investment.amount * (investment.roi_percentage / 100) * investment.duration_days);
        totalPayout += payoutAmount;

        // Update investment status to completed
        await connection.query(
          'UPDATE investments SET status = ?, total_earned = ? WHERE id = ?',
          ['completed', payoutAmount, investment.id]
        );

        processedInvestments.push({
          id: investment.id,
          fund_name: investment.fund_name,
          amount: investment.amount,
          payout: payoutAmount
        });
      }

      // Add payout to user's wallet
      await connection.query(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [totalPayout, userId]
      );

      await connection.commit();

      // Send notification (outside transaction to avoid lock timeout)
      try {
        await pushNotification(userId, `Payout processed! KES ${totalPayout.toFixed(2)} has been added to your wallet from ${processedInvestments.length} matured investments.`, 'success');
      } catch (notificationError) {
        console.log('⚠️ Notification failed, but payout was successful:', notificationError.message);
      }

      res.json({
        success: true,
        message: 'Payouts processed successfully',
        processedCount: processedInvestments.length,
        totalPayout: totalPayout,
        processedInvestments: processedInvestments
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error processing payouts:', error);
    res.status(500).json({ error: 'Failed to process payouts: ' + error.message });
  }
});

module.exports = router;
