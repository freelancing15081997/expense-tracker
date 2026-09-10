import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BooksProvider, { useBooks } from '../context/BooksProvider';
import { BooksLoader } from '../ui/BooksLoader';
import { moduleByPath } from '../catalog/modules';
import Dashboard from '../modules/dashboard/Dashboard';
import ControlTower from '../modules/control/ControlTower';
import CfoDashboard from '../modules/dashboard/CfoDashboard';
import Accounts from '../modules/accounting/Accounts';
import Journals from '../modules/accounting/Journals';
import Recurring from '../modules/accounting/Recurring';
import Ledger from '../modules/accounting/Ledger';
import LedgerIndex from '../modules/accounting/LedgerIndex';
import Periods from '../modules/accounting/Periods';
import MonthEndClose from '../modules/accounting/Close';
import Parties from '../modules/parties/Parties';
import Documents from '../modules/documents/Documents';
import Reports from '../modules/reporting/Reports';
import BooksSettings from '../modules/settings/BooksSettings';
import Banking from '../modules/banking/Banking';
import TaxCodes from '../modules/tax/TaxCodes';
import AuditLog from '../modules/audit/AuditLog';
import Inventory from '../modules/inventory/Inventory';
import Assets from '../modules/assets/Assets';
import Projects from '../modules/projects/Projects';
import Budgets from '../modules/budgets/Budgets';
import Forecast from '../modules/budgets/Forecast';
import Revenue from '../modules/revenue/Revenue';
import Leases from '../modules/leases/Leases';
import Entities from '../modules/entities/Entities';
import Companies from '../modules/companies/Companies';
import Workbench from '../modules/workbench/Workbench';
import Inbox from '../modules/inbox/Inbox';
import Statements from '../modules/statements/Statements';
import Approvals from '../modules/automation/Approvals';
import Insights from '../modules/insights/Insights';
import BooksShell from '../shell/BooksShell';
import PaymentRun from '../modules/payables/PaymentRun';
import Collections from '../modules/receivables/Collections';

function BooksReady({ children }: { children: React.ReactNode }) {
  const { loading, error, refresh } = useBooks();
  const location = useLocation();
  const module = moduleByPath(location.pathname);
  if (loading) {
    return <BooksLoader feature={module.name} href={module.href} />;
  }
  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="font-display text-[18px] font-semibold text-[#0B1F3A]">Couldn’t open Books</h1>
        <p className="text-sm text-slate-600 mt-2">{error}</p>
        <button className="byjan-btn mt-4" onClick={() => refresh()}>
          Retry
        </button>
      </div>
    );
  }
  return <div className="h-full min-h-0">{children}</div>;
}

export default function BooksApp() {
  return (
    <div className="h-full min-h-0">
    <BooksProvider>
      <BooksReady>
        <BooksShell>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="cfo" element={<CfoDashboard />} />
          <Route path="control-tower" element={<ControlTower />} />
          <Route path="chart-of-accounts" element={<Accounts />} />
          <Route path="journals" element={<Journals />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="ledger" element={<LedgerIndex />} />
          <Route path="ledger/:accountId" element={<Ledger />} />
          <Route path="periods" element={<Periods />} />
          <Route path="close" element={<MonthEndClose />} />
          <Route path="customers" element={<Parties kind="customer" />} />
          <Route path="vendors" element={<Parties kind="vendor" />} />
          <Route path="estimates" element={<Documents kind="estimate" />} />
          <Route path="quotes" element={<Documents kind="quote" />} />
          <Route path="sales-orders" element={<Documents kind="sales_order" />} />
          <Route path="invoices" element={<Documents kind="invoice" />} />
          <Route path="credit-notes" element={<Documents kind="credit_note" />} />
          <Route path="debit-notes" element={<Documents kind="debit_note" />} />
          <Route path="statements" element={<Statements />} />
          <Route path="collections" element={<Collections />} />
          <Route path="payment-run" element={<PaymentRun />} />
          <Route path="purchase-requests" element={<Documents kind="purchase_request" />} />
          <Route path="purchase-orders" element={<Documents kind="purchase_order" />} />
          <Route path="purchase-receipts" element={<Documents kind="purchase_receipt" />} />
          <Route path="bills" element={<Documents kind="bill" />} />
          <Route path="vendor-credits" element={<Documents kind="vendor_credit" />} />
          <Route path="expenses" element={<Documents kind="expense" />} />
          <Route path="banking" element={<Banking />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="assets" element={<Assets />} />
          <Route path="projects" element={<Projects />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="leases" element={<Leases />} />
          <Route path="entities" element={<Entities />} />
          <Route path="companies" element={<Companies />} />
          <Route path="workbench" element={<Workbench />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="insights" element={<Insights />} />
          <Route path="tax" element={<TaxCodes />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<BooksSettings />} />
          <Route path="invoicing" element={<Navigate to="/books/invoices" replace />} />
          <Route path="billing" element={<Navigate to="/books/bills" replace />} />
          <Route path="clients" element={<Navigate to="/books/customers" replace />} />
          <Route path="templates" element={<Navigate to="/books/recurring" replace />} />
          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
        </BooksShell>
      </BooksReady>
    </BooksProvider>
    </div>
  );
}
