const fs = require('fs');
let bookView = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

const oldMessage = 'const message = `<p>Hello,</p><p>A ledger you are a member of has been updated by <b>${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> ${action}</p><p><b>Details:</b> ${detail}</p>`;';

const newMessage = `const message = \`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background-color: #1f2937; color: white; display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">SET</div>
            <h2 style="color: #111827; margin-top: 16px; margin-bottom: 4px; font-size: 20px;">Expense Tracker Update</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Ledger: <strong>\${book.name}</strong></p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #f3f4f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 0;">Hello,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">An entry in a ledger you follow has been updated by <strong style="color: #111827;">\${userProfile?.displayName || currentUser?.email}</strong>.</p>
            
            <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Action</p>
              <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 500;">\${action}</p>
            </div>
            
            <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #10b981;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Details</p>
              <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 500;">\${detail}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from your ExpenseShare application.</p>
          </div>
        </div>
      \`;`;

bookView = bookView.replace(oldMessage, newMessage);
fs.writeFileSync('src/pages/BookView.tsx', bookView);
