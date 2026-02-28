//import { Component, signal } from '@angular/core';
//import { RouterOutlet } from '@angular/router';
//
//@Component({
//  selector: 'app-root',
//  imports: [RouterOutlet],
//  templateUrl: './app.html',
//  styleUrl: './app.scss'
//})
//export class App {
//  protected readonly title = signal('mine_ui');
//}

import { Component, inject, OnInit } from '@angular/core';
import { ThemeService } from './core/theme/theme.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  private themeService = inject(ThemeService);

setDark() {
  console.log('dark')
  this.themeService.setTheme('dark');
}

setLight() {
  console.log('light')
  this.themeService.setTheme('light');
}

setSystem() {
  console.log('lisystemght')
  this.themeService.setTheme('system');
}

  ngOnInit() {
    this.themeService.init();
  }
}
