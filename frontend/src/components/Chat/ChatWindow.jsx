import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupInfoModal from './GroupInfoModal';
import api from '../../api/api';

const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';
const COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-yellow-500','bg-red-500','bg-pink-500','bg-indigo-500'];
const getColor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];
const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-gray-900 dark:text-white rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </span>
  );
}

export default function ChatWindow({ room, onBack, onRoomUpdate, onLeaveRoom }) {
  const { user } = useAuth();
  const { socket, isOnline } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // In-room search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const messagesEndRef = useRef(null);

  const getRoomName = useCallback(() => {
    if (room.type === 'group') return room.name;
    return room.members?.find((m) => m._id !== user._id)?.username || 'Unknown';
  }, [room, user._id]);

  const getOtherUser = useCallback(() =>
    room.members?.find((m) => m._id !== user._id), [room, user._id]);

  useEffect(() => {
    setLoading(true);
    setReplyTo(null);
    closeSearch();
    api.get(`/messages/${room._id}`)
      .then((res) => setMessages(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [room._id]);

  // Emit messages:read when messages load
  useEffect(() => {
    if (messages.length > 0 && socket) {
      socket.emit('messages:read', { roomId: room._id });
    }
  }, [messages.length > 0, room._id, socket]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('room:join', room._id);

    // Emit read on join
    socket.emit('messages:read', { roomId: room._id });

    const handleNewMessage = (message) => {
      if (message.room === room._id || message.room?._id === room._id) {
        setMessages((prev) => [...prev, message]);
        // Mark as read if it's not our own message
        const senderId = message.sender?._id || message.sender;
        if (senderId !== user._id) {
          socket.emit('messages:read', { roomId: room._id });
        }
      }
    };
    const handleEdited = (updated) =>
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
    const handleDeleted = ({ _id }) =>
      setMessages((prev) => prev.map((m) => m._id === _id ? { ...m, isDeleted: true, content: '' } : m));
    const handleReacted = (updated) =>
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
    const handleTypingStart = ({ userId, username }) => {
      if (userId !== user._id)
        setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username]);
    };
    const handleTypingStop = ({ userId }) => {
      const u = room.members?.find((m) => m._id === userId);
      if (u) setTypingUsers((prev) => prev.filter((n) => n !== u.username));
    };
    const handleReadUpdate = ({ roomId, userId: readerId }) => {
      if (roomId === room._id) {
        setMessages((prev) => prev.map((m) =>
          m.sender?._id === user._id && !m.readBy?.includes(readerId)
            ? { ...m, readBy: [...(m.readBy || []), readerId] }
            : m
        ));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:reacted', handleReacted);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('messages:read_update', handleReadUpdate);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:reacted', handleReacted);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('messages:read_update', handleReadUpdate);
    };
  }, [socket, room._id, user._id, room.members]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // In-room search debounce
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    if (!searchOpen) return;
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearchDone(false); return; }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchDone(true);
      try {
        const res = await api.get('/messages/search', { params: { q: searchQuery.trim(), roomId: room._id } });
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, searchOpen, room._id]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchDone(false);
  };

  // Scroll to a message in the loaded list
  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-1', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-1', 'rounded-xl'), 2000);
      closeSearch();
    }
  };

  const sendMessage = ({ content, replyTo: replyToId, fileUrl, fileName, fileSize, type }) => {
    if (!socket) return;
    socket.emit('message:send', { roomId: room._id, content, replyTo: replyToId, fileUrl, fileName, fileSize, type });
    setReplyTo(null);
  };

  const roomName = getRoomName();
  const otherUser = getOtherUser();
  const online = room.type === 'private' && otherUser ? isOnline(otherUser._id) : false;

  return (
    <>
      {showGroupInfo && (
        <GroupInfoModal
          room={room}
          onClose={() => setShowGroupInfo(false)}
          onRoomUpdate={(updated) => { onRoomUpdate?.(updated); }}
          onLeave={(roomId) => { onLeaveRoom?.(roomId); }}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm dark:shadow-gray-900 min-h-[64px]">
          {searchOpen ? (
            /* Search bar mode */
            <>
              <button onClick={closeSearch} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this conversation..."
                  className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 dark:placeholder-gray-400 outline-none"
                  onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchDone(false); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchDone && !searchLoading && (
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{searchResults.length} found</span>
              )}
            </>
          ) : (
            /* Normal header */
            <>
              {/* Mobile back button */}
              <button onClick={onBack} className="md:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition mr-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="relative shrink-0">
                <div className={`w-10 h-10 rounded-full ${room.type === 'group' ? 'bg-purple-500' : getColor(roomName)} flex items-center justify-center text-white font-bold text-sm`}>
                  {room.type === 'group' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : getInitials(roomName)}
                </div>
                {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">{roomName}</h2>
                <p className={`text-xs ${room.type === 'group' ? 'text-gray-400 dark:text-gray-500' : online ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {room.type === 'group' ? `${room.members?.length} members` : (online ? 'Online' : 'Offline')}
                </p>
              </div>
              {/* Search icon */}
              <button
                onClick={openSearch}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                title="Search in conversation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {room.type === 'group' && (
                <button
                  onClick={() => setShowGroupInfo(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                  title="Group info"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* In-room search results panel */}
        {searchOpen && (searchLoading || searchDone) && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-y-auto" style={{ maxHeight: '280px' }}>
            {searchLoading && (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              </div>
            )}
            {!searchLoading && searchDone && searchResults.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">No messages found for "{searchQuery}"</div>
            )}
            {!searchLoading && searchResults.length > 0 && searchResults.map((msg) => {
              const inLoaded = messages.some((m) => m._id === msg._id);
              return (
                <button
                  key={msg._id}
                  onClick={() => inLoaded ? scrollToMessage(msg._id) : null}
                  className="w-full flex gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition text-left border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <div className="shrink-0 mt-0.5">
                    {msg.sender?.avatar ? (
                      <img src={msg.sender.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                        {msg.sender?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{msg.sender?.username}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(msg.createdAt)}</span>
                      {!inLoaded && <span className="text-xs text-gray-300 dark:text-gray-600 italic">· not in view</span>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      <Highlight text={msg.content} query={searchQuery.trim()} />
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <p className="text-sm">No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg._id || i} id={`msg-${msg._id}`} className="transition-all duration-300">
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender?._id === user._id || msg.sender === user._id}
                  showSenderName={room.type === 'group'}
                  currentUserId={user._id}
                  onEdit={(id, content) => socket?.emit('message:edit', { messageId: id, content })}
                  onDelete={(id) => socket?.emit('message:delete', { messageId: id })}
                  onReact={(id, emoji) => socket?.emit('message:react', { messageId: id, emoji })}
                  onReply={setReplyTo}
                />
              </div>
            ))
          )}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm px-2">
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <MessageInput
          onSend={sendMessage}
          roomId={room._id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </>
  );
}
