/**
 * Google Apps Script Code Template for standalone Google Sheets automation.
 * When pasted into Google Sheets (Extensions -> Apps Script), this script transforms
 * Google Sheets into a complete standalone web application with:
 * 
 * 1. An In-Sheet Interactive App Sidebar (Tailwind CSS, fast expense logger, balances)
 * 2. Automated Email Notifications to all roommates whenever ANY user adds or edits a cell
 * 3. 1-Click Installable Triggers for real-time alerts without needing the web app
 * 4. Automated Monthly Expense Digest on the 1st of every month
 * 5. In-Sheet Interactive Modal Dialogs and custom top menu
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * 🧾 ROOMMATE EXPENSE HUB - NATIVE GOOGLE SHEETS APP ENGINE & AUTOMATION
 * ============================================================================
 * Instructions:
 * 1. Open your Google Spreadsheet
 * 2. Click: Extensions -> Apps Script
 * 3. Delete any code in the editor, paste this entire file, and click Save (💾)
 * 4. Refresh your Google Sheet tab!
 * 5. A new menu "✨ Expense App" will appear in the top bar!
 * ============================================================================
 */

/**
 * Triggered automatically when spreadsheet opens.
 * Adds custom app menu and greets user.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('✨ Expense App')
    .addItem('📱 Open In-Sheet App Sidebar', 'showAppSidebar')
    .addItem('➕ Quick Add Expense (Dialog)', 'showAddExpenseDialog')
    .addSeparator()
    .addItem('🔔 Enable 1-Click Auto Email Notifications', 'installAutoNotificationTrigger')
    .addItem('📊 Send Monthly Report to Roommates Now', 'triggerMonthlyReportNow')
    .addItem('⏰ Schedule Monthly Auto-Email (1st of Month)', 'installMonthlyTrigger')
    .addSeparator()
    .addItem('👥 Open Roommate Notification Directory', 'openRoommateSheetTab')
    .addItem('🎨 Refresh Dashboard KPI Formulas', 'refreshDashboardFormulas')
    .addToUi();

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Click menu "✨ Expense App" -> "📱 Open In-Sheet App Sidebar" for the full app experience!',
      '🧾 Expense Hub Ready',
      6
    );
  } catch (e) {}
}

/**
 * ============================================================================
 * 1. IN-SHEET APP SIDEBAR (MODERN WEB APP INSIDE GOOGLE SHEETS)
 * ============================================================================
 */
