import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  BookPlus,
  Building2,
  CalendarClock,
  CircleHelp,
  FileUp,
  Inbox,
  Landmark,
  Library,
  Lock,
  Mail,
  Mic,
  Plus,
  QrCode,
  Receipt,
  ScanLine,
  Settings,
  Shield,
  Split,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { emailIsSuperUser } from '../lib/super-users';
import { CapacitorService } from '../lib/capacitor';

type QuickKind = 'add' | 'scan' | 'voice' | 'pay' | 'import' | 'split' | 'newbook';

type MoreLink = {
  key: string;
  label: string;
  hint?: string;
  feature?: string;
  href?: string;
  quick?: QuickKind;
  icon: React.ReactNode;
  tone?: string;
};

function fireHomeQuick(kind: QuickKind, navigate: ReturnType<typeof useNavigate>) {
  void CapacitorService.hapticTick();
  navigate('/');
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('byjan-quick', { detail: kind })), 360);
}

function Pill({ item, onQuick }: { item: MoreLink; onQuick: (kind: QuickKind) => void }) {
  const inner = (
    <>
      {item.icon}
      {item.label}
    </>
  );
  const cls = `home-pill ${item.tone || 'tone-book'}`;
  if (item.quick) {
    return (
      <button type="button" className={cls} onClick={() => onQuick(item.quick!)}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={item.href || '/'} className={cls}>
      {inner}
    </Link>
  );
}

function QaTile({ item, onQuick }: { item: MoreLink; onQuick: (kind: QuickKind) => void }) {
  const inner = (
    <>
      <span className="home-qa-icon" aria-hidden>{item.icon}</span>
      {item.label}
    </>
  );
  if (item.quick) {
    return (
      <button type="button" className="home-qa-tile" onClick={() => onQuick(item.quick!)}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={item.href || '/'} className="home-qa-tile">
      {inner}
    </Link>
  );
}

export default function MoreHub() {
  const navigate = useNavigate();
  const { on: hasFeature } = useFeatures();
  const { userProfile, isSuperUser } = useAuth();
  const showAccess = isSuperUser && emailIsSuperUser(userProfile?.email);

  const onQuick = (kind: QuickKind) => fireHomeQuick(kind, navigate);
  const show = (item: MoreLink) => !item.feature || hasFeature(item.feature);

  const moneyActions: MoreLink[] = [
    { key: 'add', label: 'Add', feature: 'money_add', quick: 'add', tone: 'tone-add', icon: <Plus className="w-4 h-4" strokeWidth={2.4} /> },
    { key: 'scan', label: 'Scan', feature: 'money_scan', quick: 'scan', tone: 'tone-scan', icon: <ScanLine className="w-4 h-4" strokeWidth={2.4} /> },
    { key: 'import', label: 'Import', feature: 'money_add', quick: 'import', tone: 'tone-add', icon: <FileUp className="w-4 h-4" strokeWidth={2.4} /> },
    { key: 'split', label: 'Split', feature: 'money_split', quick: 'split', tone: 'tone-split', icon: <Split className="w-4 h-4" strokeWidth={2.4} /> },
    { key: 'voice', label: 'Voice', feature: 'money_voice', quick: 'voice', tone: 'tone-voice', icon: <Mic className="w-4 h-4" strokeWidth={2.4} /> },
    { key: 'pay', label: 'Pay', feature: 'money_add', quick: 'pay', tone: 'tone-pay', icon: <QrCode className="w-4 h-4" strokeWidth={2.4} /> },
  ].filter(show);

  const moneyPlaces: MoreLink[] = [
    { key: 'books', label: 'Books', feature: 'money', href: '/expenses', icon: <Library className="w-5 h-5" /> },
    { key: 'new', label: 'New book', feature: 'money_create_book', quick: 'newbook', icon: <BookPlus className="w-5 h-5" /> },
    { key: 'reports', label: 'Summary', feature: 'money_reports', href: '/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'recurring', label: 'Recurring', feature: 'money_recurring', href: '/regular-payments', icon: <CalendarClock className="w-5 h-5" /> },
    { key: 'activity', label: 'Activity', feature: 'money_activity', href: '/activity', icon: <Activity className="w-5 h-5" /> },
    { key: 'inbox', label: 'Inbox', feature: 'money_inbox', href: '/financial-inbox', icon: <Inbox className="w-5 h-5" /> },
    { key: 'people', label: 'People', feature: 'money_people', href: '/expenses', icon: <Users className="w-5 h-5" /> },
    { key: 'email', label: 'Email', feature: 'money_email', href: '/expenses', icon: <Mail className="w-5 h-5" /> },
  ].filter(show);

  const appPlaces: MoreLink[] = [
    { key: 'bell', label: 'Alerts', feature: 'app_notifications', href: '/notifications', icon: <Bell className="w-5 h-5" /> },
    { key: 'lock', label: 'App lock', feature: 'app_lock', href: '/settings', icon: <Lock className="w-5 h-5" /> },
    ...(showAccess ? [{ key: 'access', label: 'Access', href: '/access', icon: <Shield className="w-5 h-5" /> }] : []),
  ].filter(show);

  const businessPlaces: MoreLink[] = [
    { key: 'biz', label: 'Business', feature: 'business', href: '/books', icon: <Building2 className="w-5 h-5" /> },
    { key: 'sales', label: 'Sales', feature: 'sales', href: '/books/invoices', icon: <Receipt className="w-5 h-5" /> },
    { key: 'buying', label: 'Buying', feature: 'buying', href: '/books/bills', icon: <Store className="w-5 h-5" /> },
    { key: 'bank', label: 'Bank', feature: 'bank', href: '/books/banking', icon: <Landmark className="w-5 h-5" /> },
    { key: 'accounts', label: 'Accounts', feature: 'accounts', href: '/books/chart-of-accounts', icon: <BookOpen className="w-5 h-5" /> },
    { key: 'ops', label: 'Stock', feature: 'operations', href: '/books/inventory', icon: <Wallet className="w-5 h-5" /> },
    { key: 'tax', label: 'GST', feature: 'tax', href: '/books/tax', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'bizrep', label: 'Reports', feature: 'reports', href: '/books/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'company', label: 'Company', feature: 'company_settings', href: '/books/settings', icon: <Settings className="w-5 h-5" /> },
  ].filter(show);

  return (
    <div className="more-hub web-page max-w-3xl mx-auto pb-28 md:pb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#0B1F3A] mt-1">More</h1>

      <section className="home-pay-row more-hub-primary" aria-label="Account">
        <Link to="/settings" className="home-pay-act is-pay">
          <span className="home-pay-ico" aria-hidden><Settings className="w-5 h-5" strokeWidth={2.2} /></span>
          <span className="home-pay-copy">
            <strong>Settings</strong>
            <small>Profile, PIN, and alerts</small>
          </span>
        </Link>
        <Link to="/help" className="home-pay-act is-scan">
          <span className="home-pay-ico" aria-hidden><CircleHelp className="w-5 h-5" strokeWidth={2.2} /></span>
          <span className="home-pay-copy">
            <strong>Help</strong>
            <small>How Byjan works</small>
          </span>
        </Link>
      </section>

      {hasFeature('money') && moneyActions.length ? (
        <section className="more-hub-section" aria-label="Money actions">
          <h2 className="home-section-label">Money</h2>
          <div className="home-pills">{moneyActions.map((item) => <Pill key={item.key} item={item} onQuick={onQuick} />)}</div>
          {moneyPlaces.length ? (
            <div className="home-qa more-hub-qa">
              <h3 className="home-section-label">Quick access</h3>
              <div className="home-qa-row">{moneyPlaces.map((item) => <QaTile key={item.key} item={item} onQuick={onQuick} />)}</div>
            </div>
          ) : null}
        </section>
      ) : null}

      {appPlaces.length ? (
        <section className="more-hub-section home-qa" aria-label="App">
          <h2 className="home-section-label">App</h2>
          <div className="home-qa-row">{appPlaces.map((item) => <QaTile key={item.key} item={item} onQuick={onQuick} />)}</div>
        </section>
      ) : null}

      {hasFeature('business') && businessPlaces.length ? (
        <section className="more-hub-section home-qa" aria-label="Business">
          <h2 className="home-section-label">Business</h2>
          <div className="home-qa-row">{businessPlaces.map((item) => <QaTile key={item.key} item={item} onQuick={onQuick} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
