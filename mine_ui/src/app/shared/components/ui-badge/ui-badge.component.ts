import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-badge',
  standalone: true,
  template: `
    <span [class]="classes">
      <ng-content />
    </span>
  `,
})
export class UiBadgeComponent {
  private theme = inject(ThemeService);

  @Input() variant: 'info' | 'success' | 'warning' | 'error' = 'info';

  get classes(): string {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';
    const dark = this.theme.isDark();

    switch (this.variant) {
      case 'success':
        return dark
          ? `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
          : `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;

      case 'warning':
        return dark
          ? `${base} bg-amber-500/10 text-amber-400 border-amber-500/20`
          : `${base} bg-amber-50 text-amber-700 border-amber-200`;

      case 'error':
        return dark
          ? `${base} bg-red-500/10 text-red-400 border-red-500/20`
          : `${base} bg-red-50 text-red-700 border-red-200`;

      default: // info
        return dark
          ? `${base} bg-primary/10 text-primary border-primary/20`
          : `${base} bg-blue-50 text-blue-700 border-blue-200`;
    }
  }
}
