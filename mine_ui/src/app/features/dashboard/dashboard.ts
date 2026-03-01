import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/auth/user.service';
import { UiCardComponent, UiTableComponent } from '../../shared/components';
import type { BucketResponse } from '../../core/api/api.types';

interface QuickAction {
  labelKey: string;
  descKey: string;
  icon: string;
  route: string;
  adminOnly: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, TranslatePipe, UiCardComponent, UiTableComponent],
  template: `
    <div class="p-6 space-y-8">

      <!-- Welcome Header -->
      <div>
        <h1 class="text-2xl font-bold" [class]="titleClass">
          {{ 'DASHBOARD.WELCOME' | translate: { name: userService.displayName() } }}
        </h1>
        <p class="mt-1 text-sm" [class]="mutedClass">
          {{ (userService.isAdmin() ? 'DASHBOARD.SUBTITLE_ADMIN' : 'DASHBOARD.SUBTITLE_USER') | translate }}
        </p>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div [class]="statCardClass">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium" [class]="mutedClass">{{ 'DASHBOARD.STATS.BUCKETS' | translate }}</p>
            <div class="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[20px]">database</span>
            </div>
          </div>
          <p class="mt-3 text-3xl font-bold" [class]="titleClass">
            {{ loading() ? '—' : bucketCount() }}
          </p>
        </div>

        @if (userService.isAdmin()) {
          <div [class]="statCardClass">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium" [class]="mutedClass">{{ 'DASHBOARD.STATS.USERS' | translate }}</p>
              <div class="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <span class="material-symbols-outlined text-[20px]">group</span>
              </div>
            </div>
            <p class="mt-3 text-3xl font-bold" [class]="titleClass">
              {{ loading() ? '—' : (userCount() ?? '—') }}
            </p>
          </div>
        }

      </div>

      <!-- Quick Actions -->
      <div>
        <p [class]="sectionLabelClass">{{ 'DASHBOARD.ACTIONS.TITLE' | translate }}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (action of visibleActions(); track action.route) {
            <a [routerLink]="action.route" class="block">
              <ui-card>
                <span card-icon class="material-symbols-outlined text-[20px]">{{ action.icon }}</span>
                <span card-title>{{ action.labelKey | translate }}</span>
                <span card-description>{{ action.descKey | translate }}</span>
                <span card-footer></span>
              </ui-card>
            </a>
          }
        </div>
      </div>

      <!-- Recent Buckets -->
      <div>
        <p [class]="sectionLabelClass">{{ 'DASHBOARD.RECENT.TITLE' | translate }}</p>
        <ui-table>
          <thead>
            <tr>
              <th [class]="thClass">{{ 'DASHBOARD.RECENT.NAME' | translate }}</th>
              <th [class]="thClass">{{ 'DASHBOARD.RECENT.CREATED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (bucket of recentBuckets(); track bucket.name) {
              <tr>
                <td [class]="tdClass">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-primary">database</span>
                    <span class="font-medium">{{ bucket.name }}</span>
                  </div>
                </td>
                <td [class]="tdClass">{{ formatDate(bucket.creation_date) }}</td>
              </tr>
            }
            @if (!loading() && !recentBuckets().length) {
              <tr>
                <td colspan="2" [class]="emptyClass">{{ 'DASHBOARD.RECENT.EMPTY' | translate }}</td>
              </tr>
            }
            @if (loading()) {
              <tr>
                <td colspan="2" [class]="emptyClass">{{ 'DASHBOARD.STATS.LOADING' | translate }}</td>
              </tr>
            }
          </tbody>
        </ui-table>
      </div>

    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  readonly userService = inject(UserService);

  readonly buckets = signal<BucketResponse[]>([]);
  readonly userCount = signal<number | null>(null);
  readonly loading = signal(true);

  readonly bucketCount = computed(() => this.buckets().length);
  readonly recentBuckets = computed(() => this.buckets().slice(0, 5));
  readonly visibleActions = computed(() =>
    this.quickActions.filter(a => !a.adminOnly || this.userService.isAdmin()),
  );

  readonly quickActions: QuickAction[] = [
    {
      labelKey: 'SIDEBAR.NAV.BUCKETS',
      descKey: 'DASHBOARD.ACTIONS.BUCKETS_DESC',
      icon: 'database',
      route: '/buckets',
      adminOnly: false,
    },
    {
      labelKey: 'SIDEBAR.NAV.OBJECTS',
      descKey: 'DASHBOARD.ACTIONS.OBJECTS_DESC',
      icon: 'folder_open',
      route: '/objects',
      adminOnly: false,
    },
    {
      labelKey: 'SIDEBAR.NAV.USERS',
      descKey: 'DASHBOARD.ACTIONS.USERS_DESC',
      icon: 'group',
      route: '/users',
      adminOnly: true,
    },
    {
      labelKey: 'SIDEBAR.NAV.GROUPS',
      descKey: 'DASHBOARD.ACTIONS.GROUPS_DESC',
      icon: 'groups',
      route: '/groups',
      adminOnly: true,
    },
    {
      labelKey: 'SIDEBAR.NAV.POLICIES',
      descKey: 'DASHBOARD.ACTIONS.POLICIES_DESC',
      icon: 'description',
      route: '/policies',
      adminOnly: true,
    },
    {
      labelKey: 'SIDEBAR.NAV.CREDENTIALS',
      descKey: 'DASHBOARD.ACTIONS.CREDENTIALS_DESC',
      icon: 'key',
      route: '/credentials',
      adminOnly: false,
    },
    {
      labelKey: 'SIDEBAR.NAV.NOTIFICATIONS',
      descKey: 'DASHBOARD.ACTIONS.NOTIFICATIONS_DESC',
      icon: 'notifications',
      route: '/notifications',
      adminOnly: true,
    },
  ];

  ngOnInit() {
    this.layout.setTitle('Dashboard');
    this.loadData();
  }

  private async loadData() {
    const fetches: Promise<void>[] = [
      firstValueFrom(this.api.listBuckets())
        .then(res => { if (res.data) this.buckets.set(res.data); })
        .catch(() => {}),
    ];

    if (this.userService.isAdmin()) {
      fetches.push(
        firstValueFrom(this.api.listUsers())
          .then(res => { if (res.data) this.userCount.set(res.data.length); })
          .catch(() => {}),
      );
    }

    await Promise.all(fetches);
    this.loading.set(false);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private get dark(): boolean { return this.theme.isDark(); }

  get titleClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  get mutedClass(): string {
    return this.dark ? 'text-slate-400' : 'text-slate-500';
  }

  get sectionLabelClass(): string {
    return `text-xs font-semibold uppercase tracking-wider mb-4 ${this.dark ? 'text-slate-400' : 'text-slate-500'}`;
  }

  get statCardClass(): string {
    return this.dark
      ? 'rounded-xl border border-border-dark bg-surface-dark p-5 shadow-lg'
      : 'rounded-xl border border-border-light bg-white p-5 shadow-sm';
  }

  get thClass(): string {
    return this.dark
      ? 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-800/50'
      : 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50';
  }

  get tdClass(): string {
    return this.dark
      ? 'px-4 py-3 text-sm text-slate-300 border-t border-slate-700/50'
      : 'px-4 py-3 text-sm text-slate-700 border-t border-slate-100';
  }

  get emptyClass(): string {
    return this.dark
      ? 'px-4 py-8 text-center text-sm text-slate-500'
      : 'px-4 py-8 text-center text-sm text-slate-400';
  }
}
