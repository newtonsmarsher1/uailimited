const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const http = require('http');
const url = require('url');

class AdminMessagingServer {
  constructor() {
    this.port = 3001;
    this.clients = new Map(); // adminId -> WebSocket
    this.adminSessions = new Map(); // WebSocket -> adminInfo
    this.videoMeetings = new Map(); // meetingId -> Set of WebSockets
    this.dbConnection = null;
    
    this.initializeDatabase();
    this.createServer();
  }
  
  async initializeDatabase() {
    try {
      this.dbConnection = await mysql.createConnection({
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
  
  createServer() {
    const server = http.createServer();
    
    this.wss = new WebSocket.Server({ 
      server
    });
    
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
    
    server.listen(this.port, () => {
      console.log(`🚀 Admin Messaging Server running on port ${this.port}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}`);
    });
  }
  
  handleConnection(ws, request) {
    console.log('🔗 New WebSocket connection');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('❌ Invalid message format:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });
    
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }
  
  async handleMessage(ws, message) {
    console.log('📨 Received message:', message.type);
    
    switch (message.type) {
      case 'admin_login':
        await this.handleAdminLogin(ws, message);
        break;
      case 'anonymous_login':
        await this.handleAnonymousLogin(ws, message);
        break;
      case 'get_online_admins':
        this.handleGetOnlineAdmins(ws);
        break;
      case 'send_message':
        await this.handleSendMessage(ws, message);
        break;
        case 'send_group_message':
          await this.handleSendGroupMessage(ws, message);
          break;
        case 'join_video_meeting':
          await this.handleJoinVideoMeeting(ws, message);
          break;
        case 'leave_video_meeting':
          await this.handleLeaveVideoMeeting(ws, message);
          break;
        case 'send_chat_message':
          await this.handleSendChatMessage(ws, message);
          break;
      case 'typing_start':
        this.handleTypingStart(ws, message);
        break;
      case 'typing_stop':
        this.handleTypingStop(ws, message);
        break;
      case 'mark_as_read':
        await this.handleMarkAsRead(ws, message);
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }
  
  async handleAdminLogin(ws, message) {
    const { adminId, adminName } = message;
    
    try {
      // Verify user exists in database (can be admin or worker)
      const [users] = await this.dbConnection.execute(
        'SELECT id, name, is_admin, level, is_active FROM users WHERE id = ? AND is_active = 1',
        [adminId]
      );
      
      if (users.length === 0) {
        this.sendError(ws, 'User not found or not active');
        return;
      }
      
      const user = users[0];
      
      // Store user session
      this.adminSessions.set(ws, {
        adminId: user.id.toString(),
        adminName: user.name,
        level: user.level,
        isAdmin: user.is_admin === 1,
        role: this.getUserRole(user.is_admin, user.level)
      });
      
      // Store client connection
      this.clients.set(user.id.toString(), ws);
      
      const userType = user.is_admin ? 'Admin' : 'Worker';
      console.log(`✅ ${userType} logged in: ${user.name} (ID: ${user.id})`);
      
      // Send login confirmation
      this.sendMessage(ws, {
        type: 'login_success',
        adminId: user.id.toString(),
        adminName: user.name,
        role: this.getUserRole(user.is_admin, user.level),
        isAdmin: user.is_admin === 1
      });
      
      // Notify other users
      this.broadcastToUsers({
        type: 'user_online',
        adminId: user.id.toString(),
        adminName: user.name,
        role: this.getUserRole(user.is_admin, user.level),
        isAdmin: user.is_admin === 1
      }, user.id.toString());
      
    } catch (error) {
      console.error('❌ Login error:', error);
      this.sendError(ws, 'Login failed');
    }
  }
  
  async handleAnonymousLogin(ws, message) {
    const { userId, userName } = message;
    
    try {
      // Store anonymous user session
      this.adminSessions.set(ws, {
        adminId: userId,
        adminName: userName,
        level: 0,
        isAdmin: false,
        role: 'Anonymous User'
      });
      
      // Store client connection
      this.clients.set(userId, ws);
      
      console.log(`✅ Anonymous user joined: ${userName} (ID: ${userId})`);
      
      // Send login confirmation
      this.sendMessage(ws, {
        type: 'login_success',
        adminId: userId,
        adminName: userName,
        role: 'Anonymous User',
        isAdmin: false
      });
      
      // Notify other users
      this.broadcastToUsers({
        type: 'user_online',
        adminId: userId,
        adminName: userName,
        role: 'Anonymous User',
        isAdmin: false
      }, userId);
      
    } catch (error) {
      console.error('❌ Error handling anonymous login:', error);
      this.sendError(ws, 'Login failed');
    }
  }
  
  handleGetOnlineAdmins(ws) {
    const onlineUsers = [];
    
    for (const [userId, clientWs] of this.clients) {
      const session = this.adminSessions.get(clientWs);
      if (session && clientWs.readyState === WebSocket.OPEN) {
        onlineUsers.push({
          adminId: session.adminId,
          adminName: session.adminName,
          role: session.role,
          isAdmin: session.isAdmin,
          status: 'online'
        });
      }
    }
    
    this.sendMessage(ws, {
      type: 'online_admins',
      admins: onlineUsers
    });
  }
  
  async handleSendMessage(ws, message) {
    const session = this.adminSessions.get(ws);
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    const { toAdminId, content, messageType = 'text' } = message;
    
    try {
      // Save message to database
      const [result] = await this.dbConnection.execute(`
        INSERT INTO admin_messages (from_admin_id, to_admin_id, content, message_type, status, created_at)
        VALUES (?, ?, ?, ?, 'sent', NOW())
      `, [session.adminId, toAdminId, content, messageType]);
      
      const messageId = result.insertId;
      
      // Send to recipient if online
      const recipientWs = this.clients.get(toAdminId);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        // Update message status to delivered
        await this.dbConnection.execute(
          'UPDATE admin_messages SET status = ? WHERE id = ?',
          ['delivered', messageId]
        );
        
        this.sendMessage(recipientWs, {
          type: 'new_message',
          messageId: messageId,
          fromAdminId: session.adminId,
          fromAdminName: session.adminName,
          content: content,
          messageType: messageType,
          timestamp: new Date().toISOString(),
          status: 'delivered'
        });
        
        // Notify sender that message was delivered
        this.sendMessage(ws, {
          type: 'message_delivered',
          messageId: messageId,
          toAdminId: toAdminId
        });
      } else {
        // Recipient is offline, message remains as 'sent'
        this.sendMessage(ws, {
          type: 'message_sent',
          messageId: messageId,
          toAdminId: toAdminId,
          content: content,
          status: 'sent'
        });
      }
      
      console.log(`📤 Message sent from ${session.adminName} to admin ${toAdminId}`);
      
    } catch (error) {
      console.error('❌ Send message error:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }
  
  handleTypingStart(ws, message) {
    const session = this.adminSessions.get(ws);
    if (!session) return;
    
    const { toAdminId } = message;
    const recipientWs = this.clients.get(toAdminId);
    
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendMessage(recipientWs, {
        type: 'typing_start',
        fromAdminId: session.adminId,
        fromAdminName: session.adminName
      });
    }
  }
  
  handleTypingStop(ws, message) {
    const session = this.adminSessions.get(ws);
    if (!session) return;
    
    const { toAdminId } = message;
    const recipientWs = this.clients.get(toAdminId);
    
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendMessage(recipientWs, {
        type: 'typing_stop',
        fromAdminId: session.adminId,
        fromAdminName: session.adminName
      });
    }
  }
  
  async handleSendGroupMessage(ws, message) {
    const session = this.adminSessions.get(ws);
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    const { content, messageType = 'text' } = message;
    
    try {
      // Save group message to database (to_admin_id = 0 for group messages)
      const [result] = await this.dbConnection.execute(`
        INSERT INTO admin_messages (from_admin_id, to_admin_id, content, message_type, status, created_at)
        VALUES (?, 0, ?, ?, 'sent', NOW())
      `, [session.adminId, content, messageType]);
      
      const messageId = result.insertId;
      
      // Broadcast to all connected users
      const groupMessage = {
        type: 'group_message',
        messageId: messageId,
        fromAdminId: session.adminId,
        fromAdminName: session.adminName,
        fromAdminRole: session.role,
        content: content,
        messageType: messageType,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };
      
      // Send to all connected users
      this.clients.forEach((clientWs, userId) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, groupMessage);
        }
      });
      
      // Update message status to delivered for all online users
      await this.dbConnection.execute(
        'UPDATE admin_messages SET status = ? WHERE id = ?',
        ['delivered', messageId]
      );
      
      console.log(`📢 Group message sent by ${session.adminName}: ${content}`);
      
    } catch (error) {
      console.error('❌ Error sending group message:', error);
      this.sendError(ws, 'Failed to send group message');
    }
  }
  
  async handleMarkAsRead(ws, message) {
    const session = this.adminSessions.get(ws);
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    const { messageIds, fromAdminId } = message;
    
    try {
      // Update message status to read
      if (messageIds && messageIds.length > 0) {
        await this.dbConnection.execute(`
          UPDATE admin_messages 
          SET status = 'read', read_at = NOW() 
          WHERE id IN (${messageIds.map(() => '?').join(',')}) 
          AND from_admin_id = ? AND to_admin_id = ?
        `, [...messageIds, fromAdminId, session.adminId]);
        
        // Notify sender that messages were read
        const senderWs = this.clients.get(fromAdminId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
          this.sendMessage(senderWs, {
            type: 'messages_read',
            messageIds: messageIds,
            readBy: session.adminId,
            readByName: session.adminName
          });
        }
        
        console.log(`✅ Messages marked as read by ${session.adminName}`);
      }
    } catch (error) {
      console.error('❌ Mark as read error:', error);
      this.sendError(ws, 'Failed to mark messages as read');
    }
  }
  
  handleDisconnection(ws) {
    const session = this.adminSessions.get(ws);
    if (session) {
      console.log(`👋 Admin disconnected: ${session.adminName}`);
      
      // Remove from clients
      this.clients.delete(session.adminId);
      this.adminSessions.delete(ws);
      
      // Notify other admins
      this.broadcastToAdmins({
        type: 'admin_offline',
        adminId: session.adminId,
        adminName: session.adminName
      });
    }
  }
  
  broadcastToUsers(message, excludeUserId = null) {
    for (const [userId, clientWs] of this.clients) {
      if (userId !== excludeUserId && clientWs.readyState === WebSocket.OPEN) {
        this.sendMessage(clientWs, message);
      }
    }
  }
  
  broadcastToAdmins(message, excludeAdminId = null) {
    for (const [adminId, clientWs] of this.clients) {
      if (adminId !== excludeAdminId && clientWs.readyState === WebSocket.OPEN) {
        this.sendMessage(clientWs, message);
      }
    }
  }
  
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      message: error
    });
  }
  
