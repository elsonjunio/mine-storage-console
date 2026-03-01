import { Component, computed, inject, OnInit, signal, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HttpEventType } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/auth/user.service';
import type {
  ObjectItemResponse,
  ObjectMetadataResponse,
  BucketResponse,
} from '../../core/api/api.types';

type Tab = 'objects' | 'management' | 'security' | 'events';
type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

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
  imports: [RouterLink, TranslatePipe],
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
              </div>
            }
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 mt-6 border-b flex gap-8 shrink-0" [class]="borderClass">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="activeTab.set(tab.id)"
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

        <!-- ── Other tabs placeholder ─────────────────────────── -->
        @if (activeTab() !== 'objects') {
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
            <div class="grid grid-cols-5 gap-2 mb-6">
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

              <!-- Tags -->
              @if (drawerTagList().length > 0) {
                <div class="space-y-3 pt-4 border-t" [class]="borderClass">
                  <h4 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                    {{ 'BUCKET_DETAIL.DRAWER.TAGS' | translate }}
                  </h4>
                  <div class="flex flex-wrap gap-2">
                    @for (tag of drawerTagList(); track tag.key) {
                      <span [class]="tagBadgeClass">{{ tag.key }}: {{ tag.value }}</span>
                    }
                  </div>
                </div>
              }

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
            <div>
              <h3 class="text-lg font-semibold" [class]="titleClass">{{ 'BUCKET_DETAIL.UPLOAD.TITLE' | translate }}</h3>
              <p class="mt-1 text-sm" [class]="mutedClass">
                {{ 'BUCKET_DETAIL.UPLOAD.SUBTITLE' | translate }}
                <span class="font-mono" [class]="subtleClass">{{ bucketName() }}/{{ currentPrefix() }}</span>
              </p>
            </div>
            <button (click)="closeUploadModal()" class="p-1 rounded transition-colors" [class]="closeButtonClass">
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
                <span class="px-3 py-2 text-xs font-mono shrink-0 border-r" [class]="intermediatePathPrefixClass">
                  {{ currentPrefix() || '/' }}
                </span>
                <input
                  type="text"
                  [placeholder]="'BUCKET_DETAIL.UPLOAD.INTERMEDIATE_PLACEHOLDER' | translate"
                  (input)="uploadIntermediatePath.set($any($event.target).value)"
                  [value]="uploadIntermediatePath()"
                  class="flex-1 bg-transparent outline-none text-sm font-mono px-3 py-2"
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
    this.loadObjects();
    if (this.userService.isAdmin()) this.loadUsage();
    this.loadBucketDate();
  }

  private async loadBucketDate() {
    const res = await firstValueFrom(this.api.listBuckets()).catch(() => null);
    const bucket = res?.data?.find(b => b.name === this.bucketName());
    if (bucket) this.bucketCreated.set(this.formatDate(bucket.creation_date));
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
    } finally {
      this.drawerDeleting.set(false);
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
    } finally {
      this.copyLoading.set(false);
    }
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
