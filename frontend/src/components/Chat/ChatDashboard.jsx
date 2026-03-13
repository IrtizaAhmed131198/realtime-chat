import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-yellow-500','bg-red-500','bg-pink-500','bg-indigo-500'];
const getColor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];
const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';

function NotificationToast({ toast, onClick, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900 border border-gray-100 dark:border-gray-700 p-3 w-72 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
      style={{ animation: 'slideIn 0.2s ease-out' }}
      onClick={onClick}
    >
      <div className={`w-9 h-9 rounded-full ${getColor(toast.senderName)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
        {getInitials(toast.senderName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{toast.senderName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{toast.body}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-gray-300 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition shrink-0 mt-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ChatDashboard() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [toasts, setToasts] = useState([]);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Refs so socket callbacks always see latest values without re-subscribing
  const selectedRoomRef = useRef(null);
  const roomsRef = useRef([]);
  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  // Request browser notification permission once on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Sync document title with total unread count
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
    document.title = total > 0 ? `(${total}) ChatApp` : 'ChatApp';
    return () => { document.title = 'ChatApp'; };
  }, [unreadCounts]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Room updates (rename, member changes)
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdated = (updatedRoom) => {
      setRooms((prev) => prev.map((r) => r._id === updatedRoom._id ? updatedRoom : r));
      if (selectedRoomRef.current?._id === updatedRoom._id) {
        setSelectedRoom(updatedRoom);
      }
    };

    const handleMemberRemoved = ({ roomId, userId }) => {
      // If current user was removed, drop the room from sidebar
      if (userId === user._id) {
        setRooms((prev) => prev.filter((r) => r._id !== roomId));
        if (selectedRoomRef.current?._id === roomId) setSelectedRoom(null);
      }
    };

    socket.on('room:updated', handleRoomUpdated);
    socket.on('room:member_removed', handleMemberRemoved);
    return () => {
      socket.off('room:updated', handleRoomUpdated);
      socket.off('room:member_removed', handleMemberRemoved);
    };
  }, [socket, user._id]);

  // Global socket listener — tracks unread counts & fires notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      const roomId = message.room?._id || message.room;
      const senderId = message.sender?._id || message.sender;

      // Skip own messages
      if (senderId === user._id) return;

      const isActiveRoom = selectedRoomRef.current?._id === roomId;
      if (isActiveRoom) return;

      const senderName = message.sender?.username || 'Someone';
      const body =
        message.type === 'image' ? '📷 Image'
        : message.type === 'file' ? `📎 ${message.fileName || 'File'}`
        : message.content;

      // Increment unread badge for that room
      setUnreadCounts((prev) => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));

      if (document.hidden) {
        // Tab is in background → browser push notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const notif = new Notification(senderName, { body, tag: roomId });
          notif.onclick = () => {
            window.focus();
            const room = roomsRef.current.find((r) => r._id === roomId);
            if (room) handleRoomSelect(room);
          };
        }
      } else {
        // Tab is visible but different room → in-app toast (max 3)
        const id = Date.now();
        setToasts((prev) => [...prev.slice(-2), { id, roomId, senderName, body }]);
      }
    };

    socket.on('message:new', handleNewMessage);
    return () => socket.off('message:new', handleNewMessage);
  }, [socket, user._id]);

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    setUnreadCounts((prev) => ({ ...prev, [room._id]: 0 }));
  };

  const handleRoomCreated = (room) => {
    setRooms((prev) => {
      const exists = prev.find((r) => r._id === room._id);
      return exists ? prev : [room, ...prev];
    });
    setSelectedRoom(room);
    setUnreadCounts((prev) => ({ ...prev, [room._id]: 0 }));
  };

  const handleToastClick = (toast) => {
    const room = roomsRef.current.find((r) => r._id === toast.roomId);
    if (room) handleRoomSelect(room);
    dismissToast(toast.id);
  };

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar — full width on mobile when no room selected, fixed width on desktop */}
        <div className={`
          ${selectedRoom ? 'hidden md:flex' : 'flex'}
          w-full md:w-80 flex-col
        `}>
          <Sidebar
            selectedRoom={selectedRoom}
            onRoomSelect={handleRoomSelect}
            rooms={rooms}
            setRooms={setRooms}
            onRoomCreated={handleRoomCreated}
            unreadCounts={unreadCounts}
          />
        </div>

        {/* Chat area */}
        <div className={`
          ${selectedRoom ? 'flex' : 'hidden md:flex'}
          flex-1 flex-col min-w-0
        `}>
          {selectedRoom ? (
            <ChatWindow
              room={selectedRoom}
              onBack={() => setSelectedRoom(null)}
              onRoomUpdate={(updated) => {
                setRooms((prev) => prev.map((r) => r._id === updated._id ? updated : r));
                setSelectedRoom(updated);
              }}
              onLeaveRoom={(roomId) => {
                setRooms((prev) => prev.filter((r) => r._id !== roomId));
                setSelectedRoom(null);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <svg className="w-20 h-20 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose from your existing conversations or start a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* In-app toast stack — bottom-right */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto" style={{ animation: 'slideIn 0.2s ease-out' }}>
            <NotificationToast
              toast={toast}
              onClick={() => handleToastClick(toast)}
              onDismiss={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
