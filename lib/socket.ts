"use client";

import { io, Socket } from "socket.io-client";

const URL = process.env.NEXT_PUBLIC_CLOUD_WS_URL;

export const socket: Socket | null = URL
    ? io(URL, {
          autoConnect: false,
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
      })
    : null;
