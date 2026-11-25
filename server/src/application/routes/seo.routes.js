import { Router } from 'express';
import { pool } from '../../infrastructure/database/database.js';
import cacheService from '../../shared/utils/cache.service.js';

const router = Router();
const SITEMAP_CACHE_KEY = 'seo:sitemap:xml';
const SITEMAP_CACHE_TTL_SECONDS = 3600;

// Dynamic /sitemap.xml generating live sitemap with all active seller shops
router.get('/sitemap.xml', async (req, res) => {
    try {
        const cachedXml = await cacheService.get(SITEMAP_CACHE_KEY);
        if (typeof cachedXml === 'string' && cachedXml.length > 0) {
            res.header('Content-Type', 'application/xml');
            res.header('Cache-Control', 'public, max-age=3600');
            return res.send(cachedXml);
        }

        const baseUrl = (process.env.FRONTEND_URL || 'https://www.byblosafrica.site').replace(/\/$/, '');

        // Static routes that genuinely exist in the application
        const staticRoutes = [
            { url: '/', changefreq: 'daily', priority: '1.0' },
            { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
            { url: '/terms', changefreq: 'monthly', priority: '0.4' },
            { url: '/delete-account', changefreq: 'monthly', priority: '0.3' },
        ];

        // Fetch active approved sellers from sellers table
        let sellerRows = [];
        try {
            const sellerRes = await pool.query(
                `SELECT shop_name, updated_at FROM sellers WHERE status = 'active' AND shop_name IS NOT NULL`
            );
            sellerRows = sellerRes.rows;
        } catch {
            // Graceful fallback if DB query fails during crawl
        }

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        for (const route of staticRoutes) {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
            xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
            xml += `    <priority>${route.priority}</priority>\n`;
            xml += `  </url>\n`;
        }

        for (const seller of sellerRows) {
            if (!seller.shop_name) continue;
            const lastMod = seller.updated_at ? new Date(seller.updated_at).toISOString() : new Date().toISOString();
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/${encodeURIComponent(seller.shop_name)}</loc>\n`;
            xml += `    <lastmod>${lastMod}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        xml += `</urlset>`;

        await cacheService.set(SITEMAP_CACHE_KEY, xml, SITEMAP_CACHE_TTL_SECONDS);
        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600');
        return res.send(xml);
    } catch {
        return res.status(500).send('Error generating sitemap');
    }
});

// Serve /robots.txt dynamically matching production public/robots.txt
router.get('/robots.txt', (req, res) => {
    const baseUrl = (process.env.FRONTEND_URL || 'https://www.byblosafrica.site').replace(/\/$/, '');
    const robotsContent = `User-agent: *
Allow: /
Allow: /privacy
Allow: /terms
Allow: /delete-account
Allow: /shop/*

Disallow: /buyer/
Disallow: /seller/
Disallow: /admin/
Disallow: /creator/
Disallow: /mzigo/
Disallow: /checkout
Disallow: /payment-success
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;
    res.header('Content-Type', 'text/plain');
    res.header('Cache-Control', 'public, max-age=86400');
    return res.send(robotsContent);
});

export default router;
