import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly pageTitle = signal('Dashboard');

  setTitle(title: string) {
    this.pageTitle.set(title);
  }
}
