import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { AuthService } from './core/auth/auth.service';
import { UserService } from './core/auth/user.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopbarComponent } from './shared/components/topbar/topbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private themeService = inject(ThemeService);
  private i18nService = inject(I18nService);
  private auth = inject(AuthService);
  private userService = inject(UserService);

  ngOnInit() {
    this.themeService.init();
    this.i18nService.init();
    if (this.auth.isAuthenticated()) {
      this.userService.loadMe();
    }
  }
}
