import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define your website URL
const siteUrl = 'https://www.byblosafrica.site';

// Static routes — ONLY pages that actually exist and render real content.
// Do not add /shop, /shop/<category>, /sell, /about, /contact here: those have
// no route and fall through to the /:shopName wildcard, rendering a
// "shop not found" shell that Google refuses to index (soft-404). Build the
// pages first, then add them back.
const routes = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { url: '/terms', changefreq: 'yearly', priority: 0.3 },
  { url: '/delete-account', changefreq: 'yearly', priority: 0.3 },
];

async function fetchDynamicSellerRoutes() {
  // DB_URL must be provided by the build environment. Never hardcode a
  // production connection string here — it leaks a live credential into the
  // repo and its git history. Without DB_URL we simply omit dynamic seller
  // routes from the sitemap (static routes still ship).
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.warn('DB_URL not set — skipping dynamic seller routes in sitemap.');
    return [];
  }
  try {
    const pg = await import('../server/node_modules/pg/lib/index.js');
    const { Pool } = pg.default || pg;
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query(
      `SELECT shop_name, slug FROM sellers WHERE status = 'active'`
    );
    await pool.end();

    const dynamicRoutes = [];
    for (const seller of rows) {
      const identifier = seller.slug || encodeURIComponent(seller.shop_name);
      if (identifier) {
        // Emit only the short-link form. A shop also resolves at /shop/<id>,
        // but that page canonicalises to the short link (see ShopPage SEOHead),
        // so listing both would advertise a duplicate.
        dynamicRoutes.push({ url: `/${identifier}`, changefreq: 'daily', priority: 0.9 });
      }
    }
    return dynamicRoutes;
  } catch (error) {
    console.warn('Could not fetch dynamic seller routes for sitemap:', error.message);
    return [];
  }
}

// Generate sitemap
async function generateSitemap() {
  try {
    const dynamicRoutes = await fetchDynamicSellerRoutes();
    const allRoutes = [...routes, ...dynamicRoutes];

    // Create a stream to write to
    const stream = new SitemapStream({ hostname: siteUrl });
    
    // Add all routes to the sitemap
    const xmlString = await streamToPromise(
      Readable.from(allRoutes).pipe(stream)
    ).then((data) => data.toString());

    // Define the path
    const publicDir = join(process.cwd(), 'public');
    const sitemapPath = join(publicDir, 'sitemap.xml');

    // Ensure public directory exists
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }

    // Write sitemap to file
    writeFileSync(sitemapPath, xmlString);

    console.log(`Sitemap generated successfully with ${allRoutes.length} URLs!`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

generateSitemap();
