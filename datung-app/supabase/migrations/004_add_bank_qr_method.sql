-- Add bank_qr as a repayment method (replaces GCash API requirement)
ALTER TYPE repayment_method ADD VALUE IF NOT EXISTS 'bank_qr';
