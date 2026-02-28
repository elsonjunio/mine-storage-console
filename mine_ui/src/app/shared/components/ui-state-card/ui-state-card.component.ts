import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ThemeService } from "../../../core/theme/theme.service";

@Component({
  selector: 'ui-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `

    <div class="rounded-lg px-6 py-8 ring shadow-xl ring-gray-900/5 mx-auto max-w-md overflow-hidden rounded-xl bg-white shadow-md md:max-w-2xl"
    [ngClass]="computedClasses">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-gray-500">
          <ng-content select="[card-title]" />
        </div>

        <div class="w-8 h-8">
          <ng-content select="[card-icon]" />
        </div>
      </div>

      <!-- Main value -->
      <div class="flex items-center space-x-2">
        <div class="text-2xl font-semibold"
        [ngClass]="computedFontClasses">
          <ng-content select="[card-value]" />
        </div>

        <div class="text-sm">
          <ng-content select="[card-trend]" />
        </div>
      </div>

      <!-- Footer -->
      <div>
        <ng-content select="[card-footer]" />
      </div>

    </div>
  `
})
export class UiStatCardComponent {

  private theme = inject(ThemeService);

  get computedClasses() {

    const isDark = this.theme.isDark();

    return isDark
        ? 'dark:bg-ui-card-1-dark border border-ui-b-card-dark'
        : '';
  }

  get computedFontClasses() {

    const isDark = this.theme.isDark();

    return isDark
        ? ' text-gray-100'
        : ' text-gray-800';
  }

}
