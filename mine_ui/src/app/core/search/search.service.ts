import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { TOKEN_STORAGE_KEY } from '../api/api.config';
import { ConfigService } from '../api/config.service';
import type { StandardResponse } from '../api/api.types';

export interface SearchResult {
  type: 'bucket' | 'object' | 'user' | 'group' | 'policy';
  name?: string;
  bucket?: string;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private url(path: string): string {
    return `${this.config.apiBaseUrl}${path}`;
  }

  startSearch(query: string): Observable<string> {
    return this.http
      .post<StandardResponse<{ search_id: string }>>(this.url('/search'), { query })
      .pipe(map((r) => r.data!.search_id));
  }

  cancelSearch(searchId: string): Observable<unknown> {
    return this.http.delete(this.url(`/search/${searchId}`));
  }

  /**
   * Opens an SSE connection using the Fetch API (supports Authorization header).
   * Returns an Observable that emits SearchResult items and completes on 'complete'.
   */
  streamResults(searchId: string): Observable<SearchResult> {
    return new Observable<SearchResult>((observer) => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
      const abortController = new AbortController();

      fetch(this.url(`/search/${searchId}/stream`), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            observer.error(new Error(`SSE error: ${response.status}`));
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() ?? '';

            for (const chunk of chunks) {
              const eventLine = chunk.match(/^event: (.+)/m);
              const dataLine = chunk.match(/^data: (.+)/m);

              if (!eventLine || !dataLine) continue;

              const event = eventLine[1].trim();
              const data = dataLine[1].trim();

              if (event === 'result') {
                try {
                  observer.next(JSON.parse(data) as SearchResult);
                } catch {
                  // skip malformed event
                }
              } else if (event === 'complete') {
                observer.complete();
                return;
              }
            }
          }

          observer.complete();
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          observer.error(err);
        });

      return () => abortController.abort();
    });
  }
}
