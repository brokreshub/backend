const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Group CRUD operations
router.post('/', groupController.createGroup);
router.get('/', groupController.getAllGroups);
router.get('/:id', groupController.getGroupById);
router.get('/:id/messages', groupController.getGroupMessages);
router.post('/:id/messages', groupController.sendMessage);
router.get('/:id/members', groupController.getGroupMembers);
router.post('/:id/members', groupController.addMemberToGroup);
router.delete('/:id/members/:memberId', groupController.removeMemberFromGroup);
router.get('/search/:phone', groupController.searchUserbyPhone);
router.get('/:id/properties', groupController.getGroupProperties);
router.get('/:id/members/:memberId', groupController.getGroupMember);
router.post('/:id/messages/image', groupController.sendImageMessage);

module.exports = router; 