'use strict';

const { supabasePublic } = require('./_lib/supabase-public');
const { applyPublicCors, apiError } = require('./_lib/http');

function normalizeService(row) {
  const tiers = Array.isArray(row.service_price_tiers)
    ? row.service_price_tiers
        .map(tier => ({
          durationHours: Number(tier.duration_hours),
          totalPrice: tier.total_price_rub,
          period: tier.period_key,
          startsAt: tier.starts_at,
          endsAt: tier.ends_at
        }))
        .sort((a, b) => a.durationHours - b.durationHours)
    : [];

  return {
    id: row.id,
    name: row.name,
    publicName: row.public_name || row.name,
    description: row.description || '',
    publicDescription: row.public_description || row.description || '',
    pricingType: row.pricing_type,
    publicCategory: row.public_category,
    publicVisible: row.public_visible,
    active: row.active,
    legacyOnly: row.legacy_only,
    selectDuration: row.select_duration,
    minDurationHours: row.min_duration_hours == null ? null : Number(row.min_duration_hours),
    defaultDurationHours: row.default_duration_hours == null ? null : Number(row.default_duration_hours),
    fixedStart: row.fixed_start ? String(row.fixed_start).slice(0, 5) : null,
    pricingRules: row.pricing_rules || {},
    priceTiers: tiers
  };
}

module.exports = async function handler(req, res) {
  if (applyPublicCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return apiError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    const rows = await supabasePublic(
      'services?select=*,service_price_tiers(*)&active=eq.true&public_visible=eq.true&order=sort_order.asc'
    );
    return res.status(200).json({ ok: true, services: rows.map(normalizeService) });
  } catch (error) {
    console.error('[KRUG API] services failed', error.status || error.name || 'Error');
    return apiError(res, 502, 'CATALOG_UNAVAILABLE');
  }
};
