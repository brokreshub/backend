const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {

    socket.on('joinGroup', ({ groupId, userId }) => {
      socket.join(`group_${groupId}`);
    });

    socket.on('leaveGroup', (groupId) => {
      socket.leave(`group-${groupId}`);
    });

    socket.on('sendMessage', ({ groupId, message, userId }) => {
      // Broadcast to all clients in the group except sender
      socket.to(`group_${groupId}`).emit('newMessage', message);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
}

module.exports = initializeSocket; 