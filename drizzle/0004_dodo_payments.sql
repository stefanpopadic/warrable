-- Rename Stripe-specific payment columns to provider-neutral names.
ALTER TABLE placements RENAME COLUMN stripe_checkout_session_id TO checkout_session_id;
ALTER TABLE placements RENAME COLUMN stripe_payment_intent_id TO payment_id;

ALTER TABLE stripe_events RENAME TO payment_events;
