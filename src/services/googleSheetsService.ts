import { Expense, ConfiguredEmail } from '../types';
import { getAccessToken } from './googleAuth';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  lastSyncedAt?: string;
}

export const EXPENSE_HEADERS = [
  'Row ID',
  'Date 📅',
  'Spender Name 👤',
  'Spender Email ✉️',
  'Amount 💰',
  'Currency',
  'Description 📝',
  'Category 🏷️',
  'Payment Mode 💳',
  'Receipt Drive Link 📎',
  'Notes 💬',
  'Last Edited By',
  'Updated At',
];

export const CONFIG_HEADERS = [
  'Member ID',
  'Name 👤',
  'Email Address ✉️',
  'Role',
  'Notify On Add/Edit 🔔',
  'Notify Monthly Digest 📅',
  'Notify Daily Budget ⚠️',
  'Active Member ✅',
];

/**
 * Creates a brand new Google Spreadsheet in the user's Google Drive with full App Interface styling
 */
export const createExpenseSpreadsheet = async (
  title: string = `Shared Expenses Tracker (${new Date().toLocaleDateString()})`
): Promise<SpreadsheetInfo> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to create or link a Google Spreadsheet.');
  }

  // 1. Create Spreadsheet with 3 tabs: Dashboard, Expenses, Configured Members
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: '📱 App Dashboard',
            index: 0,
            gridProperties: {
              rowCount: 50,
              columnCount: 14,
            },
          },
        },
        {
          properties: {
            title: 'Expenses',
            index: 1,
            gridProperties: {
              frozenRowCount: 1,
              rowCount: 500,
              columnCount: 13,
            },
          },
        },
        {
          properties: {
            title: 'Configured Members',
            index: 2,
            gridProperties: {
              frozenRowCount: 2,
              rowCount: 100,
              columnCount: 8,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Spreadsheet: ${errText}`);
  }

  const data = await createRes.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // 2. Initialize and style as App Interface
  await applyAppTemplateToGoogleSheet(spreadsheetId, token);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
    lastSyncedAt: new Date().toISOString(),
  };
};

/**
 * Transforms an existing or newly created Google Spreadsheet into a modern App Interface:
 * - KPI Metric Cards (Total Spend, Month Spend, Transactions, Average)
 * - In-cell Data Validation Dropdowns (Category Chips, Payment Mode)
 * - Interactive Checkboxes in Configured Members
 * - Alternating Row Banding (mint/emerald)
 * - Formatted Currency ($#,##0.00) & Dates (yyyy-mm-dd)
 * - Sized Columns for mobile & desktop readability
 */
export const applyAppTemplateToGoogleSheet = async (
  spreadsheetId: string,
  providedToken?: string
): Promise<void> => {
  const token = providedToken || (await getAccessToken());
  if (!token) {
    throw new Error('Google Workspace authentication required to format Google Spreadsheet.');
  }

  // 1. Fetch metadata to retrieve sheet IDs
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    throw new Error('Could not fetch spreadsheet metadata.');
  }

  const metaData = await metaRes.json();
  const sheets: any[] = metaData.sheets || [];

  let dashSheet = sheets.find((s) => s.properties.title === '📱 App Dashboard');
  let expensesSheet = sheets.find((s) => s.properties.title === 'Expenses');
  let membersSheet =
    sheets.find((s) => s.properties.title === 'Configured Members') ||
    sheets.find((s) => s.properties.title === 'Configured Mails');

  // Add missing sheets if necessary
  const addRequests: any[] = [];
  if (!expensesSheet) {
    addRequests.push({
      addSheet: {
        properties: {
          title: 'Expenses',
          gridProperties: { frozenRowCount: 1, rowCount: 500, columnCount: 13 },
        },
      },
    });
  }
  if (!membersSheet) {
    addRequests.push({
      addSheet: {
        properties: {
          title: 'Configured Members',
          gridProperties: { frozenRowCount: 2, rowCount: 100, columnCount: 8 },
        },
      },
    });
  }
  if (!dashSheet) {
    addRequests.push({
      addSheet: {
        properties: {
          title: '📱 App Dashboard',
          index: 0,
          gridProperties: { rowCount: 50, columnCount: 14 },
        },
      },
    });
  }

  if (addRequests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addRequests }),
    });

    // Re-fetch metadata
    const reMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reMetaData = await reMetaRes.json();
    dashSheet = reMetaData.sheets.find((s: any) => s.properties.title === '📱 App Dashboard');
    expensesSheet = reMetaData.sheets.find((s: any) => s.properties.title === 'Expenses');
    membersSheet =
      reMetaData.sheets.find((s: any) => s.properties.title === 'Configured Members') ||
      reMetaData.sheets.find((s: any) => s.properties.title === 'Configured Mails');
  }

  const dashId = dashSheet?.properties.sheetId || 0;
  const expId = expensesSheet?.properties.sheetId || 1;
  const memId = membersSheet?.properties.sheetId || 2;
  const memTitle = membersSheet?.properties.title || 'Configured Members';

  // 2. Populate values and live formulas
  const dashboardValues = [
    ['✨ SHARED EXPENSE TRACKER • ROOMMATE APP DASHBOARD', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['💡 All changes in "Expenses" notify roommates automatically. Open menu "✨ Expense App" for In-Sheet App Sidebar.', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '💰 TOTAL GROUP SPEND', '', '', '📅 THIS MONTH SPEND', '', '', '🧾 TRANSACTIONS COUNT', '', '', '📊 AVERAGE PER EXPENSE', '', '', ''],
    ['', "=IFERROR(SUM('Expenses'!E2:E), 0)", '', '', "=IFERROR(SUMIFS('Expenses'!E2:E, 'Expenses'!B2:B, \">=\"&DATE(YEAR(TODAY()), MONTH(TODAY()), 1), 'Expenses'!B2:B, \"<=\"&EOMONTH(TODAY(), 0)), 0)", '', '', "=IFERROR(COUNTA('Expenses'!A2:A), 0)", '', '', "=IFERROR(AVERAGE('Expenses'!E2:E), 0)", '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '👥 SPENDING BY ROOMMATE', '', '', '', '', '', '🏷️ SPENDING BY CATEGORY', '', '', '', '', '', ''],
    ['', 'Roommate Name', 'Total Paid ($)', 'Share %', '', '', '', 'Category', 'Total Spent ($)', 'Count', '', '', '', ''],
    ['', 'Badrinath Pujari', "=IFERROR(SUMIF('Expenses'!C2:C, \"*Badrinath*\", 'Expenses'!E2:E), 0)", "=IF(B5=0, 0, C9/B5)", '', '', '', 'Groceries 🛒', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Groceries*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Groceries*\")", '', '', '', ''],
    ['', 'Roommate 1', "=IFERROR(SUMIF('Expenses'!C2:C, \"*Roommate 1*\", 'Expenses'!E2:E), 0)", "=IF(B5=0, 0, C10/B5)", '', '', '', 'Utilities ⚡', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Utilities*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Utilities*\")", '', '', '', ''],
    ['', 'Roommate 2', "=IFERROR(SUMIF('Expenses'!C2:C, \"*Roommate 2*\", 'Expenses'!E2:E), 0)", "=IF(B5=0, 0, C11/B5)", '', '', '', 'Rent 🏠', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Rent*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Rent*\")", '', '', '', ''],
    ['', 'Roommate 3', "=IFERROR(SUMIF('Expenses'!C2:C, \"*Roommate 3*\", 'Expenses'!E2:E), 0)", "=IF(B5=0, 0, C12/B5)", '', '', '', 'Dining & Food 🍕', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Dining*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Dining*\")", '', '', '', ''],
    ['', '', '', '', '', '', '', 'Household 🧼', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Household*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Household*\")", '', '', '', ''],
    ['', '', '', '', '', '', '', 'Entertainment 🎬', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Entertainment*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Entertainment*\")", '', '', '', ''],
    ['', '', '', '', '', '', '', 'Travel & Fuel 🚗', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Travel*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Travel*\")", '', '', '', ''],
    ['', '', '', '', '', '', '', 'Healthcare 💊', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Healthcare*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Healthcare*\")", '', '', '', ''],
    ['', '', '', '', '', '', '', 'Other 📦', "=IFERROR(SUMIF('Expenses'!H2:H, \"*Other*\", 'Expenses'!E2:E), 0)", "=COUNTIF('Expenses'!H2:H, \"*Other*\")", '', '', '', ''],
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: '📱 App Dashboard!A1:N17',
          values: dashboardValues,
        },
        {
          range: 'Expenses!A1:M1',
          values: [EXPENSE_HEADERS],
        },
        {
          range: `${memTitle}!A1:H1`,
          values: [['👥 ROOMMATE NOTIFICATION DIRECTORY • AUTOMATED ALERT RECIPIENTS', '', '', '', '', '', '', '']],
        },
        {
          range: `${memTitle}!A2:H2`,
          values: [CONFIG_HEADERS],
        },
      ],
    }),
  });

  // 3. Batch Update Formatting: Colors, Borders, Dropdowns, Checkboxes, Dimensions
  const formatRequests: any[] = [
    // --- EXPENSES SHEET ---
    // Column widths in Expenses
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 90 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 115 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 160 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 200 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
        properties: { pixelSize: 120 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 },
        properties: { pixelSize: 80 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
        properties: { pixelSize: 220 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 },
        properties: { pixelSize: 160 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
        properties: { pixelSize: 160 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 },
        properties: { pixelSize: 180 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 },
        properties: { pixelSize: 180 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: expId, dimension: 'COLUMNS', startIndex: 11, endIndex: 13 },
        properties: { pixelSize: 160 },
        fields: 'pixelSize',
      },
    },
    // Header row styling in Expenses (Deep emerald background, bold white text)
    {
      repeatCell: {
        range: { sheetId: expId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 13 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.02, green: 0.37, blue: 0.28 },
            textFormat: { foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Data Validation: Category Dropdown Chips (Column H, index 7)
    {
      setDataValidation: {
        range: { sheetId: expId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 7, endColumnIndex: 8 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Groceries 🛒' },
              { userEnteredValue: 'Utilities ⚡' },
              { userEnteredValue: 'Rent 🏠' },
              { userEnteredValue: 'Dining & Food 🍕' },
              { userEnteredValue: 'Household 🧼' },
              { userEnteredValue: 'Entertainment 🎬' },
              { userEnteredValue: 'Travel & Fuel 🚗' },
              { userEnteredValue: 'Healthcare 💊' },
              { userEnteredValue: 'Other 📦' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
    // Data Validation: Payment Mode Dropdown Chips (Column I, index 8)
    {
      setDataValidation: {
        range: { sheetId: expId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 8, endColumnIndex: 9 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'UPI / Online 📱' },
              { userEnteredValue: 'Credit Card 💳' },
              { userEnteredValue: 'Debit Card 💳' },
              { userEnteredValue: 'Cash 💵' },
              { userEnteredValue: 'Bank Transfer 🏦' },
              { userEnteredValue: 'Splitwise ⚖️' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
    // Number format: Amount Column (Column E, index 4) -> $#,##0.00
    {
      repeatCell: {
        range: { sheetId: expId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 4, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    },
    // Number format: Date Column (Column B, index 1) -> yyyy-mm-dd
    {
      repeatCell: {
        range: { sheetId: expId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    },

    // --- APP DASHBOARD TAB FORMATTING ---
    // Merge Header Title (A1:N1)
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 }, // Slate 900
            textFormat: { foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true, fontSize: 13 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Merge Subtitle (A2:N2)
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 14 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 14 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
            textFormat: { foregroundColor: { red: 0.28, green: 0.33, blue: 0.41 }, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    // Merge KPI Card Headers & Values
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 4 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 4 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 4, endColumnIndex: 7 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 4, endColumnIndex: 7 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 7, endColumnIndex: 10 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 7, endColumnIndex: 10 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 10, endColumnIndex: 13 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 10, endColumnIndex: 13 },
        mergeType: 'MERGE_ALL',
      },
    },
    // KPI Card 1 Style (Mint Green)
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.93, green: 0.99, blue: 0.96 },
            textFormat: { foregroundColor: { red: 0.02, green: 0.47, blue: 0.34 }, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
            textFormat: { fontSize: 16, bold: true },
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat)',
      },
    },
    // KPI Card 2 Style (Sky Blue)
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 4, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.94, green: 0.98, blue: 1.0 },
            textFormat: { foregroundColor: { red: 0.01, green: 0.41, blue: 0.63 }, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 4, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
            textFormat: { fontSize: 16, bold: true },
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat)',
      },
    },
    // KPI Card 3 Style (Purple)
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 7, endColumnIndex: 10 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.98, green: 0.96, blue: 1.0 },
            textFormat: { foregroundColor: { red: 0.49, green: 0.13, blue: 0.81 }, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 7, endColumnIndex: 10 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'NUMBER', pattern: '#,##0' },
            textFormat: { fontSize: 16, bold: true },
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat)',
      },
    },
    // KPI Card 4 Style (Amber)
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 10, endColumnIndex: 13 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1.0, green: 0.98, blue: 0.92 },
            textFormat: { foregroundColor: { red: 0.71, green: 0.33, blue: 0.04 }, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 10, endColumnIndex: 13 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
            textFormat: { fontSize: 16, bold: true },
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat)',
      },
    },

    // --- CONFIGURED MEMBERS TAB FORMATTING ---
    // Checkbox Data Validation on columns E, F, G, H (indexes 4, 5, 6, 7)
    {
      setDataValidation: {
        range: { sheetId: memId, startRowIndex: 2, endRowIndex: 50, startColumnIndex: 4, endColumnIndex: 8 },
        rule: {
          condition: { type: 'BOOLEAN' },
          showCustomUi: true,
        },
      },
    },
    // Header styling on Configured Members (Slate 800)
    {
      repeatCell: {
        range: { sheetId: memId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
            textFormat: { foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
  ];

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: formatRequests }),
    });
  } catch (err) {
    console.warn('Batch format update warning:', err);
  }

  // 4. Try adding Banding (Alternating row colors) safely
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addBanding: {
              bandedRange: {
                range: {
                  sheetId: expId,
                  startRowIndex: 0,
                  endRowIndex: 500,
                  startColumnIndex: 0,
                  endColumnIndex: 13,
                },
                rowProperties: {
                  headerColor: { red: 0.02, green: 0.37, blue: 0.28 },
                  firstBandColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  secondBandColor: { red: 0.94, green: 0.99, blue: 0.96 },
                },
              },
            },
          },
        ],
      }),
    });
  } catch {
    // Banding may already exist
  }
};

/**
 * Append single expense to Google Sheet
 */
export const appendExpenseToGoogleSheet = async (
  spreadsheetId: string,
  expense: Expense
): Promise<void> => {
  const token = await getAccessToken();
  if (!token) return;

  const rowValues = [
    expense.id,
    expense.date,
    expense.spenderName,
    expense.spenderEmail,
    expense.amount,
    expense.currency,
    expense.description || '',
    expense.category || '',
    expense.paymentMode || '',
    expense.receiptImage || '',
    expense.notes || '',
    expense.lastEditedBy,
    expense.updatedAt,
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A:M:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Google Sheet append error:', err);
  }
};

/**
 * Update cell or row in Google Sheet
 */
export const updateExpenseInGoogleSheet = async (
  spreadsheetId: string,
  rowIndex: number,
  expense: Expense
): Promise<void> => {
  const token = await getAccessToken();
  if (!token) return;

  const actualRow = rowIndex + 2; // +1 for 0-indexed, +1 for header
  const rowValues = [
    expense.id,
    expense.date,
    expense.spenderName,
    expense.spenderEmail,
    expense.amount,
    expense.currency,
    expense.description || '',
    expense.category || '',
    expense.paymentMode || '',
    expense.receiptImage || '',
    expense.notes || '',
    expense.lastEditedBy,
    expense.updatedAt,
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A${actualRow}:M${actualRow}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );
};

/**
 * Bulk sync all local expenses and configured emails to Google Sheet
 */
export const syncAllExpensesToGoogleSheet = async (
  spreadsheetId: string,
  expenses: Expense[],
  configuredEmails: ConfiguredEmail[]
): Promise<void> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Workspace authentication required to sync with Google Sheets.');
  }

  const expenseRows = expenses.map((e) => [
    e.id,
    e.date,
    e.spenderName,
    e.spenderEmail,
    e.amount,
    e.currency,
    e.description || '',
    e.category || '',
    e.paymentMode || '',
    e.receiptImage || '',
    e.notes || '',
    e.lastEditedBy,
    e.updatedAt,
  ]);

  const configRows = configuredEmails.map((c) => [
    c.id,
    c.name,
    c.email,
    c.role,
    c.notifyOnAddEdit ? true : false,
    c.notifyMonthlyDigest ? true : false,
    c.notifyDailyBudget ? true : false,
    c.active ? true : false,
  ]);

  // Determine Configured tab title
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let memTitle = 'Configured Members';
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const existing = metaData.sheets?.find((s: any) => s.properties.title === 'Configured Mails');
    if (existing) {
      memTitle = 'Configured Mails';
    }
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'Expenses!A1:M1',
            values: [EXPENSE_HEADERS],
          },
          {
            range: `Expenses!A2:M${Math.max(2, expenseRows.length + 1)}`,
            values: expenseRows.length > 0 ? expenseRows : [['', '', '', '', '', '', '', '', '', '', '', '', '']],
          },
          {
            range: `${memTitle}!A2:H2`,
            values: [CONFIG_HEADERS],
          },
          {
            range: `${memTitle}!A3:H${Math.max(3, configRows.length + 2)}`,
            values: configRows.length > 0 ? configRows : [['', '', '', '', false, false, false, false]],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sync to Google Sheets failed: ${err}`);
  }

  // Ensure app template formatting is applied
  try {
    await applyAppTemplateToGoogleSheet(spreadsheetId, token);
  } catch (e) {
    console.warn('Template styling skipped during sync:', e);
  }
};

/**
 * Read expenses from Google Sheet
 */
export const fetchExpensesFromGoogleSheet = async (
  spreadsheetId: string
): Promise<Expense[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Workspace authentication required to read Google Sheets.');
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A2:M500`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch expenses from Google Sheet: ${err}`);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows
    .filter((r) => r.length > 0 && r[0]) // row must have ID or data
    .map((row, idx) => ({
      id: row[0] || `sheet-exp-${idx + 1}`,
      rowNumber: idx + 1,
      date: row[1] || new Date().toISOString().split('T')[0],
      spenderName: row[2] || 'Team Member',
      spenderEmail: row[3] || '',
      amount: Number(row[4]) || 0,
      currency: row[5] || '$',
      description: row[6] || '',
      category: row[7] || 'Other 📦',
      paymentMode: row[8] || 'UPI / Online 📱',
      receiptImage: row[9] || undefined,
      notes: row[10] || undefined,
      lastEditedBy: row[11] || 'Google Sheet Sync',
      createdAt: row[12] || new Date().toISOString(),
      updatedAt: row[12] || new Date().toISOString(),
    }));
};
