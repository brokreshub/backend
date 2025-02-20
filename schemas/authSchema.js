const { z } = require('zod');

exports.signupSchema = z.object({
    body: z.object({
        name: z.string().min().max(50),
        email: z.string().email(),
        password: z.string().min(6).max(100),
        phone: z.string().regex(/^[0-9]{10}$/, 'Invalid phone number')
    })
});

exports.verifyOTPSchema = z.object({
    body: z.object({
        email: z.string().email(),
        otp: z.string().length(6)
    })
});

exports.loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string()
    })
});

exports.forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email()
    })
});

exports.resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email(),
        otp: z.string().length(6),
        newPassword: z.string().min(6).max(100)
    })
}); 