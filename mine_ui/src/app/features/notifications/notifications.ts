import { Component, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';

const NOTIFICATION_TYPES = [
  'webhook', 'amqp', 'kafka', 'mqtt', 'nats', 'nsq', 'mysql', 'postgres', 'elasticsearch', 'redis',
] as const;

type NotificationType = typeof NOTIFICATION_TYPES[number];

const ENDPOINT_KEY: Record<NotificationType, string> = {
  webhook: 'endpoint',
  amqp: 'url',
  kafka: 'brokers',
  mqtt: 'broker',
  nats: 'address',
  nsq: 'nsqd',
  mysql: 'dsn',
  postgres: 'connection_string',
  elasticsearch: 'url',
  redis: 'address',
};

const DEFAULT_CONFIG: Record<NotificationType, string> = {
  webhook: '{\n  "endpoint": "https://",\n  "enable": "on"\n}',
  amqp: '{\n  "url": "amqp://user:pass@host:5672",\n  "enable": "on"\n}',
  kafka: '{\n  "brokers": "host:9092",\n  "enable": "on"\n}',
  mqtt: '{\n  "broker": "tcp://host:1883",\n  "enable": "on"\n}',
  nats: '{\n  "address": "nats://host:4222",\n  "enable": "on"\n}',
  nsq: '{\n  "nsqd": "host:4150",\n  "enable": "on"\n}',
  mysql: '{\n  "dsn": "user:pass@tcp(host:3306)/db",\n  "enable": "on"\n}',
  postgres: '{\n  "connection_string": "postgres://user:pass@host/db",\n  "enable": "on"\n}',
  elasticsearch: '{\n  "url": "https://host:9200",\n  "enable": "on"\n}',
  redis: '{\n  "address": "host:6379",\n  "enable": "on"\n}',
};

interface NotificationTarget {
  type: NotificationType;
  identifier: string;
  enabled: boolean;
  endpoint: string;
  kvMap: Record<string, string>;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col h-full overflow-auto" [class]="pageBg">
      <div class="flex-1 flex flex-col w-full max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 mb-6 text-sm">
          <span class="font-medium" [class]="mutedColor">{{ 'NOTIFICATIONS.BREADCRUMB_SYSTEM' | translate }}</span>
          <span class="material-symbols-outlined text-base" [class]="mutedColor">chevron_right</span>
          <span class="font-semibold" [class]="titleColor">{{ 'NOTIFICATIONS.BREADCRUMB' | translate }}</span>
        </nav>

        <!-- Header -->
        <header class="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
          <div class="flex flex-col gap-2 max-w-2xl">
            <h1 class="text-3xl md:text-4xl font-black tracking-tight" [class]="titleColor">
              {{ 'NOTIFICATIONS.TITLE' | translate }}
            </h1>
            <p class="text-base leading-relaxed" [class]="mutedColor">
              {{ 'NOTIFICATIONS.DESCRIPTION' | translate }}
            </p>
          </div>
          <div class="shrink-0">
            <button
              (click)="openCreateModal()"
              class="flex items-center gap-2 px-5 py-2.5 bg-[#135bec] hover:bg-[#0f4bc4] text-white rounded-lg font-semibold transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <span class="material-symbols-outlined text-[20px]">add</span>
              <span>{{ 'NOTIFICATIONS.CREATE_BTN' | translate }}</span>
            </button>
          </div>
        </header>

        <!-- Type Tabs -->
        <div class="flex flex-wrap gap-2 mb-6 p-1 rounded-xl border" [class]="surface + ' ' + border">
          @for (type of types; track type) {
            <button
              (click)="selectType(type)"
              class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize"
              [class]="selectedType() === type ? 'bg-[#135bec] text-white shadow-sm' : tabInactiveClass"
            >
              {{ type }}
            </button>
          }
        </div>

        <!-- Restart notice banner -->
        @if (restarting()) {
          <div class="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <span class="material-symbols-outlined text-amber-500 animate-spin text-[20px]">autorenew</span>
            <div>
              <p class="text-sm font-semibold text-amber-700 dark:text-amber-400">{{ 'NOTIFICATIONS.RESTARTING_TITLE' | translate }}</p>
              <p class="text-xs text-amber-600 dark:text-amber-500">{{ 'NOTIFICATIONS.RESTARTING_DESC' | translate }}</p>
            </div>
          </div>
        }

        <!-- Main Content -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">

          <!-- Targets List (2/3) -->
          <div class="xl:col-span-2 flex flex-col gap-4">

            @if (loading()) {
              @for (i of [1,2,3]; track i) {
                <div class="rounded-xl p-5 animate-pulse border" [class]="surface + ' ' + border">
                  <div class="h-4 rounded w-1/3 mb-3" [class]="skeletonClass"></div>
                  <div class="h-3 rounded w-2/3 mb-2" [class]="skeletonClass"></div>
                  <div class="h-3 rounded w-1/2" [class]="skeletonClass"></div>
                </div>
              }
            } @else if (targets().length === 0) {
              <div class="rounded-xl p-12 text-center border" [class]="surface + ' ' + border">
                <span class="material-symbols-outlined text-5xl mb-4 block" [class]="mutedColor">notifications_off</span>
                <p class="font-semibold text-lg mb-1" [class]="titleColor">{{ 'NOTIFICATIONS.EMPTY_TITLE' | translate }}</p>
                <p class="text-sm" [class]="mutedColor">{{ 'NOTIFICATIONS.EMPTY_DESCRIPTION' | translate }}</p>
              </div>
            } @else {
              @for (target of targets(); track target.identifier) {
                <div
                  class="border rounded-xl shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden cursor-pointer"
                  [class]="cardBg + ' ' + border + (selectedTarget()?.identifier === target.identifier ? ' ring-2 ring-[#135bec]/40' : '')"
                  (click)="selectTarget(target)"
                >
                  <!-- Left accent border -->
                  <div
                    class="absolute top-0 left-0 w-1 h-full"
                    [class]="target.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
                  ></div>

                  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pl-3">

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <!-- Identifier + status -->
                      <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="font-mono text-xs font-medium px-2 py-0.5 rounded border" [class]="idBadgeClass">
                          {{ target.identifier }}
                        </span>
                        @if (target.enabled) {
                          <span class="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-900/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                            {{ 'NOTIFICATIONS.STATUS_ACTIVE' | translate }}
                          </span>
                        } @else {
                          <span class="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                            <span class="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                            {{ 'NOTIFICATIONS.STATUS_DISABLED' | translate }}
                          </span>
                        }
                        <span class="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 capitalize">
                          {{ target.type }}
                        </span>
                      </div>

                      <!-- Endpoint -->
                      @if (target.endpoint) {
                        <div class="flex items-center gap-2 group/url mb-2">
                          <h3
                            class="font-mono text-sm truncate font-medium"
                            [class]="target.enabled ? titleColor : mutedColor"
                            [title]="target.endpoint"
                          >
                            {{ target.endpoint }}
                          </h3>
                          <span class="material-symbols-outlined text-[15px] opacity-0 group-hover/url:opacity-100 transition-opacity" [class]="mutedColor">content_copy</span>
                        </div>
                      }

                      <!-- Config keys count -->
                      <div class="flex flex-wrap gap-2 mt-1">
                        <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                          {{ kvCount(target) }} {{ 'NOTIFICATIONS.CONFIG_KEYS' | translate }}
                        </span>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-3 self-end md:self-center shrink-0" (click)="$event.stopPropagation()">

                      <!-- Enable/Disable toggle -->
                      <label class="relative inline-flex items-center cursor-pointer" [title]="target.enabled ? ('NOTIFICATIONS.DISABLE' | translate) : ('NOTIFICATIONS.ENABLE' | translate)">
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          [checked]="target.enabled"
                          [disabled]="togglingTarget() === target.identifier"
                          (change)="toggleTarget(target)"
                        />
                        <div class="w-9 h-5 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#135bec] peer-disabled:opacity-50"></div>
                      </label>

                      <!-- Delete -->
                      <button
                        (click)="confirmDelete(target)"
                        class="p-1.5 rounded-md transition-colors text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                        [title]="'NOTIFICATIONS.DELETE' | translate"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Payload Preview (1/3) -->
          <div class="xl:col-span-1">
            <div
              class="sticky top-6 flex flex-col rounded-xl border overflow-hidden shadow-lg shadow-gray-200/50 dark:shadow-none"
              [class]="surface + ' ' + border"
              style="max-height: 600px; height: calc(100vh - 14rem)"
            >
              <!-- Panel header -->
              <div class="flex items-center justify-between p-4 border-b shrink-0" [class]="border + ' bg-gray-50/50 dark:bg-surface-dark/50'">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#135bec] text-[20px]">data_object</span>
                  <h3 class="font-bold text-sm" [class]="titleColor">{{ 'NOTIFICATIONS.PREVIEW_TITLE' | translate }}</h3>
                </div>
                <span class="text-xs font-mono bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded" [class]="mutedColor">JSON</span>
              </div>

              <!-- Code body -->
              <div class="flex-1 overflow-auto bg-[#0d121b]" style="scrollbar-width: thin; scrollbar-color: #475569 transparent">
                @if (selectedTarget()) {
                  <div class="text-xs font-mono leading-relaxed p-4">
                    <div class="flex gap-4">
                      <div class="flex flex-col text-right select-none text-gray-600 border-r border-gray-700 pr-3 min-w-[2rem]">
                        @for (line of payloadLines(); track $index) {
                          <span>{{ $index + 1 }}</span>
                        }
                      </div>
                      <pre class="text-gray-300 flex-1 overflow-x-auto whitespace-pre">{{ payloadJson() }}</pre>
                    </div>
                  </div>
                } @else {
                  <div class="flex flex-col items-center justify-center h-full p-8 text-center gap-2">
                    <span class="material-symbols-outlined text-4xl text-gray-600">touch_app</span>
                    <p class="text-gray-500 text-sm">{{ 'NOTIFICATIONS.PREVIEW_EMPTY' | translate }}</p>
                  </div>
                }
              </div>

              <!-- Panel footer -->
              <div class="p-4 border-t shrink-0" [class]="border + ' ' + surface">
                <div class="flex items-center justify-between text-xs" [class]="mutedColor">
                  @if (selectedTarget()) {
                    <span>
                      {{ 'NOTIFICATIONS.PREVIEW_FOR' | translate }}:
                      <span class="font-mono font-medium" [class]="titleColor">{{ selectedTarget()!.identifier }}</span>
                    </span>
                  } @else {
                    <span>{{ 'NOTIFICATIONS.PREVIEW_SELECT' | translate }}</span>
                  }
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Create Modal -->
    @if (showCreateModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-xl shadow-2xl border" [class]="surface + ' ' + border">

          <div class="p-6 border-b" [class]="border">
            <h2 class="text-lg font-bold" [class]="titleColor">{{ 'NOTIFICATIONS.CREATE_TITLE' | translate }}</h2>
            <p class="text-sm mt-1 capitalize" [class]="mutedColor">
              {{ 'NOTIFICATIONS.TYPE_LABEL' | translate }}: <span class="font-semibold">{{ selectedType() }}</span>
            </p>
          </div>

          <div class="p-6 flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5" [class]="titleColor">
                {{ 'NOTIFICATIONS.IDENTIFIER_LABEL' | translate }}
              </label>
              <input
                type="text"
                [placeholder]="'NOTIFICATIONS.IDENTIFIER_PLACEHOLDER' | translate"
                [value]="newIdentifier()"
                (input)="newIdentifier.set($any($event.target).value)"
                class="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec]"
                [class]="modalInputClass"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5" [class]="titleColor">
                {{ 'NOTIFICATIONS.CONFIG_LABEL' | translate }}
              </label>
              <textarea
                rows="9"
                [value]="newConfig()"
                (input)="newConfig.set($any($event.target).value)"
                class="w-full px-3 py-2 rounded-lg text-sm font-mono border focus:outline-none focus:ring-2 focus:ring-[#135bec]/20 focus:border-[#135bec] resize-none"
                [class]="modalInputClass"
              ></textarea>
              @if (!configValid()) {
                <p class="text-xs text-red-500 mt-1">{{ 'NOTIFICATIONS.CONFIG_INVALID' | translate }}</p>
              }
            </div>
          </div>

          <div class="p-6 border-t flex justify-end gap-3" [class]="border">
            <button
              (click)="showCreateModal.set(false)"
              class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              [class]="cancelBtnClass"
            >{{ 'NOTIFICATIONS.CANCEL' | translate }}</button>
            <button
              (click)="createTarget()"
              [disabled]="creating() || !newIdentifier().trim() || !configValid()"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-[#135bec] hover:bg-[#0f4bc4] text-white transition-colors disabled:opacity-50"
            >{{ creating() ? ('NOTIFICATIONS.CREATING' | translate) : ('NOTIFICATIONS.CREATE_CONFIRM' | translate) }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirm Modal -->
    @if (showDeleteModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-sm rounded-xl shadow-2xl border" [class]="surface + ' ' + border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-red-500">warning</span>
              </div>
              <div>
                <h2 class="text-base font-bold" [class]="titleColor">{{ 'NOTIFICATIONS.DELETE_TITLE' | translate }}</h2>
                <p class="text-xs font-mono mt-0.5" [class]="mutedColor">{{ deletingTarget()?.identifier }}</p>
              </div>
            </div>
            <p class="text-sm" [class]="mutedColor">{{ 'NOTIFICATIONS.DELETE_DESCRIPTION' | translate }}</p>
          </div>
          <div class="px-6 pb-6 flex justify-end gap-3">
            <button
              (click)="showDeleteModal.set(false); deletingTarget.set(null)"
              class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              [class]="cancelBtnClass"
            >{{ 'NOTIFICATIONS.CANCEL' | translate }}</button>
            <button
              (click)="deleteTarget()"
              [disabled]="deleting()"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >{{ deleting() ? ('NOTIFICATIONS.DELETING' | translate) : ('NOTIFICATIONS.DELETE_CONFIRM' | translate) }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  private theme = inject(ThemeService);
  private toast = inject(ToastService);

  readonly types = NOTIFICATION_TYPES;

  selectedType = signal<NotificationType>('webhook');
  targets = signal<NotificationTarget[]>([]);
  loading = signal(false);
  selectedTarget = signal<NotificationTarget | null>(null);
  togglingTarget = signal<string | null>(null);

  showCreateModal = signal(false);
  newIdentifier = signal('');
  newConfig = signal(DEFAULT_CONFIG['webhook']);
  creating = signal(false);
  restarting = signal(false);

  showDeleteModal = signal(false);
  deletingTarget = signal<NotificationTarget | null>(null);
  deleting = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadTargets();
  }

  async selectType(type: NotificationType): Promise<void> {
    this.selectedType.set(type);
    this.selectedTarget.set(null);
    await this.loadTargets();
  }

  async loadTargets(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.listWebhooks(this.selectedType()));
      const rawList = res?.data ?? [];
      const parsed: NotificationTarget[] = [];

      for (const item of rawList) {
        for (const sub of item.config ?? []) {
          const identifier = sub.target ?? sub.subSystem ?? '';
          if (!identifier) continue;

          const kvMap: Record<string, string> = {};
          for (const kv of sub.kv ?? []) {
            kvMap[kv.key] = kv.value;
          }

          const endpointKey = ENDPOINT_KEY[this.selectedType()];
          const endpoint = kvMap[endpointKey] ?? '';
          const enabled = kvMap['enable'] !== 'off';

          parsed.push({ type: this.selectedType(), identifier, enabled, endpoint, kvMap });
        }
      }

      this.targets.set(parsed);
    } catch (err) {
      this.targets.set([]);
      this.toast.fromHttpError(err, 'Failed to load notification targets');
    } finally {
      this.loading.set(false);
    }
  }

  selectTarget(target: NotificationTarget): void {
    this.selectedTarget.set(target);
  }

  openCreateModal(): void {
    this.newIdentifier.set('');
    this.newConfig.set(DEFAULT_CONFIG[this.selectedType()]);
    this.showCreateModal.set(true);
  }

  configValid(): boolean {
    try {
      JSON.parse(this.newConfig());
      return true;
    } catch {
      return false;
    }
  }

  async createTarget(): Promise<void> {
    if (!this.newIdentifier().trim() || !this.configValid()) return;
    this.creating.set(true);
    try {
      const config = JSON.parse(this.newConfig()) as Record<string, unknown>;
      await firstValueFrom(
        this.api.createWebhook(this.selectedType(), { identifier: this.newIdentifier().trim(), config }),
      );
      this.showCreateModal.set(false);
      this.restarting.set(true);
      await new Promise(resolve => setTimeout(resolve, 4000));
      await this.loadTargets();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to create notification target');
    } finally {
      this.creating.set(false);
      this.restarting.set(false);
    }
  }

  confirmDelete(target: NotificationTarget): void {
    this.deletingTarget.set(target);
    this.showDeleteModal.set(true);
  }

  async deleteTarget(): Promise<void> {
    const target = this.deletingTarget();
    if (!target) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.api.deleteWebhook(target.type, target.identifier));
      this.showDeleteModal.set(false);
      this.deletingTarget.set(null);
      if (this.selectedTarget()?.identifier === target.identifier) {
        this.selectedTarget.set(null);
      }
      await this.loadTargets();
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to delete notification target');
    } finally {
      this.deleting.set(false);
    }
  }

  async toggleTarget(target: NotificationTarget): Promise<void> {
    if (this.togglingTarget()) return;
    this.togglingTarget.set(target.identifier);
    try {
      const newKv: Record<string, unknown> = { ...target.kvMap, enable: target.enabled ? 'off' : 'on' };
      await firstValueFrom(
        this.api.createWebhook(target.type, { identifier: target.identifier, config: newKv }),
      );
      this.restarting.set(true);
      await new Promise(resolve => setTimeout(resolve, 4000));
    } catch (err) {
      this.toast.fromHttpError(err, 'Failed to toggle notification target');
    } finally {
      this.togglingTarget.set(null);
      this.restarting.set(false);
      await this.loadTargets();
    }
  }

  kvCount(target: NotificationTarget): number {
    return Object.keys(target.kvMap).length;
  }

  payloadJson(): string {
    const t = this.selectedTarget();
    if (!t) return '';
    return JSON.stringify(t.kvMap, null, 2);
  }

  payloadLines(): string[] {
    return this.payloadJson().split('\n');
  }

  // ── Theme helpers ──────────────────────────────────────────────────────────

  private get mode(): string {
    return this.theme.mode();
  }

  get pageBg(): string {
    return this.mode === 'dark' ? 'bg-[#101622]' : 'bg-[#f8f9fc]';
  }

  get surface(): string {
    return this.mode === 'dark' ? 'bg-[#1a2230]' : 'bg-white';
  }

  get cardBg(): string {
    return this.mode === 'dark' ? 'bg-[#1a2230]' : 'bg-white';
  }

  get border(): string {
    return this.mode === 'dark' ? 'border-[#2d3748]' : 'border-[#cfd7e7]';
  }

  get titleColor(): string {
    return this.mode === 'dark' ? 'text-[#f8f9fc]' : 'text-[#0d121b]';
  }

  get mutedColor(): string {
    return this.mode === 'dark' ? 'text-[#94a3b8]' : 'text-[#4c669a]';
  }

  get skeletonClass(): string {
    return this.mode === 'dark' ? 'bg-gray-700' : 'bg-gray-200';
  }

  get tabInactiveClass(): string {
    return this.mode === 'dark'
      ? 'text-[#94a3b8] hover:text-[#f8f9fc] hover:bg-gray-700/50'
      : 'text-[#4c669a] hover:text-[#0d121b] hover:bg-gray-100';
  }

  get idBadgeClass(): string {
    return this.mode === 'dark'
      ? 'bg-gray-800 text-[#94a3b8] border-gray-700'
      : 'bg-gray-100 text-[#4c669a] border-gray-200';
  }

  get modalInputClass(): string {
    return this.mode === 'dark'
      ? 'bg-[#101622] border-[#2d3748] text-[#f8f9fc] placeholder-[#94a3b8]/60'
      : 'bg-white border-[#cfd7e7] text-[#0d121b] placeholder-[#4c669a]/60';
  }

  get cancelBtnClass(): string {
    return this.mode === 'dark'
      ? 'border-[#2d3748] text-[#94a3b8] hover:bg-gray-700/50'
      : 'border-[#cfd7e7] text-[#4c669a] hover:bg-gray-50';
  }
}
