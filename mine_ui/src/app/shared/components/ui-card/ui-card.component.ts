import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-card',
  standalone: true,
  template: `
    <div [class]="cardClasses">

      <!-- Header: icon + badge -->
      <div class="flex justify-between items-start mb-4">
        <div [class]="iconWrapperClasses">
          <ng-content select="[card-icon]" />
        </div>
        <ng-content select="[card-badge]" />
      </div>

      <!-- Title -->
      <h4 [class]="titleClasses">
        <ng-content select="[card-title]" />
      </h4>

      <!-- Description -->
      <p [class]="descriptionClasses">
        <ng-content select="[card-description]" />
      </p>

      <!-- Footer -->
      <div [class]="footerClasses">
        <ng-content select="[card-footer]" />
      </div>

    </div>
  `,
})
export class UiCardComponent {
  private theme = inject(ThemeService);

  @Input() clickable = true;

  get cardClasses(): string {
    const base = 'p-6 rounded-xl border transition-all group';
    const cursor = this.clickable ? 'cursor-pointer' : '';
    return this.theme.isDark()
      ? `${base} ${cursor} bg-surface-dark border-border-dark shadow-lg hover:border-primary/50`
      : `${base} ${cursor} bg-white border-border-light shadow-sm hover:shadow-md hover:border-primary/50`;
  }

  get iconWrapperClasses(): string {
    return this.theme.isDark()
      ? 'w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary'
      : 'w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary';
  }

  get titleClasses(): string {
    return this.theme.isDark()
      ? 'text-base font-bold text-white mb-1 group-hover:text-primary transition-colors'
      : 'text-base font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors';
  }

  get descriptionClasses(): string {
    return this.theme.isDark()
      ? 'text-sm text-slate-400 mb-4'
      : 'text-sm text-slate-500 mb-4';
  }

  get footerClasses(): string {
    return this.theme.isDark()
      ? 'flex items-center gap-4 text-xs text-slate-500 border-t border-border-dark pt-4'
      : 'flex items-center gap-4 text-xs text-slate-500 border-t border-border-light pt-4';
  }
}
