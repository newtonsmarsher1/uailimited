// UAI Management Utility
// This script provides safe data management functions without affecting the system

const mysql = require('mysql2/promise');

class UAIManagementUtility {
    constructor() {
        this.connection = null;
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

    // Safe data viewing functions (read-only)
    async getRechargeStats() {
        try {
            const [stats] = await this.connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved_amount
                FROM payments 
                WHERE payment_method LIKE '%hr_manager%' OR payment_method LIKE '%method%' OR payment_method LIKE '%financial%'
            `);
            return stats[0];
        } catch (error) {
            console.error('Error getting recharge stats:', error);
            throw error;
        }
    }

    async getWithdrawalStats() {
        try {
            const [stats] = await this.connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_approved_amount
                FROM withdrawals
            `);
            return stats[0];
        } catch (error) {
            console.error('Error getting withdrawal stats:', error);
            throw error;
        }
    }

    async getRecentRecharges(limit = 10) {
        try {
            const [recharges] = await this.connection.execute(`
                SELECT p.*, u.name as user_name, u.phone as user_phone
                FROM payments p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.payment_method LIKE '%hr_manager%' OR p.payment_method LIKE '%method%' OR p.payment_method LIKE '%financial%'
                ORDER BY p.created_at DESC
                LIMIT ${limit}
            `);
            return recharges;
        } catch (error) {
            console.error('Error getting recent recharges:', error);
            throw error;
        }
    }

    async getRecentWithdrawals(limit = 10) {
        try {
            const [withdrawals] = await this.connection.execute(`
                SELECT w.*, u.name as user_name, u.phone as user_phone
                FROM withdrawals w
                LEFT JOIN users u ON w.user_id = u.id
                ORDER BY w.requested_at DESC
                LIMIT ${limit}
            `);
            return withdrawals;
        } catch (error) {
            console.error('Error getting recent withdrawals:', error);
            throw error;
        }
    }

    // Data analysis functions
    async analyzeRechargePatterns() {
        try {
            const [patterns] = await this.connection.execute(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount
                FROM payments 
                WHERE payment_method LIKE '%hr_manager%' OR payment_method LIKE '%method%' OR payment_method LIKE '%financial%'
                AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `);
            return patterns;
        } catch (error) {
            console.error('Error analyzing recharge patterns:', error);
            throw error;
        }
    }

    async analyzeWithdrawalPatterns() {
        try {
            const [patterns] = await this.connection.execute(`
                SELECT 
                    DATE(requested_at) as date,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount
                FROM withdrawals 
                WHERE requested_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(requested_at)
                ORDER BY date DESC
            `);
            return patterns;
        } catch (error) {
            console.error('Error analyzing withdrawal patterns:', error);
            throw error;
        }
    }

    // Safe data export functions
    async exportRechargeData(startDate, endDate) {
        try {
            const [data] = await this.connection.execute(`
                SELECT 
                    p.id,
                    p.amount,
                    p.status,
                    p.payment_method,
                    p.verification_message,
                    p.created_at,
                    p.processed_at,
                    u.name as user_name,
                    u.phone as user_phone
                FROM payments p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE (p.payment_method LIKE '%hr_manager%' OR p.payment_method LIKE '%method%' OR p.payment_method LIKE '%financial%')
                AND p.created_at BETWEEN ? AND ?
                ORDER BY p.created_at DESC
            `, [startDate, endDate]);
            return data;
        } catch (error) {
            console.error('Error exporting recharge data:', error);
            throw error;
        }
    }

    async exportWithdrawalData(startDate, endDate) {
        try {
            const [data] = await this.connection.execute(`
                SELECT 
                    w.id,
                    w.amount,
                    w.status,
                    w.bank_details,
                    w.account_number,
                    w.requested_at,
                    w.processed_at,
                    u.name as user_name,
                    u.phone as user_phone
                FROM withdrawals w
                LEFT JOIN users u ON w.user_id = u.id
                WHERE w.requested_at BETWEEN ? AND ?
                ORDER BY w.requested_at DESC
            `, [startDate, endDate]);
            return data;
        } catch (error) {
            console.error('Error exporting withdrawal data:', error);
            throw error;
        }
    }

    // Utility functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    generateReport(data, type) {
        const report = {
            type: type,
            generated_at: new Date().toISOString(),
            total_records: data.length,
            summary: {}
        };

        if (type === 'recharge') {
            report.summary = {
                total_amount: data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
                pending_count: data.filter(item => item.status === 'pending').length,
                approved_count: data.filter(item => item.status === 'approved').length,
                rejected_count: data.filter(item => item.status === 'rejected').length
            };
        } else if (type === 'withdrawal') {
            report.summary = {
                total_amount: data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
                pending_count: data.filter(item => item.status === 'pending').length,
                approved_count: data.filter(item => item.status === 'approved').length,
                rejected_count: data.filter(item => item.status === 'rejected').length
            };
        }

        return report;
    }
}

// Example usage function
async function runManagementReport() {
    const utility = new UAIManagementUtility();
    
    try {
        await utility.connect();
        
        console.log('\n📊 UAI Management Report');
        console.log('='.repeat(50));
        
        // Get recharge stats
        const rechargeStats = await utility.getRechargeStats();
        console.log('\n💰 Recharge Statistics:');
        console.log(`Total: ${rechargeStats.total}`);
        console.log(`Pending: ${rechargeStats.pending}`);
        console.log(`Approved: ${rechargeStats.approved}`);
        console.log(`Rejected: ${rechargeStats.rejected}`);
        console.log(`Total Approved Amount: ${utility.formatCurrency(rechargeStats.total_approved_amount)}`);
        
        // Get withdrawal stats
        const withdrawalStats = await utility.getWithdrawalStats();
        console.log('\n💸 Withdrawal Statistics:');
        console.log(`Total: ${withdrawalStats.total}`);
        console.log(`Pending: ${withdrawalStats.pending}`);
        console.log(`Approved: ${withdrawalStats.approved}`);
        console.log(`Rejected: ${withdrawalStats.rejected}`);
        console.log(`Total Approved Amount: ${utility.formatCurrency(withdrawalStats.total_approved_amount)}`);
        
        // Get recent activity
        const recentRecharges = await utility.getRecentRecharges(5);
        console.log('\n📋 Recent Recharges:');
        recentRecharges.forEach(recharge => {
            console.log(`- ${recharge.user_name} (${recharge.user_phone}): ${utility.formatCurrency(recharge.amount)} - ${recharge.status}`);
        });
        
        const recentWithdrawals = await utility.getRecentWithdrawals(5);
        console.log('\n📋 Recent Withdrawals:');
        recentWithdrawals.forEach(withdrawal => {
            console.log(`- ${withdrawal.user_name} (${withdrawal.user_phone}): ${utility.formatCurrency(withdrawal.amount)} - ${withdrawal.status}`);
        });
        
    } catch (error) {
        console.error('❌ Error generating report:', error);
    } finally {
        await utility.disconnect();
    }
}

// Export for use in other scripts
module.exports = UAIManagementUtility;

// Run report if this script is executed directly
if (require.main === module) {
    runManagementReport();
}
