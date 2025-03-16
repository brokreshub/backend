const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/plans', subscriptionController.getSubscriptionPlans);
router.post('/subscribe', authMiddleware, subscriptionController.subscribe);
router.get('/my-subscription', authMiddleware, subscriptionController.getMySubscription);
router.put('/cancel', authMiddleware, subscriptionController.cancelSubscription);
router.put('/renew', authMiddleware, subscriptionController.renewSubscription);
router.get('/payment-history', authMiddleware, subscriptionController.getPaymentHistory);
router.post('/create-payment', authMiddleware, subscriptionController.createPaymentOrder);
router.post('/verify-payment', authMiddleware, subscriptionController.verifyPayment);

module.exports = router; 