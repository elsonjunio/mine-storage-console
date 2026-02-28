import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-table',
  standalone: true,
  template: `
    <div [class]="wrapperClasses">
      <table [class]="tableClasses">
        <ng-content />
      </table>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep thead { font-size: 0.75rem; line-height: 1rem; text-transform: uppercase; }
      :host ::ng-deep th { padding: 0.75rem 1.5rem; font-weight: 600; }
      :host ::ng-deep td { padding: 1rem 1.5rem; }
    `,
  ],
})
export class UiTableComponent {
  private theme = inject(ThemeService);

  get wrapperClasses(): string {
    return this.theme.isDark()
      ? 'w-full overflow-hidden rounded-lg border border-border-dark'
      : 'w-full overflow-hidden rounded-lg border border-border-light shadow-sm';
  }

  get tableClasses(): string {
    return this.theme.isDark()
      ? 'w-full text-left text-sm text-slate-400'
      : 'w-full text-left text-sm text-slate-600';
  }
}
