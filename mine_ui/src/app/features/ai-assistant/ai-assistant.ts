import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import { TOKEN_STORAGE_KEY } from '../../core/api/api.config';
import { ConfigService } from '../../core/api/config.service';
import { LayoutService } from '../../core/layout/layout.service';
import { ThemeService } from '../../core/theme/theme.service';
import { UserService } from '../../core/auth/user.service';

// ─── Data model ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

interface StoredMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: string; // ISO string
}

interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mine_ai_conversations';

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="flex h-full overflow-hidden" [class]="containerClass">

      <!-- ── History Panel ────────────────────────────────────────────────── -->
      @if (showHistory()) {
        <aside class="w-72 flex flex-col border-r flex-shrink-0 overflow-hidden" [class]="historyPanelClass">

          <!-- Panel header -->
          <div class="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" [class]="historyHeaderClass">
            <span class="text-sm font-semibold" [class]="titleClass">
              {{ 'AI_ASSISTANT.HISTORY_TITLE' | translate }}
            </span>
            <button
              (click)="newChat()"
              class="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              {{ 'AI_ASSISTANT.NEW_CHAT' | translate }}
            </button>
          </div>

          <!-- Conversation list -->
          <div class="flex-1 overflow-y-auto py-2">
            @if (conversations().length === 0) {
              <p class="text-xs text-slate-500 text-center px-4 py-8">
                {{ 'AI_ASSISTANT.HISTORY_EMPTY' | translate }}
              </p>
            }
            @for (conv of conversations(); track conv.id) {
              <div
                class="group flex items-start gap-2 mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                [class]="convItemClass(conv.id)"
                (click)="loadConversation(conv)"
              >
                <span class="material-symbols-outlined text-[18px] text-slate-400 mt-0.5 shrink-0">chat</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate" [class]="titleClass">{{ conv.title }}</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">{{ formatDate(conv.updatedAt) }}</p>
                </div>
                <button
                  (click)="deleteConversation($event, conv.id)"
                  class="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-all"
                  [title]="'AI_ASSISTANT.DELETE_CONV' | translate"
                >
                  <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            }
          </div>

        </aside>
      }

      <!-- ── Chat Area ─────────────────────────────────────────────────────── -->
      <div class="flex-1 flex flex-col overflow-hidden">

        <!-- Chat Header -->
        <div class="px-4 py-3 border-b flex items-center gap-3 flex-shrink-0" [class]="headerClass">

          <!-- History toggle -->
          <button
            (click)="showHistory.set(!showHistory())"
            class="p-2 rounded-lg transition-colors shrink-0"
            [class]="showHistory() ? activeIconBtnClass : iconBtnClass"
            [title]="'AI_ASSISTANT.TOGGLE_HISTORY' | translate"
          >
            <span class="material-symbols-outlined text-[20px]">history</span>
          </button>

          <!-- Agent info -->
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div class="size-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shrink-0">
              <span class="material-symbols-outlined text-[18px]">psychology</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-semibold truncate" [class]="titleClass">
                @if (activeConvTitle()) {
                  {{ activeConvTitle() }}
                } @else {
                  {{ 'AI_ASSISTANT.AGENT_NAME' | translate }}
                }
              </h3>
              <p class="text-xs text-primary flex items-center gap-1">
                <span class="size-1.5 rounded-full bg-primary animate-pulse"></span>
                {{ 'AI_ASSISTANT.AGENT_STATUS' | translate }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">

            <!-- Save button — only when there are messages and not yet saved -->
            @if (messages().length > 0 && !activeConvId()) {
              <button
                (click)="saveConversation()"
                class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                [title]="'AI_ASSISTANT.SAVE_CONV' | translate"
              >
                <span class="material-symbols-outlined text-[16px]">save</span>
                {{ 'AI_ASSISTANT.SAVE_CONV' | translate }}
              </button>
            }

            <!-- Saved indicator -->
            @if (activeConvId()) {
              <span class="flex items-center gap-1 text-xs text-green-400 px-2">
                <span class="material-symbols-outlined text-[14px]">check_circle</span>
                {{ 'AI_ASSISTANT.SAVED' | translate }}
              </span>
            }

            <!-- New chat -->
            <button
              (click)="newChat()"
              class="p-2 rounded-lg transition-colors"
              [class]="iconBtnClass"
              [title]="'AI_ASSISTANT.NEW_CHAT' | translate"
            >
              <span class="material-symbols-outlined text-[20px]">add_comment</span>
            </button>

          </div>
        </div>

        <!-- Messages -->
        <div #messagesContainer class="flex-1 overflow-y-auto p-6 space-y-6">

          <!-- Welcome message -->
          @if (messages().length === 0 && !loading()) {
            <div class="flex gap-4 max-w-[90%]">
              <div class="size-8 rounded-full flex items-center justify-center shrink-0 mt-1" [class]="agentAvatarClass">
                <span class="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-slate-400 ml-1">{{ 'AI_ASSISTANT.AGENT_NAME' | translate }}</span>
                <div class="p-3.5 rounded-2xl rounded-tl-none text-sm leading-relaxed" [class]="agentBubbleClass">
                  {{ 'AI_ASSISTANT.WELCOME_MSG' | translate: { name: userService.displayName() } }}
                </div>
              </div>
            </div>
          }

          <!-- Chat messages -->
          @for (msg of messages(); track $index) {
            @if (msg.role === 'agent') {
              <div class="flex gap-4 max-w-[90%]">
                <div class="size-8 rounded-full flex items-center justify-center shrink-0 mt-1" [class]="agentAvatarClass">
                  <span class="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-slate-400 ml-1">{{ 'AI_ASSISTANT.AGENT_NAME' | translate }}</span>
                  <div class="md-content p-3.5 rounded-2xl rounded-tl-none text-sm leading-relaxed" [class]="agentBubbleClass"
                       [innerHTML]="renderMarkdown(msg.text)">
                  </div>
                  <span class="text-[10px] text-slate-500 ml-1">{{ formatTime(msg.timestamp) }}</span>
                </div>
              </div>
            } @else {
              <div class="flex gap-4 max-w-[90%] self-end flex-row-reverse ml-auto">
                <div class="size-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0 mt-1">
                  <span class="material-symbols-outlined text-slate-300 text-[18px]">person</span>
                </div>
                <div class="flex flex-col gap-1 items-end">
                  <span class="text-xs text-slate-400 mr-1">{{ 'AI_ASSISTANT.YOU' | translate }}</span>
                  <div class="bg-primary text-white p-3.5 rounded-2xl rounded-tr-none text-sm leading-relaxed whitespace-pre-wrap">
                    {{ msg.text }}
                  </div>
                  <span class="text-[10px] text-slate-500 mr-1">{{ formatTime(msg.timestamp) }}</span>
                </div>
              </div>
            }
          }

          <!-- Typing indicator -->
          @if (loading()) {
            <div class="flex gap-4 max-w-[90%]">
              <div class="size-8 rounded-full flex items-center justify-center shrink-0 mt-1" [class]="agentAvatarClass">
                <span class="material-symbols-outlined text-slate-500 text-[18px]">smart_toy</span>
              </div>
              <div class="p-4 rounded-2xl rounded-tl-none flex gap-1 items-center h-10 w-16" [class]="agentBubbleClass">
                <span class="typing-dot size-1.5 bg-slate-400 rounded-full"></span>
                <span class="typing-dot size-1.5 bg-slate-400 rounded-full"></span>
                <span class="typing-dot size-1.5 bg-slate-400 rounded-full"></span>
              </div>
            </div>
          }

          <!-- Error message -->
          @if (error()) {
            <div class="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span class="material-symbols-outlined text-[18px]">error_outline</span>
              {{ error() }}
            </div>
          }

        </div>

        <!-- Input Area -->
        <div class="p-4 border-t flex-shrink-0" [class]="footerClass">
          <div
            class="relative flex items-end gap-2 rounded-xl p-2 transition-all focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50"
            [class]="inputWrapClass"
          >
            <textarea
              #inputRef
              [(ngModel)]="inputText"
              (keydown.enter)="onEnter($event)"
              [placeholder]="'AI_ASSISTANT.INPUT_PLACEHOLDER' | translate"
              class="w-full bg-transparent border-none text-sm placeholder-slate-500 focus:ring-0 resize-none py-2.5 max-h-32 min-h-[44px]"
              [class]="inputTextClass"
              rows="1"
              [disabled]="loading()"
            ></textarea>
            <button
              (click)="sendMessage()"
              [disabled]="!inputText.trim() || loading()"
              class="p-2 rounded-lg transition-colors shrink-0 shadow-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-primary/20"
            >
              <span class="material-symbols-outlined">send</span>
            </button>
          </div>
          <p class="text-[10px] text-center text-slate-500 mt-2">
            {{ 'AI_ASSISTANT.DISCLAIMER' | translate }}
          </p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .typing-dot {
      animation: typing 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes typing {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Markdown content styles */
    :host ::ng-deep .md-content p        { margin-bottom: 0.6em; }
    :host ::ng-deep .md-content p:last-child { margin-bottom: 0; }

    :host ::ng-deep .md-content h1,
    :host ::ng-deep .md-content h2,
    :host ::ng-deep .md-content h3,
    :host ::ng-deep .md-content h4       { font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.3; }
    :host ::ng-deep .md-content h1       { font-size: 1.15em; }
    :host ::ng-deep .md-content h2       { font-size: 1.05em; }
    :host ::ng-deep .md-content h3,
    :host ::ng-deep .md-content h4       { font-size: 0.95em; }

    :host ::ng-deep .md-content ul,
    :host ::ng-deep .md-content ol       { padding-left: 1.4em; margin-bottom: 0.6em; }
    :host ::ng-deep .md-content ul       { list-style: disc; }
    :host ::ng-deep .md-content ol       { list-style: decimal; }
    :host ::ng-deep .md-content li       { margin-bottom: 0.25em; }

    :host ::ng-deep .md-content code     {
      font-family: ui-monospace, monospace;
      font-size: 0.82em;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      padding: 0.1em 0.4em;
    }

    :host ::ng-deep .md-content pre      {
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 0.85em 1em;
      overflow-x: auto;
      margin: 0.6em 0;
    }
    :host ::ng-deep .md-content pre code {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.82em;
    }

    :host ::ng-deep .md-content blockquote {
      border-left: 3px solid #13a4ec;
      padding-left: 0.85em;
      margin: 0.6em 0;
      color: rgba(255,255,255,0.55);
    }

    :host ::ng-deep .md-content a        {
      color: #13a4ec;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    :host ::ng-deep .md-content hr       {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 0.8em 0;
    }

    :host ::ng-deep .md-content table    { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.85em; }
    :host ::ng-deep .md-content th,
    :host ::ng-deep .md-content td       { border: 1px solid rgba(255,255,255,0.1); padding: 0.35em 0.65em; }
    :host ::ng-deep .md-content th       { background: rgba(255,255,255,0.06); font-weight: 600; }
  `],
})
export class AiAssistantComponent implements OnInit {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  private config = inject(ConfigService);
  private layout = inject(LayoutService);
  private theme = inject(ThemeService);
  private sanitizer = inject(DomSanitizer);
  readonly userService = inject(UserService);

  // ── Chat state ─────────────────────────────────────────────────────────────
  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  inputText = '';

  // ── Conversation persistence ───────────────────────────────────────────────
  readonly showHistory = signal(false);
  readonly conversations = signal<StoredConversation[]>([]);
  readonly activeConvId = signal<string | null>(null);

  readonly activeConvTitle = computed(() => {
    const id = this.activeConvId();
    if (!id) return null;
    return this.conversations().find(c => c.id === id)?.title ?? null;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    this.layout.setTitle('AI Assistant');
    this.loadConversationsFromStorage();
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.loading()) return;

    this.inputText = '';
    this.error.set('');

    this.messages.update(msgs => [...msgs, { role: 'user', text, timestamp: new Date() }]);
    this.loading.set(true);
    this.scrollToBottom();

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
      const res = await fetch(`${this.config.agentBackendUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { response: string };
      this.messages.update(msgs => [
        ...msgs,
        { role: 'agent', text: data.response, timestamp: new Date() },
      ]);

      // Auto-persist if this chat is already saved
      if (this.activeConvId()) {
        this.persistCurrentToStorage();
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
      this.scrollToBottom();
    }
  }

  onEnter(event: Event) {
    const kbEvent = event as KeyboardEvent;
    if (!kbEvent.shiftKey) {
      kbEvent.preventDefault();
      this.sendMessage();
    }
  }

  // ── Conversation management ────────────────────────────────────────────────

  newChat() {
    this.messages.set([]);
    this.error.set('');
    this.activeConvId.set(null);
  }

  saveConversation() {
    if (this.messages().length === 0) return;

    const id = crypto.randomUUID();
    const firstUserMsg = this.messages().find(m => m.role === 'user')?.text ?? 'Conversation';
    const title = firstUserMsg.length > 45 ? firstUserMsg.slice(0, 45) + '…' : firstUserMsg;
    const now = new Date().toISOString();

    const conv: StoredConversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messages: this.serializeMessages(),
    };

    this.conversations.update(list => [conv, ...list]);
    this.activeConvId.set(id);
    this.writeConversationsToStorage();
  }

  loadConversation(conv: StoredConversation) {
    this.messages.set(
      conv.messages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    );
    this.activeConvId.set(conv.id);
    this.error.set('');
    this.scrollToBottom();
  }

  deleteConversation(event: Event, id: string) {
    event.stopPropagation();
    this.conversations.update(list => list.filter(c => c.id !== id));
    this.writeConversationsToStorage();

    if (this.activeConvId() === id) {
      this.newChat();
    }
  }

  // ── Storage helpers ────────────────────────────────────────────────────────

  private loadConversationsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.conversations.set(JSON.parse(raw) as StoredConversation[]);
      }
    } catch {
      this.conversations.set([]);
    }
  }

  private writeConversationsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations()));
  }

  private persistCurrentToStorage() {
    const id = this.activeConvId();
    if (!id) return;

    const now = new Date().toISOString();
    this.conversations.update(list =>
      list.map(c =>
        c.id === id
          ? { ...c, updatedAt: now, messages: this.serializeMessages() }
          : c,
      ),
    );
    this.writeConversationsToStorage();
  }

  private serializeMessages(): StoredMessage[] {
    return this.messages().map(m => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp.toISOString(),
    }));
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  renderMarkdown(text: string): SafeHtml {
    const html = marked.parse(text, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(html));
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  // ── Theme classes ──────────────────────────────────────────────────────────

  private get dark(): boolean {
    return this.theme.isDark();
  }

  get containerClass(): string {
    return this.dark ? 'bg-background-dark' : 'bg-white';
  }

  get historyPanelClass(): string {
    return this.dark
      ? 'bg-sidebar-dark border-border-dark'
      : 'bg-slate-50 border-slate-200';
  }

  get historyHeaderClass(): string {
    return this.dark ? 'border-border-dark' : 'border-slate-200';
  }

  get headerClass(): string {
    return this.dark
      ? 'border-border-dark bg-background-dark/80 backdrop-blur'
      : 'border-slate-200 bg-white/80 backdrop-blur';
  }

  get titleClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  get iconBtnClass(): string {
    return 'text-slate-400 hover:text-white hover:bg-white/10 transition-colors';
  }

  get activeIconBtnClass(): string {
    return 'text-primary bg-primary/10 hover:bg-primary/20 transition-colors';
  }

  get agentAvatarClass(): string {
    return this.dark
      ? 'bg-surface-dark border border-border-dark'
      : 'bg-slate-100 border border-slate-200';
  }

  get agentBubbleClass(): string {
    return this.dark
      ? 'bg-surface-dark border border-border-dark text-slate-200'
      : 'bg-slate-100 border border-slate-200 text-slate-800';
  }

  get footerClass(): string {
    return this.dark ? 'border-border-dark bg-background-dark' : 'border-slate-200 bg-white';
  }

  get inputWrapClass(): string {
    return this.dark
      ? 'bg-surface-dark border border-border-dark'
      : 'bg-slate-50 border border-slate-200';
  }

  get inputTextClass(): string {
    return this.dark ? 'text-white' : 'text-slate-900';
  }

  convItemClass(id: string): string {
    const active = this.activeConvId() === id;
    if (active) {
      return 'bg-primary/10 text-primary';
    }
    return this.dark
      ? 'text-slate-300 hover:bg-white/5'
      : 'text-slate-700 hover:bg-black/5';
  }
}
