import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';

class OrderReadService {
  static async getSellerDetails(client, sellerId) {
    try {
      let sellerCheck;
      try {
        sellerCheck = await client.query(
          'SELECT id, user_id, physical_address, latitude, longitude, city, location, status FROM sellers WHERE id = $1 AND status = $2 FOR UPDATE',
          [sellerId, 'active']
        );
      } catch (schemaError) {
        logger.warn('Seller schema issue, trying minimal query:', schemaError);
        sellerCheck = await client.query(
          'SELECT id, user_id, latitude, longitude FROM sellers WHERE id = $1 FOR UPDATE',
          [sellerId]
        );
      }

      if (sellerCheck.rows.length === 0) {
        throw new Error(`Seller with ID ${sellerId} not found or inactive`);
      }

      const sellerInfo = sellerCheck.rows[0];

      if (sellerInfo.user_id) {
        const userCheck = await client.query(
          'SELECT id, email, role FROM users WHERE id = $1',
          [sellerInfo.user_id]
        );

        if (userCheck.rows.length > 0) {
          const userInfo = userCheck.rows[0];
          sellerInfo.full_name = userInfo.role === 'seller' ? 'Seller' : userInfo.email;
          sellerInfo.email = userInfo.email;
          sellerInfo.whatsapp_number = null;

          try {
            const buyerContactCheck = await client.query(
              'SELECT full_name, whatsapp_number FROM buyers WHERE user_id = $1 LIMIT 1',
              [sellerInfo.user_id]
            );

            if (buyerContactCheck.rows.length > 0) {
              const buyerInfo = buyerContactCheck.rows[0];
              sellerInfo.full_name = sellerInfo.full_name || buyerInfo.full_name;
              sellerInfo.whatsapp_number = sellerInfo.whatsapp_number || buyerInfo.whatsapp_number;
            }
          } catch (buyerError) {
            logger.debug('Could not fetch buyer contact info:', buyerError);
          }
        }
      }

      sellerInfo.name = sellerInfo.full_name || 'Unknown Seller';
      return sellerInfo;
    } catch (err) {
      logger.error(`Error fetching seller info for ID ${sellerId}:`, err);
      throw err;
    }
  }

  /**
   * Fetches an order with its seller, buyer, line items (via json_agg),
   * and latest payment (via lateral join) in a single unified SQL query.
   *
   * @param {number|string} orderId
   * @param {object} [client] - Optional database client or transaction pool.
   * @returns {Promise<{ fullOrder: object, items: Array<object>, payment: object|null }|null>}
   */
  static async getOrderWithItems(orderId, client = null) {
    const db = client || pool;
    const query = `
      SELECT 
        o.id,
        o.order_number,
        o.buyer_id,
        o.seller_id,
        o.total_amount,
        o.platform_fee_amount,
        o.seller_payout_amount,
        o.payment_method,
        o.buyer_name,
        o.buyer_email,
        o.buyer_mobile_payment,
        o.buyer_whatsapp_number,
        o.shipping_address,
        o.notes,
        o.metadata,
        o.status,
        o.payment_status,
        o.payment_reference,
        o.service_requirements,
        o.fulfillment_type,
        o.delivery_location,
        o.order_type,
        o.total_quantity,
        o.reservation_expires_at,
        o.location_address,
        o.location_lat,
        o.location_lng,
        o.service_title,
        o.notification_sent,
        o.created_at,
        o.updated_at,
        o.client_checkout_token,
        o.custom_production_deadline_at,
        o.custom_production_grace_deadline_at,
        o.custom_production_reminder_sent_at,
        o.auto_cancelled_reason,
        o.seller_dropoff_deadline,
        o.buyer_pickup_deadline,
        o.ready_for_pickup_at,
        o.handoff_confirmed_at,
        o.cancelled_at,
        o.pre_handoff_sla,
        o.paid_at,
        o.is_debt,
        o.is_seller_initiated,
        o.completed_at,
        o.payment_completed_at,
        b.full_name AS buyer_name_actual,
        b.mobile_payment AS buyer_phone_actual,
        b.whatsapp_number AS buyer_whatsapp_actual,
        b.email AS buyer_email_actual,
        b.latitude AS buyer_latitude,
        b.longitude AS buyer_longitude,
        b.user_id AS buyer_user_id,
        s.user_id AS seller_user_id,
        COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name,
        COALESCE(s.whatsapp_number, NULL) AS seller_phone,
        s.whatsapp_number AS seller_whatsapp,
        COALESCE(s.email, u.email) AS seller_email,
        s.physical_address AS seller_address,
        s.shop_name,
        s.latitude AS seller_latitude,
        s.longitude AS seller_longitude,
        s.instagram_link,
        s.tiktok_link,
        s.facebook_link,
        p_latest.payment AS payment,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'product_id', oi.product_id,
              'name', oi.name,
              'price', oi.price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'product_name', COALESCE(p.name, oi.product_name, oi.name),
              'product_price', COALESCE(oi.product_price, oi.price),
              'product_type', COALESCE(p.product_type::text, oi.metadata->>'productType', 'physical'),
              'is_digital', COALESCE(p.is_digital, (oi.metadata->>'isDigital')::boolean, false),
              'digital_file_name', COALESCE(p.digital_file_name, oi.metadata->>'digitalFileName'),
              'digital_file_path', p.digital_file_path,
              'image_url', COALESCE(p.image_url, oi.metadata->>'imageUrl'),
              'metadata', oi.metadata,
              'created_at', oi.created_at,
              'updated_at', oi.updated_at
            ) ORDER BY oi.id ASC
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM product_orders o
      LEFT JOIN buyers b ON o.buyer_id = b.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object(
          'id', pay.id,
          'invoice_id', pay.invoice_id,
          'amount', pay.amount,
          'currency', pay.currency,
          'status', pay.status,
          'payment_method', pay.payment_method,
          'provider_reference', pay.provider_reference,
          'mpesa_receipt', pay.mpesa_receipt,
          'created_at', pay.created_at,
          'updated_at', pay.updated_at
        ) AS payment
        FROM payments pay
        WHERE pay.order_id = o.id
           OR pay.invoice_id = o.id::text
           OR pay.metadata->>'order_id' = o.id::text
        ORDER BY pay.created_at DESC, pay.id DESC
        LIMIT 1
      ) p_latest ON true
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.id = $1
      GROUP BY o.id, b.id, s.id, u.id, p_latest.payment
    `;

    const { rows } = await db.query(query, [orderId]);
    if (rows.length === 0) return null;

    const { items, payment, ...fullOrder } = rows[0];
    return { fullOrder, items, payment };
  }

