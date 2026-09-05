# COVE Subscription & Billing Blueprint v1.0

**Produk:** COVE — Construction Operations Value Engine  
**Tanggal:** 4 September 2026  
**Status:** Acuan Phase 13–20  
**Tujuan:** Mengubah COVE menjadi B2B SaaS berlangganan dengan pengalaman akses seperti Netflix, tanpa mengubahnya menjadi produk konsumen murah.

---

## 1. Keputusan Utama

COVE menggunakan model:

> Paid Pilot → Company Subscription → Active Project Expansion → Enterprise Expansion

“Seperti Netflix” berarti:

- pelanggan memilih paket;
- pembayaran atau otorisasi recurring dilakukan;
- akses aktif otomatis setelah webhook terverifikasi;
- paket menentukan entitlement;
- subscription diperpanjang berkala;
- pembayaran gagal memasuki grace period;
- pembatalan berlaku pada akhir periode;
- data tidak langsung dihapus.

COVE tetap merupakan B2B SaaS dengan onboarding, contract setup, data mapping, customer success, dan kontrol keamanan.

---

## 2. Hubungan dengan PRD Utama

Dokumen ini harus dibaca bersama:

- COVE_PRD_v1.0_Validation_Gated_MVP.md
- seluruh source code, migration, test, dan dokumentasi hasil Phase 1–12.

Hierarki:

1. Instruksi pengguna pada percakapan aktif.
2. Blueprint subscription ini untuk billing, entitlement, renewal, dan access lifecycle.
3. PRD COVE v1.0 untuk domain Progress-to-Invoice.
4. Perilaku aplikasi lama yang telah lulus regression.

Blueprint subscription tidak mengubah:

- stage dan leakage;
- pencegahan double-count;
- Claim Readiness;
- Action Queue;
- ROI attribution;
- audit trail domain;
- batas hukum dan pajak.

---

## 3. Prinsip Non-Negotiable

1. Subscription dimiliki company/organization, bukan user individual.
2. Akses tidak boleh dibuka hanya berdasarkan redirect success page.
3. Aktivasi terjadi setelah webhook server terverifikasi.
4. Webhook harus idempotent dan dapat diproses ulang.
5. Billing dipisahkan dari entitlement.
6. Hak akses diperiksa pada server dan database, bukan hanya UI.
7. Provider payment tidak boleh menjadi satu-satunya sumber status akses internal.
8. COVE tidak menyimpan raw card atau payment credential.
9. Payment provider harus dibungkus melalui provider adapter.
10. Data tidak langsung dihapus ketika subscription berakhir.
11. Cancellation tidak boleh dibuat sengaja sulit.
12. Manual override harus memiliki alasan, actor, scope, expiry, dan audit.
13. Tidak ada lifetime plan.
14. Tidak ada akses unlimited tanpa contractual limit.
15. Semua perubahan paket, harga, pembayaran, dan entitlement memiliki audit event.

---

## 4. Packaging Komersial

Harga masih merupakan hipotesis yang dapat diperbarui tanpa mengubah kode.

| Penawaran | Entitlement | Harga indikatif |
|---|---|---:|
| Paid Pilot | 1 proyek, maksimal 10 pengguna, 45 hari, assisted onboarding, ROI report | Rp7,5–12,5 juta |
| COVE Core | 1 proyek aktif, 10 pengguna, lima modul inti | Rp2,5 juta/bulan |
| COVE Scale | 5 proyek aktif, 25 pengguna, portfolio review penuh | Rp5 juta/bulan |
| COVE Enterprise | 15+ proyek, custom users, SSO/API/security requirement | Rp10–20 juta/bulan |
| Project Add-on | Satu proyek aktif tambahan | Rp750 ribu/proyek/bulan |
| Onboarding | Mapping, contract rules, baseline, training | Rp10–100 juta |

Aturan:

- Core dan Scale dapat menggunakan monthly recurring atau annual prepayment.
- Enterprise memakai annual contract dan invoice/VA.
- Onboarding ditagihkan terpisah.
- Harga disimpan dalam price version, bukan hard-coded.
- Existing customer tetap terikat pada price version sampai perubahan disetujui.
- Coupon dan discount memiliki start, end, reason, approver, dan limit.

