import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-input-text',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label) {
        <label [class]="labelClasses">{{ label }}</label>
      }
      <input
        [type]="type"
        [placeholder]="placeholder"
        [value]="value"
        [disabled]="disabled"
        [class]="inputClasses"
        (input)="onInput($event)"
      />
      @if (variant === 'error' && errorMessage) {
        <span [class]="errorClasses">{{ errorMessage }}</span>
      }
    </div>
  `,
})
export class UiInputTextComponent {
  private theme = inject(ThemeService);

  @Input() label = '';
  @Input() placeholder = '';
  @Input() value = '';
  @Input() type = 'text';
  @Input() variant: 'default' | 'error' = 'default';
  @Input() errorMessage = '';
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  get labelClasses(): string {
    const dark = this.theme.isDark();
    if (this.variant === 'error') {
      return dark ? 'text-sm font-medium text-red-500' : 'text-sm font-medium text-red-600';
    }
    return dark ? 'text-sm font-medium text-slate-300' : 'text-sm font-medium text-slate-700';
  }

  get inputClasses(): string {
    const base =
      'w-full rounded px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:border-transparent';
    const dark = this.theme.isDark();

    if (this.variant === 'error') {
      return dark
        ? `${base} bg-red-900/10 border border-red-500 text-red-200`
        : `${base} bg-red-50 border border-red-300 text-red-900`;
    }

    return dark
      ? `${base} bg-background-dark border border-border-dark text-white placeholder:text-slate-500 focus:ring-primary`
      : `${base} bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-primary`;
  }

  get errorClasses(): string {
    return this.theme.isDark() ? 'text-xs text-red-500' : 'text-xs text-red-600';
  }
}
