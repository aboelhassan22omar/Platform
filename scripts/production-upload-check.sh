#!/usr/bin/env bash
# Confirms an object uploaded through the public storage host reached the
# bucket the API reads, then deletes it. Usage: production-upload-check.sh KEY
set -uo pipefail
key="${1:?object key}"
[[ "$key" =~ ^diagnostics/upload-check-[0-9]+\.txt$ ]] || { echo 'Invalid key'; exit 1; }
docker exec -i -e KEY="$key" amr-production-backend-1 node - <<'JS'
const { ConfigService } = require('@nestjs/config');
const { configuration } = require('./dist/src/config/configuration');
const { StorageService } = require('./dist/src/common/storage/storage.service');
(async () => {
  const storage = new StorageService(new ConfigService(configuration()));
  const stat = await storage.statObject(storage.videoBucket, process.env.KEY).catch(() => null);
  console.log('uploaded object visible to the API:', Boolean(stat));
  await storage.removeObject(storage.videoBucket, process.env.KEY).catch(() => undefined);
})();
JS
