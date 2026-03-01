import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import type { MeResponse } from '../api/api.types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  readonly user = signal<MeResponse | null>(null);

  readonly displayName = computed(() => {
    const u = this.user();
    return u?.raw_claims?.fname || u?.raw_claims?.username || u?.email || '';
  });

  readonly email = computed(() => this.user()?.email ?? '');

  readonly initials = computed(() => {
    const name = this.displayName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  });

  async loadMe(): Promise<void> {
    const res = await firstValueFrom(this.api.me());
    if (res.data) this.user.set(res.data);
  }
}
