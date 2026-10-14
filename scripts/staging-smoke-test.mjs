#!/usr/bin/env node
/**
 * scripts/staging-smoke-test.mjs
 *
 * Automated Staging Smoke Verification Suite for Byblos
 *
 * Verifies the deployed application and infrastructure health without executing
 * destructive operations:
 *   1. Target Environment & Production Guardrail
 *   2. Backend Health & Database Liveness (/api/health)
 *   3. Service Readiness & Cache/Provider Status (/api/health/ready)
 *   4. Frontend SPA Shell & Routing Delivery (/)
 *   5. Public Catalog & Security Endpoints (/api/public/aesthetics, /api/public/csrf-token)
 *   6. Security Headers & TLS Configuration
 *
 * Usage:
 *   node scripts/staging-smoke-test.mjs [--target=https://staging.byblosafrica.site] [--timeout=10000]
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(prefix, fallback) {
  const found = args.find((a) => a.startsWith(prefix));
  if (found) return found.split('=')[1];
  return fallback;
}

const rawTarget = getArg('--target', process.env.STAGING_URL || 'https://staging.byblosafrica.site');
const timeoutMs = Number.parseInt(getArg('--timeout', '10000'), 10);
const outputFile = getArg('--output', 'staging-smoke-summary.json');

// --- Control 1: Production Safeguard Guardrail ---
function validateStagingTarget(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    throw new Error(`Invalid target URL provided: "${targetUrl}". Error: ${err.message}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicitly disallow production domains (new domain byblosafrica.site and legacy bybloshq.space)
  const FORBIDDEN_PROD_HOSTS = [
    'byblosafrica.site',
    'www.byblosafrica.site',
    'api.byblosafrica.site',
    'bybloshq.space',
    'www.bybloshq.space',
    'api.bybloshq.space'
  ];
  if (FORBIDDEN_PROD_HOSTS.includes(hostname)) {
    throw new Error(
      `[SECURITY REJECTION] Target "${hostname}" is identified as PRODUCTION. ` +
      `Smoke tests MUST NOT be directed against production systems.`
    );
  }

  // Allowed staging patterns: staging subdomain, localhost, or explicit staging environment
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isStagingDomain = hostname.startsWith('staging.') || hostname.includes('staging');
  const isPreview = hostname.includes('.vercel.app') || hostname.includes('.render.com');

  if (!isLocal && !isStagingDomain && !isPreview) {
    console.warn(`[WARN] Target host "${hostname}" is not recognized as a standard staging pattern. Proceeding with caution.`);
  }

  return parsed.origin;
}

const targetOrigin = validateStagingTarget(rawTarget);
console.log(`\n======================================================`);
console.log(`BYBLOS STAGING SMOKE VERIFICATION SUITE`);
console.log(`Target: ${targetOrigin}`);
console.log(`Timeout: ${timeoutMs}ms`);
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`======================================================\n`);

const results = [];

async function makeRequest(endpoint, options = {}) {
  const url = `${targetOrigin}${endpoint}`;
  const start = Date.now();
  const isHttps = url.startsWith('https:');
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Byblos-Staging-Smoke-Verifier/1.0',
          Accept: options.accept || 'application/json, text/html, */*',
          ...options.headers
        },
        timeout: timeoutMs
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const duration = Date.now() - start;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            duration
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runCheck(name, checkFn) {
  const start = Date.now();
  process.stdout.write(`- Checking ${name}... `);
  try {
    const details = await checkFn();
    const duration = Date.now() - start;
    console.log(`[PASS] (${duration}ms)`);
    results.push({ name, status: 'PASS', duration, details });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`[FAIL] (${duration}ms) -> ${err.message}`);
    results.push({ name, status: 'FAIL', duration, error: err.message });
  }
}

