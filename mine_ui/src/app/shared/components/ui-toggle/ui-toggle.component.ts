import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'ui-toggle',
  standalone: true,
  template: `
    <label [class]="wrapperClasses">
      <div class="relative inline-flex items-center">
        <input
          type="checkbox"
          class="sr-only peer"
          [checked]="checked"
          [disabled]="disabled"
          (change)="onChange($event)"
        />
        <div [class]="trackClasses"></div>
      </div>
      @if (label) {
        <span [class]="labelClasses">{{ label }}</span>
      }
    </label>
  `,
})
export class UiToggleComponent {
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

  get trackClasses(): string {
    const track = this.theme.isDark() ? 'bg-slate-700' : 'bg-slate-200';
    return [
      'w-11 h-6 rounded-full',
      track,
      'peer-focus:outline-none',
      'peer-checked:bg-primary',
      'relative',
      "after:content-['']",
      'after:absolute',
      'after:top-[2px]',
      'after:start-[2px]',
      'after:bg-white',
      'after:border',
      'after:border-slate-300',
      'after:rounded-full',
      'after:h-5',
      'after:w-5',
      'after:transition-all',
      'peer-checked:after:translate-x-full',
      'peer-checked:after:border-white',
    ].join(' ');
  }

  get labelClasses(): string {
    return this.theme.isDark() ? 'text-sm text-slate-300' : 'text-sm text-slate-700';
  }
}
