import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, title: string, message?: string, duration = 5000): void {
    const id = Math.random().toString(36).slice(2);
    this._toasts.update(list => [...list, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  error(title: string, message?: string): void {
    this.show('error', title, message, 8000);
  }

  warning(title: string, message?: string): void {
    this.show('warning', title, message);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  fromHttpError(err: unknown, fallback = 'An unexpected error occurred'): void {
    let message = fallback;
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body?.error?.message) {
        message = body.error.message;
      } else if (body?.message) {
        message = body.message;
      } else if (err.message) {
        message = err.message;
      }
    }
    this.error('Request failed', message);
  }

  dismiss(id: string): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }
}
