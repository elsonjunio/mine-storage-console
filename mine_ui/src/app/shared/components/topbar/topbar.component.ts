import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LayoutService } from '../../../core/layout/layout.service';
import { ThemeService, ThemeMode } from '../../../core/theme/theme.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../../../core/auth/user.service';
import { SearchDialogComponent } from '../search-dialog/search-dialog.component';

interface ThemeOption {
  mode: ThemeMode;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [TranslatePipe, RouterLink, SearchDialogComponent],
  template: `
    @if (isSearchOpen()) {
      <app-search-dialog (close)="isSearchOpen.set(false)" />
    }

    <header class="h-16 border-b flex items-center justify-between px-6 z-10 flex-shrink-0 bg-adaptive-surface border-adaptive-border">

      <!-- Left: Page Title -->
      <div class="flex items-center">
        <h2 class="text-lg font-medium tracking-tight" [class]="titleClass">{{ layout.pageTitle() }}</h2>
      </div>

      <!-- Right: Controls -->
      <div class="flex items-center gap-4 flex-shrink-0">

        <!-- Search -->
        <button
          (click)="isSearchOpen.set(true)"
          class="relative hidden md:flex items-center w-64 cursor-text"
          [class]="searchInputClass"
        >
          <span class="absolute inset-y-0 left-0 flex items-center pl-3" [class]="iconMutedClass">
            <span class="material-symbols-outlined text-[20px]">search</span>
          </span>
          <span class="pl-10 pr-14 text-sm" [class]="iconMutedClass">{{ 'TOPBAR.SEARCH_PLACEHOLDER' | translate }}</span>
          <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <span [class]="kbdClass">⌘K</span>
          </div>
        </button>

        <div class="h-6 w-px bg-adaptive-border mx-2"></div>

        <!-- Profile + Dropdown -->
        <div class="relative">
          <button
            (click)="isMenuOpen.set(!isMenuOpen())"
            [class]="profileButtonClass"
          >
            <div class="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-medium text-xs">
              {{ userService.initials() }}
            </div>
            <span class="text-sm font-medium hidden md:block whitespace-nowrap" [class]="usernameClass">{{ userService.displayName() }}</span>
            <span class="material-symbols-outlined text-[16px] transition-transform"
              [class]="iconMutedClass"
              [class.rotate-180]="isMenuOpen()">
              expand_more
            </span>
          </button>

          <!-- Dropdown Menu -->
          @if (isMenuOpen()) {
            <!-- Backdrop -->
            <div class="fixed inset-0 z-10" (click)="isMenuOpen.set(false)"></div>

            <!-- Panel -->
            <div class="absolute right-0 top-full mt-2 w-60 rounded-xl border shadow-xl z-20 overflow-hidden bg-adaptive-surface border-adaptive-border">

              <!-- User Info -->
              <div class="px-4 py-3 border-b border-adaptive-border">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-semibold" [class]="titleClass">{{ userService.displayName() }}</p>
                  @if (userService.isAdmin()) {
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {{ 'TOPBAR.USER_MENU.ROLE_ADMIN' | translate }}
                    </span>
                  } @else {
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-500">
                      {{ 'TOPBAR.USER_MENU.ROLE_USER' | translate }}
                    </span>
                  }
                </div>
                <p class="text-xs text-slate-500 mt-0.5">{{ userService.email() }}</p>
              </div>

              <!-- Theme Switcher -->
              <div class="px-4 pt-3 pb-2">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {{ 'TOPBAR.USER_MENU.THEME' | translate }}
                </p>
                <div class="flex rounded-lg overflow-hidden border border-adaptive-border">
                  @for (option of themeOptions; track option.mode) {
                    <button
                      (click)="selectTheme(option.mode)"
                      [class]="themeOptionClasses(option.mode)"
                      [title]="option.labelKey | translate"
                    >
                      <span class="material-symbols-outlined text-[18px]">{{ option.icon }}</span>
                      <span class="text-xs">{{ option.labelKey | translate }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Language Selector -->
              <div class="px-4 pt-2 pb-3 border-t border-adaptive-border mt-1">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {{ 'TOPBAR.USER_MENU.LANGUAGE' | translate }}
                </p>
                <div class="space-y-0.5">
                  @for (lang of i18n.availableLangs; track lang.code) {
                    <button
                      (click)="selectLang(lang.code)"
                      [class]="langOptionClasses(lang.code)"
                    >
                      <span class="text-base leading-none">{{ lang.flag }}</span>
                      <span class="text-sm">{{ lang.label }}</span>
                      @if (i18n.currentLang() === lang.code) {
                        <span class="ml-auto material-symbols-outlined text-[16px] text-primary">check</span>
                      }
                    </button>
                  }
                </div>
              </div>

              <!-- Account -->
              <div class="p-2 border-t border-adaptive-border">
                <a
                  [href]="changePasswordUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  (click)="isMenuOpen.set(false)"
                  [class]="adminLinkClass"
                >
                  <span class="material-symbols-outlined text-[18px]">lock_reset</span>
                  {{ 'TOPBAR.USER_MENU.CHANGE_PASSWORD' | translate }}
                </a>
              </div>

              <!-- Admin links -->
              @if (userService.isAdmin()) {
                <div class="p-2 border-t border-adaptive-border">
                  <a
                    routerLink="/users"
                    (click)="isMenuOpen.set(false)"
                    [class]="adminLinkClass"
                  >
                    <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
                    {{ 'TOPBAR.USER_MENU.MANAGE_USERS' | translate }}
                  </a>
                </div>
              }

              <!-- Logout -->
              <div class="p-2 border-t border-adaptive-border">
                <button
                  (click)="logout()"
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">logout</span>
                  {{ 'TOPBAR.USER_MENU.LOGOUT' | translate }}
                </button>
              </div>

            </div>
          }
        </div>

      </div>
    </header>
  `,
})
export class TopbarComponent {
  readonly layout = inject(LayoutService);
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly userService = inject(UserService);
  private auth = inject(AuthService);
  readonly isMenuOpen = signal(false);
  readonly isSearchOpen = signal(false);

