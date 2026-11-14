# BYBLOS — COMPLETE APPLICATION ACTION INVENTORY
**Phase 1 Deliverable: Full Role-Based Action Catalog**
**Date:** 2026-11-14  
**Project:** Byblos E-Commerce Ecosystem  
**Target Roles:** Buyer, Seller, Creator, Mzigo Ego (Logistics), Admin, Marketing

---

## 1. System-Wide Role & Permission Architecture

Empirical inspection of the Byblos codebase ([`src/shared/types/primitives.ts`](file:///c:/Users/Administrator/Downloads/evolve/evolve%20projects/byblos/code/bybloshq/src/shared/types/primitives.ts), [`server/src/application/middleware/auth.js`](file:///c:/Users/Administrator/Downloads/evolve/evolve%20projects/byblos/code/bybloshq/server/src/application/middleware/auth.js), and [`server/src/domains/identity/users/user.repository.js`](file:///c:/Users/Administrator/Downloads/evolve/evolve%20projects/byblos/code/bybloshq/server/src/domains/identity/users/user.repository.js)) establishes **six** discrete user roles:

1. **Buyer** (`role: 'buyer'`): End consumer discovering products, maintaining wishlists, submitting orders, selecting delivery/pickup, tracking orders, and submitting refund requests.
2. **Seller** (`role: 'seller'`): Merchant managing shop profile, catalog (physical, digital, service), inventory, order fulfillment, hub drop-off, payouts, and creator collaborations.
3. **Creator** (`role: 'creator'`): Affiliate promoter generating referral links, requesting shop partnerships, tracking referral sales and clicks, receiving attributed commissions, and requesting earnings payouts.
4. **Mzigo Ego** (`role: 'logistics'`): Logistics driver/courier receiving delivery assignments, updating pickup/hub/transit/delivery leg statuses, and streaming GPS locations.
5. **Admin** (`role: 'admin'`): Platform operator managing users, merchants, creators, flagged commissions, withdrawal payouts, dispute resolution, dead-letter fulfillment recovery, and system broadcast banners.
6. **Marketing** (`role: 'marketing'`): Read-only growth and performance analyst accessing platform GMV trends, user growth funnels, product mix, and geographic analytics.

---

## 2. Buyer Action Inventory

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Buyer** | Auth | Register Account | `/buyer/register` | Form submit button | Create new buyer account | Email not registered | Email, Password, Name, Phone | Account created, verification email sent | `INSERT INTO users`, `INSERT INTO buyers` | Verification email | Public | Auth Service | Not Tested |
| **Buyer** | Auth | Login | `/buyer/login` | Form submit button | Authenticate buyer session | Verified email, valid credentials | Email, Password | JWT auth cookies issued, redirects to dashboard | `UPDATE users SET last_login = NOW()` | None | Public | JWT / Cookie | Not Tested |
| **Buyer** | Auth | Auto-Login (Checkout) | `/shop/:shopName` | Checkout completion | Seamless login for guest buyer post-payment | Order placed with phone/email | Email, Phone, Order Reference | JWT auth cookies issued without manual password entry | `INSERT INTO users/buyers` if not exists | Welcome email | Public | Auth Service | Not Tested |
| **Buyer** | Auth | Verify Email | `/verify-email` | Email link click | Activate user account | Valid email verification token | Token query param | Account status activated, redirect to login | `UPDATE users SET is_verified = true` | Verification success email | Public | Token Service | Not Tested |
| **Buyer** | Auth | Request Password Reset | `/buyer/forgot-password` | Form submit | Initiate password reset flow | Valid registered email | Email address | Reset link dispatched | `INSERT INTO password_resets` | Reset email | Public | Mailer Service | Not Tested |
| **Buyer** | Auth | Reset Password | `/buyer/reset-password` | Form submit | Set new account password | Valid reset token | Token, New Password | Password updated, sessions invalidated | `UPDATE users SET password_hash = ...` | Password changed alert | Public | Crypto Service | Not Tested |
| **Buyer** | Auth | Logout | Buyer Dashboard / Profile Sheet | "Sign Out" button | Terminate session | Authenticated buyer | None | Cookies cleared, token blacklisted | `INSERT INTO token_blacklist` | None | Buyer | Auth Service | Not Tested |
| **Buyer** | Catalog | Browse Sellers & Shops | `/buyer/dashboard` | Main grid | Discover active merchants | None | City/Area filter (optional) | List of verified active shops | Read `sellers`, `shops` | None | Public / Buyer | Catalog API | Not Tested |
| **Buyer** | Catalog | Search Products & Shops | `/buyer/dashboard`, Header | Search input | Find specific items or stores | None | Search query string | Filtered grid matching query | Read `products`, `sellers` | None | Public / Buyer | Search Index | Not Tested |
| **Buyer** | Catalog | Knock Seller | `/shop/:shopName` | "Knock" button | Signal interest in a shop | None | Seller ID | Knock counter incremented | Read/Update `seller_stats` | Seller alert | Public / Buyer | Social Service | Not Tested |
| **Buyer** | Wishlist | Add to Wishlist | Shop Page, Product Card | Heart icon click | Save item for future review | Authenticated buyer | Product ID | Item added to wishlist drawer | `INSERT INTO wishlist_items` | None | Buyer | Wishlist API | Not Tested |
| **Buyer** | Wishlist | Remove from Wishlist | `/buyer/wishlist` | Heart / Remove button | Delete saved item | Item in wishlist | Product ID | Item removed from view | `DELETE FROM wishlist_items` | None | Buyer | Wishlist API | Not Tested |
| **Buyer** | Cart | Add to Bag | Shop Page, Product Modal | "Add to Bag" button | Stage products for checkout | Active product in stock | Product ID, Quantity, Variant | Item placed in local/session bag | None (Client storage) | None | Public / Buyer | Cart State | Not Tested |
| **Buyer** | Checkout | Quote Delivery Fee | Checkout Modal | Address selection | Calculate Mzigo delivery price | Valid dropoff location | Latitude, Longitude, Seller ID | Accurate fee displayed before payment | `logistics_quotes` cache | None | Public / Buyer | Logistics Service | Not Tested |
| **Buyer** | Checkout | Initiate Payment | Checkout Modal | "Pay Now" button | Lock inventory and initiate Paystack | Bag has valid items, contact info provided | Items, Delivery Mode, Phone, Email | Paystack checkout URL / modal generated | `INSERT INTO orders (status='PAYMENT_PENDING')` | None | Public / Buyer | Paystack API | Not Tested |
| **Buyer** | Orders | View Order Tracking | `/track/:token` | Tracking URL / Dashboard link | Monitor live order progress | Valid tracking token | Token | Order details, ETA, and live map rendered | Read `orders`, `deliveries`, `tracking_tokens` | None | Public (Tokenized) | Tracking Service | Not Tested |
| **Buyer** | Orders | Confirm Receipt | Buyer Dashboard / Orders Tab | "Confirm Receipt" button | Acknowledge physical package delivery | Order in `DELIVERY_COMPLETE` / `READY_FOR_BUYER` | Order ID | Order marked `COMPLETED`, escrow released | `UPDATE orders SET status='COMPLETED'`, escrow release | Seller settlement notification | Buyer | Order Service | Not Tested |
| **Buyer** | Orders | Download Digital Product | `/buyer/orders` | "Download" link | Retrieve purchased digital file | Order status is `PAID` / `COMPLETED` | Order ID, Product ID | Signed S3/storage download URL streamed | Log `digital_downloads` | None | Buyer | Storage Service | Not Tested |
| **Buyer** | Orders | Cancel Pending Order | `/buyer/orders` | "Cancel Order" button | Abort order before seller fulfillment | Order in `PAID` or `PENDING` before prep | Order ID, Reason | Order cancelled, refund queued | `UPDATE orders SET status='CANCELLED'` | Cancellation email | Buyer | Order Policy | Not Tested |
| **Buyer** | Refunds | Submit Refund Request | `/buyer/refunds` | "Request Refund" button | Request monetary return | Eligible order status | Order ID, Reason, Photo evidence | Refund request placed in queue | `INSERT INTO refund_requests` | Admin & Seller alert | Buyer | Refund Service | Not Tested |
| **Buyer** | Profile | Update Profile & Address | Buyer Profile Sheet | "Save Profile" button | Maintain contact & default area | Authenticated buyer | Full Name, Phone, Area | Profile updated | `UPDATE buyers SET name=..., area=...` | None | Buyer | Buyer API | Not Tested |

---

## 3. Seller Action Inventory

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Seller** | Auth | Register Seller | `/seller/register` | Multi-step form submit | Onboard new merchant store | Unique shop name, valid email | Shop Name, Owner Name, Password, Address | Seller account created, verification email sent | `INSERT INTO users`, `INSERT INTO sellers` | Verification email | Public | Seller Auth | Not Tested |
| **Seller** | Auth | Login | `/seller/login` | Form submit | Authenticate seller session | Verified email, active seller | Email, Password | JWT session issued, redirects to seller dashboard | `UPDATE users SET last_login = NOW()` | None | Public | JWT / Cookie | Not Tested |
| **Seller** | Profile | Customize Shop Identity | Seller Settings Tab | Save button | Update shop biography, logo, theme | Authenticated seller | Bio, Accent Color, Working Hours | Shop storefront styling updated | `UPDATE sellers SET bio=..., theme=...` | None | Seller | Seller API | Not Tested |
| **Seller** | Profile | Upload Business Photo | Seller Settings Tab | File upload input | Set shop avatar / banner | Valid image file (PNG/JPG < 5MB) | Image file multipart | Image uploaded and displayed | `UPDATE sellers SET business_photo_url = ...` | None | Seller | Upload Service | Not Tested |
| **Seller** | Products | Create Physical Product | Seller Products Tab | "Add Product" button | Add physical merchandise | Active shop | Title, Price, Description, Inventory, Photos | Product created in catalog | `INSERT INTO products (type='physical')` | None | Seller | Product Service | Not Tested |
| **Seller** | Products | Create Digital Product | Seller Products Tab | "Add Digital Product" | Add downloadable asset | Active shop | Title, Price, File Asset (ZIP/PDF/EPUB) | Digital asset uploaded securely | `INSERT INTO products (type='digital')` | None | Seller | Storage Service | Not Tested |
| **Seller** | Products | Create Service / Appointment | Seller Products Tab | "Add Service" | Offer bookable appointment | Active shop | Title, Price, Duration, Working Hours | Service published with availability schedule | `INSERT INTO products (type='service')` | None | Seller | Booking Service | Not Tested |
| **Seller** | Products | Update Inventory Stock | Seller Products Tab | Stock input field | Adjust available stock count | Existing product | Product ID, New Stock Count | Stock updated, out-of-stock badge toggled | `UPDATE products SET inventory = ...` | None | Seller | Inventory Service | Not Tested |
| **Seller** | Products | Delete Product | Seller Products Tab | Trash icon button | Remove item from store | Product belongs to seller | Product ID | Soft-deleted / removed from catalog | `UPDATE products SET is_deleted = true` | None | Seller | Product Service | Not Tested |
| **Seller** | Orders | Accept & Prepare Order | Seller Orders Tab | "Prepare Order" button | Begin packaging physical order | Order status is `PAID` | Order ID | Order moves to `PROCESSING` / `FULFILLING` | `UPDATE orders SET status = 'PROCESSING'` | Buyer update email | Seller | Order Guard | Not Tested |
| **Seller** | Orders | Select CBD Hub Dropoff | Seller Orders Tab | "Drop at Hub" button | Dispatch order via central Mzigo hub | Delivery mode is CBD Hub / Delivery | Order ID, Selected Hub ID | Hub dropoff leg created for Mzigo | `UPDATE orders SET status = 'COLLECTION_PENDING'` | Mzigo & Buyer alert | Seller | Logistics Service | Not Tested |
| **Seller** | Orders | Confirm Hub Dropoff | Seller Orders Tab | "Mark Dropped at Hub" | Handover package to hub agent | Package delivered to hub desk | Order ID | Order moves to `READY_FOR_BUYER` / Transit | `UPDATE orders SET status = 'READY_FOR_BUYER'` | Buyer SMS/Email | Seller | Logistics Guard | Not Tested |
| **Seller** | Orders | Cancel Order (Seller) | Seller Orders Tab | "Cancel Order" button | Merchant rejects / cancels order | Order not yet completed | Order ID, Reason | Order cancelled, buyer refund initiated | `UPDATE orders SET status = 'CANCELLED'` | Buyer cancellation notice | Seller | Order Policy | Not Tested |
| **Seller** | Finances | View Available Balance | Seller Withdrawals Tab | Analytics summary card | Inspect earned sales & reserved escrow | Authenticated seller | None | Live available & pending balances shown | Read `seller_wallets`, `transactions` | None | Seller | Wallet Service | Not Tested |
| **Seller** | Finances | Request Payout Withdrawal | Seller Withdrawals Tab | "Request Payout" button | Withdraw earned funds to M-Pesa | Available balance >= minimum fee | Amount, M-Pesa Phone Number | Withdrawal queued for admin review/payout | `INSERT INTO withdrawal_requests`, balance deducted | Confirmation email | Seller | Payout Policy | Not Tested |
| **Seller** | Creators | Toggle Affiliate Listing | Seller Creators Tab | "Enable Creator Promotion" | Allow creators to request promotion | Active shop | Boolean flag, Commission percentage | Shop listed in creator discovery directory | `UPDATE sellers SET creator_listing_active = ...` | None | Seller | Creator Service | Not Tested |
| **Seller** | Creators | Invite Specific Creator | Seller Creators Tab | "Invite Creator" button | Partner directly with an influencer | Creator username or phone | Creator Identifier, Custom Rate | Invitation dispatched to creator | `INSERT INTO creator_invites` | Creator push/email | Seller | Creator Service | Not Tested |
| **Seller** | Creators | Accept / Reject Creator Request | Seller Creators Tab | "Accept" / "Decline" button | Approve influencer collaboration | Pending request from creator | Request ID, Decision | Partnership activated or declined | `UPDATE creator_shop_collaborations` | Creator notification | Seller | Collaboration API | Not Tested |

---

## 4. Creator Action Inventory

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Creator** | Auth | Register Creator | `/creator/register` | Form submit button | Onboard new affiliate partner | Valid email, WhatsApp phone | Name, Email, Password, WhatsApp Number | Account created, verification email sent | `INSERT INTO users`, `INSERT INTO creators` | Verification email | Public | Creator Auth | Not Tested |
| **Creator** | Auth | Login | `/creator/login` | Form submit button | Authenticate creator session | Verified email | Email, Password | JWT session issued, redirects to creator dashboard | `UPDATE users SET last_login = NOW()` | None | Public | JWT / Cookie | Not Tested |
| **Creator** | Referral | Generate General Referral Link | Creator Referral Tab | "Generate Link" button | Create tracking link for buyer attribution | Active creator | None | Unique referral code and shareable link created | `INSERT INTO creator_referral_links` | None | Creator | Referral Engine | Not Tested |
| **Creator** | Referral | Track Link Clicks | Public link `/c/:code` | HTTP redirect / click | Record attribution cookie on visitor | Valid referral code | Code in URL path | 30-day attribution cookie set, click logged | `INSERT INTO creator_link_clicks` | None | Public | Attribution Middleware | Not Tested |
| **Creator** | Partnership | Browse Available Shops | Creator Available Shops Tab | Catalog browser | Discover merchants offering commissions | Active creator | Filter/Search query | List of shops accepting collaborations | Read `sellers` where `creator_listing_active=true` | None | Creator | Growth Service | Not Tested |
| **Creator** | Partnership | Request Shop Collaboration | Creator Available Shops Tab | "Request to Promote" | Ask seller for permission to earn commissions | Not already partnered | Seller ID, Proposed message | Partnership request sent to seller | `INSERT INTO creator_shop_requests` | Seller notification | Creator | Collaboration API | Not Tested |
| **Creator** | Partnership | Leave Linked Shop | Creator Linked Shops Tab | "Disconnect" button | Terminate affiliate relationship with shop | Active partnership | Seller ID | Partnership dissolved, future orders not attributed | `UPDATE creator_shop_collaborations SET active=false` | Seller notification | Creator | Growth Policy | Not Tested |
| **Creator** | Invitation | Generate Seller Invite Link | Creator Dashboard | "Invite Merchant" button | Refer a new shop owner to Byblos | Active creator | None | Unique seller onboarding invitation URL | `INSERT INTO creator_seller_invites` | None | Creator | Referral Engine | Not Tested |
| **Creator** | Invitation | Onboard Invited Seller | `/join?creator=:code` | Seller registration flow | Attribute invited seller to creator | Valid invite token | Seller registration form data | Seller created with `invited_by_creator_id` set | `INSERT INTO sellers (creator_id=...)` | Creator notification | Public | Seller Onboarding | Not Tested |
| **Creator** | Earnings | View Analytics & Clicks | Creator Dashboard | Metrics cards | Inspect clicks, attributed sales, commissions | Authenticated creator | Date range filter | Live stats: Clicks, Conversions, Unpaid Commission | Read `creator_earnings`, `creator_link_clicks` | None | Creator | Analytics Service | Not Tested |
| **Creator** | Wallet | Request Commission Withdrawal | Creator Withdrawals Tab | "Request Withdrawal" button | Transfer earned commission to M-Pesa | Available commission >= minimum threshold | Amount, M-Pesa Phone Number | Withdrawal queued for admin approval/payout | `INSERT INTO creator_withdrawals` | Confirmation email | Creator | Payout Service | Not Tested |

---

## 5. Mzigo Ego (Logistics) Action Inventory

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mzigo Ego** | Auth | Login Rider / Partner | `/mzigo/login` | Form submit | Authenticate delivery courier | Valid logistics partner credentials | Phone / Email, Password | JWT session issued with `logistics` role | `UPDATE logistics_partners SET last_login=...` | None | Public | Logistics Auth | Not Tested |
| **Mzigo Ego** | Delivery | View Assigned Deliveries | `/mzigo/dashboard` | Active orders list | View delivery runs needing dispatch | Active partner session | Status filter | List of orders with pickup & dropoff coordinates | Read `logistics_requests`, `delivery_legs` | None | Logistics | Logistics API | Not Tested |
| **Mzigo Ego** | Delivery | Accept / Claim Pickup Run | Mzigo Dashboard | "Accept Pickup" button | Take ownership of merchant collection leg | Order ready for pickup | Request ID, Leg ID (`pickup`) | Leg assigned to rider, status `ASSIGNED` | `UPDATE delivery_legs SET rider_id=..., status='ASSIGNED'` | Seller alert | Logistics | Dispatch Engine | Not Tested |
| **Mzigo Ego** | Delivery | Confirm Parcel Collected | Mzigo Dashboard | "Package Collected" button | Confirm physical receipt from merchant | Rider at merchant shop | Request ID, Package Photo / Scan | Leg moves to `PICKED_UP`, order in transit | `UPDATE delivery_legs SET status='PICKED_UP'` | Buyer tracking update | Logistics | Delivery Guard | Not Tested |
| **Mzigo Ego** | Delivery | Stream Live GPS Location | Mzigo Mobile / Background API | GPS interval / API push | Provide movement-based ETA to buyer | Active in-transit leg | Leg ID, Latitude, Longitude, Heading | Buyer tracking page shows rider pin moving | `INSERT INTO rider_locations` | Real-time map update | Logistics | Geo Service | Not Tested |
| **Mzigo Ego** | Delivery | Deliver to CBD Hub | Mzigo Dashboard | "Drop at Central Hub" button | Complete hub-transfer leg | Hub dropoff order | Request ID, Hub Agent Signature/Code | Pickup leg closed, order staged at hub | `UPDATE delivery_legs SET status='COMPLETED'` | Buyer & Hub alert | Logistics | Hub Service | Not Tested |
| **Mzigo Ego** | Delivery | Confirm Final Dropoff | Mzigo Dashboard | "Confirm Delivered" button | Handover package to end buyer | Buyer present at dropoff location | Request ID, Buyer Confirmation Code | Order marked `DELIVERED`, funds unlocked | `UPDATE delivery_legs SET status='DELIVERED'`, order status | Buyer receipt, Escrow release | Logistics | Fulfillment API | Not Tested |
| **Mzigo Ego** | Delivery | Report Delivery Failure | Mzigo Dashboard | "Delivery Failed" button | Record failed dropoff (unreachable/rejected) | Attempted delivery failed | Request ID, Failure Reason, Proof Note | Leg flagged `FAILED`, return to seller initiated | `UPDATE delivery_legs SET status='FAILED'` | Seller & Buyer alert | Logistics | Logistics Policy | Not Tested |

---

## 6. Admin Action Inventory

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | Auth | Login Administrator | `/admin/login` | Form submit | Secure administrative access | Active admin credentials | Email, Password | Elevated JWT session issued | `UPDATE users SET last_login=NOW()` | None | Admin Only | Identity Service | Not Tested |
| **Admin** | Operations | View System Dashboard | `/admin/dashboard` | Main metrics overview | Real-time overview of platform activity | Authenticated admin | Date Range | GMV, total orders, escrow holdings, user totals | Read aggregate platform tables | None | Admin | Analytics Service | Not Tested |
| **Admin** | Merchants | Suspend / Reactivate Seller | Admin Sellers View | "Suspend" / "Activate" toggle | Restrict merchant with fraudulent activity | Existing seller profile | Seller ID, Target Status (`active`/`suspended`) | Storefront hidden, login restricted | `UPDATE sellers SET status=...` | Seller email notice | Admin | Admin Service | Not Tested |
| **Admin** | Creators | Moderate Flagged Earnings | Admin Creators View | "Release" / "Reverse" action | Resolve suspicious affiliate commissions | Flagged commission records exist | Earning ID, Action (`release`/`reverse`) | Commission approved or revoked | `UPDATE creator_earnings SET status=...` | Creator notification | Admin | Affiliate Policy | Not Tested |
| **Admin** | Finances | Approve & Process Payout | Admin Withdrawals View | "Process Payout" button | Disburse approved seller/creator funds | Pending withdrawal request | Withdrawal ID, Payout Reference | Paystack transfer initiated, ledger finalized | `UPDATE withdrawal_requests SET status='PAID'` | Seller/Creator SMS/Email | Admin | Payout Client | Not Tested |
| **Admin** | Finances | Reject Withdrawal Request | Admin Withdrawals View | "Reject" button | Decline invalid/fraudulent payout | Pending withdrawal request | Withdrawal ID, Rejection Reason | Funds returned to seller/creator wallet | `UPDATE withdrawal_requests SET status='REJECTED'`, refund balance | Rejection email | Admin | Ledger Service | Not Tested |
| **Admin** | Orders | Exceptional Order Reversal | Admin Orders View | "Reverse Order" button | Force reverse stuck or disputed order | Disputed or erroneous transaction | Order ID, Reversal Reason | Funds refunded, inventory restocked | `UPDATE orders SET status='REFUNDED'` | Buyer & Seller alert | Admin | Order Reversal | Not Tested |
| **Admin** | Logistics | Resolve Logistics Dispute | Admin Logistics View | "Resolve Dispute" button | Settle broken delivery / lost parcel | Disputed delivery leg | Request ID, Resolution (`refund_buyer`/`pay_seller`) | Dispute closed with manual settlement | `UPDATE logistics_requests SET dispute_status=...` | Courier & Customer alert | Admin | Logistics Service | Not Tested |
| **Admin** | Recovery | Retry Dead-Letter Job | Admin Fulfillment View | "Retry Job" button | Resubmit background async failure | Failed queue job in dead-letter table | Job ID | Background worker re-executes task | `UPDATE dead_letter_jobs SET status='RETRIED'` | None | Admin | Worker Engine | Not Tested |
| **Admin** | Recovery | Cancel Dead-Letter Order | Admin Fulfillment View | "Cancel & Refund" button | Cleanly terminate unrecoverable background failure | Dead letter order | Order ID | Order marked failed, automatic refund triggered | `UPDATE orders SET status='CANCELLED'`, refund queued | Buyer notification | Admin | Recovery Worker | Not Tested |
| **Admin** | Messaging | Broadcast Platform Update | Admin System View | "Broadcast Banner" | Alert all active PWA clients of update | Authenticated admin | Message, Version, Force Reload flag | Push notification & socket banner broadcast | `INSERT INTO system_broadcasts` | Real-time app banner | Admin | Socket / SSE | Not Tested |

---

## 7. Marketing Action Inventory (Read-Only)

| Role | Feature | Action | UI Location | Entry Point | Intended Purpose | Preconditions | Inputs | Expected Result | Database Effects | Notifications | Permissions | Dependencies | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Marketing** | Auth | Login Analyst | `/marketing/login` | Form submit | Authenticate marketing team member | Valid marketing credentials | Email, Password | Marketing session established | `UPDATE users SET last_login=NOW()` | None | Public | Identity Service | Not Tested |
| **Marketing** | Analytics | Inspect GMV Trends | `/marketing` Overview | Chart view | Monitor daily and monthly sales growth | Marketing session | Date filters | Time-series GMV chart rendered | Read-only aggregation | None | Marketing, Admin | Analytics API | Not Tested |
| **Marketing** | Analytics | Inspect Funnel & Geography | `/marketing` Funnel | Funnel tab | Analyze conversion drop-offs & locations | Marketing session | Geographic filter | City-by-city volume and funnel dropoff rates | Read-only aggregation | None | Marketing, Admin | Analytics API | Not Tested |

---
**Status:** Complete Action Inventory compiled. Proceeding immediately to Phase 2: Action Purpose and Business Logic.

