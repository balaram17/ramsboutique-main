# Rams Boutique Monthly Grocery Saving Scheme

This module is integrated with the existing React, FastAPI, Motor/MongoDB, JWT, OTP and Razorpay architecture.

## Important implementation decision

The live project uses MongoDB through Motor. SQLAlchemy is an ORM for relational databases, so adding SQLAlchemy models would create a second, incompatible database layer. The requested entities are implemented as MongoDB collections named `chit_plans`, `chit_plan_items`, `chit_subscriptions`, `chit_payments`, and `chit_delivery_slots`.

## Configure

1. Install backend requirements: `pip install -r backend/requirements.txt`.
2. Copy values from `backend/.env.chits.example` into the deployed backend environment settings. Never commit secrets.
3. In Razorpay Dashboard, create a webhook pointing to `https://YOUR-BACKEND/api/chits/webhook` and subscribe to:
   - `subscription.charged`
   - `subscription.payment_failed`
   - `subscription.halted`
   - `subscription.cancelled`
4. Use the exact same secret in `RAZORPAY_WEBHOOK_SECRET`.
5. Enable UPI Autopay/eMandate on the Razorpay account. Razorpay account approval and mandate limits control which methods appear.
6. Create and approve three Meta WhatsApp templates matching the configured names. Each template receives customer name and card number as body parameters.
7. Deploy frontend and backend. MongoDB indexes and the 40 master items are seeded idempotently at backend startup.

## Routes

- Customer: `/schemes`, `/schemes/join/:duration`, `/my-chit`
- Admin: `/admin/chits`

## Payment behavior

- One month: Razorpay Order for ₹500.
- Three, six, twelve months: a monthly Razorpay Plan plus Subscription with `total_count` equal to duration and billing beginning on the next 10th. Checkout first authorises the mandate; only a `subscription.charged` webhook counts as a ₹500 instalment.
- Webhook processing is signature-checked and payment-idempotent.
- After the last paid instalment status becomes `ready_for_delivery`.
- Slot booking creates a ₹50 Razorpay Order. Only after signature verification is the slot and final chit delivery order written.

## Operational notes

- The scheduler runs inside the API process at 09:00 Asia/Kolkata. If Azure App Service uses multiple Gunicorn workers, run exactly one scheduler instance (or move `daily_due_check` to an Azure Function/cron worker) to avoid duplicate WhatsApp reminders.
- Ensure Always On is enabled for the Azure App Service, or use an external scheduled service.
- Confirm the Telugu/English master-item names against the printed vendor card before production launch; the source photograph is partially blurred.
- Have the scheme terms, cancellation/refund handling, recurring mandate disclosures and applicable Indian regulatory treatment reviewed by a qualified legal/compliance professional before accepting public subscriptions.
