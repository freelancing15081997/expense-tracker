import React, { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptCaptureFlow, { type ManualFormDraft } from './ReceiptCaptureFlow';
import { useToast } from '../context/ToastContext';
import { clearPendingCapture, rememberMoneyBook } from './ShareIntentListener';
import {
  dismissShare,
  getShareLaunch,
  rememberShareManual,
  rememberShareSaved,
  subscribeShare,
} from '../lib/capture-session';

function snapshot() {
  return getShareLaunch();
}

/** Share reading stays mounted for the life of the app shell. */
export default function ShareCaptureHost() {
  const launch = useSyncExternalStore(subscribeShare, snapshot, snapshot);
  const navigate = useNavigate();
  const { addToast } = useToast();

  return (
    <ReceiptCaptureFlow
      open={Boolean(launch)}
      launch={launch}
      bookId={launch?.preferredBookId}
      onClose={() => {
        dismissShare();
        clearPendingCapture();
      }}
      onManualForm={(draft: ManualFormDraft) => {
        const bookId = String(launch?.preferredBookId || '');
        rememberShareManual(bookId, draft);
        dismissShare();
        clearPendingCapture();
        if (!bookId) return;
        rememberMoneyBook(bookId);
        window.dispatchEvent(new CustomEvent('byjan-share-manual'));
        navigate(`/book/${bookId}`);
      }}
      onConfirmed={(expense, extras) => {
        const bookId = String(expense.bookId || launch?.preferredBookId || '');
        dismissShare();
        clearPendingCapture();
        if (bookId) rememberMoneyBook(bookId);
        rememberShareSaved({ ...expense, bookId }, extras);
        window.dispatchEvent(new CustomEvent('byjan-share-saved'));
        if (extras?.duplicate) {
          addToast('Same receipt — nothing new added', 'success');
        } else if (extras?.needsEdit) {
          addToast(
            Number(extras?.count || 1) > 1
              ? `Imported ${extras.count} — some need amount edits`
              : 'Could not read amount — saved as draft for you to edit',
            'error',
          );
        } else {
          addToast(
            Number(extras?.count || 1) > 1 ? `Imported ${extras.count} entries` : 'Entry saved',
            'success',
          );
        }
        if (bookId) navigate(`/book/${bookId}`);
      }}
    />
  );
}