function showAppSidebar() {
  const html = HtmlService.createHtmlOutput(getSidebarHtml())
    .setTitle('🧾 Roommate Expense Hub')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Quick Add Expense Dialog
 */
function showAddExpenseDialog() {
  showAppSidebar();
}

/**
 * Returns complete modern HTML/CSS/JS for the In-Sheet Sidebar App
 */
function getSidebarHtml() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const expSheet = ss.getSheetByName('Expenses');
  const membersSheet = ss.getSheetByName('Configured Members') || ss.getSheetByName('Configured Mails');
  
  let totalSpend = 0;
  let count = 0;
  let roommates = [];
  
  if (expSheet && expSheet.getLastRow() > 1) {
    const data = expSheet.getRange(2, 5, expSheet.getLastRow() - 1, 1).getValues();
    data.forEach(function(r) {
      const val = parseFloat(r[0]);
      if (!isNaN(val)) {
        totalSpend += val;
        count++;
      }
    });
  }

  if (membersSheet && membersSheet.getLastRow() > 1) {
    const mData = membersSheet.getRange(2, 2, membersSheet.getLastRow() - 1, 1).getValues();
    mData.forEach(function(r) {
      if (r[0] && r[0].toString().trim()) {
        roommates.push(r[0].toString().trim());
      }
    });
  }

  if (roommates.length === 0) {
    roommates = ['Badrinath Pujari', 'Roommate 1', 'Roommate 2'];
  }

  const roommateOptions = roommates.map(function(name) {
    return '<option value="' + name + '">' + name + '</option>';
  }).join('');

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd');

  return '<!DOCTYPE html>' +
    '<html><head><base target="_top">' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<script src="https://cdn.tailwindcss.com"></script>' +
    '<style>' +
    '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }' +
    '  .chip-btn.active { background-color: #059669; color: white; border-color: #059669; }' +
    '</style>' +
    '</head><body class="bg-slate-50 text-slate-800 text-xs p-3">' +
    
    // Header
    '<div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">' +
    '  <div>' +
    '    <h1 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">🧾 Expense Hub</h1>' +
    '    <p class="text-[10px] text-slate-500">Live Shared Sheet Manager</p>' +
    '  </div>' +
    '  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Direct Sync</span>' +
    '</div>' +

    // KPI Metrics
    '<div class="grid grid-cols-2 gap-2 mb-3">' +
    '  <div class="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-sm">' +
    '    <span class="text-[10px] font-medium text-emerald-700">Total Group Spend</span>' +
    '    <div class="text-base font-extrabold text-emerald-900 mt-0.5">$' + totalSpend.toFixed(2) + '</div>' +
    '  </div>' +
    '  <div class="bg-white p-2.5 rounded-xl border border-sky-200 shadow-sm">' +
    '    <span class="text-[10px] font-medium text-sky-700">Total Entries</span>' +
    '    <div class="text-base font-extrabold text-sky-900 mt-0.5">' + count + ' items</div>' +
    '  </div>' +
    '</div>' +

    // Navigation Tabs
    '<div class="flex bg-slate-200/80 p-0.5 rounded-lg mb-3">' +
    '  <button id="tab-add-btn" onclick="showTab(\\'add\\')" class="flex-1 py-1.5 font-bold rounded-md bg-white shadow-xs text-emerald-700 transition">➕ Add Expense</button>' +
    '  <button id="tab-auto-btn" onclick="showTab(\\'auto\\')" class="flex-1 py-1.5 font-semibold rounded-md text-slate-600 transition">🔔 Auto Alerts</button>' +
    '</div>' +

    // Tab 1: Fast Add Expense Form
    '<div id="tab-add" class="space-y-2.5">' +
    '  <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">' +
    '    <div class="font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100">Log Expense to Sheet</div>' +
    
    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Date 📅</label>' +
    '      <input type="date" id="exp-date" value="' + today + '" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">' +
    '    </div>' +

    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Spender / Roommate 👤</label>' +
    '      <select id="exp-spender" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">' +
           roommateOptions +
    '      </select>' +
    '    </div>' +

    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Amount ($) 💰</label>' +
    '      <input type="number" step="0.01" id="exp-amount" placeholder="0.00" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-emerald-700">' +
    '    </div>' +

    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Category 🏷️</label>' +
    '      <select id="exp-category" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">' +
    '        <option value="Groceries 🛒">Groceries 🛒</option>' +
    '        <option value="Utilities ⚡">Utilities ⚡</option>' +
    '        <option value="Rent 🏠">Rent 🏠</option>' +
    '        <option value="Dining & Food 🍕">Dining & Food 🍕</option>' +
    '        <option value="Household 🧼">Household 🧼</option>' +
    '        <option value="Entertainment 🎬">Entertainment 🎬</option>' +
    '        <option value="Travel & Fuel 🚗">Travel & Fuel 🚗</option>' +
    '        <option value="Healthcare 💊">Healthcare 💊</option>' +
    '        <option value="Other 📦">Other 📦</option>' +
    '      </select>' +
    '    </div>' +

    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Description 📝</label>' +
    '      <input type="text" id="exp-desc" placeholder="e.g. WiFi bill, Milk & eggs" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">' +
    '    </div>' +

    '    <div>' +
    '      <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Payment Mode 💳</label>' +
    '      <select id="exp-payment" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">' +
    '        <option value="UPI / Online 📱">UPI / Online 📱</option>' +
    '        <option value="Credit Card 💳">Credit Card 💳</option>' +
    '        <option value="Debit Card 💳">Debit Card 💳</option>' +
    '        <option value="Cash 💵">Cash 💵</option>' +
    '        <option value="Bank Transfer 🏦">Bank Transfer 🏦</option>' +
    '        <option value="Splitwise ⚖️">Splitwise ⚖️</option>' +
    '      </select>' +
    '    </div>' +

    '    <button id="btn-submit" onclick="submitExpense()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">' +
    '      <span>Save to Sheet & Notify All Roommates</span>' +
    '    </button>' +
    '    <div id="status-msg" class="text-center font-bold text-[11px] py-1 hidden"></div>' +
    '  </div>' +
    '</div>' +

    // Tab 2: Automated Notification Settings
    '<div id="tab-auto" class="space-y-2.5 hidden">' +
    '  <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">' +
    '    <div class="font-bold text-slate-800 text-[11px]">Instant Alert System</div>' +
    '    <p class="text-[11px] text-slate-600 leading-relaxed">' +
    '      Click below to activate <b>Automatic Notifications</b>. Once enabled, whenever ANY roommate enters or edits a row in Google Sheets, an email is automatically sent to all active addresses in "Configured Members".' +
    '    </p>' +
    '    <button onclick="installAutoTriggerFromSidebar()" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition">' +
    '      🔔 Activate 1-Click Auto Email Trigger' +
    '    </button>' +
    '    <button onclick="triggerMonthlyReportFromSidebar()" class="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 transition">' +
    '      📊 Dispatch Monthly Report Now' +
    '    </button>' +
    '  </div>' +
    '</div>' +

    '<script>' +
    '  function showTab(t) {' +
    '    document.getElementById("tab-add").classList.toggle("hidden", t !== "add");' +
    '    document.getElementById("tab-auto").classList.toggle("hidden", t !== "auto");' +
    '    document.getElementById("tab-add-btn").className = t === "add" ? "flex-1 py-1.5 font-bold rounded-md bg-white shadow-xs text-emerald-700 transition" : "flex-1 py-1.5 font-semibold rounded-md text-slate-600 transition";' +
    '    document.getElementById("tab-auto-btn").className = t === "auto" ? "flex-1 py-1.5 font-bold rounded-md bg-white shadow-xs text-emerald-700 transition" : "flex-1 py-1.5 font-semibold rounded-md text-slate-600 transition";' +
    '  }' +
    '  function submitExpense() {' +
    '    const date = document.getElementById("exp-date").value;' +
    '    const spender = document.getElementById("exp-spender").value;' +
    '    const amount = document.getElementById("exp-amount").value;' +
    '    const category = document.getElementById("exp-category").value;' +
    '    const desc = document.getElementById("exp-desc").value;' +
    '    const payment = document.getElementById("exp-payment").value;' +
    '    if (!amount || parseFloat(amount) <= 0) { alert("Please enter a valid amount."); return; }' +
    '    const btn = document.getElementById("btn-submit");' +
    '    btn.disabled = true; btn.innerText = "Saving to Google Sheet...";' +
    '    google.script.run' +
    '      .withSuccessHandler(function(res) {' +
    '        btn.disabled = false; btn.innerText = "Save to Sheet & Notify All Roommates";' +
    '        document.getElementById("exp-amount").value = "";' +
    '        document.getElementById("exp-desc").value = "";' +
    '        const msg = document.getElementById("status-msg");' +
    '        msg.className = "text-center font-bold text-[11px] py-1 text-emerald-700 block";' +
    '        msg.innerText = "✅ Logged & Roommates Notified!";' +
    '        setTimeout(function() { msg.className = "hidden"; }, 4000);' +
    '      })' +
    '      .withFailureHandler(function(err) {' +
    '        btn.disabled = false; btn.innerText = "Save to Sheet & Notify All Roommates";' +
    '        alert("Error: " + err.message);' +
    '      })' +
    '      .addExpenseFromSidebar(date, spender, amount, category, desc, payment);' +
    '  }' +
    '  function installAutoTriggerFromSidebar() {' +
    '    google.script.run' +
    '      .withSuccessHandler(function() { alert("Automatic Notifications Enabled successfully!"); })' +
    '      .installAutoNotificationTrigger();' +
    '  }' +
    '  function triggerMonthlyReportFromSidebar() {' +
    '    google.script.run' +
    '      .withSuccessHandler(function() { alert("Monthly report dispatched to all roommates!"); })' +
    '      .triggerMonthlyReportNow();' +
    '  }' +
    '</script>' +
    '</body></html>';
}

