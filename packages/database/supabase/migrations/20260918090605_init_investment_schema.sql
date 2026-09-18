-- 0. Helper Functions & Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Investors Table
CREATE TABLE public.investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('INDIVIDUAL', 'INSTITUTIONAL')),
    country_iso VARCHAR(2) NOT NULL,
    accreditation_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED' CHECK
        (accreditation_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_investors_updated_at
    BEFORE UPDATE ON public.investors
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Investor Wallets Table
CREATE TABLE public.investor_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    wallet_address_evm VARCHAR(42) NOT NULL UNIQUE, -- 0x checksummed format
    hedera_account_id VARCHAR(32) NULL,             -- 0.0.xxxxx format
    wallet_type VARCHAR(50) NOT NULL DEFAULT 'EMBEDDED' CHECK (wallet_type IN ('EMBEDDED', 'EXTERNAL')),
    is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE,
    whitelisted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investor_wallets_investor_id ON public.investor_wallets(investor_id);
CREATE INDEX idx_investor_wallets_address ON public.investor_wallets(wallet_address_evm);

-- 3. KYC Verifications Table
CREATE TABLE public.kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK 
        (document_type IN ('PASSPORT', 'NATIONAL_ID', 'CERTIFICATE_OF_INCORPORATION', 'PROOF_OF_ADDRESS')),
    document_storage_path VARCHAR(512) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK 
        (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason TEXT NULL,
    reviewed_by_user_id UUID NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_verifications_investor_id ON public.kyc_verifications(investor_id);
CREATE INDEX idx_kyc_verifications_status ON public.kyc_verifications(verification_status);

CREATE TRIGGER set_kyc_updated_at
    BEFORE UPDATE ON public.kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Investment Offerings & Products
CREATE TABLE public.investment_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    asset_symbol VARCHAR(10) NOT NULL DEFAULT 'MEAT',
    smart_contract_address VARCHAR(42) NOT NULL,
    target_valuation_cents BIGINT NOT NULL,          -- 180000000 = $1,800,000.00
    nominal_token_price_cents BIGINT NOT NULL,      -- 100 = $1.00
    total_token_supply BIGINT NOT NULL,             -- 1,800,000 tokens
    decimals INT NOT NULL DEFAULT 4,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Subscriptions & Fiat Allocations
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES public.investors(id),
    product_id UUID NOT NULL REFERENCES public.investment_products(id),
    wallet_id UUID NOT NULL REFERENCES public.investor_wallets(id),
    fiat_amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    token_quantity_allocated NUMERIC(20, 4) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK 
        (payment_method IN ('WIRE_TRANSFER', 'M_PESA', 'ESCROW', 'CARD', 'PAYSTACK')),
    payment_reference VARCHAR(255) NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED' CHECK 
        (status IN ('SUBMITTED', 'FUNDS_RECEIVED', 'SETTLED', 'ALLOCATED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_investor ON public.subscriptions(investor_id);
CREATE INDEX idx_subscriptions_product ON public.subscriptions(product_id);
CREATE INDEX idx_subscriptions_wallet ON public.subscriptions(wallet_id);
CREATE INDEX idx_subscriptions_reference ON public.subscriptions(payment_reference);

CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. On-Chain Token Allocations Ledger
CREATE TABLE public.token_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL UNIQUE REFERENCES public.subscriptions(id),
    recipient_evm_address VARCHAR(42) NOT NULL,
    tokens_transferred NUMERIC(20, 4) NOT NULL,
    transaction_hash VARCHAR(128) NOT NULL UNIQUE,
    block_number BIGINT NULL,
    execution_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK 
        (execution_status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_allocations_subscription ON public.token_allocations(subscription_id);
CREATE INDEX idx_token_allocations_recipient ON public.token_allocations(recipient_evm_address);

-- 7. Corporate Actions & Dividends
CREATE TABLE public.dividend_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.investment_products(id),
    total_distribution_amount_cents BIGINT NOT NULL,
    record_date TIMESTAMPTZ NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    onchain_snapshot_id VARCHAR(128) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'EXECUTED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dividend_distributions_product ON public.dividend_distributions(product_id);

CREATE TABLE public.dividend_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID NOT NULL REFERENCES public.dividend_distributions(id),
    investor_id UUID NOT NULL REFERENCES public.investors(id),
    wallet_address_evm VARCHAR(42) NOT NULL,
    entitled_amount_cents BIGINT NOT NULL,
    payout_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID' CHECK 
        (payout_status IN ('UNPAID', 'PROCESSING', 'PAID', 'FAILED')),
    settlement_reference VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_distribution_investor UNIQUE (distribution_id, investor_id)
);

CREATE INDEX idx_dividend_payouts_distribution ON public.dividend_payouts(distribution_id);
CREATE INDEX idx_dividend_payouts_investor ON public.dividend_payouts(investor_id);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_payouts ENABLE ROW LEVEL SECURITY;