---

## 5. Customer Lifecycle

| Tahap | Trigger | Output |
|---|---|---|
| Prospect | Pengunjung melihat pricing | Pilihan pilot/paket |
| Checkout Started | Pelanggan memilih paket | Checkout session |
| Pending Payment | Checkout dibuat | Menunggu provider event |
| Paid/Authorized | Provider memverifikasi | Payment record |
| Provisioning | Webhook diproses | Organization, subscription, entitlement |
| Onboarding | Owner masuk pertama kali | Company/project setup |
| Activated | Aha moment tercapai | Subscription usage dimulai |
| Renewal | Periode berikutnya dibuat | Payment cycle |
| Past Due | Payment gagal | Dunning dan grace period |
| Read Only | Grace berakhir | Lihat dan ekspor |
| Suspended | Pembayaran tetap gagal | Billing/support/export terbatas |
| Cancelled | Periode berakhir | Workflow nonaktif |
| Reactivated | Pembayaran baru berhasil | Entitlement dipulihkan |

---

## 6. Subscription State Machine

Status minimum:

| Status | Arti | Hak akses |
|---|---|---|
| DRAFT | Akun/checkout belum selesai | Pricing dan account setup |
| PENDING_PAYMENT | Menunggu pembayaran | Tidak ada akses proyek |
| PILOT_ACTIVE | Paid pilot berjalan | Entitlement pilot |
| ACTIVE | Periode sudah dibayar | Akses penuh |
| CANCEL_AT_PERIOD_END | Pembatalan terjadwal | Penuh sampai period end |
| PAST_DUE | Pembayaran gagal | Penuh selama grace |
| READ_ONLY | Grace berakhir | Lihat dan ekspor |
| SUSPENDED | Tunggakan berlanjut | Billing, support, export terbatas |
| CANCELLED | Subscription berakhir | Tidak dapat menjalankan workflow |
| EXPIRED | Pilot atau fixed term selesai | Renewal/reactivation |
| MANUAL_GRANT | Akses khusus berjangka | Sesuai override |

Transisi status hanya dapat terjadi melalui:

- verified provider event;
- scheduled lifecycle job;
- authorized admin action;
- approved migration.

Setiap transisi mencatat from status, to status, reason, source, actor/event, timestamp, dan correlation ID.

---

## 7. Dunning dan Gagal Bayar

Default awal:

| Waktu | Aksi | Akses |
|---|---|---|
| H-7 | Reminder | Penuh |
| H-1 | Reminder terakhir | Penuh |
| Hari H | Payment attempt | Penuh |
| H+1 | PAST_DUE | Penuh |
| H+3 | Retry/reminder | Penuh |
| H+7 | Grace berakhir | READ_ONLY |
| H+14 | Final warning | READ_ONLY |
| H+21 | SUSPENDED | Billing/support/export |
| H+90 | Retention review | Tidak boleh auto-delete tanpa policy |

Retry aktual mengikuti kemampuan provider. COVE tetap menyimpan internal dunning schedule dan hasil event.

---

## 8. Entitlement

Entitlement minimum:

- max_active_projects;
- max_users;
- import_enabled;
- value_gap_ledger_enabled;
- claim_readiness_enabled;
- action_queue_enabled;
- portfolio_review_level;
- roi_ledger_enabled;
- audit_level;
- email_digest_enabled;
- export_enabled;
- api_enabled;
- sso_enabled;
- storage_limit;
- support_tier.

Aturan:

- Semua entitlement diperiksa server-side.
- UI dapat menyembunyikan fitur, tetapi backend tetap menolak unauthorized request.
- Jika downgrade menyebabkan jumlah proyek berlebih, pelanggan memilih proyek aktif.
- Proyek lain menjadi archived/read-only, bukan dihapus.
- Subscription berakhir tidak menghapus stage history, audit, atau evidence metadata.
- Project add-on menambah limit hanya setelah payment/contract evidence valid.

---

## 9. Data Model Konseptual

