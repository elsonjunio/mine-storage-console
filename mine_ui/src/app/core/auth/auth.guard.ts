import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { UserService } from './user.service';

async function ensureUserLoaded(auth: AuthService, userService: UserService): Promise<boolean> {
  if (!auth.isAuthenticated()) {
    await auth.login();
    return false;
  }
  if (!userService.user()) {
    await userService.loadMe();
  }
  return true;
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const userService = inject(UserService);
  return ensureUserLoaded(auth, userService);
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const userService = inject(UserService);
  const router = inject(Router);

  const loaded = await ensureUserLoaded(auth, userService);
  if (!loaded) return false;

  if (!userService.isAdmin()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
