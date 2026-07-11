#!/usr/bin/env node
'use strict';

/**
 * Prune old Firebase Hosting versions and set retainedReleaseCount.
 * Uses the same credentials as `firebase login`.
 */
const { Client } = require('firebase-tools/lib/apiv2');
const { hostingApiOrigin } = require('firebase-tools/lib/api');
const hostingApi = require('firebase-tools/lib/hosting/api');
const auth = require('firebase-tools/lib/auth');
const apiv2 = require('firebase-tools/lib/apiv2');
const { requireAuth } = require('firebase-tools/lib/requireAuth');

async function bootstrapAuth() {
  const options = { project: PROJECT_ID, cwd: process.cwd() };
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (account && account.tokens && account.tokens.refresh_token) {
    auth.setActiveAccount(options, account);
    auth.setRefreshToken(account.tokens.refresh_token);
    apiv2.setRefreshToken(account.tokens.refresh_token);
    if (account.tokens.access_token) {
      apiv2.setAccessToken(account.tokens.access_token);
    }
    return;
  }
  await requireAuth({
    ...options,
    user: account && account.user,
    tokens: account && account.tokens,
  });
}

const PROJECT_ID = process.env.FIREBASE_PROJECT || 'oukei-hub';
const SITE_ID = process.env.FIREBASE_SITE || 'oukei-hub';
const CHANNEL_ID = process.env.FIREBASE_CHANNEL || 'live';
const KEEP_RELEASES = Number(process.env.HOSTING_KEEP_RELEASES || 3);
const DRY_RUN = process.argv.includes('--dry-run');

const apiClient = new Client({
  urlPrefix: hostingApiOrigin(),
  apiVersion: 'v1beta1',
  auth: true,
});

function versionIdFromName(name) {
  return String(name || '').split('/').pop();
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function listReleases(site, channel) {
  const releases = [];
  let pageToken = '';
  do {
    const queryParams = { pageSize: 100 };
    if (pageToken) queryParams.pageToken = pageToken;
    const res = await apiClient.get(
      `/projects/-/sites/${site}/channels/${channel}/releases`,
      { queryParams }
    );
    releases.push(...(res.body.releases || []));
    pageToken = res.body.nextPageToken || '';
  } while (pageToken);
  return releases;
}

async function deleteVersion(site, versionId) {
  await apiClient.delete(`/projects/-/sites/${site}/versions/${versionId}`);
}

async function setRetainedReleaseCount(site, channel, count) {
  const res = await apiClient.patch(
    `/projects/${PROJECT_ID}/sites/${site}/channels/${channel}`,
    {
      name: `projects/${PROJECT_ID}/sites/${site}/channels/${channel}`,
      retainedReleaseCount: count,
    },
    { queryParams: { updateMask: 'retainedReleaseCount' } }
  );
  return res.body;
}

async function main() {
  await bootstrapAuth();
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Site: ${SITE_ID}`);
  console.log(`Channel: ${CHANNEL_ID}`);
  console.log(`Keep releases: ${KEEP_RELEASES}`);
  if (DRY_RUN) console.log('Mode: dry-run');

  const channel = await hostingApi.getChannel(PROJECT_ID, SITE_ID, CHANNEL_ID);
  if (!channel) {
    throw new Error(`Channel not found: ${CHANNEL_ID}`);
  }

  const currentVersionId = versionIdFromName(channel.release && channel.release.version && channel.release.version.name);
  console.log(`Current live version: ${currentVersionId || 'unknown'}`);
  console.log(`Current retainedReleaseCount: ${channel.retainedReleaseCount}`);

  const releases = (await listReleases(SITE_ID, CHANNEL_ID))
    .sort((a, b) => new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime());

  const keepVersionIds = new Set();
  releases.slice(0, KEEP_RELEASES).forEach((release) => {
    const vid = versionIdFromName(release.version && release.version.name);
    if (vid) keepVersionIds.add(vid);
  });
  if (currentVersionId) keepVersionIds.add(currentVersionId);

  console.log(`Releases found: ${releases.length}`);
  console.log(`Versions to keep: ${[...keepVersionIds].join(', ')}`);

  const versions = await hostingApi.listVersions(SITE_ID);
  const deletable = versions.filter((version) => {
    const vid = versionIdFromName(version.name);
    return vid && !keepVersionIds.has(vid);
  });

  let freedBytes = 0;
  for (const version of deletable) {
    freedBytes += Number(version.versionBytes) || 0;
  }

  console.log(`Versions total: ${versions.length}`);
  console.log(`Versions to delete: ${deletable.length}`);
  console.log(`Estimated freed storage: ${formatBytes(freedBytes)}`);

  if (!deletable.length) {
    console.log('No old versions to delete.');
  } else if (DRY_RUN) {
    deletable.forEach((version) => {
      const vid = versionIdFromName(version.name);
      console.log(`[dry-run] delete ${vid} (${formatBytes(version.versionBytes)})`);
    });
  } else {
    for (const version of deletable) {
      const vid = versionIdFromName(version.name);
      try {
        await deleteVersion(SITE_ID, vid);
        console.log(`Deleted version ${vid} (${formatBytes(version.versionBytes)})`);
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        console.error(`Failed to delete ${vid}: ${message}`);
      }
    }
  }

  if (channel.retainedReleaseCount !== KEEP_RELEASES) {
    if (DRY_RUN) {
      console.log(`[dry-run] set retainedReleaseCount=${KEEP_RELEASES}`);
    } else {
      const updated = await setRetainedReleaseCount(SITE_ID, CHANNEL_ID, KEEP_RELEASES);
      console.log(`Updated retainedReleaseCount: ${updated.retainedReleaseCount}`);
    }
  } else {
    console.log(`retainedReleaseCount already ${KEEP_RELEASES}`);
  }

  console.log('Hosting cleanup complete.');
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
