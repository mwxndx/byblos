import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SITE_URL = 'https://www.byblosafrica.site';
export const distDir = join(process.cwd(), 'dist');
export const templatePath = join(distDir, 'index.html');

// Structured content for each public page
export const pages = [
  {
    path: '/',
    outputPath: join(distDir, 'index.html'),
    title: 'BYBLOS | Start and Run Your Business in Nairobi',
    description: 'Create a trusted shop link, sell from Instagram, TikTok, or WhatsApp, collect secure payments, manage orders, delivery, receipts, refunds, and withdrawals in one place.',
    canonical: `${SITE_URL}/`,
    content: `
      <header style="max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem;">
        <nav aria-label="Main Navigation" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem;">
          <a href="/" style="display: inline-flex; align-items: center; text-decoration: none; color: inherit; font-weight: 700; font-size: 1.25rem;">
            <span>ByblosHQ</span>
          </a>
          <div style="display: flex; gap: 1.5rem; align-items: center;">
            <a href="/privacy" style="color: inherit; text-decoration: none; font-size: 0.875rem;">Privacy Policy</a>
            <a href="/terms" style="color: inherit; text-decoration: none; font-size: 0.875rem;">Terms of Service</a>
            <a href="/delete-account" style="color: inherit; text-decoration: none; font-size: 0.875rem;">Delete Account</a>
          </div>
        </nav>

        <section style="text-align: center; max-width: 800px; margin: 0 auto; padding: 2rem 0;">
          <h1 style="font-size: 2.5rem; font-weight: 800; line-height: 1.2; margin-bottom: 1.25rem;">
            Start and Run Your Business in Nairobi
          </h1>
          <p style="font-size: 1.125rem; line-height: 1.6; opacity: 0.9; margin-bottom: 2rem;">
            Create a trusted shop link, sell from Instagram, TikTok, or WhatsApp, collect secure payments, manage orders, delivery, receipts, refunds, and withdrawals in one place.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="/" style="display: inline-block; padding: 0.875rem 2rem; background: #ffffff; color: #000000; font-weight: 600; border-radius: 9999px; text-decoration: none;">Explore Shops</a>
            <a href="https://play.google.com/store/apps/details?id=com.bybloshq.app" style="display: inline-block; padding: 0.875rem 2rem; border: 1px solid rgba(255,255,255,0.2); color: inherit; font-weight: 600; border-radius: 9999px; text-decoration: none;">Download Android App</a>
          </div>
        </section>
      </header>

      <main style="max-width: 1200px; margin: 0 auto; padding: 0 1.5rem 4rem 1.5rem;">
        <section style="margin-bottom: 4rem;">
          <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center;">Popular Categories</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Fashion &amp; Apparel</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Curated clothing, streetwear, vintage finds, and bespoke Kenyan designer collections.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Sneakers &amp; Footwear</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Authentic sneakers, everyday shoes, boots, and verified releases from trusted Nairobi shops.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Beauty &amp; Fragrance</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Skincare, makeup, perfumes, and personal care products from authentic local creators.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Art, Decor &amp; Crafts</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Handmade homeware, original paintings, prints, ceramics, and handcrafted decor.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Electronics &amp; Gadgets</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Mobile accessories, audio equipment, chargers, and tech essentials with warranty support.</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Food &amp; Lifestyle</h3>
              <p style="font-size: 0.875rem; opacity: 0.8; line-height: 1.5;">Artisanal treats, specialty coffee, wellness blends, and lifestyle creations.</p>
            </div>
          </div>
        </section>

        <section style="margin-bottom: 4rem;">
          <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center;">Everything You Need to Run Your Business</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Trusted Social Commerce Storefront</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">
                Get a clean, high-speed bio link (byblosafrica.site/yourstore) that works seamlessly on Instagram, TikTok, and WhatsApp. Display your catalog with high-resolution imagery, pricing, and live inventory.
              </p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Frictionless M-Pesa &amp; Card Payments</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">
                Collect payments with instant Safaricom M-Pesa STK push and major payment cards. Automated receipts are generated instantly, eliminating manual payment confirmation screenshots.
              </p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Integrated Mzigo Logistics</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">
                Manage order delivery effortlessly. From doorstep dispatch to parcel lockers and regional couriers across Nairobi and Kenya, keep your customers updated with live tracking links.
              </p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Buyer Protection &amp; Escrow Security</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">
                Buyer funds are safeguarded in escrow until orders are fulfilled and verified. Build unshakeable buyer trust, lower cancellation rates, and eliminate online shopping anxiety.
              </p>
            </div>
          </div>
        </section>

        <section style="margin-bottom: 4rem; padding: 2rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1.5rem;">
          <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem;">Frequently Asked Questions</h2>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">How do I start selling on Byblos?</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">Download the Byblos Android app or open our web platform, create your seller account, upload your product catalog, and share your personalized shop link directly in your Instagram bio, TikTok profile, or WhatsApp chats.</p>
            </div>
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">How are payments handled?</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">Customers pay via M-Pesa STK push or card at checkout. Funds are protected in escrow and credited to your available balance upon delivery confirmation. You can withdraw your earnings directly to your M-Pesa account at any time.</p>
            </div>
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">How does delivery work in Nairobi?</h3>
              <p style="font-size: 0.875rem; opacity: 0.85; line-height: 1.6;">Through our integrated Mzigo logistics network, sellers can arrange doorstep rider delivery across Nairobi or parcel collection. Buyers receive live tracking updates via SMS and web.</p>
            </div>
          </div>
        </section>
      </main>

      <footer style="border-top: 1px solid rgba(255,255,255,0.1); padding: 3rem 1.5rem; max-width: 1200px; margin: 0 auto; text-align: center; font-size: 0.875rem; opacity: 0.8;">
        <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <a href="/" style="color: inherit; text-decoration: none;">Home</a>
          <a href="/privacy" style="color: inherit; text-decoration: none;">Privacy Policy</a>
          <a href="/terms" style="color: inherit; text-decoration: none;">Terms of Service</a>
          <a href="/delete-account" style="color: inherit; text-decoration: none;">Delete Account</a>
        </div>
        <p>&copy; 2026 ByblosHQ. All rights reserved. Nairobi, Kenya.</p>
      </footer>
    `
  },
  {
    path: '/privacy',
    outputPath: join(distDir, 'privacy', 'index.html'),
    title: 'Privacy Policy | ByblosHQ Kenya',
    description: 'Byblos Privacy Policy: How ByblosHQ collects, processes, and protects your personal data under the Kenya Data Protection Act, 2019.',
    canonical: `${SITE_URL}/privacy`,
    content: `
      <header style="max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem;">
        <nav aria-label="Breadcrumb" style="margin-bottom: 2rem;">
          <a href="/" style="color: inherit; text-decoration: none; font-size: 0.875rem; font-weight: 600;">&larr; Back to Home</a>
        </nav>
        <h1 style="font-size: 2.25rem; font-weight: 800; line-height: 1.2; margin-bottom: 0.5rem;">Byblos Privacy Policy</h1>
        <p style="font-size: 0.875rem; opacity: 0.8;">Last updated: 2026 | Compliant with the Kenya Data Protection Act, 2019</p>
      </header>

      <main style="max-width: 900px; margin: 0 auto; padding: 0 1.5rem 4rem 1.5rem; line-height: 1.7; font-size: 0.95rem;">
        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">1. Introduction &amp; Legal Framework</h2>
          <p style="margin-bottom: 1rem;">
            This Privacy Policy governs the collection, use, processing, and protection of personal data by ByblosHQ ("Byblos," "we," "us," or "our") in accordance with:
          </p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>The Constitution of Kenya, 2010 — Article 31 (Right to Privacy)</li>
            <li>The Data Protection Act, 2019 (Cap. 411C)</li>
            <li>The Computer Misuse and Cybercrimes Act, 2018</li>
            <li>All official statutory regulations issued by the Office of the Data Protection Commissioner (ODPC)</li>
          </ul>
          <p>By registering, accessing, or using the Byblos website (byblosafrica.site) or mobile application, you give express, informed consent to the processing of your personal data as described in this policy.</p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">2. Information We Collect</h2>
          <p style="margin-bottom: 1rem;">We collect information that enables us to safely provide e-commerce, payment processing, delivery coordination, and communication services:</p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li><strong>Identity Data:</strong> Full name, username, national identification or business registration details where required for verified seller profiles.</li>
            <li><strong>Contact Data:</strong> Phone number (including WhatsApp contact), email address, delivery address, estate, street, and postal area in Nairobi or Kenya.</li>
            <li><strong>Transactional Data:</strong> Payment records, M-Pesa transaction reference numbers, order history, digital receipts, refund logs, and withdrawal confirmations.</li>
            <li><strong>Technical Data:</strong> IP address, device model, operating system, browser type, app version, session timestamps, and device push notification tokens.</li>
            <li><strong>Communications:</strong> Customer support records, order-related queries, dispute resolution messages, and user feedback.</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">3. Lawful Basis for Processing</h2>
          <p style="margin-bottom: 1rem;">Byblos processes personal data strictly under lawful grounds set forth in Section 30 of the Data Protection Act, 2019:</p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li><strong>Consent:</strong> When you provide explicit permission for specific activities (e.g., marketing communications, location access).</li>
            <li><strong>Performance of Contract:</strong> Processing necessary to fulfill your orders, process payments, coordinate deliveries, and manage your account.</li>
            <li><strong>Legal Obligation:</strong> Compliance with Kenyan tax legislation (Tax Procedures Act, 2015), financial reporting, and Anti-Money Laundering (AML) standards.</li>
            <li><strong>Legitimate Interests:</strong> Preventing fraud, ensuring network security, detecting abuse, and improving platform reliability.</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">4. How We Use Your Data</h2>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>Creating, verifying, and maintaining buyer, seller, and creator accounts.</li>
            <li>Processing payments via M-Pesa STK push and licensed payment gateways, holding funds in escrow, and executing seller payouts.</li>
            <li>Coordinating fulfillment and parcel delivery via Mzigo logistics and designated couriers.</li>
            <li>Issuing automated electronic receipts, purchase confirmations, and delivery updates.</li>
            <li>Preventing fraudulent transactions and ensuring marketplace integrity.</li>
            <li>Complying with statutory reporting requirements to authorities such as the Kenya Revenue Authority (KRA).</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">5. Data Sharing &amp; Third Parties</h2>
          <p style="margin-bottom: 1rem;">
            <strong>We do not sell, rent, or trade your personal data to third parties.</strong> Data is shared strictly on a need-to-know basis with:
          </p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li><strong>Licensed Payment Service Providers:</strong> Safaricom M-Pesa, Pesapal, and Paystack for secure transaction settlement.</li>
            <li><strong>Logistics Partners:</strong> Mzigo couriers and delivery riders to deliver items to your specified address.</li>
            <li><strong>Regulatory Authorities:</strong> The Kenya Revenue Authority (KRA), ODPC, or law enforcement bodies when mandated by a valid court order or statutory requirement.</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">6. Data Security Measures</h2>
          <p>
            Byblos employs industry-standard encryption protocols (TLS/HTTPS in transit and AES-256 at rest), salted password hashing, least-privilege access controls, and active monitoring. In accordance with Section 43 of the Data Protection Act, 2019, any verified data breach affecting user rights will be reported to the ODPC and affected individuals within 72 hours.
          </p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">7. Your Data Rights</h2>
          <p style="margin-bottom: 1rem;">Under the Data Protection Act, 2019, you retain full rights to:</p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate or out-of-date information.</li>
            <li>Request erasure of your personal data (see our <a href="/delete-account" style="color: inherit; text-decoration: underline;">Account Deletion Guide</a>).</li>
            <li>Object to or restrict specific forms of data processing.</li>
            <li>Lodge a complaint with the Office of the Data Protection Commissioner (<a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">odpc.go.ke</a>).</li>
          </ul>
          <p>To exercise any of these rights, contact our Data Protection Officer at: <strong>bybloshqke@zohomail.com</strong>.</p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">8. Data Retention</h2>
          <p>
            We retain account data for the duration of your active registration. In accordance with the Kenya Tax Procedures Act, 2015, financial and transaction records are retained for a statutory period of 7 years. Following an account deletion request, residual personal identifiers are removed or anonymized within 30 days.
          </p>
        </section>
      </main>

      <footer style="border-top: 1px solid rgba(255,255,255,0.1); padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto; text-align: center; font-size: 0.875rem; opacity: 0.8;">
        <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <a href="/" style="color: inherit; text-decoration: none;">Home</a>
          <a href="/privacy" style="color: inherit; text-decoration: none;">Privacy Policy</a>
          <a href="/terms" style="color: inherit; text-decoration: none;">Terms of Service</a>
          <a href="/delete-account" style="color: inherit; text-decoration: none;">Delete Account</a>
        </div>
        <p>&copy; 2026 ByblosHQ. Nairobi, Kenya.</p>
      </footer>
    `
  },
  {
    path: '/terms',
    outputPath: join(distDir, 'terms', 'index.html'),
    title: 'Terms of Service & Client Agreement | ByblosHQ',
    description: 'Byblos Terms of Service: Legally binding Client Agreement, marketplace rules, escrow, payments, commissions, and dispute resolution.',
    canonical: `${SITE_URL}/terms`,
    content: `
      <header style="max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem;">
        <nav aria-label="Breadcrumb" style="margin-bottom: 2rem;">
          <a href="/" style="color: inherit; text-decoration: none; font-size: 0.875rem; font-weight: 600;">&larr; Back to Home</a>
        </nav>
        <h1 style="font-size: 2.25rem; font-weight: 800; line-height: 1.2; margin-bottom: 0.5rem;">Terms of Service &amp; Client Agreement</h1>
        <p style="font-size: 0.875rem; opacity: 0.8;">Effective Date: 2026 | Governing Law: Laws of the Republic of Kenya</p>
      </header>

      <main style="max-width: 900px; margin: 0 auto; padding: 0 1.5rem 4rem 1.5rem; line-height: 1.7; font-size: 0.95rem;">
        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">1. Agreement to Terms</h2>
          <p>
            These Terms of Service constitute a legally binding agreement between you ("User," "Buyer," "Seller," or "Creator") and ByblosHQ ("Byblos," "we," "us," or "our"). By registering, accessing our digital storefronts, initiating payments, or listing merchandise, you acknowledge that you have read, understood, and agreed to be bound by these terms.
          </p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">2. Platform Role &amp; Intermediary Disclaimer</h2>
          <p style="margin-bottom: 1rem;">
            Byblos operates as an independent digital marketplace, payment coordination, and social commerce infrastructure provider. Byblos provides the technology enabling transactions between buyers and sellers:
          </p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>Sellers are independent businesses responsible for item descriptions, pricing, inventory accuracy, and quality.</li>
            <li>Byblos is not the manufacturer, importer, or direct retailer of listed goods unless explicitly designated.</li>
            <li>Byblos provides escrow safeguarding, dispute mediation, and verified logistics integration to ensure fair, protected commerce.</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">3. Payments, Escrow &amp; Commissions</h2>
          <p style="margin-bottom: 1rem;">
            All transactions conducted on Byblos are governed by our payment and escrow infrastructure:
          </p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li><strong>Payment Collection:</strong> Payments are processed via licensed Payment Service Providers (including Safaricom M-Pesa and card processors).</li>
            <li><strong>Escrow Holding:</strong> When a buyer completes checkout, funds are deposited into an escrow holding account until the order is successfully delivered and acknowledged.</li>
            <li><strong>Platform Commissions:</strong> Byblos deducts an agreed platform commission on completed sales to cover payment processing, hosting, escrow administration, and support.</li>
            <li><strong>Seller Withdrawals:</strong> Sellers can withdraw available balances directly to their verified M-Pesa mobile phone number or bank account in Kenya Shillings (KES).</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">4. Prohibited Items &amp; Conduct</h2>
          <p style="margin-bottom: 1rem;">Sellers are strictly prohibited from listing or selling:</p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>Counterfeit, pirated, or unauthorized trademarked merchandise.</li>
            <li>Illegal drugs, narcotics, prescription pharmaceuticals, or controlled substances.</li>
            <li>Firearms, weapons, explosive materials, or hazardous chemicals.</li>
            <li>Stolen property or items obtained through illegal means.</li>
            <li>Misleading, fraudulent, or deceptive product listings.</li>
          </ul>
          <p>Violation of these prohibitions results in immediate account suspension, forfeiture of fraudulent funds, and reporting to law enforcement authorities.</p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">5. Delivery &amp; Logistics (Mzigo Network)</h2>
          <p>
            Delivery timelines and fulfillment are coordinated through the Mzigo logistics network or seller-arranged couriers. Sellers are required to dispatch confirmed orders within the stated fulfillment window. Tracking links and delivery confirmation codes provide proof of delivery for escrow release.
          </p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">6. Dispute Resolution, Returns &amp; Refunds</h2>
          <p style="margin-bottom: 1rem;">
            If an item arrives damaged, materially different from the seller's description, or fails to arrive:
          </p>
          <ul style="padding-left: 1.5rem; margin-bottom: 1rem;">
            <li>Buyers must raise a dispute within 48 hours of delivery notification.</li>
            <li>Escrow disbursement is immediately frozen pending dispute review.</li>
            <li>Byblos mediators review evidence from buyer and seller. Verified claims are refunded to the original payment source.</li>
          </ul>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">7. Governing Law &amp; Jurisdiction</h2>
          <p>
            These Terms are governed by and construed in accordance with the Laws of the Republic of Kenya. Any disputes arising out of or in connection with these Terms shall be resolved through good-faith negotiation, followed by arbitration or the courts of Kenya in Nairobi.
          </p>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">8. Contact Information</h2>
          <p>
            For questions regarding these Terms or legal inquiries, email us at: <strong>bybloshqke@zohomail.com</strong>.
          </p>
        </section>
      </main>

      <footer style="border-top: 1px solid rgba(255,255,255,0.1); padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto; text-align: center; font-size: 0.875rem; opacity: 0.8;">
        <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <a href="/" style="color: inherit; text-decoration: none;">Home</a>
          <a href="/privacy" style="color: inherit; text-decoration: none;">Privacy Policy</a>
          <a href="/terms" style="color: inherit; text-decoration: none;">Terms of Service</a>
          <a href="/delete-account" style="color: inherit; text-decoration: none;">Delete Account</a>
        </div>
        <p>&copy; 2026 ByblosHQ. Nairobi, Kenya.</p>
      </footer>
    `
  },
  {
    path: '/delete-account',
    outputPath: join(distDir, 'delete-account', 'index.html'),
    title: 'Delete Your Byblos Account | ByblosHQ',
    description: 'Step-by-step instructions for requesting deletion of your Byblos account and personal data, in compliance with Google Play requirements.',
    canonical: `${SITE_URL}/delete-account`,
    content: `
      <header style="max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem;">
        <nav aria-label="Breadcrumb" style="margin-bottom: 2rem;">
          <a href="/" style="color: inherit; text-decoration: none; font-size: 0.875rem; font-weight: 600;">&larr; Back to Home</a>
        </nav>
        <h1 style="font-size: 2.25rem; font-weight: 800; line-height: 1.2; margin-bottom: 0.5rem;">Delete Your Byblos Account</h1>
        <p style="font-size: 0.875rem; opacity: 0.8;">User Data Deletion Policy &amp; Google Play Console Compliance</p>
      </header>

      <main style="max-width: 900px; margin: 0 auto; padding: 0 1.5rem 4rem 1.5rem; line-height: 1.7; font-size: 0.95rem;">
        <section style="margin-bottom: 2.5rem;">
          <p style="font-size: 1.1rem; margin-bottom: 1.5rem;">
            This page provides clear instructions on how to request the deletion of your <strong>Byblos</strong> account (operated by ByblosHQ) and the personal data associated with it. This applies to both buyer and seller accounts on the Byblos Android app and website (byblosafrica.site).
          </p>

          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">How to Request Account Deletion</h2>
          <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Option 1: In the Byblos App (Fastest)</h3>
            <ol style="padding-left: 1.5rem; margin-bottom: 1rem;">
              <li style="margin-bottom: 0.5rem;">Open the Byblos app on your mobile device and log in.</li>
              <li style="margin-bottom: 0.5rem;"><strong>Buyers:</strong> Tap <em>Profile</em> in the bottom navigation bar, scroll to the bottom of the page, and select <strong>Delete account</strong>.</li>
              <li style="margin-bottom: 0.5rem;"><strong>Sellers:</strong> Open the <em>Settings</em> tab, navigate to the <em>Account</em> section, ensure all pending orders are fulfilled and funds withdrawn, and tap <strong>Delete account</strong>.</li>
              <li style="margin-bottom: 0.5rem;">Confirm by tapping <strong>Yes, delete</strong>. Your account is immediately deactivated and personal profile information queued for deletion.</li>
            </ol>
          </div>

          <div style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Option 2: By Email Request</h3>
            <p style="margin-bottom: 0.75rem;">
              If you cannot access the app or have uninstalled it, you may submit a deletion request via email:
            </p>
            <p style="margin-bottom: 0.75rem;">
              Email <strong>bybloshqke@zohomail.com</strong> from the email address registered on your Byblos account with the subject line <strong>"Delete my account"</strong>.
            </p>
            <p>
              Our verification team will confirm account ownership and process the deletion within <strong>30 days</strong>, sending you written confirmation upon completion.
            </p>
          </div>
        </section>

        <section style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Data Retention &amp; Deletion Scope</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            <div style="padding: 1.5rem; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Data Permanently Deleted / Anonymized</h3>
              <ul style="padding-left: 1.25rem; font-size: 0.875rem;">
                <li>User full name and username</li>
                <li>Email address and hashed passwords</li>
                <li>Phone and WhatsApp numbers</li>
                <li>Saved delivery addresses and GPS locations</li>
                <li>Seller store profile, images, descriptions, and banners</li>
                <li>Device push notification tokens and app sessions</li>
              </ul>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 1rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Data Retained for Legal Compliance</h3>
              <ul style="padding-left: 1.25rem; font-size: 0.875rem;">
                <li>Completed payment and payout records (M-Pesa transaction IDs) are retained for 7 years in accordance with Section 23 of the Kenya Tax Procedures Act, 2015.</li>
                <li>Fraud prevention records and dispute archives where required to satisfy statutory audits.</li>
                <li>All retained financial logs are anonymized and decoupled from user personal identifiers.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer style="border-top: 1px solid rgba(255,255,255,0.1); padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto; text-align: center; font-size: 0.875rem; opacity: 0.8;">
        <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <a href="/" style="color: inherit; text-decoration: none;">Home</a>
          <a href="/privacy" style="color: inherit; text-decoration: none;">Privacy Policy</a>
          <a href="/terms" style="color: inherit; text-decoration: none;">Terms of Service</a>
          <a href="/delete-account" style="color: inherit; text-decoration: none;">Delete Account</a>
        </div>
        <p>&copy; 2026 ByblosHQ. Nairobi, Kenya.</p>
      </footer>
    `
  }
];

