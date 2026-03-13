import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) { setSocket(null); return; }

    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => console.log('Socket connected'));
    newSocket.on('connect_error', (err) => console.error('Socket error:', err.message));

    newSocket.on('users:online', (users) => setOnlineUsers(users));
    newSocket.on('user:online', ({ userId, isOnline }) => {
      setOnlineUsers((prev) =>
        isOnline ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)
      );
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [user]);

  const isOnline = (userId) => onlineUsers.includes(userId?.toString());

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, isOnline }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
