import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import type {
  UserResponse,
  CredentialsResponse,
  CreatedCredentialsResponse,
} from '../../core/api/api.types';

interface UserRow extends UserResponse {
  username: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex h-full overflow-hidden">

      <!-- ── Main panel ────────────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Page header -->
        <div class="px-8 py-6 border-b shrink-0" [class]="headerClass">
          <p class="text-xs font-medium flex items-center gap-1 mb-1" [class]="mutedClass">
            <span class="material-symbols-outlined text-[14px]">manage_accounts</span>
            {{ 'USERS.BREADCRUMB' | translate }}
          </p>
          <div class="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 class="text-2xl font-bold" [class]="titleClass">{{ 'USERS.TITLE' | translate }}</h1>
              <p class="text-sm mt-0.5" [class]="mutedClass">{{ 'USERS.SUBTITLE' | translate }}</p>
            </div>
            <button
              (click)="openCreateModal()"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
              {{ 'USERS.CREATE_BTN' | translate }}
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
              [placeholder]="'USERS.SEARCH_PLACEHOLDER' | translate"
              [value]="filterText()"
              (input)="onFilterChange($any($event.target).value)"
              class="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none"
              [class]="filterInputClass"
            />
          </div>
          <button
            (click)="loadUsers()"
            class="p-2 rounded-lg transition-colors"
            [class]="ghostIconClass"
            [title]="'USERS.REFRESH' | translate"
          >
            <span class="material-symbols-outlined text-[18px]" [class]="loading() ? 'animate-spin' : ''">
              {{ loading() ? 'progress_activity' : 'refresh' }}
            </span>
          </button>
        </div>