  static async getStatusNotificationDetails(orderId) {
    const res = await this.getOrderWithItems(orderId);
    if (!res) return null;
    return { fullOrder: res.fullOrder, items: res.items };
  }

  static async getReceiptNotificationDetails(orderId) {
    const fullOrderResult = await pool.query(
      `SELECT o.*, 
              b.full_name          AS buyer_name_actual,
              b.mobile_payment     AS buyer_phone_actual,
              b.whatsapp_number    AS buyer_whatsapp_actual,
              b.email              AS buyer_email_actual,
              b.city               AS buyer_city,
              b.location           AS buyer_location_text,
              b.latitude           AS buyer_latitude,
              b.longitude          AS buyer_longitude,
              b.full_address       AS buyer_full_address,
              COALESCE(s.full_name, u.email, 'Unknown Seller') AS seller_name, 
              COALESCE(s.whatsapp_number, NULL)                AS seller_phone, 
              COALESCE(s.email, u.email)                       AS seller_email, 
              s.physical_address   AS seller_address, s.latitude AS seller_latitude, s.longitude AS seller_longitude
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       LEFT JOIN sellers s ON o.seller_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    return fullOrderResult.rows[0] || null;
  }

  static async getFulfillmentNotificationDetails(orderId) {
    const fullOrderResult = await pool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.order_type, o.fulfillment_type, 
              o.metadata, o.custom_production_deadline_at, o.custom_production_grace_deadline_at,
              o.buyer_id, o.seller_id, o.location_address, o.location_lat, o.location_lng,
              o.service_title, o.service_requirements, o.payment_status, o.payment_method, o.payment_reference,
              COALESCE(b.full_name, o.buyer_name) AS buyer_name,
              COALESCE(b.mobile_payment, o.buyer_mobile_payment, o.buyer_whatsapp_number) AS buyer_mobile_payment,
              COALESCE(b.email, o.buyer_email) AS buyer_email,
              s.full_name AS seller_name, s.shop_name, s.whatsapp_number AS seller_phone, 
              s.email AS seller_email, s.physical_address AS seller_address,
              s.latitude AS seller_latitude, s.longitude AS seller_longitude,
              s.instagram_link, s.tiktok_link, s.facebook_link
       FROM product_orders o
       LEFT JOIN buyers b ON o.buyer_id = b.id
       LEFT JOIN sellers s ON o.seller_id = s.id
       WHERE o.id = $1`,
      [orderId]
    );

    return fullOrderResult.rows[0] || null;
  }
}

export default OrderReadService;