  logout() {
    this.auth.logout();
  }

  get changePasswordUrl(): string {
    return this.auth.getChangePasswordUrl();
  }

  readonly themeOptions: ThemeOption[] = [
    { mode: 'light', labelKey: 'TOPBAR.USER_MENU.THEME_LIGHT', icon: 'light_mode' },
    { mode: 'system', labelKey: 'TOPBAR.USER_MENU.THEME_SYSTEM', icon: 'desktop_windows' },
    { mode: 'dark', labelKey: 'TOPBAR.USER_MENU.THEME_DARK', icon: 'dark_mode' },
  ];

  selectTheme(mode: ThemeMode) {
    this.themeService.setTheme(mode);
  }

  selectLang(code: string) {
    this.i18n.setLang(code);
  }

  private get dark(): boolean {
    return this.themeService.mode() !== 'light';
  }

  get titleClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  get usernameClass(): string {
    return this.dark ? 'text-slate-300' : 'text-slate-700';
  }

  get iconMutedClass(): string {
    return this.dark ? 'text-slate-500' : 'text-slate-400';
  }

  get iconButtonClass(): string {
    return this.dark
      ? 'relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5'
      : 'relative p-2 text-slate-500 hover:text-slate-900 transition-colors rounded-lg hover:bg-black/5';
  }

  get profileButtonClass(): string {
    const open = this.isMenuOpen();
    const base = 'flex items-center gap-2 p-1 pr-3 rounded-full border transition-all flex-shrink-0';
    return this.dark
      ? `${base} hover:bg-white/5 border-transparent hover:border-border-dark ${open ? 'bg-white/5 border-border-dark' : ''}`
      : `${base} hover:bg-black/5 border-transparent hover:border-border-light ${open ? 'bg-black/5 border-border-light' : ''}`;
  }

  get searchInputClass(): string {
    return this.dark
      ? 'w-full bg-background-dark border border-border-dark rounded-lg hover:border-primary/50 transition-colors text-left py-2 outline-none'
      : 'w-full bg-white border border-border-light rounded-lg hover:border-primary/50 transition-colors text-left py-2 outline-none';
  }

  get kbdClass(): string {
    return this.dark
      ? 'text-xs text-slate-600 border border-slate-700 rounded px-1.5 py-0.5'
      : 'text-xs text-slate-400 border border-slate-300 rounded px-1.5 py-0.5';
  }

  themeOptionClasses(mode: ThemeMode): string {
    const active = this.themeService.mode() === mode;
    const base = 'flex-1 flex flex-col items-center gap-1 py-2 transition-colors';
    if (active) return `${base} bg-primary/15 text-primary`;
    return this.dark
      ? `${base} text-slate-500 hover:text-slate-200 hover:bg-white/5`
      : `${base} text-slate-500 hover:text-slate-700 hover:bg-black/5`;
  }

  get adminLinkClass(): string {
    const base = 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors';
    return this.dark
      ? `${base} text-slate-300 hover:bg-white/5`
      : `${base} text-slate-700 hover:bg-black/5`;
  }

  langOptionClasses(code: string): string {
    const active = this.i18n.currentLang() === code;
    const base = 'w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors text-left';
    if (active) return `${base} bg-primary/10`;
    return this.dark
      ? `${base} hover:bg-white/5`
      : `${base} hover:bg-black/5`;
  }
}
