import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  label: string;
  flag: string;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private translate = inject(TranslateService);

  readonly currentLang = signal<string>('en');

  readonly availableLangs: Language[] = [
    { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ];

  init() {
    const saved = localStorage.getItem('lang') ?? 'en';
    this.setLang(saved);
  }

  setLang(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('lang', code);
  }
}
