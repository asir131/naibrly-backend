const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.isInitialized = false;
    this.serviceName = "None";

    this.initialize();
  }

  initialize() {
    // Use Gmail/Nodemailer as primary
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.initializeNodemailer();
    } else {
      console.warn("⚠️ Gmail credentials not found. Email service disabled.");
      console.warn(
        "   Please set EMAIL_USER and EMAIL_PASS in environment variables"
      );
    }
  }

  initializeNodemailer() {
    try {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Optimized for cloud platforms
        connectionTimeout: 30000,
        socketTimeout: 30000,
        greetingTimeout: 30000,
        secureConnection: false,
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error(
            "❌ Gmail/Nodemailer connection failed:",
            error.message
          );
          console.log("💡 Make sure:");
          console.log(
            "   - EMAIL_PASS is a Gmail App Password (not your regular password)"
          );
          console.log("   - 2FA is enabled on your Gmail account");
          console.log("   - App Password is generated correctly");
        } else {
          this.isInitialized = true;
          this.serviceName = "Gmail/Nodemailer";
          console.log(
            "✅ Gmail/Nodemailer email service initialized successfully"
          );
          console.log(
            `📧 From: ${process.env.EMAIL_FROM || process.env.EMAIL_USER}`
          );
        }
      });
    } catch (error) {
      console.error(
        "❌ Gmail/Nodemailer initialization failed:",
        error.message
      );
    }
  }

  async sendOTPEmail(email, otp, userName) {
    if (!this.isInitialized) {
      console.warn("📧 Email service not initialized. OTP:", otp);
      return {
        success: true,
        warning: "Email service not configured - OTP returned in response",
        otp: otp,
      };
    }

    const emailTemplate = this.getOTPEmailTemplate(otp, userName);

    try {
      return await this.sendEmail(
        email,
        "Password Reset OTP - Naibrly",
        emailTemplate
      );
    } catch (error) {
      console.error("❌ Error sending OTP email:", error.message);

      // Return OTP in response as fallback
      return {
        success: true,
        warning: `Email failed but OTP returned: ${error.message}`,
        otp: otp,
      };
    }
  }

  async sendPasswordResetSuccessEmail(email, userName) {
    if (!this.isInitialized) {
      console.warn("📧 Email service not initialized. Skipping success email.");
      return { success: true };
    }

    const emailTemplate = this.getSuccessEmailTemplate(userName);

    try {
      return await this.sendEmail(
        email,
        "Password Reset Successful - Naibrly",
        emailTemplate
      );
    } catch (error) {
      console.error("❌ Error sending success email:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendEmail(email, subject, html) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html,
      text: this.htmlToText(html),
    };

    console.log(`📧 Sending email to: ${email}`);
    console.log(`📧 Using service: ${this.serviceName}`);

    const result = await this.transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully");
    console.log(`📨 Message ID: ${result.messageId}`);

    return {
      success: true,
      messageId: result.messageId,
      service: this.serviceName,
    };
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  getOTPEmailTemplate(otp, userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  background-color: #f7fafc; 
                  margin: 0; 
                  padding: 0; 
              }
              .container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  background: white; 
                  padding: 40px; 
                  border-radius: 12px; 
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                  border: 1px solid #e2e8f0;
              }
              .header { 
                  text-align: center; 
                  color: #1a202c; 
                  margin-bottom: 30px;
              }
              .logo { 
                  font-size: 24px; 
                  font-weight: bold; 
                  color: #2563eb; 
                  margin-bottom: 10px;
              }
              .otp-code { 
                  font-size: 42px; 
                  font-weight: bold; 
                  text-align: center; 
                  color: #2563eb; 
                  margin: 30px 0; 
                  padding: 20px; 
                  background: #f8fafc; 
                  border-radius: 8px; 
                  letter-spacing: 8px; 
                  border: 2px dashed #cbd5e0;
              }
              .info { 
                  color: #4a5568; 
                  line-height: 1.6; 
                  font-size: 16px;
                  margin-bottom: 20px;
              }
              .warning { 
                  background: #fffaf0; 
                  padding: 15px; 
                  border-radius: 6px; 
                  border-left: 4px solid #dd6b20; 
                  margin: 20px 0;
              }
              .footer { 
                  margin-top: 40px; 
                  text-align: center; 
                  color: #718096; 
                  font-size: 14px; 
                  border-top: 1px solid #e2e8f0;
                  padding-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">🔐 Naibrly</div>
                  <h2>Password Reset Request</h2>
              </div>
              
              <p class="info">Hello <strong>${userName}</strong>,</p>
              
              <p class="info">You requested to reset your password for your Naibrly account. Use the following verification code to proceed:</p>
              
              <div class="otp-code">${otp}</div>
              
              <p class="info">This OTP is valid for <strong>${
                process.env.OTP_EXPIRY_MINUTES || 10
              } minutes</strong>.</p>
              
              <div class="warning">
                  <strong>⚠️ Security Tip:</strong> Never share this code with anyone. Naibrly will never ask for your password or verification code.
              </div>
              
              <p class="info">If you didn't request this password reset, please ignore this email or contact our support team if you're concerned about your account's security.</p>
              
              <div class="footer">
                  <p><strong>Naibrly Team</strong></p>
                  <p>This is an automated message, please do not reply directly to this email.</p>
                  <p>If you need help, contact our support team.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  getSuccessEmailTemplate(userName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  background-color: #f0f9ff; 
                  margin: 0; 
                  padding: 0; 
              }
              .container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  background: white; 
                  padding: 40px; 
                  border-radius: 12px; 
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                  border: 1px solid #bae6fd;
              }
              .header { 
                  text-align: center; 
                  color: #0c4a6e; 
                  margin-bottom: 30px;
              }
              .logo { 
                  font-size: 24px; 
                  font-weight: bold; 
                  color: #0369a1; 
                  margin-bottom: 10px;
              }
              .success-icon { 
                  font-size: 64px; 
                  text-align: center; 
                  margin: 30px 0; 
                  color: #059669;
              }
              .info { 
                  color: #374151; 
                  line-height: 1.6; 
                  font-size: 16px;
                  margin-bottom: 20px;
              }
              .security-note { 
                  background: #f0fdf4; 
                  padding: 15px; 
                  border-radius: 6px; 
                  border-left: 4px solid #10b981; 
                  margin: 20px 0;
              }
              .footer { 
                  margin-top: 40px; 
                  text-align: center; 
                  color: #6b7280; 
                  font-size: 14px; 
                  border-top: 1px solid #e5e7eb;
                  padding-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">✅ Naibrly</div>
                  <h2>Password Reset Successful</h2>
              </div>
              
              <div class="success-icon">🎉</div>
              
              <p class="info">Hello <strong>${userName}</strong>,</p>
              
              <p class="info">Your Naibrly account password has been successfully reset.</p>
              
              <p class="info">You can now log in to your account using your new password.</p>
              
              <div class="security-note">
                  <strong>🔒 Security Notice:</strong> If you did not make this change, please contact our support team immediately to secure your account.
              </div>
              
              <p class="info">Thank you for helping us keep your account secure.</p>
              
              <div class="footer">
                  <p><strong>Naibrly Security Team</strong></p>
                  <p>This is an automated message, please do not reply directly to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}

// Create singleton instance
const emailService = new EmailService();

// Export functions
const sendOTPEmail = async (email, otp, userName) => {
  return await emailService.sendOTPEmail(email, otp, userName);
};

const sendPasswordResetSuccessEmail = async (email, userName) => {
  return await emailService.sendPasswordResetSuccessEmail(email, userName);
};

const testEmailConfig = async () => {
  if (!emailService.isInitialized) {
    return {
      success: false,
      error: "Email service not initialized",
      service: emailService.serviceName,
    };
  }

  try {
    // Test by sending to ourselves
    const testResult = await emailService.sendEmail(
      process.env.EMAIL_USER,
      "Naibrly - Email Service Test",
      "<h1>Email Service Test</h1><p>If you receive this, your email service is working correctly!</p>"
    );

    return {
      success: true,
      service: emailService.serviceName,
      testResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      service: emailService.serviceName,
    };
  }
};

module.exports = {
  emailService,
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
  testEmailConfig,
};
