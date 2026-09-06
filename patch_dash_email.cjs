const fs = require('fs');
let dash = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const oldMsg = 'message: `<p>Hello,</p><p><b>${userProfile.displayName || userProfile.email}</b> has accepted the invitation and joined the ledger <b>${invite.bookName}</b>.</p>`';

const newMsg = `message: \`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background-color: #1f2937; color: white; display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">SET</div>
            <h2 style="color: #111827; margin-top: 16px; margin-bottom: 4px; font-size: 20px;">New Member Joined</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Ledger: <strong>\${invite.bookName}</strong></p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #f3f4f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 0;">Hello,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">Great news! <strong style="color: #10b981;">\${userProfile.displayName || userProfile.email}</strong> has accepted your invitation and successfully joined your ledger.</p>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from your ExpenseShare application.</p>
          </div>
        </div>
      \``;

dash = dash.replace(oldMsg, newMsg);
fs.writeFileSync('src/pages/Dashboard.tsx', dash);