  getUserRole(isAdmin, level) {
    if (isAdmin) {
      const adminRoleMap = {
        9: 'CEO',
        8: 'Senior Manager',
        7: 'System Administrator',
        6: 'Support Administrator',
        5: 'Manager',
        4: 'Supervisor',
        3: 'Lead',
        2: 'Senior',
        1: 'Junior',
        0: 'Temporary Worker'
      };
      return adminRoleMap[level] || 'Admin';
    } else {
      const workerRoleMap = {
        5: 'Senior Worker',
        4: 'Lead Worker',
        3: 'Experienced Worker',
        2: 'Skilled Worker',
        1: 'Worker',
        0: 'New Worker'
      };
      return workerRoleMap[level] || 'Worker';
    }
  }
  
  getAdminRole(level) {
    const roleMap = {
      9: 'CEO',
      8: 'Senior Manager',
      7: 'System Administrator',
      6: 'Support Administrator',
      5: 'Manager',
      4: 'Supervisor',
      3: 'Lead',
      2: 'Senior',
      1: 'Junior',
      0: 'Temporary Worker'
    };
    return roleMap[level] || 'Admin';
  }
  
  async handleJoinVideoMeeting(ws, message) {
    const { userId, userName, meetingId } = message;
    
    // Store user session
    this.adminSessions.set(ws, {
      userId,
      userName,
      role: 'Video Participant',
      meetingId
    });
    
    // Add to meeting
    if (!this.videoMeetings.has(meetingId)) {
      this.videoMeetings.set(meetingId, new Set());
    }
    this.videoMeetings.get(meetingId).add(ws);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'video_meeting_joined',
      meetingId,
      userId,
      userName
    }));
    
    // Notify other participants
    this.broadcastToMeeting(meetingId, {
      type: 'user_joined',
      userId,
      userName
    }, ws);
    
    // Send current participants
    const participants = Array.from(this.videoMeetings.get(meetingId))
      .filter(client => client !== ws)
      .map(client => {
        const session = this.adminSessions.get(client);
        return {
          userId: session.userId,
          userName: session.userName
        };
      });
    
    ws.send(JSON.stringify({
      type: 'video_meeting_users',
      users: participants
    }));
    
    console.log(`✅ User ${userName} joined video meeting ${meetingId}`);
  }
  
  async handleLeaveVideoMeeting(ws, message) {
    const { userId, meetingId } = message;
    const session = this.adminSessions.get(ws);
    
    if (session && this.videoMeetings.has(meetingId)) {
      this.videoMeetings.get(meetingId).delete(ws);
      
      // Notify other participants
      this.broadcastToMeeting(meetingId, {
        type: 'user_left',
        userId
      }, ws);
      
      console.log(`✅ User ${session.userName} left video meeting ${meetingId}`);
    }
  }
  
  async handleSendChatMessage(ws, message) {
    const { userId, userName, message: chatMessage, meetingId } = message;
    
    // Broadcast to all participants in the meeting
    this.broadcastToMeeting(meetingId, {
      type: 'chat_message',
      senderId: userId,
      senderName: userName,
      message: chatMessage
    });
    
    console.log(`💬 Chat message from ${userName} in meeting ${meetingId}: ${chatMessage}`);
  }
  
  broadcastToMeeting(meetingId, message, excludeWs = null) {
    if (this.videoMeetings.has(meetingId)) {
      this.videoMeetings.get(meetingId).forEach(ws => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }
}

// Create admin messages table if it doesn't exist
async function createMessagesTable() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'Caroline',
      database: 'uai'
    });
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_admin_id VARCHAR(50) NOT NULL,
        to_admin_id VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        INDEX idx_from_admin (from_admin_id),
        INDEX idx_to_admin (to_admin_id),
        INDEX idx_created_at (created_at),
        INDEX idx_status (status)
      )
    `);
    
    console.log('✅ Admin messages table ready');
    await connection.end();
  } catch (error) {
    console.error('❌ Error creating messages table:', error);
  }
}

// Start the server
createMessagesTable().then(() => {
  new AdminMessagingServer();
});
