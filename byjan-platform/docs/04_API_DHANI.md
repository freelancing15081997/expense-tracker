# 04 · API catalogue: Byjan Dhani (Dhani Khatha)

- Base path: `/v1/dhani`, with tenant `kind='dhani'`. The platform routes in 03 §A (auth, me, tenants, members, invites, RBAC, files, notifications, search, undo, jobs, audit) are reused, not duplicated.
- Money is in paise, yarn and zari in milligrams (`_mg`), and length in millimetres (`_mm`).
- 💰 marks a route that requires `Idempotency-Key`.
- Languages: `en`, `te`, `ta`, `kn`, `hi`.
  - The UI strings stay on the client.
  - Server-rendered text (PDF bills, statements, WhatsApp messages, tips) uses `templates/<lang>/` and the user's `lang`, or `?lang=`.
  - Names people type (weaver, village, design) are stored as they were typed, with an optional `name_alt` field for a transliteration used in search.

## Roles and modules
**Default roles:** Owner (the Dhani), Manager, Munim (accounts), Godown staff and Viewer. The matrix uses the same RBAC engine as Business.

| Module | Screens and actions |
|---|---|
| `home` | Home summary and tips |
| `weavers` | Looms list, weaver account, hold and resume, move remaining work |
| `assign` | Give a lot to a weaver |
| `receive` | Receive and QC |
| `yarn` | Give, return and adjust yarn; material stock |
| `weaver_money` | Kooli, advances, cuts |
| `godown` | Stock, reserve, grade and price edits |
| `sales` | Sell, bills, collect dues, returns |
| `studio` | Designs |
| `setups` | Lots |
| `khatha` | Ledger |
| `parties` | Buyers and suppliers |
| `rates` | Rates |
| `reports` | Reports |
| `settings` | Masters and settings |

**ABAC flags per role:**
- `see_cost_margin`: Godown staff get no cost or margin.
- `see_money`: controls the weaver money and khatha figures.
- `max_advance_paise`: advances above it go to the Owner for approval.
- `max_discount_pct`

## 1. Bootstrap, masters and rates
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D1 | GET `/dhani/bootstrap` | One call when the app opens. Returns the masters, current rates, the user's permissions and flags, counts for the tab badges and a sync cursor, with an ETag (usually a 304) | auth + tenant |
| D2 | GET `/dhani/masters/{kind}` · POST · PATCH `/{id}` · POST `/{id}/actions/archive` | **One generic endpoint.** `kind` is one of `colours` (name and hex), `motifs` (butta, with an SVG path or image `file_id`), `border_styles` (anchu, e.g. korvai), `pallu_styles`, `zari_types` (gold, silver or copper with three shades), `defects`, `villages`, `loom_types` (handloom with hook count, powerloom), `materials` (warp silk, weft silk, zari, with a unit), `expense_categories` and `custom_fields`. Seeded defaults can't be deleted, only hidden | settings.view / .edit |
| D3 | GET `/dhani/rates` · GET `/dhani/rates/history` | Current rates: silk ₹/kg, zari ₹/marc, dyeing per saree, kooli presets per loom type, defect cut per issue, margin % per grade (A/B/C) and price rounding (to ₹100) | rates.view |
| D4 | PUT `/dhani/rates` `{…, effective_from}` | Adds a new rate version (the history is kept; old sarees keep the cost they were given). Needs step-up | rates.edit |

## 2. Studio: designs
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D5 | GET `/dhani/designs?type=studio\|clone\|photo&q=&colour=&cursor=` | The design library, with thumbnail URLs | studio.view |
| D6 | POST `/dhani/designs` | Creates a design. Fields: `name`; `type`; `body`, `border`, `pallu` (colour ids); `border_style` (bs); `motif` (bt); `density` (dn); `pallu_style` (ps); `zari` (z); `border_width` (bw); `hooks`; `motif_file_id`; `photo_file_id`; `thumbnail_file_id` (a PNG the client renders). Auto code `DKS-####` | studio.create |
| D7 | GET `/dhani/designs/{id}` · PATCH `/{id}` (If-Match) | Opens or saves in the editor (`saveEd`) | studio.view / .edit |
| D8 | POST `/dhani/designs/{id}/actions/duplicate` `{name?}` | "Save as copy", or cloning a photo design | studio.create |
| D9 | POST `/dhani/designs/{id}/actions/archive\|unarchive` | Archive. A design used in a setup can't be deleted, only archived | studio.delete |
| D10 | GET `/dhani/designs/{id}/usage` | Setups, sarees on looms, sold count and average price | studio.view |

