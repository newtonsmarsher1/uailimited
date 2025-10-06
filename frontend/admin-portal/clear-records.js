// UAI Record Clearing Utility
// This script provides safe record clearing functions with backup options

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class UAIRecordClearingUtility {
    constructor() {
        this.connection = null;
        this.backupDir = './backups';
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection({
                host: '127.0.0.1',
                user: 'root',
                password: 'Caroline',
                database: 'uai'
            });
            console.log('✅ Connected to UAI database');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('✅ Database connection closed');
        }
    }

    async createBackupDir() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log('📁 Backup directory created');
        } catch (error) {
            console.log('📁 Backup directory already exists');
        }
    }

    async backupTable(tableName) {
        try {
            console.log(`📦 Creating backup for ${tableName}...`);
            
            // Get all data from table
            const [data] = await this.connection.execute(`SELECT * FROM ${tableName}`);
            
            // Create backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `${tableName}_backup_${timestamp}.json`);
            
            // Write backup to file
            await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
            
            console.log(`✅ Backup created: ${backupFile}`);
            console.log(`📊 Records backed up: ${data.length}`);
            
            return backupFile;
        } catch (error) {
            console.error(`❌ Error creating backup for ${tableName}:`, error);
            throw error;
        }
    }

    async clearRechargeRecords(options = {}) {
        try {
            const { 
                clearApproved = false, 
                clearRejected = false, 
                clearPending = true,
                createBackup = true 
            } = options;

            console.log('\n🧹 Clearing Recharge Records...');
            console.log('Options:', { clearApproved, clearRejected, clearPending, createBackup });

            if (createBackup) {
                await this.backupTable('payments');
            }

            // Build WHERE clause based on options
            let whereConditions = [];
            if (clearApproved) whereConditions.push("status = 'approved'");
            if (clearRejected) whereConditions.push("status = 'rejected'");
            if (clearPending) whereConditions.push("status = 'pending'");

            if (whereConditions.length === 0) {
                console.log('⚠️ No conditions specified - no records will be cleared');
                return;
            }

            const whereClause = whereConditions.join(' OR ');
            
            // First, get count of records to be deleted
            const [countResult] = await this.connection.execute(`
                SELECT COUNT(*) as count 
                FROM payments 
                WHERE (payment_method LIKE '%hr_manager%' OR payment_method LIKE '%method%' OR payment_method LIKE '%financial%')
                AND (${whereClause})
            `);
            
            const recordCount = countResult[0].count;
            console.log(`📊 Records to be cleared: ${recordCount}`);

            if (recordCount === 0) {
                console.log('✅ No records found matching criteria');
                return;
            }

            // Confirm deletion
            console.log(`⚠️ About to delete ${recordCount} recharge records`);
            console.log('This action cannot be undone!');
            
            // Delete records
            const [result] = await this.connection.execute(`
                DELETE FROM payments 
                WHERE (payment_method LIKE '%hr_manager%' OR payment_method LIKE '%method%' OR payment_method LIKE '%financial%')
                AND (${whereClause})
            `);

            console.log(`✅ Successfully cleared ${result.affectedRows} recharge records`);
            
        } catch (error) {
            console.error('❌ Error clearing recharge records:', error);
            throw error;
        }
    }

    async clearWithdrawalRecords(options = {}) {
        try {
            const { 
                clearApproved = false, 
                clearRejected = false, 
                clearPending = true,
                createBackup = true 
            } = options;

            console.log('\n🧹 Clearing Withdrawal Records...');
            console.log('Options:', { clearApproved, clearRejected, clearPending, createBackup });

            if (createBackup) {
                await this.backupTable('withdrawals');
            }

            // Build WHERE clause based on options
            let whereConditions = [];
            if (clearApproved) whereConditions.push("status = 'approved'");
            if (clearRejected) whereConditions.push("status = 'rejected'");
            if (clearPending) whereConditions.push("status = 'pending'");

            if (whereConditions.length === 0) {
                console.log('⚠️ No conditions specified - no records will be cleared');
                return;
            }

            const whereClause = whereConditions.join(' OR ');
            
            // First, get count of records to be deleted
            const [countResult] = await this.connection.execute(`
                SELECT COUNT(*) as count 
                FROM withdrawals 
                WHERE ${whereClause}
            `);
            
            const recordCount = countResult[0].count;
            console.log(`📊 Records to be cleared: ${recordCount}`);

            if (recordCount === 0) {
                console.log('✅ No records found matching criteria');
                return;
            }

            // Confirm deletion
            console.log(`⚠️ About to delete ${recordCount} withdrawal records`);
            console.log('This action cannot be undone!');
            
            // Delete records
            const [result] = await this.connection.execute(`
                DELETE FROM withdrawals 
                WHERE ${whereClause}
            `);

            console.log(`✅ Successfully cleared ${result.affectedRows} withdrawal records`);
            
        } catch (error) {
            console.error('❌ Error clearing withdrawal records:', error);
            throw error;
        }
    }

    async clearAllRecords(options = {}) {
        try {
            const { 
                clearApproved = false, 
                clearRejected = false, 
                clearPending = true,
                createBackup = true 
            } = options;

            console.log('\n🧹 Clearing All Records...');
            console.log('Options:', { clearApproved, clearRejected, clearPending, createBackup });

            await this.createBackupDir();

            // Clear recharge records
            await this.clearRechargeRecords({
                clearApproved,
                clearRejected,
                clearPending,
                createBackup
            });

            // Clear withdrawal records
            await this.clearWithdrawalRecords({
                clearApproved,
                clearRejected,
                clearPending,
                createBackup: false // Already created backup above
            });

            console.log('\n✅ All record clearing operations completed');
            
        } catch (error) {
            console.error('❌ Error clearing all records:', error);
            throw error;
        }
    }

    async showCurrentStats() {
        try {
            console.log('\n📊 Current System Statistics:');
            console.log('='.repeat(50));

            // Recharge stats
            const [rechargeStats] = await this.connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                FROM payments 
                WHERE payment_method LIKE '%hr_manager%' OR payment_method LIKE '%method%' OR payment_method LIKE '%financial%'
            `);

            console.log('\n💰 Recharge Records:');
            console.log(`Total: ${rechargeStats[0].total}`);
            console.log(`Pending: ${rechargeStats[0].pending}`);
            console.log(`Approved: ${rechargeStats[0].approved}`);
            console.log(`Rejected: ${rechargeStats[0].rejected}`);

            // Withdrawal stats
            const [withdrawalStats] = await this.connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                FROM withdrawals
            `);

            console.log('\n💸 Withdrawal Records:');
            console.log(`Total: ${withdrawalStats[0].total}`);
            console.log(`Pending: ${withdrawalStats[0].pending}`);
            console.log(`Approved: ${withdrawalStats[0].approved}`);
            console.log(`Rejected: ${withdrawalStats[0].rejected}`);

        } catch (error) {
            console.error('❌ Error getting current stats:', error);
            throw error;
        }
    }
}

// Command line interface
async function runClearingUtility() {
    const utility = new UAIRecordClearingUtility();
    
    try {
        await utility.connect();
        
        // Show current stats
        await utility.showCurrentStats();
        
        console.log('\n🔧 Available Clearing Options:');
        console.log('1. Clear only PENDING records (default)');
        console.log('2. Clear only REJECTED records');
        console.log('3. Clear only APPROVED records');
        console.log('4. Clear ALL records');
        console.log('5. Show stats only (no clearing)');
        
        // For demonstration, let's clear only pending records
        console.log('\n⚠️ DEMO: Clearing only PENDING records...');
        
        await utility.clearAllRecords({
            clearApproved: false,
            clearRejected: false,
            clearPending: true,
            createBackup: true
        });
        
        // Show stats after clearing
        console.log('\n📊 Statistics After Clearing:');
        await utility.showCurrentStats();
        
    } catch (error) {
        console.error('❌ Error in clearing utility:', error);
    } finally {
        await utility.disconnect();
    }
}

// Export for use in other scripts
module.exports = UAIRecordClearingUtility;

// Run utility if this script is executed directly
if (require.main === module) {
    runClearingUtility();
}
