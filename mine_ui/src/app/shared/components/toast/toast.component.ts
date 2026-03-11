import { Component, inject } from '@angular/core';
import { ToastService, Toast } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style="max-width: 360px; width: 100%;">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg border pointer-events-auto transition-all duration-300"
          [class]="containerClass(toast)"
        >
          <span class="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5" [class]="iconClass(toast)">
            {{ iconName(toast) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-snug" [class]="titleClass(toast)">{{ toast.title }}</p>
            @if (toast.message) {
              <p class="text-xs mt-0.5 leading-relaxed opacity-80" [class]="titleClass(toast)">{{ toast.message }}</p>
            }
          </div>
          <button
            (click)="toastService.dismiss(toast.id)"
            class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
            [class]="titleClass(toast)"
          >
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  containerClass(t: Toast): string {
    switch (t.type) {
      case 'success': return 'bg-green-950 border-green-700';
      case 'error':   return 'bg-red-950 border-red-700';
      case 'warning': return 'bg-amber-950 border-amber-700';
      case 'info':    return 'bg-blue-950 border-blue-700';
    }
  }

  iconClass(t: Toast): string {
    switch (t.type) {
      case 'success': return 'text-green-400';
      case 'error':   return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'info':    return 'text-blue-400';
    }
  }

  titleClass(t: Toast): string {
    switch (t.type) {
      case 'success': return 'text-green-100';
      case 'error':   return 'text-red-100';
      case 'warning': return 'text-amber-100';
      case 'info':    return 'text-blue-100';
    }
  }

  iconName(t: Toast): string {
    switch (t.type) {
      case 'success': return 'check_circle';
      case 'error':   return 'error';
      case 'warning': return 'warning';
      case 'info':    return 'info';
    }
  }
}
