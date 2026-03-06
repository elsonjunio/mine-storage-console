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
    path: 'buckets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/buckets/buckets').then(m => m.BucketsComponent),
  },
  {
    path: 'buckets/:name',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bucket-detail/bucket-detail').then(m => m.BucketDetailComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/users').then(m => m.UsersComponent),
  },
  {
    path: 'groups',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/groups/groups').then(m => m.GroupsComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
