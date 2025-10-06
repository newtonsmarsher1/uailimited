const mysql = require('mysql2/promise');

async function fixLawineWallet() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔧 Fixing Lawine Omuse\'s Wallet Balance\n');
    
    // Get Lawine's details
    const [lawine] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance, referred_by
      FROM users 
      WHERE phone = '+254758432064' OR phone = '0758432064'
    `);
    
    if (lawine.length === 0) {
      console.log('❌ Lawine Omuse not found in database');
      return;
    }
    
    const lawineData = lawine[0];
    console.log(`👤 Lawine Omuse Details:`);
    console.log(`   ID: ${lawineData.id}`);
    console.log(`   Name: ${lawineData.name}`);
    console.log(`   Phone: ${lawineData.phone}`);
    console.log(`   Level: ${lawineData.level}`);
    console.log(`   Current Wallet Balance: KES ${parseFloat(lawineData.wallet_balance).toFixed(2)}`);
    console.log(`   Referred By: ${lawineData.referred_by}`);
    
    // Calculate Lawine's actual task earnings
    console.log('\n📊 Calculating Lawine\'s task earnings...');
    
    // Get all completed tasks for Lawine
    const [completedTasks] = await pool.query(`
      SELECT 
        ut.id,
        ut.task_id,
        ut.app_task_id,
        ut.reward_earned,
        ut.completed_at,
        t.title as task_name,
        at.app_name as app_name
      FROM user_tasks ut
      LEFT JOIN tasks t ON t.id = ut.task_id
      LEFT JOIN app_tasks at ON at.id = ut.app_task_id
      WHERE ut.user_id = ? AND ut.is_complete = 1
      ORDER BY ut.completed_at DESC
    `, [lawineData.id]);
    
    console.log(`\n📋 Found ${completedTasks.length} completed tasks:`);
    
    let totalTaskEarnings = 0;
    let taskCount = 0;
    
    if (completedTasks.length > 0) {
      console.log('Task ID | Task Name/App        | Earning  | Completed Date');
      console.log('-' .repeat(60));
      
      completedTasks.forEach(task => {
        const taskId = task.id.toString().padEnd(7);
        const taskName = (task.task_name || task.app_name || 'Unknown').substring(0, 20).padEnd(20);
        const earning = `KES ${parseFloat(task.reward_earned || 0).toFixed(2)}`.padEnd(8);
        const date = new Date(task.completed_at).toLocaleDateString();
        
        console.log(`${taskId} | ${taskName} | ${earning} | ${date}`);
        
        totalTaskEarnings += parseFloat(task.reward_earned || 0);
        taskCount++;
      });
    } else {
      console.log('   No completed tasks found');
    }
    
    // Check for any other earnings (payments, etc.)
    console.log('\n🔍 Checking for other earnings...');
    
    // Check if there are any other earnings records
    const [otherEarnings] = await pool.query(`
      SELECT 
        'payment' as type,
        amount,
        created_at,
        'Payment' as description
      FROM payments 
      WHERE user_id = ? AND status = 'completed'
      ORDER BY created_at DESC
    `, [lawineData.id]);
    
    if (otherEarnings.length > 0) {
      console.log(`\n📋 Found ${otherEarnings.length} other earnings:`);
      console.log('Type   | Amount  | Date       | Description');
      console.log('-' .repeat(50));
      
      otherEarnings.forEach(earning => {
        const type = earning.type.padEnd(6);
        const amount = `KES ${parseFloat(earning.amount).toFixed(2)}`.padEnd(7);
        const date = new Date(earning.created_at).toLocaleDateString();
        const desc = earning.description || 'N/A';
        
        console.log(`${type} | ${amount} | ${date} | ${desc}`);
        totalTaskEarnings += parseFloat(earning.amount);
      });
    } else {
      console.log('   No other earnings found');
    }
    
    // Update Lawine's wallet to reflect only task earnings
    console.log('\n💰 Updating Lawine\'s wallet balance...');
    console.log(`   Current balance: KES ${parseFloat(lawineData.wallet_balance).toFixed(2)}`);
    console.log(`   Calculated task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`   Tasks completed: ${taskCount}`);
    
    await pool.query(`
      UPDATE users 
      SET wallet_balance = ?
      WHERE id = ?
    `, [totalTaskEarnings, lawineData.id]);
    
    console.log(`   New balance: KES ${totalTaskEarnings.toFixed(2)}`);
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('=' .repeat(60));
    console.log(`Tasks completed: ${taskCount}`);
    console.log(`Total task earnings: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`Wallet updated to: KES ${totalTaskEarnings.toFixed(2)}`);
    console.log(`Previous balance: KES ${parseFloat(lawineData.wallet_balance).toFixed(2)}`);
    console.log(`Difference: KES ${(totalTaskEarnings - parseFloat(lawineData.wallet_balance)).toFixed(2)}`);
    
    // Verify the update
    console.log('\n🔍 Verifying update...');
    
    const [updatedLawine] = await pool.query(`
      SELECT id, name, phone, level, wallet_balance
      FROM users 
      WHERE id = ?
    `, [lawineData.id]);
    
    console.log(`\n✅ Verification Results:`);
    console.log(`   Lawine's new wallet balance: KES ${parseFloat(updatedLawine[0].wallet_balance).toFixed(2)}`);
    console.log(`   This now reflects only her task earnings`);
    
    if (Math.abs(parseFloat(updatedLawine[0].wallet_balance) - totalTaskEarnings) < 0.01) {
      console.log('\n✅ Wallet balance successfully updated to reflect task earnings only!');
    } else {
      console.log('\n⚠️  There may be a discrepancy. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

fixLawineWallet();
