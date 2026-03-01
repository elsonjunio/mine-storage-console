import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/auth/user.service';
import { UiBreadcrumbComponent } from '../../shared/components';
import type { BreadcrumbItem } from '../../shared/components';
import type { BucketResponse } from '../../core/api/api.types';

interface BucketRow extends BucketResponse {
  objects?: number;
  size_bytes?: number;
  versioning?: string;
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-buckets',
  standalone: true,
  imports: [RouterLink, TranslatePipe, UiBreadcrumbComponent],
  template: `
    <div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

      <!-- Breadcrumb -->
      <ui-breadcrumb [items]="breadcrumb" />

      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h1 class="text-3xl font-bold tracking-tight" [class]="titleClass">
            {{ 'BUCKETS.TITLE' | translate }}
          </h1>
          <p class="mt-1 max-w-2xl" [class]="mutedClass">
            {{ 'BUCKETS.DESCRIPTION' | translate }}
          </p>
        </div>
        <div class="flex-shrink-0">
          <button (click)="showCreate.set(true)" [class]="primaryBtnClass">
            <span class="material-symbols-outlined text-[20px]">add</span>
            {{ 'BUCKETS.CREATE_BTN' | translate }}
          </button>
        </div>
      </div>

      <!-- Create Bucket Form -->
      @if (showCreate()) {
        <div [class]="createFormClass">
          <p class="text-sm font-semibold mb-3" [class]="titleClass">{{ 'BUCKETS.CREATE_TITLE' | translate }}</p>
          <div class="flex items-center gap-3">
            <input
              #nameInput
              type="text"
              [placeholder]="'BUCKETS.CREATE_PLACEHOLDER' | translate"
              [value]="newBucketName()"
              (input)="newBucketName.set(nameInput.value)"
              (keydown.enter)="submitCreate()"
              [class]="inputClass"
            />
            <button (click)="submitCreate()" [disabled]="creating() || !newBucketName().trim()" [class]="primaryBtnClass">
              @if (creating()) {
                <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              } @else {
                {{ 'BUCKETS.CREATE_CONFIRM' | translate }}
              }
            </button>
            <button (click)="cancelCreate()" [class]="ghostBtnClass">
              {{ 'BUCKETS.CREATE_CANCEL' | translate }}
            </button>
          </div>
        </div>
      }

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div [class]="statCardClass">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium" [class]="mutedClass">{{ 'BUCKETS.STATS.TOTAL_BUCKETS' | translate }}</h3>
            <span class="p-1.5 bg-primary/10 text-primary rounded-md">
              <span class="material-symbols-outlined text-[20px]">database</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold" [class]="titleClass">
              {{ loading() ? '—' : buckets().length }}
            </span>
          </div>
        </div>

        <div [class]="statCardClass">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium" [class]="mutedClass">{{ 'BUCKETS.STATS.TOTAL_OBJECTS' | translate }}</h3>
            <span class="p-1.5 bg-purple-500/10 text-purple-400 rounded-md">
              <span class="material-symbols-outlined text-[20px]">data_object</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold" [class]="titleClass">
              {{ loading() ? '—' : (userService.isAdmin() ? formatNumber(totalObjects()) : 'N/A') }}
            </span>
            @if (!loading() && userService.isAdmin()) {
              <span class="text-xs" [class]="mutedClass">{{ 'BUCKETS.STATS.OBJECTS_LABEL' | translate }}</span>
            }
          </div>
        </div>

        <div [class]="statCardClass">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium" [class]="mutedClass">{{ 'BUCKETS.STATS.TOTAL_SIZE' | translate }}</h3>
            <span class="p-1.5 bg-amber-500/10 text-amber-400 rounded-md">
              <span class="material-symbols-outlined text-[20px]">hard_drive</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold" [class]="titleClass">
              {{ loading() ? '—' : (userService.isAdmin() ? formatSize(totalSize()) : 'N/A') }}
            </span>
          </div>
        </div>

      </div>

      <!-- Filter Toolbar -->
      <div [class]="toolbarClass">
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="relative w-full sm:w-64">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3" [class]="mutedClass">
              <span class="material-symbols-outlined text-[18px]">filter_list</span>
            </span>
            <input
              #filterInput
              type="text"
              [placeholder]="'BUCKETS.FILTER_PLACEHOLDER' | translate"
              (input)="filterText.set(filterInput.value)"
              [class]="filterInputClass"
            />
          </div>
        </div>
      </div>

      <!-- Data Table -->
      <div [class]="tableWrapClass">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr [class]="theadRowClass">
                <th [class]="thClass">{{ 'BUCKETS.TABLE.NAME' | translate }}</th>
                <th [class]="thClass">{{ 'BUCKETS.TABLE.CREATED' | translate }}</th>
                @if (userService.isAdmin()) {
                  <th [class]="thClass">{{ 'BUCKETS.TABLE.OBJECTS' | translate }}</th>
                  <th [class]="thClass">{{ 'BUCKETS.TABLE.SIZE' | translate }}</th>
                }
                <th [class]="thClass">{{ 'BUCKETS.TABLE.VERSIONING' | translate }}</th>
                <th [class]="thClass + ' text-right'">{{ 'BUCKETS.TABLE.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y" [class]="dividerClass">

              @if (loading()) {
                @for (i of skeletonRows; track i) {
                  <tr>
                    <td [class]="tdClass" colspan="5">
                      <div class="h-4 rounded animate-pulse w-48" [class]="skeletonClass"></div>
                    </td>
                  </tr>
                }
              }

              @for (bucket of pagedBuckets(); track bucket.name) {
                <tr [class]="trClass">
                  <td [class]="tdClass">
                    <a [routerLink]="['/buckets', bucket.name]" class="flex items-center gap-3 hover:text-primary transition-colors group/name">
                      <span class="p-2 rounded text-primary" [class]="iconBgClass">
                        <span class="material-symbols-outlined text-[18px]">database</span>
                      </span>
                      <span class="font-medium group-hover/name:underline" [class]="titleClass">{{ bucket.name }}</span>
                    </a>
                  </td>
                  <td [class]="tdClass + ' ' + mutedClass">{{ formatDate(bucket.creation_date) }}</td>
                  @if (userService.isAdmin()) {
                    <td [class]="tdClass">
                      @if (bucket.objects !== undefined) {
                        <span [class]="subtleClass">{{ formatNumber(bucket.objects) }}</span>
                      } @else {
                        <span [class]="mutedClass">—</span>
                      }
                    </td>
                    <td [class]="tdClass">
                      @if (bucket.size_bytes !== undefined) {
                        <span [class]="subtleClass">{{ formatSize(bucket.size_bytes) }}</span>
                      } @else {
                        <span [class]="mutedClass">—</span>
                      }
                    </td>
                  }
                  <td [class]="tdClass">
                    @if (bucket.versioning === undefined) {
                      <div class="h-5 w-20 rounded animate-pulse" [class]="skeletonClass"></div>
                    } @else if (bucket.versioning === 'enabled') {
                      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <span class="material-symbols-outlined text-[13px]">check_circle</span>
                        {{ 'BUCKETS.VERSIONING.ENABLED' | translate }}
                      </span>
                    } @else if (bucket.versioning === 'suspended') {
                      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span class="material-symbols-outlined text-[13px]">pause_circle</span>
                        {{ 'BUCKETS.VERSIONING.SUSPENDED' | translate }}
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        <span class="material-symbols-outlined text-[13px]">remove_circle</span>
                        {{ 'BUCKETS.VERSIONING.DISABLED' | translate }}
                      </span>
                    }
                  </td>
                  <td [class]="tdClass + ' text-right'">
                    <button (click)="confirmDelete(bucket.name)" [class]="deleteBtnClass" [title]="'BUCKETS.DELETE_TITLE' | translate">
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </td>
                </tr>
              }

              @if (!loading() && !pagedBuckets().length) {
                <tr>
                  <td [attr.colspan]="userService.isAdmin() ? 6 : 4" [class]="emptyClass">
                    {{ filterText() ? ('BUCKETS.TABLE.NO_RESULTS' | translate) : ('BUCKETS.TABLE.EMPTY' | translate) }}
                  </td>
                </tr>
              }

            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div [class]="paginationClass">
            <p class="text-xs" [class]="mutedClass">
              {{ 'BUCKETS.TABLE.SHOWING' | translate: { from: pageFrom(), to: pageTo(), total: filteredBuckets().length } }}
            </p>
            <div class="flex gap-2">
              <button
                (click)="prevPage()"
                [disabled]="currentPage() === 0"
                [class]="pageBtnClass"
              >
                {{ 'BUCKETS.TABLE.PREVIOUS' | translate }}
              </button>
              <button
                (click)="nextPage()"
                [disabled]="currentPage() >= totalPages() - 1"
                [class]="pageBtnClass"
              >
                {{ 'BUCKETS.TABLE.NEXT' | translate }}
              </button>
            </div>
          </div>
        }
      </div>

    </div>

    <!-- Delete Confirmation Dialog -->
    @if (deleteTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div [class]="dialogClass">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-red-400 text-[20px]">warning</span>
            </div>
            <div>
              <h3 class="text-base font-semibold mb-1" [class]="titleClass">{{ 'BUCKETS.DELETE_DIALOG.TITLE' | translate }}</h3>
              <p class="text-sm" [class]="mutedClass">
                {{ 'BUCKETS.DELETE_DIALOG.MESSAGE' | translate: { name: deleteTarget() } }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="deleteTarget.set(null)" [class]="ghostBtnClass">
              {{ 'BUCKETS.DELETE_DIALOG.CANCEL' | translate }}
            </button>
            <button (click)="executeDelete()" [disabled]="deleting()" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50">
              @if (deleting()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'BUCKETS.DELETE_DIALOG.CONFIRM' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BucketsComponent implements OnInit {
  private api = inject(ApiService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  readonly userService = inject(UserService);

  readonly buckets = signal<BucketRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly currentPage = signal(0);
  readonly showCreate = signal(false);
  readonly newBucketName = signal('');
  readonly creating = signal(false);
  readonly deleteTarget = signal<string | null>(null);
  readonly deleting = signal(false);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Operational' },
    { label: 'Buckets' },
  ];

  readonly filteredBuckets = computed(() => {
    const q = this.filterText().toLowerCase();
    return q ? this.buckets().filter(b => b.name.toLowerCase().includes(q)) : this.buckets();
  });

  readonly pagedBuckets = computed(() => {
    const p = this.currentPage();
    return this.filteredBuckets().slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  });

  readonly totalPages = computed(() => Math.ceil(this.filteredBuckets().length / PAGE_SIZE));
  readonly pageFrom = computed(() => this.currentPage() * PAGE_SIZE + 1);
  readonly pageTo = computed(() => Math.min((this.currentPage() + 1) * PAGE_SIZE, this.filteredBuckets().length));

  readonly totalObjects = computed(() => this.buckets().reduce((s, b) => s + (b.objects ?? 0), 0));
  readonly totalSize = computed(() => this.buckets().reduce((s, b) => s + (b.size_bytes ?? 0), 0));

  ngOnInit() {
    this.layout.setTitle('Buckets');
    this.load();
  }

  private async load() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.listBuckets());
      if (res.data) {
        this.buckets.set(res.data);
        this.loadVersioning(res.data);
        if (this.userService.isAdmin()) {
          this.loadUsage(res.data);
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  private loadUsage(rows: BucketRow[]) {
    rows.forEach(bucket => {
      firstValueFrom(this.api.getBucketUsage(bucket.name))
        .then(res => {
          if (res.data) {
            this.buckets.update(list =>
              list.map(b => b.name === bucket.name
                ? { ...b, objects: res.data!.objects, size_bytes: res.data!.size_bytes }
                : b,
              ),
            );
          }
        })
        .catch(() => {});
    });
  }

  private loadVersioning(rows: BucketRow[]) {
    rows.forEach(bucket => {
      firstValueFrom(this.api.getBucketVersioning(bucket.name))
        .then(res => {
          const status = res.data?.versioning ?? 'disabled';
          this.buckets.update(list =>
            list.map(b => b.name === bucket.name ? { ...b, versioning: status } : b),
          );
        })
        .catch(() => {
          this.buckets.update(list =>
            list.map(b => b.name === bucket.name ? { ...b, versioning: 'unknown' } : b),
          );
        });
    });
  }

  async submitCreate() {
    const name = this.newBucketName().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    try {
      await firstValueFrom(this.api.createBucket(name));
      this.cancelCreate();
      await this.load();
    } finally {
      this.creating.set(false);
    }
  }

  cancelCreate() {
    this.showCreate.set(false);
    this.newBucketName.set('');
  }

  confirmDelete(name: string) {
    this.deleteTarget.set(name);
  }

  async executeDelete() {
    const name = this.deleteTarget();
    if (!name || this.deleting()) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.api.deleteBucket(name));
      this.deleteTarget.set(null);
      await this.load();
    } finally {
      this.deleting.set(false);
    }
  }

  prevPage() { this.currentPage.update(p => Math.max(0, p - 1)); }
  nextPage() { this.currentPage.update(p => Math.min(this.totalPages() - 1, p + 1)); }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  formatNumber(n: number): string {
    return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
      : String(n);
  }

  // ── Theme helpers ──────────────────────────────────────────────────────────

  private get dark() { return this.theme.isDark(); }

  get titleClass() { return this.dark ? 'text-white' : 'text-slate-900'; }
  get mutedClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }
  get subtleClass() { return this.dark ? 'text-slate-200' : 'text-slate-700'; }

  get statCardClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark rounded-xl p-5 shadow-sm'
      : 'bg-white border border-border-light rounded-xl p-5 shadow-sm';
  }

  get toolbarClass() {
    return this.dark
      ? 'flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-dark/50 p-2 rounded-lg border border-border-dark/50'
      : 'flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/50 p-2 rounded-lg border border-border-light';
  }

  get tableWrapClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-sm'
      : 'bg-white border border-border-light rounded-xl overflow-hidden shadow-sm';
  }

  get theadRowClass() {
    return this.dark ? 'border-b border-border-dark bg-slate-800/30' : 'border-b border-border-light bg-slate-50';
  }

  get dividerClass() { return this.dark ? 'divide-border-dark' : 'divide-border-light'; }

  get thClass() {
    return this.dark
      ? 'p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider'
      : 'p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider';
  }

  get trClass() {
    return this.dark
      ? 'group hover:bg-slate-800/30 transition-colors'
      : 'group hover:bg-slate-50 transition-colors';
  }

  get tdClass() { return 'p-4 text-sm'; }
  get iconBgClass() { return this.dark ? 'bg-slate-800' : 'bg-blue-50'; }

  get skeletonClass() { return this.dark ? 'bg-slate-700' : 'bg-slate-200'; }

  get emptyClass() {
    return this.dark
      ? 'p-8 text-center text-sm text-slate-500'
      : 'p-8 text-center text-sm text-slate-400';
  }

  get paginationClass() {
    return this.dark
      ? 'border-t border-border-dark px-4 py-3 flex items-center justify-between bg-slate-800/20'
      : 'border-t border-border-light px-4 py-3 flex items-center justify-between';
  }

  get pageBtnClass() {
    return this.dark
      ? 'px-3 py-1 text-xs font-medium rounded border border-border-dark text-slate-400 bg-transparent hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
      : 'px-3 py-1 text-xs font-medium rounded border border-border-light text-slate-500 bg-transparent hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  }

  get primaryBtnClass() {
    return 'flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm';
  }

  get ghostBtnClass() {
    return this.dark
      ? 'px-4 py-2 rounded-lg text-sm font-medium border border-border-dark text-slate-300 hover:bg-white/5 transition-colors'
      : 'px-4 py-2 rounded-lg text-sm font-medium border border-border-light text-slate-600 hover:bg-black/5 transition-colors';
  }

  get deleteBtnClass() {
    return this.dark
      ? 'text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/10'
      : 'text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50';
  }

  get createFormClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark rounded-xl p-5'
      : 'bg-white border border-border-light rounded-xl p-5';
  }

  get inputClass() {
    return this.dark
      ? 'flex-1 bg-background-dark border border-border-dark text-slate-200 text-sm rounded-lg focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 placeholder-slate-600 outline-none'
      : 'flex-1 bg-white border border-border-light text-slate-700 text-sm rounded-lg focus:ring-1 focus:ring-primary focus:border-primary px-3 py-2 placeholder-slate-400 outline-none';
  }

  get filterInputClass() {
    return this.dark
      ? 'w-full bg-background-dark border border-border-dark text-slate-200 text-sm rounded-md focus:ring-1 focus:ring-primary focus:border-primary pl-10 p-2 placeholder-slate-600 outline-none'
      : 'w-full bg-white border border-border-light text-slate-700 text-sm rounded-md focus:ring-1 focus:ring-primary focus:border-primary pl-10 p-2 placeholder-slate-400 outline-none';
  }

  get dialogClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark rounded-xl p-6 w-full max-w-md shadow-2xl'
      : 'bg-white border border-border-light rounded-xl p-6 w-full max-w-md shadow-2xl';
  }
}
