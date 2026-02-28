import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-checkbox',
  standalone: true,
  template: `
    <label [class]="wrapperClasses">
      <input
        type="checkbox"
        [checked]="checked"
        [disabled]="disabled"
        [class]="checkboxClasses"
        (change)="onChange($event)"
      />
      @if (label) {
        <span [class]="labelClasses">{{ label }}</span>
      }
    </label>
  `,
})
export class UiCheckboxComponent {
  private theme = inject(ThemeService);

  @Input() label = '';
  @Input() checked = false;
  @Input() disabled = false;

  @Output() checkedChange = new EventEmitter<boolean>();

  onChange(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }

  get wrapperClasses(): string {
    return this.disabled
      ? 'inline-flex items-center gap-2 cursor-not-allowed opacity-50'
      : 'inline-flex items-center gap-2 cursor-pointer';
  }

  get checkboxClasses(): string {
    return this.theme.isDark()
      ? 'w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-background-dark cursor-pointer'
      : 'w-4 h-4 rounded border-slate-300 bg-white text-primary focus:ring-primary cursor-pointer';
  }

  get labelClasses(): string {
    return this.theme.isDark() ? 'text-sm text-slate-300' : 'text-sm text-slate-700';
  }
}
