import { io, Socket } from 'socket.io-client';

// Use localhost for development. In production, this would be your server's URL.
const IS_PROD = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const SOCKET_URL = IS_PROD ? window.location.origin : 'http://localhost:5005';

class SocketService {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();

    connect() {
        if (this.socket?.connected) return;

        this.socket = io(SOCKET_URL);

        this.socket.on('connect', () => {
            console.log('🔌 Socket connected:', this.socket?.id);
        });

        this.socket.on('data_updated', (data) => {
            this.trigger('data_updated', data);
        });

        this.socket.on('notification_received', (data) => {
            this.trigger('notification_received', data);
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });
    }

    on(event: string, callback: (data: any) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);
    }

    off(event: string, callback: (data: any) => void) {
        this.listeners.get(event)?.delete(callback);
    }

    private trigger(event: string, data: any) {
        this.listeners.get(event)?.forEach(callback => callback(data));
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export const socketService = new SocketService();
