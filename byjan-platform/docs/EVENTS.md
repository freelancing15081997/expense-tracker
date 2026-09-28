# Byjan Business Backend - Domain Events Catalog

**Phase:** 0 - Planning
**Date:** 2026-09-28
**Scope:** Byjan Business + CA Practice + Super-User Console (Dhani excluded)

---

## Event Architecture

All domain events are emitted through the **transactional outbox** pattern:
- Events are written to `core.outbox` in the same transaction as the domain change
- Arq worker polls with `FOR UPDATE SKIP LOCKED` and dispatches to handlers
- Handlers are idempotent on `event_id`
- Failed events are retried with exponential backoff
- Outbox lag alert if > 30 seconds

---

# Platform Events

## User Events

### UserCreated
**Emitted by:** User registration (Firebase exchange, OTP verify)
**Payload:** `{user_id, email, phone, name, created_at}`
**Consumers:**
- Welcome email/WhatsApp sender
- New user analytics
- Audit logger

### UserUpdated
**Emitted by:** Profile update
**Payload:** `{user_id, changes: {name?, phone?, avatar_file_id?, lang?}, updated_by}`
**Consumers:**
- Audit logger
- Profile sync (if needed)

### UserDeactivated
**Emitted by:** Account deactivation
**Payload:** `{user_id, deactivated_by, reason, deactivated_at}`
**Consumers:**
- Audit logger
- Session revoker
- Notification sender (to user)

### UserDeleted
**Emitted by:** Account deletion (after 30-day grace)
**Payload:** `{user_id, deleted_by, deleted_at, anonymized_data}`
**Consumers:**
- Audit logger
- Data cleanup job
- Compliance logger

---

## Authentication Events

### UserSignedIn
**Emitted by:** Successful sign-in (Firebase, OTP)
**Payload:** `{user_id, method, ip, user_agent, device, location, timestamp}`
**Consumers:**
- Audit logger
- Security alert (new device detection)
- Session logger
- Last activity updater

### SessionRevoked
**Emitted by:** Logout, session revoke, timeout
**Payload:** `{session_id, user_id, revoked_by, reason, revoked_at}`
**Consumers:**
- Audit logger
- Notification sender (if revoked by admin)

### MFAEnabled
**Emitted by:** MFA setup completion
**Payload:** `{user_id, method: 'totp', enabled_by, enabled_at}`
**Consumers:**
- Audit logger
- Security alert (to user)

### MFADisabled
**Emitted by:** MFA disable (step-up required)
**Payload:** `{user_id, disabled_by, reason, disabled_at}`
**Consumers:**
- Audit logger
- Security alert (to user and admins)

### RefreshTokenReused
**Emitted by:** Refresh token reuse detection
**Payload:** `{session_family_id, user_id, ip, user_agent, detected_at}`
**Consumers:**
- Audit logger
- Security alert (CRITICAL - revoke all sessions)
- Notification sender (to user)

---

## Tenant Events

### TenantCreated
**Emitted by:** New tenant (company/practice) creation
**Payload:** `{tenant_id, kind, name, gstin, state_code, created_by, created_at}`
**Consumers:**
- Audit logger
- Usage analytics
- Billing/usage tracker
- Default roles creator

### TenantUpdated
**Emitted by:** Tenant settings update
**Payload:** `{tenant_id, changes, updated_by, updated_at}`
**Consumers:**
- Audit logger
- Cache invalidator (tenant settings)

### TenantDeleted
**Emitted by:** Tenant soft delete (30-day grace)
**Payload:** `{tenant_id, deleted_by, reason, deleted_at}`
**Consumers:**
- Audit logger
- Backup trigger
- Notification sender (to members)

### OwnershipTransferred
**Emitted by:** Ownership transfer (step-up required)
**Payload:** `{tenant_id, from_user_id, to_user_id, transferred_by, transferred_at}`
**Consumers:**
- Audit logger
- Notification sender (to both parties)
- Permission rebuilder

---

## Membership Events

