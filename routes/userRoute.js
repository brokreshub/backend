const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/push-token', authMiddleware, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { expoPushToken: token }
        });

        res.json({ 
            success: true, 
            message: 'Push token updated successfully',
            user: {
                id: updatedUser.id,
                expoPushToken: updatedUser.expoPushToken
            }
        });
    } catch (error) {
        console.error('Update push token error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update push token',
            error: error.message 
        });
    }
});

module.exports = router; 