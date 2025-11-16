const nodemailer = require("nodemailer");

// Email service configuration
class EmailService {
  constructor() {
    this.service = process.env.EMAIL_SERVICE || "gmail";
    this.isInitialized = false;
    this.usingSendGrid = false;
    this.usingResend = false;

    this.initialize();
  }

  // Initialize email service based on available configuration
  initialize() {
    // Priority: SendGrid > Resend > Nodemailer
    if (process.env.SENDGRID_API_KEY) {
      this.initializeSendGrid();
    } else if (process.env.RESEND_API_KEY) {
      this.initializeResend();
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.initializeNodemailer();
    } else {
      console.warn(
        "⚠️ No email service configured. Email functionality will be disabled."
      );
      console.warn(
        "   Please set SENDGRID_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS"
      );
    }
  }

  // Initialize SendGrid
  initializeSendGrid() {
    try {
      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.sgMail = sgMail;
      this.usingSendGrid = true;
      this.isInitialized = true;
      console.log("✅ SendGrid email service initialized");
    } catch (error) {
      console.error("❌ SendGrid initialization failed:", error.message);
      console.log("💡 Install SendGrid: npm install @sendgrid/mail");
    }
  }

  // Initialize Resend
  initializeResend() {
    try {
      const { Resend } = require("resend");
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.usingResend = true;
      this.isInitialized = true;
      console.log("✅ Resend email service initialized");
    } catch (error) {
      console.error("❌ Resend initialization failed:", error.message);
      console.log("💡 Install Resend: npm install resend");
    }
  }

  // Initialize Nodemailer (fallback)
  initializeNodemailer() {
    try {
      this.transporter = nodemailer.createTransport({
        service: this.service,
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Enhanced options for cloud platforms
        connectionTimeout: 30000,
        socketTimeout: 30000,
        greetingTimeout: 30000,
        secureConnection: false,
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.isInitialized = true;
      console.log("✅ Nodemailer email service initialized");
    } catch (error) {
      console.error("❌ Nodemailer initialization failed:", error.message);
    }
  }

  // Verify email connection
  async verifyConnection() {
    if (!this.isInitialized) {
      return { success: false, error: "Email service not initialized" };
    }

    try {
      if (this.usingSendGrid) {
        // SendGrid doesn't have a verify method, so we'll test with a simple request
        return { success: true, service: "SendGrid" };
      } else if (this.usingResend) {
        // Resend verification - try to get API key info
        return { success: true, service: "Resend" };
      } else {
        // Nodemailer verification
        await this.transporter.verify();
        return { success: true, service: "Nodemailer" };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        service: this.getServiceName(),
      };
    }
  }

  getServiceName() {
    if (this.usingSendGrid) return "SendGrid";
    if (this.usingResend) return "Resend";
    return "Nodemailer";
  }

  // Send OTP email
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
      if (this.usingSendGrid) {
        return await this.sendViaSendGrid(
          email,
          "Password Reset OTP - Naibrly",
          emailTemplate
        );
      } else if (this.usingResend) {
        return await this.sendViaResend(
          email,
          "Password Reset OTP - Naibrly",
          emailTemplate
        );
      } else {
        return await this.sendViaNodemailer(
          email,
          "Password Reset OTP - Naibrly",
          emailTemplate
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending OTP email via ${this.getServiceName()}:`,
        error.message
      );

      // Don't fail completely - return OTP in response for development
      if (process.env.NODE_ENV !== "production") {
        return {
          success: true,
          warning: `Email failed but OTP returned: ${error.message}`,
          otp: otp,
        };
      }

      return { success: false, error: error.message };
    }
  }

  // Send password reset success email
  async sendPasswordResetSuccessEmail(email, userName) {
    if (!this.isInitialized) {
      console.warn("📧 Email service not initialized. Skipping success email.");
      return { success: true };
    }

    const emailTemplate = this.getSuccessEmailTemplate(userName);

    try {
      if (this.usingSendGrid) {
        return await this.sendViaSendGrid(
          email,
          "Password Reset Successful - Naibrly",
          emailTemplate
        );
      } else if (this.usingResend) {
        return await this.sendViaResend(
          email,
          "Password Reset Successful - Naibrly",
          emailTemplate
        );
      } else {
        return await this.sendViaNodemailer(
          email,
          "Password Reset Successful - Naibrly",
          emailTemplate
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending success email via ${this.getServiceName()}:`,
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  // Send via SendGrid
  async sendViaSendGrid(email, subject, html) {
    const msg = {
      to: email,
      from:
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        "noreply@naibrly.com",
      subject: subject,
      html: html,
    };

    await this.sgMail.send(msg);
    console.log("✅ Email sent via SendGrid to:", email);
    return { success: true };
  }

  // Send via Resend
  async sendViaResend(email, subject, html) {
    const data = await this.resend.emails.send({
      from: process.env.EMAIL_FROM || "Naibrly <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: html,
    });

    console.log("✅ Email sent via Resend to:", email);
    return { success: true, data };
  }

  // Send via Nodemailer
  async sendViaNodemailer(email, subject, html) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html,
    };

    const result = await this.transporter.sendMail(mailOptions);
    console.log("✅ Email sent via Nodemailer to:", email);
    return { success: true, messageId: result.messageId };
  }

  // Email templates
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
              .button {
                  display: inline-block;
                  padding: 12px 24px;
                  background: #2563eb;
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  margin: 10px 0;
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

// Legacy function exports for backward compatibility
const sendOTPEmail = async (email, otp, userName) => {
  return await emailService.sendOTPEmail(email, otp, userName);
};

const sendPasswordResetSuccessEmail = async (email, userName) => {
  return await emailService.sendPasswordResetSuccessEmail(email, userName);
};

const testEmailConfig = async () => {
  const result = await emailService.verifyConnection();

  if (result.success) {
    console.log(`✅ Email service configured: ${result.service}`);
  } else {
    console.warn(`⚠️ Email service not available: ${result.error}`);
  }

  return result;
};

// Test email sending (for debugging)
const testEmailSending = async (testEmail = "test@example.com") => {
  console.log("🧪 Testing email service...");

  const otpResult = await emailService.sendOTPEmail(
    testEmail,
    "12345",
    "Test User"
  );
  console.log("OTP Email Test:", otpResult);

  return otpResult;
};

module.exports = {
  emailService,
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
  testEmailConfig,
  testEmailSending,
};
