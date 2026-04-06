-- ============================================================
-- 008_indexes.sql
-- 설명: 성능 최적화를 위한 인덱스
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role           ON profiles(role);
CREATE INDEX idx_profiles_affiliate_code ON profiles(affiliate_code);

-- products
CREATE INDEX idx_products_category    ON products(category);
CREATE INDEX idx_products_is_active   ON products(is_active);
CREATE INDEX idx_products_slug        ON products(slug);

-- product_prices
CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_type       ON product_prices(type);

-- orders
CREATE INDEX idx_orders_user_id               ON orders(user_id);
CREATE INDEX idx_orders_status                ON orders(status);
CREATE INDEX idx_orders_lemon_squeezy_order_id ON orders(lemon_squeezy_order_id);
CREATE INDEX idx_orders_created_at            ON orders(created_at DESC);

-- licenses
CREATE INDEX idx_licenses_user_id    ON licenses(user_id);
CREATE INDEX idx_licenses_product_id ON licenses(product_id);
CREATE INDEX idx_licenses_serial_key ON licenses(serial_key);
CREATE INDEX idx_licenses_status     ON licenses(status);

-- license_activations
CREATE INDEX idx_license_activations_license_id ON license_activations(license_id);

-- subscriptions
CREATE INDEX idx_subscriptions_user_id                      ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status                       ON subscriptions(status);
CREATE INDEX idx_subscriptions_lemon_squeezy_subscription_id ON subscriptions(lemon_squeezy_subscription_id);
CREATE INDEX idx_subscriptions_current_period_end           ON subscriptions(current_period_end);

-- support_tickets
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status  ON support_tickets(status);
CREATE INDEX idx_support_tickets_is_read ON support_tickets(is_read);

-- support_replies
CREATE INDEX idx_support_replies_ticket_id ON support_replies(ticket_id);

-- affiliates
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);

-- affiliate_referrals
CREATE INDEX idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_order_id     ON affiliate_referrals(order_id);
CREATE INDEX idx_affiliate_referrals_status       ON affiliate_referrals(status);

-- affiliate_withdrawals
CREATE INDEX idx_affiliate_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX idx_affiliate_withdrawals_status       ON affiliate_withdrawals(status);

-- changelogs
CREATE INDEX idx_changelogs_product_id   ON changelogs(product_id);
CREATE INDEX idx_changelogs_release_date ON changelogs(release_date DESC);
CREATE INDEX idx_changelogs_is_latest    ON changelogs(is_latest);