### MemberInvited
**Emitted by:** Member invite creation
**Payload:** `{tenant_id, invite_id, email, phone, role_id, kind, invited_by, expires_at}`
**Consumers:**
- Audit logger
- Email/WhatsApp sender (invite)
- Notification tracker

### InviteAccepted
**Emitted by:** Invite acceptance
**Payload:** `{tenant_id, invite_id, user_id, accepted_at}`
**Consumers:**
- Audit logger
- Membership creator
- Notification sender (to inviter)
- Welcome email

### InviteDeclined
**Emitted by:** Invite decline
**Payload:** `{tenant_id, invite_id, declined_at}`
**Consumers:**
- Audit logger
- Notification sender (to inviter)

### MemberRoleChanged
**Emitted by:** Member role update (step-up required)
**Payload:** `{tenant_id, user_id, from_role_id, to_role_id, changed_by, changed_at}`
**Consumers:**
- Audit logger
- Permission cache invalidator
- Notification sender (to member)

### MemberSuspended
**Emitted by:** Member suspension
**Payload:** `{tenant_id, user_id, suspended_by, reason, suspended_at}`
**Consumers:**
- Audit logger
- Session revoker
- Notification sender (to member)

### MemberRestored
**Emitted by:** Member restoration
**Payload:** `{tenant_id, user_id, restored_by, restored_at}`
**Consumers:**
- Audit logger
- Notification sender (to member)

### MemberRemoved
**Emitted by:** Member removal
**Payload:** `{tenant_id, user_id, removed_by, removed_at}`
**Consumers:**
- Audit logger
- Session revoker
- Notification sender (to member)

---

## RBAC Events

### RoleCreated
**Emitted by:** Role creation
**Payload:** `{tenant_id, role_id, name, from_role_id, created_by, created_at}`
**Consumers:**
- Audit logger
- Permission matrix builder

### RoleUpdated
**Emitted by:** Role update (step-up required for limits)
**Payload:** `{tenant_id, role_id, changes, updated_by, updated_at}`
**Consumers:**
- Audit logger
- Permission cache invalidator

### RolePermissionsChanged
**Emitted by:** Role permissions update (step-up required)
**Payload:** `{tenant_id, role_id, changes, updated_by, updated_at}`
**Consumers:**
- Audit logger
- Permission cache invalidator
- Permission rebuilder for affected users

### RoleDeleted
**Emitted by:** Role deletion
**Payload:** `{tenant_id, role_id, deleted_by, deleted_at}`
**Consumers:**
- Audit logger
- Permission rebuilder for affected users

---

## File Events

### FileUploaded
**Emitted by:** File upload initiation
**Payload:** `{tenant_id, file_id, purpose, name, mime, size, uploaded_by, uploaded_at}`
**Consumers:**
- Audit logger
- ClamAV scanner trigger

### FileScanCompleted
**Emitted by:** ClamAV scan completion
**Payload:** `{tenant_id, file_id, status: 'clean'|'infected', scan_result, scanned_at}`
**Consumers:**
- Audit logger
- Notification sender (if infected)
- File status updater

### FileLinked
**Emitted by:** File linked to entity
**Payload:** `{tenant_id, file_id, linked_type, linked_id, linked_by, linked_at}`
**Consumers:**
- Audit logger

### FileDeleted
**Emitted by:** File deletion
**Payload:** `{tenant_id, file_id, deleted_by, deleted_at}`
**Consumers:**
- Audit logger
- Storage cleanup (if not linked)

---

## Notification Events

### NotificationCreated
**Emitted by:** Notification creation
**Payload:** `{tenant_id, user_id, notification_id, type, title, body, link, created_at}`
**Consumers:**
- Push notification sender (FCM)
- Email sender (if configured)
- WebSocket pusher (real-time)

### NotificationRead
**Emitted by:** Notification read
**Payload:** `{tenant_id, user_id, notification_id, read_at}`
**Consumers:**
- Badge counter updater

---

# Business Events

## Document Events

### DocumentCreated
**Emitted by:** Document creation (draft)
**Payload:** `{tenant_id, document_id, type, number, party_id, created_by, created_at}`
**Consumers:**
- Audit logger
- Search indexer

