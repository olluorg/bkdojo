/**
 * OAuth popup-callback relay (SDK-free, so it can run from the app entry before
 * anything else loads).
 *
 * Google's pages send `Cross-Origin-Opener-Policy: same-origin`, which severs the
 * opener<->popup window handle — the opener can no longer read `popup.location`
 * or `popup.closed`. So instead of the opener polling the popup, the popup (which
 * is back on our own origin after Google redirects to `redirect_uri`) relays the
 * implicit-flow result to the opener over a same-origin BroadcastChannel and then
 * closes itself. The opener side listens in `GooglePopupProvider.startLogin`.
 */

export const OAUTH_CHANNEL = 'ollu-oauth';

export interface OAuthCallbackMessage {
  id_token?: string | null;
  state?: string | null;
  error?: string | null;
  error_description?: string | null;
}

/**
 * If the current URL fragment is a Google implicit-flow callback, relay it to the
 * opener and close this (popup) window. Returns true when handled, so the caller
 * can skip booting the app in the popup.
 */
export function relayOAuthCallbackIfPresent(): boolean {
  const hash = window.location.hash;
  if (hash.length < 2) return false;
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  // Real routes look like "/today"; an implicit OAuth response carries id_token/error.
  const params = new URLSearchParams(fragment);
  if (!params.has('id_token') && !params.has('error')) return false;

  try {
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    channel.postMessage({
      id_token: params.get('id_token'),
      state: params.get('state'),
      error: params.get('error'),
      error_description: params.get('error_description'),
    } satisfies OAuthCallbackMessage);
    channel.close();
  } catch {
    // BroadcastChannel unavailable — nothing to relay; still close/clear below.
  }

  // We're the OAuth popup: close it. If close is a no-op (not actually a popup),
  // strip the fragment so the app can boot normally instead of looping.
  window.close();
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.replace(window.location.pathname + window.location.search);
    }
  }, 150);
  return true;
}
