import { Routes } from '@angular/router';

import { authGuard, adminGuard } from './core/auth/auth.guard';

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
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/users/users').then(m => m.UsersComponent),
  },
  {
    path: 'groups',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/groups/groups').then(m => m.GroupsComponent),
  },
  {
    path: 'policies',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/policies/policies').then(m => m.PoliciesComponent),
  },
  {
    path: 'notifications',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/notifications/notifications').then(m => m.NotificationsComponent),
  },
  {
    path: 'quotas',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/quotas/quotas').then(m => m.QuotasComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
