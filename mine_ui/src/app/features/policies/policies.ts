import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';

const SYSTEM_POLICIES = new Set([
  'consoleAdmin', 'readonly', 'readwrite', 'writeonly', 'diagnostics',
]);

const DEFAULT_DOCUMENT = JSON.stringify(
  { Version: '2012-10-17', Statement: [{ Sid: '', Effect: 'Allow', Action: [], Resource: [] }] },
  null,
  2,
);

interface PolicyRow {
  name: string;
  isGroup: boolean;
  isSystem: boolean;
  document: Record<string, unknown> | null;
  createDate: string | null;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex h-full overflow-hidden">

      <!-- ───── Left Sidebar ───── -->
      <aside class="w-72 flex flex-col border-r shrink-0" [class]="sidebarClass">

        <!-- Header -->
        <div class="p-4 border-b shrink-0" [class]="borderClass">
          <p class="text-xs font-medium flex items-center gap-1 mb-3" [class]="mutedClass">
            <span class="material-symbols-outlined text-[14px]">security</span>
            {{ 'POLICIES.BREADCRUMB' | translate }}
          </p>
          <h1 class="text-xl font-bold mb-4" [class]="titleClass">{{ 'POLICIES.TITLE' | translate }}</h1>

          <!-- Search -->
          <div class="relative mb-3">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] pointer-events-none" [class]="mutedClass">search</span>
            <input
              type="text"
              [placeholder]="'POLICIES.SEARCH_PLACEHOLDER' | translate"
              [value]="filterText()"
              (input)="filterText.set($any($event.target).value)"
              class="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none border"
              [class]="filterInputClass"
            />
          </div>

          <!-- Filter tabs -->
          <div class="flex gap-1">
            @for (tab of filterTabs; track tab.key) {
              <button
                (click)="filterTab.set(tab.key)"
                class="flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors"
                [class]="filterTab() === tab.key ? activeTabClass : inactiveTabClass"
              >
                {{ tab.labelKey | translate }}
              </button>
            }
          </div>
        </div>

        <!-- Policy list -->
        <div class="flex-1 overflow-y-auto">
          @if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <div class="p-4 border-b" [class]="borderClass">
                <div class="h-4 rounded animate-pulse mb-2 w-4/5" [class]="skeletonClass"></div>
                <div class="h-3 rounded animate-pulse w-1/2" [class]="skeletonClass"></div>
              </div>
            }
          } @else if (filteredPolicies().length === 0) {
            <div class="p-8 text-center">
              <span class="material-symbols-outlined text-[40px] mb-2 block" [class]="mutedClass">description</span>
              <p class="text-sm" [class]="mutedClass">
                {{ filterText() ? ('POLICIES.NO_RESULTS' | translate) : ('POLICIES.EMPTY' | translate) }}
              </p>
            </div>
          } @else {
            @for (p of filteredPolicies(); track p.name) {
              <div
                (click)="selectPolicy(p)"
                class="p-4 border-b cursor-pointer transition-colors"
                [class]="policyItemClass(p.name)"
              >
                <div class="flex justify-between items-start gap-2 mb-1">
                  <h3 class="font-medium text-sm truncate" [class]="selectedPolicy()?.name === p.name ? 'text-primary' : titleClass">
                    {{ p.name }}
                  </h3>
                  @if (p.isSystem) {
                    <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                      {{ 'POLICIES.TYPE_SYSTEM' | translate }}
                    </span>
                  } @else {
                    <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {{ 'POLICIES.TYPE_CUSTOM' | translate }}
                    </span>
                  }
                </div>
                @if (p.createDate) {
                  <p class="text-xs" [class]="mutedClass">{{ 'POLICIES.CREATED' | translate }}: {{ formatDate(p.createDate) }}</p>
                } @else {
                  <p class="text-xs truncate" [class]="mutedClass">{{ p.name }}</p>
                }
              </div>
            }
          }
        </div>

        <!-- Create button -->
        <div class="p-4 border-t shrink-0" [class]="borderClass">
          <button
            (click)="openCreateModal()"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 px-4 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            {{ 'POLICIES.CREATE_BTN' | translate }}
          </button>
        </div>
      </aside>

      <!-- ───── Right Detail Panel ───── -->
      <main class="flex-1 flex flex-col overflow-hidden" [class]="mainBgClass">

        @if (selectedPolicy(); as policy) {

          <!-- Detail Header -->
          <div class="px-8 pt-6 border-b shrink-0" [class]="headerClass">
            <div class="flex justify-between items-start mb-6">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <h1 class="text-2xl font-bold" [class]="titleClass">{{ policy.name }}</h1>
                  @if (policy.isSystem) {
                    <span class="px-2 py-0.5 rounded text-xs font-bold uppercase bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                      {{ 'POLICIES.TYPE_SYSTEM' | translate }}
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {{ 'POLICIES.TYPE_CUSTOM' | translate }}
                    </span>
                  }
                </div>
                @if (policy.createDate) {
                  <div class="flex items-center gap-1.5 text-sm" [class]="mutedClass">
                    <span class="material-symbols-outlined text-[15px]">calendar_today</span>
                    <span>{{ 'POLICIES.CREATED' | translate }}: {{ formatDate(policy.createDate) }}</span>
                  </div>
                }
              </div>
              <div class="flex gap-2 shrink-0">
                @if (!policy.isSystem) {
                  <button
                    (click)="showDeleteConfirm.set(policy.name)"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/30 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                    {{ 'POLICIES.DELETE_BTN' | translate }}
                  </button>
                }
              </div>
            </div>

            <!-- Tabs -->
            <div class="flex gap-8 -mb-px">
              <button
                (click)="activeTab.set('json')"
                class="pb-3 text-sm font-medium transition-colors border-b-2"
                [class]="activeTab() === 'json' ? 'text-primary border-primary' : 'border-transparent ' + mutedClass"
              >
                {{ 'POLICIES.TAB_JSON' | translate }}
              </button>
              <button
                (click)="activeTab.set('usage')"
                class="pb-3 text-sm font-medium transition-colors border-b-2"
                [class]="activeTab() === 'usage' ? 'text-primary border-primary' : 'border-transparent ' + mutedClass"
              >
                {{ 'POLICIES.TAB_USAGE' | translate }}
              </button>
            </div>
          </div>

          <!-- Content Body -->
          <div class="flex-1 overflow-y-auto p-8">

            @if (activeTab() === 'json') {
              <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">

                <!-- JSON Editor -->
                <div class="xl:col-span-2 flex flex-col gap-4">
                  <div class="flex justify-between items-center">
                    <h3 class="font-semibold flex items-center gap-2" [class]="titleClass">
                      <span class="material-symbols-outlined text-primary text-[20px]">code</span>
                      {{ 'POLICIES.DOCUMENT_TITLE' | translate }}
                    </h3>
                    <div class="flex items-center gap-2">
                      @if (editorValid()) {
                        <span class="text-xs text-green-400 flex items-center gap-1 bg-green-900/20 px-2 py-1 rounded border border-green-900/30">
                          <span class="material-symbols-outlined text-[14px]">check_circle</span>
                          {{ 'POLICIES.JSON_VALID' | translate }}
                        </span>
                      } @else {
                        <span class="text-xs text-red-400 flex items-center gap-1 bg-red-900/20 px-2 py-1 rounded border border-red-900/30">
                          <span class="material-symbols-outlined text-[14px]">error</span>
                          {{ 'POLICIES.JSON_INVALID' | translate }}
                        </span>
                      }
                      <button
                        (click)="copyDocument()"
                        class="text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors"
                        [class]="ghostBtnSmClass"
                      >
                        <span class="material-symbols-outlined text-[14px]">content_copy</span>
                        {{ 'POLICIES.COPY_BTN' | translate }}
                      </button>
                    </div>
                  </div>

                  <!-- Editor container -->
                  @if (loadingDetail()) {
                    <div class="rounded-lg border flex items-center justify-center h-64" [class]="editorContainerClass">
                      <span class="material-symbols-outlined animate-spin text-[28px]" [class]="mutedClass">progress_activity</span>
                    </div>
                  } @else {
                  <div class="rounded-lg border overflow-hidden flex flex-col shadow-lg" [class]="editorContainerClass">
                    <!-- Toolbar -->
                    <div class="flex items-center justify-between px-4 py-2 border-b" [class]="editorHeaderClass">
                      <span class="text-xs font-mono" [class]="mutedClass">policy.json</span>
                      <div class="flex gap-1">
                        <div class="size-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div class="size-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div class="size-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                      </div>
                    </div>
                    <!-- Textarea -->
                    <textarea
                      class="flex-1 p-4 font-mono text-sm leading-relaxed resize-none outline-none bg-transparent"
                      [class]="editorTextClass"
                      [value]="editorContent()"
                      (input)="editorContent.set($any($event.target).value)"
                      rows="20"
                      spellcheck="false"
                      [readonly]="policy.isSystem"
                      [class.cursor-not-allowed]="policy.isSystem"
                      [class.opacity-70]="policy.isSystem"
                    ></textarea>
                    <!-- Status bar -->
                    <div class="px-3 py-1 border-t flex justify-between text-[10px]" [class]="editorFooterClass">
                      <span>{{ editorLineCol() }}</span>
                      <span>UTF-8</span>
                      <span>JSON</span>
                    </div>
                  </div>
                  } <!-- end @else loadingDetail -->

                  @if (!policy.isSystem) {
                    <div class="flex justify-end gap-3">
                      <button
                        (click)="resetEditor()"
                        [disabled]="!editorDirty()"
                        class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40"
                        [class]="ghostBtnClass"
                      >
                        {{ 'POLICIES.CANCEL_BTN' | translate }}
                      </button>
                      <button
                        (click)="savePolicy()"
                        [disabled]="saving() || loadingDetail() || !editorValid() || !editorDirty()"
                        class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        @if (saving()) {
                          <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        } @else {
                          {{ 'POLICIES.SAVE_BTN' | translate }}
                        }
                      </button>
                    </div>
                  }
                </div>

                <!-- Right column: Attached entities -->
                <div class="flex flex-col gap-6">

                  <!-- Attached Groups -->
                  <div class="rounded-xl border overflow-hidden" [class]="cardClass">
                    <div class="p-4 border-b flex justify-between items-center" [class]="cardHeaderClass">
                      <h3 class="font-semibold text-sm flex items-center gap-2" [class]="titleClass">
                        <span class="material-symbols-outlined text-[18px]" [class]="mutedClass">groups</span>
                        {{ 'POLICIES.ATTACHED_GROUPS' | translate }}
                      </h3>
                      <span class="text-xs px-2 py-0.5 rounded-full" [class]="countBadgeClass">
                        {{ attachedGroups().length }}
                      </span>
                    </div>
                    <div class="p-2">
                      @if (loadingAttachments()) {
                        <div class="flex justify-center py-6">
                          <span class="material-symbols-outlined animate-spin" [class]="mutedClass">progress_activity</span>
                        </div>
                      } @else if (attachedGroups().length === 0) {
                        <p class="text-xs text-center py-4" [class]="mutedClass">{{ 'POLICIES.NO_GROUPS' | translate }}</p>
                      } @else {
                        @for (g of attachedGroups(); track g) {
                          <div class="flex items-center justify-between p-2 rounded-lg group transition-colors" [class]="entityRowClass">
                            <div class="flex items-center gap-3">
                              <div class="size-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0">
                                <span class="material-symbols-outlined text-[16px]">group_work</span>
                              </div>
                              <span class="text-sm font-medium" [class]="titleClass">{{ g }}</span>
                            </div>
                            <button
                              (click)="detachFromGroup(g)"
                              [disabled]="detachingGroup() === g"
                              class="p-1 rounded opacity-0 group-hover:opacity-100 transition-all text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              [title]="'POLICIES.DETACH_GROUP' | translate"
                            >
                              @if (detachingGroup() === g) {
                                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              } @else {
                                <span class="material-symbols-outlined text-[16px]">remove_circle_outline</span>
                              }
                            </button>
                          </div>
                        }
                      }
                      <button
                        (click)="openAttachGroupModal()"
                        class="w-full mt-2 py-2 border border-dashed rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        [class]="attachBtnClass"
                      >
                        <span class="material-symbols-outlined text-[14px]">add</span>
                        {{ 'POLICIES.ATTACH_GROUP_BTN' | translate }}
                      </button>
                    </div>
                  </div>

                  <!-- Attach User -->
                  <div class="rounded-xl border overflow-hidden" [class]="cardClass">
                    <div class="p-4 border-b flex justify-between items-center" [class]="cardHeaderClass">
                      <h3 class="font-semibold text-sm flex items-center gap-2" [class]="titleClass">
                        <span class="material-symbols-outlined text-[18px]" [class]="mutedClass">person</span>
                        {{ 'POLICIES.ATTACHED_USERS' | translate }}
                      </h3>
                    </div>
                    <div class="p-3">
                      <button
                        (click)="openAttachUserModal()"
                        class="w-full py-2 border border-dashed rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        [class]="attachBtnClass"
                      >
                        <span class="material-symbols-outlined text-[14px]">add</span>
                        {{ 'POLICIES.ATTACH_USER_BTN' | translate }}
                      </button>
                      <p class="text-[11px] text-center mt-2 px-2" [class]="mutedClass">
                        {{ 'POLICIES.ATTACH_USER_NOTE' | translate }}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            } @else {
              <!-- Policy Usage tab placeholder -->
              <div class="flex flex-col items-center justify-center py-24 gap-4">
                <div class="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span class="material-symbols-outlined text-[32px]">analytics</span>
                </div>
                <div class="text-center">
                  <p class="font-semibold" [class]="titleClass">{{ 'POLICIES.USAGE_COMING_SOON' | translate }}</p>
                  <p class="text-sm mt-1" [class]="mutedClass">{{ 'POLICIES.USAGE_COMING_SOON_DESC' | translate }}</p>
                </div>
              </div>
            }

          </div>

        } @else {
          <!-- Empty state -->
          <div class="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div class="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[32px]">policy</span>
            </div>
            <div class="text-center">
              <p class="font-semibold text-lg" [class]="titleClass">{{ 'POLICIES.SELECT_PROMPT' | translate }}</p>
              <p class="text-sm mt-1" [class]="mutedClass">{{ 'POLICIES.SELECT_PROMPT_DESC' | translate }}</p>
            </div>
          </div>
        }

      </main>
    </div>

    <!-- ───── Create Policy Modal ───── -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" (click)="closeCreateModal()"></div>
        <div class="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden" [class]="modalClass">
          <div class="px-6 py-4 border-b flex items-center justify-between" [class]="borderClass">
            <h2 class="text-base font-semibold" [class]="titleClass">{{ 'POLICIES.CREATE_MODAL_TITLE' | translate }}</h2>
            <button (click)="closeCreateModal()" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1.5" [class]="titleClass">
                {{ 'POLICIES.CREATE_NAME_LABEL' | translate }}
              </label>
              <input
                type="text"
                [placeholder]="'POLICIES.CREATE_NAME_PLACEHOLDER' | translate"
                [value]="createName()"
                (input)="createName.set($any($event.target).value)"
                class="w-full px-3 py-2 text-sm rounded-lg outline-none border"
                [class]="filterInputClass"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5" [class]="titleClass">
                {{ 'POLICIES.CREATE_DOCUMENT_LABEL' | translate }}
              </label>
              <div class="rounded-lg border overflow-hidden" [class]="editorContainerClass">
                <div class="flex items-center justify-between px-4 py-2 border-b" [class]="editorHeaderClass">
                  <span class="text-xs font-mono" [class]="mutedClass">policy.json</span>
                  @if (createDocumentValid()) {
                    <span class="text-xs text-green-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[13px]">check_circle</span>
                      {{ 'POLICIES.JSON_VALID' | translate }}
                    </span>
                  } @else {
                    <span class="text-xs text-red-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[13px]">error</span>
                      {{ 'POLICIES.JSON_INVALID' | translate }}
                    </span>
                  }
                </div>
                <textarea
                  [placeholder]="'POLICIES.CREATE_DOCUMENT_PLACEHOLDER' | translate"
                  [value]="createDocument()"
                  (input)="createDocument.set($any($event.target).value)"
                  class="w-full p-4 text-sm font-mono rounded-none outline-none bg-transparent resize-none"
                  [class]="editorTextClass"
                  rows="14"
                  spellcheck="false"
                ></textarea>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t flex justify-end gap-3" [class]="borderClass">
            <button
              (click)="closeCreateModal()"
              class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              [class]="ghostBtnClass"
            >
              {{ 'POLICIES.CREATE_CANCEL' | translate }}
            </button>
            <button
              (click)="submitCreatePolicy()"
              [disabled]="creating() || !createName().trim() || !createDocumentValid()"
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              @if (creating()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              } @else {
                {{ 'POLICIES.CREATE_SUBMIT' | translate }}
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ───── Delete Confirm Modal ───── -->
    @if (showDeleteConfirm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" (click)="showDeleteConfirm.set(null)"></div>
        <div class="relative w-full max-w-sm rounded-2xl border shadow-2xl" [class]="modalClass">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <span class="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <h2 class="text-base font-semibold" [class]="titleClass">{{ 'POLICIES.DELETE_TITLE' | translate }}</h2>
            </div>
            <p class="text-sm mb-6" [class]="mutedClass">{{ 'POLICIES.DELETE_MESSAGE' | translate }}</p>
            <div class="flex justify-end gap-3">
              <button
                (click)="showDeleteConfirm.set(null)"
                class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                [class]="ghostBtnClass"
              >
                {{ 'POLICIES.DELETE_CANCEL' | translate }}
              </button>
              <button
                (click)="confirmDeletePolicy()"
                [disabled]="deleting()"
                class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                @if (deleting()) {
                  <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                } @else {
                  {{ 'POLICIES.DELETE_CONFIRM' | translate }}
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ───── Attach Group Modal ───── -->
    @if (showAttachGroupModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" (click)="showAttachGroupModal.set(false)"></div>
        <div class="relative w-full max-w-md rounded-2xl border shadow-2xl" [class]="modalClass">
          <div class="px-6 py-4 border-b flex items-center justify-between" [class]="borderClass">
            <h2 class="text-base font-semibold" [class]="titleClass">{{ 'POLICIES.ATTACH_GROUP_TITLE' | translate }}</h2>
            <button (click)="showAttachGroupModal.set(false)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="p-4 max-h-80 overflow-y-auto">
            @if (availableGroupsToAttach().length === 0) {
              <p class="text-sm text-center py-8" [class]="mutedClass">{{ 'POLICIES.NO_AVAILABLE_GROUPS' | translate }}</p>
            } @else {
              @for (g of availableGroupsToAttach(); track g) {
                <div
                  (click)="attachToGroup(g)"
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1"
                  [class]="entityRowClass"
                >
                  <div class="size-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0">
                    <span class="material-symbols-outlined text-[16px]">group_work</span>
                  </div>
                  <span class="text-sm font-medium flex-1" [class]="titleClass">{{ g }}</span>
                  @if (attachingGroup() === g) {
                    <span class="material-symbols-outlined text-[16px] animate-spin" [class]="mutedClass">progress_activity</span>
                  } @else {
                    <span class="material-symbols-outlined text-[16px]" [class]="mutedClass">add_circle</span>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    }

    <!-- ───── Attach User Modal ───── -->
    @if (showAttachUserModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60" (click)="showAttachUserModal.set(false)"></div>
        <div class="relative w-full max-w-md rounded-2xl border shadow-2xl" [class]="modalClass">
          <div class="px-6 py-4 border-b flex items-center justify-between" [class]="borderClass">
            <h2 class="text-base font-semibold" [class]="titleClass">{{ 'POLICIES.ATTACH_USER_MODAL_TITLE' | translate }}</h2>
            <button (click)="showAttachUserModal.set(false)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="px-4 py-3 border-b" [class]="borderClass">
            <input
              type="text"
              [placeholder]="'POLICIES.SEARCH_USERS_PLACEHOLDER' | translate"
              [value]="userSearchText()"
              (input)="userSearchText.set($any($event.target).value)"
              class="w-full px-3 py-2 text-sm rounded-lg outline-none border"
              [class]="filterInputClass"
            />
          </div>
          <div class="p-4 max-h-72 overflow-y-auto">
            @if (loadingUsers()) {
              <div class="flex justify-center py-8">
                <span class="material-symbols-outlined animate-spin" [class]="mutedClass">progress_activity</span>
              </div>
            } @else if (filteredAvailableUsers().length === 0) {
              <p class="text-sm text-center py-8" [class]="mutedClass">{{ 'POLICIES.NO_AVAILABLE_USERS' | translate }}</p>
            } @else {
              @for (u of filteredAvailableUsers(); track u) {
                <div
                  (click)="attachToUser(u)"
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1"
                  [class]="entityRowClass"
                >
                  <div class="size-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs text-white font-bold shrink-0">
                    {{ u.slice(0, 2).toUpperCase() }}
                  </div>
                  <span class="text-sm font-medium flex-1" [class]="titleClass">{{ u }}</span>
                  @if (attachingUser() === u) {
                    <span class="material-symbols-outlined text-[16px] animate-spin" [class]="mutedClass">progress_activity</span>
                  } @else {
                    <span class="material-symbols-outlined text-[16px]" [class]="mutedClass">add_circle</span>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class PoliciesComponent implements OnInit {
  private api = inject(ApiService);
  private theme = inject(ThemeService);
  private layout = inject(LayoutService);
  private toast = inject(ToastService);

  // ─── State ────────────────────────────────────────────────────────────────

  policies = signal<PolicyRow[]>([]);
  loading = signal(false);
  selectedPolicy = signal<PolicyRow | null>(null);
  filterText = signal('');
  filterTab = signal<'all' | 'custom' | 'system'>('all');

  // Editor
  loadingDetail = signal(false);
  editorContent = signal('');
  editorOriginalContent = signal('');
  editorDirty = computed(() => this.editorContent() !== this.editorOriginalContent());
  editorValid = computed(() => {
    try { JSON.parse(this.editorContent()); return true; } catch { return false; }
  });
  editorLineCol = computed(() => {
    const lines = this.editorContent().split('\n').length;
    return `Ln ${lines}, Col 1`;
  });
  saving = signal(false);

  // Create modal
  showCreateModal = signal(false);
  createName = signal('');
  createDocument = signal(DEFAULT_DOCUMENT);
  creating = signal(false);
  createDocumentValid = computed(() => {
    try { JSON.parse(this.createDocument()); return true; } catch { return false; }
  });

  // Delete modal
  showDeleteConfirm = signal<string | null>(null);
  deleting = signal(false);

  // Tabs
  activeTab = signal<'json' | 'usage'>('json');

  // Attached groups
  attachedGroups = signal<string[]>([]);
  allGroups = signal<string[]>([]);
  loadingAttachments = signal(false);
  showAttachGroupModal = signal(false);
  attachingGroup = signal<string | null>(null);
  detachingGroup = signal<string | null>(null);

  // Attach user
  allUsers = signal<string[]>([]);
  loadingUsers = signal(false);
  showAttachUserModal = signal(false);
  attachingUser = signal<string | null>(null);
  userSearchText = signal('');

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly filterTabs = [
    { key: 'all' as const, labelKey: 'POLICIES.FILTER_ALL' },
    { key: 'custom' as const, labelKey: 'POLICIES.FILTER_CUSTOM' },
    { key: 'system' as const, labelKey: 'POLICIES.FILTER_SYSTEM' },
  ];

  filteredPolicies = computed(() => {
    const text = this.filterText().toLowerCase();
    const tab = this.filterTab();
    return this.policies().filter(p => {
      const matchText = !text || p.name.toLowerCase().includes(text);
      const matchTab = tab === 'all' || (tab === 'system' ? p.isSystem : !p.isSystem);
      return matchText && matchTab;
    });
  });

  availableGroupsToAttach = computed(() =>
    this.allGroups().filter(g => !this.attachedGroups().includes(g)),
  );

  filteredAvailableUsers = computed(() => {
    const text = this.userSearchText().toLowerCase();
    return this.allUsers().filter(u => !text || u.toLowerCase().includes(text));
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    this.layout.setTitle('Policies');
    this.loadPolicies();
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async loadPolicies() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.listPolicies()).catch(() => null);
      const rows: PolicyRow[] = (res?.data ?? []).map(p => ({
        name: p.policy,
        isGroup: p.is_group,
        isSystem: SYSTEM_POLICIES.has(p.policy),
        document: p.policy_info?.policy ?? null,
        createDate: p.policy_info?.create_date ?? null,
      }));
      this.policies.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  async selectPolicy(policy: PolicyRow) {
    this.selectedPolicy.set(policy);
    this.activeTab.set('json');
    this.editorContent.set('');
    this.editorOriginalContent.set('');
    this.attachedGroups.set([]);
    this.allGroups.set([]);

    this.loadingDetail.set(true);
    try {
      const res = await firstValueFrom(this.api.getPolicy(policy.name)).catch(() => null);
      const detail = Array.isArray(res?.data) ? res!.data[0] : null;
      const document = detail?.policy_info?.policy ?? policy.document;
      const content = document ? JSON.stringify(document, null, 2) : '{}';

      if (detail) {
        const refreshed: PolicyRow = {
          ...policy,
          document: detail.policy_info?.policy ?? policy.document,
          createDate: detail.policy_info?.create_date || policy.createDate,
        };
        this.selectedPolicy.set(refreshed);
      }

      this.editorContent.set(content);
      this.editorOriginalContent.set(content);
    } finally {
      this.loadingDetail.set(false);
    }

    this.loadAttachments(policy.name);
  }

  async loadAttachments(policyName: string) {
    this.loadingAttachments.set(true);
    try {
      const [groupsRes, policyGroupsRes] = await Promise.all([
        firstValueFrom(this.api.listGroups()).catch(() => null),
        firstValueFrom(this.api.getPolicyGroups(policyName)).catch(() => null),
      ]);

      const allGroupNames = groupsRes?.data?.[0]?.groups ?? [];
      this.allGroups.set(allGroupNames);

      const attached = policyGroupsRes?.data?.[0]?.groups ?? [];
      this.attachedGroups.set(attached);
    } finally {
      this.loadingAttachments.set(false);
    }
  }

  async loadAllUsers() {
    this.loadingUsers.set(true);
    try {
      const res = await firstValueFrom(this.api.listUsers()).catch(() => null);
      const users = (res?.data ?? [])
        .map(u => u.access_key ?? '')
        .filter(Boolean);
      this.allUsers.set(users);
    } finally {
      this.loadingUsers.set(false);
    }
  }

  // ─── Editor actions ───────────────────────────────────────────────────────

  async copyDocument() {
    try { await navigator.clipboard.writeText(this.editorContent()); } catch { /* ignore */ }
  }

  resetEditor() {
    this.editorContent.set(this.editorOriginalContent());
  }

  async savePolicy() {
    const policy = this.selectedPolicy();
    if (!policy || this.saving() || !this.editorValid() || !this.editorDirty()) return;
    this.saving.set(true);
    try {
      let doc: Record<string, unknown>;
      try { doc = JSON.parse(this.editorContent()); } catch { return; }

      // Delete then recreate (no PATCH endpoint)
      await firstValueFrom(this.api.deletePolicy(policy.name)).catch(() => null);
      const res = await firstValueFrom(
        this.api.createPolicy({ name: policy.name, document: doc }),
      ).catch(() => null);

      if (res) {
        this.editorOriginalContent.set(this.editorContent());
        const updated: PolicyRow = { ...policy, document: doc };
        this.selectedPolicy.set(updated);
        this.policies.update(list => list.map(p => p.name === policy.name ? updated : p));
        this.toast.success('Policy saved', `"${policy.name}" was updated successfully`);
      } else {
        this.toast.error('Failed to save policy', 'The server returned an error. Check the policy document.');
      }
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to save policy "${policy.name}"`);
    } finally {
      this.saving.set(false);
    }
  }

  // ─── Create modal ─────────────────────────────────────────────────────────

  openCreateModal() {
    this.createName.set('');
    this.createDocument.set(DEFAULT_DOCUMENT);
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    if (this.creating()) return;
    this.showCreateModal.set(false);
  }

  async submitCreatePolicy() {
    if (this.creating() || !this.createName().trim() || !this.createDocumentValid()) return;
    this.creating.set(true);
    try {
      let doc: Record<string, unknown>;
      try { doc = JSON.parse(this.createDocument()); } catch { return; }

      const res = await firstValueFrom(
        this.api.createPolicy({ name: this.createName().trim(), document: doc }),
      ).catch(() => null);

      if (res) {
        this.toast.success('Policy created', `"${this.createName().trim()}" was created successfully`);
        this.showCreateModal.set(false);
        await this.loadPolicies();
      } else {
        this.toast.error('Failed to create policy', 'The server returned an error. Check the policy document.');
      }
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to create policy "${this.createName().trim()}"`);
    } finally {
      this.creating.set(false);
    }
  }

  // ─── Delete modal ─────────────────────────────────────────────────────────

  async confirmDeletePolicy() {
    const name = this.showDeleteConfirm();
    if (!name || this.deleting()) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.api.deletePolicy(name));
      this.toast.success('Policy deleted', `"${name}" was deleted`);
      this.showDeleteConfirm.set(null);
      if (this.selectedPolicy()?.name === name) this.selectedPolicy.set(null);
      this.policies.update(list => list.filter(p => p.name !== name));
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to delete policy "${name}"`);
    } finally {
      this.deleting.set(false);
    }
  }

  // ─── Attach / detach group ────────────────────────────────────────────────

  openAttachGroupModal() {
    this.showAttachGroupModal.set(true);
  }

  async attachToGroup(groupName: string) {
    const policy = this.selectedPolicy();
    if (!policy || this.attachingGroup()) return;
    this.attachingGroup.set(groupName);
    try {
      await firstValueFrom(
        this.api.attachGroupPolicy({ group: groupName, policy: policy.name }),
      );
      this.attachedGroups.update(g => [...g, groupName]);
      this.showAttachGroupModal.set(false);
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to attach policy to group "${groupName}"`);
    } finally {
      this.attachingGroup.set(null);
    }
  }

  async detachFromGroup(groupName: string) {
    const policy = this.selectedPolicy();
    if (!policy || this.detachingGroup()) return;
    this.detachingGroup.set(groupName);
    try {
      await firstValueFrom(
        this.api.detachGroupPolicy({ group: groupName, policy: policy.name }),
      );
      this.attachedGroups.update(g => g.filter(x => x !== groupName));
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to detach policy from group "${groupName}"`);
    } finally {
      this.detachingGroup.set(null);
    }
  }

  // ─── Attach user ──────────────────────────────────────────────────────────

  openAttachUserModal() {
    this.userSearchText.set('');
    this.showAttachUserModal.set(true);
    this.loadAllUsers();
  }

  async attachToUser(username: string) {
    const policy = this.selectedPolicy();
    if (!policy || this.attachingUser()) return;
    this.attachingUser.set(username);
    try {
      await firstValueFrom(
        this.api.attachPolicy({ policy: policy.name, username }),
      );
      this.showAttachUserModal.set(false);
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to attach policy to user "${username}"`);
    } finally {
      this.attachingUser.set(null);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch { return dateStr; }
  }

  // ─── Theme classes ────────────────────────────────────────────────────────

  private get dark(): boolean {
    return this.theme.mode() !== 'light';
  }

  get titleClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  get mutedClass(): string {
    return this.dark ? 'text-slate-400' : 'text-slate-500';
  }

  get sidebarClass(): string {
    return this.dark ? 'bg-[#111722] border-border-dark' : 'bg-white border-slate-200';
  }

  get mainBgClass(): string {
    return this.dark ? 'bg-background-dark' : 'bg-background-light';
  }

  get headerClass(): string {
    return this.dark ? 'bg-[#111722] border-border-dark' : 'bg-white border-slate-200';
  }

  get borderClass(): string {
    return this.dark ? 'border-border-dark' : 'border-slate-200';
  }

  get filterInputClass(): string {
    return this.dark
      ? 'bg-panel-dark border-border-dark text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary';
  }

  get activeTabClass(): string {
    return 'bg-primary text-white';
  }

  get inactiveTabClass(): string {
    return this.dark
      ? 'bg-panel-dark text-slate-400 hover:text-white hover:bg-[#232f48]'
      : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200';
  }

  get skeletonClass(): string {
    return this.dark ? 'bg-white/5' : 'bg-slate-200';
  }

  get cardClass(): string {
    return this.dark ? 'bg-panel-dark border-border-dark' : 'bg-white border-slate-200';
  }

  get cardHeaderClass(): string {
    return this.dark ? 'bg-[#1c2536] border-border-dark' : 'bg-slate-50 border-slate-200';
  }

  get countBadgeClass(): string {
    return this.dark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-200 text-slate-600';
  }

  get entityRowClass(): string {
    return this.dark ? 'hover:bg-[#232f48]' : 'hover:bg-slate-50';
  }

  get attachBtnClass(): string {
    return this.dark
      ? 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-400'
      : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400';
  }

  get editorContainerClass(): string {
    return this.dark ? 'bg-[#0d1117] border-border-dark' : 'bg-slate-50 border-slate-200';
  }

  get editorHeaderClass(): string {
    return this.dark ? 'bg-[#161b22] border-border-dark' : 'bg-slate-100 border-slate-200';
  }

  get editorTextClass(): string {
    return this.dark ? 'text-slate-300' : 'text-slate-700';
  }

  get editorFooterClass(): string {
    return this.dark
      ? 'bg-[#161b22] border-border-dark text-slate-500'
      : 'bg-slate-100 border-slate-200 text-slate-500';
  }

  get ghostBtnClass(): string {
    return this.dark
      ? 'border-border-dark text-slate-300 hover:text-white hover:bg-panel-dark'
      : 'border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100';
  }

  get ghostBtnSmClass(): string {
    return this.dark
      ? 'text-slate-400 hover:text-white bg-panel-dark border-border-dark hover:border-slate-500'
      : 'text-slate-500 hover:text-slate-900 bg-slate-100 border-slate-300 hover:border-slate-400';
  }

  get ghostIconClass(): string {
    return this.dark
      ? 'text-slate-400 hover:text-white hover:bg-white/5'
      : 'text-slate-500 hover:text-slate-900 hover:bg-black/5';
  }

  get modalClass(): string {
    return this.dark ? 'bg-[#18202F] border-border-dark' : 'bg-white border-slate-200';
  }

  policyItemClass(name: string): string {
    const isSelected = this.selectedPolicy()?.name === name;
    if (isSelected) {
      return this.dark
        ? 'bg-primary/10 border-l-4 border-l-primary border-border-dark'
        : 'bg-primary/5 border-l-4 border-l-primary border-slate-200';
    }
    return this.dark
      ? 'border-border-dark hover:bg-panel-dark'
      : 'border-slate-200 hover:bg-slate-50';
  }
}