/**
 * ============================================================================
 * 2. AUTOMATED EDIT NOTIFICATION TRIGGER
 * ============================================================================
 * When installed, this trigger fires whenever ANY user adds or edits a cell in the spreadsheet!
 */
function installAutoNotificationTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getUserTriggers(ss);
  
  // Remove existing duplicate edit triggers
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'handleSheetEditOrAdd') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new installable spreadsheet edit trigger
  ScriptApp.newTrigger('handleSheetEditOrAdd')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Automatic Email Alerts Activated!',
    'The automated notification engine is now running.\\n\\nWhenever ANY roommate adds a new expense or modifies a cell in the sheet, an instant email alert is automatically dispatched to all active emails in "Configured Members".',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Executes automatically on every edit/addition in the spreadsheet by ANY user
 */
function handleSheetEditOrAdd(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Expenses') return;

  const row = e.range.getRow();
  if (row <= 1) return; // Skip header row

  const colIndex = e.range.getColumn();
  const oldValue = e.oldValue !== undefined ? e.oldValue : '(empty)';
  const newValue = e.value !== undefined ? e.value : '(cleared)';
  
  // Header name
  const headerName = sheet.getRange(1, colIndex).getValue() || ('Column ' + colIndex);

  // Read full row data for context
  const rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];
  const expenseId = rowData[0] || ('Row #' + row);
  const date = rowData[1] || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd');
  const spender = rowData[2] || 'Roommate';
  const amount = rowData[4] || '0.00';
  const description = rowData[6] || '(No description)';
  const category = rowData[7] || 'General';

  // Automatically update 'Updated At' and 'Last Edited By'
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd HH:mm');
  const activeUserEmail = Session.getActiveUser().getEmail() || 'Spreadsheet Editor';
  sheet.getRange(row, 12).setValue(activeUserEmail);
  sheet.getRange(row, 13).setValue(now);

  // If new row with no ID, auto-generate ID
  if (!rowData[0]) {
    sheet.getRange(row, 1).setValue('exp-' + Date.now().toString().slice(-6));
  }

  // Send email to all configured recipients
  notifyAllRoommates({
    type: oldValue === '(empty)' ? 'ADD' : 'EDIT',
    row: row,
    headerName: headerName,
    oldValue: oldValue,
    newValue: newValue,
    spender: spender,
    amount: amount,
    category: category,
    description: description,
    date: date,
    editor: activeUserEmail
  });
}

