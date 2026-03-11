import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SearchService, SearchResult } from '../../../core/search/search.service';
import { ThemeService } from '../../../core/theme/theme.service';

type ResultGroup = {
  type: SearchResult['type'];
  labelKey: string;
  icon: string;
  items: SearchResult[];
};

const TYPE_META: Record<
  SearchResult['type'],
  { labelKey: string; icon: string }
> = {
  bucket: { labelKey: 'SEARCH.TYPE_BUCKET', icon: 'folder' },
  object: { labelKey: 'SEARCH.TYPE_OBJECT', icon: 'description' },
  user: { labelKey: 'SEARCH.TYPE_USER', icon: 'person' },
  group: { labelKey: 'SEARCH.TYPE_GROUP', icon: 'group' },
  policy: { labelKey: 'SEARCH.TYPE_POLICY', icon: 'policy' },
};

@Component({
  selector: 'app-search-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      (click)="close.emit()"
    ></div>

    <!-- Dialog -->
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      (click)="close.emit()"
    >
      <div
        [class]="dialogClass"
        (click)="$event.stopPropagation()"
      >
        <!-- Search input -->
        <div class="flex items-center gap-3 p-4 border-b" [class]="borderClass">
          <span class="material-symbols-outlined text-[22px]" [class]="iconMutedClass">search</span>
          <input
            #searchInput
            [(ngModel)]="query"
            (keydown.enter)="onSearch()"
            (keydown.escape)="close.emit()"
            [class]="inputClass"
            [placeholder]="'SEARCH.PLACEHOLDER' | translate"
            autofocus
          />
          @if (isLoading()) {
            <span class="material-symbols-outlined text-[20px] animate-spin text-primary">progress_activity</span>
          }
        </div>

        <!-- Results area -->
        <div class="max-h-[60vh] overflow-y-auto">

          @if (!hasStarted()) {
            <div class="p-8 text-center" [class]="mutedTextClass">
              <span class="material-symbols-outlined text-[48px] mb-2 block opacity-30">search</span>
              <p class="text-sm">{{ 'SEARCH.HINT' | translate }}</p>
            </div>
          }

          @if (hasStarted() && !isLoading() && totalResults() === 0) {
            <div class="p-8 text-center" [class]="mutedTextClass">
              <span class="material-symbols-outlined text-[48px] mb-2 block opacity-30">search_off</span>
              <p class="text-sm">{{ 'SEARCH.NO_RESULTS' | translate }}</p>
            </div>
          }

          @for (group of resultGroups(); track group.type) {
            <div class="py-2">
              <!-- Group header -->
              <div class="px-4 py-1.5 flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]" [class]="iconMutedClass">{{ group.icon }}</span>
                <span class="text-xs font-semibold uppercase tracking-wider" [class]="mutedTextClass">
                  {{ group.labelKey | translate }}
                  <span class="ml-1 opacity-60">({{ group.items.length }})</span>
                </span>
              </div>

              <!-- Items -->
              @for (item of group.items; track item.key ?? item.name) {
                <button (click)="navigateTo(item)" [class]="resultItemClass">
                  <span class="material-symbols-outlined text-[18px] flex-shrink-0" [class]="iconMutedClass">{{ group.icon }}</span>
                  <div class="min-w-0 text-left">
                    @if (item.type === 'object') {
                      <p class="text-sm font-medium truncate" [class]="titleClass">{{ item.key }}</p>
                      <p class="text-xs truncate" [class]="mutedTextClass">{{ item.bucket }}</p>
                    } @else {
                      <p class="text-sm font-medium truncate" [class]="titleClass">{{ item.name }}</p>
                    }
                  </div>
                  <span class="material-symbols-outlined text-[16px] ml-auto flex-shrink-0" [class]="iconMutedClass">chevron_right</span>
                </button>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t flex items-center justify-between" [class]="borderClass">
          <span class="text-xs" [class]="mutedTextClass">
            @if (isLoading()) {
              {{ 'SEARCH.SEARCHING' | translate }}
            } @else if (hasStarted()) {
              {{ 'SEARCH.FOUND' | translate: { count: totalResults() } }}
            } @else {
              {{ 'SEARCH.PRESS_ENTER' | translate }}
            }
          </span>

          @if (isLoading()) {
            <button (click)="onCancel()" [class]="cancelBtnClass">
              <span class="material-symbols-outlined text-[16px]">close</span>
              {{ 'SEARCH.CANCEL' | translate }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class SearchDialogComponent implements OnDestroy {
  readonly close = output<void>();

  private searchService = inject(SearchService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  query = '';
  readonly results = signal<SearchResult[]>([]);
  readonly isLoading = signal(false);
  readonly hasStarted = signal(false);

  private currentSearchId: string | null = null;
  private subscription: Subscription | null = null;

  readonly totalResults = computed(() => this.results().length);

  readonly resultGroups = computed<ResultGroup[]>(() => {
    const map = new Map<SearchResult['type'], SearchResult[]>();
    for (const r of this.results()) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    const order: SearchResult['type'][] = [
      'bucket', 'object', 'user', 'group', 'policy',
    ];
    return order
      .filter((t) => map.has(t))
      .map((t) => ({
        type: t,
        ...TYPE_META[t],
        items: map.get(t)!,
      }));
  });

  onSearch(): void {
    const q = this.query.trim();
    if (!q) return;

    this.onCancel();

    this.results.set([]);
    this.isLoading.set(true);
    this.hasStarted.set(true);

    this.searchService.startSearch(q).subscribe({
      next: (searchId) => {
        this.currentSearchId = searchId;
        this.subscription = this.searchService.streamResults(searchId).subscribe({
          next: (result) => this.results.update((prev) => [...prev, result]),
          error: () => this.isLoading.set(false),
          complete: () => {
            this.isLoading.set(false);
            this.currentSearchId = null;
          },
        });
      },
      error: () => this.isLoading.set(false),
    });
  }

  onCancel(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    if (this.currentSearchId) {
      this.searchService.cancelSearch(this.currentSearchId).subscribe();
      this.currentSearchId = null;
    }
    this.isLoading.set(false);
  }

  ngOnDestroy(): void {
    this.onCancel();
  }

  navigateTo(item: SearchResult): void {
    switch (item.type) {
      case 'bucket':
        this.router.navigate(['/buckets', item.name]);
        break;
      case 'object':
        this.router.navigate(['/buckets', item.bucket], {
          queryParams: { key: item.key },
        });
        break;
      case 'user':
        this.router.navigate(['/users']);
        break;
      case 'group':
        this.router.navigate(['/groups']);
        break;
      case 'policy':
        this.router.navigate(['/policies']);
        break;
    }
    this.close.emit();
  }

  private get dark(): boolean {
    return this.themeService.mode() !== 'light';
  }

  get dialogClass(): string {
    const base =
      'w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden';
    return this.dark
      ? `${base} bg-background-dark border-border-dark`
      : `${base} bg-white border-border-light`;
  }

  get borderClass(): string {
    return this.dark ? 'border-border-dark' : 'border-border-light';
  }

  get inputClass(): string {
    const base = 'flex-1 bg-transparent text-sm outline-none';
    return this.dark
      ? `${base} text-slate-200 placeholder-slate-500`
      : `${base} text-slate-800 placeholder-slate-400`;
  }

  get titleClass(): string {
    return this.dark ? 'text-slate-200' : 'text-slate-800';
  }

  get mutedTextClass(): string {
    return this.dark ? 'text-slate-500' : 'text-slate-400';
  }

  get iconMutedClass(): string {
    return this.dark ? 'text-slate-500' : 'text-slate-400';
  }

  get resultItemClass(): string {
    const base =
      'flex items-start gap-3 px-4 py-2.5 cursor-default transition-colors';
    return this.dark
      ? `${base} hover:bg-white/5`
      : `${base} hover:bg-black/5`;
  }

  get cancelBtnClass(): string {
    return 'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors';
  }
}
