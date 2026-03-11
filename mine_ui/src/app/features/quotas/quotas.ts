import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import type { QuotaBucketRow } from '../../core/api/api.types';

const ALERT_THRESHOLD = 80;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function parseToBytes(value: number, unit: string): number {
  const k = 1024;
  const map: Record<string, number> = { GB: k ** 3, TB: k ** 4, PB: k ** 5 };
  return Math.round(value * (map[unit] ?? k ** 3));
}

@Component({
  selector: 'app-quotas',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col h-full overflow-auto" [class]="pageBg">
      <div class="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 mb-6 text-sm">
          <span class="font-medium" [class]="mutedColor">{{ 'QUOTAS.BREADCRUMB_SYSTEM' | translate }}</span>
          <span class="material-symbols-outlined text-base" [class]="mutedColor">chevron_right</span>
          <span class="font-semibold" [class]="titleColor">{{ 'QUOTAS.BREADCRUMB' | translate }}</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-2" [class]="titleColor">
              {{ 'QUOTAS.TITLE' | translate }}
            </h1>
            <p class="max-w-2xl text-sm" [class]="mutedColor">{{ 'QUOTAS.DESCRIPTION' | translate }}</p>
          </div>
          <button
            (click)="openGlobalModal()"
            class="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg hover:bg-[#0f4bc4] transition text-sm font-semibold shadow-lg shadow-[#135bec]/20 shrink-0"
          >
            <span class="material-symbols-outlined text-[20px]">settings</span>
            {{ 'QUOTAS.GLOBAL_BTN' | translate }}
          </button>
        </div>

        <!-- Metric Cards -->
        @if (loading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            @for (i of [1,2,3,4]; track i) {
              <div class="rounded-xl p-5 border animate-pulse" [class]="cardBg + ' ' + border">
                <div class="h-4 rounded w-1/2 mb-3" [class]="skeletonClass"></div>
                <div class="h-7 rounded w-3/4 mb-4" [class]="skeletonClass"></div>
                <div class="h-2 rounded w-full" [class]="skeletonClass"></div>
              </div>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

            <!-- Total Used -->
            <div class="rounded-xl p-5 border shadow-sm flex flex-col justify-between" [class]="cardBg + ' ' + border">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <span class="text-sm font-medium" [class]="mutedColor">{{ 'QUOTAS.CARD_USED' | translate }}</span>
                  <div class="text-2xl font-bold mt-1" [class]="titleColor">
                    {{ formatBytes(totalSizeBytes()) }}
                    @if (totalQuotaBytes() > 0) {
                      <span class="text-sm font-normal" [class]="mutedColor"> / {{ formatBytes(totalQuotaBytes()) }}</span>
                    }
                  </div>
                </div>
                <span class="p-2 bg-[#135bec]/10 rounded-lg text-[#135bec]">
                  <span class="material-symbols-outlined">database</span>
                </span>
              </div>
              @if (totalQuotaBytes() > 0) {
                <div class="flex flex-col gap-1.5">
                  <div class="flex justify-between text-xs font-medium">
                    <span class="text-[#135bec]">{{ overallPercent() }}% {{ 'QUOTAS.USED' | translate }}</span>
                    <span [class]="mutedColor">{{ formatBytes(totalQuotaBytes() - totalSizeBytes()) }} {{ 'QUOTAS.REMAINING' | translate }}</span>
                  </div>
                  <div class="w-full rounded-full h-2 overflow-hidden" [class]="trackClass">
                    <div class="h-2 rounded-full transition-all" [class]="overallPercent() >= ALERT_THRESHOLD ? 'bg-red-500' : 'bg-[#135bec]'" [style.width.%]="Math.min(overallPercent(), 100)"></div>
                  </div>
                </div>
              } @else {
                <p class="text-xs" [class]="mutedColor">{{ 'QUOTAS.NO_GLOBAL_QUOTA' | translate }}</p>
              }
            </div>

            <!-- Buckets -->
            <div class="rounded-xl p-5 border shadow-sm flex flex-col justify-between" [class]="cardBg + ' ' + border">
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-sm font-medium" [class]="mutedColor">{{ 'QUOTAS.CARD_BUCKETS' | translate }}</span>
                  <div class="text-2xl font-bold mt-1" [class]="titleColor">{{ rows().length }}</div>
                </div>
                <span class="p-2 rounded-lg" [class]="iconSecondaryClass">
                  <span class="material-symbols-outlined">folder_open</span>
                </span>
              </div>
              <div class="mt-4 text-xs" [class]="mutedColor">
                {{ bucketsWithQuota() }} {{ 'QUOTAS.BUCKETS_WITH_QUOTA' | translate }}
              </div>
            </div>

            <!-- Objects -->
            <div class="rounded-xl p-5 border shadow-sm flex flex-col justify-between" [class]="cardBg + ' ' + border">
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-sm font-medium" [class]="mutedColor">{{ 'QUOTAS.CARD_OBJECTS' | translate }}</span>
                  <div class="text-2xl font-bold mt-1" [class]="titleColor">{{ formatNumber(totalObjects()) }}</div>
                </div>
                <span class="p-2 rounded-lg" [class]="iconSecondaryClass">
                  <span class="material-symbols-outlined">grid_view</span>
                </span>
              </div>
              <div class="mt-4 text-xs" [class]="mutedColor">
                {{ 'QUOTAS.AVG_SIZE' | translate }}: <span class="font-semibold" [class]="titleColor">{{ avgObjectSize() }}</span>
              </div>
            </div>

            <!-- Alerts -->
            <div class="rounded-xl p-5 border shadow-sm flex flex-col justify-between relative overflow-hidden"
              [class]="alertCount() > 0 ? 'bg-amber-500/10 border-amber-500/30' : cardBg + ' ' + border">
              @if (alertCount() > 0) {
                <div class="absolute right-0 top-0 p-3 opacity-10">
                  <span class="material-symbols-outlined text-[80px] text-amber-500">warning</span>
                </div>
              }
              <div class="flex justify-between items-start relative z-10">
                <div>
                  <span class="text-sm font-medium" [class]="alertCount() > 0 ? 'text-amber-600 dark:text-amber-500' : mutedColor">{{ 'QUOTAS.CARD_ALERTS' | translate }}</span>
                  <div class="text-2xl font-bold mt-1" [class]="alertCount() > 0 ? 'text-amber-700 dark:text-amber-400' : titleColor">{{ alertCount() }}</div>
                </div>
                <span class="p-2 rounded-lg" [class]="alertCount() > 0 ? 'bg-amber-500/20 text-amber-500 animate-pulse' : iconSecondaryClass">
                  <span class="material-symbols-outlined">notification_important</span>
                </span>
              </div>
              <div class="mt-4 relative z-10 text-xs" [class]="mutedColor">
                {{ 'QUOTAS.ALERT_THRESHOLD' | translate: { pct: ALERT_THRESHOLD } }}
              </div>
            </div>

          </div>
        }

        <!-- Charts + Top Buckets -->
        @if (!loading() && rows().length > 0) {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

            <!-- Distribution bars -->
            <div class="lg:col-span-2 rounded-xl border p-6 flex flex-col" [class]="cardBg + ' ' + border">
              <div class="mb-6">
                <h3 class="text-lg font-bold" [class]="titleColor">{{ 'QUOTAS.CHART_DIST_TITLE' | translate }}</h3>
                <p class="text-sm" [class]="mutedColor">{{ 'QUOTAS.CHART_DIST_DESC' | translate }}</p>
              </div>
              <div class="flex flex-col gap-3 flex-1 justify-center">
                @for (row of top10(); track row.name) {
                  <div>
                    <div class="flex justify-between items-end mb-1">
                      <span class="text-sm font-medium truncate max-w-[60%]" [class]="titleColor">{{ row.name }}</span>
                      <span class="text-xs font-semibold shrink-0 ml-2" [class]="mutedColor">
                        {{ formatBytes(row.size_bytes) }}
                        @if (row.quota_bytes) { <span> / {{ formatBytes(row.quota_bytes) }}</span> }
                      </span>
                    </div>
                    <div class="w-full rounded-full h-2 overflow-hidden" [class]="trackClass">
                      <div
                        class="h-full rounded-full transition-all"
                        [class]="barColor(row)"
                        [style.width.%]="barWidth(row)"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Top 5 by size -->
            <div class="lg:col-span-1 rounded-xl border p-6 flex flex-col" [class]="cardBg + ' ' + border">
              <div class="mb-6">
                <h3 class="text-lg font-bold" [class]="titleColor">{{ 'QUOTAS.TOP5_TITLE' | translate }}</h3>
                <p class="text-sm" [class]="mutedColor">{{ 'QUOTAS.TOP5_DESC' | translate }}</p>
              </div>
              <div class="flex flex-col gap-5 flex-1 justify-center">
                @for (row of top5(); track row.name; let idx = $index) {
                  <div>
                    <div class="flex justify-between items-end mb-1">
                      <span class="text-sm font-medium truncate max-w-[70%]" [class]="titleColor">{{ row.name }}</span>
                      <span class="text-xs font-semibold" [class]="mutedColor">{{ formatBytes(row.size_bytes) }}</span>
                    </div>
                    <div class="w-full rounded-full h-2 overflow-hidden" [class]="trackClass">
                      <div
                        class="h-full rounded-full transition-all"
                        [class]="top5Colors[idx]"
                        [style.width.%]="top5Width(row)"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>

          </div>
        }

        <!-- Table -->
        <div class="rounded-xl border overflow-hidden flex flex-col mb-8" [class]="cardBg + ' ' + border">
          <!-- Table header -->
          <div class="p-5 border-b flex flex-col sm:flex-row justify-between items-center gap-4" [class]="border">
            <h3 class="text-lg font-bold" [class]="titleColor">{{ 'QUOTAS.TABLE_TITLE' | translate }}</h3>
            <div class="flex gap-2 w-full sm:w-auto">
              <div class="relative w-full sm:w-64">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" [class]="mutedColor">search</span>
                <input
                  type="text"
                  [placeholder]="'QUOTAS.SEARCH_PLACEHOLDER' | translate"
                  [value]="search()"
                  (input)="search.set($any($event.target).value)"
                  class="w-full pl-10 pr-4 py-2 rounded-lg text-sm border-none focus:ring-2 focus:ring-[#135bec] outline-none"
                  [class]="searchInputClass"
                />
              </div>
            </div>
          </div>

          <!-- Table body -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="text-xs uppercase font-semibold" [class]="theadClass">
                <tr>
                  <th class="px-6 py-4">{{ 'QUOTAS.COL_BUCKET' | translate }}</th>
                  <th class="px-6 py-4">{{ 'QUOTAS.COL_QUOTA' | translate }}</th>
                  <th class="px-6 py-4">{{ 'QUOTAS.COL_USAGE' | translate }}</th>
                  <th class="px-6 py-4">{{ 'QUOTAS.COL_REMAINING' | translate }}</th>
                  <th class="px-6 py-4 text-right">{{ 'QUOTAS.COL_ACTIONS' | translate }}</th>
                </tr>
              </thead>
              <tbody [class]="tbodyDivideClass">
                @if (loading()) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr>
                      <td colspan="5" class="px-6 py-4">
                        <div class="h-4 rounded animate-pulse w-2/3" [class]="skeletonClass"></div>
                      </td>
                    </tr>
                  }
                } @else if (filteredRows().length === 0) {
                  <tr>
                    <td colspan="5" class="px-6 py-10 text-center text-sm" [class]="mutedColor">
                      {{ search() ? ('QUOTAS.NO_RESULTS' | translate) : ('QUOTAS.EMPTY' | translate) }}
                    </td>
                  </tr>
                } @else {
                  @for (row of pagedRows(); track row.name) {
                    <tr class="transition-colors" [class]="trHoverClass">
                      <td class="px-6 py-4 font-medium" [class]="titleColor">
                        <div class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[18px]" [class]="mutedColor">cloud</span>
                          {{ row.name }}
                        </div>
                      </td>
                      <td class="px-6 py-4 text-sm" [class]="mutedColor">
                        {{ row.quota_bytes ? formatBytes(row.quota_bytes) : ('QUOTAS.NO_QUOTA' | translate) }}
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                          <div class="w-24 h-2 rounded-full overflow-hidden" [class]="trackClass">
                            <div
                              class="h-full"
                              [class]="usageBarClass(row)"
                              [style.width.%]="Math.min(row.usage_percent ?? 0, 100)"
                            ></div>
                          </div>
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            [class]="usageBadgeClass(row)"
                          >
                            {{ row.quota_bytes ? ((row.usage_percent ?? 0) + '%') : formatBytes(row.size_bytes) }}
                          </span>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-sm font-medium" [class]="titleColor">
                        {{ row.quota_bytes ? formatBytes(Math.max(0, row.quota_bytes - row.size_bytes)) : '—' }}
                      </td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button
                            (click)="openEditModal(row)"
                            class="p-1.5 rounded-md transition-colors"
                            [class]="actionBtnClass"
                            [title]="'QUOTAS.EDIT_QUOTA' | translate"
                          >
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          @if (row.quota_bytes) {
                            <button
                              (click)="confirmRemove(row)"
                              class="p-1.5 rounded-md transition-colors text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                              [title]="'QUOTAS.REMOVE_QUOTA' | translate"
                            >
                              <span class="material-symbols-outlined text-[18px]">remove_circle</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (filteredRows().length > pageSize) {
            <div class="p-4 border-t flex items-center justify-between" [class]="border">
              <span class="text-sm" [class]="mutedColor">
                {{ 'QUOTAS.SHOWING' | translate: { from: pageFrom(), to: pageTo(), total: filteredRows().length } }}
              </span>
              <div class="flex gap-2">
                <button
                  (click)="prevPage()"
                  [disabled]="page() === 0"
                  class="px-3 py-1 text-sm rounded transition-colors disabled:opacity-40"
                  [class]="paginationBtnClass"
                >{{ 'QUOTAS.PREV' | translate }}</button>
                <button
                  (click)="nextPage()"
                  [disabled]="pageTo() >= filteredRows().length"
                  class="px-3 py-1 text-sm rounded transition-colors disabled:opacity-40"
                  [class]="paginationBtnClass"
                >{{ 'QUOTAS.NEXT' | translate }}</button>
              </div>
            </div>
          }
        </div>

      </div>
    </div>

    <!-- Global Quota Modal -->
    @if (showGlobalModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-xl shadow-2xl border" [class]="cardBg + ' ' + border">
          <div class="p-6 border-b" [class]="border">
            <h2 class="text-lg font-bold" [class]="titleColor">{{ 'QUOTAS.GLOBAL_MODAL_TITLE' | translate }}</h2>
            <p class="text-sm mt-1" [class]="mutedColor">{{ 'QUOTAS.GLOBAL_MODAL_DESC' | translate: { count: rows().length } }}</p>
          </div>
          <div class="p-6 flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5" [class]="titleColor">{{ 'QUOTAS.QUOTA_VALUE' | translate }}</label>
              <div class="flex gap-2">
                <input
                  type="number"
                  min="1"
                  [value]="globalValue()"
                  (input)="globalValue.set(+$any($event.target).value)"
                  class="flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec]"
                  [class]="modalInputClass"
                />
                <select
                  [value]="globalUnit()"
                  (change)="globalUnit.set($any($event.target).value)"
                  class="px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec]"
                  [class]="modalInputClass"
                >
                  <option value="GB">GB</option>
                  <option value="TB">TB</option>
                  <option value="PB">PB</option>
                </select>
              </div>
              <p class="text-xs mt-1" [class]="mutedColor">≈ {{ formatBytes(parseToBytes(globalValue(), globalUnit())) }}</p>
            </div>
            @if (globalResult()) {
              <div class="rounded-lg p-3 text-sm" [class]="globalResult()!.errors.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'">
                {{ 'QUOTAS.GLOBAL_APPLIED' | translate: { count: globalResult()!.applied } }}
                @if (globalResult()!.errors.length > 0) {
                  <span> — {{ globalResult()!.errors.length }} {{ 'QUOTAS.ERRORS' | translate }}</span>
                }
              </div>
            }
          </div>
          <div class="p-6 border-t flex justify-end gap-3" [class]="border">
            <button (click)="closeGlobalModal()" class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors" [class]="cancelBtnClass">
              {{ 'QUOTAS.CANCEL' | translate }}
            </button>
            <button
              (click)="applyGlobalQuota()"
              [disabled]="applyingGlobal() || globalValue() <= 0"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-[#135bec] hover:bg-[#0f4bc4] text-white transition-colors disabled:opacity-50"
            >
              {{ applyingGlobal() ? ('QUOTAS.APPLYING' | translate) : ('QUOTAS.APPLY' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Quota Modal -->
    @if (editTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-sm rounded-xl shadow-2xl border" [class]="cardBg + ' ' + border">
          <div class="p-6 border-b" [class]="border">
            <h2 class="text-base font-bold" [class]="titleColor">{{ 'QUOTAS.EDIT_MODAL_TITLE' | translate }}</h2>
            <p class="text-xs font-mono mt-0.5" [class]="mutedColor">{{ editTarget()!.name }}</p>
          </div>
          <div class="p-6 flex flex-col gap-3">
            <label class="block text-sm font-medium mb-0.5" [class]="titleColor">{{ 'QUOTAS.QUOTA_VALUE' | translate }}</label>
            <div class="flex gap-2">
              <input
                type="number"
                min="1"
                [value]="editValue()"
                (input)="editValue.set(+$any($event.target).value)"
                class="flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec]"
                [class]="modalInputClass"
              />
              <select
                [value]="editUnit()"
                (change)="editUnit.set($any($event.target).value)"
                class="px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec]"
                [class]="modalInputClass"
              >
                <option value="GB">GB</option>
                <option value="TB">TB</option>
                <option value="PB">PB</option>
              </select>
            </div>
            <p class="text-xs" [class]="mutedColor">≈ {{ formatBytes(parseToBytes(editValue(), editUnit())) }}</p>
          </div>
          <div class="px-6 pb-6 flex justify-end gap-3">
            <button (click)="editTarget.set(null)" class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors" [class]="cancelBtnClass">
              {{ 'QUOTAS.CANCEL' | translate }}
            </button>
            <button
              (click)="saveEditQuota()"
              [disabled]="savingEdit() || editValue() <= 0"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-[#135bec] hover:bg-[#0f4bc4] text-white transition-colors disabled:opacity-50"
            >
              {{ savingEdit() ? ('QUOTAS.SAVING' | translate) : ('QUOTAS.SAVE' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Remove Quota Confirm -->
    @if (removeTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-sm rounded-xl shadow-2xl border" [class]="cardBg + ' ' + border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-red-500">warning</span>
              </div>
              <div>
                <h2 class="text-base font-bold" [class]="titleColor">{{ 'QUOTAS.REMOVE_TITLE' | translate }}</h2>
                <p class="text-xs font-mono mt-0.5" [class]="mutedColor">{{ removeTarget()!.name }}</p>
              </div>
            </div>
            <p class="text-sm" [class]="mutedColor">{{ 'QUOTAS.REMOVE_DESC' | translate }}</p>
          </div>
          <div class="px-6 pb-6 flex justify-end gap-3">
            <button (click)="removeTarget.set(null)" class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors" [class]="cancelBtnClass">
              {{ 'QUOTAS.CANCEL' | translate }}
            </button>
            <button
              (click)="doRemoveQuota()"
              [disabled]="removing()"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              {{ removing() ? ('QUOTAS.REMOVING' | translate) : ('QUOTAS.REMOVE_CONFIRM' | translate) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class QuotasComponent implements OnInit {
  private api = inject(ApiService);
  private theme = inject(ThemeService);
  private toast = inject(ToastService);

  readonly ALERT_THRESHOLD = ALERT_THRESHOLD;
  readonly Math = Math;
  readonly formatBytes = formatBytes;
  readonly parseToBytes = parseToBytes;
  readonly top5Colors = ['bg-indigo-500', 'bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-slate-500'];

  readonly pageSize = 10;

  rows = signal<QuotaBucketRow[]>([]);
  loading = signal(true);
  search = signal('');
  page = signal(0);

  // Global quota modal
  showGlobalModal = signal(false);
  globalValue = signal(10);
  globalUnit = signal('TB');
  applyingGlobal = signal(false);
  globalResult = signal<{ applied: number; errors: string[] } | null>(null);

  // Edit modal
  editTarget = signal<QuotaBucketRow | null>(null);
  editValue = signal(10);
  editUnit = signal('TB');
  savingEdit = signal(false);

  // Remove confirm
  removeTarget = signal<QuotaBucketRow | null>(null);
  removing = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────

  filteredRows = computed(() => {
    const q = this.search().toLowerCase().trim();
    return q ? this.rows().filter(r => r.name.toLowerCase().includes(q)) : this.rows();
  });

  pagedRows = computed(() => {
    const start = this.page() * this.pageSize;
    return this.filteredRows().slice(start, start + this.pageSize);
  });

  pageFrom = computed(() => Math.min(this.page() * this.pageSize + 1, this.filteredRows().length));
  pageTo = computed(() => Math.min((this.page() + 1) * this.pageSize, this.filteredRows().length));

  totalSizeBytes = computed(() => this.rows().reduce((s, r) => s + r.size_bytes, 0));
  totalQuotaBytes = computed(() => this.rows().reduce((s, r) => s + (r.quota_bytes ?? 0), 0));
  totalObjects = computed(() => this.rows().reduce((s, r) => s + r.objects, 0));
  bucketsWithQuota = computed(() => this.rows().filter(r => r.quota_bytes != null).length);
  alertCount = computed(() => this.rows().filter(r => (r.usage_percent ?? 0) >= ALERT_THRESHOLD).length);

  overallPercent = computed(() => {
    const total = this.totalQuotaBytes();
    if (total <= 0) return 0;
    return parseFloat(((this.totalSizeBytes() / total) * 100).toFixed(1));
  });

  top5 = computed(() =>
    [...this.rows()].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 5),
  );

  top10 = computed(() =>
    [...this.rows()].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 10),
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.getQuotasOverview());
      this.rows.set(res?.data ?? []);
    } catch (err) {
      this.rows.set([]);
      this.toast.fromHttpError(err, 'Failed to load quotas data');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Table helpers ─────────────────────────────────────────────────────────

  prevPage(): void {
    this.page.update(p => Math.max(0, p - 1));
  }

  nextPage(): void {
    this.page.update(p => p + 1);
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  avgObjectSize(): string {
    const objs = this.totalObjects();
    if (objs <= 0) return '0 B';
    return formatBytes(this.totalSizeBytes() / objs);
  }

  barWidth(row: QuotaBucketRow): number {
    const max = this.top10()[0]?.size_bytes ?? 1;
    return max > 0 ? Math.min((row.size_bytes / max) * 100, 100) : 0;
  }

  barColor(row: QuotaBucketRow): string {
    const pct = row.usage_percent ?? 0;
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-[#135bec]';
  }

  top5Width(row: QuotaBucketRow): number {
    const max = this.top5()[0]?.size_bytes ?? 1;
    return max > 0 ? Math.min((row.size_bytes / max) * 100, 100) : 0;
  }

  usageBarClass(row: QuotaBucketRow): string {
    if (!row.quota_bytes) return 'bg-slate-400';
    const pct = row.usage_percent ?? 0;
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  usageBadgeClass(row: QuotaBucketRow): string {
    if (!row.quota_bytes) return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    const pct = row.usage_percent ?? 0;
    if (pct >= 90) return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400';
    if (pct >= 80) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400';
  }

  // ── Global quota ──────────────────────────────────────────────────────────

  openGlobalModal(): void {
    this.globalResult.set(null);
    this.showGlobalModal.set(true);
  }

  closeGlobalModal(): void {
    this.showGlobalModal.set(false);
    if (this.globalResult()) this.loadData();
    this.globalResult.set(null);
  }

  async applyGlobalQuota(): Promise<void> {
    const bytes = parseToBytes(this.globalValue(), this.globalUnit());
    if (bytes <= 0) return;
    this.applyingGlobal.set(true);
    try {
      const res = await firstValueFrom(this.api.setGlobalQuota({ quota_bytes: bytes }));
      this.globalResult.set(res?.data ?? null);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to apply global quota');
    } finally {
      this.applyingGlobal.set(false);
    }
  }

  // ── Edit quota ────────────────────────────────────────────────────────────

  openEditModal(row: QuotaBucketRow): void {
    if (row.quota_bytes) {
      const gb = row.quota_bytes / 1024 ** 3;
      if (gb >= 1024 * 1024) {
        this.editUnit.set('PB');
        this.editValue.set(parseFloat((gb / (1024 * 1024)).toFixed(2)));
      } else if (gb >= 1024) {
        this.editUnit.set('TB');
        this.editValue.set(parseFloat((gb / 1024).toFixed(2)));
      } else {
        this.editUnit.set('GB');
        this.editValue.set(parseFloat(gb.toFixed(2)));
      }
    } else {
      this.editValue.set(10);
      this.editUnit.set('GB');
    }
    this.editTarget.set(row);
  }

  async saveEditQuota(): Promise<void> {
    const target = this.editTarget();
    if (!target || this.editValue() <= 0) return;
    this.savingEdit.set(true);
    const bytes = parseToBytes(this.editValue(), this.editUnit());
    try {
      await firstValueFrom(this.api.setBucketQuota(target.name, bytes));
      this.toast.success('Quota saved', `Quota for "${target.name}" updated successfully`);
      this.editTarget.set(null);
      await this.loadData();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to save quota for "${target.name}"`);
    } finally {
      this.savingEdit.set(false);
    }
  }

  // ── Remove quota ──────────────────────────────────────────────────────────

  confirmRemove(row: QuotaBucketRow): void {
    this.removeTarget.set(row);
  }

  async doRemoveQuota(): Promise<void> {
    const target = this.removeTarget();
    if (!target) return;
    this.removing.set(true);
    try {
      await firstValueFrom(this.api.removeBucketQuota(target.name));
      this.toast.success('Quota removed', `Quota for "${target.name}" removed successfully`);
      this.removeTarget.set(null);
      await this.loadData();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to remove quota for "${target.name}"`);
    } finally {
      this.removing.set(false);
    }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  private get mode(): string { return this.theme.mode(); }

  get pageBg(): string { return this.mode === 'dark' ? 'bg-[#101622]' : 'bg-[#f6f6f8]'; }
  get cardBg(): string { return this.mode === 'dark' ? 'bg-[#1b2537]' : 'bg-white'; }
  get border(): string { return this.mode === 'dark' ? 'border-[#324467]' : 'border-slate-200'; }
  get titleColor(): string { return this.mode === 'dark' ? 'text-white' : 'text-slate-900'; }
  get mutedColor(): string { return this.mode === 'dark' ? 'text-slate-400' : 'text-slate-500'; }
  get skeletonClass(): string { return this.mode === 'dark' ? 'bg-slate-700' : 'bg-slate-200'; }
  get trackClass(): string { return this.mode === 'dark' ? 'bg-slate-700' : 'bg-slate-100'; }
  get iconSecondaryClass(): string { return this.mode === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'; }
  get theadClass(): string { return this.mode === 'dark' ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'; }
  get tbodyDivideClass(): string { return this.mode === 'dark' ? 'divide-y divide-slate-700/50 text-sm' : 'divide-y divide-slate-100 text-sm'; }
  get trHoverClass(): string { return this.mode === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'; }
  get searchInputClass(): string { return this.mode === 'dark' ? 'bg-slate-800 text-slate-200 placeholder-slate-400' : 'bg-slate-50 text-slate-900 placeholder-slate-400'; }
  get modalInputClass(): string { return this.mode === 'dark' ? 'bg-[#101622] border-[#324467] text-white' : 'bg-white border-slate-200 text-slate-900'; }
  get cancelBtnClass(): string { return this.mode === 'dark' ? 'border-[#324467] text-slate-400 hover:bg-slate-700/40' : 'border-slate-200 text-slate-600 hover:bg-slate-50'; }
  get actionBtnClass(): string { return this.mode === 'dark' ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'; }
  get paginationBtnClass(): string { return this.mode === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'; }
}
