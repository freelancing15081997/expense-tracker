import { Expense, ConfiguredEmail, SentNotification, NotificationType, DailyBudgetSettings } from '../types';

/**
 * Format currency helper
 */
export const formatCurrency = (amount: number, currency: string = '$'): string => {
  return `${currency}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Play a subtle soft audio chime when confirmation or notification occurs
 */
export const playNotificationChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio might be muted or not allowed without user gesture
  }
};

/**
 * Request browser push notification permission
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

/**
 * Send browser system push alert
 */
export const sendBrowserPushNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      });
    } catch (e) {
      console.warn('Browser notification error:', e);
    }
  }
};

/**
 * Generate email alert for newly added expense
 */
export const createAddExpenseAlert = (
  expense: Expense,
  configuredEmails: ConfiguredEmail[],
  currentUser: string
): SentNotification => {
  const activeRecipients = configuredEmails
    .filter((cfg) => cfg.active && cfg.notifyOnAddEdit)
    .map((cfg) => cfg.email);

  const subject = `🟢 Sheet Update: New Expense Added (${formatCurrency(expense.amount, expense.currency)}) by ${expense.spenderName}`;
  const summaryText = `${expense.spenderName} added ${formatCurrency(expense.amount, expense.currency)} for "${expense.description || 'General Expense'}" [${expense.category || 'Uncategorized'}] via ${expense.paymentMode || 'Standard'}.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background: #0f172a; padding: 24px; color: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="background: #059669; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;">New Expense Alert</span>
          <span style="color: #94a3b8; font-size: 12px;">Google Sheet Auto-Sync</span>
        </div>
        <h2 style="margin: 16px 0 4px 0; font-size: 22px; font-weight: 700; color: #f8fafc;">New Expense Recorded in Shared Sheet</h2>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">Logged by <strong>${expense.spenderName}</strong> on ${expense.date}</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px;">Amount Charged</div>
          <div style="font-size: 32px; font-weight: 800; color: #059669;">${formatCurrency(expense.amount, expense.currency)}</div>
          <div style="font-size: 14px; color: #334155; margin-top: 6px; font-weight: 500;">${expense.description || 'No description provided'}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Category:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">${expense.category || 'General / None'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Payment Mode:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">${expense.paymentMode || 'Standard'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Spender:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">${expense.spenderName} &lt;${expense.spenderEmail}&gt;</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Date:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 500;">${expense.date}</td>
          </tr>
          ${expense.notes ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Notes:</td>
            <td style="padding: 10px 0; color: #0f172a;">${expense.notes}</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Proof of Image:</td>
            <td style="padding: 10px 0; color: #0f172a;">${expense.receiptImage ? '✅ Verified Receipt Attached' : 'None provided'}</td>
          </tr>
        </table>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1e40af;">
          ℹ️ <strong>Instant Notification:</strong> All team members on the configured notification list are notified immediately when a budget item is entered.
        </div>
      </div>

      <div style="background: #f1f5f9; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        Automated alert from Shared Sheet Expense Tracker • Sent to ${activeRecipients.length} configured emails
      </div>
    </div>
  `;

  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'ADD_ALERT',
    recipients: activeRecipients,
    subject,
    summaryText,
    htmlBody,
    timestamp: new Date().toISOString(),
    triggeredBy: currentUser,
    expenseId: expense.id,
    status: 'delivered',
  };
};

/**
 * Generate email alert for edited expense
 */
export const createEditExpenseAlert = (
  oldExpense: Expense,
  updatedExpense: Expense,
  configuredEmails: ConfiguredEmail[],
  currentUser: string,
  changeSummary?: string
): SentNotification => {
  const activeRecipients = configuredEmails
    .filter((cfg) => cfg.active && cfg.notifyOnAddEdit)
    .map((cfg) => cfg.email);

  const subject = `✏️ Sheet Update: Expense #${updatedExpense.rowNumber} Modified by ${currentUser}`;
  const summaryText = `${currentUser} edited expense #${updatedExpense.rowNumber} (${updatedExpense.description || 'Expense'}). ${changeSummary || 'Details were updated.'}`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background: #1e293b; padding: 24px; color: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px;">Expense Modified Alert</span>
          <span style="color: #94a3b8; font-size: 12px;">Google Sheet Live Sync</span>
        </div>
        <h2 style="margin: 16px 0 4px 0; font-size: 22px; font-weight: 700; color: #f8fafc;">Expense #${updatedExpense.rowNumber} Was Edited</h2>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">Modified by <strong>${currentUser}</strong> on ${new Date().toLocaleDateString()}</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #854d0e;">
          ⚠️ <strong>Budget Change Audit:</strong> A previously recorded expense was modified. Please review the updated values below.
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 8px; color: #475569;">Field</th>
              <th style="padding: 8px; color: #dc2626;">Previous Value</th>
              <th style="padding: 8px; color: #16a34a;">Updated Value</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Amount:</td>
              <td style="padding: 8px; color: #64748b; text-decoration: line-through;">${formatCurrency(oldExpense.amount, oldExpense.currency)}</td>
              <td style="padding: 8px; color: #059669; font-weight: 700;">${formatCurrency(updatedExpense.amount, updatedExpense.currency)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Description:</td>
              <td style="padding: 8px; color: #64748b;">${oldExpense.description || '—'}</td>
              <td style="padding: 8px; color: #0f172a; font-weight: 500;">${updatedExpense.description || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Category:</td>
              <td style="padding: 8px; color: #64748b;">${oldExpense.category || '—'}</td>
              <td style="padding: 8px; color: #0f172a; font-weight: 500;">${updatedExpense.category || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Payment Mode:</td>
              <td style="padding: 8px; color: #64748b;">${oldExpense.paymentMode || '—'}</td>
              <td style="padding: 8px; color: #0f172a; font-weight: 500;">${updatedExpense.paymentMode || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Spender:</td>
              <td style="padding: 8px; color: #64748b;">${oldExpense.spenderName}</td>
              <td style="padding: 8px; color: #0f172a; font-weight: 500;">${updatedExpense.spenderName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px; font-weight: 600; color: #64748b;">Date:</td>
              <td style="padding: 8px; color: #64748b;">${oldExpense.date}</td>
              <td style="padding: 8px; color: #0f172a; font-weight: 500;">${updatedExpense.date}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background: #f1f5f9; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        Sent to ${activeRecipients.length} configured emails • Edited via Sheet inline editor / form
      </div>
    </div>
  `;

  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'EDIT_ALERT',
    recipients: activeRecipients,
    subject,
    summaryText,
    htmlBody,
    timestamp: new Date().toISOString(),
    triggeredBy: currentUser,
    expenseId: updatedExpense.id,
    status: 'delivered',
  };
};

/**
 * Generate email alert for deleted expense
 */
export const createDeleteExpenseAlert = (
  deletedExpense: Expense,
  configuredEmails: ConfiguredEmail[],
  currentUser: string
): SentNotification => {
  const activeRecipients = configuredEmails
    .filter((cfg) => cfg.active && cfg.notifyOnAddEdit)
    .map((cfg) => cfg.email);

  const subject = `🗑️ Sheet Update: Expense #${deletedExpense.rowNumber} (${formatCurrency(deletedExpense.amount, deletedExpense.currency)}) Deleted by ${currentUser}`;
  const summaryText = `${currentUser} removed expense #${deletedExpense.rowNumber} of ${formatCurrency(deletedExpense.amount, deletedExpense.currency)} ("${deletedExpense.description || 'Expense'}").`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #991b1b; padding: 24px; color: #ffffff;">
        <span style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px;">Expense Deleted</span>
        <h2 style="margin: 16px 0 4px 0; font-size: 22px; font-weight: 700;">Expense Record Removed</h2>
        <p style="margin: 0; color: #fecaca; font-size: 14px;">Deleted by ${currentUser}</p>
      </div>
      <div style="padding: 24px;">
        <p style="color: #334155; font-size: 14px;">The following entry was removed from the shared expense sheet:</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 700; color: #991b1b;">${formatCurrency(deletedExpense.amount, deletedExpense.currency)}</div>
          <div style="font-size: 14px; color: #475569; margin-top: 4px;"><strong>Spender:</strong> ${deletedExpense.spenderName}</div>
          <div style="font-size: 14px; color: #475569;"><strong>Description:</strong> ${deletedExpense.description || 'No description'}</div>
          <div style="font-size: 14px; color: #475569;"><strong>Category:</strong> ${deletedExpense.category} | <strong>Mode:</strong> ${deletedExpense.paymentMode}</div>
        </div>
      </div>
    </div>
  `;

  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'DELETE_ALERT',
    recipients: activeRecipients,
    subject,
    summaryText,
    htmlBody,
    timestamp: new Date().toISOString(),
    triggeredBy: currentUser,
    status: 'delivered',
  };
};

/**
 * Generate comprehensive Automated Monthly Digest Email
 */
export const generateMonthlyDigest = (
  expenses: Expense[],
  configuredEmails: ConfiguredEmail[],
  budgetSettings: DailyBudgetSettings,
  monthName: string = 'Current Month'
): SentNotification => {
  const activeRecipients = configuredEmails
    .filter((cfg) => cfg.active && cfg.notifyMonthlyDigest)
    .map((cfg) => cfg.email);

  const totalSpend = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCount = expenses.length;
  const budgetUtilization = budgetSettings.monthlyLimit > 0 
    ? ((totalSpend / budgetSettings.monthlyLimit) * 100).toFixed(1)
    : '0';

  // Spending per person
  const spenderMap: Record<string, number> = {};
  expenses.forEach((e) => {
    spenderMap[e.spenderName] = (spenderMap[e.spenderName] || 0) + e.amount;
  });
  const topSpenders = Object.entries(spenderMap).sort((a, b) => b[1] - a[1]);

  // Spending per category
  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + e.amount;
  });
  const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  const subject = `📅 Automated Monthly Expense Digest: ${monthName} Summary (${formatCurrency(totalSpend, budgetSettings.currency)})`;
  const summaryText = `Total monthly spending reached ${formatCurrency(totalSpend, budgetSettings.currency)} across ${totalCount} recorded expenses. Monthly budget utilization is at ${budgetUtilization}%.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 28px; color: #ffffff;">
        <span style="background: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px;">Automated Monthly Report</span>
        <h1 style="margin: 16px 0 6px 0; font-size: 26px; font-weight: 800;">${monthName} Expense Report</h1>
        <p style="margin: 0; color: #a7f3d0; font-size: 14px;">Automated financial digest sent to all configured spreadsheet recipients</p>
      </div>

      <div style="padding: 24px;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Month Spend</div>
            <div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatCurrency(totalSpend, budgetSettings.currency)}</div>
            <div style="font-size: 12px; color: #059669; margin-top: 4px;">Across ${totalCount} recorded items</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Budget Utilization</div>
            <div style="font-size: 28px; font-weight: 800; color: ${Number(budgetUtilization) > 100 ? '#dc2626' : '#0284c7'}; margin-top: 4px;">${budgetUtilization}%</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Target: ${formatCurrency(budgetSettings.monthlyLimit, budgetSettings.currency)}</div>
          </div>
        </div>

        <!-- Contributor Breakdown -->
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Individual Spending Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px; color: #475569;">Member</th>
              <th style="padding: 10px; color: #475569; text-align: right;">Total Amount</th>
              <th style="padding: 10px; color: #475569; text-align: right;">Share %</th>
            </tr>
          </thead>
          <tbody>
            ${topSpenders
              .map(
                ([name, amt]) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-weight: 600; color: #1e293b;">${name}</td>
                <td style="padding: 10px; text-align: right; color: #0f172a; font-weight: 700;">${formatCurrency(amt, budgetSettings.currency)}</td>
                <td style="padding: 10px; text-align: right; color: #64748b;">${totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : '0'}%</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <!-- Top Categories -->
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Spending by Category</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <tbody>
            ${topCategories
              .map(
                ([cat, amt]) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 10px; color: #334155; font-weight: 500;">${cat}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(amt, budgetSettings.currency)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; font-size: 13px; color: #166534;">
          💡 <strong>Audit Verified:</strong> All members can inspect individual receipts and add missing receipts directly in the online sheet.
        </div>
      </div>

      <div style="background: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        Automated Monthly Digest • Generated automatically by Shared Sheet Expense Tracker
      </div>
    </div>
  `;

  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'MONTHLY_DIGEST',
    recipients: activeRecipients,
    subject,
    summaryText,
    htmlBody,
    timestamp: new Date().toISOString(),
    triggeredBy: 'Automated Monthly Dispatch',
    status: 'delivered',
  };
};

/**
 * Generate Daily Budget Push Notification & Alert
 */
export const createDailyBudgetAlert = (
  todaySpend: number,
  dailyLimit: number,
  currency: string,
  configuredEmails: ConfiguredEmail[]
): SentNotification => {
  const percentUsed = ((todaySpend / dailyLimit) * 100).toFixed(0);
  const isOver = todaySpend > dailyLimit;

  const recipients = configuredEmails
    .filter((cfg) => cfg.active && cfg.notifyDailyBudget)
    .map((cfg) => cfg.email);

  const subject = isOver
    ? `🚨 Daily Budget Alert: Limit Exceeded! (${formatCurrency(todaySpend, currency)} / ${formatCurrency(dailyLimit, currency)})`
    : `🔔 Daily Budget Check-in: ${formatCurrency(todaySpend, currency)} spent today (${percentUsed}% of daily budget)`;

  const summaryText = isOver
    ? `Today's spend of ${formatCurrency(todaySpend, currency)} has exceeded your daily limit of ${formatCurrency(dailyLimit, currency)} by ${formatCurrency(todaySpend - dailyLimit, currency)}.`
    : `You are on track! Spent ${formatCurrency(todaySpend, currency)} out of your daily budget of ${formatCurrency(dailyLimit, currency)}.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: ${isOver ? '#dc2626' : '#2563eb'}; padding: 22px; color: #ffffff;">
        <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px;">Daily Budget Reminder</span>
        <h2 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 700;">${isOver ? '⚠️ Daily Limit Exceeded' : 'Daily Spending Status'}</h2>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; color: #334155;">${summaryText}</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <div style="font-size: 13px; color: #64748b;">Daily Spend vs Target</div>
          <div style="font-size: 24px; font-weight: 800; color: ${isOver ? '#dc2626' : '#0f172a'}; margin: 6px 0;">
            ${formatCurrency(todaySpend, currency)} <span style="font-size: 15px; color: #64748b; font-weight: 400;">/ ${formatCurrency(dailyLimit, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'DAILY_BUDGET_REMINDER',
    recipients,
    subject,
    summaryText,
    htmlBody,
    timestamp: new Date().toISOString(),
    triggeredBy: 'Daily Budget Monitor',
    status: 'delivered',
  };
};
