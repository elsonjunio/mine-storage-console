import { Component, computed, inject, OnInit, signal, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { HttpEventType } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/auth/user.service';
import { ToastService } from '../../core/toast/toast.service';
import type {
  ObjectItemResponse,
  ObjectMetadataResponse,
  ObjectVersionItemResponse,
  BucketResponse,
  BucketVersionResponse,
  BucketQuotaGetResponse,
  BucketUsageResponse,
  UpdateBucketLifecycleRequest,
  LifecycleValidationResponse,
  PolicyValidationResponse,
} from '../../core/api/api.types';

type Tab = 'objects' | 'management' | 'security' | 'events';
type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

const POLICY_EXAMPLES: Record<string, object> = {
  read_only: {
    Version: '2012-10-17',
    Statement: [{ Sid: 'PublicReadGetObject', Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::BUCKET_NAME/*'] }],
  },
  write_only: {
    Version: '2012-10-17',
    Statement: [{ Sid: 'WriteOnlyLogBucket', Effect: 'Allow', Principal: { Service: 'logging.s3.amazonaws.com' }, Action: ['s3:PutObject'], Resource: ['arn:aws:s3:::BUCKET_NAME/logs/*'] }],
  },
  deny_unencrypted: {
    Version: '2012-10-17',
    Statement: [{ Sid: 'DenyUnencryptedUploads', Effect: 'Deny', Principal: '*', Action: 's3:PutObject', Resource: ['arn:aws:s3:::BUCKET_NAME/*'], Condition: { StringNotEquals: { 's3:x-amz-server-side-encryption': 'AES256' } } }],
  },
  ip_restrict: {
    Version: '2012-10-17',
    Statement: [{ Sid: 'RestrictByIP', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: ['arn:aws:s3:::BUCKET_NAME', 'arn:aws:s3:::BUCKET_NAME/*'], Condition: { NotIpAddress: { 'aws:SourceIp': '192.168.1.0/24' } } }],
  },
};

interface EventRow {
  id: string;
  destType: 'queue' | 'topic' | 'lambda';
  eventTypes: string[];
  destinationArn: string;
  prefix: string;
  suffix: string;
  rawJson: string;
}

const EVENT_TYPES = [
  's3:ObjectCreated:*',
  's3:ObjectCreated:Put',
  's3:ObjectCreated:Post',
  's3:ObjectCreated:Copy',
  's3:ObjectCreated:CompleteMultipartUpload',
  's3:ObjectRemoved:*',
  's3:ObjectRemoved:Delete',
  's3:ObjectRemoved:DeleteMarkerCreated',
  's3:ObjectRestore:*',
  's3:ObjectRestore:Completed',
  's3:Replication:*',
  's3:LifecycleExpiration:*',
] as const;

interface UploadQueueItem {
  id: string;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progress: number;
}

const TABS: { id: Tab; labelKey: string; icon: string }[] = [
  { id: 'objects',    labelKey: 'BUCKET_DETAIL.TABS.OBJECTS',    icon: 'folder_open' },
  { id: 'management', labelKey: 'BUCKET_DETAIL.TABS.MANAGEMENT', icon: 'settings' },
  { id: 'security',   labelKey: 'BUCKET_DETAIL.TABS.SECURITY',   icon: 'security' },
  { id: 'events',     labelKey: 'BUCKET_DETAIL.TABS.EVENTS',     icon: 'history' },
];

@Component({
  selector: 'app-bucket-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, KeyValuePipe],
  template: `
    <div class="flex min-h-full">

      <!-- ── Main content ──────────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Header -->
        <div class="px-6 pt-6 pb-2 shrink-0">

          <!-- Breadcrumb -->
          <div class="flex items-center gap-1 text-sm mb-4 flex-wrap" [class]="mutedClass">
            <a routerLink="/" class="hover:text-primary transition-colors">Home</a>
            <span class="material-symbols-outlined text-[16px]">chevron_right</span>
            <a routerLink="/buckets" class="hover:text-primary transition-colors">
              {{ 'SIDEBAR.NAV.BUCKETS' | translate }}
            </a>
            <span class="material-symbols-outlined text-[16px]">chevron_right</span>
            @if (prefixSegments().length === 0) {
              <span [class]="titleClass" class="font-medium">{{ bucketName() }}</span>
            } @else {
              <button (click)="navigateToPrefix('')" class="hover:text-primary transition-colors">{{ bucketName() }}</button>
              @for (seg of prefixSegments(); track seg.prefix; let last = $last) {
                <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                @if (last) {
                  <span [class]="titleClass" class="font-medium">{{ seg.label }}</span>
                } @else {
                  <button (click)="navigateToPrefix(seg.prefix)" class="hover:text-primary transition-colors">{{ seg.label }}</button>
                }
              }
            }
          </div>

          <!-- Title + Stats -->
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold tracking-tight mb-1" [class]="titleClass">{{ bucketName() }}</h1>
              <div class="flex items-center gap-4 text-sm flex-wrap" [class]="mutedClass">
                <span class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">event</span>
                  {{ 'BUCKET_DETAIL.CREATED' | translate }}: {{ bucketCreated() || '—' }}
                </span>
                <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                <span class="text-emerald-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">check_circle</span>
                  {{ 'BUCKET_DETAIL.ACTIVE' | translate }}
                </span>
              </div>
            </div>
            @if (usage() && userService.isAdmin()) {
              <div class="flex gap-3">
                <div [class]="statPillClass">
                  <span class="text-xs uppercase font-semibold" [class]="mutedClass">{{ 'BUCKET_DETAIL.TOTAL_SIZE' | translate }}</span>
                  <span class="text-lg font-bold" [class]="titleClass">{{ formatSize(usage()!.size_bytes) }}</span>
                </div>
                <div [class]="statPillClass">
                  <span class="text-xs uppercase font-semibold" [class]="mutedClass">{{ 'BUCKET_DETAIL.OBJECT_COUNT' | translate }}</span>
                  <span class="text-lg font-bold" [class]="titleClass">{{ formatNumber(usage()!.objects) }}</span>
                </div>
                @if (mgmtQuota()?.quota_bytes) {
                  <div [class]="statPillClass" class="min-w-[140px]">
                    <span class="text-xs uppercase font-semibold" [class]="mutedClass">{{ 'BUCKET_DETAIL.QUOTA_USAGE' | translate }}</span>
                    <span class="text-lg font-bold" [class]="mgmtUsagePct() >= 90 ? 'text-red-500' : mgmtUsagePct() >= 80 ? 'text-amber-500' : titleClass">
                      {{ formatSize(usage()!.size_bytes) }} / {{ formatSize(mgmtQuota()!.quota_bytes) }}
                    </span>
                    <div class="w-full mt-1 rounded-full h-1.5 overflow-hidden" [class]="mgmtProgressTrackClass">
                      <div
                        class="h-1.5 rounded-full transition-all duration-500"
                        [class]="mgmtUsagePct() >= 90 ? 'bg-red-500' : mgmtUsagePct() >= 80 ? 'bg-amber-500' : 'bg-primary'"
                        [style.width.%]="mgmtUsagePct()"
                      ></div>
                    </div>
                    <span class="text-xs mt-0.5" [class]="mgmtUsagePct() >= 90 ? 'text-red-500' : mgmtUsagePct() >= 80 ? 'text-amber-500' : mutedClass">
                      {{ mgmtUsagePct() }}% {{ 'BUCKET_DETAIL.USED' | translate }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 mt-6 border-b flex gap-8 shrink-0" [class]="borderClass">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="switchTab(tab.id)"
              class="pb-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors"
              [class]="activeTab() === tab.id ? activeTabClass : inactiveTabClass"
            >
              <span class="material-symbols-outlined text-[18px]">{{ tab.icon }}</span>
              {{ tab.labelKey | translate }}
            </button>
          }
        </div>

        <!-- ── Objects Tab ────────────────────────────────────── -->
        @if (activeTab() === 'objects') {

          <!-- Toolbar -->
          <div class="px-6 py-4 flex flex-wrap gap-4 items-center justify-between shrink-0">
            <div class="flex items-center gap-3 flex-1 max-w-lg">
              <div class="relative w-full">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3" [class]="mutedClass">
                  <span class="material-symbols-outlined text-[20px]">search</span>
                </span>
                <input
                  #filterInput
                  type="text"
                  [placeholder]="'BUCKET_DETAIL.FILTER_PLACEHOLDER' | translate"
                  (input)="filterText.set(filterInput.value)"
                  [class]="filterInputClass"
                />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <button [class]="ghostBtnClass" (click)="openUploadModal()">
                <span class="material-symbols-outlined text-[18px]">upload</span>
                {{ 'BUCKET_DETAIL.UPLOAD_BTN' | translate }}
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="flex-1 overflow-auto px-6 pb-6">
            <div [class]="tableWrapClass">
              <table class="min-w-full divide-y" [class]="dividerClass">
                <thead [class]="theadClass">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-8" [class]="thTextClass">
                      {{ 'BUCKET_DETAIL.TABLE.NAME' | translate }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass" colspan="2">
                      &nbsp;
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'BUCKET_DETAIL.TABLE.MODIFIED' | translate }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'BUCKET_DETAIL.TABLE.SIZE' | translate }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'BUCKET_DETAIL.TABLE.STORAGE_CLASS' | translate }}
                    </th>
                    <th class="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody class="divide-y" [class]="dividerClass">

                  <!-- Loading skeletons -->
                  @if (loading()) {
                    @for (i of skeletons; track i) {
                      <tr>
                        <td class="px-4 py-3" colspan="7">
                          <div class="h-4 rounded animate-pulse w-64" [class]="skeletonClass"></div>
                        </td>
                      </tr>
                    }
                  }

                  <!-- Folders -->
                  @for (folder of filteredFolders(); track folder) {
                    <tr [class]="rowClass" (click)="navigateToPrefix(folder)">
                      <td class="px-4 py-3 whitespace-nowrap" colspan="2">
                        <div class="flex items-center gap-3">
                          <span class="material-symbols-outlined text-amber-400 text-[22px]">folder</span>
                          <span class="text-sm font-medium" [class]="titleClass">{{ folderLabel(folder) }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm" [class]="mutedClass">—</td>
                      <td class="px-4 py-3 text-sm" [class]="mutedClass">—</td>
                      <td class="px-4 py-3 text-sm" [class]="mutedClass">—</td>
                      <td class="px-4 py-3"></td>
                    </tr>
                  }

                  <!-- Files -->
                  @for (obj of filteredFiles(); track obj.key) {
                    <tr
                      [class]="obj.key === selectedObject()?.key ? selectedRowClass : rowClass"
                      (click)="selectObject(obj)"
                    >
                      <td class="px-4 py-3 whitespace-nowrap" colspan="2">
                        <div class="flex items-center gap-3">
                          <span class="material-symbols-outlined text-[22px]" [class]="fileIconColor(obj.key)">{{ fileIcon(obj.key) }}</span>
                          <span class="text-sm font-medium" [class]="titleClass">{{ fileName(obj.key) }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm" [class]="mutedClass">{{ formatDate(obj.last_modified) }}</td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm" [class]="mutedClass">{{ formatSize(obj.size) }}</td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        <span [class]="storageClassBadge(obj.storage_class)">{{ obj.storage_class || 'STANDARD' }}</span>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                          [class]="mutedClass"
                          (click)="$event.stopPropagation(); selectObject(obj)"
                        >
                          <span class="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  }

                  <!-- Empty state -->
                  @if (!loading() && filteredFolders().length === 0 && filteredFiles().length === 0) {
                    <tr>
                      <td colspan="7" class="px-4 py-12 text-center text-sm" [class]="mutedClass">
                        {{ filterText() ? ('BUCKET_DETAIL.TABLE.NO_RESULTS' | translate) : ('BUCKET_DETAIL.TABLE.EMPTY' | translate) }}
                      </td>
                    </tr>
                  }

                </tbody>
              </table>
            </div>

            <!-- Load more -->
            @if (isTruncated()) {
              <div class="mt-4 flex justify-center">
                <button (click)="loadMore()" [class]="ghostBtnClass">
                  {{ 'BUCKET_DETAIL.LOAD_MORE' | translate }}
                </button>
              </div>
            }
          </div>

        }

        <!-- ── Management Tab ────────────────────────────────────── -->
        @if (activeTab() === 'management') {
          <div class="px-6 py-6 md:px-10 overflow-y-auto flex-1">
            @if (mgmtLoading()) {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto w-full">
                @for (i of [1, 2, 3]; track i) {
                  <div [class]="i === 3 ? 'lg:col-span-2' : ''">
                    <div class="h-52 rounded-xl animate-pulse" [class]="skeletonClass"></div>
                  </div>
                }
              </div>
            } @else {
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10 max-w-7xl mx-auto w-full">

                <!-- Versioning Card -->
                <div [class]="mgmtCardClass">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex gap-3">
                      <div class="mt-1 p-2 rounded-lg bg-primary/10 text-primary h-fit">
                        <span class="material-symbols-outlined">history</span>
                      </div>
                      <div>
                        <h3 class="text-base font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_TITLE' | translate }}</h3>
                        <p class="mt-1 text-sm max-w-sm" [class]="mutedClass">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_DESC' | translate }}</p>
                      </div>
                    </div>
                    @if (mgmtVersioning()?.toLowerCase() === 'enabled') {
                      <span class="inline-flex items-center rounded-md bg-green-400/10 px-2 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-400/20 shrink-0">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_ENABLED' | translate }}</span>
                    } @else if (mgmtVersioning()?.toLowerCase() === 'suspended') {
                      <span class="inline-flex items-center rounded-md bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-400/20 shrink-0">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_SUSPENDED' | translate }}</span>
                    } @else {
                      <span class="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20 shrink-0">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_DISABLED' | translate }}</span>
                    }
                  </div>
                  <div class="mt-6 flex items-center justify-between border-t pt-6" [class]="borderClass">
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="sr-only peer"
                        [checked]="mgmtVersioningToggle()"
                        (change)="mgmtVersioningToggle.set($any($event.target).checked)"
                        [disabled]="mgmtVersioningSaving()"
                      />
                      <div class="w-11 h-6 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/50 bg-slate-300 dark:bg-slate-700 peer-checked:bg-primary relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                      <span class="ml-3 text-sm font-medium" [class]="subtleClass">{{ 'BUCKET_DETAIL.MANAGEMENT.VERSIONING_STATUS' | translate }}</span>
                    </label>
                    <button
                      (click)="saveVersioning()"
                      [disabled]="mgmtVersioningSaving()"
                      class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (mgmtVersioningSaving()) {
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.MANAGEMENT.SAVE' | translate }}
                    </button>
                  </div>
                </div>

                <!-- Quota Card -->
                <div [class]="mgmtCardClass">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex gap-3">
                      <div class="mt-1 p-2 rounded-lg bg-primary/10 text-primary h-fit">
                        <span class="material-symbols-outlined">pie_chart</span>
                      </div>
                      <div>
                        <h3 class="text-base font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.MANAGEMENT.QUOTA_TITLE' | translate }}</h3>
                        <p class="mt-1 text-sm max-w-sm" [class]="mutedClass">{{ 'BUCKET_DETAIL.MANAGEMENT.QUOTA_DESC' | translate }}</p>
                      </div>
                    </div>
                  </div>
                  @if (usage() && mgmtQuota()?.quota_bytes) {
                    <div class="mt-2 mb-6">
                      <div class="flex justify-between text-xs font-medium mb-2" [class]="mutedClass">
                        <span>{{ 'BUCKET_DETAIL.MANAGEMENT.QUOTA_USAGE' | translate }}: {{ formatSize(usage()!.size_bytes) }}</span>
                        <span>{{ 'BUCKET_DETAIL.MANAGEMENT.QUOTA_LIMIT' | translate }}: {{ formatSize(mgmtQuota()!.quota_bytes) }}</span>
                      </div>
                      <div class="w-full rounded-full h-2.5 overflow-hidden" [class]="mgmtProgressTrackClass">
                        <div class="bg-primary h-2.5 rounded-full transition-all duration-500" [style.width.%]="mgmtUsagePct()"></div>
                      </div>
                      <p class="mt-2 text-xs text-right" [class]="mutedClass">{{ mgmtUsagePct() }}% {{ 'BUCKET_DETAIL.MANAGEMENT.QUOTA_USED' | translate }}</p>
                    </div>
                  }
                  <div class="flex items-center justify-between border-t pt-6 gap-4" [class]="borderClass">
                    <div class="relative flex-1">
                      <input
                        type="number"
                        min="1"
                        [class]="mgmtQuotaInputClass"
                        [value]="mgmtQuotaInput()"
                        (input)="mgmtQuotaInput.set($any($event.target).value)"
                        placeholder="1024"
                      />
                      <div class="absolute inset-y-0 right-0 flex items-center">
                        <select [class]="mgmtQuotaUnitClass" (change)="mgmtQuotaUnit.set($any($event.target).value)">
                          <option value="GB" [selected]="mgmtQuotaUnit() === 'GB'">GB</option>
                          <option value="TB" [selected]="mgmtQuotaUnit() === 'TB'">TB</option>
                          <option value="PB" [selected]="mgmtQuotaUnit() === 'PB'">PB</option>
                        </select>
                      </div>
                    </div>
                    <button
                      (click)="saveQuota()"
                      [disabled]="mgmtQuotaSaving() || !mgmtQuotaInput()"
                      class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      @if (mgmtQuotaSaving()) {
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.MANAGEMENT.UPDATE' | translate }}
                    </button>
                  </div>
                </div>

                <!-- Lifecycle Card -->
                <div class="lg:col-span-2" [class]="mgmtCardClass">
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                    <div class="flex gap-3">
                      <div class="mt-1 p-2 rounded-lg bg-primary/10 text-primary h-fit">
                        <span class="material-symbols-outlined">schedule</span>
                      </div>
                      <div>
                        <h3 class="text-base font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.MANAGEMENT.LIFECYCLE_TITLE' | translate }}</h3>
                        <p class="mt-1 text-sm max-w-2xl" [class]="mutedClass">{{ 'BUCKET_DETAIL.MANAGEMENT.LIFECYCLE_DESC' | translate }}</p>
                      </div>
                    </div>
                    <button (click)="validateLifecycle()" [disabled]="mgmtValidating()" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" [class]="ghostBtnClass">
                      @if (mgmtValidating()) {
                        <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      } @else {
                        <span class="material-symbols-outlined text-[18px]">check_circle</span>
                      }
                      {{ 'BUCKET_DETAIL.MANAGEMENT.VALIDATE_JSON' | translate }}
                    </button>
                  </div>

                  <!-- Code editor -->
                  <div class="rounded-lg overflow-hidden border" [class]="borderClass">
                    <div [class]="mgmtEditorHeaderClass">
                      <span class="text-xs font-mono" [class]="mutedClass">lifecycle-config.json</span>
                      <button (click)="copyToClipboard(mgmtLifecycleJson())" class="transition-colors" [class]="mutedClass + ' hover:text-primary'" title="Copy">
                        <span class="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                    </div>
                    <textarea
                      [class]="mgmtEditorBodyClass"
                      [value]="mgmtLifecycleJson()"
                      (input)="mgmtLifecycleJson.set($any($event.target).value); mgmtLifecycleErrors.set([]); mgmtLifecycleValid.set(false)"
                      [placeholder]="'BUCKET_DETAIL.MANAGEMENT.LIFECYCLE_PLACEHOLDER' | translate"
                      spellcheck="false"
                    ></textarea>
                  </div>
                  @if (mgmtLifecycleErrors().length > 0) {
                    <div class="mt-2 space-y-1">
                      @for (err of mgmtLifecycleErrors(); track err) {
                        <p class="text-xs text-red-400 flex items-start gap-1">
                          <span class="material-symbols-outlined text-[14px] mt-px shrink-0">error</span>
                          {{ err }}
                        </p>
                      }
                    </div>
                  } @else if (mgmtLifecycleValid()) {
                    <p class="mt-2 text-xs text-green-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                      {{ 'BUCKET_DETAIL.MANAGEMENT.LIFECYCLE_VALID' | translate }}
                    </p>
                  }
                  <div class="mt-6 flex justify-end">
                    <button
                      (click)="saveLifecycle()"
                      [disabled]="mgmtLifecycleSaving() || mgmtLifecycleErrors().length > 0"
                      class="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (mgmtLifecycleSaving()) {
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.MANAGEMENT.SAVE_CONFIG' | translate }}
                    </button>
                  </div>
                </div>

              </div>
            }
          </div>
        }

        <!-- ── Security tab ────────────────────────────────────── -->
        @if (activeTab() === 'security') {
          <div class="px-6 py-6 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

            <!-- Left: info card -->
            <div class="lg:col-span-4">
              <div class="rounded-xl border p-6 lg:sticky lg:top-6" [class]="mgmtCardClass">
                <div class="flex gap-3 mb-4">
                  <div class="mt-1 p-2 rounded-lg bg-primary/10 text-primary h-fit">
                    <span class="material-symbols-outlined">policy</span>
                  </div>
                  <div>
                    <h3 class="text-base font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.SECURITY.POLICY_TITLE' | translate }}</h3>
                    <p class="mt-1 text-sm" [class]="mutedClass">{{ 'BUCKET_DETAIL.SECURITY.POLICY_DESC' | translate }}</p>
                  </div>
                </div>
                <p class="text-sm leading-relaxed mb-4" [class]="mutedClass">{{ 'BUCKET_DETAIL.SECURITY.POLICY_BODY' | translate }}</p>
                <ul class="text-sm space-y-2 list-disc pl-4 mb-6" [class]="mutedClass">
                  <li>{{ 'BUCKET_DETAIL.SECURITY.BULLET_CONTROL' | translate }}</li>
                  <li>{{ 'BUCKET_DETAIL.SECURITY.BULLET_PERMISSIONS' | translate }}</li>
                  <li>{{ 'BUCKET_DETAIL.SECURITY.BULLET_IP' | translate }}</li>
                  <li>{{ 'BUCKET_DETAIL.SECURITY.BULLET_SSL' | translate }}</li>
                </ul>
              </div>
            </div>

            <!-- Right: policy editor -->
            <div class="lg:col-span-8">
              @if (securityLoading()) {
                <div class="flex items-center justify-center h-64">
                  <span class="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
                </div>
              } @else {
                <div class="rounded-xl border p-6 flex flex-col" [class]="mgmtCardClass">

                  <!-- Top bar -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                    <select
                      [class]="securitySelectClass"
                      (change)="applyPolicyExample($any($event.target).value); $any($event.target).selectedIndex = 0"
                    >
                      <option value="" disabled selected>{{ 'BUCKET_DETAIL.SECURITY.EXAMPLE_PLACEHOLDER' | translate }}</option>
                      <option value="read_only">{{ 'BUCKET_DETAIL.SECURITY.EXAMPLE_READ_ONLY' | translate }}</option>
                      <option value="write_only">{{ 'BUCKET_DETAIL.SECURITY.EXAMPLE_WRITE_ONLY' | translate }}</option>
                      <option value="deny_unencrypted">{{ 'BUCKET_DETAIL.SECURITY.EXAMPLE_DENY_UNENCRYPTED' | translate }}</option>
                      <option value="ip_restrict">{{ 'BUCKET_DETAIL.SECURITY.EXAMPLE_IP_RESTRICT' | translate }}</option>
                    </select>
                    <button
                      (click)="validatePolicy()"
                      [disabled]="securityPolicyValidating()"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      [class]="ghostBtnClass"
                    >
                      @if (securityPolicyValidating()) {
                        <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      } @else {
                        <span class="material-symbols-outlined text-[18px]">check_circle</span>
                      }
                      {{ 'BUCKET_DETAIL.SECURITY.VALIDATE_POLICY' | translate }}
                    </button>
                  </div>

                  <!-- Code editor -->
                  <div class="rounded-lg overflow-hidden border" [class]="borderClass">
                    <div [class]="mgmtEditorHeaderClass">
                      <span class="text-xs font-mono" [class]="mutedClass">bucket-policy.json</span>
                      <button (click)="copyToClipboard(securityPolicyJson())" class="transition-colors" [class]="mutedClass + ' hover:text-primary'" title="Copy">
                        <span class="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                    </div>
                    <textarea
                      [class]="securityEditorBodyClass"
                      [value]="securityPolicyJson()"
                      (input)="securityPolicyJson.set($any($event.target).value); securityPolicyErrors.set([]); securityPolicyValid.set(false)"
                      [placeholder]="'BUCKET_DETAIL.SECURITY.POLICY_PLACEHOLDER' | translate"
                      spellcheck="false"
                    ></textarea>
                  </div>

                  <!-- Validation feedback -->
                  @if (securityPolicyErrors().length > 0) {
                    <div class="mt-2 space-y-1">
                      @for (err of securityPolicyErrors(); track err) {
                        <p class="text-xs text-red-400 flex items-start gap-1">
                          <span class="material-symbols-outlined text-[14px] mt-px shrink-0">error</span>
                          {{ err }}
                        </p>
                      }
                    </div>
                  } @else if (securityPolicyValid()) {
                    <p class="mt-2 text-xs text-green-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                      {{ 'BUCKET_DETAIL.SECURITY.POLICY_VALID' | translate }}
                    </p>
                  }

                  <!-- Footer actions -->
                  <div class="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t" [class]="borderClass">
                    <button
                      (click)="deletePolicy()"
                      [disabled]="securityPolicyDeleting()"
                      class="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (securityPolicyDeleting()) {
                        <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      } @else {
                        <span class="material-symbols-outlined text-[18px]">delete_forever</span>
                      }
                      {{ 'BUCKET_DETAIL.SECURITY.DELETE_POLICY' | translate }}
                    </button>
                    <button
                      (click)="savePolicy()"
                      [disabled]="securityPolicySaving() || securityPolicyErrors().length > 0"
                      class="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (securityPolicySaving()) {
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.SECURITY.SAVE_POLICY' | translate }}
                    </button>
                  </div>

                </div>
              }
            </div>

          </div>
          </div>
        }

        <!-- ── Events tab ─────────────────────────────────────── -->
        @if (activeTab() === 'events') {
          <div class="px-6 py-6 overflow-y-auto flex-1">
          <div class="rounded-xl border overflow-hidden shadow-sm" [class]="mgmtCardClass" style="padding:0">

            <!-- Toolbar -->
            <div class="p-5 border-b flex flex-col sm:flex-row justify-between items-center gap-4" [class]="borderClass">
              <div class="relative w-full sm:w-96">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span class="material-symbols-outlined text-[18px]" [class]="mutedClass">search</span>
                </div>
                <input
                  type="text"
                  class="block w-full pl-10 pr-3 py-2 rounded-lg text-sm transition-all outline-none"
                  [class]="filterInputClass"
                  [value]="eventsFilter()"
                  (input)="eventsFilter.set($any($event.target).value)"
                  [placeholder]="'BUCKET_DETAIL.EVENTS.FILTER_PLACEHOLDER' | translate"
                />
              </div>
              <button
                (click)="openAddEventModal()"
                class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-primary hover:bg-primary-hover text-white transition-all shadow-lg shadow-primary/20"
              >
                <span class="material-symbols-outlined text-xl">add</span>
                {{ 'BUCKET_DETAIL.EVENTS.CONFIGURE_NEW' | translate }}
              </button>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr [class]="eventsTableHeaderClass">
                    <th class="px-6 py-4 w-12"></th>
                    <th class="px-6 py-4">{{ 'BUCKET_DETAIL.EVENTS.TABLE_NAME' | translate }}</th>
                    <th class="px-6 py-4">{{ 'BUCKET_DETAIL.EVENTS.TABLE_EVENTS' | translate }}</th>
                    <th class="px-6 py-4">{{ 'BUCKET_DETAIL.EVENTS.TABLE_DESTINATION' | translate }}</th>
                    <th class="px-6 py-4 text-right">{{ 'BUCKET_DETAIL.EVENTS.TABLE_ACTIONS' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @if (eventsLoading()) {
                    <tr>
                      <td colspan="5" class="px-6 py-16 text-center">
                        <span class="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
                      </td>
                    </tr>
                  } @else if (eventsRowsFiltered().length === 0) {
                    <tr>
                      <td colspan="5" class="px-6 py-16 text-center text-sm" [class]="mutedClass">
                        {{ eventsFilter() ? ('BUCKET_DETAIL.EVENTS.TABLE_NO_RESULTS' | translate) : ('BUCKET_DETAIL.EVENTS.TABLE_EMPTY' | translate) }}
                      </td>
                    </tr>
                  } @else {
                    @for (row of eventsRowsFiltered(); track row.id) {
                      <tr [class]="eventsTableRowClass" (click)="toggleEventRow(row.id)">
                        <td class="px-6 py-4 text-center">
                          <span class="material-symbols-outlined text-[20px] transition-transform" [class]="mutedClass" [style.transform]="expandedEventId() === row.id ? 'rotate(90deg)' : 'rotate(0deg)'">keyboard_arrow_right</span>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex flex-col">
                            <span class="font-semibold text-sm" [class]="titleClass">{{ row.id }}</span>
                            <span class="text-xs font-mono mt-0.5" [class]="mutedClass">{{ row.destType }}</span>
                          </div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex flex-wrap gap-1.5">
                            @for (evt of row.eventTypes; track evt) {
                              <span [class]="getEventTypeBadgeClass(evt)">{{ evt }}</span>
                            }
                          </div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-2" [class]="mutedClass">
                            <span class="material-symbols-outlined text-[18px]">{{ getEventDestIcon(row.destType) }}</span>
                            <span class="truncate max-w-[220px] text-sm" [title]="row.destinationArn">{{ row.destinationArn }}</span>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-right" (click)="$event.stopPropagation()">
                          <button (click)="openEditEventModal(row)" class="p-1 rounded transition-colors mr-1" [class]="mutedClass + ' hover:text-primary'" [title]="'BUCKET_DETAIL.EVENTS.EDIT_CONFIG' | translate">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button (click)="deleteEvent(row)" [disabled]="eventsDeletingId() === row.id" class="p-1 rounded transition-colors text-red-400 hover:text-red-300 disabled:opacity-40" [title]="'BUCKET_DETAIL.EVENTS.DELETE_EVENT' | translate">
                            @if (eventsDeletingId() === row.id) {
                              <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            } @else {
                              <span class="material-symbols-outlined text-[18px]">delete</span>
                            }
                          </button>
                        </td>
                      </tr>
                      @if (expandedEventId() === row.id) {
                        <tr [class]="eventsExpandedRowClass">
                          <td colspan="5" class="px-6 py-5 pl-20">
                            <div class="flex gap-6">
                              <div class="flex-1 min-w-0">
                                <p class="text-xs uppercase font-bold mb-2 flex items-center gap-1" [class]="mutedClass">
                                  <span class="material-symbols-outlined text-[14px]">code</span>
                                  {{ 'BUCKET_DETAIL.EVENTS.CONFIG_JSON' | translate }}
                                </p>
                                <pre [class]="eventsCodeClass">{{ row.rawJson }}</pre>
                              </div>
                              <div class="w-52 flex flex-col gap-3 pt-5 shrink-0" (click)="$event.stopPropagation()">
                                <button (click)="openEditEventModal(row)" class="w-full py-2 px-4 rounded-lg border text-xs font-medium transition-colors flex items-center justify-between" [class]="ghostBtnClass">
                                  {{ 'BUCKET_DETAIL.EVENTS.EDIT_CONFIG' | translate }}
                                  <span class="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button (click)="deleteEvent(row)" [disabled]="eventsDeletingId() === row.id" class="w-full py-2 px-4 rounded-lg border border-red-900/40 text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs font-medium transition-colors flex items-center justify-between disabled:opacity-40">
                                  {{ 'BUCKET_DETAIL.EVENTS.DELETE_EVENT' | translate }}
                                  @if (eventsDeletingId() === row.id) {
                                    <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                  } @else {
                                    <span class="material-symbols-outlined text-[14px]">delete</span>
                                  }
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  }
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            @if (!eventsLoading() && eventsRowsFiltered().length > 0) {
              <div class="px-6 py-4 border-t flex items-center justify-between" [class]="borderClass">
                <p class="text-sm" [class]="mutedClass">
                  {{ 'BUCKET_DETAIL.EVENTS.SHOWING' | translate }}
                  <span class="font-medium" [class]="titleClass">{{ eventsRowsFiltered().length }}</span>
                  {{ 'BUCKET_DETAIL.EVENTS.OF' | translate }}
                  <span class="font-medium" [class]="titleClass">{{ eventsRows().length }}</span>
                  {{ 'BUCKET_DETAIL.EVENTS.EVENTS_COUNT' | translate }}
                </p>
              </div>
            }

          </div>

          <!-- Add/Edit Event Modal -->
          @if (showEventModal()) {
            <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 p-4" (click)="closeEventModal()">
              <div [class]="uploadModalClass" (click)="$event.stopPropagation()">

                <!-- Modal header -->
                <div class="px-6 py-4 border-b flex items-center justify-between shrink-0" [class]="borderClass">
                  <h2 class="text-base font-semibold" [class]="titleClass">
                    {{ (eventModalMode() === 'add' ? 'BUCKET_DETAIL.EVENTS.MODAL_ADD_TITLE' : 'BUCKET_DETAIL.EVENTS.MODAL_EDIT_TITLE') | translate }}
                  </h2>
                  <button (click)="closeEventModal()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <!-- Modal body -->
                <div class="px-6 py-5 overflow-y-auto flex-1 space-y-4">

                  <!-- Name / ID -->
                  <div>
                    <label class="block text-xs font-semibold mb-1.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_NAME' | translate }}</label>
                    <input type="text" [class]="eventModalInputClass" [value]="eventModalName()" (input)="eventModalName.set($any($event.target).value)" placeholder="my-event-rule" />
                  </div>

                  <!-- Destination Type -->
                  <div>
                    <label class="block text-xs font-semibold mb-1.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_DEST_TYPE' | translate }}</label>
                    <select [class]="securitySelectClass + ' w-full'" (change)="eventModalDestType.set($any($event.target).value)">
                      <option value="queue" [selected]="eventModalDestType() === 'queue'">{{ 'BUCKET_DETAIL.EVENTS.DEST_QUEUE' | translate }}</option>
                      <option value="topic" [selected]="eventModalDestType() === 'topic'">{{ 'BUCKET_DETAIL.EVENTS.DEST_TOPIC' | translate }}</option>
                      <option value="lambda" [selected]="eventModalDestType() === 'lambda'">{{ 'BUCKET_DETAIL.EVENTS.DEST_LAMBDA' | translate }}</option>
                    </select>
                  </div>

                  <!-- Destination ARN -->
                  <div>
                    <label class="block text-xs font-semibold mb-1.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_DEST_ARN' | translate }}</label>
                    <input type="text" [class]="eventModalInputClass" [value]="eventModalDestArn()" (input)="eventModalDestArn.set($any($event.target).value)" placeholder="arn:minio:sqs::..." />
                  </div>

                  <!-- Event Types -->
                  <div>
                    <label class="block text-xs font-semibold mb-2" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_EVENTS' | translate }}</label>
                    <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      @for (type of eventTypes; track type) {
                        <label class="flex items-center gap-2.5 text-xs cursor-pointer py-0.5">
                          <input type="checkbox" class="rounded border-border-dark text-primary focus:ring-primary" [checked]="isEventTypeSelected(type)" (change)="toggleEventType(type)" />
                          <span class="font-mono" [class]="titleClass">{{ type }}</span>
                        </label>
                      }
                    </div>
                  </div>

                  <!-- Filters -->
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold mb-1.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_PREFIX' | translate }}</label>
                      <input type="text" [class]="eventModalInputClass" [value]="eventModalPrefix()" (input)="eventModalPrefix.set($any($event.target).value)" placeholder="logs/" />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold mb-1.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.EVENTS.MODAL_SUFFIX' | translate }}</label>
                      <input type="text" [class]="eventModalInputClass" [value]="eventModalSuffix()" (input)="eventModalSuffix.set($any($event.target).value)" placeholder=".log" />
                    </div>
                  </div>

                </div>

                <!-- Modal footer -->
                <div class="px-6 py-4 border-t flex justify-end gap-3 shrink-0" [class]="borderClass">
                  <button (click)="closeEventModal()" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors" [class]="ghostBtnClass">
                    {{ 'BUCKET_DETAIL.EVENTS.MODAL_CANCEL' | translate }}
                  </button>
                  <button
                    (click)="saveEvent()"
                    [disabled]="eventModalSaving() || !eventModalDestArn().trim() || eventModalEventTypes().length === 0"
                    class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    @if (eventModalSaving()) {
                      <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    }
                    {{ 'BUCKET_DETAIL.EVENTS.MODAL_SAVE' | translate }}
                  </button>
                </div>

              </div>
            </div>
          }

          </div>
        }

        <!-- ── Other tabs placeholder ─────────────────────────── -->
        @if (activeTab() !== 'objects' && activeTab() !== 'management' && activeTab() !== 'security' && activeTab() !== 'events') {
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <span class="material-symbols-outlined text-[48px] mb-3 block" [class]="mutedClass">construction</span>
              <p class="text-sm" [class]="mutedClass">{{ 'BUCKET_DETAIL.COMING_SOON' | translate }}</p>
            </div>
          </div>
        }

      </div>

      <!-- ── Right Detail Drawer ────────────────────────────────── -->
      @if (selectedObject()) {
        <aside class="w-80 shrink-0 flex flex-col border-l sticky top-0 max-h-screen" [class]="drawerClass">

          <!-- Drawer header -->
          <div class="px-5 py-4 border-b flex items-center justify-between shrink-0" [class]="borderClass">
            <span class="text-xs font-semibold uppercase tracking-wider" [class]="mutedClass">
              {{ 'BUCKET_DETAIL.DRAWER.TITLE' | translate }}
            </span>
            <button (click)="closeDrawer()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Drawer scrollable content -->
          <div class="flex-1 overflow-y-auto p-5">

            <!-- Icon + Name -->
            <div class="flex flex-col items-center mb-6">
              <div class="w-16 h-16 rounded-xl flex items-center justify-center mb-3 border" [class]="drawerIconWrapClass(selectedObject()!.key)">
                <span class="material-symbols-outlined text-[32px]" [class]="fileIconColor(selectedObject()!.key)">
                  {{ fileIcon(selectedObject()!.key) }}
                </span>
              </div>
              <h3 class="font-semibold text-center leading-snug break-all text-sm" [class]="titleClass">
                {{ fileName(selectedObject()!.key) }}
              </h3>
              <p class="text-xs mt-1" [class]="mutedClass">{{ formatSize(selectedObject()!.size) }}</p>
            </div>

            <!-- Action buttons -->
            <div class="grid grid-cols-3 gap-2 mb-6">
              <button [class]="drawerActionClass" (click)="downloadSelected()" [disabled]="drawerDownloading()">
                <span class="material-symbols-outlined text-[20px]" [class]="drawerDownloading() ? 'animate-spin' : ''">
                  {{ drawerDownloading() ? 'progress_activity' : 'download' }}
                </span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.DOWNLOAD' | translate }}</span>
              </button>
              <button [class]="drawerActionClass" (click)="copyKey()">
                <span class="material-symbols-outlined text-[20px]">content_copy</span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.COPY_KEY' | translate }}</span>
              </button>
              <button [class]="drawerActionClass" (click)="openVersionsModal()">
                <span class="material-symbols-outlined text-[20px]">history</span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.VERSIONS' | translate }}</span>
              </button>
              <button [class]="drawerActionDeleteClass" (click)="showDeleteConfirm.set(true)" [disabled]="drawerDeleting()">
                <span class="material-symbols-outlined text-[20px]">delete</span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.DELETE' | translate }}</span>
              </button>
              <button [class]="drawerActionClass" (click)="openMoveModal()">
                <span class="material-symbols-outlined text-[20px]">move_up</span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.MOVE' | translate }}</span>
              </button>
              <button [class]="drawerActionClass" (click)="openCopyModal()">
                <span class="material-symbols-outlined text-[20px]">file_copy</span>
                <span class="text-[10px] mt-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.COPY' | translate }}</span>
              </button>
            </div>

            <!-- Properties -->
            @if (drawerLoading()) {
              <div class="space-y-3">
                @for (i of [1,2,3]; track i) {
                  <div class="h-8 rounded animate-pulse" [class]="skeletonClass"></div>
                }
              </div>
            } @else {
              <div class="space-y-4 mb-6">
                <h4 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                  {{ 'BUCKET_DETAIL.DRAWER.PROPERTIES' | translate }}
                </h4>

                <div>
                  <p class="text-[10px] font-medium mb-1" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.LAST_MODIFIED' | translate }}</p>
                  <p class="text-sm font-mono" [class]="subtleClass">{{ formatDateFull(selectedObject()!.last_modified) }}</p>
                </div>

                <div>
                  <p class="text-[10px] font-medium mb-1" [class]="mutedClass">ETag</p>
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-mono truncate flex-1" [class]="subtleClass" [title]="selectedObject()!.etag">
                      {{ selectedObject()!.etag.slice(0, 16) }}…
                    </p>
                    <button (click)="copyToClipboard(selectedObject()!.etag)" class="transition-colors" [class]="mutedClass">
                      <span class="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>

                @if (drawerMetadata()) {
                  @if (drawerMetadata()!.content_type) {
                    <div>
                      <p class="text-[10px] font-medium mb-1" [class]="mutedClass">Content-Type</p>
                      <p class="text-sm font-mono" [class]="subtleClass">{{ drawerMetadata()!.content_type }}</p>
                    </div>
                  }
                }

                <div>
                  <p class="text-[10px] font-medium mb-1" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.STORAGE_CLASS' | translate }}</p>
                  <p class="text-sm" [class]="subtleClass">{{ selectedObject()!.storage_class || 'STANDARD' }}</p>
                </div>
              </div>

              <!-- Custom Metadata -->
              <div class="space-y-3 pt-4 border-t" [class]="borderClass">
                <div class="flex items-center justify-between">
                  <h4 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                    {{ 'BUCKET_DETAIL.DRAWER.METADATA' | translate }}
                    @if ((drawerMetadata()?.metadata | keyvalue)?.length && !drawerMetadataEditing()) {
                      <span class="ml-1 px-1 rounded text-[9px]" [class]="tagBadgeClass">{{ (drawerMetadata()!.metadata | keyvalue)!.length }}</span>
                    }
                  </h4>
                  @if (!drawerMetadataEditing()) {
                    <button
                      (click)="startEditMetadata()"
                      class="text-[10px] font-medium transition-colors hover:text-primary flex items-center gap-0.5"
                      [class]="mutedClass"
                    >
                      <span class="material-symbols-outlined text-[12px]">edit</span>
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_EDIT' | translate }}
                    </button>
                  }
                </div>

                @if (drawerMetadataEditing()) {
                  <!-- Edit mode -->
                  <div class="space-y-2">
                    @for (row of drawerMetadataLocal(); track $index; let i = $index) {
                      <div class="flex gap-1 items-center">
                        <input
                          type="text"
                          [value]="row.key"
                          (input)="updateMetadataRow(i, 'key', $any($event.target).value)"
                          [placeholder]="'BUCKET_DETAIL.DRAWER.TAG_KEY_PLACEHOLDER' | translate"
                          class="flex-1 min-w-0 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                          [class]="keyInputClass"
                        />
                        <input
                          type="text"
                          [value]="row.value"
                          (input)="updateMetadataRow(i, 'value', $any($event.target).value)"
                          [placeholder]="'BUCKET_DETAIL.DRAWER.TAG_VALUE_PLACEHOLDER' | translate"
                          class="flex-1 min-w-0 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                          [class]="keyInputClass"
                        />
                        <button
                          (click)="removeMetadataRow(i)"
                          class="shrink-0 p-1 rounded transition-colors text-red-400 hover:text-red-300"
                        >
                          <span class="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    }
                    <button
                      (click)="addMetadataRow()"
                      class="text-[10px] font-medium flex items-center gap-1 transition-colors hover:text-primary"
                      [class]="mutedClass"
                    >
                      <span class="material-symbols-outlined text-[12px]">add</span>
                      {{ 'BUCKET_DETAIL.DRAWER.METADATA_ADD' | translate }}
                    </button>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button
                      (click)="saveMetadata()"
                      [disabled]="drawerMetadataSaving()"
                      class="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (drawerMetadataSaving()) {
                        <span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_SAVE' | translate }}
                    </button>
                    <button
                      (click)="cancelEditMetadata()"
                      [disabled]="drawerMetadataSaving()"
                      class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      [class]="ghostBtnClass"
                    >
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_CANCEL' | translate }}
                    </button>
                  </div>
                } @else {
                  <!-- View mode -->
                  @if (drawerMetadata()?.metadata && (drawerMetadata()!.metadata | keyvalue)!.length > 0) {
                    <div class="space-y-1">
                      @for (entry of drawerMetadata()!.metadata | keyvalue; track entry.key) {
                        <div class="flex gap-2 items-start">
                          <span class="text-[10px] font-mono font-medium shrink-0" [class]="subtleClass">{{ entry.key }}</span>
                          <span class="text-[10px] font-mono break-all" [class]="mutedClass">{{ entry.value }}</span>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="text-xs" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.METADATA_EMPTY' | translate }}</p>
                  }
                }
              </div>

              <!-- Tags -->
              <div class="space-y-3 pt-4 border-t" [class]="borderClass">
                <div class="flex items-center justify-between">
                  <h4 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                    {{ 'BUCKET_DETAIL.DRAWER.TAGS' | translate }}
                    @if (drawerTagList().length > 0 && !drawerTagsEditing()) {
                      <span class="ml-1 px-1 rounded text-[9px]" [class]="tagBadgeClass">{{ drawerTagList().length }}</span>
                    }
                  </h4>
                  @if (!drawerTagsEditing()) {
                    <button
                      (click)="startEditTags()"
                      class="text-[10px] font-medium transition-colors hover:text-primary flex items-center gap-0.5"
                      [class]="mutedClass"
                    >
                      <span class="material-symbols-outlined text-[12px]">edit</span>
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_EDIT' | translate }}
                    </button>
                  }
                </div>

                @if (drawerTagsEditing()) {
                  <!-- Edit mode -->
                  <div class="space-y-2">
                    @for (row of drawerTagsLocal(); track $index; let i = $index) {
                      <div class="flex gap-1 items-center">
                        <input
                          type="text"
                          [value]="row.key"
                          (input)="updateTagRow(i, 'key', $any($event.target).value)"
                          [placeholder]="'BUCKET_DETAIL.DRAWER.TAG_KEY_PLACEHOLDER' | translate"
                          class="flex-1 min-w-0 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                          [class]="keyInputClass"
                        />
                        <input
                          type="text"
                          [value]="row.value"
                          (input)="updateTagRow(i, 'value', $any($event.target).value)"
                          [placeholder]="'BUCKET_DETAIL.DRAWER.TAG_VALUE_PLACEHOLDER' | translate"
                          class="flex-1 min-w-0 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                          [class]="keyInputClass"
                        />
                        <button
                          (click)="removeTagRow(i)"
                          class="shrink-0 p-1 rounded transition-colors text-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <span class="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    }
                    <button
                      (click)="addTagRow()"
                      class="text-[10px] font-medium flex items-center gap-1 transition-colors hover:text-primary"
                      [class]="mutedClass"
                    >
                      <span class="material-symbols-outlined text-[12px]">add</span>
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_ADD' | translate }}
                    </button>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button
                      (click)="saveTags()"
                      [disabled]="drawerTagsSaving()"
                      class="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      @if (drawerTagsSaving()) {
                        <span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                      }
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_SAVE' | translate }}
                    </button>
                    <button
                      (click)="cancelEditTags()"
                      [disabled]="drawerTagsSaving()"
                      class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      [class]="ghostBtnClass"
                    >
                      {{ 'BUCKET_DETAIL.DRAWER.TAGS_CANCEL' | translate }}
                    </button>
                  </div>
                } @else {
                  <!-- View mode -->
                  @if (drawerTagList().length > 0) {
                    <div class="flex flex-wrap gap-2">
                      @for (tag of drawerTagList(); track tag.key) {
                        <span [class]="tagBadgeClass">{{ tag.key }}: {{ tag.value }}</span>
                      }
                    </div>
                  } @else {
                    <p class="text-xs" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.TAGS_EMPTY' | translate }}</p>
                  }
                }
              </div>

              <!-- Object URL -->
              <div class="mt-6 pt-4 border-t" [class]="borderClass">
                <p class="text-[10px] font-medium mb-2" [class]="mutedClass">{{ 'BUCKET_DETAIL.DRAWER.OBJECT_KEY' | translate }}</p>
                <div class="flex gap-2">
                  <input
                    readonly
                    [value]="selectedObject()!.key"
                    class="flex-1 rounded px-2 py-1 text-xs font-mono truncate focus:outline-none focus:border-primary"
                    [class]="keyInputClass"
                    type="text"
                  />
                  <button (click)="copyToClipboard(selectedObject()!.key)" class="p-1 rounded border transition-colors" [class]="copyKeyBtnClass">
                    <span class="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </aside>
      }

    </div>

    <!-- Upload Modal -->
    @if (showUploadModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div [class]="uploadModalClass">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <div class="min-w-0 mr-4">
              <h3 class="text-lg font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.UPLOAD.TITLE' | translate }}</h3>
              <p class="mt-1 text-sm flex items-baseline gap-1 min-w-0" [class]="mutedClass">
                <span class="shrink-0">{{ 'BUCKET_DETAIL.UPLOAD.SUBTITLE' | translate }}</span>
                <span
                  class="font-mono truncate"
                  [class]="subtleClass"
                  [title]="bucketName() + '/' + currentPrefix()"
                >{{ bucketName() }}/{{ currentPrefix() }}</span>
              </p>
            </div>
            <button (click)="closeUploadModal()" class="p-1 rounded transition-colors shrink-0" [class]="closeButtonClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Modal body -->
          <div class="px-6 py-6 overflow-y-auto flex-1">

            <!-- Intermediate path input -->
            <div class="mb-5">
              <label class="block text-xs font-semibold uppercase tracking-wider mb-2" [class]="mutedClass">
                {{ 'BUCKET_DETAIL.UPLOAD.INTERMEDIATE_LABEL' | translate }}
              </label>
              <div class="flex items-center rounded-lg border overflow-hidden" [class]="intermediateInputWrapClass">
                <span class="px-3 py-2 text-xs font-mono border-r truncate max-w-[40%] shrink-0" [class]="intermediatePathPrefixClass" [title]="currentPrefix() || '/'">
                  {{ currentPrefix() || '/' }}
                </span>
                <input
                  type="text"
                  [placeholder]="'BUCKET_DETAIL.UPLOAD.INTERMEDIATE_PLACEHOLDER' | translate"
                  (input)="uploadIntermediatePath.set($any($event.target).value)"
                  [value]="uploadIntermediatePath()"
                  class="flex-1 min-w-0 bg-transparent outline-none text-sm font-mono px-3 py-2"
                  [class]="subtleClass"
                />
              </div>
              @if (normalizedIntermediate()) {
                <p class="mt-1.5 text-xs font-mono" [class]="mutedClass">
                  → {{ bucketName() }}/{{ currentPrefix() }}{{ normalizedIntermediate() }}&lt;filename&gt;
                </p>
              }
            </div>

            <!-- Drop zone -->
            <div
              [class]="dropZoneClass"
              (dragover)="$event.preventDefault(); dragOver.set(true)"
              (dragleave)="dragOver.set(false)"
              (drop)="onDrop($event)"
            >
              <div class="p-3 bg-primary/10 rounded-full mb-3 text-primary">
                <span class="material-symbols-outlined text-3xl">cloud_upload</span>
              </div>
              <h4 class="text-sm font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.UPLOAD.DROP_TITLE' | translate }}</h4>
              <p class="text-xs mt-1" [class]="mutedClass">{{ 'BUCKET_DETAIL.UPLOAD.DROP_SUBTITLE' | translate }}</p>
              <div class="flex gap-3 mt-4">
                <button
                  (click)="triggerDropZone()"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  [class]="ghostBtnClass"
                >
                  <span class="material-symbols-outlined text-[15px]">file_copy</span>
                  {{ 'BUCKET_DETAIL.UPLOAD.ADD_FILES' | translate }}
                </button>
                <button
                  (click)="triggerDropZoneFolder()"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  [class]="ghostBtnClass"
                >
                  <span class="material-symbols-outlined text-[15px]">folder_open</span>
                  {{ 'BUCKET_DETAIL.UPLOAD.ADD_FOLDER' | translate }}
                </button>
              </div>
              <input #dropZoneInput type="file" multiple class="hidden" (change)="onDropZoneFileSelected($any($event.target))" />
              <input #dropZoneFolderInput type="file" webkitdirectory class="hidden" (change)="onDropZoneFolderSelected($any($event.target))" />
            </div>

            <!-- Queue -->
            @if (uploadQueue().length > 0) {
              <div class="space-y-3">
                <h4 class="text-xs font-semibold uppercase tracking-wider mb-3" [class]="mutedClass">
                  {{ 'BUCKET_DETAIL.UPLOAD.QUEUE_LABEL' | translate: { count: uploadQueue().length } }}
                </h4>

                @for (item of uploadQueue(); track item.id) {
                  <div [class]="queueItemClass">
                    <div class="flex items-center gap-3 mb-2">

                      <!-- File type icon -->
                      <div class="size-10 rounded flex items-center justify-center shrink-0" [class]="queueItemIconClass(item.file.name)">
                        <span class="material-symbols-outlined text-[20px]">{{ fileIcon(item.file.name) }}</span>
                      </div>

                      <!-- File info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-0.5">
                          <p class="text-sm font-medium truncate" [class]="titleClass">{{ item.relativePath }}</p>
                          @switch (item.status) {
                            @case ('done') {
                              <span class="text-xs font-medium text-green-500 flex items-center gap-1 shrink-0 ml-2">
                                <span class="material-symbols-outlined text-[14px]">check_circle</span>
                                {{ 'BUCKET_DETAIL.UPLOAD.STATUS_DONE' | translate }}
                              </span>
                            }
                            @case ('uploading') {
                              <span class="text-xs font-medium text-primary flex items-center gap-1.5 shrink-0 ml-2">
                                <span class="animate-pulse w-1.5 h-1.5 rounded-full bg-primary"></span>
                                {{ 'BUCKET_DETAIL.UPLOAD.STATUS_UPLOADING' | translate }}
                              </span>
                            }
                            @case ('error') {
                              <span class="text-xs font-medium text-red-400 flex items-center gap-1 shrink-0 ml-2">
                                <span class="material-symbols-outlined text-[14px]">error</span>
                                {{ 'BUCKET_DETAIL.UPLOAD.STATUS_ERROR' | translate }}
                              </span>
                            }
                            @case ('pending') {
                              <span class="text-xs shrink-0 ml-2" [class]="mutedClass">
                                {{ 'BUCKET_DETAIL.UPLOAD.STATUS_PENDING' | translate }}
                              </span>
                            }
                          }
                        </div>
                        <div class="flex items-center justify-between text-xs" [class]="mutedClass">
                          <span>{{ formatSize(item.file.size) }}</span>
                          <span>{{ item.progress }}%</span>
                        </div>
                      </div>

                      <!-- Remove button -->
                      @if (item.status !== 'uploading') {
                        <button
                          (click)="removeFromQueue(item.id)"
                          class="transition-colors shrink-0"
                          [class]="mutedClass + ' hover:text-red-400'"
                        >
                          <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      }
                    </div>

                    <!-- Progress bar -->
                    <div class="h-1.5 w-full rounded-full overflow-hidden" [class]="progressTrackClass">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        [class]="item.status === 'done' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-400' : 'bg-primary'"
                        [style.width.%]="item.progress"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Modal footer -->
          <div class="px-6 py-4 flex items-center justify-between border-t shrink-0" [class]="borderClass">
            <button
              (click)="cancelAll()"
              class="text-sm font-medium transition-colors"
              [class]="mutedClass + ' hover:text-red-400'"
            >
              {{ 'BUCKET_DETAIL.UPLOAD.CANCEL_ALL' | translate }}
            </button>
            <div class="flex gap-3">
              <button
                (click)="closeUploadModal()"
                [disabled]="isUploading()"
                [class]="ghostBtnClass + ' disabled:opacity-40 disabled:cursor-not-allowed'"
              >
                {{ 'BUCKET_DETAIL.UPLOAD.CLOSE' | translate }}
              </button>
              <button
                (click)="startUpload()"
                [disabled]="!hasPending() || isUploading()"
                class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span class="material-symbols-outlined text-[18px]">upload</span>
                {{ 'BUCKET_DETAIL.UPLOAD.START' | translate }}
              </button>
            </div>
          </div>

        </div>
      </div>
    }

    <!-- Versions Modal -->
    @if (showVersionsModal() && selectedObject()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" (click)="closeVersionsModal()">
        <div [class]="uploadModalClass" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <div>
              <h3 class="text-base font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.VERSIONS_MODAL.TITLE' | translate }}</h3>
              <p class="mt-0.5 text-xs font-mono truncate max-w-xs" [class]="mutedClass">{{ selectedObject()!.key }}</p>
            </div>
            <button (click)="closeVersionsModal()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            @if (versionsModalLoading()) {
              <div class="space-y-3">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="h-14 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                }
              </div>
            } @else if (versionsModalList().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 gap-3">
                <span class="material-symbols-outlined text-[40px]" [class]="mutedClass">history</span>
                <p class="text-sm" [class]="mutedClass">{{ 'BUCKET_DETAIL.VERSIONS_MODAL.EMPTY' | translate }}</p>
              </div>
            } @else {
              <div class="space-y-2">
                @for (ver of versionsModalPaged(); track ver.version_id) {
                  @if (versionsModalConfirmDeleteId() === ver.version_id) {
                    <!-- Inline delete confirm -->
                    <div class="rounded-lg border border-red-900/40 bg-red-900/10 p-3 space-y-3">
                      <p class="text-sm text-red-400">{{ 'BUCKET_DETAIL.DRAWER.VERSION_CONFIRM_DELETE' | translate }}</p>
                      <div class="flex gap-2">
                        <button
                          (click)="deleteVersion(ver.version_id)"
                          [disabled]="versionsModalDeletingId() === ver.version_id"
                          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-900/40 hover:border-red-700 transition-colors disabled:opacity-40"
                        >
                          @if (versionsModalDeletingId() === ver.version_id) {
                            <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          } @else {
                            <span class="material-symbols-outlined text-[14px]">delete_forever</span>
                          }
                          {{ 'BUCKET_DETAIL.DRAWER.VERSION_CONFIRM_YES' | translate }}
                        </button>
                        <button
                          (click)="versionsModalConfirmDeleteId.set(null)"
                          class="flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
                          [class]="ghostBtnClass"
                        >
                          {{ 'BUCKET_DETAIL.DRAWER.VERSION_CONFIRM_NO' | translate }}
                        </button>
                      </div>
                    </div>
                  } @else {
                    <!-- Version row -->
                    <div class="rounded-lg border p-3" [class]="borderClass">
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2 min-w-0">
                          @if (ver.is_latest) {
                            <span class="inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-400/10 text-green-400 ring-1 ring-inset ring-green-400/20">
                              {{ 'BUCKET_DETAIL.DRAWER.VERSION_LATEST' | translate }}
                            </span>
                          }
                          <button
                            (click)="copyToClipboard(ver.version_id)"
                            class="font-mono text-xs truncate transition-colors hover:text-primary text-left min-w-0"
                            [class]="subtleClass"
                            [title]="ver.version_id"
                          >{{ ver.version_id }}</button>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            (click)="restoreVersion(ver.version_id)"
                            [disabled]="!!versionsModalRestoringId() || !!versionsModalDeletingId() || ver.is_latest"
                            class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            [class]="ghostBtnClass"
                          >
                            @if (versionsModalRestoringId() === ver.version_id) {
                              <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            } @else {
                              <span class="material-symbols-outlined text-[14px]">restore</span>
                            }
                            {{ 'BUCKET_DETAIL.DRAWER.VERSION_RESTORE' | translate }}
                          </button>
                          <button
                            (click)="versionsModalConfirmDeleteId.set(ver.version_id)"
                            [disabled]="!!versionsModalDeletingId() || !!versionsModalRestoringId()"
                            class="p-1.5 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-40"
                            [title]="'BUCKET_DETAIL.DRAWER.VERSION_DELETE' | translate"
                          >
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                      <div class="flex items-center gap-4 mt-1.5">
                        <span class="text-xs" [class]="mutedClass">{{ formatDateFull(ver.last_modified) }}</span>
                        <span class="text-xs" [class]="mutedClass">{{ formatSize(ver.size) }}</span>
                      </div>
                    </div>
                  }
                }
              </div>
            }
          </div>

          <!-- Footer: pagination -->
          @if (versionsModalTotalPages() > 1) {
            <div class="px-6 py-3 border-t flex items-center justify-between shrink-0" [class]="borderClass">
              <button
                (click)="versionsModalPage.set(versionsModalPage() - 1)"
                [disabled]="versionsModalPage() === 0"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-30"
                [class]="ghostBtnClass"
              >
                <span class="material-symbols-outlined text-[16px]">chevron_left</span>
                {{ 'BUCKET_DETAIL.VERSIONS_MODAL.PREV' | translate }}
              </button>
              <span class="text-sm" [class]="mutedClass">
                {{ versionsModalPage() + 1 }} / {{ versionsModalTotalPages() }}
              </span>
              <button
                (click)="versionsModalPage.set(versionsModalPage() + 1)"
                [disabled]="versionsModalPage() === versionsModalTotalPages() - 1"
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-30"
                [class]="ghostBtnClass"
              >
                {{ 'BUCKET_DETAIL.VERSIONS_MODAL.NEXT' | translate }}
                <span class="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          }

        </div>
      </div>
    }

    <!-- Delete Object Confirmation Dialog -->
    @if (showDeleteConfirm() && selectedObject()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div [class]="dialogClass">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-red-400 text-[20px]">warning</span>
            </div>
            <div>
              <h3 class="text-base font-semibold mb-1" [class]="titleClass">{{ 'BUCKET_DETAIL.DELETE_DIALOG.TITLE' | translate }}</h3>
              <p class="text-sm" [class]="mutedClass">
                {{ 'BUCKET_DETAIL.DELETE_DIALOG.MESSAGE' | translate: { name: fileName(selectedObject()!.key) } }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="showDeleteConfirm.set(false)" [class]="ghostBtnClass">
              {{ 'BUCKET_DETAIL.DELETE_DIALOG.CANCEL' | translate }}
            </button>
            <button (click)="confirmDelete()" [disabled]="drawerDeleting()" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50">
              @if (drawerDeleting()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'BUCKET_DETAIL.DELETE_DIALOG.CONFIRM' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Copy Object Modal -->
    @if (showCopyModal() && selectedObject()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div [class]="uploadModalClass">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <div class="flex items-center gap-3">
              <div class="bg-primary/10 text-primary p-2 rounded-lg">
                <span class="material-symbols-outlined text-xl">file_copy</span>
              </div>
              <h3 class="text-lg font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.COPY_DIALOG.TITLE' | translate }}</h3>
            </div>
            <button (click)="closeCopyModal()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 overflow-y-auto flex-1">

            <!-- Source object info -->
            <div class="mb-6 flex items-center p-3 rounded-lg border" [class]="intermediateInputWrapClass">
              <div class="mr-3 shrink-0" [class]="mutedClass">
                <span class="material-symbols-outlined text-[24px]">{{ fileIcon(selectedObject()!.key) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium uppercase tracking-wider mb-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.COPY_DIALOG.SOURCE' | translate }}</p>
                <p class="text-sm font-semibold truncate" [class]="titleClass">{{ selectedObject()!.key }}</p>
              </div>
            </div>

            <!-- Destination bucket -->
            <div class="space-y-2 mb-5">
              <label class="block text-sm font-medium" [class]="titleClass" for="copy-dest-bucket">
                {{ 'BUCKET_DETAIL.COPY_DIALOG.DEST_BUCKET' | translate }}
              </label>
              <div class="relative">
                <select
                  id="copy-dest-bucket"
                  [class]="moveSelectClass"
                  [value]="copyDestBucket()"
                  (change)="copyDestBucket.set($any($event.target).value)"
                >
                  @for (b of copyBuckets(); track b.name) {
                    <option [value]="b.name" [selected]="b.name === copyDestBucket()">{{ b.name }}</option>
                  }
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2" [class]="mutedClass">
                  <span class="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>
            </div>

            <!-- Destination path -->
            <div class="space-y-2">
              <label class="block text-sm font-medium" [class]="titleClass" for="copy-dest-path">
                {{ 'BUCKET_DETAIL.COPY_DIALOG.DEST_PATH' | translate }}
              </label>
              <div class="flex items-center rounded-lg border overflow-hidden" [class]="intermediateInputWrapClass">
                <span class="px-3 py-2 text-xs font-mono shrink-0 border-r" [class]="intermediatePathPrefixClass">/</span>
                <input
                  id="copy-dest-path"
                  type="text"
                  [placeholder]="'BUCKET_DETAIL.COPY_DIALOG.DEST_PATH_PLACEHOLDER' | translate"
                  [value]="copyDestPath()"
                  (input)="copyDestPath.set($any($event.target).value)"
                  class="flex-1 bg-transparent outline-none text-sm font-mono px-3 py-2"
                  [class]="subtleClass"
                />
              </div>
              <p class="text-xs font-mono" [class]="mutedClass">→ {{ copyDestBucket() }}/{{ copyDestKey() }}</p>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 flex items-center justify-end gap-3 border-t shrink-0" [class]="borderClass">
            <button (click)="closeCopyModal()" [class]="ghostBtnClass" [disabled]="copyLoading()">
              {{ 'BUCKET_DETAIL.COPY_DIALOG.CANCEL' | translate }}
            </button>
            <button
              (click)="confirmCopy()"
              [disabled]="copyLoading() || !copyDestBucket()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (copyLoading()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              } @else {
                <span class="material-symbols-outlined text-[18px]">file_copy</span>
              }
              {{ 'BUCKET_DETAIL.COPY_DIALOG.CONFIRM' | translate }}
            </button>
          </div>

        </div>
      </div>
    }

    <!-- Move Object Modal -->
    @if (showMoveModal() && selectedObject()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div [class]="uploadModalClass">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <div class="flex items-center gap-3">
              <div class="bg-primary/10 text-primary p-2 rounded-lg">
                <span class="material-symbols-outlined text-xl">move_up</span>
              </div>
              <h3 class="text-lg font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.MOVE_DIALOG.TITLE' | translate }}</h3>
            </div>
            <button (click)="closeMoveModal()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 overflow-y-auto flex-1">

            <!-- Source object info -->
            <div class="mb-6 flex items-center p-3 rounded-lg border" [class]="intermediateInputWrapClass">
              <div class="mr-3 shrink-0" [class]="mutedClass">
                <span class="material-symbols-outlined text-[24px]">{{ fileIcon(selectedObject()!.key) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium uppercase tracking-wider mb-0.5" [class]="mutedClass">{{ 'BUCKET_DETAIL.MOVE_DIALOG.SOURCE' | translate }}</p>
                <p class="text-sm font-semibold truncate" [class]="titleClass">{{ selectedObject()!.key }}</p>
              </div>
            </div>

            <!-- Destination bucket -->
            <div class="space-y-2 mb-5">
              <label class="block text-sm font-medium" [class]="titleClass" for="move-dest-bucket">
                {{ 'BUCKET_DETAIL.MOVE_DIALOG.DEST_BUCKET' | translate }}
              </label>
              <div class="relative">
                <select
                  id="move-dest-bucket"
                  [class]="moveSelectClass"
                  [value]="moveDestBucket()"
                  (change)="moveDestBucket.set($any($event.target).value)"
                >
                  @for (b of moveBuckets(); track b.name) {
                    <option [value]="b.name" [selected]="b.name === moveDestBucket()">{{ b.name }}</option>
                  }
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2" [class]="mutedClass">
                  <span class="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>
            </div>

            <!-- Destination path -->
            <div class="space-y-2 mb-6">
              <label class="block text-sm font-medium" [class]="titleClass" for="move-dest-path">
                {{ 'BUCKET_DETAIL.MOVE_DIALOG.DEST_PATH' | translate }}
              </label>
              <div class="flex items-center rounded-lg border overflow-hidden" [class]="intermediateInputWrapClass">
                <span class="px-3 py-2 text-xs font-mono shrink-0 border-r" [class]="intermediatePathPrefixClass">/</span>
                <input
                  id="move-dest-path"
                  type="text"
                  [placeholder]="'BUCKET_DETAIL.MOVE_DIALOG.DEST_PATH_PLACEHOLDER' | translate"
                  [value]="moveDestPath()"
                  (input)="moveDestPath.set($any($event.target).value)"
                  class="flex-1 bg-transparent outline-none text-sm font-mono px-3 py-2"
                  [class]="subtleClass"
                />
              </div>
              <p class="text-xs font-mono" [class]="mutedClass">→ {{ moveDestBucket() }}/{{ moveDestKey() }}</p>
            </div>

            <!-- Warning -->
            <div class="rounded-lg p-4 border bg-amber-500/10 border-amber-500/20">
              <div class="flex gap-3">
                <span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0">warning</span>
                <div>
                  <h4 class="text-sm font-medium text-amber-400 mb-1">{{ 'BUCKET_DETAIL.MOVE_DIALOG.WARNING_TITLE' | translate }}</h4>
                  <p class="text-sm text-amber-300/80">{{ 'BUCKET_DETAIL.MOVE_DIALOG.WARNING_BODY' | translate }}</p>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 flex items-center justify-end gap-3 border-t shrink-0" [class]="borderClass">
            <button (click)="closeMoveModal()" [class]="ghostBtnClass" [disabled]="moveLoading()">
              {{ 'BUCKET_DETAIL.MOVE_DIALOG.CANCEL' | translate }}
            </button>
            <button
              (click)="confirmMove()"
              [disabled]="moveLoading() || !moveDestBucket()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (moveLoading()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              } @else {
                <span class="material-symbols-outlined text-[18px]">move_up</span>
              }
              {{ 'BUCKET_DETAIL.MOVE_DIALOG.CONFIRM' | translate }}
            </button>
          </div>

        </div>
      </div>
    }
  `,
})
export class BucketDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  private toast = inject(ToastService);
  readonly userService = inject(UserService);

  readonly dropZoneInput = viewChild<ElementRef<HTMLInputElement>>('dropZoneInput');
  readonly dropZoneFolderInput = viewChild<ElementRef<HTMLInputElement>>('dropZoneFolderInput');

  readonly tabs = TABS;

  readonly bucketName = signal('');
  readonly bucketCreated = signal<string | null>(null);
  readonly currentPrefix = signal('');
  readonly objects = signal<ObjectItemResponse[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly activeTab = signal<Tab>('objects');
  readonly usage = signal<{ objects: number; size_bytes: number } | null>(null);
  readonly isTruncated = signal(false);
  readonly nextToken = signal<string | null>(null);

  // Upload modal
  readonly showUploadModal = signal(false);
  readonly uploadIntermediatePath = signal('');
  readonly uploadQueue = signal<UploadQueueItem[]>([]);
  readonly dragOver = signal(false);

  readonly normalizedIntermediate = computed(() => {
    let mid = this.uploadIntermediatePath().trim().replace(/^\/+/, '');
    if (mid && !mid.endsWith('/')) mid += '/';
    return mid;
  });
  readonly isUploading = computed(() => this.uploadQueue().some(i => i.status === 'uploading'));
  readonly hasPending = computed(() => this.uploadQueue().some(i => i.status === 'pending'));

  readonly selectedObject = signal<ObjectItemResponse | null>(null);
  readonly drawerMetadata = signal<ObjectMetadataResponse | null>(null);
  readonly drawerTags = signal<Record<string, string>>({});
  readonly drawerLoading = signal(false);
  readonly drawerDownloading = signal(false);
  readonly drawerDeleting = signal(false);
  readonly showDeleteConfirm = signal(false);

  // Metadata editing
  readonly drawerMetadataEditing = signal(false);
  readonly drawerMetadataLocal = signal<{ key: string; value: string }[]>([]);
  readonly drawerMetadataSaving = signal(false);

  // Tags editing
  readonly drawerTagsEditing = signal(false);
  readonly drawerTagsLocal = signal<{ key: string; value: string }[]>([]);
  readonly drawerTagsSaving = signal(false);

  // Versions modal
  readonly showVersionsModal = signal(false);
  readonly versionsModalLoading = signal(false);
  readonly versionsModalList = signal<ObjectVersionItemResponse[]>([]);
  readonly versionsModalDeletingId = signal<string | null>(null);
  readonly versionsModalRestoringId = signal<string | null>(null);
  readonly versionsModalConfirmDeleteId = signal<string | null>(null);
  readonly versionsModalPage = signal(0);
  private readonly VERSIONS_PAGE_SIZE = 5;
  readonly versionsModalPaged = computed(() => {
    const start = this.versionsModalPage() * this.VERSIONS_PAGE_SIZE;
    return this.versionsModalList().slice(start, start + this.VERSIONS_PAGE_SIZE);
  });
  readonly versionsModalTotalPages = computed(() =>
    Math.ceil(this.versionsModalList().length / this.VERSIONS_PAGE_SIZE),
  );

  // Move modal
  readonly showMoveModal = signal(false);
  readonly moveBuckets = signal<BucketResponse[]>([]);
  readonly moveDestBucket = signal('');
  readonly moveDestPath = signal('');
  readonly moveLoading = signal(false);

  readonly moveDestKey = computed(() => {
    const obj = this.selectedObject();
    if (!obj) return '';
    const name = this.fileName(obj.key);
    let path = this.moveDestPath().trim().replace(/^\/+/, '');
    if (path && !path.endsWith('/')) path += '/';
    return path + name;
  });

  // Copy modal
  readonly showCopyModal = signal(false);
  readonly copyBuckets = signal<BucketResponse[]>([]);
  readonly copyDestBucket = signal('');
  readonly copyDestPath = signal('');
  readonly copyLoading = signal(false);

  readonly copyDestKey = computed(() => {
    const obj = this.selectedObject();
    if (!obj) return '';
    const name = this.fileName(obj.key);
    let path = this.copyDestPath().trim().replace(/^\/+/, '');
    if (path && !path.endsWith('/')) path += '/';
    return path + name;
  });

  // Management tab
  readonly mgmtLoading = signal(false);
  readonly mgmtVersioning = signal<string | null>(null);
  readonly mgmtVersioningToggle = signal(false);
  readonly mgmtVersioningSaving = signal(false);
  readonly mgmtQuota = signal<BucketQuotaGetResponse | null>(null);
  readonly mgmtQuotaInput = signal('');
  readonly mgmtQuotaUnit = signal<'GB' | 'TB' | 'PB'>('GB');
  readonly mgmtQuotaSaving = signal(false);
  readonly mgmtLifecycleJson = signal('');
  readonly mgmtLifecycleErrors = signal<string[]>([]);
  readonly mgmtLifecycleValid = signal(false);
  readonly mgmtLifecycleSaving = signal(false);
  readonly mgmtValidating = signal(false);

  // Security tab
  readonly securityLoading = signal(false);
  readonly securityPolicyJson = signal('');
  readonly securityPolicyErrors = signal<string[]>([]);
  readonly securityPolicyValid = signal(false);
  readonly securityPolicyValidating = signal(false);
  readonly securityPolicySaving = signal(false);
  readonly securityPolicyDeleting = signal(false);

  // Events tab
  readonly eventTypes = EVENT_TYPES;
  readonly eventsLoading = signal(false);
  readonly eventsRows = signal<EventRow[]>([]);
  readonly eventsFilter = signal('');
  readonly expandedEventId = signal<string | null>(null);
  readonly showEventModal = signal(false);
  readonly eventModalMode = signal<'add' | 'edit'>('add');
  readonly eventModalEditId = signal('');
  readonly eventModalName = signal('');
  readonly eventModalDestType = signal<'queue' | 'topic' | 'lambda'>('queue');
  readonly eventModalDestArn = signal('');
  readonly eventModalEventTypes = signal<string[]>([]);
  readonly eventModalPrefix = signal('');
  readonly eventModalSuffix = signal('');
  readonly eventModalSaving = signal(false);
  readonly eventsDeletingId = signal<string | null>(null);

  readonly eventsRowsFiltered = computed(() => {
    const q = this.eventsFilter().toLowerCase().trim();
    if (!q) return this.eventsRows();
    return this.eventsRows().filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.destinationArn.toLowerCase().includes(q) ||
        r.eventTypes.some((t) => t.toLowerCase().includes(q)),
    );
  });

  readonly mgmtUsagePct = computed(() => {
    const usage = this.usage();
    const quota = this.mgmtQuota();
    if (!usage || !quota?.quota_bytes) return 0;
    return Math.min(Math.round((usage.size_bytes / quota.quota_bytes) * 100), 100);
  });

  readonly skeletons = [1, 2, 3, 4, 5];

  readonly prefixSegments = computed(() => {
    const prefix = this.currentPrefix();
    if (!prefix) return [];
    return prefix.split('/').filter(Boolean).map((label, i, arr) => ({
      label,
      prefix: arr.slice(0, i + 1).join('/') + '/',
    }));
  });

  readonly folders = computed(() => {
    const prefix = this.currentPrefix();
    const seen = new Set<string>();
    for (const obj of this.objects()) {
      const rest = obj.key.slice(prefix.length);
      const idx = rest.indexOf('/');
      if (idx >= 0) seen.add(prefix + rest.slice(0, idx + 1));
    }
    return [...seen].sort();
  });

  readonly files = computed(() =>
    this.objects().filter(obj => {
      const rest = obj.key.slice(this.currentPrefix().length);
      return rest && !rest.includes('/');
    }),
  );

  readonly filteredFolders = computed(() => {
    const q = this.filterText().toLowerCase();
    return q ? this.folders().filter(f => f.toLowerCase().includes(q)) : this.folders();
  });

  readonly filteredFiles = computed(() => {
    const q = this.filterText().toLowerCase();
    return q ? this.files().filter(f => f.key.toLowerCase().includes(q)) : this.files();
  });

  readonly drawerTagList = computed(() =>
    Object.entries(this.drawerTags()).map(([key, value]) => ({ key, value })),
  );

  ngOnInit() {
    const name = this.route.snapshot.paramMap.get('name') ?? '';
    this.bucketName.set(name);
    this.layout.setTitle(name);
    const focusKey = this.route.snapshot.queryParamMap.get('key');
    this.loadObjects().then(() => {
      if (focusKey) {
        const obj = this.objects().find(o => o.key === focusKey);
        if (obj) this.selectObject(obj);
      }
    });
    if (this.userService.isAdmin()) {
      this.loadUsage();
      this.loadQuotaHeader();
    }
    this.loadBucketDate();
  }

  private async loadBucketDate() {
    const res = await firstValueFrom(this.api.listBuckets()).catch(() => null);
    const bucket = res?.data?.find(b => b.name === this.bucketName());
    if (bucket) this.bucketCreated.set(this.formatDate(bucket.creation_date));
  }

  private async loadQuotaHeader() {
    const res = await firstValueFrom(this.api.getBucketQuota(this.bucketName())).catch(() => null);
    const quotaItem = (res?.data as BucketQuotaGetResponse[] | null)?.[0] ?? null;
    this.mgmtQuota.set(quotaItem);
  }

  private async loadUsage() {
    const res = await firstValueFrom(this.api.getBucketUsage(this.bucketName())).catch(() => null);
    if (res?.data) this.usage.set({ objects: res.data.objects, size_bytes: res.data.size_bytes });
  }

  async loadObjects(append = false) {
    if (!append) {
      this.loading.set(true);
      if (!append) this.objects.set([]);
    }
    try {
      const token = append ? (this.nextToken() ?? undefined) : undefined;
      const res = await firstValueFrom(
        this.api.listObjects(this.bucketName(), this.currentPrefix() || undefined, 200, token),
      );
      if (res.data) {
        if (append) {
          this.objects.update(prev => [...prev, ...res.data!.objects]);
        } else {
          this.objects.set(res.data.objects);
        }
        this.isTruncated.set(res.data.is_truncated);
        this.nextToken.set(res.data.next_continuation_token ?? null);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore() {
    await this.loadObjects(true);
  }

  navigateToPrefix(prefix: string) {
    this.currentPrefix.set(prefix);
    this.selectedObject.set(null);
    this.filterText.set('');
    this.loadObjects();
  }

  async selectObject(obj: ObjectItemResponse) {
    this.selectedObject.set(obj);
    this.drawerMetadata.set(null);
    this.drawerTags.set({});
    this.drawerTagsEditing.set(false);
    this.drawerMetadataEditing.set(false);
    this.drawerLoading.set(true);
    try {
      const [meta, tags] = await Promise.all([
        firstValueFrom(this.api.getObjectMetadata(this.bucketName(), obj.key)).catch(() => null),
        firstValueFrom(this.api.getObjectTags(this.bucketName(), obj.key)).catch(() => null),
      ]);
      if (meta?.data) this.drawerMetadata.set(meta.data);
      if (tags?.data?.tags) this.drawerTags.set(tags.data.tags);
    } finally {
      this.drawerLoading.set(false);
    }
  }

  closeDrawer() {
    this.selectedObject.set(null);
  }

  async downloadSelected() {
    const obj = this.selectedObject();
    if (!obj || this.drawerDownloading()) return;
    this.drawerDownloading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.generatePresignedDownload({
          bucket: this.bucketName(),
          key: obj.key,
          download_as: this.fileName(obj.key),
        }),
      );
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } finally {
      this.drawerDownloading.set(false);
    }
  }

  async confirmDelete() {
    const obj = this.selectedObject();
    if (!obj || this.drawerDeleting()) return;
    this.drawerDeleting.set(true);
    try {
      await firstValueFrom(this.api.deleteObject(this.bucketName(), obj.key));
      this.showDeleteConfirm.set(false);
      this.closeDrawer();
      await this.loadObjects();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete object');
    } finally {
      this.drawerDeleting.set(false);
    }
  }

  // ── Metadata editing ─────────────────────────────────────────

  startEditMetadata() {
    const current = this.drawerMetadata()?.metadata ?? {};
    this.drawerMetadataLocal.set(Object.entries(current).map(([key, value]) => ({ key, value })));
    this.drawerMetadataEditing.set(true);
  }

  cancelEditMetadata() {
    this.drawerMetadataEditing.set(false);
  }

  addMetadataRow() {
    this.drawerMetadataLocal.update(rows => [...rows, { key: '', value: '' }]);
  }

  removeMetadataRow(index: number) {
    this.drawerMetadataLocal.update(rows => rows.filter((_, i) => i !== index));
  }

  updateMetadataRow(index: number, field: 'key' | 'value', value: string) {
    this.drawerMetadataLocal.update(rows =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  async saveMetadata() {
    const obj = this.selectedObject();
    if (!obj || this.drawerMetadataSaving()) return;
    this.drawerMetadataSaving.set(true);
    try {
      const metadata = Object.fromEntries(
        this.drawerMetadataLocal()
          .filter(r => r.key.trim())
          .map(r => [r.key.trim(), r.value]),
      );
      await firstValueFrom(
        this.api.updateObjectMetadata({ bucket: this.bucketName(), key: obj.key, metadata }),
      );
      this.drawerMetadata.update(m => m ? { ...m, metadata } : m);
      this.drawerMetadataEditing.set(false);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save metadata');
    } finally {
      this.drawerMetadataSaving.set(false);
    }
  }

  // ── Tags editing ─────────────────────────────────────────────

  startEditTags() {
    this.drawerTagsLocal.set(this.drawerTagList().map(t => ({ ...t })));
    this.drawerTagsEditing.set(true);
  }

  cancelEditTags() {
    this.drawerTagsEditing.set(false);
  }

  addTagRow() {
    this.drawerTagsLocal.update(rows => [...rows, { key: '', value: '' }]);
  }

  removeTagRow(index: number) {
    this.drawerTagsLocal.update(rows => rows.filter((_, i) => i !== index));
  }

  updateTagRow(index: number, field: 'key' | 'value', value: string) {
    this.drawerTagsLocal.update(rows =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  async saveTags() {
    const obj = this.selectedObject();
    if (!obj || this.drawerTagsSaving()) return;
    this.drawerTagsSaving.set(true);
    try {
      const tags = Object.fromEntries(
        this.drawerTagsLocal()
          .filter(r => r.key.trim())
          .map(r => [r.key.trim(), r.value]),
      );
      const res = await firstValueFrom(
        this.api.updateObjectTags({ bucket: this.bucketName(), key: obj.key, tags }),
      );
      if (res.data?.tags) this.drawerTags.set(res.data.tags);
      this.drawerTagsEditing.set(false);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save tags');
    } finally {
      this.drawerTagsSaving.set(false);
    }
  }

  // ── Versions modal ───────────────────────────────────────────

  async openVersionsModal() {
    const obj = this.selectedObject();
    if (!obj) return;
    this.versionsModalList.set([]);
    this.versionsModalPage.set(0);
    this.versionsModalConfirmDeleteId.set(null);
    this.showVersionsModal.set(true);
    this.versionsModalLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listObjectVersions(this.bucketName(), obj.key),
      ).catch(() => null);
      if (res?.data?.versions) this.versionsModalList.set(res.data.versions);
    } finally {
      this.versionsModalLoading.set(false);
    }
  }

  closeVersionsModal() {
    this.showVersionsModal.set(false);
  }

  async deleteVersion(versionId: string) {
    const obj = this.selectedObject();
    if (!obj || this.versionsModalDeletingId()) return;
    this.versionsModalDeletingId.set(versionId);
    try {
      await firstValueFrom(
        this.api.deleteObjectVersion(this.bucketName(), obj.key, versionId),
      );
      this.versionsModalConfirmDeleteId.set(null);
      const wasLatest = this.versionsModalList().find(v => v.version_id === versionId)?.is_latest;
      this.versionsModalList.update((vs: ObjectVersionItemResponse[]) =>
        vs.filter((v: ObjectVersionItemResponse) => v.version_id !== versionId),
      );
      const maxPage = Math.max(0, Math.ceil(this.versionsModalList().length / this.VERSIONS_PAGE_SIZE) - 1);
      if (this.versionsModalPage() > maxPage) this.versionsModalPage.set(maxPage);
      if (wasLatest) await this.selectObject(obj);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete version');
    } finally {
      this.versionsModalDeletingId.set(null);
    }
  }

  async restoreVersion(versionId: string) {
    const obj = this.selectedObject();
    if (!obj || this.versionsModalRestoringId()) return;
    this.versionsModalRestoringId.set(versionId);
    try {
      await firstValueFrom(
        this.api.restoreObjectVersion(this.bucketName(), obj.key, versionId),
      );
      // Reload the version list to reflect the new latest
      const res = await firstValueFrom(
        this.api.listObjectVersions(this.bucketName(), obj.key),
      ).catch(() => null);
      if (res?.data?.versions) this.versionsModalList.set(res.data.versions);
      this.versionsModalPage.set(0);
      await this.selectObject(obj);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to restore version');
    } finally {
      this.versionsModalRestoringId.set(null);
    }
  }

  async openMoveModal() {
    const res = await firstValueFrom(this.api.listBuckets());
    this.moveBuckets.set(res.data ?? []);
    this.moveDestBucket.set(this.bucketName());
    this.moveDestPath.set(this.currentPrefix());
    this.showMoveModal.set(true);
  }

  closeMoveModal() {
    if (this.moveLoading()) return;
    this.showMoveModal.set(false);
  }

  async confirmMove() {
    const obj = this.selectedObject();
    if (!obj || this.moveLoading()) return;
    this.moveLoading.set(true);
    try {
      await firstValueFrom(
        this.api.moveObject(this.bucketName(), obj.key, this.moveDestBucket(), this.moveDestKey()),
      );
      this.closeMoveModal();
      this.closeDrawer();
      await this.loadObjects();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to move object');
    } finally {
      this.moveLoading.set(false);
    }
  }

  async openCopyModal() {
    const res = await firstValueFrom(this.api.listBuckets());
    this.copyBuckets.set(res.data ?? []);
    this.copyDestBucket.set(this.bucketName());
    this.copyDestPath.set(this.currentPrefix());
    this.showCopyModal.set(true);
  }

  closeCopyModal() {
    if (this.copyLoading()) return;
    this.showCopyModal.set(false);
  }

  async confirmCopy() {
    const obj = this.selectedObject();
    if (!obj || this.copyLoading()) return;
    this.copyLoading.set(true);
    try {
      await firstValueFrom(
        this.api.copyObject(this.bucketName(), obj.key, this.copyDestBucket(), this.copyDestKey()),
      );
      this.closeCopyModal();
      await this.loadObjects();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to copy object');
    } finally {
      this.copyLoading.set(false);
    }
  }

  switchTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'management') this.loadManagement();
    if (tab === 'security') this.loadSecurity();
    if (tab === 'events') this.loadEvents();
  }

  async loadManagement() {
    if (this.mgmtLoading()) return;
    this.mgmtLoading.set(true);
    const name = this.bucketName();
    try {
      const [versioning, quota, lifecycle] = await Promise.all([
        firstValueFrom(this.api.getBucketVersioning(name)),
        firstValueFrom(this.api.getBucketQuota(name)).catch(() => null),
        firstValueFrom(this.api.getBucketLifecycle(name)).catch(() => null),
      ]);

      const v = versioning.data?.versioning ?? null;
      this.mgmtVersioning.set(v);
      this.mgmtVersioningToggle.set(typeof v === 'string' && v.toLowerCase() === 'enabled');

      const quotaItem = (quota?.data as BucketQuotaGetResponse[] | null)?.[0] ?? null;
      this.mgmtQuota.set(quotaItem);
      if (quotaItem?.quota_bytes) {
        const { value, unit } = this.bytesToQuotaInput(quotaItem.quota_bytes);
        this.mgmtQuotaInput.set(value);
        this.mgmtQuotaUnit.set(unit);
      }

      const lc = (lifecycle?.data as { lifecycle?: unknown } | null)?.lifecycle;
      this.mgmtLifecycleJson.set(lc ? JSON.stringify(lc, null, 2) : '');
      this.mgmtLifecycleErrors.set([]);
      this.mgmtLifecycleValid.set(false);
    } finally {
      this.mgmtLoading.set(false);
    }
  }

  async saveVersioning() {
    if (this.mgmtVersioningSaving()) return;
    this.mgmtVersioningSaving.set(true);
    try {
      const res = await firstValueFrom(
        this.api.setBucketVersioning(this.bucketName(), this.mgmtVersioningToggle()),
      );
      this.mgmtVersioning.set(res.data?.versioning ?? null);
    } finally {
      this.mgmtVersioningSaving.set(false);
    }
  }

  async saveQuota() {
    if (this.mgmtQuotaSaving()) return;
    const bytes = this.quotaInputToBytes(this.mgmtQuotaInput(), this.mgmtQuotaUnit());
    if (!bytes) return;
    this.mgmtQuotaSaving.set(true);
    try {
      const res = await firstValueFrom(this.api.setBucketQuota(this.bucketName(), bytes));
      const updated = res.data as unknown as BucketQuotaGetResponse[];
      this.mgmtQuota.set(Array.isArray(updated) ? (updated[0] ?? null) : null);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save quota');
    } finally {
      this.mgmtQuotaSaving.set(false);
    }
  }

  async validateLifecycle(): Promise<void> {
    const raw = this.mgmtLifecycleJson().trim();
    if (!raw) {
      this.mgmtLifecycleErrors.set([]);
      this.mgmtLifecycleValid.set(false);
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e: unknown) {
      this.mgmtLifecycleErrors.set([(e as Error).message]);
      this.mgmtLifecycleValid.set(false);
      return;
    }
    this.mgmtValidating.set(true);
    try {
      const res = await firstValueFrom(
        this.api.validateBucketLifecycle(this.bucketName(), { lifecycle: parsed }),
      );
      const result = res.data as LifecycleValidationResponse;
      this.mgmtLifecycleErrors.set(result.errors);
      this.mgmtLifecycleValid.set(result.valid);
    } finally {
      this.mgmtValidating.set(false);
    }
  }

  async saveLifecycle() {
    if (this.mgmtLifecycleSaving()) return;
    const raw = this.mgmtLifecycleJson().trim();
    if (raw) {
      try {
        JSON.parse(raw);
      } catch (e: unknown) {
        this.mgmtLifecycleErrors.set([(e as Error).message]);
        this.mgmtLifecycleValid.set(false);
        return;
      }
    }
    this.mgmtLifecycleSaving.set(true);
    try {
      if (!raw) {
        await firstValueFrom(this.api.deleteBucketLifecycle(this.bucketName()));
      } else {
        const lifecycle = JSON.parse(raw) as Record<string, unknown>;
        await firstValueFrom(
          this.api.setBucketLifecycle(this.bucketName(), { lifecycle } as UpdateBucketLifecycleRequest),
        );
      }
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save lifecycle configuration');
    } finally {
      this.mgmtLifecycleSaving.set(false);
    }
  }

  // ── Security tab ──────────────────────────────────────────────────────────

  async loadSecurity() {
    this.securityLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.getBucketPolicy(this.bucketName()));
      const policy = res.data?.policy;
      this.securityPolicyJson.set(policy ? JSON.stringify(policy, null, 2) : '');
      this.securityPolicyErrors.set([]);
      this.securityPolicyValid.set(false);
    } finally {
      this.securityLoading.set(false);
    }
  }

  applyPolicyExample(key: string) {
    const template = POLICY_EXAMPLES[key];
    if (!template) return;
    const json = JSON.stringify(template, null, 2).replace(/BUCKET_NAME/g, this.bucketName());
    this.securityPolicyJson.set(json);
    this.securityPolicyErrors.set([]);
    this.securityPolicyValid.set(false);
  }

  async validatePolicy(): Promise<void> {
    const raw = this.securityPolicyJson().trim();
    if (!raw) {
      this.securityPolicyErrors.set([]);
      this.securityPolicyValid.set(false);
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e: unknown) {
      this.securityPolicyErrors.set([(e as Error).message]);
      this.securityPolicyValid.set(false);
      return;
    }
    this.securityPolicyValidating.set(true);
    try {
      const res = await firstValueFrom(
        this.api.validateBucketPolicy(this.bucketName(), { policy: parsed }),
      );
      const result = res.data as PolicyValidationResponse;
      this.securityPolicyErrors.set(result.errors);
      this.securityPolicyValid.set(result.valid);
    } finally {
      this.securityPolicyValidating.set(false);
    }
  }

  async savePolicy() {
    if (this.securityPolicySaving()) return;
    const raw = this.securityPolicyJson().trim();
    if (raw) {
      try {
        JSON.parse(raw);
      } catch (e: unknown) {
        this.securityPolicyErrors.set([(e as Error).message]);
        this.securityPolicyValid.set(false);
        return;
      }
    }
    this.securityPolicySaving.set(true);
    try {
      const policy = JSON.parse(raw) as Record<string, unknown>;
      await firstValueFrom(this.api.setBucketPolicy(this.bucketName(), { policy }));
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save bucket policy');
    } finally {
      this.securityPolicySaving.set(false);
    }
  }

  async deletePolicy() {
    if (this.securityPolicyDeleting()) return;
    this.securityPolicyDeleting.set(true);
    try {
      await firstValueFrom(this.api.deleteBucketPolicy(this.bucketName()));
      this.securityPolicyJson.set('');
      this.securityPolicyErrors.set([]);
      this.securityPolicyValid.set(false);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete bucket policy');
    } finally {
      this.securityPolicyDeleting.set(false);
    }
  }

  // ── Events tab ────────────────────────────────────────────────────────────

  async loadEvents() {
    this.eventsLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.getBucketEvents(this.bucketName()));
      const raw = (res.data as { events?: Record<string, unknown[]> })?.events ?? {};
      this.eventsRows.set(this.normalizeEvents(raw));
    } finally {
      this.eventsLoading.set(false);
    }
  }

  private normalizeEvents(config: Record<string, unknown[]>): EventRow[] {
    const rows: EventRow[] = [];
    const sections: [string, EventRow['destType'], string][] = [
      ['QueueConfigurations', 'queue', 'QueueArn'],
      ['TopicConfigurations', 'topic', 'TopicArn'],
      ['LambdaFunctionConfigurations', 'lambda', 'LambdaFunctionArn'],
    ];
    for (const [section, destType, arnKey] of sections) {
      const items = config[section] as Record<string, unknown>[] | undefined;
      if (!items) continue;
      items.forEach((item, idx) => {
        const id = (item['Id'] as string) || `${destType}-${idx}`;
        const destinationArn = (item[arnKey] as string) || '';
        const eventTypes = (item['Events'] as string[]) || [];
        const rules = ((item['Filter'] as Record<string, unknown>)?.['Key'] as Record<string, unknown>)?.['FilterRules'] as Record<string, string>[] | undefined;
        const prefix = rules?.find((r) => r['Name'] === 'prefix')?.['Value'] ?? '';
        const suffix = rules?.find((r) => r['Name'] === 'suffix')?.['Value'] ?? '';
        rows.push({ id, destType, eventTypes, destinationArn, prefix, suffix, rawJson: JSON.stringify(item, null, 2) });
      });
    }
    return rows;
  }

  private serializeEvents(rows: EventRow[]): Record<string, unknown[]> {
    const config: Record<string, unknown[]> = {};
    const sectionMap: Record<string, string> = { queue: 'QueueConfigurations', topic: 'TopicConfigurations', lambda: 'LambdaFunctionConfigurations' };
    const arnKeyMap: Record<string, string> = { queue: 'QueueArn', topic: 'TopicArn', lambda: 'LambdaFunctionArn' };
    for (const row of rows) {
      const section = sectionMap[row.destType];
      if (!config[section]) config[section] = [];
      const filterRules: Record<string, string>[] = [];
      if (row.prefix) filterRules.push({ Name: 'prefix', Value: row.prefix });
      if (row.suffix) filterRules.push({ Name: 'suffix', Value: row.suffix });
      const item: Record<string, unknown> = {
        Id: row.id,
        [arnKeyMap[row.destType]]: row.destinationArn,
        Events: row.eventTypes,
      };
      if (filterRules.length) item['Filter'] = { Key: { FilterRules: filterRules } };
      config[section].push(item);
    }
    return config;
  }

  toggleEventRow(id: string) {
    this.expandedEventId.set(this.expandedEventId() === id ? null : id);
  }

  openAddEventModal() {
    this.eventModalMode.set('add');
    this.eventModalEditId.set('');
    this.eventModalName.set('');
    this.eventModalDestType.set('queue');
    this.eventModalDestArn.set('');
    this.eventModalEventTypes.set([]);
    this.eventModalPrefix.set('');
    this.eventModalSuffix.set('');
    this.showEventModal.set(true);
  }

  openEditEventModal(row: EventRow) {
    this.eventModalMode.set('edit');
    this.eventModalEditId.set(row.id);
    this.eventModalName.set(row.id);
    this.eventModalDestType.set(row.destType);
    this.eventModalDestArn.set(row.destinationArn);
    this.eventModalEventTypes.set([...row.eventTypes]);
    this.eventModalPrefix.set(row.prefix);
    this.eventModalSuffix.set(row.suffix);
    this.showEventModal.set(true);
  }

  closeEventModal() { this.showEventModal.set(false); }

  toggleEventType(type: string) {
    const current = this.eventModalEventTypes();
    this.eventModalEventTypes.set(
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
  }

  isEventTypeSelected(type: string): boolean {
    return this.eventModalEventTypes().includes(type);
  }

  async saveEvent() {
    if (this.eventModalSaving() || !this.eventModalDestArn().trim() || this.eventModalEventTypes().length === 0) return;
    this.eventModalSaving.set(true);
    try {
      let rows = [...this.eventsRows()];
      const newRow: EventRow = {
        id: this.eventModalName().trim() || `event-${Date.now()}`,
        destType: this.eventModalDestType(),
        eventTypes: this.eventModalEventTypes(),
        destinationArn: this.eventModalDestArn().trim(),
        prefix: this.eventModalPrefix().trim(),
        suffix: this.eventModalSuffix().trim(),
        rawJson: '',
      };
      if (this.eventModalMode() === 'edit') {
        rows = rows.map((r) => (r.id === this.eventModalEditId() ? newRow : r));
      } else {
        rows.push(newRow);
      }
      const config = this.serializeEvents(rows);
      await firstValueFrom(this.api.setBucketEvents(this.bucketName(), config));
      this.eventsRows.set(this.normalizeEvents(config));
      this.closeEventModal();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to save event configuration');
    } finally {
      this.eventModalSaving.set(false);
    }
  }

  async deleteEvent(row: EventRow) {
    if (this.eventsDeletingId()) return;
    this.eventsDeletingId.set(row.id);
    try {
      const rows = this.eventsRows().filter((r) => r.id !== row.id);
      if (rows.length === 0) {
        await firstValueFrom(this.api.deleteBucketEvents(this.bucketName()));
      } else {
        const config = this.serializeEvents(rows);
        await firstValueFrom(this.api.setBucketEvents(this.bucketName(), config));
      }
      this.eventsRows.set(rows);
      if (this.expandedEventId() === row.id) this.expandedEventId.set(null);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete event');
    } finally {
      this.eventsDeletingId.set(null);
    }
  }

  getEventDestIcon(destType: string): string {
    return destType === 'queue' ? 'queue' : destType === 'topic' ? 'hub' : 'function';
  }

  getEventTypeBadgeClass(type: string): string {
    let color: string;
    if (type.startsWith('s3:ObjectCreated')) color = this.dark ? 'bg-blue-900/30 text-blue-200 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200';
    else if (type.startsWith('s3:ObjectRemoved')) color = this.dark ? 'bg-red-900/30 text-red-200 border-red-800' : 'bg-red-50 text-red-700 border-red-200';
    else if (type.startsWith('s3:ObjectRestore')) color = this.dark ? 'bg-orange-900/30 text-orange-200 border-orange-800' : 'bg-orange-50 text-orange-700 border-orange-200';
    else if (type.startsWith('s3:Replication')) color = this.dark ? 'bg-green-900/30 text-green-200 border-green-800' : 'bg-green-50 text-green-700 border-green-200';
    else if (type.startsWith('s3:LifecycleExpiration')) color = this.dark ? 'bg-yellow-900/30 text-yellow-200 border-yellow-800' : 'bg-yellow-50 text-yellow-700 border-yellow-200';
    else color = this.dark ? 'bg-purple-900/30 text-purple-200 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200';
    return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`;
  }

  private bytesToQuotaInput(bytes: number): { value: string; unit: 'GB' | 'TB' | 'PB' } {
    if (bytes >= 1024 ** 5) return { value: String(Math.round(bytes / 1024 ** 5)), unit: 'PB' };
    if (bytes >= 1024 ** 4) return { value: String(Math.round(bytes / 1024 ** 4)), unit: 'TB' };
    return { value: String(Math.round(bytes / 1024 ** 3)), unit: 'GB' };
  }

  private quotaInputToBytes(value: string, unit: 'GB' | 'TB' | 'PB'): number {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0) return 0;
    if (unit === 'PB') return Math.round(n * 1024 ** 5);
    if (unit === 'TB') return Math.round(n * 1024 ** 4);
    return Math.round(n * 1024 ** 3);
  }

  copyKey() {
    const obj = this.selectedObject();
    if (obj) this.copyToClipboard(obj.key);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  openUploadModal() {
    this.uploadQueue.set([]);
    this.uploadIntermediatePath.set('');
    this.showUploadModal.set(true);
  }

  async closeUploadModal() {
    if (this.isUploading()) return;
    const anyDone = this.uploadQueue().some(i => i.status === 'done');
    this.showUploadModal.set(false);
    this.uploadQueue.set([]);
    if (anyDone) await this.loadObjects();
  }

  triggerDropZone() {
    const el = this.dropZoneInput();
    if (el) el.nativeElement.click();
  }

  triggerDropZoneFolder() {
    const el = this.dropZoneFolderInput();
    if (el) el.nativeElement.click();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const items = event.dataTransfer?.items;
    if (items) {
      const entries = Array.from(items)
        .map(item => item.webkitGetAsEntry())
        .filter((e): e is FileSystemEntry => e !== null);
      this.collectAndAddEntries(entries);
    } else {
      const files = Array.from(event.dataTransfer?.files ?? []).map(file => ({
        file,
        relativePath: file.name,
      }));
      this.addFilesToQueue(files);
    }
  }

  onDropZoneFileSelected(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []).map(file => ({
      file,
      relativePath: file.name,
    }));
    this.addFilesToQueue(files);
    input.value = '';
  }

  onDropZoneFolderSelected(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []).map(file => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
    this.addFilesToQueue(files);
    input.value = '';
  }

  private async collectAndAddEntries(entries: FileSystemEntry[]) {
    const collected: Array<{ file: File; relativePath: string }> = [];
    await Promise.all(entries.map(entry => this.collectEntry(entry, '', collected)));
    this.addFilesToQueue(collected);
  }

  private collectEntry(
    entry: FileSystemEntry,
    prefix: string,
    out: Array<{ file: File; relativePath: string }>,
  ): Promise<void> {
    if (entry.isFile) {
      return new Promise(resolve => {
        (entry as FileSystemFileEntry).file(file => {
          out.push({ file, relativePath: prefix + entry.name });
          resolve();
        });
      });
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const dirPrefix = prefix + entry.name + '/';
      return new Promise(resolve => {
        const readBatch = (batch: FileSystemEntry[]) => {
          if (!batch.length) { resolve(); return; }
          Promise.all(batch.map(e => this.collectEntry(e, dirPrefix, out)))
            .then(() => reader.readEntries(readBatch));
        };
        reader.readEntries(readBatch);
      });
    }
    return Promise.resolve();
  }

  private addFilesToQueue(files: Array<{ file: File; relativePath: string }>) {
    const items: UploadQueueItem[] = files.map(({ file, relativePath }) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      relativePath,
      status: 'pending',
      progress: 0,
    }));
    this.uploadQueue.update(q => [...q, ...items]);
  }

  removeFromQueue(id: string) {
    this.uploadQueue.update(q => q.filter(i => i.id !== id));
  }

  cancelAll() {
    this.uploadQueue.update(q => q.filter(i => i.status === 'uploading'));
  }

  async startUpload() {
    if (this.isUploading()) return;
    const pending = this.uploadQueue().filter(i => i.status === 'pending');
    if (!pending.length) return;
    const CONCURRENCY = 3;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(item => this.uploadFileItem(item)));
    }
  }

  private uploadFileItem(item: UploadQueueItem): Promise<void> {
    return new Promise(resolve => {
      this.uploadQueue.update(q => q.map(i =>
        i.id === item.id ? { ...i, status: 'uploading' as UploadStatus } : i
      ));
      const key = this.currentPrefix() + this.normalizedIntermediate() + item.relativePath;
      this.api.uploadObject(this.bucketName(), key, item.file).subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const pct = Math.round((event.loaded / event.total) * 100);
            this.uploadQueue.update(q => q.map(i =>
              i.id === item.id ? { ...i, progress: pct } : i
            ));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.update(q => q.map(i =>
              i.id === item.id ? { ...i, status: 'done' as UploadStatus, progress: 100 } : i
            ));
            resolve();
          }
        },
        error: () => {
          this.uploadQueue.update(q => q.map(i =>
            i.id === item.id ? { ...i, status: 'error' as UploadStatus } : i
          ));
          resolve();
        },
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  folderLabel(folder: string): string {
    const prefix = this.currentPrefix();
    return folder.slice(prefix.length);
  }

  fileName(key: string): string {
    const parts = key.split('/');
    return parts[parts.length - 1] || key;
  }

  fileIcon(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'description';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'movie';
    if (['zip', 'gz', 'tar', 'rar', '7z', 'bz2'].includes(ext)) return 'folder_zip';
    if (['sql', 'db', 'sqlite'].includes(ext)) return 'database';
    if (['js', 'ts', 'py', 'go', 'java', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(ext)) return 'code';
    if (['txt', 'md', 'log', 'csv'].includes(ext)) return 'article';
    return 'insert_drive_file';
  }

  fileIconColor(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return 'text-green-400';
    if (ext === 'pdf') return 'text-blue-400';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'text-pink-400';
    if (['zip', 'gz', 'tar', 'rar', '7z', 'bz2'].includes(ext)) return 'text-amber-400';
    if (['sql', 'db', 'sqlite'].includes(ext)) return 'text-purple-400';
    if (['js', 'ts', 'py', 'go', 'java', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(ext)) return 'text-cyan-400';
    return 'text-slate-400';
  }

  drawerIconWrapClass(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext))
      return this.dark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200';
    if (ext === 'pdf')
      return this.dark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200';
    if (['zip', 'gz', 'tar', 'rar'].includes(ext))
      return this.dark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200';
    return this.dark ? 'bg-slate-700/50 border-border-dark' : 'bg-slate-100 border-slate-200';
  }

  storageClassBadge(cls?: string | null): string {
    const base = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    if (!cls || cls === 'STANDARD') return `${base} bg-slate-700 text-slate-300`;
    if (cls === 'GLACIER') return `${base} bg-cyan-900/30 text-cyan-300 border border-cyan-800`;
    return `${base} bg-blue-900/30 text-blue-300 border border-blue-800`;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatDateFull(d: string): string {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  formatNumber(n: number): string {
    return n.toLocaleString();
  }

  // ── Theme helpers ─────────────────────────────────────────────────────────

  private get dark() { return this.theme.isDark(); }

  get titleClass() { return this.dark ? 'text-white' : 'text-slate-900'; }
  get mutedClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }
  get subtleClass() { return this.dark ? 'text-slate-200' : 'text-slate-700'; }
  get borderClass() { return this.dark ? 'border-border-dark' : 'border-slate-200'; }
  get skeletonClass() { return this.dark ? 'bg-slate-700' : 'bg-slate-200'; }

  get statPillClass() {
    return this.dark
      ? 'px-4 py-2 bg-surface-dark rounded-lg border border-border-dark flex flex-col items-end'
      : 'px-4 py-2 bg-white rounded-lg border border-slate-200 flex flex-col items-end shadow-sm';
  }

  get tableWrapClass() {
    return this.dark
      ? 'border border-border-dark rounded-lg overflow-hidden bg-surface-dark'
      : 'border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm';
  }

  get theadClass() { return this.dark ? 'bg-slate-800/50' : 'bg-slate-50'; }
  get thTextClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }
  get dividerClass() { return this.dark ? 'divide-border-dark' : 'divide-slate-100'; }

  get rowClass() {
    return this.dark
      ? 'hover:bg-slate-800/30 transition-colors cursor-pointer group'
      : 'hover:bg-slate-50 transition-colors cursor-pointer group';
  }

  get selectedRowClass() {
    return this.dark
      ? 'bg-primary/10 border-l-2 border-l-primary cursor-pointer group'
      : 'bg-primary/5 border-l-2 border-l-primary cursor-pointer group';
  }

  get drawerClass() {
    return this.dark
      ? 'bg-surface-dark border-border-dark'
      : 'bg-white border-slate-200';
  }

  get closeButtonClass() {
    return this.dark
      ? 'text-slate-400 hover:text-white hover:bg-slate-700'
      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100';
  }

  get drawerActionClass() {
    return this.dark
      ? 'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-background-dark border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all'
      : 'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-primary/50 hover:bg-white transition-all';
  }

  get drawerActionDeleteClass() {
    return this.dark
      ? 'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-background-dark border border-border-dark hover:border-red-500/50 hover:bg-surface-dark transition-all'
      : 'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-red-400 hover:bg-white transition-all';
  }

  get moveSelectClass() {
    return this.dark
      ? 'block w-full appearance-none rounded-lg border border-border-dark bg-background-dark py-2.5 pl-3 pr-10 text-white text-sm focus:ring-2 focus:ring-primary outline-none'
      : 'block w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-slate-900 text-sm focus:ring-2 focus:ring-primary outline-none';
  }

  get mgmtProgressTrackClass() {
    return this.dark ? 'bg-input-dark' : 'bg-slate-100';
  }

  get mgmtCardClass() {
    return this.dark
      ? 'bg-surface-dark rounded-xl border border-border-dark p-6'
      : 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm';
  }

  get mgmtEditorHeaderClass() {
    return this.dark
      ? 'flex items-center justify-between px-4 py-2 bg-[#1a262e] border-b border-border-dark'
      : 'flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200';
  }

  get mgmtEditorBodyClass() {
    return this.dark
      ? 'p-4 font-mono text-sm bg-[#0d1418] text-slate-300 w-full outline-none focus:ring-2 focus:ring-inset focus:ring-primary resize-y min-h-[200px] block'
      : 'p-4 font-mono text-sm bg-slate-50 text-slate-800 w-full outline-none focus:ring-2 focus:ring-inset focus:ring-primary resize-y min-h-[200px] block';
  }

  get securitySelectClass() {
    return this.dark
      ? 'rounded-lg py-2 pl-3 pr-10 text-sm text-white bg-input-dark border border-border-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none'
      : 'rounded-lg py-2 pl-3 pr-10 text-sm text-slate-900 bg-white border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none';
  }

  get securityEditorBodyClass() {
    return this.dark
      ? 'p-4 font-mono text-sm bg-[#0d1418] text-slate-300 w-full outline-none focus:ring-2 focus:ring-inset focus:ring-primary resize-y min-h-[400px] block'
      : 'p-4 font-mono text-sm bg-slate-50 text-slate-800 w-full outline-none focus:ring-2 focus:ring-inset focus:ring-primary resize-y min-h-[400px] block';
  }

  get eventsTableHeaderClass() {
    return this.dark
      ? 'bg-[#0d1b22] border-b border-border-dark text-xs uppercase text-slate-400 font-semibold tracking-wider'
      : 'bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider';
  }

  get eventsTableRowClass() {
    return this.dark
      ? 'border-b border-border-dark hover:bg-white/5 transition-colors cursor-pointer'
      : 'border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer';
  }

  get eventsExpandedRowClass() {
    return this.dark
      ? 'bg-[#0d1a20] border-l-4 border-l-primary border-b border-border-dark'
      : 'bg-primary/5 border-l-4 border-l-primary border-b border-slate-200';
  }

  get eventsCodeClass() {
    return this.dark
      ? 'rounded-lg border border-border-dark p-4 font-mono text-xs text-slate-300 bg-[#0d1418] overflow-x-auto'
      : 'rounded-lg border border-slate-200 p-4 font-mono text-xs text-slate-700 bg-slate-50 overflow-x-auto';
  }

  get eventModalInputClass() {
    return this.dark
      ? 'block w-full rounded-lg py-2 px-3 text-white bg-input-dark ring-1 ring-inset ring-border-dark placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-primary text-sm outline-none'
      : 'block w-full rounded-lg py-2 px-3 text-slate-900 bg-white ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary text-sm outline-none';
  }

  get mgmtQuotaInputClass() {
    return this.dark
      ? 'block w-full rounded-lg py-2 pl-3 pr-16 text-white bg-input-dark ring-1 ring-inset ring-border-dark placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary text-sm outline-none'
      : 'block w-full rounded-lg py-2 pl-3 pr-16 text-slate-900 bg-slate-50 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary text-sm outline-none';
  }

  get mgmtQuotaUnitClass() {
    return this.dark
      ? 'h-full rounded-md border-0 bg-transparent py-0 pl-2 pr-7 text-slate-400 text-sm outline-none'
      : 'h-full rounded-md border-0 bg-transparent py-0 pl-2 pr-7 text-slate-500 text-sm outline-none';
  }

  get filterInputClass() {
    return this.dark
      ? 'w-full bg-surface-dark border border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-white'
      : 'w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-700';
  }

  get ghostBtnClass() {
    return this.dark
      ? 'flex items-center gap-2 px-4 py-2 rounded-lg border border-border-dark bg-surface-dark text-sm font-medium hover:bg-slate-700 transition-colors text-white'
      : 'flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700';
  }

  get tagBadgeClass() {
    return this.dark
      ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 border border-border-dark text-slate-300'
      : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 border border-slate-200 text-slate-600';
  }

  get keyInputClass() {
    return this.dark
      ? 'bg-background-dark border border-border-dark text-slate-400'
      : 'bg-slate-50 border border-slate-200 text-slate-500';
  }

  get copyKeyBtnClass() {
    return this.dark
      ? 'border-border-dark bg-surface-dark text-slate-400 hover:text-white hover:bg-slate-700'
      : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50';
  }

  get uploadModalClass() {
    return this.dark
      ? 'w-full max-w-xl rounded-xl bg-surface-dark border border-border-dark flex flex-col max-h-[90vh] shadow-2xl'
      : 'w-full max-w-xl rounded-xl bg-white border border-slate-200 flex flex-col max-h-[90vh] shadow-2xl';
  }

  get dropZoneClass() {
    const base = 'relative mb-6 rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors';
    if (this.dragOver()) {
      return `${base} border-primary bg-primary/5`;
    }
    return this.dark
      ? `${base} border-border-dark hover:border-primary/50 hover:bg-background-dark/50`
      : `${base} border-slate-300 hover:border-primary/50 hover:bg-slate-50`;
  }

  get queueItemClass() {
    return this.dark
      ? 'bg-background-dark/50 rounded-lg p-3 border border-border-dark'
      : 'bg-slate-50 rounded-lg p-3 border border-slate-100';
  }

  get progressTrackClass() {
    return this.dark ? 'bg-slate-700' : 'bg-slate-200';
  }

  get intermediateInputWrapClass() {
    return this.dark
      ? 'border-border-dark bg-background-dark'
      : 'border-slate-200 bg-white';
  }

  get intermediatePathPrefixClass() {
    return this.dark
      ? 'border-border-dark text-slate-400 bg-surface-dark'
      : 'border-slate-200 text-slate-400 bg-slate-50';
  }

  queueItemIconClass(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext))
      return this.dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500';
    if (ext === 'pdf')
      return this.dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500';
    if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext))
      return this.dark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-500';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext))
      return this.dark ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-500';
    if (['js', 'ts', 'py', 'go', 'java', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(ext))
      return this.dark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-500';
    return this.dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500';
  }

  get dialogClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark rounded-xl shadow-2xl p-6 w-full max-w-md mx-4'
      : 'bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4';
  }

  get activeTabClass() { return 'border-primary text-white'; }
  get inactiveTabClass() {
    return this.dark
      ? 'border-transparent text-slate-400 hover:text-white'
      : 'border-transparent text-slate-500 hover:text-slate-900';
  }
}
