import { io } from 'socket.io-client';

const rawSocketUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SOCKET_URL = rawSocketUrl.startsWith('http') ? rawSocketUrl : `https://${rawSocketUrl}`;

export const socket = io(SOCKET_URL);
