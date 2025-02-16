const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', authController.signup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/profile',authMiddleware, authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/create-test-user', authController.createTestUser);

router.get('/all-users', authController.getAllUsers);

router.delete('/delete-user/:id', authMiddleware, authController.deleteUser);

module.exports = router;
