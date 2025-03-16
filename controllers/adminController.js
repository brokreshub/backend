const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllGroups = async (req, res) => {
    try {
        // Verify admin role
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const groups = await prisma.group.findMany({
            include: {
                members: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true
                    }
                },
                messages: {
                    take: 5,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        const formattedGroups = groups.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description || '',
            memberCount: group.members.length,
            createdAt: group.createdAt,
            members: group.members,
            messages: group.messages,
            createdBy: group.createdBy
        }));

        res.json(formattedGroups);
    } catch (error) {
        console.error('Admin get groups error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        // Verify admin role
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { id } = req.params;
        
        // First delete all messages in the group
        await prisma.message.deleteMany({
            where: { groupId: Number(id) }
        });

        // Then delete the group
        await prisma.group.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Admin delete group error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Add other admin-specific group operations here 

// Property Management
exports.getAllProperties = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const properties = await prisma.property.findMany({
            include: {
                imageUrls: true,
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedProperties = properties.map(property => ({
            id: property.id,
            title: property.title,
            description: property.description,
            location: property.location,
            price: property.price,
            type: property.type,
            area: property.area,
            furnishing: property.furnishing,
            status: property.status,
            views: property.views,
            propertyType: property.propertyType,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            parking: property.parking,
            createdAt: property.createdAt,
            images: property.imageUrls,
            amenities: property.amenities,
            postedBy: property.postedBy
        }));

        res.json(formattedProperties);
    } catch (error) {
        console.error('Admin get properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPropertyById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { id } = req.params;
        const property = await prisma.property.findUnique({
            where: { id: Number(id) },
            include: {
                imageUrls: true,
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true
                    }
                }
            }
        });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.json(property);
    } catch (error) {
        console.error('Admin get property error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteProperty = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { id } = req.params;

        // First delete all images associated with the property
        await prisma.image.deleteMany({
            where: { propertyId: Number(id) }
        });

        // Then delete the property
        await prisma.property.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Property deleted successfully' });
    } catch (error) {
        console.error('Admin delete property error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updatePropertyStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['active', 'sold', 'rented', 'inactive'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const property = await prisma.property.update({
            where: { id: Number(id) },
            data: { status },
            include: {
                imageUrls: true,
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        res.json(property);
    } catch (error) {
        console.error('Admin update property status error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getActivityLogs = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const logs = await prisma.activityLog.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.json(logs);
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getAdminActions = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const actions = await prisma.activityLog.findMany({
            where: {
                userRole: 'admin'
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.json(actions);
    } catch (error) {
        console.error('Get admin actions error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.exportReport = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { type } = req.params;
        let data;

        if (type === 'activity') {
            data = await prisma.activityLog.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            });
        } else if (type === 'admin') {
            data = await prisma.activityLog.findMany({
                where: { userRole: 'admin' },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            });
        }

        // Convert data to CSV format
        const csvData = data.map(item => ({
            user: item.user.name,
            email: item.user.email,
            action: item.action,
            date: item.createdAt
        }));

        res.json(csvData);
    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const [
            userCount,
            groupCount,
            propertyCount,
            messageCount,
            notificationCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.group.count(),
            prisma.property.count(),
            prisma.message.count(),
            prisma.notification.count()
        ]);

        res.json({
            userCount,
            groupCount,
            propertyCount,
            messageCount,
            notificationCount
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getRecentProperties = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const recentProperties = await prisma.property.findMany({
            take: 5,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                postedBy: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                imageUrls: {
                    take: 1
                }
            }
        });

        res.json(recentProperties);
    } catch (error) {
        console.error('Get recent properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}; 