/**
 * PM2 Process Management Configuration for BYBLOS
 *
 * Designed to prevent:
 * 1. Node.js V8 heap out-of-memory crashes (`FATAL ERROR: Reached heap limit Allocation failed`)
 * 2. Rapid unconstrained restart loops (exp_backoff_restart_delay)
 * 3. Linux swap thrashing and core-dump disk saturation
 */

module.exports = {
  apps: [
    {
      name: 'byblos-api',
      script: 'server/src/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=384',
      max_memory_restart: '400M',
      exp_backoff_restart_delay: 1000,
      restart_delay: 2000,
      max_restarts: 50,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        BYBLOS_PROCESS_ROLE: 'api'
      }
    },
    {
      name: 'byblos-worker',
      script: 'server/src/worker.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=384',
      max_memory_restart: '350M',
      exp_backoff_restart_delay: 1000,
      restart_delay: 2000,
      max_restarts: 50,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        BYBLOS_PROCESS_ROLE: 'worker'
      }
    }
  ]
};

