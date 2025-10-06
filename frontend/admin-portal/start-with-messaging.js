// Startup script for admin portal with messaging
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting UAI Admin Portal with Messaging...');
console.log('='.repeat(50));

// Start the main admin portal server
console.log('📡 Starting admin portal server on port 3001...');
const adminServer = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

// Start the messaging WebSocket server
console.log('💬 Starting messaging WebSocket server on port 4001...');
const messagingServer = spawn('node', ['messaging-server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

// Handle process events
adminServer.on('error', (error) => {
    console.error('❌ Admin server error:', error);
});

messagingServer.on('error', (error) => {
    console.error('❌ Messaging server error:', error);
});

adminServer.on('close', (code) => {
    console.log(`📡 Admin server exited with code ${code}`);
});

messagingServer.on('close', (code) => {
    console.log(`💬 Messaging server exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    adminServer.kill('SIGINT');
    messagingServer.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down servers...');
    adminServer.kill('SIGTERM');
    messagingServer.kill('SIGTERM');
    process.exit(0);
});

console.log('✅ Both servers started successfully!');
console.log('🌐 Admin Portal: http://localhost:3001');
console.log('💬 Messaging WebSocket: ws://localhost:4001');
console.log('\nPress Ctrl+C to stop both servers');