### DocumentUpdated
**Emitted by:** Document field update
**Payload:** `{tenant_id, document_id, changes, updated_by, updated_at}`
**Consumers:**
- Audit logger
- Search indexer
- Cache invalidator

### DocumentPosted
**Emitted by:** Document posting (approve/send/confirm)
**Payload:** `{tenant_id, document_id, type, number, party_id, posted_by, posted_at, journal_id}`
**Consumers:**
- Audit logger
- GL balancer updater
- Party balance updater
- Notification sender (to party if customer/supplier)
- Email sender (document PDF)
- Stock updater (if GRN/invoice)
- Search indexer

### DocumentSent
**Emitted by:** Document email/send action
**Payload:** `{tenant_id, document_id, type, number, party_id, sent_by, sent_at, channel, recipients}`
**Consumers:**
- Audit logger
- Message logger
- Notification sender

### DocumentReminded
**Emitted by:** Document reminder
**Payload:** `{tenant_id, document_id, type, number, party_id, reminded_by, reminded_at, channel}`
**Consumers:**
- Audit logger
- Message logger
- Notification sender

### DocumentAccepted
**Emitted by:** Estimate/quote acceptance
**Payload:** `{tenant_id, document_id, type, number, party_id, accepted_by, accepted_at}`
**Consumers:**
- Audit logger
- Notification sender (to creator)

### DocumentDeclined
**Emitted by:** Estimate/quote decline
**Payload:** `{tenant_id, document_id, type, number, party_id, declined_by, reason, declined_at}`
**Consumers:**
- Audit logger
- Notification sender (to creator)

### DocumentConverted
**Emitted by:** Document conversion (quote→invoice, PO→GRN, etc.)
**Payload:** `{tenant_id, from_document_id, to_document_id, conversion_type, converted_by, converted_at}`
**Consumers:**
- Audit logger
- Search indexer
- Notification sender

### DocumentVoided
**Emitted by:** Document void (reverses GL and stock)
**Payload:** `{tenant_id, document_id, type, number, voided_by, reason, voided_at, reversal_journal_id}`
**Consumers:**
- Audit logger
- GL balancer updater
- Party balance updater
- Stock updater (if applicable)
- Search indexer
- Notification sender

### DocumentPaid
**Emitted by:** Payment recorded
**Payload:** `{tenant_id, document_id, payment_id, amount_paise, paid_by, paid_at}`
**Consumers:**
- Audit logger
- Document balance updater
- Party balance updater
- Notification sender (to party)

### PaymentAllocated
**Emitted by:** Credit/debit note application
**Payload:** `{tenant_id, document_id, allocation_id, amount_paise, allocated_by, allocated_at}`
**Consumers:**
- Audit logger
- Document balance updater
- Party balance updater

---

## Journal Events

### JournalPosted
**Emitted by:** Journal entry posting
**Payload:** `{tenant_id, journal_id, date, narration, posted_by, posted_at}`
**Consumers:**
- Audit logger
- GL balancer updater
- Period closer validator

### JournalReversed
**Emitted by:** Journal reversal
**Payload:** `{tenant_id, journal_id, reversal_journal_id, reversed_by, reason, reversed_at}`
**Consumers:**
- Audit logger
- GL balancer updater
- Notification sender

---

## Payment Events

### PaymentCreated
**Emitted by:** Payment creation
**Payload:** `{tenant_id, payment_id, direction, party_id, amount_paise, date, mode, created_by, created_at}`
**Consumers:**
- Audit logger
- Party balance updater
- Bank balance updater

### PaymentVoided
**Emitted by:** Payment void
**Payload:** `{tenant_id, payment_id, voided_by, reason, voided_at}`
**Consumers:**
- Audit logger
- Party balance updater
- Bank balance updater
- Document balance updater (reverse allocations)

### PaymentRunCreated
**Emitted by:** Payment run creation
**Payload:** `{tenant_id, payment_run_id, bill_ids, pay_date, account_id, created_by, created_at}`
**Consumers:**
- Audit logger
- Notification sender (to approver)

