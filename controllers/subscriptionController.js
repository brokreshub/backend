const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { Cashfree } = require("cashfree-pg");

const SUBSCRIPTION_PLANS = {
    premium: {
        price: 299,
        maxProperties: 100,
        features: {
            propertyListings: 100,
            imageUploads: 50,
            support: 'email'
        }
    }
};

// Add these constants at the top
const CASHFREE_API_KEY = process.env.CASHFREE_API_KEY;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

// Setup Cashfree configuration
Cashfree.XClientId = process.env.CASHFREE_API_KEY;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = process.env.NODE_ENV === 'production' 
    ? Cashfree.Environment.PRODUCTION 
    : Cashfree.Environment.SANDBOX;

exports.getSubscriptionPlans = async (req, res) => {
    res.json(SUBSCRIPTION_PLANS);
};

exports.getMySubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                paymentHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        if (!subscription) {
            return res.status(404).json({ message: 'No active subscription found' });
        }

        res.json(subscription);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.subscribe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { plan, paymentMethod } = req.body;

        if (!SUBSCRIPTION_PLANS[plan]) {
            return res.status(400).json({ message: 'Invalid subscription plan' });
        }

        const planDetails = SUBSCRIPTION_PLANS[plan];

        // Check for existing subscription
        const existingSubscription = await prisma.subscription.findUnique({
            where: { userId }
        });

        if (existingSubscription && existingSubscription.status === 'active') {
            return res.status(400).json({ 
                message: 'Active subscription already exists' 
            });
        }

        // Create subscription
        const subscription = await prisma.subscription.create({
            data: {
                userId,
                plan,
                price: planDetails.price,
                maxProperties: planDetails.maxProperties,
                features: planDetails.features,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                status: 'active',
                paymentHistory: {
                    create: {
                        amount: planDetails.price,
                        status: 'success',
                        paymentMethod,
                        transactionId: `txn_${Date.now()}`
                    }
                }
            },
            include: {
                paymentHistory: true
            }
        });

        res.status(201).json(subscription);
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const subscription = await prisma.subscription.findUnique({
            where: { userId }
        });

        if (!subscription || subscription.status !== 'active') {
            return res.status(404).json({ message: 'No active subscription found' });
        }

        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'cancelled',
                autoRenew: false
            }
        });

        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.renewSubscription = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethod } = req.body;

        const subscription = await prisma.subscription.findUnique({
            where: { userId }
        });

        if (!subscription) {
            return res.status(404).json({ message: 'No subscription found' });
        }

        const planDetails = SUBSCRIPTION_PLANS[subscription.plan];

        // Update subscription
        const updatedSubscription = await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'active',
                autoRenew: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                paymentHistory: {
                    create: {
                        amount: planDetails.price,
                        status: 'success',
                        paymentMethod,
                        transactionId: `txn_${Date.now()}`
                    }
                }
            },
            include: {
                paymentHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        res.json(updatedSubscription);
    } catch (error) {
        console.error('Renew subscription error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const subscription = await prisma.subscription.findUnique({
            where: { userId },
            select: { id: true }
        });

        if (!subscription) {
            return res.status(404).json({ message: 'No subscription found' });
        }

        const payments = await prisma.payment.findMany({
            where: { subscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit)
        });

        const total = await prisma.payment.count({
            where: { subscriptionId: subscription.id }
        });

        res.json({
            payments,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createPaymentOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { plan } = req.body;

        if (!SUBSCRIPTION_PLANS[plan]) {
            return res.status(400).json({ message: 'Invalid subscription plan' });
        }

        const planDetails = SUBSCRIPTION_PLANS[plan];
        const orderId = `order_${Date.now()}_${userId}`;

        // Updated order request structure
        const orderRequest = {
            order_id: orderId,
            order_amount: planDetails.price,
            order_currency: "INR",
            customer_details: {
                customer_id: userId.toString(),
                customer_name: req.user.name || "",
                customer_email: req.user.email,
                customer_phone: req.user.phone || ""
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/subscription/callback?order_id={order_id}`
            },
            order_note: "Premium Subscription",
            order_tags: {
                type: "subscription"
            }
        };

        // Create order using Cashfree API
        const response = await axios.post(
            `${CASHFREE_BASE_URL}/orders`,
            orderRequest,
            {
                headers: {
                    'x-api-version': '2022-09-01',
                    'x-client-id': CASHFREE_API_KEY,
                    'x-client-secret': CASHFREE_SECRET_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("Cashfree Response:", response.data);

        res.json({
            orderId: response.data.order_id,
            paymentSessionId: response.data.payment_session_id,
            planDetails,
            payments: response.data.payments,
            settlements: response.data.settlements,
        });
    } catch (error) {
        console.error('Create payment order error:', error.response?.data || error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { order_id, payment_id } = req.body;

        const response = await axios.get(
            `${CASHFREE_BASE_URL}/orders/${order_id}/payments`,
            {
                headers: {
                    'x-api-version': '2022-09-01',
                    'x-client-id': CASHFREE_API_KEY,
                    'x-client-secret': CASHFREE_SECRET_KEY
                }
            }
        );

        if (response.data.payment_status === 'SUCCESS') {
            // Process the subscription
            // Extract userId from order_id
            const userId = parseInt(order_id.split('_')[2]);
            
            // Continue with subscription creation
            // ... (existing subscribe logic)
        }

        res.json(response.data);
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Add other subscription controller methods... 