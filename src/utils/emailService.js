const nodemailer = require('nodemailer');

// Create transporter - FIXED: createTransport instead of createTransporter
const createTransport = () => {
    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Verify transporter connection
const verifyTransporter = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        console.log('✅ Email server is ready to send messages');
        return true;
    } catch (error) {
        console.error('❌ Email transporter error:', error.message);
        return false;
    }
};

// Send OTP email
const sendOTPEmail = async (email, otp, userName) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP - Naibrly',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .header { text-align: center; color: #333; }
                        .otp-code { font-size: 32px; font-weight: bold; text-align: center; color: #2563eb; margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; letter-spacing: 5px; }
                        .info { color: #666; line-height: 1.6; }
                        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Request</h2>
                        </div>
                        <p class="info">Hello ${userName},</p>
                        <p class="info">You requested to reset your password. Use the following OTP code to proceed:</p>
                        <div class="otp-code">${otp}</div>
                        <p class="info">This OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
                        <p class="info">If you didn't request this, please ignore this email.</p>
                        <div class="footer">
                            <p>Naibrly Team</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ OTP email sent to:', email);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('❌ Error sending OTP email:', error.message);
        return { success: false, error: error.message };
    }
};

// Send password reset success email
const sendPasswordResetSuccessEmail = async (email, userName) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Successful - Naibrly',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .header { text-align: center; color: #059669; }
                        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
                        .info { color: #666; line-height: 1.6; }
                        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Successful</h2>
                        </div>
                        <div class="success-icon">✅</div>
                        <p class="info">Hello ${userName},</p>
                        <p class="info">Your password has been successfully reset.</p>
                        <p class="info">If you did not make this change, please contact our support team immediately.</p>
                        <div class="footer">
                            <p>Naibrly Team</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Password reset success email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending success email:', error.message);
        return { success: false, error: error.message };
    }
};

// Test email configuration on server start
const testEmailConfig = async () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email credentials not found. OTP emails will not work.');
        console.warn('   Please set EMAIL_USER and EMAIL_PASS in your .env file');
        return false;
    }
    
    return await verifyTransporter();
};

module.exports = { 
    sendOTPEmail, 
    sendPasswordResetSuccessEmail, 
    testEmailConfig 
};