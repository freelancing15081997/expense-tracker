# EVENTS — domain events (platform + business MVP)

Consumers run in-process (same UnitOfWork) or via `core.outbox` → Arq worker.

| Event | Emitted by | Consumers | Async? |
|---|---|---|---|
| `UserSignedIn` | platform.auth | audit, notifications | outbox |
| `SessionRevoked` | platform.auth | audit | outbox |
| `TenantCreated` | platform.tenants | seed COA / numbering, audit | sync + outbox |
| `MemberInvited` | platform.invites | email/WhatsApp | outbox |
| `MemberJoined` | platform.invites | audit | outbox |
| `PasswordResetRequested` | platform.auth | mail relay (Business) | sync |
| `PartyCreated` / `PartyUpdated` | business.parties | search index, audit | outbox |
| `DocumentCreated` | business.documents | audit | outbox |
| `DocumentTransitioned` | business.documents | GL posting, notifications, undo token | sync + outbox |
| `PaymentAllocated` | business.payments | party balances, GL | sync + outbox |
| `BankLineMatched` | business.bank | GL, audit | sync |
| `ExportRequested` | platform.exports | jobs worker | outbox |
| `WebhookInboundReceived` | platform.webhooks | inbox / parsers | outbox |

Dhani events (SaleCompleted → khatha Jama, WeaverMoneyMoved, YarnMoved, etc.) are deferred until Phase 8 implementation; catalogue is in handoff `04`.
