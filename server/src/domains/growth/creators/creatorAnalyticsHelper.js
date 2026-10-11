/**
 * creatorAnalyticsHelper.js
 *
 * Dedicated helper to compute creator time-series analysis, business earnings breakdown,
 * and leaderboard queries for CreatorService.
 */
import { pool } from '../../../infrastructure/database/database.js';

export async function fetchCreatorSeriesAnalysis(creatorId, analysisPeriod) {
    const { rows } = await pool.query(
        `SELECT TO_CHAR(period_start, $2) AS period,
              period_start,
              SUM(sales_count)::int AS sales,
              SUM(sales_value)::numeric AS sales_value,
              SUM(commission_earnings)::numeric AS commission_earnings,
              SUM(referral_earnings)::numeric AS referral_earnings,
              (SUM(commission_earnings) + SUM(referral_earnings))::numeric AS earnings,
              SUM(clicks)::int AS clicks
       FROM (
         SELECT DATE_TRUNC('${analysisPeriod.unit}', ce.created_at) AS period_start,
                COUNT(*) AS sales_count,
                COALESCE(SUM(po.total_amount), 0) AS sales_value,
                COALESCE(SUM(ce.amount), 0) AS commission_earnings,
                0 AS referral_earnings,
                0 AS clicks
         FROM creator_earnings ce
         JOIN product_orders po ON po.id = ce.order_id
         WHERE ce.creator_id = $1
           AND ce.status = 'credited'
           AND ce.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', ce.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', cre.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                0 AS commission_earnings,
                COALESCE(SUM(cre.amount), 0) AS referral_earnings,
                0 AS clicks
         FROM creator_referral_earnings cre
         WHERE cre.referrer_creator_id = $1
           AND cre.status = 'credited'
           AND cre.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', cre.created_at)
         UNION ALL
         SELECT DATE_TRUNC('${analysisPeriod.unit}', clc.created_at) AS period_start,
                0 AS sales_count,
                0 AS sales_value,
                0 AS commission_earnings,
                0 AS referral_earnings,
                COUNT(*) AS clicks
         FROM creator_link_clicks clc
         WHERE clc.creator_id = $1
           AND clc.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
         GROUP BY DATE_TRUNC('${analysisPeriod.unit}', clc.created_at)
       ) series
       GROUP BY period_start
       ORDER BY period_start`,
        [creatorId, analysisPeriod.labelFormat]
    );
    return rows;
}

export async function fetchCreatorBusinessEarnings(creatorId, analysisPeriod) {
    const { rows } = await pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('${analysisPeriod.unit}', cre.created_at), $2) AS period,
              DATE_TRUNC('${analysisPeriod.unit}', cre.created_at) AS period_start,
              cre.referred_seller_id AS seller_id,
              s.shop_name,
              SUM(cre.amount)::numeric AS earnings
       FROM creator_referral_earnings cre
       JOIN sellers s ON s.id = cre.referred_seller_id
       WHERE cre.referrer_creator_id = $1
         AND cre.status = 'credited'
         AND cre.created_at >= NOW() - INTERVAL '${analysisPeriod.interval}'
       GROUP BY period_start, cre.referred_seller_id, s.shop_name
       ORDER BY period_start`,
        [creatorId, analysisPeriod.labelFormat]
    );
    return rows;
}

export async function fetchCreatorLeaderboard() {
    const { rows } = await pool.query(
        `SELECT id,
              first_name,
              last_name,
              total_sales,
              total_earnings,
              total_referral_earnings,
              (total_earnings + total_referral_earnings) AS total_income
       FROM creators
       WHERE status = 'active'
       ORDER BY total_income DESC, total_sales DESC, id ASC
       LIMIT 10`
    );
    return rows;
}

export default {
    fetchCreatorSeriesAnalysis,
    fetchCreatorBusinessEarnings,
    fetchCreatorLeaderboard
};
