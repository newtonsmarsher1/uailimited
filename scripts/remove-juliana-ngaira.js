const mysql = require('mysql2/promise');

async function removeJulianaNgaira() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    console.log('🔍 Searching for Juliana Ngaira in financial managers...\n');
    
    // Search for Juliana Ngaira in admin_users table
    const [searchResults] = await pool.query(`
      SELECT id, name, mobile, role, payment_method, verified, rejected, is_active, created_at
      FROM admin_users 
      WHERE name LIKE '%juliana%' OR name LIKE '%ngaira%' OR 
            mobile LIKE '%juliana%' OR mobile LIKE '%ngaira%'
    `);
    
    if (searchResults.length === 0) {
      console.log('❌ No records found for Juliana Ngaira');
      
      // Let's also check all financial managers to see what's available
      const [allFinancialManagers] = await pool.query(`
        SELECT id, name, mobile, role, payment_method, verified, rejected, is_active
        FROM admin_users 
        WHERE role = 'Financial Manager'
        ORDER BY name
      `);
      
      console.log('\n📋 Current Financial Managers:');
      allFinancialManagers.forEach((manager, index) => {
        console.log(`   ${index + 1}. ${manager.name} (${manager.mobile}) - ${manager.payment_method} - ${manager.is_active ? 'Active' : 'Inactive'}`);
      });
      
      return;
    }
    
    console.log('📋 Found records for Juliana Ngaira:');
    searchResults.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}`);
      console.log(`      Name: ${record.name}`);
      console.log(`      Mobile: ${record.mobile}`);
      console.log(`      Role: ${record.role}`);
      console.log(`      Payment Method: ${record.payment_method}`);
      console.log(`      Verified: ${record.verified ? 'Yes' : 'No'}`);
      console.log(`      Rejected: ${record.rejected ? 'Yes' : 'No'}`);
      console.log(`      Active: ${record.is_active ? 'Yes' : 'No'}`);
      console.log(`      Created: ${record.created_at}`);
      console.log('');
    });
    
    // Remove/disable all found records
    for (const record of searchResults) {
      console.log(`🗑️ Removing record ID ${record.id} (${record.name})...`);
      
      // Soft delete by setting rejected = 1 and is_active = 0
      await pool.query(`
        UPDATE admin_users 
        SET rejected = 1, is_active = 0, updated_at = NOW()
        WHERE id = ?
      `, [record.id]);
      
      console.log(`✅ Record ID ${record.id} has been removed from financial managers`);
    }
    
    console.log('\n🔍 Verification - Checking if Juliana Ngaira still appears:');
    const [verifyResults] = await pool.query(`
      SELECT id, name, mobile, role, is_active, rejected
      FROM admin_users 
      WHERE (name LIKE '%juliana%' OR name LIKE '%ngaira%') AND role = 'Financial Manager'
    `);
    
    if (verifyResults.length === 0) {
      console.log('✅ Juliana Ngaira has been successfully removed from financial managers');
    } else {
      console.log('⚠️ Some records may still exist:');
      verifyResults.forEach(record => {
        console.log(`   - ${record.name} (ID: ${record.id}) - Active: ${record.is_active}, Rejected: ${record.rejected}`);
      });
    }
    
    // Show updated financial managers list
    const [updatedManagers] = await pool.query(`
      SELECT id, name, mobile, role, payment_method, is_active, rejected
      FROM admin_users 
      WHERE role = 'Financial Manager' AND rejected = 0 AND is_active = 1
      ORDER BY name
    `);
    
    console.log('\n📋 Updated Active Financial Managers:');
    if (updatedManagers.length === 0) {
      console.log('   No active financial managers found');
    } else {
      updatedManagers.forEach((manager, index) => {
        console.log(`   ${index + 1}. ${manager.name} (${manager.mobile}) - ${manager.payment_method}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error removing Juliana Ngaira:', error.message);
  } finally {
    pool.end();
  }
}

removeJulianaNgaira();




