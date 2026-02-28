import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'ui-select',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label) {
        <label [class]="labelClasses">{{ label }}</label>
      }
      <div class="relative">
        <select
          [value]="value"
          [disabled]="disabled"
          [class]="selectClasses"
          (change)="onChange($event)">
          @for (opt of options; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
        <span
          class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xl leading-none">
          expand_more
        </span>
      </div>
    </div>
  `,
})
export class UiSelectComponent {
  private theme = inject(ThemeService);

  @Input() label = '';
  @Input() options: SelectOption[] = [];
  @Input() value = '';
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();

  onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }

  get labelClasses(): string {
    return this.theme.isDark()
      ? 'text-sm font-medium text-slate-300'
      : 'text-sm font-medium text-slate-700';
  }

  get selectClasses(): string {
    const base =
      'w-full appearance-none rounded px-3 py-2 pr-10 text-sm outline-none transition-all focus:ring-2 focus:border-transparent cursor-pointer';
    return this.theme.isDark()
      ? `${base} bg-background-dark border border-border-dark text-white focus:ring-primary`
      : `${base} bg-slate-50 border border-slate-300 text-slate-900 focus:ring-primary`;
  }
}
