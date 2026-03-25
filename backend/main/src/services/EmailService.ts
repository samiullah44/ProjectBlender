// backend/src/services/EmailService.ts
import { Resend } from 'resend';
import { env } from '../config/env';

export class EmailService {
    private resend: Resend;

    constructor() {
        this.resend = new Resend(env.resendApiKey);
    }

    async sendOTPEmail(email: string, otp: string): Promise<boolean> {
        try {
            const { error } = await this.resend.emails.send({
                from: `BlendFarm <${env.fromEmail}>`,
                to: [email],
                subject: 'Your OTP Verification Code',
                html: this.generateOTPEmailHTML(otp)
            });

            if (error) {
                console.error('Error sending OTP email:', error);
                return false;
            }

            console.log(`✅ OTP email sent to ${email}`);
            return true;
        } catch (err) {
            console.error('Unexpected error sending OTP email:', err);
            return false;
        }
    }

    async sendResetEmail(email: string, token: string, resetLink: string): Promise<boolean> {
        try {
            const { error } = await this.resend.emails.send({
                from: `BlendFarm <${env.fromEmail}>`,
                to: [email],
                subject: 'Password Reset Request',
                html: this.generateResetEmailHTML(resetLink)
            });

            if (error) {
                console.error('Error sending reset email:', error);
                return false;
            }

            console.log(`✅ Reset email sent to ${email}`);
            return true;
        } catch (err) {
            console.error('Unexpected error sending reset email:', err);
            return false;
        }
    }

    async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
        try {
            const { error } = await this.resend.emails.send({
                from: `BlendFarm <${env.fromEmail}>`,
                to: [email],
                subject: 'Welcome to BlendFarm!',
                html: this.generateWelcomeEmailHTML(name)
            });

            if (error) {
                console.error('Error sending welcome email:', error);
                return false;
            }

            console.log(`✅ Welcome email sent to ${email}`);
            return true;
        } catch (err) {
            console.error('Unexpected error sending welcome email:', err);
            return false;
        }
    }

    private generateOTPEmailHTML(otp: string): string {
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp { background: #ffffff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Your OTP verification code is:</p>
            <div class="otp">${otp}</div>
            <p>This code will expire in ${env.otpExpiryMinutes} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlendFarm. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
    }

    private generateResetEmailHTML(resetLink: string): string {
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Click the button below to reset your password:</p>
            <p><a href="${resetLink}" class="button">Reset Password</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p><code>${resetLink}</code></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlendFarm. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
    }

    private generateWelcomeEmailHTML(name: string): string {
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px; }
            .features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
            .feature { background: white; padding: 20px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to BlendFarm, ${name}!</h1>
          </div>
          <div class="content">
            <p>Thank you for joining BlendFarm, the distributed Blender rendering platform!</p>
            
            <div class="features">
              <div class="feature">
                <h3>🚀 Fast Rendering</h3>
                <p>Distribute your renders across multiple nodes for faster results</p>
              </div>
              <div class="feature">
                <h3>💰 Earn Credits</h3>
                <p>Share your GPU power and earn credits</p>
              </div>
              <div class="feature">
                <h3>☁️ Cloud Storage</h3>
                <p>Secure S3 storage for all your blend files and renders</p>
              </div>
              <div class="feature">
                <h3>📊 Real-time Tracking</h3>
                <p>Monitor your renders in real-time with WebSocket updates</p>
              </div>
            </div>
            
            <p>Get started by uploading your first .blend file or setting up a rendering node!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlendFarm. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
    }
}