### PaymentRunSubmitted
**Emitted by:** Payment run submission
**Payload:** `{tenant_id, payment_run_id, submitted_by, submitted_at}`
**Consumers:**
- Audit logger
- Notification sender (to approver)

### PaymentRunApproved
**Emitted by:** Payment run approval
**Payload:** `{tenant_id, payment_run_id, approved_by, approved_at}`
**Consumers:**
- Audit logger
- Notification sender (to submitter)

### PaymentRunExecuted
**Emitted by:** Payment run execution (💰)
**Payload:** `{tenant_id, payment_run_id, executed_by, executed_at, bank_file_id}`
**Consumers:**
- Audit logger
- Payment creator (creates payment records)
- Bank file uploader
- Notification sender (to suppliers)

---

## Bank Events

### BankStatementImported
**Emitted by:** Bank statement import
**Payload:** `{tenant_id, account_id, import_id, file_id, imported_by, imported_at}`
**Consumers:**
- Audit logger
- Bank line parser (async job)

### BankLineMatched
**Emitted by:** Bank line match
**Payload:** `{tenant_id, bank_line_id, matched_to, matched_by, matched_at}`
**Consumers:**
- Audit logger
- Bank line status updater

### BankLineAutoMatched
**Emitted by:** Auto-match rule execution
**Payload:** `{tenant_id, account_id, rule_id, matched_count, matched_at}`
**Consumers:**
- Audit logger
- Bank line status updater

### BankReconciliationCompleted
**Emitted by:** Bank reconciliation completion
**Payload:** `{tenant_id, account_id, period_id, reconciled_by, reconciled_at}`
**Consumers:**
- Audit logger
- Notification sender

---

## Stock Events

### StockAdjusted
**Emitted by:** Stock adjustment
**Payload:** `{tenant_id, adjustment_id, item_id, location_id, qty_delta, adjusted_by, adjusted_at}`
**Consumers:**
- Audit logger
- Stock level updater
- Notification sender (if low stock)

### StockTransferred
**Emitted by:** Stock transfer
**Payload:** `{tenant_id, transfer_id, from_location_id, to_location_id, transferred_by, transferred_at}`
**Consumers:**
- Audit logger
- Stock level updater

### StockLevelLow
**Emitted by:** Stock level breach (watch list)
**Payload:** `{tenant_id, item_id, location_id, current_qty, reorder_level, detected_at}`
**Consumers:**
- Notification sender (to purchasing)
- Watch list alert creator

---

## Asset Events

### AssetAcquired
**Emitted by:** Asset creation
**Payload:** `{tenant_id, asset_id, category, acquired_on, cost, created_by, created_at}`
**Consumers:**
- Audit logger
- Depreciation scheduler

### AssetDisposed
**Emitted by:** Asset disposal
**Payload:** `{tenant_id, asset_id, disposed_on, proceeds_paise, disposed_by, disposed_at}`
**Consumers:**
- Audit logger
- GL poster (disposal entry)
- Depreciation scheduler cancel

### DepreciationRunCompleted
**Emitted by:** Depreciation run
**Payload:** `{tenant_id, period_id, journal_id, asset_count, completed_at}`
**Consumers:**
- Audit logger
- GL balancer updater

---

## Project Events

### ProjectCreated
**Emitted by:** Project creation
**Payload:** `{tenant_id, project_id, name, created_by, created_at}`
**Consumers:**
- Audit logger
- Search indexer

### ProjectUpdated
**Emitted by:** Project update
**Payload:** `{tenant_id, project_id, changes, updated_by, updated_at}`
**Consumers:**
- Audit logger

### ProjectClosed
**Emitted by:** Project closure
**Payload:** `{tenant_id, project_id, closed_by, closed_at}`
**Consumers:**
- Audit logger
- Notification sender

---

## Budget Events

###BudgetUpdated
**Emitted by:** Budget update
**Payload:** `{tenant_id, fy, budget_lines, updated_by, updated_at}`
**Consumers:**
- Audit logger
- Budget vs actual projector