## 3. Setups (lots)
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D11 | GET `/dhani/setups?q=&status=draft\|ready\|in_use\|archived` | Saved lots | setups.view |
| D12 | POST `/dhani/setups` | The full wizard payload. `code` (`SET-##`), `name`, `loom_type`, `design_ids[]`, `sarees[{body, border, pallu, design_id, note, photo_file_id}]`, `fields[{label, value}]`, `material_per_saree_mg{warp, weft, zari}`, `colour_mode: tap\|slip\|photo\|write`, `slip_file_id`, `status`. The response includes computed material totals and the estimated cost per saree | setups.create |
| D13 | GET `/dhani/setups/{id}` · PATCH `/{id}` | Only while the lot isn't assigned. After assignment, only the name and notes can change | setups.view / .edit |
| D14 | POST `/dhani/setups/{id}/actions/duplicate\|archive` | Copy or archive | setups.create / .delete |

## 4. Weavers (looms)
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D15 | GET `/dhani/weavers?status=weaving\|late\|free\|to_pay\|owes_you\|hold&village=&loom_type=&sort=next_ready\|money\|name&q=&cursor=&limit=25` | Compact rows for hundreds of looms, read from the `weaver_stats` projection. Each row has: name, village, loom, status, current saree and progress, next ETA, days late, net money (`you_pay` or `owes_you`) | weavers.view |
| D16 | GET `/dhani/weavers/counts?village=` | Counts for the filter chips | weavers.view |
| D17 | POST `/dhani/weavers` · PATCH `/{id}` | Name, `name_alt`, village, phone (encrypted), loom type and hooks, days per saree (changing it re-plans the ETAs of queued pieces), notes, photo | weavers.create / .edit |
| D18 | GET `/dhani/weavers/{id}` | Account header: all the `wStats` figures (done, total, pending, next, earned, paid, advance, recovered, cut, kooli due, advance out, net, yarn held, status) | weavers.view |
| D19 | GET `/dhani/weavers/{id}/pieces?state=loom\|queue\|done` | The "On loom" and "Sarees flow" tabs, with timeline, ETAs, tag and grade | weavers.view |
| D20 | GET `/dhani/weavers/{id}/yarn` | The Yarn tab: given, consumed, returned and held per material, plus the moves | yarn.view |
| D21 | GET `/dhani/weavers/{id}/money?cursor=` | The Money tab: entries and running balances | weaver_money.view |
| D22 | POST `/dhani/weavers/{id}/actions/hold\|resume` | `toggleHold`. Holding pauses the ETAs; resuming shifts them by the days held | weavers.edit |
| D23 | POST `/dhani/weavers/{id}/actions/move-remaining` `{to_weaver_id, take_back_yarn: true}` | Moves queued pieces and the loom piece to another weaver, returns the yarn and re-gives it, re-plans ETAs, and writes a single audited operation (`moveRemaining`) | assign.create |
| D24 | POST `/dhani/weavers/{id}/actions/archive` | Only when nothing is on the loom, the yarn held is 0 and the net is 0 | weavers.delete |
| D25 | GET `/dhani/weavers/{id}/statement?from=&to=&lang=&format=json\|pdf` | Weaver statement | weaver_money.view |
| D26 | POST `/dhani/weavers/{id}/statement/share` `{channel: whatsapp\|sms\|link}` | Sends it, or returns a signed read-only link that lasts 7 days | weaver_money.export |

