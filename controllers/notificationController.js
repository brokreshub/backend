const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit)
        });

        const total = await prisma.notification.count({
            where: { userId }
        });

        res.json({
            notifications,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const notification = await prisma.notification.update({
            where: {
                id: Number(id),
                userId
            },
            data: { read: true }
        });

        res.json(notification);
    } catch (error) {
        console.error('Mark notification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await prisma.notification.updateMany({
            where: {
                userId,
                read: false
            },
            data: { read: true }
        });

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const notification = await prisma.notification.findFirst({
            where: {
                id: Number(id),
                userId
            }
        });

        if (!notification) {
            return res.status(404).json({ 
                message: 'Notification not found or unauthorized' 
            });
        }

        await prisma.notification.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Helper function to create notifications (used by other controllers)
exports.createNotification = async (userId, message, type) => {
    try {
        await prisma.notification.create({
            data: {
                userId,
                message,
                type
            }
        });
    } catch (error) {
        console.error('Create notification error:', error);
    }
};

// Add other notification controller methods... 