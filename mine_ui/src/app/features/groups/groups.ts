import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import type { GroupResponse, UserResponse } from '../../core/api/api.types';

interface UserRow extends UserResponse { username: string; }

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex h-full overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Page header -->
        <div class="px-8 py-6 border-b shrink-0" [class]="headerClass">
          <p class="text-xs font-medium flex items-center gap-1 mb-1" [class]="mutedClass">
            <span class="material-symbols-outlined text-[14px]">groups</span>
            {{ 'GROUPS.BREADCRUMB' | translate }}
          </p>
          <div class="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 class="text-2xl font-bold" [class]="titleClass">{{ 'GROUPS.TITLE' | translate }}</h1>
              <p class="text-sm mt-0.5" [class]="mutedClass">{{ 'GROUPS.SUBTITLE' | translate }}</p>
            </div>
            <button
              (click)="openCreateModal()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
              {{ 'GROUPS.CREATE_BTN' | translate }}
            </button>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="px-8 py-3 border-b shrink-0 flex items-center gap-3" [class]="filterBarClass">
          <div class="relative flex-1 max-w-sm">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" [class]="mutedClass">
              <span class="material-symbols-outlined text-[18px]">search</span>
            </span>
            <input
              type="text"
              [placeholder]="'GROUPS.SEARCH_PLACEHOLDER' | translate"
              [value]="filterText()"
              (input)="onFilterChange($any($event.target).value)"
              class="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none"
              [class]="filterInputClass"
            />
          </div>
          <button
            (click)="loadGroups()"
            class="p-2 rounded-lg transition-colors"
            [class]="ghostIconClass"
            [title]="'GROUPS.REFRESH' | translate"
          >
            <span class="material-symbols-outlined text-[18px]" [class]="loading() ? 'animate-spin' : ''">
              {{ loading() ? 'progress_activity' : 'refresh' }}
            </span>
          </button>
        </div>

        <!-- Content area: table + detail panel -->
        <div class="flex-1 flex gap-6 overflow-hidden px-8 py-6">

          <!-- Table column -->
          <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
            @if (loading()) {
              <div class="space-y-3">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="h-14 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                }
              </div>
            } @else if (filteredGroups().length === 0) {
              <div class="flex flex-col items-center justify-center py-24 gap-3">
                <span class="material-symbols-outlined text-[48px]" [class]="mutedClass">groups</span>
                <p class="text-sm" [class]="mutedClass">
                  {{ filterText() ? ('GROUPS.NO_RESULTS' | translate) : ('GROUPS.EMPTY' | translate) }}
                </p>
              </div>
            } @else {
              <div class="flex-1 rounded-xl border overflow-hidden flex flex-col" [class]="tableWrapClass">
                <div class="flex-1 overflow-auto">
                  <table class="min-w-full divide-y" [class]="dividerClass">
                    <thead [class]="theadClass">
                      <tr>
                        <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                          {{ 'GROUPS.COL_NAME' | translate }}
                        </th>
                        <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                          {{ 'GROUPS.COL_MEMBERS' | translate }}
                        </th>
                        <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                          {{ 'GROUPS.COL_STATUS' | translate }}
                        </th>
                        <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                          {{ 'GROUPS.COL_POLICIES' | translate }}
                        </th>
                        <th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                          {{ 'GROUPS.COL_ACTIONS' | translate }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y" [class]="dividerClass">
                      @for (name of pagedGroups(); track name) {
                        <tr
                          (click)="selectGroup(name)"
                          class="transition-colors cursor-pointer"
                          [class]="rowClass(name)"
                        >
                          <!-- Name -->
                          <td class="px-5 py-3 whitespace-nowrap">
                            <div class="flex items-center gap-2">
                              <span class="material-symbols-outlined text-[18px]"
                                [class]="selectedGroup()?.group_name === name ? 'text-primary' : mutedClass">
                                groups
                              </span>
                              <span class="text-sm font-medium"
                                [class]="selectedGroup()?.group_name === name ? 'text-primary' : titleClass">
                                {{ name }}
                              </span>
                            </div>
                          </td>

                          <!-- Members -->
                          <td class="px-5 py-3 whitespace-nowrap">
                            @if (groupsDetailMap().get(name); as detail) {
                              <span class="text-sm" [class]="mutedClass">
                                {{ detail.members?.length ?? 0 }} {{ 'GROUPS.MEMBERS_LABEL' | translate }}
                              </span>
                            } @else {
                              <span class="text-sm" [class]="mutedClass">—</span>
                            }
                          </td>

                          <!-- Status -->
                          <td class="px-5 py-3 whitespace-nowrap">
                            @if (groupsDetailMap().get(name); as detail) {
                              @if (detail.status.toLowerCase() === 'enabled') {
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  {{ 'GROUPS.STATUS_ENABLED' | translate }}
                                </span>
                              } @else {
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-400/10 text-slate-400 ring-1 ring-inset ring-slate-400/20">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  {{ 'GROUPS.STATUS_DISABLED' | translate }}
                                </span>
                              }
                            } @else {
                              <span class="text-sm" [class]="mutedClass">—</span>
                            }
                          </td>

                          <!-- Policies -->
                          <td class="px-5 py-3">
                            @if (groupsPoliciesMap().get(name)?.length) {
                              <div class="flex flex-wrap gap-1">
                                @for (p of groupsPoliciesMap().get(name)!.slice(0, 2); track p) {
                                  <span [class]="policyBadgeClass">{{ p }}</span>
                                }
                                @if (groupsPoliciesMap().get(name)!.length > 2) {
                                  <span [class]="policyBadgeClass">+{{ groupsPoliciesMap().get(name)!.length - 2 }}</span>
                                }
                              </div>
                            } @else {
                              <span class="text-sm" [class]="mutedClass">—</span>
                            }
                          </td>

                          <!-- Actions -->
                          <td class="px-5 py-3 whitespace-nowrap text-right" (click)="$event.stopPropagation()">
                            <button
                              (click)="showDeleteConfirmGroup.set(name)"
                              class="p-1.5 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              [title]="'GROUPS.DELETE_GROUP' | translate"
                            >
                              <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Pagination footer -->
                <div class="shrink-0 border-t px-5 py-3 flex items-center justify-between" [class]="tableFooterClass">
                  <p class="text-xs" [class]="mutedClass">
                    {{ 'GROUPS.PAGE_SHOWING' | translate : { from: pageFrom(), to: pageTo(), total: filteredGroups().length } }}
                  </p>
                  @if (totalPages() > 1) {
                    <div class="flex items-center gap-1">
                      <button
                        (click)="groupsPage.set(groupsPage() - 1)"
                        [disabled]="groupsPage() === 0"
                        class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                        [class]="ghostIconClass"
                      >
                        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <span class="text-xs px-2 tabular-nums" [class]="mutedClass">
                        {{ groupsPage() + 1 }} / {{ totalPages() }}
                      </span>
                      <button
                        (click)="groupsPage.set(groupsPage() + 1)"
                        [disabled]="groupsPage() >= totalPages() - 1"
                        class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                        [class]="ghostIconClass"
                      >
                        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Detail panel -->
          @if (selectedGroup()) {
            <div class="w-[420px] shrink-0 overflow-y-auto flex flex-col gap-4 pb-2">

              <!-- Header card -->
              <div class="rounded-xl border p-5 shrink-0" [class]="cardClass">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <span class="material-symbols-outlined text-[22px]">groups</span>
                    </div>
                    <div>
                      <h2 class="text-base font-semibold leading-tight" [class]="titleClass">
                        {{ selectedGroup()!.group_name }}
                      </h2>
                      <div class="mt-1">
                        @if (selectedGroup()!.status.toLowerCase() === 'enabled') {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {{ 'GROUPS.STATUS_ENABLED' | translate }}
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-400/10 text-slate-400 ring-1 ring-inset ring-slate-400/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {{ 'GROUPS.STATUS_DISABLED' | translate }}
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                  <button (click)="selectedGroup.set(null)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <!-- Quick actions -->
                <div class="flex gap-2">
                  <button
                    (click)="toggleGroup()"
                    [disabled]="enablingGroup()"
                    class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                    [class]="ghostBtnClass"
                  >
                    @if (enablingGroup()) {
                      <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    } @else {
                      <span class="material-symbols-outlined text-[14px]">
                        {{ selectedGroup()!.status.toLowerCase() === 'enabled' ? 'block' : 'check_circle' }}
                      </span>
                    }
                    {{ selectedGroup()!.status.toLowerCase() === 'enabled' ? ('GROUPS.DISABLE_GROUP' | translate) : ('GROUPS.ENABLE_GROUP' | translate) }}
                  </button>
                  <button
                    (click)="showDeleteConfirmGroup.set(selectedGroup()!.group_name)"
                    class="p-1.5 rounded-lg border transition-colors text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    [class]="borderClass"
                    [title]="'GROUPS.DELETE_GROUP' | translate"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              <!-- Members card -->
              <div class="rounded-xl border flex flex-col overflow-hidden shrink-0" [class]="cardClass">
                <div class="px-5 py-3 border-b flex items-center justify-between" [class]="borderClass">
                  <h3 class="text-sm font-semibold" [class]="titleClass">
                    {{ 'GROUPS.SECTION_MEMBERS' | translate }}
                    <span class="ml-1 text-[10px] font-normal" [class]="mutedClass">
                      ({{ selectedGroup()!.members?.length ?? 0 }})
                    </span>
                  </h3>
                  <button
                    (click)="openAddMemberModal()"
                    class="text-[11px] font-medium flex items-center gap-0.5 transition-colors hover:text-primary"
                    [class]="mutedClass"
                  >
                    <span class="material-symbols-outlined text-[14px]">person_add</span>
                    {{ 'GROUPS.ADD_MEMBER' | translate }}
                  </button>
                </div>
                @if (detailLoading()) {
                  <div class="p-4 space-y-2">
                    @for (i of [1,2,3]; track i) {
                      <div class="h-10 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                    }
                  </div>
                } @else if (!selectedGroup()!.members?.length) {
                  <p class="p-4 text-xs" [class]="mutedClass">{{ 'GROUPS.MEMBERS_EMPTY' | translate }}</p>
                } @else {
                  <ul class="divide-y max-h-56 overflow-y-auto" [class]="dividerClass">
                    @for (member of selectedGroup()!.members!; track member) {
                      <li class="flex items-center justify-between px-4 py-2.5 group hover:bg-white/3 transition-colors">
                        <div class="flex items-center gap-2.5">
                          <div class="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            [class]="avatarClass(member)">
                            {{ initials(member) }}
                          </div>
                          <span class="text-sm font-mono" [class]="subtleClass">{{ member }}</span>
                        </div>
                        <button
                          (click)="removeMember(member)"
                          [disabled]="removingMember() === member"
                          class="p-1 rounded transition-colors text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-40"
                          [title]="'GROUPS.REMOVE_MEMBER' | translate"
                        >
                          @if (removingMember() === member) {
                            <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          } @else {
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                          }
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>

              <!-- Policies card -->
              <div class="rounded-xl border flex flex-col overflow-hidden shrink-0" [class]="cardClass">
                <div class="px-5 py-3 border-b flex items-center justify-between" [class]="borderClass">
                  <h3 class="text-sm font-semibold" [class]="titleClass">
                    {{ 'GROUPS.SECTION_POLICIES' | translate }}
                    <span class="ml-1 text-[10px] font-normal" [class]="mutedClass">
                      ({{ groupPolicies().length }})
                    </span>
                  </h3>
                  <button
                    (click)="openAttachPolicyModal()"
                    class="text-[11px] font-medium flex items-center gap-0.5 transition-colors hover:text-primary"
                    [class]="mutedClass"
                  >
                    <span class="material-symbols-outlined text-[14px]">link</span>
                    {{ 'GROUPS.ATTACH_POLICY' | translate }}
                  </button>
                </div>
                @if (detailLoading()) {
                  <div class="p-4 space-y-2">
                    @for (i of [1,2]; track i) {
                      <div class="h-12 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                    }
                  </div>
                } @else if (groupPolicies().length === 0) {
                  <p class="p-4 text-xs" [class]="mutedClass">{{ 'GROUPS.POLICIES_EMPTY' | translate }}</p>
                } @else {
                  <div class="p-3 space-y-2 max-h-56 overflow-y-auto">
                    @for (policy of groupPolicies(); track policy) {
                      <div class="flex items-center justify-between p-3 rounded-lg border" [class]="borderClass">
                        <div class="flex items-center gap-2">
                          <span class="material-symbols-outlined text-[16px]" [class]="mutedClass">description</span>
                          <span class="text-sm font-medium" [class]="subtleClass">{{ policy }}</span>
                        </div>
                        <button
                          (click)="detachPolicy(policy)"
                          [disabled]="detachingPolicy() === policy"
                          class="p-1 rounded transition-colors text-slate-500 hover:text-red-400 disabled:opacity-40"
                          [title]="'GROUPS.DETACH_POLICY' | translate"
                        >
                          @if (detachingPolicy() === policy) {
                            <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          } @else {
                            <span class="material-symbols-outlined text-[14px]">do_not_disturb_on</span>
                          }
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

            </div>
          }

        </div>
      </div>
    </div>

    <!-- ── Create Group Modal ───────────────────────────────────────── -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" (click)="closeCreateModal()">
        <div [class]="modalClass" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <h3 class="text-base font-semibold" [class]="titleClass">{{ 'GROUPS.CREATE_MODAL_TITLE' | translate }}</h3>
            <button (click)="closeCreateModal()" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="px-6 pt-5 pb-3 space-y-4">
            <!-- Group name -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider mb-1.5" [class]="mutedClass">
                {{ 'GROUPS.CREATE_NAME_LABEL' | translate }}
              </label>
              <input
                type="text"
                [value]="createGroupName()"
                (input)="createGroupName.set($any($event.target).value)"
                [placeholder]="'GROUPS.CREATE_NAME_PLACEHOLDER' | translate"
                class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                [class]="inputClass"
              />
            </div>

            <!-- User selection -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider mb-1.5" [class]="mutedClass">
                {{ 'GROUPS.ADD_MEMBER_TITLE' | translate }}
              </label>

              <!-- Search -->
              <div class="relative mb-2">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" [class]="mutedClass">
                  <span class="material-symbols-outlined text-[16px]">search</span>
                </span>
                <input
                  type="text"
                  [value]="createGroupUserSearch()"
                  (input)="createGroupUserSearch.set($any($event.target).value)"
                  [placeholder]="'GROUPS.ADD_MEMBER_PLACEHOLDER' | translate"
                  class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none focus:border-primary"
                  [class]="inputClass"
                />
              </div>

              <!-- User list -->
              <div class="rounded-lg border overflow-hidden" [class]="borderClass" style="max-height:220px;overflow-y:auto">
                @if (createGroupUsersLoading()) {
                  <div class="flex items-center justify-center py-6">
                    <span class="material-symbols-outlined text-[20px] animate-spin" [class]="mutedClass">progress_activity</span>
                  </div>
                } @else if (filteredCreateGroupUsers().length === 0) {
                  <p class="p-4 text-xs text-center" [class]="mutedClass">
                    {{ createGroupUserSearch() ? ('GROUPS.NO_RESULTS' | translate) : ('USERS.EMPTY' | translate) }}
                  </p>
                } @else {
                  <ul class="divide-y" [class]="dividerClass">
                    @for (user of filteredCreateGroupUsers(); track user.username) {
                      <li
                        (click)="toggleCreateGroupUser(user.username)"
                        class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                        [class]="createGroupSelectedUsers().has(user.username) ? (dark ? 'bg-primary/10' : 'bg-primary/5') : (dark ? 'hover:bg-white/5' : 'hover:bg-black/5')"
                      >
                        <span class="flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors"
                          [class]="createGroupSelectedUsers().has(user.username) ? 'bg-primary border-primary' : (dark ? 'border-slate-600' : 'border-slate-300')"
                        >
                          @if (createGroupSelectedUsers().has(user.username)) {
                            <span class="material-symbols-outlined text-[11px] text-white">check</span>
                          }
                        </span>
                        <span class="text-sm font-mono flex-1 truncate" [class]="subtleClass">{{ user.username }}</span>
                      </li>
                    }
                  </ul>
                }
              </div>

              @if (createGroupSelectedUsers().size > 0) {
                <p class="mt-1.5 text-xs" [class]="mutedClass">
                  {{ createGroupSelectedUsers().size }} {{ 'GROUPS.ADD_MEMBER_SELECTED' | translate }}
                </p>
              }
            </div>
          </div>

          <div class="px-6 py-4 border-t flex items-center justify-end gap-3 shrink-0" [class]="borderClass">
            <button (click)="closeCreateModal()" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'GROUPS.CREATE_CANCEL' | translate }}
            </button>
            <button
              (click)="submitCreateGroup()"
              [disabled]="creating() || !createGroupName().trim()"
              class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (creating()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'GROUPS.CREATE_SUBMIT' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Add Member Modal ─────────────────────────────────────────── -->
    @if (showAddMemberModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" (click)="showAddMemberModal.set(false)">
        <div [class]="modalClass" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <h3 class="text-base font-semibold" [class]="titleClass">{{ 'GROUPS.ADD_MEMBER_TITLE' | translate }}</h3>
            <button (click)="showAddMemberModal.set(false)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Search box -->
          <div class="px-6 pt-4 pb-2">
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none" [class]="mutedClass">
                <span class="material-symbols-outlined text-[16px]">search</span>
              </span>
              <input
                type="text"
                [value]="memberSearchText()"
                (input)="memberSearchText.set($any($event.target).value)"
                [placeholder]="'GROUPS.ADD_MEMBER_PLACEHOLDER' | translate"
                class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none focus:border-primary"
                [class]="inputClass"
              />
            </div>
          </div>

          <!-- User list -->
          <div class="overflow-y-auto mx-6 mb-2 rounded-lg border" [class]="borderClass" style="max-height:280px">
            @if (usersLoadingForModal()) {
              <div class="flex items-center justify-center py-8">
                <span class="material-symbols-outlined text-[22px] animate-spin" [class]="mutedClass">progress_activity</span>
              </div>
            } @else if (filteredUsersForModal().length === 0) {
              <p class="p-4 text-xs text-center" [class]="mutedClass">
                {{ memberSearchText() ? ('GROUPS.NO_RESULTS' | translate) : ('GROUPS.MEMBERS_ALL_ADDED' | translate) }}
              </p>
            } @else {
              <ul class="divide-y" [class]="dividerClass">
                @for (user of filteredUsersForModal(); track user.username) {
                  <li
                    (click)="toggleUserSelection(user.username)"
                    class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    [class]="selectedUsersToAdd().has(user.username) ? (dark ? 'bg-primary/10' : 'bg-primary/5') : (dark ? 'hover:bg-white/5' : 'hover:bg-black/5')"
                  >
                    <!-- Checkbox visual -->
                    <span class="flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors"
                      [class]="selectedUsersToAdd().has(user.username) ? 'bg-primary border-primary' : (dark ? 'border-slate-600' : 'border-slate-300')"
                    >
                      @if (selectedUsersToAdd().has(user.username)) {
                        <span class="material-symbols-outlined text-[11px] text-white">check</span>
                      }
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm truncate font-medium" [class]="titleClass">{{ user.username }}</p>
                      @if (user.status) {
                        <p class="text-[11px] truncate" [class]="mutedClass">{{ user.status }}</p>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Selection count -->
          @if (selectedUsersToAdd().size > 0) {
            <p class="px-6 pb-1 text-xs" [class]="mutedClass">
              {{ selectedUsersToAdd().size }} {{ 'GROUPS.ADD_MEMBER_SELECTED' | translate }}
            </p>
          }

          <!-- Footer -->
          <div class="px-6 py-4 border-t flex items-center justify-end gap-3 shrink-0" [class]="borderClass">
            <button (click)="showAddMemberModal.set(false)" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'GROUPS.ADD_MEMBER_CANCEL' | translate }}
            </button>
            <button
              (click)="submitAddMember()"
              [disabled]="addingMember() || selectedUsersToAdd().size === 0"
              class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (addingMember()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'GROUPS.ADD_MEMBER_SUBMIT' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Attach Policy Modal ──────────────────────────────────────── -->
    @if (showAttachPolicyModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" (click)="showAttachPolicyModal.set(false)">
        <div [class]="modalClass" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <h3 class="text-base font-semibold" [class]="titleClass">{{ 'GROUPS.ATTACH_POLICY_TITLE' | translate }}</h3>
            <button (click)="showAttachPolicyModal.set(false)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="px-6 py-5">
            @if (policiesLoading()) {
              <div class="space-y-2">
                @for (i of [1,2,3]; track i) {
                  <div class="h-10 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                }
              </div>
            } @else if (availablePolicies().length === 0) {
              <p class="text-sm text-center py-4" [class]="mutedClass">
                {{ 'GROUPS.NO_AVAILABLE_POLICIES' | translate }}
              </p>
            } @else {
              <div class="space-y-2 max-h-72 overflow-y-auto">
                @for (policy of availablePolicies(); track policy) {
                  <button
                    (click)="selectedPolicyToAttach.set(policy)"
                    class="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors"
                    [class]="selectedPolicyToAttach() === policy ? 'border-primary bg-primary/10' : borderClass"
                  >
                    <span class="material-symbols-outlined text-[18px]"
                      [class]="selectedPolicyToAttach() === policy ? 'text-primary' : mutedClass">
                      description
                    </span>
                    <span class="text-sm font-medium flex-1"
                      [class]="selectedPolicyToAttach() === policy ? 'text-primary' : subtleClass">
                      {{ policy }}
                    </span>
                    @if (selectedPolicyToAttach() === policy) {
                      <span class="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                    }
                  </button>
                }
              </div>
            }
          </div>
          <div class="px-6 py-4 border-t flex items-center justify-end gap-3 shrink-0" [class]="borderClass">
            <button (click)="showAttachPolicyModal.set(false)" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'GROUPS.ATTACH_POLICY_CANCEL' | translate }}
            </button>
            <button
              (click)="submitAttachPolicy()"
              [disabled]="attachingPolicy() || !selectedPolicyToAttach()"
              class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (attachingPolicy()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'GROUPS.ATTACH_POLICY_SUBMIT' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Delete Confirmation ──────────────────────────────────────── -->
    @if (showDeleteConfirmGroup()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" (click)="showDeleteConfirmGroup.set(null)">
        <div [class]="confirmDialogClass" (click)="$event.stopPropagation()">
          <div class="flex items-start gap-4 p-6">
            <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-red-500">delete_forever</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold mb-1" [class]="titleClass">{{ 'GROUPS.DELETE_TITLE' | translate }}</h3>
              <p class="text-sm mb-1" [class]="mutedClass">{{ 'GROUPS.DELETE_MESSAGE' | translate }}</p>
              <p class="text-sm font-mono font-semibold text-red-400">{{ showDeleteConfirmGroup() }}</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t" [class]="borderClass">
            <button (click)="showDeleteConfirmGroup.set(null)" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'GROUPS.DELETE_CANCEL' | translate }}
            </button>
            <button
              (click)="confirmDeleteGroup()"
              [disabled]="deletingGroup()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-40"
            >
              @if (deletingGroup()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'GROUPS.DELETE_CONFIRM' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GroupsComponent implements OnInit {
  private api = inject(ApiService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  private toast = inject(ToastService);

  readonly groups = signal<string[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly selectedGroup = signal<GroupResponse | null>(null);
  readonly selectedGroupName = signal<string | null>(null);
  readonly detailLoading = signal(false);
  readonly groupPolicies = signal<string[]>([]);
  readonly groupsDetailMap = signal<Map<string, GroupResponse>>(new Map());
  readonly groupsPoliciesMap = signal<Map<string, string[]>>(new Map());

  readonly enablingGroup = signal(false);
  readonly deletingGroup = signal(false);
  readonly showDeleteConfirmGroup = signal<string | null>(null);
  readonly removingMember = signal<string | null>(null);
  readonly detachingPolicy = signal<string | null>(null);

  readonly showCreateModal = signal(false);
  readonly createGroupName = signal('');
  readonly creating = signal(false);
  readonly createGroupAllUsers = signal<UserRow[]>([]);
  readonly createGroupUsersLoading = signal(false);
  readonly createGroupUserSearch = signal('');
  readonly createGroupSelectedUsers = signal<Set<string>>(new Set());

  readonly showAddMemberModal = signal(false);
  readonly addingMember = signal(false);
  readonly memberSearchText = signal('');
  readonly allUsersForModal = signal<UserRow[]>([]);
  readonly selectedUsersToAdd = signal<Set<string>>(new Set());
  readonly usersLoadingForModal = signal(false);

  readonly showAttachPolicyModal = signal(false);
  readonly availablePolicies = signal<string[]>([]);
  readonly selectedPolicyToAttach = signal<string | null>(null);
  readonly attachingPolicy = signal(false);
  readonly policiesLoading = signal(false);

  readonly filteredGroups = computed(() => {
    const q = this.filterText().toLowerCase();
    return q ? this.groups().filter(g => g.toLowerCase().includes(q)) : this.groups();
  });

  readonly groupsPage = signal(0);
  private readonly PAGE_SIZE = 10;
  readonly pagedGroups = computed(() => {
    const start = this.groupsPage() * this.PAGE_SIZE;
    return this.filteredGroups().slice(start, start + this.PAGE_SIZE);
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredGroups().length / this.PAGE_SIZE)),
  );
  readonly pageFrom = computed(() => this.groupsPage() * this.PAGE_SIZE + 1);
  readonly pageTo = computed(() =>
    Math.min((this.groupsPage() + 1) * this.PAGE_SIZE, this.filteredGroups().length),
  );

  ngOnInit() {
    this.layout.setTitle('Groups');
    this.loadGroups();
  }

  onFilterChange(value: string) {
    this.filterText.set(value);
    this.groupsPage.set(0);
  }

  async loadGroups() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.listGroups()).catch(() => null);
      const raw = res?.data;
      let names: string[] = [];
      if (Array.isArray(raw)) {
        if (raw.length > 0 && typeof (raw[0] as any).groups !== 'undefined') {
          names = (raw as any[]).flatMap((item: any) => item.groups ?? []);
        } else {
          names = (raw as any[]).filter((g: any) => typeof g === 'string');
        }
      }
      this.groups.set(names);

      // Load details for all groups in parallel
      const detailResults = await Promise.all(
        names.map(name =>
          Promise.all([
            firstValueFrom(this.api.getGroup(name)).catch(() => null),
            firstValueFrom(this.api.getGroupPolicies(name)).catch(() => null),
          ]).then(([groupRes, policiesRes]) => {
            const detail = Array.isArray(groupRes?.data) ? groupRes!.data[0] : (groupRes?.data ?? null);
            const mappings = (policiesRes?.data as any)?.[0]?.result?.group_mappings ?? [];
            const policies: string[] = mappings.find((m: any) => m.group === name)?.policies ?? [];
            return { name, detail, policies };
          }),
        ),
      );

      const detailMap = new Map<string, GroupResponse>();
      const policiesMap = new Map<string, string[]>();
      for (const { name, detail, policies } of detailResults) {
        if (detail) detailMap.set(name, detail);
        policiesMap.set(name, policies);
      }
      this.groupsDetailMap.set(detailMap);
      this.groupsPoliciesMap.set(policiesMap);

      // Refresh selected group if still visible
      const selected = this.selectedGroupName();
      if (selected) {
        const refreshed = detailMap.get(selected) ?? null;
        this.selectedGroup.set(refreshed);
        this.groupPolicies.set(policiesMap.get(selected) ?? []);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async selectGroup(name: string) {
    this.selectedGroupName.set(name);
    this.detailLoading.set(true);
    try {
      const [groupRes, policiesRes] = await Promise.all([
        firstValueFrom(this.api.getGroup(name)).catch(() => null),
        firstValueFrom(this.api.getGroupPolicies(name)).catch(() => null),
      ]);
      const groupData = Array.isArray(groupRes?.data) ? groupRes!.data[0] : (groupRes?.data ?? null);
      this.selectedGroup.set(groupData ?? null);
      const mappings = (policiesRes?.data as any)?.[0]?.result?.group_mappings ?? [];
      const policies: string[] = mappings.find((m: any) => m.group === name)?.policies ?? [];
      this.groupPolicies.set(policies);

      // Update maps so the table row reflects fresh data
      if (groupData) {
        this.groupsDetailMap.update(m => { m.set(name, groupData); return new Map(m); });
      }
      this.groupsPoliciesMap.update(m => { m.set(name, policies); return new Map(m); });
    } finally {
      this.detailLoading.set(false);
    }
  }

  async toggleGroup() {
    const g = this.selectedGroup();
    const name = this.selectedGroupName();
    if (!g || !name || this.enablingGroup()) return;
    this.enablingGroup.set(true);
    try {
      if (g.status.toLowerCase() === 'enabled') {
        await firstValueFrom(this.api.disableGroup(name));
      } else {
        await firstValueFrom(this.api.enableGroup(name));
      }
      await this.selectGroup(name);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to toggle group status');
    } finally {
      this.enablingGroup.set(false);
    }
  }

  async confirmDeleteGroup() {
    const name = this.showDeleteConfirmGroup();
    if (!name || this.deletingGroup()) return;
    this.deletingGroup.set(true);
    try {
      await firstValueFrom(this.api.deleteGroup(name));
      this.toast.success('Group deleted', `"${name}" was deleted`);
      this.showDeleteConfirmGroup.set(null);
      if (this.selectedGroup()?.group_name === name) this.selectedGroup.set(null);
      await this.loadGroups();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to delete group "${name}"`);
    } finally {
      this.deletingGroup.set(false);
    }
  }

  openCreateModal() {
    this.createGroupName.set('');
    this.createGroupSelectedUsers.set(new Set());
    this.createGroupUserSearch.set('');
    this.showCreateModal.set(true);
    this.createGroupUsersLoading.set(true);
    firstValueFrom(this.api.listUsers()).then(res => {
      const raw = res?.data ?? [];
      const rows: UserRow[] = (Array.isArray(raw)
        ? raw
        : Object.entries(raw as Record<string, UserResponse>).map(([username, data]) => ({ ...data, username }))
      ) as UserRow[];
      this.createGroupAllUsers.set(rows.map(r => ({ ...r, username: r.username ?? r.access_key ?? '' })));
    }).catch(() => {}).finally(() => this.createGroupUsersLoading.set(false));
  }

  closeCreateModal() {
    if (this.creating()) return;
    this.showCreateModal.set(false);
  }

  async submitCreateGroup() {
    if (this.creating() || !this.createGroupName().trim()) return;
    this.creating.set(true);
    try {
      await firstValueFrom(this.api.createGroup({
        name: this.createGroupName().trim(),
        users: [...this.createGroupSelectedUsers()],
      }));
      this.toast.success('Group created', `"${this.createGroupName().trim()}" was created successfully`);
      this.showCreateModal.set(false);
      await this.loadGroups();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to create group "${this.createGroupName().trim()}"`);
    } finally {
      this.creating.set(false);
    }
  }

  toggleCreateGroupUser(username: string) {
    const s = new Set(this.createGroupSelectedUsers());
    s.has(username) ? s.delete(username) : s.add(username);
    this.createGroupSelectedUsers.set(s);
  }

  filteredCreateGroupUsers() {
    const q = this.createGroupUserSearch().toLowerCase();
    return q
      ? this.createGroupAllUsers().filter(u => u.username.toLowerCase().includes(q))
      : this.createGroupAllUsers();
  }

  async removeMember(username: string) {
    const g = this.selectedGroup();
    if (!g || this.removingMember()) return;
    this.removingMember.set(username);
    try {
      await firstValueFrom(this.api.removeGroupUsers(g.group_name, { users: [username] }));
      await this.selectGroup(g.group_name);
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to remove member "${username}"`);
    } finally {
      this.removingMember.set(null);
    }
  }

  async openAddMemberModal() {
    this.memberSearchText.set('');
    this.selectedUsersToAdd.set(new Set());
    this.showAddMemberModal.set(true);
    this.usersLoadingForModal.set(true);
    try {
      const res = await firstValueFrom(this.api.listUsers()).catch(() => null);
      const raw = res?.data ?? [];
      const rows: UserRow[] = (Array.isArray(raw)
        ? raw
        : Object.entries(raw as Record<string, UserResponse>).map(([username, data]) => ({ ...data, username }))
      ) as UserRow[];
      const mapped = rows.map(r => ({ ...r, username: r.username ?? r.access_key ?? '' }));
      const currentMembers = new Set(this.selectedGroup()?.members ?? []);
      this.allUsersForModal.set(mapped.filter(u => u.username && !currentMembers.has(u.username)));
    } finally {
      this.usersLoadingForModal.set(false);
    }
  }

  toggleUserSelection(username: string) {
    const s = new Set(this.selectedUsersToAdd());
    s.has(username) ? s.delete(username) : s.add(username);
    this.selectedUsersToAdd.set(s);
  }

  filteredUsersForModal() {
    const q = this.memberSearchText().toLowerCase();
    return q
      ? this.allUsersForModal().filter(u => u.username.toLowerCase().includes(q))
      : this.allUsersForModal();
  }

  async submitAddMember() {
    const name = this.selectedGroupName();
    const users = [...this.selectedUsersToAdd()];
    if (!name || !users.length || this.addingMember()) return;
    this.addingMember.set(true);
    try {
      await firstValueFrom(this.api.addGroupUsers({ name, users }));
      this.showAddMemberModal.set(false);
      await this.selectGroup(name);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to add members to group');
    } finally {
      this.addingMember.set(false);
    }
  }

  async openAttachPolicyModal() {
    this.selectedPolicyToAttach.set(null);
    this.showAttachPolicyModal.set(true);
    this.policiesLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.listPolicies()).catch(() => null);
      const all = (res?.data ?? []).map((p: any) => p.policy as string).filter(Boolean);
      const attached = new Set(this.groupPolicies());
      this.availablePolicies.set(all.filter(p => !attached.has(p)));
    } finally {
      this.policiesLoading.set(false);
    }
  }

  async submitAttachPolicy() {
    const g = this.selectedGroup();
    const policy = this.selectedPolicyToAttach();
    if (!g || !policy || this.attachingPolicy()) return;
    this.attachingPolicy.set(true);
    try {
      await firstValueFrom(this.api.attachGroupPolicy({ group: g.group_name, policy }));
      this.showAttachPolicyModal.set(false);
      this.selectedPolicyToAttach.set(null);
      await this.selectGroup(g.group_name);
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to attach policy');
    } finally {
      this.attachingPolicy.set(false);
    }
  }

  async detachPolicy(policy: string) {
    const g = this.selectedGroup();
    if (!g || this.detachingPolicy()) return;
    this.detachingPolicy.set(policy);
    try {
      await firstValueFrom(this.api.detachGroupPolicy({ group: g.group_name, policy }));
      this.groupPolicies.update(ps => ps.filter(p => p !== policy));
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to detach policy "${policy}"`);
    } finally {
      this.detachingPolicy.set(null);
    }
  }

  initials(username: string): string {
    const parts = username.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return username.slice(0, 2).toUpperCase();
  }

  private readonly AVATAR_COLORS = [
    'bg-indigo-500/20 text-indigo-400',
    'bg-pink-500/20 text-pink-400',
    'bg-blue-500/20 text-blue-400',
    'bg-orange-500/20 text-orange-400',
    'bg-teal-500/20 text-teal-400',
    'bg-violet-500/20 text-violet-400',
    'bg-amber-500/20 text-amber-400',
    'bg-cyan-500/20 text-cyan-400',
  ];

  avatarClass(username: string): string {
    const idx = username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % this.AVATAR_COLORS.length;
    return this.AVATAR_COLORS[idx];
  }

  // ── Theme-aware CSS classes ───────────────────────────────────

  get dark(): boolean { return this.theme.mode() !== 'light'; }

  get titleClass() { return this.dark ? 'text-slate-100' : 'text-slate-900'; }
  get mutedClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }
  get subtleClass() { return this.dark ? 'text-slate-300' : 'text-slate-700'; }

  get headerClass() {
    return this.dark ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200';
  }

  get filterBarClass() {
    return this.dark ? 'bg-background-dark border-border-dark' : 'bg-slate-50 border-slate-200';
  }

  get borderClass() { return this.dark ? 'border-border-dark' : 'border-slate-200'; }

  get cardClass() {
    return this.dark ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200';
  }

  get skeletonClass() {
    return this.dark ? 'bg-slate-800 animate-pulse' : 'bg-slate-100 animate-pulse';
  }

  get tableWrapClass() {
    return this.dark ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200';
  }

  get tableFooterClass() {
    return this.dark ? 'bg-surface-dark border-border-dark' : 'bg-slate-50 border-slate-200';
  }

  get theadClass() { return this.dark ? 'bg-slate-800/60' : 'bg-slate-50'; }
  get dividerClass() { return this.dark ? 'divide-border-dark' : 'divide-slate-200'; }
  get thTextClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }

  rowClass(name: string): string {
    const selected = this.selectedGroup()?.group_name === name;
    if (selected) return this.dark
      ? 'bg-primary/10 border-l-2 border-l-primary'
      : 'bg-primary/5 border-l-2 border-l-primary';
    return this.dark
      ? 'hover:bg-white/5 border-l-2 border-l-transparent'
      : 'hover:bg-slate-50 border-l-2 border-l-transparent';
  }

  get policyBadgeClass() {
    return this.dark
      ? 'px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 border border-border-dark'
      : 'px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200';
  }

  get ghostIconClass() {
    return this.dark
      ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      : 'text-slate-500 hover:text-slate-700 hover:bg-black/5';
  }

  get ghostBtnClass() {
    return this.dark
      ? 'border-border-dark text-slate-300 hover:bg-white/5'
      : 'border-slate-300 text-slate-700 hover:bg-slate-50';
  }

  get filterInputClass() {
    return this.dark
      ? 'bg-surface-dark border border-border-dark text-slate-200 placeholder-slate-500 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary'
      : 'bg-white border border-slate-300 text-slate-700 placeholder-slate-400 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary';
  }

  get inputClass() {
    return this.dark
      ? 'bg-background-dark border border-border-dark text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-primary rounded-lg'
      : 'bg-white border border-slate-300 text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-primary rounded-lg';
  }

  get modalClass() {
    return this.dark
      ? 'w-full max-w-lg rounded-xl bg-surface-dark border border-border-dark flex flex-col shadow-2xl'
      : 'w-full max-w-lg rounded-xl bg-white border border-slate-200 flex flex-col shadow-2xl';
  }

  get confirmDialogClass() {
    return this.dark
      ? 'w-full max-w-sm rounded-xl bg-surface-dark border border-border-dark shadow-2xl'
      : 'w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-2xl';
  }
}