## 5. Assign (give a lot)
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D27 | POST `/dhani/assignments/preview` `{setup_id, weaver_id, days_per_saree, start_date, wage_paise?, advance_paise?, material_overrides_mg?}` | Returns the timeline (the queue after this weaver's pending pieces), the ETA per saree, the material to give, the cost per saree and a warning if yarn stock is short (`pickSetup` and the `doAssign` maths) | assign.view |
| D28 | POST `/dhani/assignments` 💰 | Same body as the preview, and **atomic**. Creates the pieces (the first one goes on the loom if the weaver is free), the yarn give moves (material stock goes down), and the advance entry with its Kharchu ledger line if an advance is given. Clears the hold and idle state. Returns `undo_token` | assign.create (+ approval if the advance is over the limit) |
| D29 | GET `/dhani/assignments?weaver_id=&setup_id=&from=` · GET `/{id}` | History | assign.view |
| D30 | POST `/dhani/assignments/{id}/actions/cancel` `{reason, return_yarn: true}` | Only for pieces not yet received. Cancels the queued pieces, records the yarn return and asks for the advance back (an entry, not a delete) | assign.delete |
| D31 | PATCH `/dhani/pieces/{id}` `{eta, note, colours?}` | Changes one piece before it is received | assign.edit |

## 6. Yarn and materials
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D32 | POST `/dhani/weavers/{id}/yarn` 💰 `{dir: give\|return\|adjust, lines:[{material, qty_mg}], note}` | One endpoint for extra yarn given, take-back (`takeBack`) and corrections | yarn.create |
| D33 | GET `/dhani/materials/stock` | Stock in the Dhani's store per material: on hand, with weavers, and value at the current rate | yarn.view |
| D34 | POST `/dhani/materials/purchases` 💰 `{party_id, lines:[{material, qty_mg, rate_paise}], mode, paid_paise, bill_file_id}` | Stock goes up. Writes a Kharchu ledger entry, plus a payable if it was only part-paid | yarn.create + khatha.create |
| D35 | POST `/dhani/materials/adjustments` `{lines, reason}` · GET `/dhani/materials/moves?material=&from=` | Stock count corrections and the move history | yarn.edit / .view |

## 7. Receive (QC)
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D36 | GET `/dhani/receive/expected?weaver_id=&due_within_days=` | Pieces expected, used to pick the weaver. Late pieces come first | receive.view |
| D37 | POST `/dhani/receipts/preview` `{piece_id, defects[], grade?, deduction_paise?, cut_advance, pay: now\|later}` | Returns the kooli, defect cut, advance cut, amount to pay now, net after, the grade the server computes when none is given (A if there are no defects, B if 1–2, C if 3 or more), cost and suggested price | receive.view |
| D38 | POST `/dhani/receipts` 💰 | Body: `{piece_id, colours_match, alt_colours?, defects[], grade, length_mm, deduction_paise, cut_advance, pay, mode: cash\|upi\|bank, photo_file_ids[]}`. **Atomic** (`doReceive`). Marks the piece done and moves the next queued piece onto the loom. Writes earned (wage − deduction), the advance cut, the payment made now (weaver money plus a Kharchu line), and yarn consumed from `mat`. Creates the godown item with a gap-free tag `S-####`, cost from the rates valid on that date, and grade. Updates the projections. Returns the tag, a summary and `undo_token` | receive.create (+ weaver_money.create when paying now) |
| D39 | GET `/dhani/receipts?from=&to=&weaver_id=` · GET `/{id}` | Receipts log | receive.view |
| D40 | POST `/dhani/receipts/{id}/actions/reverse` `{reason}` | Only while the godown item is still in stock. Every entry is reversed with a mirror entry | receive.delete (+ step-up after 7 days) |

## 8. Weaver money
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D41 | POST `/dhani/weavers/{id}/money` 💰 `{kind, amount_paise?, mode, note}` | **One endpoint** for every weaver money move. `kind` values: `pay_kooli` (`payKooli`; the default amount is the kooli due, and it can't exceed it); `advance` (`giveAdv`); `cut_advance` (`cutAdv`; min of kooli due and advance out); `advance_return` (`advBack`; cash returned); `adjust` (Owner only, with a reason). Cash kinds also write the ledger line (Kharchu for pay_kooli and advance, Jama for advance_return). Kinds are strategies in a registry | weaver_money.create |
| D42 | POST `/dhani/weaver-money/{entry_id}/actions/reverse` `{reason}` | Mirror entry plus a mirror ledger line | weaver_money.delete (+ step-up after 7 days) |

**Balance formulas** (the same as `wStats`, all in paise):
- `kooli_due = Σearned − Σpaid − Σcut`
- `advance_out = Σadvance − Σrecover − Σcut`
- `net = kooli_due − advance_out`, where a positive net means "you pay" and a negative net means "owes you"
- `yarn_held[m] = Σgive − Σreturn − Σconsume`

**Status**, in priority order: `hold` → `late` (next ETA before today) → `weaving` → `to_pay` (net > 0 with nothing on the loom) → `owes_you` → `free`.

## 9. Godown and sales
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D43 | GET `/dhani/godown?status=stock\|reserved\|sold&colour=&design_id=&weaver_id=&grade=&setup_id=&q=&cursor=&limit=24` | Godown list | godown.view |
| D44 | GET `/dhani/godown/counts` · GET `/dhani/godown/summary` | Counts, plus value at cost and at list price, by colour and by design | godown.view |
| D45 | GET `/dhani/godown/{tag}` | The saree sheet: design, colours, weaver, lot, grade, defects, length, a cost breakdown (silk, zari, dye, kooli; masked without `see_cost_margin`), the suggested price (`priceOf`) and history | godown.view |
| D46 | PATCH `/dhani/godown/{tag}` `{grade, list_price_paise, location, photo_file_ids, note}` | Edit | godown.edit |
| D47 | POST `/dhani/godown/{tag}/actions/reserve` `{party_id, until, price_paise, advance_paise?}` · `unreserve` | An advance also writes a Jama line | godown.edit (sales.create for an advance) |
| D48 | POST `/dhani/sales` 💰 | Body: `{party_id \| walk_in_name, lines:[{tag, price_paise}], discount_paise, payments:[{mode, amount_paise}], due_date?, note}`. Locks the tags (`FOR UPDATE`); they must be in stock or reserved for this party. Numbers the bill `B-####`, marks the items sold, writes Jama for the amount paid and a receivable for the balance, and updates the demand stats. Returns the bill and `undo_token` | sales.create (+ approval above `max_discount_pct`) |
| D49 | GET `/dhani/sales?party_id=&status=paid\|due\|void&from=&to=` · GET `/{id}` | Sales list and detail | sales.view |
| D50 | GET `/dhani/sales/{id}/bill?lang=&format=pdf\|png` · POST `/dhani/sales/{id}/share` `{channel}` | Bill in the chosen language, and sharing it | sales.view / .export |
| D51 | POST `/dhani/sales/{id}/payments` 💰 `{mode, amount_paise}` | Collects a due amount and writes Jama | sales.create |
| D52 | POST `/dhani/sales/{id}/actions/void` `{reason}` · POST `/dhani/sales/{id}/returns` `{tags, refund_paise, mode}` | Void or return. Stock comes back and the money reverses (Kharchu refund) | sales.delete / sales.create |
| D53 | POST `/dhani/catalogues` `{tags[] \| filter, show_price, expires_in_days}` → `{url}` · DELETE `/dhani/catalogues/{id}` | A shareable catalogue for retailers | godown.export |
| D54 | GET `/v1/public/catalogues/{token}` · public, rate-limited | A read-only catalogue with images and prices; items marked sold are hidden | public |
| D55 | POST `/dhani/demand` `{colour_id?, design_id?, note, party_id?}` · GET `/dhani/demand?days=30` | Logs what customers ask for (the `asked` map). Feeds the "colours in demand" tip | sales.create / .view |

## 10. Parties and khatha
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D56 | GET `/dhani/parties?role=retailer\|customer\|yarn_shop\|zari_supplier\|dyer\|other&q=` · POST · GET `/{id}` (balance, receivable and payable) · PATCH | Buyers, suppliers, dyers | parties.* |
| D57 | GET `/dhani/parties/{id}/statement?from=&to=&format=` · POST `/dhani/parties/{id}/payments` 💰 `{dir: in\|out, amount_paise, mode, allocations?}` | Statement, and settling a party's dues | parties.view / khatha.create |
| D58 | GET `/dhani/ledger?dir=in\|out&from=&to=&party_id=&role=&category=&mode=&q=&group=day&cursor=` | Khatha: Jama and Kharchu grouped by day | khatha.view |
| D59 | GET `/dhani/ledger/summary?from=&to=` | Cash in hand per mode (cash, UPI, bank), totals of Jama and Kharchu, where Kharchu went by category (kooli, advances, yarn, zari, dyeing, other), and the change from the previous period | khatha.view |
| D60 | POST `/dhani/ledger` 💰 `{dir, amount_paise, party_id?, who?, category, mode, note, date, file_id?}` | A manual entry for other income or expenses (electricity, transport…). System-linked entries are created only by their own use cases | khatha.create |
| D61 | GET `/dhani/ledger/{id}` · POST `/dhani/ledger/{id}/actions/reverse` `{reason}` | Reversal writes a mirror entry. A linked entry reverses through its source (a receipt, sale or weaver money entry) | khatha.view / .delete |
| D62 | POST `/dhani/cash/count` `{mode, counted_paise, note}` | A day-end cash count; any difference goes in as an adjustment line | khatha.approve |

## 11. Home, search, reports, sync
| # | Method & path | Purpose | Perm |
|---|---|---|---|
| D63 | GET `/dhani/home` | Home in one call, read from projections and cached for 30 s: today's Jama, Kharchu and received count; the saree flow (in setup, on looms, received, in godown, sold this month); sarees on looms now; godown value; total kooli due; advances out; and the **tips** (late weavers, colours in demand compared with stock, free looms, kooli due, low yarn stock), each with a deep-link target | home.view |
| D64 | GET `/dhani/search?q=&types=` | Weavers (name, alt name, phone blind index, village), tags `S-####`, designs `DKS-`, setups `SET-`, parties, bills and ledger. Direct answers such as "Ravi Kumar owes ₹3,500" or "S-0103 · in godown · ₹14,200" | per-type view |
| D65 | GET `/dhani/reports/{key}?from=&to=&format=json\|csv\|xlsx\|pdf&lang=` | Keys: `weaver-productivity`, `kooli-register`, `advances-outstanding`, `yarn-reconciliation` (given, consumed, returned and held per weaver, with a leakage flag), `godown-valuation`, `sales-register`, `design-performance`, `colour-demand`, `lot-profit` (per setup), `monthly-khatha`, `receivables`, `payables` | reports.view / .export |
| D66 | POST `/dhani/sync/push` `{ops:[{client_op_id, type, payload, base_version?, created_at}]}` | Offline queue (poor village networks). At most 200 ops. Applied in order and idempotently; returns `[{client_op_id, status: ok\|conflict\|rejected, result\|problem}]`. The allowed `type` values map one-to-one to the write endpoints above | same perms as the target endpoints |
| D67 | GET `/dhani/sync/pull?since=&limit=500` | Change feed (entity, id, op, version, data) and `next_since` | tenant member |

**Total: 67 numbered rows, which expand to about 105 operations.** Together with 03, the numbered rows run 1–175 and D1–D67.

## Events (outbox) emitted by Dhani
`DesignSaved`, `SetupSaved`, `LotAssigned`, `PieceRescheduled`, `WeaverHeld`, `WeaverResumed`, `WorkMoved`, `YarnMoved`, `SareeReceived`, `ReceiptReversed`, `WeaverMoneyPosted`, `GodownItemUpdated`, `SareeReserved`, `SaleCompleted`, `SalePaymentReceived`, `SaleVoided`, `SaleReturned`, `LedgerPosted`, `LedgerReversed`, `RatesChanged` and `DemandLogged`.

The consumers are the projections (`weaver_stats`, `godown_counts`, `home_tiles`), search indexing, notifications (a late weaver, a kooli due after 3 days, low yarn stock) and the WhatsApp templates.