export function generateHtml(templateHtml, page) {
  let html = templateHtml;

  // 1. Replace or insert <title>
  html = html.replace(/<title>.*?<\/title>/is, `<title>${page.title}</title>`);

  // 2. Replace meta title
  html = html.replace(/<meta\s+name=["']title["']\s+content=["'].*?["']\s*\/?>/i, `<meta name="title" content="${page.title}" />`);

  // 3. Replace meta description
  html = html.replace(/<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/is, `<meta name="description" content="${page.description}" />`);

  // 4. Update canonical tag: if exists replace href, else insert into <head>
  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["']\s+href=["'].*?["']\s*\/?>/i, `<link rel="canonical" href="${page.canonical}" />`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${page.canonical}" />\n</head>`);
  }

  // 5. Update OpenGraph & Twitter tags
  html = html.replace(/<meta\s+property=["']og:title["']\s+content=["'].*?["']\s*\/?>/i, `<meta property="og:title" content="${page.title}" />`);
  html = html.replace(/<meta\s+property=["']og:description["']\s+content=["'].*?["']\s*\/?>/is, `<meta property="og:description" content="${page.description}" />`);
  html = html.replace(/<meta\s+property=["']og:url["']\s+content=["'].*?["']\s*\/?>/i, `<meta property="og:url" content="${page.canonical}" />`);
  html = html.replace(/<meta\s+property=["']twitter:title["']\s+content=["'].*?["']\s*\/?>/i, `<meta property="twitter:title" content="${page.title}" />`);
  html = html.replace(/<meta\s+property=["']twitter:description["']\s+content=["'].*?["']\s*\/?>/is, `<meta property="twitter:description" content="${page.description}" />`);
  html = html.replace(/<meta\s+property=["']twitter:url["']\s+content=["'].*?["']\s*\/?>/i, `<meta property="twitter:url" content="${page.canonical}" />`);

  // 6. Inject semantic content inside <div id="root">
  // Preserve #initial-splash for instant visual brand splash, and place the pre-rendered HTML right after it.
  // When React mounts, React's createRoot(rootElement).render() replaces all children of #root seamlessly.
  const rootOpenTag = '<div id="root">';
  const rootIndex = html.indexOf(rootOpenTag);
  if (rootIndex !== -1) {
    const splashEndTag = '</div>';
    const splashOpenIndex = html.indexOf('<div id="initial-splash"', rootIndex);
    if (splashOpenIndex !== -1) {
      const splashCloseIndex = html.indexOf(splashEndTag, splashOpenIndex) + splashEndTag.length;
      const beforeSplash = html.substring(0, splashCloseIndex);
      const afterSplash = html.substring(splashCloseIndex);

      // Clean up any existing prerender-fallback or noscript if re-running
      let sanitizedAfter = afterSplash.replace(/<div class="prerender-fallback"[^>]*>[\s\S]*?<\/div>\s*(?=<\/div>|<script)/i, '');
      sanitizedAfter = sanitizedAfter.replace(/<noscript>[\s\S]*?<\/noscript>\s*/i, '');

      const prerenderMarkup = `
    <div class="prerender-fallback" style="position: relative; z-index: 1;">
      ${page.content.trim()}
    </div>
    <noscript>
      <div class="seo-fallback">
        ${page.content.trim()}
      </div>
    </noscript>`;

      html = beforeSplash + prerenderMarkup + sanitizedAfter;
    }
  }

  return html;
}

export function runPrerender() {
  if (!existsSync(templatePath)) {
    console.error('[prerender] dist/index.html not found. Run `vite build` first.');
    process.exit(1);
  }

  const templateHtml = readFileSync(templatePath, 'utf8');
  let generatedCount = 0;
  for (const page of pages) {
    const dir = dirname(page.outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const outputHtml = generateHtml(templateHtml, page);
    writeFileSync(page.outputPath, outputHtml, 'utf8');
    console.log(`[prerender] Pre-rendered ${page.path} -> ${page.outputPath}`);
    generatedCount++;
  }

  console.log(`[prerender] Successfully pre-rendered ${generatedCount} public pages.`);
}

// Check if executed directly via node CLI
const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectExecution) {
  runPrerender();
}
