/**
 * Email Service using NotificationAPI SDK
 */
const notificationapi = require('notificationapi-node-server-sdk').default;

export async function sendWelcomeEmail(options: any) {
  const { email, password, role, company, phone } = options;
  const companyName = company || "Waterford Carriers";
  const loginUrl = "https://epscourier.online";

  // Check if NotificationAPI credentials are configured
  if (!process.env.NOTIFICATIONAPI_CLIENT_ID || !process.env.NOTIFICATIONAPI_CLIENT_SECRET) {
    console.log('NotificationAPI credentials not configured, skipping email');
    return { success: true, message: 'Email skipped - credentials not configured' };
  }

  try {
    console.log('Sending email via NotificationAPI SDK...');

    // Initialize NotificationAPI
    notificationapi.init(
      process.env.NOTIFICATIONAPI_CLIENT_ID,
      process.env.NOTIFICATIONAPI_CLIENT_SECRET
    );

    // HTML email template
    const emailHTML = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f6f2; border: 1px solid #ece6dc; border-radius: 16px; overflow: hidden;">
        <div style="width: 100%; height: 8px; background: linear-gradient(to right, #0C1E3D, #E79B54, #0C1E3D);"></div>
        <div style="padding: 28px 24px 20px; text-align: center; background-color: #ffffff;">
          <div style="display: inline-block; background: #0C1E3D; color: #E79B54; border-radius: 999px; padding: 10px 16px; font-size: 20px; font-weight: 800; letter-spacing: 0.08em; margin-bottom: 14px;">WF</div>
          <h1 style="color: #0C1E3D; font-size: 28px; margin: 0 0 6px 0;">${companyName}</h1>
          <p style="color: #5b6573; font-size: 14px; margin: 0;">Fleet operations platform</p>
          <h2 style="color: #0C1E3D; font-size: 20px; margin: 18px 0 0 0;">Welcome to Your Account</h2>
        </div>
        <div style="padding: 28px 24px; background-color: #ffffff;">
          <p style="color: #1f2937; font-size: 16px; margin: 0 0 14px 0;"><strong>Hello,</strong></p>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Your ${companyName} account has been created successfully. Please use the credentials below to access the system:</p>
          <div style="background: #f8f6f2; padding: 18px; margin: 18px 0; border-radius: 10px; border-left: 4px solid #E79B54;">
            <p style="margin: 8px 0; color: #1f2937;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #1f2937;"><strong>Password:</strong> ${password}</p>
            <p style="margin: 8px 0; color: #1f2937;"><strong>Role:</strong> ${role}</p>
            <p style="margin: 8px 0; color: #1f2937;"><strong>Company:</strong> ${companyName}</p>
          </div>
          <div style="background: #fff7ec; padding: 14px; margin: 18px 0; border-radius: 10px; border-left: 4px solid #E79B54;">
            <p style="margin: 0; font-size: 14px; color: #6b4a2f;"><strong>Security Notice:</strong> Please change your password after your first login for security purposes.</p>
          </div>
          <div style="text-align: center; margin: 28px 0 6px;">
            <a href="${loginUrl}" style="background: #0C1E3D; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">Open Dashboard</a>
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #0C1E3D 0%, #15305f 65%, #E79B54 100%); padding: 20px; text-align: center;">
          <p style="font-size: 12px; color: #ffffff; margin: 0;">
            This is an automated message from ${companyName}.<br>
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // Send notification using correct format
    const result = await notificationapi.send({
      type: 'welcome',
      to: {
        id: email,
        email: email
      },
      email: {
        subject: `Welcome to ${companyName} - Your Account Credentials`,
        html: emailHTML
      }
    });

    console.log('Email sent successfully via NotificationAPI SDK');

    // Send SMS if phone number is provided
    let smsResult = { success: true, message: 'No phone number provided' };
    console.log('Phone number for SMS:', phone);
    if (phone) {
      smsResult = await sendWelcomeSMS({ phone, email, password, role, company: companyName });
      console.log('SMS Result:', smsResult);
    } else {
      console.log('No phone number provided, sending to test number');
      smsResult = await sendWelcomeSMS({ phone: '+27623661042', email, password, role, company: companyName });
    }

    return {
      success: true,
      messageId: 'sdk-sent',
      provider: 'notificationapi',
      smsResult
    };

  } catch (error: any) {
    console.error('NotificationAPI SDK failed:', error.message || error);
    return { success: false, error: error.message || 'SDK error' };
  }
}

// Format South African phone numbers
function formatSAPhoneNumber(phone: string): string {
  if (!phone) return '+27623661042';

  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('0')) {
    return '+27' + cleaned.substring(1);
  }

  if (cleaned.startsWith('+27')) {
    return cleaned;
  }

  if (cleaned.startsWith('27')) {
    return '+' + cleaned;
  }

  return '+27' + cleaned;
}

export async function sendWelcomeSMS(options: any) {
  const { phone, email, password, role, company } = options;
  const companyName = company || "Waterford Carriers";

  const formattedPhone = formatSAPhoneNumber(phone);

  // Check if NotificationAPI credentials are configured
  if (!process.env.NOTIFICATIONAPI_CLIENT_ID || !process.env.NOTIFICATIONAPI_CLIENT_SECRET) {
    console.log('NotificationAPI credentials not configured, skipping SMS');
    return { success: true, message: 'SMS skipped - credentials not configured' };
  }

  try {
    console.log('Sending SMS via NotificationAPI SDK...');

    // Initialize NotificationAPI
    notificationapi.init(
      process.env.NOTIFICATIONAPI_CLIENT_ID,
      process.env.NOTIFICATIONAPI_CLIENT_SECRET
    );

    // Send SMS notification
    const result = await notificationapi.send({
      type: 'welcome_sms',
      to: {
        id: email,
        number: formattedPhone
      },
      sms: {
        message: `${companyName} - Login: ${email} Password: ${password} Role: ${role}`
      }
    });

    console.log(`SMS sent to: ${formattedPhone} (original: ${phone})`);

    console.log('SMS sent successfully via NotificationAPI SDK');
    return { success: true, messageId: 'sms-sent', provider: 'notificationapi' };

  } catch (error: any) {
    console.error('NotificationAPI SMS failed:', error.message || error);
    console.error('SMS Error Details:', error);
    return { success: false, error: error.message || 'SMS error' };
  }
}

// Generate random password
export function generateTempPassword(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