/**
 * Sends formatted email alert to all configured roommate emails
 */
function notifyAllRoommates(info) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName('Configured Members') || ss.getSheetByName('Configured Mails');
  if (!membersSheet) return;

  const mData = membersSheet.getDataRange().getValues();
  const recipients = [];

  for (let i = 1; i < mData.length; i++) {
    const email = mData[i][2]; // Col C: Email Address
    const notifyOnAddEdit = mData[i][4]; // Col E: Notify on Add/Edit
    const isActive = mData[i][7]; // Col H: Active

    const isYes = notifyOnAddEdit === true || notifyOnAddEdit === 'YES' || notifyOnAddEdit === 'TRUE';
    const activeYes = isActive === true || isActive === 'ACTIVE' || isActive === 'YES' || isActive === 'TRUE';

    if (email && email.toString().includes('@') && isYes && activeYes) {
      recipients.push(email.toString().trim());
    }
  }

  if (recipients.length === 0) return;

  const isNew = info.type === 'ADD';
  const subject = isNew 
    ? '🔔 New Expense Added: $' + info.amount + ' by ' + info.spender + ' (' + info.category + ')'
    : '✏️ Expense Modified in Sheet: ' + info.headerName + ' updated by ' + info.editor;

  const htmlBody = '<div style="font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; max-width: 580px; margin: auto; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">' +
    '<div style="background-color: #065f46; color: white; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px;">' +
    '  <h2 style="margin: 0; font-size: 16px;">🧾 Shared Expense Tracker • Roommate Alert</h2>' +
    '  <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">' + (isNew ? 'A new expense was logged in the Google Sheet' : 'A row was modified in the Google Sheet') + '</p>' +
    '</div>' +

    '<div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px;">' +
    '  <div style="font-size: 13px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Expense Details:</div>' +
    '  <table style="width: 100%; font-size: 13px; border-collapse: collapse;">' +
    '    <tr><td style="padding: 6px 0; color: #64748b;">Amount:</td><td style="padding: 6px 0; font-weight: bold; color: #059669; font-size: 16px;">$' + info.amount + '</td></tr>' +
    '    <tr><td style="padding: 6px 0; color: #64748b;">Spender:</td><td style="padding: 6px 0; font-weight: bold;">' + info.spender + '</td></tr>' +
    '    <tr><td style="padding: 6px 0; color: #64748b;">Category:</td><td style="padding: 6px 0;">' + info.category + '</td></tr>' +
    '    <tr><td style="padding: 6px 0; color: #64748b;">Date:</td><td style="padding: 6px 0;">' + info.date + '</td></tr>' +
    '    <tr><td style="padding: 6px 0; color: #64748b;">Description:</td><td style="padding: 6px 0;">' + info.description + '</td></tr>' +
    (!isNew ? '<tr><td style="padding: 6px 0; color: #64748b;">Modified Field:</td><td style="padding: 6px 0; color: #b45309; font-weight: bold;">' + info.headerName + ' (' + info.oldValue + ' ➔ ' + info.newValue + ')</td></tr>' : '') +
    '  </table>' +
    '</div>' +

    '<div style="text-align: center; margin-top: 20px;">' +
    '  <a href="' + ss.getUrl() + '" style="display: inline-block; padding: 11px 22px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">Open Live Google Sheet</a>' +
    '</div>' +
    '</div>';

  recipients.forEach(function(recipient) {
    try {
      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        htmlBody: htmlBody
      });
    } catch(err) {
      Logger.log('Failed to send to ' + recipient + ': ' + err);
    }
  });
}

