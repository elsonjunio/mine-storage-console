import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from '../../../core/theme/theme.service';
import { UserService } from '../../../core/auth/user.service';
import { ConfigService } from '../../../core/api/config.service';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  badge?: number;
  adminOnly?: boolean;
  requiresAgent?: boolean;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <aside class="w-64 flex-shrink-0 flex flex-col border-r z-20 h-full bg-adaptive-sidebar border-adaptive-border">

      <!-- Brand / Logo Area -->
      <div class="h-16 flex items-center px-6 border-b flex-shrink-0 bg-adaptive-sidebar-top border-adaptive-border">
        <a routerLink="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div class="bg-primary/20 p-1.5 rounded-lg text-primary">
            <span class="material-symbols-outlined text-[24px]">dns</span>
          </div>
          <h1 class="text-base font-semibold tracking-tight" [class]="headingClass">Mine Console</h1>
        </a>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-6 px-3 space-y-8">
        @for (group of visibleNavGroups(); track group.labelKey) {
          <div>
            <h3 class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {{ group.labelKey | translate }}
            </h3>
            <div class="space-y-1">
              @for (item of group.items; track item.route) {
                <a
                  #rla="routerLinkActive"
                  [routerLink]="item.route"
                  routerLinkActive
                  [class]="rla.isActive ? activeNavItemClasses : inactiveNavItemClasses"
                >
                  <span class="material-symbols-outlined text-[20px]" [class.filled]="rla.isActive">{{ item.icon }}</span>
                  {{ item.labelKey | translate }}
                  @if (item.badge) {
                    <span class="ml-auto bg-primary/20 text-primary py-0.5 px-2 rounded-full text-xs font-bold">
                      {{ item.badge }}
                    </span>
                  }
                </a>
              }
            </div>
          </div>
        }
      </nav>

      <!-- Sidebar Footer -->
      <div class="p-4 border-t border-adaptive-border flex-shrink-0">
        <div class="flex flex-col">
          <p class="text-xs text-slate-500">v0.1.1</p>
          <p class="text-xs text-slate-500 opacity-60">{{ 'SIDEBAR.FOOTER.BUILD' | translate }}</p>
        </div>
      </div>

    </aside>
  `,
})
export class SidebarComponent {
  private theme = inject(ThemeService);
  private userService = inject(UserService);
  private config = inject(ConfigService);

  private readonly navGroups: NavGroup[] = [
    {
      labelKey: 'SIDEBAR.GROUPS.OPERATIONAL',
      items: [
        { labelKey: 'SIDEBAR.NAV.BUCKETS', icon: 'database', route: '/buckets' },
        { labelKey: 'SIDEBAR.NAV.AI_ASSISTANT', icon: 'smart_toy', route: '/ai-assistant', requiresAgent: true },
      ],
    },
    {
      labelKey: 'SIDEBAR.GROUPS.IAM',
      adminOnly: true,
      items: [
        { labelKey: 'SIDEBAR.NAV.USERS', icon: 'group', route: '/users' },
        { labelKey: 'SIDEBAR.NAV.GROUPS', icon: 'groups', route: '/groups' },
        { labelKey: 'SIDEBAR.NAV.POLICIES', icon: 'description', route: '/policies' },
      ],
    },
    {
      labelKey: 'SIDEBAR.GROUPS.SYSTEM',
      adminOnly: true,
      items: [
        { labelKey: 'SIDEBAR.NAV.NOTIFICATIONS', icon: 'notifications', route: '/notifications' },
        { labelKey: 'SIDEBAR.NAV.QUOTAS', icon: 'pie_chart', route: '/quotas' },
      ],
    },
  ];

  readonly visibleNavGroups = computed(() =>
    this.navGroups
      .filter(g => !g.adminOnly || this.userService.isAdmin())
      .map(g => ({
        ...g,
        items: g.items.filter(
          item => !item.requiresAgent || !!this.config.agentBackendUrl,
        ),
      }))
      .filter(g => g.items.length > 0),
  );

  private get dark(): boolean {
    return this.theme.mode() !== 'light';
  }

  get headingClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  get activeNavItemClasses(): string {
    return 'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary transition-colors';
  }

  get inactiveNavItemClasses(): string {
    return this.dark
      ? 'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors'
      : 'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-black/5 transition-colors';
  }
}
