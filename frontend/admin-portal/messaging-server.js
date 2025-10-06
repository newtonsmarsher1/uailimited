// WebSocket server for admin messaging
const WebSocket = require('ws');
const http = require('http');
const mysql = require('mysql2/promise');

class AdminMessagingServer {
  constructor(port = 4001) {
    this.port = port;
    this.clients = new Map();
    this.rooms = new Map();
    this.setupDatabase();
  }
  
  async setupDatabase() {
    try {
      this.db = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'Caroline',
        database: 'uai'
      });
      console.log('✅ Database connected for messaging server');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }
  
  start() {
    const server = http.createServer();
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws, req) => {
      console.log('🔗 New WebSocket connection');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.handleDisconnect(ws);
      });
    });
    
    server.listen(this.port, () => {
      console.log(`🚀 Admin messaging WebSocket server running on port ${this.port}`);
    });
  }
  
  handleMessage(ws, message) {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message);
        break;
      case 'message':
        this.handleChatMessage(ws, message);
        break;
      case 'typing':
        this.handleTyping(ws, message);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.log('❓ Unknown message type:', message.type);
    }
  }
  
  handleJoin(ws, message) {
    const { adminId, adminName, role } = message;
    
    // Store client info
    this.clients.set(ws, {
      adminId,
      adminName,
      role,
      joinedAt: new Date()
    });
    
    // Add to admin room
    if (!this.rooms.has('admin-room')) {
      this.rooms.set('admin-room', new Set());
    }
    this.rooms.get('admin-room').add(ws);
    
    // Notify others about new admin joining
    this.broadcastToRoom('admin-room', {
      type: 'admin_joined',
      adminId,
      adminName,
      role,
      timestamp: new Date()
    }, ws);
    
    // Send current online admins to the new client
    const onlineAdmins = Array.from(this.rooms.get('admin-room')).map(client => {
      const clientInfo = this.clients.get(client);
      return {
        adminId: clientInfo.adminId,
        adminName: clientInfo.adminName,
        role: clientInfo.role,
        status: 'online'
      };
    });
    
    ws.send(JSON.stringify({
      type: 'online_admins',
      admins: onlineAdmins
    }));
    
    console.log(`👤 Admin ${adminName} (${role}) joined the messaging system`);
  }
  
  handleChatMessage(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;
    
    const chatMessage = {
      type: 'chat_message',
      id: Date.now(),
      text: message.text,
      senderId: clientInfo.adminId,
      senderName: clientInfo.adminName,
      senderRole: clientInfo.role,
      timestamp: new Date(),
      room: message.room || 'admin-room'
    };
    
    // Store message in database
    this.storeMessage(chatMessage);
    
    // Broadcast to room
    this.broadcastToRoom(chatMessage.room, chatMessage);
    
    console.log(`💬 Message from ${clientInfo.adminName}: ${message.text}`);
  }
  
  handleTyping(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;
    
    this.broadcastToRoom('admin-room', {
      type: 'typing',
      senderId: clientInfo.adminId,
      senderName: clientInfo.adminName,
      isTyping: message.isTyping
    }, ws);
  }
  
  handleDisconnect(ws) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      // Remove from rooms
      this.rooms.forEach((roomClients, roomName) => {
        roomClients.delete(ws);
      });
      
      // Notify others about admin leaving
      this.broadcastToRoom('admin-room', {
        type: 'admin_left',
        adminId: clientInfo.adminId,
        adminName: clientInfo.adminName,
        timestamp: new Date()
      });
      
      console.log(`👋 Admin ${clientInfo.adminName} left the messaging system`);
    }
    
    this.clients.delete(ws);
  }
  
  broadcastToRoom(roomName, message, excludeWs = null) {
    const room = this.rooms.get(roomName);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    room.forEach(client => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
  
  async storeMessage(message) {
    if (!this.db) return;
    
    try {
      await this.db.execute(`
        INSERT INTO admin_messages (sender_id, sender_name, sender_role, message_text, room, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        message.senderId,
        message.senderName,
        message.senderRole,
        message.text,
        message.room,
        message.timestamp
      ]);
    } catch (error) {
      console.error('❌ Error storing message:', error);
    }
  }
  
  async getRecentMessages(room = 'admin-room', limit = 50) {
    if (!this.db) return [];
    
    try {
      const [messages] = await this.db.execute(`
        SELECT * FROM admin_messages 
        WHERE room = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [room, limit]);
      
      return messages.reverse();
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      return [];
    }
  }
}

// Create and start the messaging server
const messagingServer = new AdminMessagingServer();
messagingServer.start();

module.exports = AdminMessagingServer;