| Entitas | Fungsi |
|---|---|
| organizations | Tenant/perusahaan |
| billing_customers | Hubungan organization dengan provider |
| plans | Definisi paket |
| prices | Harga bertanggal |
| plan_entitlements | Fitur dan limit paket |
| subscriptions | Lifecycle langganan |
| subscription_items | Base plan dan add-on |
| subscription_status_events | Histori transisi |
| billing_invoices | Tagihan per periode |
| payments | Pembayaran terverifikasi |
| payment_attempts | Percobaan berhasil/gagal |
| webhook_events | Event mentah dan status pemrosesan |
| entitlement_snapshots | Hak akses efektif |
| usage_records | Proyek/users/storage yang dipakai |
| subscription_overrides | Manual grant/adjustment |
| discounts | Coupon/discount rule |
| billing_audit_logs | Histori tindakan billing |

Subscription field minimum:

- id;
- organization_id;
- plan_id;
- price_id;
- provider;
- provider_customer_id;
- provider_subscription_id;
- billing_interval;
- status;
- current_period_start;
- current_period_end;
- cancel_at_period_end;
- grace_period_end;
- next_billing_date;
- currency;
- created_at;
- updated_at.

---

## 10. Payment Provider Adapter

Interface konseptual:

- createCustomer;
- createCheckoutSession;
- createSubscription;
- getSubscription;
- changeSubscription;
- cancelSubscription;
- reactivateSubscription;
- createPayment;
- getPayment;
- refundPayment;
- verifyWebhook;
- normalizeWebhookEvent;
- listTransactions;
- reconcileSubscription.

Business logic COVE tidak boleh bergantung langsung pada nama status provider.

Provider event harus dinormalisasi menjadi internal event:

- CHECKOUT_COMPLETED;
- SUBSCRIPTION_ACTIVATED;
- BILLING_CYCLE_CREATED;
- PAYMENT_SUCCEEDED;
- PAYMENT_FAILED;
- SUBSCRIPTION_CHANGED;
- CANCELLATION_SCHEDULED;
- SUBSCRIPTION_CANCELLED;
- SUBSCRIPTION_EXPIRED;
- REFUND_COMPLETED.

---

## 11. Webhook Processing

Alur wajib:

1. Endpoint menerima event.
2. Signature diverifikasi.
3. Provider event ID diperiksa.
4. Event mentah disimpan.
5. Response cepat diberikan kepada provider.
6. Event diproses secara aman/idempotent.
7. Payment dan subscription diperbarui dalam transaksi.
8. Entitlement snapshot dibuat.
9. Audit event dicatat.
10. Error masuk retry/dead-letter queue.
11. Reconciliation job memeriksa event yang tertinggal.

Larangan:

- tidak membuka akses dari query parameter success;
- tidak mempercayai amount dari client;
- tidak memproses event yang signature-nya gagal;
- tidak membuat payment/invoice ganda;
- tidak mencetak secret atau full payload sensitif;
- tidak menghapus failed event.

---

## 12. Upgrade, Downgrade, Cancel, dan Reactivate

### Upgrade

- Berlaku segera atau next cycle sesuai policy.
- Selisih harga/proration harus terlihat.
- Entitlement bertambah setelah verified payment.
- Jika pembayaran upgrade gagal, entitlement lama tetap berlaku.

### Downgrade

- Default berlaku akhir periode.
- Pelanggan diberi impact preview.
- Jika usage melebihi paket baru, pengguna harus memilih proyek yang tetap aktif.
- Data proyek lain dipertahankan sebagai read-only/archive.

### Cancel

- Default cancel at period end.
- Tanggal akses berakhir ditampilkan.
- Pelanggan dapat membatalkan cancellation sebelum period end.
- Churn reason dicatat.
- Export tersedia.

### Reactivate

- Sebelum period end: batalkan scheduled cancellation.
- Setelah expired/suspended: buat payment/authorization baru.
- Jangan membuat tenant baru bila organization lama masih valid.

### Refund

- Refund dicatat terpisah dari cancellation.
- Refund tidak otomatis menghapus data.
- Dampak entitlement mengikuti policy yang eksplisit.

---

## 13. Customer Billing Pages

