const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.isInitialized = true; // Always mark as initialized
    this.serviceName = process.env.RENDER
      ? "Console (Render)"
      : "Gmail (Local)";
    console.log(`📧 Email service initialized: ${this.serviceName}`);
  }

  async sendOTPEmail(email, otp, userName) {
    if (process.env.RENDER) {
      // On Render, just log the OTP and return it
      console.log(`📧 [RENDER] OTP for ${email}: ${otp} - User: ${userName}`);
      console.log(
        `📧 [RENDER] Password reset OTP ${otp} for user: ${userName} (${email})`
      );
      return {
        success: true,
        warning:
          "Email service not available on Render - OTP returned in response",
        otp: otp,
        service: "Console",
      };
    } else {
      // On local, use Gmail
      try {
        return await this.sendEmailGmail(
          email,
          "Password Reset OTP - Naibrly",
          this.getOTPEmailTemplate(otp, userName)
        );
      } catch (error) {
        console.error("❌ Error sending OTP email:", error.message);
        // Fallback: return OTP in response
        return {
          success: true,
          warning: `Email failed but OTP returned: ${error.message}`,
          otp: otp,
          service: "Gmail (Fallback)",
        };
      }
    }
  }

  async sendPasswordResetSuccessEmail(email, userName) {
    if (process.env.RENDER) {
      // On Render, just log the success
      console.log(
        `📧 [RENDER] Password reset successful for user: ${userName} (${email})`
      );
      return {
        success: true,
        service: "Console",
        message: "Password reset success logged (Render environment)",
      };
    } else {
      // On local, use Gmail
      try {
        return await this.sendEmailGmail(
          email,
          "Password Reset Successful - Naibrly",
          this.getSuccessEmailTemplate(userName)
        );
      } catch (error) {
        console.error("❌ Error sending success email:", error.message);
        return {
          success: false,
          error: error.message,
          service: "Gmail",
        };
      }
    }
  }

  async sendEmailGmail(email, subject, html) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html,
      text: this.htmlToText(html),
    };

    console.log(`📧 Sending email to: ${email}`);
    console.log(`📧 Using service: ${this.serviceName}`);

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent via Gmail");
    console.log(`📨 Message ID: ${result.messageId}`);

    return {
      success: true,
      messageId: result.messageId,
      service: "Gmail",
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
  if (process.env.RENDER) {
    return {
      success: true,
      service: "Console (Render)",
      message:
        "On Render - OTPs are logged to console and returned in API response",
      environment: "Render",
    };
  } else {
    try {
      const testResult = await emailService.sendOTPEmail(
        process.env.EMAIL_USER,
        "9999",
        "Test User"
      );

      return {
        success: true,
        service: "Gmail (Local)",
        testResult,
        environment: "Local",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        service: "Gmail (Local)",
        environment: "Local",
      };
    }
  }
};

const getEmailServiceStatus = () => {
  return {
    isInitialized: emailService.isInitialized,
    serviceName: emailService.serviceName,
    environment: process.env.RENDER ? "Render" : "Local",
    description: process.env.RENDER
      ? "OTPs are logged to console and returned in API response"
      : "Emails are sent via Gmail",
  };
};

module.exports = {
  emailService,
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
  testEmailConfig,
  getEmailServiceStatus,
};
