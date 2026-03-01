import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth-callback/auth-callback').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'demo',
    loadComponent: () =>
      import('./features/demo/demo').then(m => m.Demo),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
