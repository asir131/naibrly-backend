const crypto = require('crypto');
const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');
const Admin = require('../models/Admin');
const OTP = require('../models/OTP');
const { sendOTPEmail, sendPasswordResetSuccessEmail } = require('../utils/emailService');

// Generate random OTP
const generateOTP = (length = 5) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
};

// Send OTP for password reset
exports.sendResetOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists in any model
        let user = await Customer.findOne({ email });
        if (!user) user = await ServiceProvider.findOne({ email });
        if (!user) user = await Admin.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Generate OTP
        const otpCode = generateOTP(parseInt(process.env.OTP_LENGTH) || 5);
        const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

        // Delete any existing OTPs for this email
        await OTP.deleteMany({ email, purpose: 'password_reset' });

        // Create new OTP
        const otp = new OTP({
            email,
            otp: otpCode,
            purpose: 'password_reset',
            expiresAt
        });

        await otp.save();

        // Send OTP email
        const emailResult = await sendOTPEmail(
            email, 
            otpCode, 
            `${user.firstName} ${user.lastName}`
        );

        if (!emailResult.success) {
            await OTP.deleteOne({ _id: otp._id });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'OTP sent successfully to your email',
            data: {
                email: email,
                expiresIn: process.env.OTP_EXPIRY_MINUTES || 10
            }
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Find the latest OTP for this email
        const otpRecord = await OTP.findOne({ 
            email, 
            purpose: 'password_reset' 
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found or expired'
            });
        }

        // Check if OTP is valid
        if (otpRecord.isUsed || otpRecord.expiresAt < new Date() || otpRecord.attempts >= 5) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired or has been used'
            });
        }

        // Verify OTP code
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            
            const attemptsLeft = 5 - otpRecord.attempts;
            if (attemptsLeft <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Too many failed attempts. Please request a new OTP.'
                });
            }

            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${attemptsLeft} attempts left.`
            });
        }

        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        // Generate reset token (valid for 15 minutes)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

        // Store reset token in user record
        let user = await Customer.findOne({ email });
        if (!user) user = await ServiceProvider.findOne({ email });
        if (!user) user = await Admin.findOne({ email });

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                resetToken,
                email
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
};

// Reset password with new password
exports.resetPassword = async (req, res) => {
    try {
        const { resetToken, email, newPassword, confirmPassword } = req.body;

        if (!resetToken || !email || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find user by email and reset token
        let user = await Customer.findOne({ 
            email, 
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: new Date() }
        });
        
        if (!user) {
            user = await ServiceProvider.findOne({ 
                email, 
                resetPasswordToken: resetToken,
                resetPasswordExpires: { $gt: new Date() }
            });
        }
        
        if (!user) {
            user = await Admin.findOne({ 
                email, 
                resetPasswordToken: resetToken,
                resetPasswordExpires: { $gt: new Date() }
            });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send success email
        await sendPasswordResetSuccessEmail(
            email, 
            `${user.firstName} ${user.lastName}`
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
            error: error.message
        });
    }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists
        let user = await Customer.findOne({ email });
        if (!user) user = await ServiceProvider.findOne({ email });
        if (!user) user = await Admin.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address'
            });
        }

        // Check for recent OTP requests (prevent spam)
        const recentOTP = await OTP.findOne({
            email,
            purpose: 'password_reset',
            createdAt: { $gte: new Date(Date.now() - 60000) } // 1 minute ago
        });

        if (recentOTP) {
            return res.status(429).json({
                success: false,
                message: 'Please wait before requesting a new OTP'
            });
        }

        // Generate new OTP
        const otpCode = generateOTP(parseInt(process.env.OTP_LENGTH) || 5);
        const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

        await OTP.deleteMany({ email, purpose: 'password_reset' });

        const otp = new OTP({
            email,
            otp: otpCode,
            purpose: 'password_reset',
            expiresAt
        });

        await otp.save();

        const emailResult = await sendOTPEmail(
            email, 
            otpCode, 
            `${user.firstName} ${user.lastName}`
        );

        if (!emailResult.success) {
            await OTP.deleteOne({ _id: otp._id });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'New OTP sent successfully',
            data: {
                email: email,
                expiresIn: process.env.OTP_EXPIRY_MINUTES || 10
            }
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
};