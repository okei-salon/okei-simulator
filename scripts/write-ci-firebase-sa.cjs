#!/usr/bin/env node
'use strict';

/**
 * Write Firebase service account JSON for CI Application Default Credentials.
 * Does not print secret material (private_key / full JSON).
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT  raw service-account JSON string
 *   GOOGLE_APPLICATION_CREDENTIALS  output path (required)
 */
const fs = require('fs');
const path = require('path');

function main() {
  const outPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';

  if (!outPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required');
  }
  if (!String(raw).trim()) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is empty — check GitHub secret FIREBASE_SERVICE_ACCOUNT_OUKEI_HUB'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not valid JSON — check GitHub secret FIREBASE_SERVICE_ACCOUNT_OUKEI_HUB'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be a JSON object');
  }
  if (parsed.type !== 'service_account') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT type must be "service_account"');
  }
  if (typeof parsed.client_email !== 'string' || !parsed.client_email.includes('@')) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT missing client_email');
  }
  if (typeof parsed.private_key !== 'string' || parsed.private_key.length < 32) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT missing private_key');
  }
  if (typeof parsed.project_id !== 'string' || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT missing project_id');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Re-serialize so private_key newlines / formatting stay valid JSON for google-auth-library
  fs.writeFileSync(outPath, JSON.stringify(parsed), { encoding: 'utf8', mode: 0o600 });

  const st = fs.statSync(outPath);
  if (!st.isFile() || st.size < 64) {
    throw new Error('Failed to write service account credentials file');
  }

  // Safe diagnostics only (no private_key / no full email dump)
  const domain = parsed.client_email.split('@')[1] || '(unknown-domain)';
  console.log('Service account credentials file written');
  console.log('path_set: GOOGLE_APPLICATION_CREDENTIALS');
  console.log('bytes:', st.size);
  console.log('project_id:', parsed.project_id);
  console.log('client_email_domain:', domain);
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
