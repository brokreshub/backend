const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const unirest = require("unirest");
const { faker } = require('@faker-js/faker');

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

// Helper function for sending OTP
const sendOTP = async (phone, message) => {
    const req = unirest("GET", "https://www.fast2sms.com/dev/bulkV2");
    
    req.query({
        "authorization": FAST2SMS_API_KEY,
        "message": message,
        "route": "q", // or "dlt" if you're using DLT
        "numbers": phone,
    });

    req.headers({
        "cache-control": "no-cache"
    });

    return new Promise((resolve, reject) => {
        req.end(function (res) {
            if (res.error) reject(res.error);
            resolve(res.body);
        });
    });
};

exports.signup = async (req, res) => {
    try {
        console.log(req.body);
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Generate a temporary token for OTP verification
        const tempToken = jwt.sign(
            { email, otp },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        
        // Store OTP with email temporarily
        otpStore.set(email, {
            otp,
            userData: { name, email, password, phone }
        });

        // Send OTP via Fast2SMS
        try {
            const smsResponse = await sendOTP(
                phone,
                `Your OTP for registration is: ${otp}`
            );

            if (!smsResponse.return) {
                return res.status(500).json({ 
                    message: 'Failed to send OTP',
                    error: smsResponse.message
                });
            }

            res.status(200).json({ 
                message: 'OTP sent successfully',
                email,
                status: 200,
                token: tempToken,  // Include the temporary token
                requestId: smsResponse.request_id
            });

        } catch (smsError) {
            console.error('SMS sending error:', smsError);
            return res.status(500).json({ 
                message: 'Failed to send OTP',
                error: smsError.message
            });
        }

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const storedData = otpStore.get(email);

        if (!storedData || storedData.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const { userData } = storedData;

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                name: userData.name,
                email: userData.email,
                password: hashedPassword,
                phone: userData.phone
            }
        });
console.log("newUser: ",newUser);
        // Clear OTP from store
        otpStore.delete(email);

        // Generate JWT
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '90d' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > new Date()) {
            return res.status(423).json({ 
                message: 'Account is locked. Please try again later.' 
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            // Increment login attempts
            const loginAttempts = user.loginAttempts + 1;
            const updates = { loginAttempts };

            // Lock account if too many attempts
            if (loginAttempts >= 5) {
                updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await prisma.user.update({
                where: { id: user.id },
                data: updates
            });

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Reset login attempts on successful login
        await prisma.user.update({
            where: { id: user.id },
            data: {
                loginAttempts: 0,
                lockUntil: null,
                lastLogin: new Date()
            }
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '90d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP and set expiry
        const resetToken = otp;
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.user.update({
            where: { email },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires
            }
        });

        // Send OTP via Fast2SMS
        try {
            const smsResponse = await sendOTP(
                user.phone,
                `Your password reset OTP is: ${otp}`
            );

            if (!smsResponse.return) {
                return res.status(500).json({ 
                    message: 'Failed to send OTP',
                    error: smsResponse.message
                });
            }

            res.json({ 
                message: 'Password reset OTP sent successfully',
                requestId: smsResponse.request_id
            });

        } catch (smsError) {
            console.error('SMS sending error:', smsError);
            return res.status(500).json({ 
                message: 'Failed to send OTP',
                error: smsError.message
            });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || 
            user.passwordResetToken !== otp || 
            user.passwordResetExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null
            }
        });

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user profile from the database using email
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include:{
                properties:{
                    include:{
                        imageUrls:true,
                        amenities:true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            user

        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming userId is set in the request by authentication middleware
        const { name, phone } = req.body;

        // Update user profile in the database
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                phone
            }
        });

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.createTestUser = async (req, res) => {
    try {
        // Generate random user details
        const randomName = faker.person.fullName();
        const randomEmail = faker.internet.email();

        const phone = Math.floor(Math.random() * 9000000000).toString().padStart(10, '9');
        
        const password = 'test123'; // Default password for all test users

        // const randomName = "admin"
        // const randomEmail = "Brokerxhub@admin.com"
        // const phone = "9876543210"
        // const password = "admin123"

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                name: randomName,
                email: randomEmail,
                password: hashedPassword,
                phone: phone
            }
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '90d' }
        );

        res.status(201).json({
            message: 'Test user created successfully',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone
            },
            credentials: {
                email: randomEmail,
                password: 'test123'
            }
        });

    } catch (error) {
        console.error('Create test user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getAllUsers = async (req, res) => {
    try{
        const users = await prisma.user.findMany(
            {
                include:{
                    properties:{
                        include:{
                            imageUrls:true,
                            amenities:true
                        }
                    },
                }

            }
        );
        res.json({users});
    }catch(error){
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if the requesting user is an admin
        const requestingUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (requestingUser.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete users' });
        }

        // Delete the user
        await prisma.user.delete({
            where: { id }
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