---

## Tax Events

### GSTR2BFetched
**Emitted by:** GSTR-2B download
**Payload:** `{tenant_id, period, fetched_by, fetched_at}`
**Consumers:**
- Audit logger
- GSTR-2B parser (async job)

### GSTR2BMismatchDetected
**Emitted by:** GSTR-2B mismatch detection
**Payload:** `{tenant_id, period, mismatch_id, detected_at}`
**Consumers:**
- Audit logger
- Review queue creator
- Notification sender (to accountant)

### TaxReturnFiled
**Emitted by:** Tax return filing (step-up required)
**Payload:** `{tenant_id, return_id, type, period, arn, filed_by, filed_at}`
**Consumers:**
- Audit logger
- Notification sender
- Compliance item updater

---

## Inbox Events

### BillReceived
**Emitted by:** Bill received via email/WhatsApp
**Payload:** `{tenant_id, inbox_item_id, from, subject, file_id, received_at}`
**Consumers:**
- Audit logger
- Bill parser (async job)
- Notification sender

### BillParsed
**Emitted by:** Bill parsing completion
**Payload:** `{tenant_id, inbox_item_id, parsed_data, confidence, parsed_at}`
**Consumers:**
- Audit logger
- Inbox item updater
- Notification sender (to accountant)

### BillAccepted
**Emitted by:** Bill acceptance as document
**Payload:** `{tenant_id, inbox_item_id, document_id, accepted_by, accepted_at}`
**Consumers:**
- Audit logger
- Notification sender

---

## Approval Events

### ApprovalRequested
**Emitted by:** Approval request creation
**Payload:** `{tenant_id, approval_id, source_type, source_id, amount_paise, requested_by, requested_at}`
**Consumers:**
- Audit logger
- Notification sender (to approver)

### ApprovalApproved
**Emitted by:** Approval approval
**Payload:** `{tenant_id, approval_id, approved_by, approved_at}`
**Consumers:**
- Audit logger
- Source document executor
- Notification sender (to requester)

### ApprovalRejected
**Emitted by:** Approval rejection
**Payload:** `{tenant_id, approval_id, rejected_by, reason, rejected_at}`
**Consumers:**
- Audit logger
- Notification sender (to requester)

---

# CA Practice Events

### ClientCreated
**Emitted by:** Client creation
**Payload:** `{practice_tenant_id, client_id, name, type, created_by, created_at}`
**Consumers:**
- Audit logger
- Compliance calendar generator

### ClientLinked
**Emitted by:** Client tenant linking
**Payload:** `{practice_tenant_id, client_id, client_tenant_id, linked_by, linked_at}`
**Consumers:**
- Audit logger
- Permission grantor (CA access to client books)

### ComplianceItemCreated
**Emitted by:** Compliance item creation
**Payload:** `{practice_tenant_id, client_id, compliance_item_id, return_type, period, due_date, created_at}`
**Consumers:**
- Audit logger
- Notification sender (to assignee)

### ComplianceItemAdvanced
**Emitted by:** Compliance item status advance
**Payload:** `{practice_tenant_id, compliance_item_id, from_status, to_status, advanced_by, advanced_at}`
**Consumers:**
- Audit logger
- Notification sender

### TaxReturnFiledForClient
**Emitted by:** Tax return filing for client
**Payload:** `{practice_tenant_id, client_id, return_id, arn, filed_by, filed_at}`
**Consumers:**
- Audit logger
- Notification sender (to client)
- Compliance item updater

### TaskCreated
**Emitted by:** Task creation
**Payload:** `{practice_tenant_id, client_id, task_id, title, assignee, due, created_by, created_at}`
**Consumers:**
- Audit logger
- Notification sender (to assignee)

### TaskMoved
**Emitted by:** Task column move
**Payload:** `{practice_tenant_id, task_id, from_column, to_column, moved_by, moved_at}`
**Consumers:**
- Audit logger

### ReviewItemCreated
**Emitted by:** Review item creation
**Payload:** `{practice_tenant_id, client_id, review_item_id, rule_key, issue, created_at}`
**Consumers:**
- Audit logger
- Notification sender (to staff)

