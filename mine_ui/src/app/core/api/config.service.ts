import { Injectable } from '@angular/core';

interface AppConfig {
  apiBaseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  agentBackendUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = {
    apiBaseUrl: 'http://localhost:8000',
    keycloakUrl: 'http://localhost:8080',
    keycloakRealm: 'mine',
    keycloakClientId: 'mine-frontend',
  };

  load(): Promise<void> {
    return fetch('/config.json')
      .then((res) => res.json())
      .then((data: AppConfig) => {
        this.config = data;
      })
      .catch(() => {});
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  get keycloakUrl(): string {
    return this.config.keycloakUrl;
  }

  get keycloakRealm(): string {
    return this.config.keycloakRealm;
  }

  get keycloakClientId(): string {
    return this.config.keycloakClientId;
  }

  get agentBackendUrl(): string {
    return this.config.agentBackendUrl ?? '';
  }
}
