const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createProperty = async (req, res) => {
    try {
        console.log(req.body);
        const {
            user,
            title,
            description,
            location,
            price,
            type,
            area,
            furnishing,
            propertyType,
            bedrooms,
            bathrooms,
            parking,
            amenities,
            imageUrls
        } = req.body;

        console.log(user);
        // First verify if the user exists
        const userExists = await prisma.user.findUnique({
            where: { id: user}
        });

        if (!userExists) {
            return res.status(404).json({ 
                message: 'User not found. Cannot create property without a valid user.' 
            });
        }

        const property = await prisma.property.create({
            data: {
                title,
                description,
                location,
                price,
                type,
                area,
                furnishing,
                propertyType,
                bedrooms,
                bathrooms,
                parking,
                postedById: user,
                imageUrls: {
                    create: imageUrls.map(url => ({
                        url,
                        isMain: false
                    }))
                },
                amenities: {
                    connectOrCreate: amenities.map(amenity => ({
                        where: { name: amenity },
                        create: { name: amenity }
                    }))
                }
            },
            include: {
                amenities: true,
                imageUrls: true,
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

        res.status(201).json(property);
    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message,
            details: 'Failed to create property. Please ensure all required fields are provided correctly.'
        });
    }
};

exports.getAllProperties = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        
        const { page = 1, limit = 10, groupId, memberId } = req.query;
        const skip = (page - 1) * limit;

        const where = {
            status: 'active',
            ...(groupId && { postedBy: { groupId: Number(groupId) } }),
            ...(memberId && { postedById: Number(memberId) })
        };

        const properties = await prisma.property.findMany({
            where,
            include: {
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                imageUrls: true
            },
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        });

        const total = await prisma.property.count({ where });

        res.json({
            properties,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPropertyById = async (req, res) => {
    try {
        const { id } = req.params;

        const property = await prisma.property.findUnique({
            where: { id: Number(id) },
            include: {
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                imageUrls: true
            }
        });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }
        res.json(property);
    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getMyProperties = async (req, res) => {
    try {
        const userId = req.body.id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const properties = await prisma.property.findMany({
            where: { 
                postedById: userId,
                status: { not: 'deleted' }
            },
            include: {
                amenities: true,
                imageUrls: true
            },
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        });

        const total = await prisma.property.count({
            where: { 
                postedById: userId,
                status: { not: 'deleted' }
            }
        });

        res.json({
            properties,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Get my properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateProperty = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            location,
            price,
            type,
            propertyType,
            area,
            bedrooms,
            bathrooms,
            furnishing,
            parking,
            amenities,
            imageUrls,
            userId
        } = req.body;

        // Check if property exists and belongs to user
        const property = await prisma.property.findFirst({
            where: {
                id: Number(id),
                postedById: userId
            }
        });

        if (!property) {
            return res.status(404).json({ 
                message: 'Property not found or unauthorized' 
            });
        }

        // Update property
        const updatedProperty = await prisma.property.update({
            where: { id: Number(id) },
            data: {
                title,
                description,
                location,
                price,
                type,
                propertyType,
                area,
                bedrooms,
                bathrooms,
                furnishing,
                parking,
                amenities: {
                    disconnect: { name: undefined }, // Remove all existing connections
                    connectOrCreate: amenities.map(amenity => ({
                        where: { name: amenity },
                        create: { name: amenity }
                    }))
                },
                imageUrls: {
                    deleteMany: {}, // Delete existing images
                    create: imageUrls.map(url => ({
                        url,
                        isMain: false
                    }))
                }
            },
            include: {
                amenities: true,
                imageUrls: true,
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

        res.json(updatedProperty);
    } catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.deleteProperty = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if property exists
        const property = await prisma.property.findFirst({
            where: {
                id: Number(id),
            }
        });

        if (!property) {
            return res.status(404).json({ 
                message: 'Property not found or unauthorized' 
            });
        }

        // First delete all related images
        await prisma.image.deleteMany({
            where: {
                propertyId: Number(id)
            }
        });

        // Then delete the property
        await prisma.property.delete({
            where: { id: Number(id) }
        });

        res.status(200).json({ message: 'Property deleted successfully' });
    } catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.searchProperties = async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const properties = await prisma.property.findMany({
            where: {
                status: 'active',
                OR: [
                    { title: { contains: query } },
                    { description: { contains: query } },
                    { location: { contains: query } }
                ]
            },
            include: {
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                }
            },
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        });

        const total = await prisma.property.count({
            where: {
                status: 'active',
                OR: [
                    { title: { contains: query } },
                    { description: { contains: query } },
                    { location: { contains: query } }
                ]
            }
        });

        res.json({
            properties,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Search properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.filterProperties = async (req, res) => {
    try {
        const { 
            minPrice, 
            maxPrice, 
            location, 
            type,
            propertyType,
            furnishing,
            bedrooms,
            page = 1, 
            limit = 10 
        } = req.query;
        
        const skip = (page - 1) * limit;

        const where = {
            status: 'active',
            ...(minPrice && { price: { gte: Number(minPrice) } }),
            ...(maxPrice && { price: { lte: Number(maxPrice) } }),
            ...(location && { location: { contains: location } }),
            ...(type && { type }),
            ...(propertyType && { propertyType }),
            ...(furnishing && { furnishing }),
            ...(bedrooms && { bedrooms: Number(bedrooms) })
        };

        const properties = await prisma.property.findMany({
            where,
            include: {
                amenities: true,
                postedBy: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                imageUrls: true
            },
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        });

        const total = await prisma.property.count({ where });

        res.json({
            properties,
            total,
            pages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        console.error('Filter properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPropertyViews = async (req, res) => {
    try {
        const { id } = req.params;
        const property = await prisma.property.findUnique({
            where: { id: Number(id) },
            select: { views: true }
        });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        res.json({ views: property.views });
    } catch (error) {
        console.error('Get property views error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.incrementPropertyView = async (req, res) => {
    try {
        const { id } = req.params;
        const property = await prisma.property.update({
            where: { id: Number(id) },
            data: { views: { increment: 1 } },
            select: { views: true }
        });

        res.json({ views: property.views });
    } catch (error) {
        console.error('Increment property view error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createFakeProperty = async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        // Fake property data
        const propertyTypes = ['Apartment', 'House', 'Villa', 'Office'];
        const furnishingTypes = ['Furnished', 'Unfurnished', 'Semi-Furnished'];
        const locations = ['Dubai Marina', 'Downtown Dubai', 'Palm Jumeirah', 'JBR', 'Business Bay'];
        const amenities = ['Swimming Pool', 'Gym', 'Parking', 'Security', 'Balcony', 'Beach Access'];

        // Get random images from Unsplash
        const unsplashResponse = await fetch(
            'https://api.unsplash.com/photos/random?query=luxury+apartment+interior&count=4&client_id=Jqk-BxQ4PzZgOrx_bko5EUtEAwhRUa53H7ntwuyxScU'
        );
        
        if (!unsplashResponse.ok) {
            throw new Error('Failed to fetch images from Unsplash');
        }

        const images = await unsplashResponse.json();
        const imageUrls = images.map(img => img.urls.regular);

        // Generate random property data
        const property = await prisma.property.create({
            data: {
                title: `Luxury ${propertyTypes[Math.floor(Math.random() * propertyTypes.length)]} for Rent`,
                description: 'Beautiful property with amazing views and modern amenities.',
                location: locations[Math.floor(Math.random() * locations.length)],
                price: Math.floor(Math.random() * (1000000 - 50000) + 50000),
                type: Math.random() > 0.5 ? 'Rent' : 'Sale',
                area: Math.floor(Math.random() * (5000 - 500) + 500),
                furnishing: furnishingTypes[Math.floor(Math.random() * furnishingTypes.length)],
                propertyType: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
                bedrooms: Math.floor(Math.random() * 5) + 1,
                bathrooms: Math.floor(Math.random() * 4) + 1,
                parking: Math.random() > 0.5,
                status: 'active',
                postedById: userId,
                imageUrls: {
                    create: imageUrls.map(url => ({
                        url,
                        isMain: false
                    }))
                },
                amenities: {
                    connectOrCreate: amenities
                        .slice(0, Math.floor(Math.random() * amenities.length) + 3)
                        .map(amenity => ({
                            where: { name: amenity },
                            create: { name: amenity }
                        }))
                }
            },
            include: {
                amenities: true,
                imageUrls: true,
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

        res.status(201).json(property);
    } catch (error) {
        console.error('Create fake property error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.getUserProperties = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const properties = await prisma.property.findMany({
            where: {
                postedById: Number(userId)
            },
            include: {
                imageUrls: true,
                amenities: true,
                postedBy: {
                    include: {
                        groups: true
                    }
                }
            }
        });

        res.json({ properties });
    } catch (error) {
        console.error('Get user properties error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}; 