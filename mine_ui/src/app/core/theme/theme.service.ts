import { Injectable } from '@angular/core';

type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly storageKey = 'theme';
  private currentTheme: 'light' | 'dark' = 'light';

  init() {
    const savedTheme = localStorage.getItem(this.storageKey) as ThemeMode | null;

    if (savedTheme === 'dark') {
      this.enableDark();
    } else if (savedTheme === 'light') {
      this.disableDark();
    } else {
      this.applySystemPreference();
    }
  }

  setTheme(mode: ThemeMode) {
    if (mode === 'dark') {
      localStorage.setItem(this.storageKey, 'dark');
      this.enableDark();
    }

    if (mode === 'light') {
      localStorage.setItem(this.storageKey, 'light');
      this.disableDark();
    }

    if (mode === 'system') {
      localStorage.removeItem(this.storageKey);
      this.applySystemPreference();
    }
  }

  private enableDark() {
    document.documentElement.setAttribute('data-theme', 'dark');
    this.currentTheme = 'dark';
  }

  private disableDark() {
    document.documentElement.removeAttribute('data-theme');
    this.currentTheme = 'light';
  }

  private applySystemPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    console.log(prefersDark);

    if (prefersDark) {
      this.enableDark();
    } else {
      this.disableDark();
    }
  }

  get theme() {
    return this.currentTheme;
  }

  isDark() {
    return this.currentTheme === 'dark';
  }
}
