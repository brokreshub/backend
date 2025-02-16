const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Group Management Routes
router.get('/groups', adminController.getAllGroups);
router.delete('/groups/:id', adminController.deleteGroup);

// Property Management Routes
router.get('/properties', adminController.getAllProperties);
router.get('/properties/:id', adminController.getPropertyById);
router.delete('/properties/:id', adminController.deleteProperty);
router.patch('/properties/:id/status', adminController.updatePropertyStatus);

// Reports Routes
router.get('/reports/activity-logs', adminController.getActivityLogs);
router.get('/reports/admin-actions', adminController.getAdminActions);
router.get('/reports/export/:type', adminController.exportReport);

// Dashboard Routes
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/recent-properties', adminController.getRecentProperties);

module.exports = router; 