/**
 * ============================================================================
 * 3. SIDEBAR FORM HANDLER
 * ============================================================================
 */
function addExpenseFromSidebar(date, spender, amount, category, desc, payment) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Expenses');
  if (!sheet) throw new Error('Expenses sheet tab not found');

  const id = 'exp-' + Date.now().toString().slice(-6);
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd HH:mm');
  const userEmail = Session.getActiveUser().getEmail() || spender;

  sheet.appendRow([
    id,
    date,
    spender,
    userEmail,
    parseFloat(amount),
    '$',
    desc,
    category,
    payment,
    '', // receipt
    'Logged via In-Sheet App',
    userEmail,
    now
  ]);

  // Format currency on the newly appended cell
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 5).setNumberFormat('$#,##0.00');

  // Trigger notification
  notifyAllRoommates({
    type: 'ADD',
    row: lastRow,
    headerName: 'New Row',
    oldValue: '',
    newValue: amount,
    spender: spender,
    amount: amount,
    category: category,
    description: desc,
    date: date,
    editor: userEmail
  });

  return { success: true, id: id };
}

/**
 * ============================================================================
 * 4. AUTOMATED MONTHLY REPORT ENGINE
 * ============================================================================
 */
function sendMonthlyExpenseDigest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const expSheet = ss.getSheetByName('Expenses');
  const membersSheet = ss.getSheetByName('Configured Members') || ss.getSheetByName('Configured Mails');
  if (!expSheet || !membersSheet) return;

  const expData = expSheet.getDataRange().getValues();
  let totalSpend = 0;
  const spenderTotals = {};
  const categoryTotals = {};

  for (let i = 1; i < expData.length; i++) {
    const amount = parseFloat(expData[i][4]) || 0;
    const spender = expData[i][2] || 'Unassigned';
    const category = expData[i][7] || 'General';

    totalSpend += amount;
    spenderTotals[spender] = (spenderTotals[spender] || 0) + amount;
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
  }

  // Get recipient emails
  const memberData = membersSheet.getDataRange().getValues();
  const recipients = [];
  for (let j = 1; j < memberData.length; j++) {
    const email = memberData[j][2];
    const notifyMonthly = memberData[j][5];
    const isActive = memberData[j][7];
    const isYes = notifyMonthly === true || notifyMonthly === 'YES' || notifyMonthly === 'TRUE';
    const activeYes = isActive === true || isActive === 'ACTIVE' || isActive === 'YES' || isActive === 'TRUE';
    if (email && email.toString().includes('@') && isYes && activeYes) {
      recipients.push(email.toString().trim());
    }
  }

  if (recipients.length === 0) return;

  const currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'MMMM yyyy');
  const subject = '📊 Monthly Expense Digest - ' + currentMonth + ' (Shared Sheet)';

  let spenderRowsHtml = '';
  for (const s in spenderTotals) {
    spenderRowsHtml += '<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">' + s + '</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">$' + spenderTotals[s].toFixed(2) + '</td></tr>';
  }

  const htmlBody = '<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">' +
    '<h2 style="color: #059669; margin-top: 0;">📅 Monthly Expense Report - ' + currentMonth + '</h2>' +
    '<p>Here is the automated financial summary of shared roommate expenses:</p>' +
    '<div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin-bottom: 16px;">' +
    '  <span style="font-size: 13px; color: #166534;">Total Monthly Expenses</span><br>' +
    '  <span style="font-size: 28px; font-weight: bold; color: #15803d;">$' + totalSpend.toFixed(2) + '</span>' +
    '</div>' +
    '<h3>Spending by Roommate</h3>' +
    '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">' +
    '  <thead><tr style="background: #f8fafc;"><th style="padding: 8px; text-align: left;">Roommate</th><th style="padding: 8px; text-align: right;">Total Spent</th></tr></thead>' +
    '  <tbody>' + spenderRowsHtml + '</tbody>' +
    '</table>' +
    '<a href="' + ss.getUrl() + '" style="display: block; text-align: center; background: #059669; color: white; padding: 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Full Google Sheet</a>' +
    '</div>';

  recipients.forEach(function(recipient) {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
  });
}

function installMonthlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendMonthlyExpenseDigest') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('sendMonthlyExpenseDigest')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger Installed!',
    'Monthly digest will be emailed to all active roommates on the 1st of every month at 9:00 AM.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function triggerMonthlyReportNow() {
  sendMonthlyExpenseDigest();
  SpreadsheetApp.getUi().alert('Report Sent', 'Monthly summary was dispatched to all configured emails.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function openRoommateSheetTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Configured Members') || ss.getSheetByName('Configured Mails');
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

function refreshDashboardFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName('📱 App Dashboard');
  if (!dash) return;
  dash.getRange('B5').setFormula("=IFERROR(SUM('Expenses'!E2:E), 0)");
  dash.getRange('E5').setFormula("=IFERROR(SUMIFS('Expenses'!E2:E, 'Expenses'!B2:B, \\\">=\\\"&DATE(YEAR(TODAY()), MONTH(TODAY()), 1), 'Expenses'!B2:B, \\\"<=\\\"&EOMONTH(TODAY(), 0)), 0)");
  dash.getRange('H5').setFormula("=IFERROR(COUNTA('Expenses'!A2:A), 0)");
  dash.getRange('K5').setFormula("=IFERROR(AVERAGE('Expenses'!E2:E), 0)");
  SpreadsheetApp.getUi().alert('Dashboard Formulas Refreshed', 'KPI cards updated with live formulas.', SpreadsheetApp.getUi().ButtonSet.OK);
}
`;
