#!/bin/sh
# Container entrypoint: run pending migrations, then hand off to the server.
#
# set -e: if migrations fail, the container must fail to start rather than
# boot the API against a schema its code doesn't match.
set -e

npm run migrate

# exec node directly, NOT `exec npm start`. `npm start` still forks node as
# its own child process even under exec -- exec replaces this shell, so
# SIGTERM signal from orchestrator/Docker reaches node directly for graceful
# shutdown and connection draining.
exec node src/index.js
