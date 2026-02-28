import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-button',
  standalone: true,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="classes">
      @if (loading) {
        <span class="material-symbols-outlined animate-spin text-base leading-none">
          progress_activity
        </span>
      }
      <ng-content />
    </button>
  `,
})
export class UiButtonComponent {
  private theme = inject(ThemeService);

  @Input() variant: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' = 'primary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() loading = false;
  @Input() disabled = false;

  get classes(): string {
    const base =
      'inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors cursor-pointer';
    const dark = this.theme.isDark();

    if (this.loading || this.disabled) {
      return `${base} bg-primary/50 text-white/50 cursor-not-allowed`;
    }

    switch (this.variant) {
      case 'secondary':
        return dark
          ? `${base} bg-surface-dark border border-border-dark hover:bg-border-dark text-white`
          : `${base} bg-white border border-border-light hover:bg-slate-50 text-slate-700 shadow-sm`;

      case 'destructive':
        return dark
          ? `${base} bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20`
          : `${base} bg-red-50 text-red-600 border border-red-200 hover:bg-red-100`;

      case 'outline':
        return dark
          ? `${base} border border-primary text-primary hover:bg-primary/10`
          : `${base} border border-primary text-primary hover:bg-primary/5`;

      case 'ghost':
        return dark
          ? `${base} text-slate-400 hover:text-white hover:bg-white/5`
          : `${base} text-slate-500 hover:text-slate-900 hover:bg-slate-100`;

      default: // primary
        return dark
          ? `${base} bg-primary hover:bg-primary-dark text-white`
          : `${base} bg-primary hover:bg-primary-dark text-white shadow-sm`;
    }
  }
}
