
"use client"
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = io('http://localhost:5002', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setError(error.message);
      setIsConnected(false);
    });

    // P2P Network events
    socket.on('p2p-node-started', (data) => {
      console.log('P2P node started:', data);
      window.dispatchEvent(new CustomEvent('p2p-node-started', { detail: data }));
    });

    socket.on('p2p-peer-discovered', (data) => {
      console.log('Peer discovered:', data);
      window.dispatchEvent(new CustomEvent('p2p-peer-discovered', { detail: data }));
    });

    socket.on('p2p-peer-connected', (data) => {
      console.log('Peer connected:', data);
      window.dispatchEvent(new CustomEvent('p2p-peer-connected', { detail: data }));
    });

    socket.on('p2p-peer-disconnected', (data) => {
      console.log('Peer disconnected:', data);
      window.dispatchEvent(new CustomEvent('p2p-peer-disconnected', { detail: data }));
    });

    socket.on('p2p-status', (data) => {
      console.log('P2P status update:', data);
      window.dispatchEvent(new CustomEvent('p2p-status', { detail: data }));
    });

    // Machine Learning events
    socket.on('ml-model-initialized', () => {
      console.log('ML model initialized');
      window.dispatchEvent(new CustomEvent('ml-model-initialized'));
    });

    socket.on('ml-training-started', (data) => {
      console.log('Training started:', data);
      window.dispatchEvent(new CustomEvent('ml-training-started', { detail: data }));
    });

    socket.on('ml-training-progress', (data) => {
      console.log('Training progress:', data);
      window.dispatchEvent(new CustomEvent('ml-training-progress', { detail: data }));
    });

    socket.on('ml-training-completed', (data) => {
      console.log('Training completed:', data);
      window.dispatchEvent(new CustomEvent('ml-training-completed', { detail: data }));
    });

    socket.on('ml-weights-aggregated', () => {
      console.log('Model weights aggregated');
      window.dispatchEvent(new CustomEvent('ml-weights-aggregated'));
    });

    // Network data events
    socket.on('network-stats', (data) => {
      window.dispatchEvent(new CustomEvent('network-stats', { detail: data }));
    });

    socket.on('network-activity', (data) => {
      window.dispatchEvent(new CustomEvent('network-activity', { detail: data }));
    });

    socket.on('connected-peers', (data) => {
      window.dispatchEvent(new CustomEvent('connected-peers', { detail: data }));
    });

    socket.on('training-history', (data) => {
      window.dispatchEvent(new CustomEvent('training-history', { detail: data }));
    });

    socket.on('training-status', (data) => {
      window.dispatchEvent(new CustomEvent('training-status', { detail: data }));
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError(error.message);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket connection');
      socket.disconnect();
    };
  }, []);

  const emit = (event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  };

  const requestNetworkStatus = () => {
    emit('request-network-status');
  };

  const requestTrainingHistory = () => {
    emit('request-training-history');
  };

  const startTraining = () => {
    emit('start-training');
  };

  const stopTraining = () => {
    emit('stop-training');
  };

  return {
    isConnected,
    error,
    emit,
    requestNetworkStatus,
    requestTrainingHistory,
    startTraining,
    stopTraining,
  };
}
