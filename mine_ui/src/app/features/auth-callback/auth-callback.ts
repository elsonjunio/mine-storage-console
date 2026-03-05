import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center bg-[#101c22]">

      <!-- Logo -->
      <div class="flex flex-col items-center gap-5 mb-10">
        <div class="relative">
          <div class="bg-primary/15 p-5 rounded-2xl text-primary">
            <span class="material-symbols-outlined text-[48px]">dns</span>
          </div>
          <!-- Animated ring -->
          <span class="absolute inset-0 rounded-2xl border-2 border-primary/40 animate-ping"></span>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-100">Mine Console</h1>
      </div>

      <!-- Spinner + label -->
      <div class="flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
        <p class="text-sm text-slate-400 tracking-wide">Authenticating…</p>
      </div>

    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      await this.auth.login();
      return;
    }
    try {
      await this.auth.handleCallback(code);
    } catch {
      await this.auth.login();
    }
  }
}
