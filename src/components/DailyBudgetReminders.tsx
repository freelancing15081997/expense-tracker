import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  ShieldAlert, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  Smartphone,
  Sparkles
} from 'lucide-react';
import { DailyBudgetSettings, Expense } from '../types';
import { formatCurrency, requestPushPermission, sendBrowserPushNotification, playNotificationChime } from '../services/notificationEngine';

interface Props {
  settings: DailyBudgetSettings;
  expenses: Expense[];
  onUpdateSettings: (newSettings: Partial<DailyBudgetSettings>) => void;
  onTriggerDailyAlertNow: (todaySpend: number) => void;
}

export const DailyBudgetReminders: React.FC<Props> = ({
  settings,
  expenses,
  onUpdateSettings,
  onTriggerDailyAlertNow,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [dailyLimitInput, setDailyLimitInput] = useState<string>(String(settings.dailyLimit));
  const [monthlyLimitInput, setMonthlyLimitInput] = useState<string>(String(settings.monthlyLimit));
  const [reminderTimeInput, setReminderTimeInput] = useState<string>(settings.reminderTime);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Calculate today's spending
  const todayStr = new Date().toISOString().split('T')[0];
  const todayExpenses = expenses.filter((e) => e.date === todayStr);
  const todaySpend = todayExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const percentUsed = settings.dailyLimit > 0
    ? Math.min(150, Math.round((todaySpend / settings.dailyLimit) * 100))
    : 0;

  const isOverDailyLimit = todaySpend > settings.dailyLimit;
  const isNearLimit = percentUsed >= settings.alertThresholdPercent;

  const handleRequestPush = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      setPermissionStatus('granted');
      onUpdateSettings({ pushNotificationsEnabled: true });
      playNotificationChime();
      sendBrowserPushNotification(
        '🔔 Daily Budget Push Notifications Active',
        `You will receive alerts when your daily spending approaches ${formatCurrency(settings.dailyLimit, settings.currency)}.`
      );
    } else {
      setPermissionStatus('denied');
    }
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const dLimit = parseFloat(dailyLimitInput);
    const mLimit = parseFloat(monthlyLimitInput);
    if (!isNaN(dLimit) && !isNaN(mLimit)) {
      onUpdateSettings({
        dailyLimit: dLimit,
        monthlyLimit: mLimit,
        reminderTime: reminderTimeInput,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const handleTestDailyAlert = () => {
    playNotificationChime();
    sendBrowserPushNotification(
      isOverDailyLimit ? '🚨 Daily Budget Exceeded!' : '🔔 Daily Budget Reminder',
      `Today's expenditure is ${formatCurrency(todaySpend, settings.currency)} out of ${formatCurrency(settings.dailyLimit, settings.currency)} daily limit (${percentUsed}% used).`
    );
    onTriggerDailyAlertNow(todaySpend);
  };

  return (
    <div id="daily-budget-reminders-view" className="space-y-6">
      {/* 1. Today's Real-Time Daily Budget Gauge */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isOverDailyLimit 
          ? 'bg-rose-50/80 border-rose-200' 
          : isNearLimit 
          ? 'bg-amber-50/80 border-amber-200' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider ${
                isOverDailyLimit ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                TODAY'S BUDGET METER
              </span>
              <span className="text-xs text-slate-500 font-mono">{todayStr}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrency(todaySpend, settings.currency)}
              <span className="text-sm font-semibold text-slate-500 ml-2">
                / {formatCurrency(settings.dailyLimit, settings.currency)} daily limit
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-test-daily-push"
              onClick={handleTestDailyAlert}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all transform active:scale-95"
            >
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Simulate Daily Push Reminder</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/80 h-3 rounded-full mt-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverDailyLimit ? 'bg-rose-600' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, percentUsed)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs font-semibold mt-2">
          <span className={isOverDailyLimit ? 'text-rose-700' : 'text-slate-600'}>
            {percentUsed}% of daily allowance utilized ({todayExpenses.length} entries today)
          </span>
          <span className={isOverDailyLimit ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
            {isOverDailyLimit
              ? `Over budget by ${formatCurrency(todaySpend - settings.dailyLimit, settings.currency)}`
              : `${formatCurrency(Math.max(0, settings.dailyLimit - todaySpend), settings.currency)} remaining today`}
          </span>
        </div>
      </div>

      {/* 2. Push Notification Activation & Web Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Browser Push Alerts</h3>
                <p className="text-xs text-slate-500">Native system push notifications on mobile & desktop</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              permissionStatus === 'granted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {permissionStatus === 'granted' ? 'Enabled' : permissionStatus === 'denied' ? 'Blocked' : 'Not Enabled'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Receive native pop-up push alerts directly on your device even when your spreadsheet tab is in the background or minimized.
          </p>

          <div className="pt-2">
            {permissionStatus !== 'granted' ? (
              <button
                id="btn-request-push-permission"
                onClick={handleRequestPush}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>Enable Device Push Notifications</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Device push alerts are active and authorized.</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Budget Limits & Reminder Settings */}
        <form onSubmit={handleSaveBudget} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Daily Reminder Configuration</h3>
                <p className="text-xs text-slate-500">Configure thresholds and automated reminder hours</p>
              </div>
            </div>
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Budget thresholds updated successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Daily Limit ({settings.currency})</label>
              <input
                id="input-daily-limit"
                type="number"
                step="1"
                min="1"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Target ({settings.currency})</label>
              <input
                id="input-monthly-limit"
                type="number"
                step="10"
                min="10"
                value={monthlyLimitInput}
                onChange={(e) => setMonthlyLimitInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 mb-1">Evening Reminder Schedule Time</label>
            <div className="flex items-center gap-2">
              <input
                id="input-reminder-time"
                type="time"
                value={reminderTimeInput}
                onChange={(e) => setReminderTimeInput(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-500">Every day at {reminderTimeInput} (Daily summary recap)</span>
            </div>
          </div>

          <button
            id="btn-save-budget-settings"
            type="submit"
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
};