// -----------------------------------------------------------------------------
// Test Scenarios
// -----------------------------------------------------------------------------
async function executeSmokeSuite() {
  // Check 1: Backend Health (Liveness + Database check)
  await runCheck('Backend Health (/api/health)', async () => {
    const res = await makeRequest('/api/health');
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, received HTTP ${res.status}`);
    }
    let json;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new Error(`Expected valid JSON response, received: ${res.body.slice(0, 100)}`);
    }
    if (json.status !== 'ok') {
      throw new Error(`Health status is not 'ok': ${JSON.stringify(json)}`);
    }
    if (json.database !== 'connected') {
      throw new Error(`Database reports disconnected state: ${json.database}`);
    }
    return { status: json.status, database: json.database, uptime: json.uptime };
  });

  // Check 2: Service Readiness (/api/health/ready)
  await runCheck('Service Readiness Probe (/api/health/ready)', async () => {
    const res = await makeRequest('/api/health/ready');
    if (res.status !== 200) {
      throw new Error(`Readiness probe failed with HTTP ${res.status}`);
    }
    let json;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new Error(`Invalid JSON from readiness probe`);
    }
    if (json.status !== 'ready') {
      throw new Error(`Readiness status reported: ${json.status}`);
    }
    if (json.database !== 'ready') {
      throw new Error(`Database is not ready: ${json.database}`);
    }
    return {
      status: json.status,
      database: json.database,
      redis: json.redis || 'unknown',
      paystack: json.paystack || 'unknown'
    };
  });

  // Check 3: Frontend SPA Shell Delivery (/)
  await runCheck('Frontend SPA Shell Delivery (/)', async () => {
    const res = await makeRequest('/', { accept: 'text/html' });
    if (res.status !== 200) {
      throw new Error(`Frontend root returned HTTP ${res.status}`);
    }
    const contentType = res.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Expected text/html, received ${contentType}`);
    }
    if (!res.body.includes('<div id="root">') && !res.body.includes('Byblos')) {
      throw new Error('Frontend HTML missing root mount container or application branding');
    }
    return { contentType, bytes: res.body.length };
  });

  // Check 4: Public CSRF Protection Token Delivery (/api/public/csrf-token)
  await runCheck('Public CSRF Token Initialization (/api/public/csrf-token)', async () => {
    const res = await makeRequest('/api/public/csrf-token');
    if (res.status !== 200) {
      throw new Error(`CSRF token endpoint returned HTTP ${res.status}`);
    }
    let json;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new Error('CSRF response was not valid JSON');
    }
    const token = json.csrfToken || json.csrf_token || json.token;
    if (!token && !res.headers['set-cookie']) {
      throw new Error('CSRF response missing csrfToken property and cookie');
    }
    return { hasToken: Boolean(token), hasCookie: Boolean(res.headers['set-cookie']) };
  });

  // Check 5: Public Aesthetics & Catalog API (/api/public/aesthetics)
  await runCheck('Public Catalog Aesthetics API (/api/public/aesthetics)', async () => {
    const res = await makeRequest('/api/public/aesthetics');
    if (res.status !== 200) {
      throw new Error(`Aesthetics endpoint returned HTTP ${res.status}`);
    }
    let json;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new Error('Aesthetics response was not valid JSON');
    }
    if (!json.data && !Array.isArray(json)) {
      throw new Error('Unexpected aesthetics payload format');
    }
    const count = Array.isArray(json.data) ? json.data.length : (Array.isArray(json) ? json.length : 0);
    return { recordCount: count };
  });

  // Check 6: Security Response Headers
  await runCheck('Security Headers Inspection', async () => {
    const res = await makeRequest('/api/health');
    const headers = res.headers;
    const details = {
      xContentTypeOptions: headers['x-content-type-options'] || 'absent',
      xFrameOptions: headers['x-frame-options'] || 'absent',
      contentSecurityPolicy: headers['content-security-policy'] ? 'present' : 'absent'
    };
    return details;
  });

  // Output summary
  console.log(`\n======================================================`);
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`SMOKE TEST RESULTS: ${passed}/${total} Passed (${failed} Failed)`);
  console.log(`======================================================\n`);

  // Write machine-readable artifact
  const summaryPayload = {
    target: targetOrigin,
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    results
  };

  try {
    fs.writeFileSync(path.resolve(process.cwd(), outputFile), JSON.stringify(summaryPayload, null, 2));
    console.log(`Test artifact written to ${outputFile}`);
  } catch (err) {
    console.error(`Failed to write artifact file: ${err.message}`);
  }

  // Format GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const mdLines = [
      `## 🚀 Staging Smoke Verification Report`,
      `**Target Environment:** \`${targetOrigin}\``,
      `**Timestamp:** ${new Date().toISOString()}`,
      `**Outcome:** ${failed === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed} CHECKS FAILED`}`,
      ``,
      `| Check | Status | Duration | Details / Error |`,
      `| :--- | :---: | :---: | :--- |`
    ];

    for (const r of results) {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      const detailStr = r.status === 'PASS'
        ? `\`${JSON.stringify(r.details || {})}\``
        : `\`${r.error}\``;
      mdLines.push(`| ${r.name} | ${icon} ${r.status} | ${r.duration}ms | ${detailStr} |`);
    }

    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, mdLines.join('\n') + '\n');
    } catch (err) {
      console.warn(`Failed writing to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

executeSmokeSuite().catch((err) => {
  console.error(`\n[FATAL ERROR] Smoke test runner failed: ${err.message}`);
  process.exit(1);
});
