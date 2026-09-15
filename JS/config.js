// This is the local test copy - always points at `wrangler dev`. The live site's
// config.js is maintained separately in the GitHub repo, pointed at the deployed
// Worker URL (https://athens-gis-worker.athensgisrepository.workers.dev/chat).
window.CONFIG = {
  R2_BASE_URL: 'https://data.athensgis.gr',
  CHAT_WORKER_URL: 'https://athens-gis-worker.athensgisrepository.workers.dev/chat'
};