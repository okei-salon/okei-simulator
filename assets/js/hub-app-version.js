/* OUKEI HUB Schema Version
 * Bump ONLY when Firestore hubData shape/meaning changes.
 * Keep in sync with: assets/hub-app-version.json and firestore.rules
 */
var HUB_SCHEMA_VERSION = 2;
var HUB_SCHEMA_VERSION_MESSAGE = '最新版へ更新してください';

if (typeof window !== 'undefined') {
  window.HUB_SCHEMA_VERSION = HUB_SCHEMA_VERSION;
  window.HUB_SCHEMA_VERSION_MESSAGE = HUB_SCHEMA_VERSION_MESSAGE;
  // Backward-compatible aliases used by older guard snippets during rollout.
  window.HUB_APP_VERSION = String(HUB_SCHEMA_VERSION);
  window.HUB_APP_VERSION_MESSAGE = HUB_SCHEMA_VERSION_MESSAGE;
}
