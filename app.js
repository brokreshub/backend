const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);  // Create server with app
const initializeSocket = require('./socketServer');

const userRoutes = require('./routes/userRoute');
const adminRoutes = require('./routes/adminRoute');

// Middleware
app.use(cors({
  origin: '*',  // During development only! Be more restrictive in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/authroute'));
app.use('/api/properties', require('./routes/propertyRoute'));
app.use('/api/subscriptions', require('./routes/subscriptionRoute'));
app.use('/api/notifications', require('./routes/notificationRoute'));
app.use('/api/groups', require('./routes/groupRoute'));
app.use('/api/users', userRoutes);
app.use('/api/admin', require('./routes/adminRoute'));

// Add a test route to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Initialize socket.io
const io = initializeSocket(server);

// Error handling
// app.use(errorMiddleware);

// Export both app and server
module.exports = { app, server };
