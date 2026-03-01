import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TOKEN_STORAGE_KEY, API } from '../api/api.config';
import { ConfigService } from '../api/config.service';

const PKCE_VERIFIER_KEY = 'pkce_code_verifier';

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array.buffer);
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private config = inject(ConfigService);
  private router = inject(Router);

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  async login(): Promise<void> {
    const { verifier, challenge } = await generatePkcePair();
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

    const authUrl = new URL(
      `/realms/${this.config.keycloakRealm}/protocol/openid-connect/auth`,
      this.config.keycloakUrl,
    );
    authUrl.searchParams.set('client_id', this.config.keycloakClientId);
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  }

  async handleCallback(code: string): Promise<void> {
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Missing PKCE verifier');
    }
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    const res = await fetch(`${this.config.apiBaseUrl}${API.AUTH_CALLBACK}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: `${window.location.origin}/auth/callback`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Auth callback failed: ${res.status}`);
    }

    const data = await res.json();
    const mineToken: string = data['data']?.['access_token'];
    localStorage.setItem(TOKEN_STORAGE_KEY, mineToken);

    await this.router.navigateByUrl('/');
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    const logoutUrl = new URL(
      `/realms/${this.config.keycloakRealm}/protocol/openid-connect/logout`,
      this.config.keycloakUrl,
    );
    logoutUrl.searchParams.set('client_id', this.config.keycloakClientId);
    logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);

    window.location.href = logoutUrl.toString();
  }
}
