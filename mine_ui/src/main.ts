import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const savedTheme = localStorage.getItem('theme');

console.log(savedTheme);

if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else if (!savedTheme &&
  window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
