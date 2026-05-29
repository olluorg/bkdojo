/**
 * COOP-resilient Google OAuth provider for the @ollu AuthClient.
 *
 * The SDK's bundled GoogleAuthProvider polls `popup.location`/`popup.closed`,
 * which Google's `COOP: same-origin` pages break (the opener loses the popup
 * handle). This provider builds the same OIDC implicit (`response_type=id_token`)
 * request, but receives the result from the popup over a BroadcastChannel — see
 * `relayOAuthCallbackIfPresent` for the popup side.
 */

import type { AuthLoginResult, AuthProvider } from '@ollu/sdk-core';
import { OAUTH_CHANNEL, type OAuthCallbackMessage } from './oauthCallback';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const DEFAULT_SCOPES = ['openid', 'email', 'profile'];
const LOGIN_TIMEOUT_MS = 3 * 60_000;

export interface GooglePopupProviderOptions {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes?: readonly string[];
}

export class GooglePopupProvider implements AuthProvider {
  readonly id = 'google';

  constructor(private readonly options: GooglePopupProviderOptions) {}

  async startLogin(): Promise<AuthLoginResult> {
    const state = randomString(24);
    const nonce = randomString(24);
    const scopes = (this.options.scopes ?? DEFAULT_SCOPES).join(' ');

    const url = new URL(AUTH_ENDPOINT);
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('redirect_uri', this.options.redirectUri);
    url.searchParams.set('response_type', 'id_token');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    // Open the channel before the popup so we never miss its message.
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    const popup = window.open(url.toString(), 'ollu-oauth', 'width=480,height=640');
    if (!popup) {
      channel.close();
      throw new Error('popup blocked');
    }

    return await new Promise<AuthLoginResult>((resolve, reject) => {
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.close();
        try {
          popup.close();
        } catch {
          // opener handle may be severed by COOP; the popup closes itself anyway.
        }
        fn();
      };

      channel.onmessage = (event: MessageEvent<OAuthCallbackMessage>) => {
        const data = event.data;
        if (!data || data.state !== state) return; // not this login attempt
        if (data.error) {
          const desc = data.error_description;
          done(() => reject(new Error(`oauth error: ${data.error}${desc ? ` (${desc})` : ''}`)));
          return;
        }
        if (!data.id_token) {
          done(() => reject(new Error('oauth callback missing id_token')));
          return;
        }
        const idToken = data.id_token;
        done(() => resolve({ provider: this.id, idToken }));
      };

      const timer = setTimeout(
        () => done(() => reject(new Error('login timed out'))),
        LOGIN_TIMEOUT_MS,
      );
    });
  }
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_').slice(0, length);
}
