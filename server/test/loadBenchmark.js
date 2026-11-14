import { execSync } from 'child_process';
import fs from 'fs';

const connectionsList = [10, 25, 50, 100, 250, 500, 1000];
const endpoints = [
  { name: 'health', url: 'http://localhost:3005/api/health' },
  { name: 'products', url: 'http://localhost:3005/api/public/products' },
  { name: 'sellers', url: 'http://localhost:3005/api/public/sellers/active' }
];

const results = {};

for (const ep of endpoints) {
  results[ep.name] = [];
  console.log(`\n=== Benchmarking Endpoint: ${ep.name} (${ep.url}) ===`);
  for (const c of connectionsList) {
    try {
      console.log(`Running with ${c} connections...`);
      const cmd = `npx --yes autocannon -j -d 5 -c ${c} ${ep.url}`;
      const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const parsed = JSON.parse(output);
      const summary = {
        connections: c,
        rps_avg: parsed.requests.average,
        rps_max: parsed.requests.max,
        p50: parsed.latency.p50,
        p95: parsed.latency.p97_5, // autocannon provides 97.5% and 99%
        p99: parsed.latency.p99,
        avg_latency: parsed.latency.average,
        max_latency: parsed.latency.max,
        errors: parsed.errors,
        timeouts: parsed.timeouts,
        non2xx: parsed.non2xx,
        total_requests: parsed.requests.total
      };
      results[ep.name].push(summary);
      console.log(`-> Concurrency: ${c} | RPS: ${summary.rps_avg.toFixed(1)} | p50: ${summary.p50}ms | p99: ${summary.p99}ms | Errors: ${summary.errors} | Non-2xx: ${summary.non2xx}`);
    } catch (err) {
      console.error(`Failed at concurrency ${c}:`, err.message);
      results[ep.name].push({ connections: c, error: err.message });
    }
  }
}

fs.writeFileSync('server/test/load_benchmark_results.json', JSON.stringify(results, null, 2));
console.log('\nResults written to server/test/load_benchmark_results.json');

