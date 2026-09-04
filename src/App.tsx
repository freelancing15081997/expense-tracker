import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileSpreadsheet, 
  BarChart3, 
  Mail, 
  Bell, 
  Plus, 
  User, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Smartphone,
  Info
} from 'lucide-react';

import { 
  Expense, 
  ConfiguredEmail, 
  DailyBudgetSettings, 
  SentNotification, 
  ConfirmationModalState 
} from './types';
import { 
  initialExpenses, 
  initialConfiguredEmails, 
  initialDailyBudgetSettings, 
  initialSentNotifications 
} from './data/initialData';
import { 
  createAddExpenseAlert, 
  createEditExpenseAlert, 
  createDeleteExpenseAlert, 
  generateMonthlyDigest, 
  createDailyBudgetAlert, 
  playNotificationChime, 
  sendBrowserPushNotification,
  formatCurrency
} from './services/notificationEngine';

import { GoogleSheetView } from './components/GoogleSheetView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { ConfiguredEmailsSheet } from './components/ConfiguredEmailsSheet';
import { DailyBudgetReminders } from './components/DailyBudgetReminders';
import { MobileExpenseForm } from './components/MobileExpenseForm';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ReceiptModal } from './components/ReceiptModal';
import { NotificationOutboxModal } from './components/NotificationOutboxModal';
import { GoogleWorkspaceBar } from './components/GoogleWorkspaceBar';
import { InviteRoommateModal } from './components/InviteRoommateModal';
import { AppsScriptModal } from './components/AppsScriptModal';

import { User as FirebaseUser } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  isGoogleConnected,
  getCurrentUser
} from './services/googleAuth';
import { 
  SpreadsheetInfo, 
  createExpenseSpreadsheet, 
  appendExpenseToGoogleSheet, 
  updateExpenseInGoogleSheet, 
  syncAllExpensesToGoogleSheet, 
  fetchExpensesFromGoogleSheet,
  applyAppTemplateToGoogleSheet
} from './services/googleSheetsService';
import { uploadReceiptImageToDrive } from './services/googleDriveService';
import { sendGmailEmail } from './services/gmailService';

type ActiveTab = 'SHEET' | 'DASHBOARD' | 'EMAILS' | 'REMINDERS';