        <!-- Table -->
        <div class="flex-1 overflow-auto px-8 py-6">
          @if (loading()) {
            <div class="space-y-3">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="h-14 rounded-lg animate-pulse" [class]="skeletonClass"></div>
              }
            </div>
          } @else if (filteredUsers().length === 0) {
            <div class="flex flex-col items-center justify-center py-24 gap-3">
              <span class="material-symbols-outlined text-[48px]" [class]="mutedClass">manage_accounts</span>
              <p class="text-sm" [class]="mutedClass">
                {{ filterText() ? ('USERS.NO_RESULTS' | translate) : ('USERS.EMPTY' | translate) }}
              </p>
            </div>
          } @else {
            <div class="rounded-xl border overflow-hidden" [class]="tableWrapClass">
              <table class="min-w-full divide-y" [class]="dividerClass">
                <thead [class]="theadClass">
                  <tr>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'USERS.COL_USERNAME' | translate }}
                    </th>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'USERS.COL_STATUS' | translate }}
                    </th>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'USERS.COL_GROUPS' | translate }}
                    </th>
                    <th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" [class]="thTextClass">
                      {{ 'USERS.COL_ACTIONS' | translate }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y" [class]="dividerClass">
                  @for (user of pagedUsers(); track user.username) {
                    <tr
                      (click)="selectUser(user)"
                      class="transition-colors cursor-pointer"
                      [class]="rowClass(user.username)"
                    >
                      <!-- Username -->
                      <td class="px-5 py-3 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                          <div class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            [class]="avatarClass(user.username)">
                            {{ initials(user.username) }}
                          </div>
                          <span class="text-sm font-medium font-mono" [class]="selectedUser()?.username === user.username ? 'text-primary' : titleClass">
                            {{ user.username }}
                          </span>
                        </div>
                      </td>

                      <!-- Status -->
                      <td class="px-5 py-3 whitespace-nowrap">
                        @if (user.status.toLowerCase() === 'enabled') {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {{ 'USERS.STATUS_ENABLED' | translate }}
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-400/10 text-slate-400 ring-1 ring-inset ring-slate-400/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {{ 'USERS.STATUS_DISABLED' | translate }}
                          </span>
                        }
                      </td>

                      <!-- Groups -->
                      <td class="px-5 py-3">
                        <div class="flex flex-wrap gap-1">
                          @if (user.member_of?.length) {
                            @for (g of user.member_of!.slice(0, 3); track g.name) {
                              <span [class]="groupBadgeClass">{{ g.name }}</span>
                            }
                            @if (user.member_of!.length > 3) {
                              <span [class]="groupBadgeClass">+{{ user.member_of!.length - 3 }}</span>
                            }
                          } @else {
                            <span class="text-xs" [class]="mutedClass">—</span>
                          }
                        </div>
                      </td>

                      <!-- Actions -->
                      <td class="px-5 py-3 whitespace-nowrap text-right" (click)="$event.stopPropagation()">
                        <div class="flex items-center justify-end gap-1">
                          @if (user.status.toLowerCase() === 'enabled') {
                            <button
                              (click)="toggleUser(user)"
                              [disabled]="enablingUser() === user.username"
                              class="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                              [class]="ghostIconClass"
                              [title]="'USERS.DISABLE_USER' | translate"
                            >
                              @if (enablingUser() === user.username) {
                                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              } @else {
                                <span class="material-symbols-outlined text-[16px]">block</span>
                              }
                            </button>
                          } @else {
                            <button
                              (click)="toggleUser(user)"
                              [disabled]="enablingUser() === user.username"
                              class="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                              [class]="ghostIconClass"
                              [title]="'USERS.ENABLE_USER' | translate"
                            >
                              @if (enablingUser() === user.username) {
                                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                              } @else {
                                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                              }
                            </button>
                          }
                          <button
                            (click)="showDeleteConfirmUser.set(user.username)"
                            class="p-1.5 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            [title]="'USERS.DELETE_USER' | translate"
                          >
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="mt-4 flex items-center justify-between">
              <p class="text-xs" [class]="mutedClass">
                {{ 'USERS.PAGE_SHOWING' | translate : { from: pageFrom(), to: pageTo(), total: filteredUsers().length } }}
              </p>
              @if (totalPages() > 1) {
                <div class="flex items-center gap-1">
                  <button
                    (click)="usersPage.set(usersPage() - 1)"
                    [disabled]="usersPage() === 0"
                    class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    [class]="ghostIconClass"
                  >
                    <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span class="text-xs px-2 tabular-nums" [class]="mutedClass">
                    {{ usersPage() + 1 }} / {{ totalPages() }}
                  </span>
                  <button
                    (click)="usersPage.set(usersPage() + 1)"
                    [disabled]="usersPage() >= totalPages() - 1"
                    class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    [class]="ghostIconClass"
                  >
                    <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── Detail Drawer ──────────────────────────────────────── -->
      @if (selectedUser()) {
        <aside class="w-96 shrink-0 flex flex-col border-l" [class]="drawerClass">

          <!-- Header -->
          <div class="px-5 py-4 border-b shrink-0" [class]="borderClass">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  [class]="avatarClass(selectedUser()!.username)">
                  {{ initials(selectedUser()!.username) }}
                </div>
                <div>
                  <h2 class="text-base font-semibold font-mono leading-tight" [class]="titleClass">{{ selectedUser()!.username }}</h2>
                  <div class="mt-1">
                    @if (selectedUser()!.status.toLowerCase() === 'enabled') {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {{ 'USERS.STATUS_ENABLED' | translate }}
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-400/10 text-slate-400 ring-1 ring-inset ring-slate-400/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {{ 'USERS.STATUS_DISABLED' | translate }}
                      </span>
                    }
                  </div>
                </div>
              </div>
              <button (click)="selectedUser.set(null)" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <!-- Quick actions -->
            <div class="flex gap-2">
              <button
                (click)="toggleUser(selectedUser()!)"
                [disabled]="enablingUser() === selectedUser()!.username"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                [class]="ghostBtnClass"
              >
                @if (enablingUser() === selectedUser()!.username) {
                  <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                } @else {
                  <span class="material-symbols-outlined text-[14px]">{{ selectedUser()!.status.toLowerCase() === 'enabled' ? 'block' : 'check_circle' }}</span>
                }
                {{ selectedUser()!.status.toLowerCase() === 'enabled' ? ('USERS.DISABLE_USER' | translate) : ('USERS.ENABLE_USER' | translate) }}
              </button>
              <button
                (click)="showDeleteConfirmUser.set(selectedUser()!.username)"
                class="p-1.5 rounded-lg border transition-colors text-red-400 hover:text-red-300 hover:bg-red-400/10"
                [class]="borderClass"
                [title]="'USERS.DELETE_USER' | translate"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex border-b shrink-0 px-5" [class]="borderClass">
            <button
              (click)="drawerTab.set('overview')"
              class="py-3 mr-5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors"
              [class]="drawerTab() === 'overview' ? 'border-primary text-primary' : 'border-transparent ' + mutedClass"
            >
              {{ 'USERS.TAB_OVERVIEW' | translate }}
            </button>
            <button
              (click)="drawerTab.set('groups')"
              class="py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5"
              [class]="drawerTab() === 'groups' ? 'border-primary text-primary' : 'border-transparent ' + mutedClass"
            >
              {{ 'USERS.TAB_GROUPS' | translate }}
              @if (selectedUser()!.member_of?.length) {
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold" [class]="tabCountClass">
                  {{ selectedUser()!.member_of!.length }}
                </span>
              }
            </button>
          </div>

          <!-- Drawer body -->
          <div class="flex-1 overflow-y-auto p-5">

            @if (drawerLoading()) {
              <div class="space-y-3">
                @for (i of [1,2,3]; track i) {
                  <div class="h-16 rounded-lg animate-pulse" [class]="skeletonClass"></div>
                }
              </div>
            } @else if (drawerTab() === 'overview') {

              <!-- Access Keys section -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                    {{ 'USERS.SECTION_KEYS' | translate }}
                  </h3>
                  <button
                    (click)="createCredential()"
                    [disabled]="creatingCredential()"
                    class="text-[10px] font-medium flex items-center gap-0.5 transition-colors hover:text-primary disabled:opacity-40"
                    [class]="mutedClass"
                  >
                    @if (creatingCredential()) {
                      <span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                    } @else {
                      <span class="material-symbols-outlined text-[12px]">add</span>
                    }
                    {{ 'USERS.CREATE_KEY' | translate }}
                  </button>
                </div>

                <!-- Newly created key reveal -->
                @if (newCreatedCredential()) {
                  <div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                    <p class="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                      {{ 'USERS.KEY_CREATED' | translate }}
                    </p>
                    <div class="space-y-1">
                      <p class="text-[10px] font-medium" [class]="mutedClass">Access Key</p>
                      <p class="text-xs font-mono break-all" [class]="subtleClass">{{ newCreatedCredential()!.access_key }}</p>
                      <p class="text-[10px] font-medium mt-1" [class]="mutedClass">Secret Key</p>
                      <p class="text-xs font-mono break-all" [class]="subtleClass">{{ newCreatedCredential()!.secret_key }}</p>
                    </div>
                    <p class="text-[10px] text-amber-400 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px]">warning</span>
                      {{ 'USERS.KEY_SECRET_WARNING' | translate }}
                    </p>
                    <button
                      (click)="newCreatedCredential.set(null)"
                      class="text-[10px] font-medium transition-colors hover:text-primary"
                      [class]="mutedClass"
                    >{{ 'USERS.KEY_DISMISS' | translate }}</button>
                  </div>
                }

                @if (drawerCredentials().length === 0 && !newCreatedCredential()) {
                  <p class="text-xs" [class]="mutedClass">{{ 'USERS.KEYS_EMPTY' | translate }}</p>
                } @else {
                  <div class="space-y-2">
                    @for (cred of drawerCredentials(); track cred.access_key) {
                      <div class="rounded-lg border p-3" [class]="borderClass">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-mono" [class]="subtleClass">{{ cred.access_key }}</span>
                          <button
                            (click)="deleteCredential(cred.access_key)"
                            [disabled]="deletingCredential() === cred.access_key"
                            class="p-1 rounded transition-colors text-red-400 hover:text-red-300 disabled:opacity-40"
                          >
                            @if (deletingCredential() === cred.access_key) {
                              <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            } @else {
                              <span class="material-symbols-outlined text-[14px]">delete</span>
                            }
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

            } @else if (drawerTab() === 'groups') {

              <!-- Groups section -->
              <div class="space-y-3">
                <h3 class="text-[10px] font-semibold uppercase tracking-wider" [class]="mutedClass">
                  {{ 'USERS.SECTION_GROUPS' | translate }}
                </h3>
                @if (!selectedUser()!.member_of?.length) {
                  <p class="text-xs" [class]="mutedClass">{{ 'USERS.GROUPS_EMPTY' | translate }}</p>
                } @else {
                  <div class="space-y-2">
                    @for (g of selectedUser()!.member_of!; track g.name) {
                      <div class="rounded-lg border p-3" [class]="borderClass">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="material-symbols-outlined text-[16px]" [class]="mutedClass">group</span>
                          <span class="text-sm font-medium" [class]="titleClass">{{ g.name }}</span>
                        </div>
                        @if (g.policies?.length) {
                          <div class="flex flex-wrap gap-1 mt-2">
                            @for (p of g.policies!; track p) {
                              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono" [class]="groupBadgeClass">{{ p }}</span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

            }
          </div>
        </aside>
      }

    </div>

    <!-- ── Create User Modal ─────────────────────────────────────── -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" (click)="closeCreateModal()">
        <div [class]="modalClass" (click)="$event.stopPropagation()">

          <div class="flex items-center justify-between px-6 py-4 border-b shrink-0" [class]="borderClass">
            <h3 class="text-base font-semibold" [class]="titleClass">{{ 'USERS.CREATE_MODAL_TITLE' | translate }}</h3>
            <button (click)="closeCreateModal()" class="p-1 rounded-lg transition-colors" [class]="ghostIconClass">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider mb-1.5" [class]="mutedClass">
                {{ 'USERS.CREATE_USERNAME_LABEL' | translate }}
              </label>
              <input
                type="text"
                [value]="createUsername()"
                (input)="createUsername.set($any($event.target).value)"
                [placeholder]="'USERS.CREATE_USERNAME_PLACEHOLDER' | translate"
                class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                [class]="inputClass"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider mb-1.5" [class]="mutedClass">
                {{ 'USERS.CREATE_PASSWORD_LABEL' | translate }}
              </label>
              <input
                type="password"
                [value]="createPassword()"
                (input)="createPassword.set($any($event.target).value)"
                [placeholder]="'USERS.CREATE_PASSWORD_PLACEHOLDER' | translate"
                class="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                [class]="inputClass"
              />
            </div>
          </div>

          <div class="px-6 py-4 border-t flex items-center justify-end gap-3 shrink-0" [class]="borderClass">
            <button (click)="closeCreateModal()" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'USERS.CREATE_CANCEL' | translate }}
            </button>
            <button
              (click)="submitCreateUser()"
              [disabled]="creating() || !createUsername().trim() || !createPassword().trim()"
              class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (creating()) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'USERS.CREATE_SUBMIT' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Delete User Confirmation ─────────────────────────────── -->
    @if (showDeleteConfirmUser()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" (click)="showDeleteConfirmUser.set(null)">
        <div [class]="confirmDialogClass" (click)="$event.stopPropagation()">
          <div class="flex items-start gap-4 p-6">
            <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-red-500">delete_forever</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold mb-1" [class]="titleClass">{{ 'USERS.DELETE_TITLE' | translate }}</h3>
              <p class="text-sm mb-1" [class]="mutedClass">{{ 'USERS.DELETE_MESSAGE' | translate }}</p>
              <p class="text-sm font-mono font-semibold text-red-400">{{ showDeleteConfirmUser() }}</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t" [class]="borderClass">
            <button (click)="showDeleteConfirmUser.set(null)" class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors" [class]="ghostBtnClass">
              {{ 'USERS.DELETE_CANCEL' | translate }}
            </button>
            <button
              (click)="confirmDeleteUser()"
              [disabled]="deletingUser() !== null"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-40"
            >
              @if (deletingUser() !== null) {
                <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              }
              {{ 'USERS.DELETE_CONFIRM' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  private toast = inject(ToastService);

  readonly users = signal<UserRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly selectedUser = signal<UserRow | null>(null);
  readonly drawerLoading = signal(false);
  readonly drawerTab = signal<'overview' | 'groups'>('overview');
  readonly drawerCredentials = signal<CredentialsResponse[]>([]);

  readonly enablingUser = signal<string | null>(null);
  readonly deletingUser = signal<string | null>(null);
  readonly showDeleteConfirmUser = signal<string | null>(null);

  readonly showCreateModal = signal(false);
  readonly createUsername = signal('');
  readonly createPassword = signal('');
  readonly creating = signal(false);

  readonly creatingCredential = signal(false);
  readonly deletingCredential = signal<string | null>(null);
  readonly newCreatedCredential = signal<CreatedCredentialsResponse | null>(null);

  readonly filteredUsers = computed(() => {
    const q = this.filterText().toLowerCase();
    return q ? this.users().filter(u => u.username.toLowerCase().includes(q)) : this.users();
  });

  readonly usersPage = signal(0);
  private readonly PAGE_SIZE = 10;
  readonly pagedUsers = computed(() => {
    const start = this.usersPage() * this.PAGE_SIZE;
    return this.filteredUsers().slice(start, start + this.PAGE_SIZE);
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.PAGE_SIZE)),
  );
  readonly pageFrom = computed(() => this.usersPage() * this.PAGE_SIZE + 1);
  readonly pageTo = computed(() =>
    Math.min((this.usersPage() + 1) * this.PAGE_SIZE, this.filteredUsers().length),
  );

  ngOnInit() {
    this.layout.setTitle('User Management');
    this.loadUsers();
  }

  onFilterChange(value: string) {
    this.filterText.set(value);
    this.usersPage.set(0);
  }

  async loadUsers() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.listUsers()).catch(() => null);
      const raw = res?.data ?? [];
      const rows: UserRow[] = (Array.isArray(raw) ? raw : Object.entries(raw as Record<string, UserResponse>).map(
        ([username, data]) => ({ ...data, username }),
      )) as UserRow[];
      // When the backend returns an array, try using access_key as username
      const mapped = rows.map(r => ({ ...r, username: r.username ?? r.access_key ?? '' }));
      this.users.set(mapped);
    } finally {
      this.loading.set(false);
    }
  }

  async selectUser(user: UserRow) {
    this.selectedUser.set(user);
    this.drawerTab.set('overview');
    this.newCreatedCredential.set(null);
    this.drawerCredentials.set([]);
    this.drawerLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.listCredentials(user.username)).catch(() => null);
      this.drawerCredentials.set(res?.data ?? []);
    } finally {
      this.drawerLoading.set(false);
    }
  }

  async toggleUser(user: UserRow) {
    if (this.enablingUser()) return;
    this.enablingUser.set(user.username);
    const isEnabled = user.status.toLowerCase() === 'enabled';
    const newStatus = isEnabled ? 'disabled' : 'enabled';
    try {
      const res = isEnabled
        ? await firstValueFrom(this.api.disableUser(user.username)).catch(() => null)
        : await firstValueFrom(this.api.enableUser(user.username)).catch(() => null);

      if (res !== null) {
        this.users.update(list =>
          list.map(u => u.username === user.username ? { ...u, status: newStatus } : u),
        );
        if (this.selectedUser()?.username === user.username) {
          this.selectedUser.update(u => u ? { ...u, status: newStatus } : null);
        }
      } else {
        this.toast.fromHttpError(null, `Failed to ${isEnabled ? 'disable' : 'enable'} user "${user.username}"`);
        await this.loadUsers();
      }
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to ${isEnabled ? 'disable' : 'enable'} user "${user.username}"`);
    } finally {
      this.enablingUser.set(null);
    }
  }

  async confirmDeleteUser() {
    const username = this.showDeleteConfirmUser();
    if (!username || this.deletingUser()) return;
    this.deletingUser.set(username);
    try {
      await firstValueFrom(this.api.deleteUser(username));
      this.toast.success('User deleted', `"${username}" was deleted`);
      this.showDeleteConfirmUser.set(null);
      if (this.selectedUser()?.username === username) this.selectedUser.set(null);
      await this.loadUsers();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to delete user "${username}"`);
    } finally {
      this.deletingUser.set(null);
    }
  }

  openCreateModal() {
    this.createUsername.set('');
    this.createPassword.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    if (this.creating()) return;
    this.showCreateModal.set(false);
  }

  async submitCreateUser() {
    if (this.creating() || !this.createUsername().trim() || !this.createPassword().trim()) return;
    this.creating.set(true);
    try {
      await firstValueFrom(
        this.api.createUser({ username: this.createUsername().trim(), password: this.createPassword().trim() }),
      );
      this.toast.success('User created', `"${this.createUsername().trim()}" was created successfully`);
      this.showCreateModal.set(false);
      await this.loadUsers();
    } catch (err) {
      this.toast.fromHttpError(err, `Failed to create user "${this.createUsername().trim()}"`);
    } finally {
      this.creating.set(false);
    }
  }

  async createCredential() {
    const user = this.selectedUser();
    if (!user || this.creatingCredential()) return;
    this.creatingCredential.set(true);
    try {
      const res = await firstValueFrom(
        this.api.createCredential({ username: user.username }),
      ).catch(() => null);
      const created = Array.isArray(res?.data) ? (res!.data as CreatedCredentialsResponse[])[0] : null;
      if (created) {
        this.newCreatedCredential.set(created);
        const credRes = await firstValueFrom(this.api.listCredentials(user.username)).catch(() => null);
        this.drawerCredentials.set(credRes?.data ?? []);
      }
    } finally {
      this.creatingCredential.set(false);
    }
  }

  async deleteCredential(accessKey: string) {
    if (this.deletingCredential()) return;
    this.deletingCredential.set(accessKey);
    try {
      await firstValueFrom(this.api.deleteCredential(accessKey));
      this.drawerCredentials.update(cs => cs.filter(c => c.access_key !== accessKey));
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete credential');
    } finally {
      this.deletingCredential.set(null);
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

  private get dark(): boolean { return this.theme.mode() !== 'light'; }

  get titleClass() { return this.dark ? 'text-slate-100' : 'text-slate-900'; }
  get mutedClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }
  get subtleClass() { return this.dark ? 'text-slate-300' : 'text-slate-700'; }

  get headerClass() {
    return this.dark
      ? 'bg-surface-dark border-border-dark'
      : 'bg-white border-slate-200';
  }

  get filterBarClass() {
    return this.dark
      ? 'bg-background-dark border-border-dark'
      : 'bg-slate-50 border-slate-200';
  }

  get borderClass() { return this.dark ? 'border-border-dark' : 'border-slate-200'; }

  get drawerClass() {
    return this.dark
      ? 'bg-surface-dark border-border-dark'
      : 'bg-white border-slate-200';
  }

  get skeletonClass() {
    return this.dark ? 'bg-slate-800 animate-pulse' : 'bg-slate-100 animate-pulse';
  }

  get tableWrapClass() {
    return this.dark ? 'bg-surface-dark border-border-dark' : 'bg-white border-slate-200';
  }

  get theadClass() { return this.dark ? 'bg-slate-800/60' : 'bg-slate-50'; }
  get dividerClass() { return this.dark ? 'divide-border-dark' : 'divide-slate-200'; }
  get thTextClass() { return this.dark ? 'text-slate-400' : 'text-slate-500'; }

  rowClass(username: string): string {
    const selected = this.selectedUser()?.username === username;
    if (selected) return this.dark
      ? 'bg-primary/10 border-l-2 border-l-primary'
      : 'bg-primary/5 border-l-2 border-l-primary';
    return this.dark
      ? 'hover:bg-white/5 border-l-2 border-l-transparent'
      : 'hover:bg-slate-50 border-l-2 border-l-transparent';
  }

  get groupBadgeClass() {
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

  get tabCountClass() {
    return this.dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600';
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
      ? 'w-full max-w-md rounded-xl bg-surface-dark border border-border-dark flex flex-col shadow-2xl'
      : 'w-full max-w-md rounded-xl bg-white border border-slate-200 flex flex-col shadow-2xl';
  }

  get confirmDialogClass() {
    return this.dark
      ? 'w-full max-w-sm rounded-xl bg-surface-dark border border-border-dark shadow-2xl'
      : 'w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-2xl';
  }
}
