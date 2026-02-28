import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'demo',
    loadComponent: () =>
      import('./features/demo/demo')
        .then(m => m.Demo)
  }
];
