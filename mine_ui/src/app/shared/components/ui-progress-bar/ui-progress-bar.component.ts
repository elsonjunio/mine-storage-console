import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-progress-bar',
  standalone: true,
  template: `
    <div [class]="trackClasses" role="progressbar" [attr.aria-valuenow]="clamped" aria-valuemin="0" aria-valuemax="100">
      <div class="bg-primary h-full rounded-full transition-all duration-300" [style.width.%]="clamped"></div>
    </div>
  `,
})
export class UiProgressBarComponent {
  private theme = inject(ThemeService);

  @Input() value = 0;

  get clamped(): number {
    return Math.min(100, Math.max(0, this.value));
  }

  get trackClasses(): string {
    return this.theme.isDark()
      ? 'w-full bg-slate-700 rounded-full h-2.5 overflow-hidden'
      : 'w-full bg-slate-200 rounded-full h-2.5 overflow-hidden';
  }
}