1. Pricing.
2. Pilot/plan selection.
3. Checkout.
4. Payment pending.
5. Payment success.
6. Payment failed.
7. First onboarding.
8. Subscription overview.
9. Current plan and usage.
10. Billing history.
11. Invoice/receipt download.
12. Upgrade plan.
13. Downgrade impact preview.
14. Cancel subscription.
15. Reactivate subscription.
16. Read-only warning.
17. Suspended account page.
18. Data export.

Semua halaman memiliki loading, empty, success, error, permission denied, expired session, dan retry state.

---

## 14. COVE Admin Billing Pages

1. Customer directory.
2. Subscription detail.
3. Payment attempts.
4. Failed webhook queue.
5. Event replay.
6. Reconciliation.
7. Manual entitlement override.
8. Subscription migration.
9. Refund record.
10. Coupon/discount management.
11. Churn reason.
12. MRR/ARR reporting.
13. Pilot conversion.
14. Audit log.

Manual action tidak boleh dilakukan tanpa authorization, reason, confirmation, dan audit.

---

## 15. Roles dan Permissions

| Tindakan | Company Owner | Billing Admin | Member | COVE Admin |
|---|---:|---:|---:|---:|
| Lihat paket | Ya | Ya | Terbatas | Ya |
| Lihat billing history | Ya | Ya | Tidak | Ya, scoped |
| Upgrade/downgrade | Ya | Ya | Tidak | Assisted |
| Cancel/reactivate | Ya | Ya | Tidak | Assisted |
| Kelola payment method | Ya | Ya | Tidak | Tidak melihat credential |
| Lihat project usage | Ya | Ya | Terbatas | Scoped |
| Manual override | Tidak | Tidak | Tidak | Authorized only |
| Replay webhook | Tidak | Tidak | Tidak | Authorized only |
| Export data | Ya | Sesuai role | Sesuai role | Assisted/scoped |

---

## 16. Security dan Audit

- Row Level Security/tenant isolation tetap berlaku.
- Service role tidak pernah tersedia di browser.
- Webhook secret disimpan sebagai server secret.
- Admin billing menggunakan least privilege dan MFA.
- Semua access override memiliki expiry.
- Tidak menyimpan raw card, CVV, atau reusable payment credential.
- Log melakukan masking terhadap email, phone, token, dan payload sensitif.
- Rate limit checkout, webhook, dan admin action.
- Idempotency key pada create checkout/payment/subscription.
- Reconciliation job memiliki alert.
- Backup dan restore mencakup subscription, payment, entitlement, dan audit.
- Production gateway hanya diaktifkan setelah sandbox UAT lulus.

---

## 17. Metrik Subscription

- MRR;
- ARR;
- ARPA;
- new MRR;
- expansion MRR;
- contraction MRR;
- voluntary churn;
- involuntary churn;
- failed-payment recovery;
- Gross Revenue Retention;
- Net Revenue Retention;
- paid-pilot conversion;
- time-to-first-value;
- activation rate;
- project expansion rate;
- customer support cost;
- gross margin.

Target awal:

- paid-pilot conversion ≥50%;
- project kedua dalam 90 hari ≥40%;
- weekly active champion ≥70%;
- failed-payment recovery ≥60%;
- subscription gross margin matang ≥75%;
- zero unauthorized activation;
- zero duplicate charge caused by COVE.

---

## 18. UAT Subscription Minimum

1. Pembayaran berhasil mengaktifkan tenant satu kali.
2. Redirect success tanpa webhook tidak membuka akses.
3. Webhook duplikat tidak membuat subscription/payment ganda.
4. Signature salah ditolak.
5. Payment amount tidak sesuai masuk exception.
6. Subscription ACTIVE memberikan entitlement sesuai paket.
7. Project limit ditolak server-side.
8. User limit ditolak server-side.
9. Upgrade berhasil menambah entitlement.
10. Upgrade gagal mempertahankan entitlement lama.
11. Downgrade berlaku pada waktu yang ditetapkan.
12. Usage berlebih menghasilkan impact resolution.
13. Cancel at period end tidak memutus akses lebih awal.
14. Reactivation memulihkan subscription lama.
15. Payment gagal memasuki PAST_DUE.
16. Grace berakhir memasuki READ_ONLY.
17. READ_ONLY tetap dapat melihat dan mengekspor sesuai policy.
18. SUSPENDED tidak dapat memutakhirkan data proyek.
19. Manual override berakhir otomatis.
20. User lintas tenant tidak dapat membaca billing metadata.
21. Company member tidak dapat mengubah billing.
22. Failed webhook dapat di-retry tanpa duplikasi.
23. Reconciliation menemukan missing event.
24. Refund tidak menghapus tenant/data.
25. Cancellation dan churn reason tercatat.
26. Existing Phase 1–12 features tetap lulus regression.

