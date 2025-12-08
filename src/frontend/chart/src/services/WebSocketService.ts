export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

export class WebSocketError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = "WebSocketError";
  }
}

export interface WebSocketOptions {
  connectionTimeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  messageParser?: (data: any) => any;
  logger?: {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
  };
}

const DEFAULT_OPTIONS: Required<Omit<WebSocketOptions, 'messageParser' | 'logger'>> = {
  connectionTimeout: 10000,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  autoConnect: false
};

type MessageCallback<T> = (data: T) => void;

export class WebSocketService<TReceive = any, TSend = any> {
  private ws: WebSocket | null = null;
  private subscribers = new Set<MessageCallback<TReceive>>();
  private messageQueue: TSend[] = [];
  private connectionPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private isManuallyDisconnected = false;
  private readonly options: Required<Omit<WebSocketOptions, 'messageParser' | 'logger'>> & Pick<WebSocketOptions, 'messageParser' | 'logger'>;

  constructor(
    private readonly url: string,
    options: WebSocketOptions = {}
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };

    if (!this.options.logger) {
      this.options.logger = {
        info: (message: string, ...args: any[]) => console.info(`[WebSocketService] ${message}`, ...args),
        error: (message: string, ...args: any[]) => console.error(`[WebSocketService] ${message}`, ...args)
      };
    }

    if (this.options.autoConnect) {
      this.connect().catch(error => {
        this.options.logger?.error('Failed to auto-connect:', error);
      });
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isManuallyDisconnected = false;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.setupConnectionTimeout(reject);

        this.ws.onopen = () => {
          this.clearConnectionTimeout();
          this.reconnectAttempts = 0;
          this.options.logger?.info('Connected to WebSocket server');

          this.processQueue();
          resolve();
        };

        this.ws.onerror = (event) => {
          const error = new WebSocketError(
            `WebSocket error: ${(event as ErrorEvent).message || 'Unknown error'}`
          );
          this.options.logger?.error('WebSocket error event:', error);
        };

        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onclose = this.handleClose.bind(this);

      } catch (error) {
        const wsError = new WebSocketError(`Failed to create WebSocket: ${error}`);
        this.options.logger?.error('Failed to create WebSocket:', error);
        this.connectionPromise = null;
        reject(wsError);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearConnectionTimeout();
    this.clearReconnectTimer();
    this.connectionPromise = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback: MessageCallback<TReceive>): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  async send(message: TSend): Promise<void> {
    if (!this.isConnected()) {
      this.queueMessage(message);
      await this.connect().catch(error => {
        this.options.logger?.error('Failed to connect when sending message:', error);
      });
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      const wsError = new WebSocketError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
      );
      this.options.logger?.error('Send error:', wsError);
      this.queueMessage(message);
      throw wsError;
    }
  }

  getState(): WebSocketState | null {
    return this.ws?.readyState ?? null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocketState.OPEN;
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  getQueueLength(): number {
    return this.messageQueue.length;
  }

  private setupConnectionTimeout(reject: (reason: any) => void): void {
    this.clearConnectionTimeout();

    this.connectionTimer = setTimeout(() => {
      reject(new WebSocketError('WebSocket connection timeout'));
      this.connectionPromise = null;
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }, this.options.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private queueMessage(message: TSend): void {
    this.messageQueue.push(message);
  }

  private processQueue(): void {
    if (!this.isConnected() || this.messageQueue.length === 0) {
      return;
    }

    const queueCopy = [...this.messageQueue];
    this.clearQueue();

    queueCopy.forEach(message => {
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        this.options.logger?.error('Error sending queued message:', error);
        this.queueMessage(message);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      let data: TReceive;

      if (typeof event.data === 'string') {
        data = JSON.parse(event.data);
      } else {
        data = event.data as TReceive;
      }

      if (this.options.messageParser) {
        data = this.options.messageParser(data) as TReceive;
      }

      this.subscribers.forEach(subscriber => {
        try {
          subscriber(data);
        } catch (error) {
          this.options.logger?.error('Error in subscriber:', error);
        }
      });
    } catch (error) {
      this.options.logger?.error('Error parsing WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;
    this.connectionPromise = null;
    this.clearConnectionTimeout();
    this.options.logger?.info(`WebSocket closed with code ${event.code}: ${event.reason}`);

    if (!this.isManuallyDisconnected && this.shouldAttemptReconnect()) {
      const delay = this.calculateReconnectDelay();
      this.options.logger?.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(error => {
          this.options.logger?.error('Reconnection attempt failed:', error);
        });
      }, delay);
    }
  }

  private calculateReconnectDelay(): number {
    return Math.min(
      this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      30000
    );
  }

  private shouldAttemptReconnect(): boolean {
    return this.reconnectAttempts < this.options.maxReconnectAttempts;
  }
}
