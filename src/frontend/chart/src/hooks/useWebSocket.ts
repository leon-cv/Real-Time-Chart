import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketService, WebSocketState } from '~/services/WebSocketService';

export interface UseWebSocketOptions<TReceive, TSend> {
  url: string;
  onMessage?: (data: TReceive) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  connectionTimeout?: number;
}

export interface UseWebSocketResult<TReceive, TSend> {
  send: (message: TSend) => Promise<void>;
  isConnected: boolean;
  connectionState: WebSocketState | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  lastMessage: TReceive | null;
  error: Error | null;
  queueLength: number;
}

/**
 * React hook for WebSocket communication
 * 
 * @example
 * ```tsx
 * const { send, isConnected, lastMessage } = useWebSocket<ServerMessage, ClientMessage>({
 *   url: 'wss://example.com/socket',
 *   onMessage: (data) => console.log('Message received:', data),
 *   autoConnect: true
 * });
 * 
 * // In a component
 * return (
 *   <div>
 *     <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
 *     <button onClick={() => send({ type: 'ping' })}>Send Ping</button>
 *     {lastMessage && <pre>{JSON.stringify(lastMessage, null, 2)}</pre>}
 *   </div>
 * );
 * ```
 */
export function useWebSocket<TReceive = any, TSend = any>(
  options: UseWebSocketOptions<TReceive, TSend>
): UseWebSocketResult<TReceive, TSend> {
  const {
    url,
    onMessage,
    onError,
    onOpen,
    onClose,
    autoConnect = true,
    reconnectDelay,
    maxReconnectAttempts,
    connectionTimeout
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<WebSocketState | null>(null);
  const [lastMessage, setLastMessage] = useState<TReceive | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [queueLength, setQueueLength] = useState<number>(0);

  const serviceRef = useRef<WebSocketService<TReceive, TSend> | null>(null);

  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new WebSocketService<TReceive, TSend>(url, {
        autoConnect: false,
        reconnectDelay,
        maxReconnectAttempts,
        connectionTimeout,
        logger: {
          info: (message, ...args) => console.info(`[WebSocket] ${message}`, ...args),
          error: (message, ...args) => console.error(`[WebSocket] ${message}`, ...args)
        }
      });
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [url, reconnectDelay, maxReconnectAttempts, connectionTimeout]);

  useEffect(() => {
    if (!serviceRef.current) return;

    const checkConnectionState = () => {
      const service = serviceRef.current;
      if (!service) return;

      const newState = service.getState();
      const newConnected = service.isConnected();

      setConnectionState(newState);
      setIsConnected(newConnected);
      setQueueLength(service.getQueueLength());
    };

    checkConnectionState();
    const intervalId = setInterval(checkConnectionState, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;

    const messageHandler = (data: TReceive) => {
      setLastMessage(data);
      onMessage?.(data);
    };

    const unsubscribe = service.subscribe(messageHandler);

    return () => {
      unsubscribe();
    };
  }, [onMessage]);

  useEffect(() => {
    if (autoConnect && serviceRef.current) {
      connect().catch(err => {
        setError(err);
        onError?.(err);
      });
    }
  }, [autoConnect]);

  const connect = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.connect();
      setIsConnected(true);
      setError(null);
      onOpen?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnected(false);
      onError?.(error);
      throw error;
    }
  }, [onOpen, onError]);

  const disconnect = useCallback(() => {
    if (!serviceRef.current) return;

    serviceRef.current.disconnect();
    setIsConnected(false);

    const closeEvent = new CloseEvent('close', {
      wasClean: true,
      code: 1000,
      reason: 'Disconnected by user'
    });

    onClose?.(closeEvent);
  }, [onClose]);

  const send = useCallback(async (message: TSend) => {
    if (!serviceRef.current) {
      throw new Error('WebSocket service not initialized');
    }

    try {
      await serviceRef.current.send(message);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onError]);

  return {
    send,
    isConnected,
    connectionState,
    connect,
    disconnect,
    lastMessage,
    error,
    queueLength
  };
}