---

## 19. Phase 13–20

### Phase 13 — Subscription Product Audit

Audit existing billing, authentication, tenant, pricing, routes, tables, webhook, dan access guards. Buat traceability dan keputusan provider. Tidak ada coding bisnis.

### Phase 14 — Billing Data Model dan Entitlement

Implement plans, prices, subscriptions, items, entitlements, usage, status events, override, audit, dan server access guard.

### Phase 15 — Checkout dan Webhook

Implement sandbox checkout, provider adapter, signature verification, idempotency, normalized events, activation, retry, dan reconciliation.

### Phase 16 — Customer Billing Portal

Implement overview, history, invoice/receipt, usage, upgrade, downgrade, cancel, reactivate, serta payment states.

### Phase 17 — Renewal dan Dunning

Implement billing cycle, reminder, payment retry, grace period, read-only, suspension, dan restoration.

### Phase 18 — Admin Billing Control

Implement customer billing administration, failed-event queue, reconciliation, override, refund record, discount, churn, dan metrics.

### Phase 19 — Security, Regression, dan UAT

Jalankan security, tenant isolation, webhook, concurrency, billing lifecycle, edge cases, dan regression test seluruh fitur Phase 1–12.

### Phase 20 — Controlled Subscription Launch

Final sandbox-to-production checklist, legal pages, pricing, monitoring, support SOP, migration pilot customer, rollback plan, dan launch recommendation. Tidak deploy tanpa persetujuan.

---

## 20. Provider Decision

Mayar boleh dievaluasi untuk checkout, SaaS/membership, dan webhook. Jangan menganggap payment link satu kali sama dengan auto-recurring.

Bandingkan provider berdasarkan:

- recurring scheduler;
- payment tokenization;
- hosted checkout;
- payment methods;
- retry/dunning;
- webhook completeness;
- idempotency;
- sandbox;
- refunds;
- reconciliation;
- settlement;
- fees;
- activation requirements;
- security/compliance.

Keputusan provider final dibuat pada Phase 13.

---

## 21. Definition of Done

Subscription dianggap selesai bila:

1. pembayaran terverifikasi dapat mengaktifkan entitlement;
2. success redirect tidak dapat membuka akses;
3. duplicate webhook aman;
4. tenant isolation lulus;
5. project/user limits ditegakkan server-side;
6. upgrade, downgrade, cancellation, dan reactivation bekerja;
7. payment failure memasuki dunning yang benar;
8. grace, read-only, dan suspension bekerja;
9. data tidak terhapus karena gagal bayar;
10. billing portal lengkap;
11. admin control diaudit;
12. reconciliation job bekerja;
13. metrics dapat dihitung;
14. seluruh UAT lulus;
15. fitur COVE Phase 1–12 tidak mengalami regresi;
16. zero critical/high unresolved security issue;
17. rollback plan tersedia;
18. production activation memperoleh persetujuan pengguna.

---

## 22. Larangan Scope

Jangan:

- membuat lifetime plan;
- menaruh is_paid pada user sebagai satu-satunya access rule;
- menyimpan card credential;
- membuka akses dari client success page;
- menghapus tenant saat payment gagal;
- mengubah domain Progress-to-Invoice;
- mengganti stack tanpa persetujuan;
- mengaktifkan production payment tanpa sandbox UAT;
- menghapus fitur lama;
- mengerjakan Phase 14 sebelum Phase 13 disetujui.

**Status dokumen:** siap digunakan Antigravity sebagai sumber kebenaran Phase 13–20.
