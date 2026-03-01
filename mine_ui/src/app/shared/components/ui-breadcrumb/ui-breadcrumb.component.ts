import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

@Component({
  selector: 'ui-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav aria-label="Breadcrumb" class="flex text-sm text-slate-500">
      <ol class="inline-flex items-center space-x-1 md:space-x-2">
        @for (item of items; track item.label; let last = $last; let first = $first) {
          <li
            [attr.aria-current]="last ? 'page' : null"
            [class]="first ? 'inline-flex items-center' : 'flex items-center'"
          >
            @if (!first) {
              <span class="material-symbols-outlined text-[16px] mr-1 text-slate-600">chevron_right</span>
            }

            @if (!last && item.href) {
              <a [routerLink]="item.href" class="hover:text-primary transition-colors">{{ item.label }}</a>
            } @else if (!last) {
              <span>{{ item.label }}</span>
            } @else {
              <span class="text-slate-200 font-medium">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class UiBreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