export default function App() {
  // 1. Persistent State with LocalStorage
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('sheet_expenses_v2');
    return saved ? JSON.parse(saved) : initialExpenses;
  });

  const [configuredEmails, setConfiguredEmails] = useState<ConfiguredEmail[]>(() => {
    const saved = localStorage.getItem('sheet_configured_emails_v2');
    return saved ? JSON.parse(saved) : initialConfiguredEmails;
  });

  const [budgetSettings, setBudgetSettings] = useState<DailyBudgetSettings>(() => {
    const saved = localStorage.getItem('sheet_budget_settings_v2');
    return saved ? JSON.parse(saved) : initialDailyBudgetSettings;
  });

  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>(() => {
    const saved = localStorage.getItem('sheet_sent_notifications_v2');
    return saved ? JSON.parse(saved) : initialSentNotifications;
  });

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('SHEET');

  // Active Spender (User Identity)
  const [currentSpenderName, setCurrentSpenderName] = useState<string>('Badrinath Pujari');

  // Google Workspace States
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(() => {
    const saved = localStorage.getItem('sheet_google_spreadsheet_info');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (spreadsheetInfo) {
      localStorage.setItem('sheet_google_spreadsheet_info', JSON.stringify(spreadsheetInfo));
    } else {
      localStorage.removeItem('sheet_google_spreadsheet_info');
    }
  }, [spreadsheetInfo]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        if (user.displayName) {
          setCurrentSpenderName(user.displayName);
        }
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formInitialData, setFormInitialData] = useState<Expense | null>(null);
  const [isOutboxOpen, setIsOutboxOpen] = useState<boolean>(false);
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; title: string } | null>(null);
  const [isInviteRoommateOpen, setIsInviteRoommateOpen] = useState<boolean>(false);
  const [isAppsScriptModalOpen, setIsAppsScriptModalOpen] = useState<boolean>(false);

  // In-Sheet Confirmation Dialog State
  const [confirmationState, setConfirmationState] = useState<ConfirmationModalState>({
    isOpen: false,
    actionType: 'ADD',
    title: '',
    description: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Live Toast Banner
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    title: string;
    description: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  // Save to LocalStorage on updates
  useEffect(() => {
    localStorage.setItem('sheet_expenses_v2', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('sheet_configured_emails_v2', JSON.stringify(configuredEmails));
  }, [configuredEmails]);

  useEffect(() => {
    localStorage.setItem('sheet_budget_settings_v2', JSON.stringify(budgetSettings));
  }, [budgetSettings]);

  useEffect(() => {
    localStorage.setItem('sheet_sent_notifications_v2', JSON.stringify(sentNotifications));
  }, [sentNotifications]);

  // Show Toast Helper
  const showToast = (title: string, description: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({
      id: Date.now(),
      title,
      description,
      type,
    });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.title === title ? null : prev));
    }, 4500);
  };

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // Ignored if canvas-confetti is not available
    }
  };

  // ==========================================
  // GOOGLE WORKSPACE HANDLERS
  // ==========================================
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { user } = await googleSignIn();
      setGoogleUser(user);
      if (user.displayName) setCurrentSpenderName(user.displayName);
      showToast(
        'Connected to Google Workspace',
        `Signed in as ${user.email}. Sheets, Drive & Gmail APIs are active!`,
        'success'
      );
      triggerConfetti();
    } catch (err: any) {
      showToast('Google Sign-In Failed', err.message || 'Authentication error', 'warning');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    showToast('Signed Out', 'Disconnected from Google Workspace.', 'info');
  };

  const handleCreateSpreadsheet = async () => {
    setIsSyncing(true);
    try {
      showToast('Creating Spreadsheet...', 'Initializing Google Sheet in Drive with styled tabs...', 'info');
      const info = await createExpenseSpreadsheet();
      setSpreadsheetInfo(info);
      await syncAllExpensesToGoogleSheet(info.spreadsheetId, expenses, configuredEmails);
      showToast(
        'Google Sheet Created!',
        `Created "${info.title}" and pushed all ${expenses.length} records.`,
        'success'
      );
      triggerConfetti();
    } catch (err: any) {
      showToast('Spreadsheet Creation Failed', err.message || 'Could not create Google Sheet.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectExistingSpreadsheet = async (sheetId: string) => {
    setIsSyncing(true);
    try {
      const info: SpreadsheetInfo = {
        spreadsheetId: sheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
        title: 'Linked Google Spreadsheet',
        lastSyncedAt: new Date().toISOString(),
      };
      setSpreadsheetInfo(info);
      showToast('Connected to Existing Sheet', `Linked spreadsheet ID: ${sheetId}.`, 'success');
    } catch (err: any) {
      showToast('Connection Failed', err.message || 'Could not link spreadsheet.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncToSheets = async () => {
    if (!spreadsheetInfo) return;
    setIsSyncing(true);
    try {
      await syncAllExpensesToGoogleSheet(spreadsheetInfo.spreadsheetId, expenses, configuredEmails);
      setSpreadsheetInfo((prev) => prev ? { ...prev, lastSyncedAt: new Date().toISOString() } : null);
      showToast(
        'Synced with Google Sheet',
        `Pushed ${expenses.length} rows and ${configuredEmails.length} member emails directly to Google Sheets!`,
        'success'
      );
      triggerConfetti();
    } catch (err: any) {
      showToast('Sync Failed', err.message || 'Error syncing with Google Sheets.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSheets = async () => {
    if (!spreadsheetInfo) return;
    setIsSyncing(true);
    try {
      const pulledExpenses = await fetchExpensesFromGoogleSheet(spreadsheetInfo.spreadsheetId);
      if (pulledExpenses.length > 0) {
        setExpenses(pulledExpenses);
        showToast(
          'Pulled from Google Sheet',
          `Loaded ${pulledExpenses.length} expense rows directly from your Google Sheet!`,
          'success'
        );
      } else {
        showToast('Google Sheet is Empty', 'No expense rows found in the sheet.', 'info');
      }
    } catch (err: any) {
      showToast('Pull Failed', err.message || 'Error reading Google Sheet data.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplyAppTemplate = async () => {
    if (!spreadsheetInfo) return;
    setIsSyncing(true);
    try {
      showToast('Styling Google Sheet...', 'Applying modern App Dashboard, KPI cards, and dropdown chips...', 'info');
      await applyAppTemplateToGoogleSheet(spreadsheetInfo.spreadsheetId);
      showToast(
        'App Template Applied!',
        'Your Google Sheet now has a modern App Dashboard, live KPI formulas, dropdowns, and checkboxes!',
        'success'
      );
      triggerConfetti();
    } catch (err: any) {
      showToast('Template Styling Failed', err.message || 'Error styling Google Sheet.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // ADD EXPENSE (With In-Sheet Confirmation Popup)
  // ==========================================
  const handleAddExpenseRequest = (
    expenseData: Omit<Expense, 'id' | 'rowNumber' | 'createdAt' | 'updatedAt' | 'lastEditedBy'>,
    isEditing?: boolean
  ) => {
    if (isEditing && formInitialData) {
      // Handle edit via form
      handleEditExpenseRequest(formInitialData, expenseData);
      return;
    }

    // Prepare In-Sheet Confirmation Popup
    setConfirmationState({
      isOpen: true,
      actionType: 'ADD',
      title: 'Confirm Adding Expense to Shared Sheet',
      description: `Are you sure you want to log an expense of ${formatCurrency(expenseData.amount, expenseData.currency)} for "${expenseData.description || 'General Expense'}"?${spreadsheetInfo ? ' This will immediately sync to your linked Google Spreadsheet.' : ''}`,
      details: {
        field: 'New Row Record',
        summary: `Spender: ${expenseData.spenderName} • Category: ${expenseData.category || 'None'} • Mode: ${expenseData.paymentMode || 'Standard'} • Proof: ${expenseData.receiptImage ? 'Attached (will upload to Google Drive)' : 'None'} • Alert Recipients: ${configuredEmails.filter((c) => c.active && c.notifyOnAddEdit).length} active emails`,
      },
      onConfirm: async () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
        setIsFormOpen(false);

        let finalReceipt = expenseData.receiptImage;
        // If receipt image is present and Google Workspace is connected, upload to Drive
        if (finalReceipt && isGoogleConnected()) {
          try {
            showToast('Saving to Drive...', 'Uploading receipt proof to Google Drive folder...', 'info');
            const driveUpload = await uploadReceiptImageToDrive(finalReceipt, `Receipt_${Date.now()}.png`);
            finalReceipt = driveUpload.webViewLink;
          } catch (uploadErr) {
            console.warn('Google Drive receipt upload fallback:', uploadErr);
          }
        }

        const newId = `exp-${Date.now()}`;
        const newRowNumber = expenses.length + 1;
        const now = new Date().toISOString();

        const newExpense: Expense = {
          ...expenseData,
          receiptImage: finalReceipt,
          id: newId,
          rowNumber: newRowNumber,
          createdAt: now,
          updatedAt: now,
          lastEditedBy: currentSpenderName,
        };

        setExpenses((prev) => [newExpense, ...prev]);

        // Sync to connected Google Sheet
        if (spreadsheetInfo) {
          appendExpenseToGoogleSheet(spreadsheetInfo.spreadsheetId, newExpense).catch((err) => {
            console.error('Failed to append to Google Sheet:', err);
          });
        }

        // Dispatch Email Notification to All Configured Mails
        const notification = createAddExpenseAlert(newExpense, configuredEmails, currentSpenderName);

        // Send via live Gmail API if authenticated
        if (isGoogleConnected() && notification.recipients.length > 0) {
          try {
            const gmailResult = await sendGmailEmail({
              recipients: notification.recipients,
              subject: notification.subject,
              htmlBody: notification.htmlBody,
            });
            if (gmailResult.success) {
              notification.status = 'delivered';
              notification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
            } else {
              notification.deliveryNotes = `Gmail API: ${gmailResult.error}`;
            }
          } catch (gErr: any) {
            console.error('Gmail send error:', gErr);
          }
        }

        setSentNotifications((prev) => [notification, ...prev]);
        playNotificationChime();
        triggerConfetti();
        showToast(
          'Expense Added & Broadcasted',
          `Dispatched ${notification.status === 'delivered' ? 'live Gmail' : 'notification'} alert to ${notification.recipients.length} configured members!`,
          'success'
        );
      },
      onCancel: () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ==========================================
  // EDIT CELL DIRECTLY IN SHEET (With Confirmation Popup)
  // ==========================================
  const handleEditCellDirectly = (
    expenseId: string,
    field: keyof Expense,
    oldValue: any,
    newValue: any,
    coordinate: string
  ) => {
    const targetExp = expenses.find((e) => e.id === expenseId);
    if (!targetExp) return;

    // Show in-sheet confirmation dialog before saving cell update
    setConfirmationState({
      isOpen: true,
      actionType: 'EDIT',
      title: `Confirm Modifying Cell ${coordinate}`,
      description: `You are about to change the ${String(field)} on row #${targetExp.rowNumber}. Do you want to save this change and notify all configured members?`,
      details: {
        field: `${coordinate} (${String(field)})`,
        oldValue,
        newValue,
        summary: `Expense: "${targetExp.description || 'Expense'}" by ${targetExp.spenderName}${spreadsheetInfo ? ' • Will update Google Spreadsheet cell' : ''}`,
      },
      onConfirm: async () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));

        const updatedExp: Expense = {
          ...targetExp,
          [field]: newValue,
          updatedAt: new Date().toISOString(),
          lastEditedBy: currentSpenderName,
        };

        const updatedList = expenses.map((e) => (e.id === expenseId ? updatedExp : e));
        setExpenses(updatedList);

        // Update in Google Sheet
        if (spreadsheetInfo) {
          const expIndex = expenses.findIndex((e) => e.id === expenseId);
          if (expIndex !== -1) {
            updateExpenseInGoogleSheet(spreadsheetInfo.spreadsheetId, expIndex, updatedExp).catch((err) => {
              console.error('Failed to update cell in Google Sheet:', err);
            });
          }
        }

        // Dispatch email notification to all members
        const changeSummary = `Changed ${String(field)} from "${oldValue}" to "${newValue}" in cell ${coordinate}.`;
        const notification = createEditExpenseAlert(
          targetExp,
          updatedExp,
          configuredEmails,
          currentSpenderName,
          changeSummary
        );

        // Send via live Gmail API if authenticated
        if (isGoogleConnected() && notification.recipients.length > 0) {
          try {
            const gmailResult = await sendGmailEmail({
              recipients: notification.recipients,
              subject: notification.subject,
              htmlBody: notification.htmlBody,
            });
            if (gmailResult.success) {
              notification.status = 'delivered';
              notification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
            }
          } catch (gErr: any) {
            console.error('Gmail send error:', gErr);
          }
        }

        setSentNotifications((prev) => [notification, ...prev]);

        playNotificationChime();
        showToast(
          'Sheet Cell Updated',
          `Cell ${coordinate} updated. Email change alert sent to ${notification.recipients.length} configured emails.`,
          'info'
        );
      },
      onCancel: () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Edit via Form
  const handleEditExpenseRequest = (
    originalExp: Expense,
    updatedData: Omit<Expense, 'id' | 'rowNumber' | 'createdAt' | 'updatedAt' | 'lastEditedBy'>
  ) => {
    setConfirmationState({
      isOpen: true,
      actionType: 'EDIT',
      title: `Confirm Editing Expense #${originalExp.rowNumber}`,
      description: `Save updates for "${originalExp.description || 'Expense'}" (${formatCurrency(originalExp.amount, originalExp.currency)} → ${formatCurrency(updatedData.amount, updatedData.currency)})?`,
      details: {
        field: `Row #${originalExp.rowNumber}`,
        oldValue: `${formatCurrency(originalExp.amount, originalExp.currency)} (${originalExp.category || 'No category'})`,
        newValue: `${formatCurrency(updatedData.amount, updatedData.currency)} (${updatedData.category || 'No category'})`,
      },
      onConfirm: async () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
        setIsFormOpen(false);
        setFormInitialData(null);

        let finalReceipt = updatedData.receiptImage;
        if (finalReceipt && finalReceipt !== originalExp.receiptImage && isGoogleConnected()) {
          try {
            showToast('Saving to Drive...', 'Uploading updated receipt to Google Drive...', 'info');
            const driveUpload = await uploadReceiptImageToDrive(finalReceipt, `Receipt_${Date.now()}.png`);
            finalReceipt = driveUpload.webViewLink;
          } catch (e) {
            console.warn('Drive receipt upload fallback:', e);
          }
        }

        const updatedExpense: Expense = {
          ...originalExp,
          ...updatedData,
          receiptImage: finalReceipt,
          updatedAt: new Date().toISOString(),
          lastEditedBy: currentSpenderName,
        };

        const updatedList = expenses.map((e) => (e.id === originalExp.id ? updatedExpense : e));
        setExpenses(updatedList);

        if (spreadsheetInfo) {
          const expIndex = expenses.findIndex((e) => e.id === originalExp.id);
          if (expIndex !== -1) {
            updateExpenseInGoogleSheet(spreadsheetInfo.spreadsheetId, expIndex, updatedExpense).catch((err) => {
              console.error('Failed to update Google Sheet row:', err);
            });
          }
        }

        const notification = createEditExpenseAlert(
          originalExp,
          updatedExpense,
          configuredEmails,
          currentSpenderName,
          'Full record updated via standard mobile form.'
        );

        if (isGoogleConnected() && notification.recipients.length > 0) {
          try {
            const gmailResult = await sendGmailEmail({
              recipients: notification.recipients,
              subject: notification.subject,
              htmlBody: notification.htmlBody,
            });
            if (gmailResult.success) {
              notification.status = 'delivered';
              notification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
            }
          } catch (gErr: any) {
            console.error('Gmail send error:', gErr);
          }
        }

        setSentNotifications((prev) => [notification, ...prev]);

        playNotificationChime();
        showToast(
          'Record Updated & Notified',
          `Dispatched live modification alert to ${notification.recipients.length} configured members.`,
          'info'
        );
      },
      onCancel: () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ==========================================
  // DELETE EXPENSE (With In-Sheet Confirmation Popup)
  // ==========================================
  const handleDeleteExpense = (exp: Expense) => {
    setConfirmationState({
      isOpen: true,
      actionType: 'DELETE',
      title: `Confirm Deleting Expense Record #${exp.rowNumber}`,
      description: `Are you sure you want to permanently delete this expense of ${formatCurrency(exp.amount, exp.currency)} for "${exp.description || 'Expense'}"?${spreadsheetInfo ? ' This will update your Google Sheet.' : ''}`,
      details: {
        field: `Row #${exp.rowNumber}`,
        summary: `Spender: ${exp.spenderName} • Date: ${exp.date} • Category: ${exp.category}`,
      },
      onConfirm: async () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));

        const filtered = expenses.filter((e) => e.id !== exp.id);
        setExpenses(filtered);

        if (spreadsheetInfo) {
          syncAllExpensesToGoogleSheet(spreadsheetInfo.spreadsheetId, filtered, configuredEmails).catch((err) => {
            console.error('Failed to sync deletion to Google Sheet:', err);
          });
        }

        const notification = createDeleteExpenseAlert(exp, configuredEmails, currentSpenderName);

        if (isGoogleConnected() && notification.recipients.length > 0) {
          try {
            const gmailResult = await sendGmailEmail({
              recipients: notification.recipients,
              subject: notification.subject,
              htmlBody: notification.htmlBody,
            });
            if (gmailResult.success) {
              notification.status = 'delivered';
              notification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
            }
          } catch (gErr: any) {
            console.error('Gmail send error:', gErr);
          }
        }

        setSentNotifications((prev) => [notification, ...prev]);

        playNotificationChime();
        showToast(
          'Record Deleted',
          `Removed expense #${exp.rowNumber}. Audit notification dispatched to team.`,
          'warning'
        );
      },
      onCancel: () => {
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ==========================================
  // TRIGGER AUTOMATED MONTHLY NOTIFICATION
  // ==========================================
  const handleTriggerMonthlyDigest = async () => {
    const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const digestNotification = generateMonthlyDigest(
      expenses,
      configuredEmails,
      budgetSettings,
      currentMonthName
    );

    if (isGoogleConnected() && digestNotification.recipients.length > 0) {
      try {
        const gmailResult = await sendGmailEmail({
          recipients: digestNotification.recipients,
          subject: digestNotification.subject,
          htmlBody: digestNotification.htmlBody,
        });
        if (gmailResult.success) {
          digestNotification.status = 'delivered';
          digestNotification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
        }
      } catch (gErr: any) {
        console.error('Gmail send error:', gErr);
      }
    }

    setSentNotifications((prev) => [digestNotification, ...prev]);
    playNotificationChime();
    triggerConfetti();

    sendBrowserPushNotification(
      '📅 Monthly Expense Digest Generated',
      `Monthly report dispatched to ${digestNotification.recipients.length} configured emails!`
    );

    showToast(
      'Automated Monthly Digest Dispatched',
      `Generated full financial digest and dispatched ${digestNotification.status === 'delivered' ? 'via Gmail' : ''} to ${digestNotification.recipients.length} configured emails.`,
      'success'
    );
  };

  // ==========================================
  // TRIGGER TEST CHANGE ALERT
  // ==========================================
  const handleTriggerTestAlert = async () => {
    if (expenses.length === 0) return;
    const sampleExp = expenses[0];
    const alertNotification = createAddExpenseAlert(
      sampleExp,
      configuredEmails,
      currentSpenderName
    );
    alertNotification.subject = `🔔 Test Broadcast: ${alertNotification.subject}`;

    if (isGoogleConnected() && alertNotification.recipients.length > 0) {
      try {
        const gmailResult = await sendGmailEmail({
          recipients: alertNotification.recipients,
          subject: alertNotification.subject,
          htmlBody: alertNotification.htmlBody,
        });
        if (gmailResult.success) {
          alertNotification.status = 'delivered';
          alertNotification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
        }
      } catch (gErr: any) {
        console.error('Gmail send error:', gErr);
      }
    }

    setSentNotifications((prev) => [alertNotification, ...prev]);
    playNotificationChime();

    showToast(
      'Test Alert Sent',
      `Delivered test email notification to ${alertNotification.recipients.length} configured addresses.`,
      'info'
    );
  };

  // ==========================================
  // TRIGGER DAILY BUDGET ALERT
  // ==========================================
  const handleTriggerDailyBudgetAlert = async (todaySpend: number) => {
    const alertNotification = createDailyBudgetAlert(
      todaySpend,
      budgetSettings.dailyLimit,
      budgetSettings.currency,
      configuredEmails
    );

    if (isGoogleConnected() && alertNotification.recipients.length > 0) {
      try {
        const gmailResult = await sendGmailEmail({
          recipients: alertNotification.recipients,
          subject: alertNotification.subject,
          htmlBody: alertNotification.htmlBody,
        });
        if (gmailResult.success) {
          alertNotification.status = 'delivered';
          alertNotification.deliveryNotes = `Dispatched via Gmail API (Message ID: ${gmailResult.messageId})`;
        }
      } catch (gErr: any) {
        console.error('Gmail send error:', gErr);
      }
    }

    setSentNotifications((prev) => [alertNotification, ...prev]);
    playNotificationChime();

    showToast(
      'Daily Budget Check-in Triggered',
      `Daily status push and email alert broadcasted to configured members.`,
      'info'
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Top Global Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                  Shared Sheet Expense Tracker
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Google Sheet Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Collaborative spreadsheet with automated mail digests, instant edit alerts & proof receipts
              </p>
            </div>
          </div>

          {/* User Spender Switcher & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active User Switcher */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <span className="text-slate-500 hidden sm:inline mr-1 text-[11px]">Active Spender:</span>
              <select
                id="select-active-spender"
                value={currentSpenderName}
                onChange={(e) => setCurrentSpenderName(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
              >
                {configuredEmails.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notification Bell / Sent Mails */}
            <button
              id="btn-open-notifications-bell"
              onClick={() => setIsOutboxOpen(true)}
              className="relative p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
              title="View Sent Mails & Alerts Audit Log"
            >
              <Bell className="w-4 h-4" />
              {sentNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                  {sentNotifications.length > 9 ? '9+' : sentNotifications.length}
                </span>
              )}
            </button>

            {/* Mobile Form Trigger Button */}
            <button
              id="btn-nav-add-expense"
              onClick={() => {
                setFormInitialData(null);
                setIsFormOpen(true);
              }}
              className="px-3 sm:px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* 2. Google Sheet Styled View Tabs */}
        <div className="bg-slate-50 border-t border-slate-200 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-thin text-xs py-1">
            <button
              id="tab-sheet"
              onClick={() => setActiveTab('SHEET')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === 'SHEET'
                  ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>📊 Spreadsheet Grid</span>
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[10px] font-mono">
                {expenses.length}
              </span>
            </button>

            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('DASHBOARD')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === 'DASHBOARD'
                  ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>📈 Reporting Dashboard & Trends</span>
            </button>

            <button
              id="tab-emails"
              onClick={() => setActiveTab('EMAILS')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === 'EMAILS'
                  ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <Mail className="w-4 h-4 text-emerald-600" />
              <span>⚙️ Configured Mails Sheet</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-mono">
                {configuredEmails.filter((c) => c.active).length}
              </span>
            </button>

            <button
              id="tab-reminders"
              onClick={() => setActiveTab('REMINDERS')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === 'REMINDERS'
                  ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4 text-emerald-600" />
              <span>🔔 Daily Budget Push Alerts</span>
            </button>
          </div>
        </div>
      </header>

      {/* Google Workspace Live Cloud Sync Bar */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4">
        <GoogleWorkspaceBar
          user={googleUser}
          spreadsheetInfo={spreadsheetInfo}
          isLoggingIn={isLoggingIn}
          isSyncing={isSyncing}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onConnectExisting={handleConnectExistingSpreadsheet}
          onSyncToSheets={handleSyncToSheets}
          onPullFromSheets={handlePullFromSheets}
          onApplyAppTemplate={handleApplyAppTemplate}
          onOpenInviteRoommates={() => setIsInviteRoommateOpen(true)}
          onOpenAppsScript={() => setIsAppsScriptModalOpen(true)}
        />
      </div>

      {/* 3. Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {activeTab === 'SHEET' && (
          <GoogleSheetView
            expenses={expenses}
            configuredEmails={configuredEmails}
            currentSpenderName={currentSpenderName}
            spreadsheetInfo={spreadsheetInfo}
            onAddDirectlyInSheet={(newExpense) => handleAddExpenseRequest(newExpense, false)}
            onEditCellDirectly={handleEditCellDirectly}
            onDeleteExpense={handleDeleteExpense}
            onOpenMobileForm={(exp) => {
              setFormInitialData(exp || null);
              setIsFormOpen(true);
            }}
            onViewReceipt={(url, title) => setViewingReceipt({ url, title })}
          />
        )}

        {activeTab === 'DASHBOARD' && (
          <DashboardAnalytics
            expenses={expenses}
            budgetSettings={budgetSettings}
            onOpenAddExpense={() => {
              setFormInitialData(null);
              setIsFormOpen(true);
            }}
          />
        )}

        {activeTab === 'EMAILS' && (
          <ConfiguredEmailsSheet
            configuredEmails={configuredEmails}
            onAddEmail={(newCfg) => {
              const created: ConfiguredEmail = {
                ...newCfg,
                id: `cfg-${Date.now()}`,
                addedAt: new Date().toISOString().split('T')[0],
              };
              setConfiguredEmails((prev) => [...prev, created]);
              showToast('Recipient Added', `${created.name} (${created.email}) added to configured notifications sheet.`);
            }}
            onUpdateEmail={(id, updates) => {
              setConfiguredEmails((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
              );
              showToast('Settings Updated', 'Notification preferences updated for recipient.');
            }}
            onDeleteEmail={(id) => {
              setConfiguredEmails((prev) => prev.filter((c) => c.id !== id));
              showToast('Recipient Removed', 'Removed email recipient from notifications list.');
            }}
            onTriggerMonthlyDigest={handleTriggerMonthlyDigest}
            onTriggerTestAlert={handleTriggerTestAlert}
            onOpenOutbox={() => setIsOutboxOpen(true)}
          />
        )}

        {activeTab === 'REMINDERS' && (
          <DailyBudgetReminders
            settings={budgetSettings}
            expenses={expenses}
            onUpdateSettings={(newSettings) => {
              setBudgetSettings((prev) => ({ ...prev, ...newSettings }));
              showToast('Budget Config Saved', 'Daily and monthly budget parameters stored.');
            }}
            onTriggerDailyAlertNow={handleTriggerDailyBudgetAlert}
          />
        )}
      </main>

      {/* 4. Live Broadcast Toast Banner */}
      {toastMessage && (
        <div
          id="live-toast-alert"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-bold text-slate-100 flex items-center justify-between">
              <span>{toastMessage.title}</span>
              <span className="text-[10px] text-emerald-400 font-mono">BROADCASTED</span>
            </div>
            <div className="text-slate-300 mt-1 leading-relaxed">{toastMessage.description}</div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* 5. Mobile-First Standard Expense Form */}
      {isFormOpen && (
        <MobileExpenseForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setFormInitialData(null);
          }}
          onSubmit={handleAddExpenseRequest}
          initialData={formInitialData}
          configuredEmails={configuredEmails}
          currentSpenderName={currentSpenderName}
        />
      )}

      {/* 6. In-Sheet Mandatory Confirmation Dialog (for Add, Edit, Delete) */}
      {confirmationState.isOpen && <ConfirmationDialog state={confirmationState} />}

      {/* 7. Receipt Image Full Proof Modal */}
      {viewingReceipt && (
        <ReceiptModal
          imageUrl={viewingReceipt.url}
          expenseTitle={viewingReceipt.title}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* 8. Notification Outbox & Sent Mails Modal */}
      {isOutboxOpen && (
        <NotificationOutboxModal
          isOpen={isOutboxOpen}
          onClose={() => setIsOutboxOpen(false)}
          notifications={sentNotifications}
        />
      )}

      {/* 9. Invite Roommate directly in Google Sheets Modal */}
      {isInviteRoommateOpen && (
        <InviteRoommateModal
          isOpen={isInviteRoommateOpen}
          onClose={() => setIsInviteRoommateOpen(false)}
          spreadsheetInfo={spreadsheetInfo}
          onRoommateInvited={(email, role) => {
            // Auto-add invited roommate to configured emails list if not already present
            setConfiguredEmails((prev) => {
              if (prev.some((e) => e.email.toLowerCase() === email.toLowerCase())) return prev;
              return [
                ...prev,
                {
                  id: `user-${Date.now()}`,
                  name: email.split('@')[0],
                  email,
                  role: role === 'writer' ? 'Member' : 'Auditor',
                  notifyOnAddEdit: true,
                  notifyMonthlyDigest: true,
                  notifyDailyBudget: false,
                  active: true,
                  addedAt: new Date().toISOString(),
                },
              ];
            });
            showToast('Roommate Invited & Configured', `${email} was invited to the Google Sheet and added to email notifications!`, 'success');
          }}
        />
      )}

      {/* 10. Native Google Sheets Apps Script Modal */}
      {isAppsScriptModalOpen && (
        <AppsScriptModal
          isOpen={isAppsScriptModalOpen}
          onClose={() => setIsAppsScriptModalOpen(false)}
          spreadsheetInfo={spreadsheetInfo}
        />
      )}
    </div>
  );
}