### ReviewItemApplied
**Emitted by:** Review fix application
**Payload:** `{practice_tenant_id, review_item_id, applied_by, applied_at}`
**Consumers:**
- Audit logger
- Client book updater (through membership)

### TimeEntryCreated
**Emitted by:** Time entry creation
**Payload:** `{practice_tenant_id, client_id, time_entry_id, staff_id, date, hours, rate_paise, created_by, created_at}`
**Consumers:**
- Audit logger
- WIP calculator

### TimeEntryBilled
**Emitted by:** Time entry billing
**Payload:** `{practice_tenant_id, client_id, time_entry_ids, invoice_id, billed_by, billed_at}`
**Consumers:**
- Audit logger
- Time entry status updater

---

# Console Events

### IssueCreated
**Emitted by:** Console issue creation (auto or manual)
**Payload:** `{sev, title, module, tenant_id, trace_ids, created_at}`
**Consumers:**
- Notification sender (to super users)
- Alert integrator (Sentry, etc.)

### IssueResolved
**Emitted by:** Issue resolution
**Payload:** `{issue_id, resolved_by, resolution, resolved_at}`
**Consumers:**
- Audit logger
- Notification sender

### IntegrationHealthChanged
**Emitted by:** Integration health status change
**Payload:** `{integration_key, tenant_id, from_status, to_status, detected_at}`
**Consumers:**
- Audit logger
- Health dashboard updater
- Alert trigger (if critical)

---

# System Events

### OutboxLagDetected
**Emitted by:** Outbox lag monitor (> 30s)
**Payload:** `{lag_seconds, pending_count, detected_at}`
**Consumers:**
- Audit logger
- Alert (CRITICAL)
- Console issue creator

### ProjectionDriftDetected
**Emitted by:** Projection verification failure
**Payload:** `{projection_name, tenant_id, expected, actual, detected_at}`
**Consumers:**
- Audit logger
- Console issue creator
- Alert (CRITICAL)

### AuditChainBreakDetected
**Emitted by:** Audit hash chain verification failure
**Payload:** `{tenant_id, broken_at, expected_hash, actual_hash, detected_at}`
**Consumers:**
- Audit logger
- Console issue creator
- Alert (CRITICAL - security)

### RateLimitApproaching
**Emitted by:** Rate limit threshold breach
**Payload:** `{tenant_id, user_id, route, current_usage, limit, detected_at}`
**Consumers:**
- Audit logger
- Notification sender (to tenant admin)

### SecurityEventDetected
**Emitted by:** Security event (new device, MFA disabled, etc.)
**Payload:** `{event_type, user_id, tenant_id, details, detected_at}`
**Consumers:**
- Audit logger
- Notification sender (to user and admins)
- Alert (if critical)

---

## Event Statistics

**Total Events:** 80+ domain events
**Platform Events:** 25
**Business Events:** 35
**CA Practice Events:** 12
**Console Events:** 4
**System Events:** 4

**Event Flow:**
1. Domain change occurs in service
2. Event created in `core.outbox` (same transaction)
3. Transaction commits
4. Arq worker picks up event (FOR UPDATE SKIP LOCKED)
5. Worker dispatches to registered handlers
6. Handlers execute idempotently
7. Event marked as published
8. Failed events retried with backoff

**Event Serialization:**
- Events are frozen dataclasses
- Serialized as JSON in `core.outbox.payload`
- Include `event_id` (UUIDv7), `tenant_id`, `type`, `data`, `created_at`
- Handlers use `event_id` for idempotency

**Event Retention:**
- Outbox records retained for 90 days
- Audit log retained for 8 years (financial requirement)
- Change log retained for 1 year
- Traces retained for 30 days

---

## Event Testing

Every event must have:
1. Unit test for event creation
2. Service test for emission
3. Handler test for processing
4. Idempotency test (replay same event twice)
5. Integration test (end-to-end event flow)

**Test Coverage Goal:** 100% of events have complete test coverage
