import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';

function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-gray-900 dark:text-white rounded-sm px-0.5 not-italic">{part}</mark>
          : part
      )}
    </span>
  );
}

const formatTime = (d) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function GlobalSearchModal({ onClose, onRoomSelect, rooms }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setSearched(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const res = await api.get('/messages/search', { params: { q: query.trim() } });
        setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const getRoomDisplayName = (room) => {
    if (room.type === 'group') return room.name;
    const other = room.members?.find((m) => m._id !== user._id);
    return other?.username || 'Unknown';
  };

  const handleResultClick = (msg) => {
    const room = rooms.find((r) => r._id === (msg.room?._id || msg.room));
    if (room) { onRoomSelect(room); onClose(); }
  };

  // Group results by room
  const grouped = results.reduce((acc, msg) => {
    const roomId = msg.room?._id || msg.room;
    if (!acc[roomId]) acc[roomId] = { room: msg.room, messages: [] };
    acc[roomId].messages.push(msg);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ maxHeight: '75vh' }}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages across all conversations..."
            className="flex-1 text-sm text-gray-800 dark:text-gray-100 dark:placeholder-gray-400 outline-none bg-transparent"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 pl-1 border-l border-gray-200 dark:border-gray-600 ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(75vh - 57px)' }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-500">
              <svg className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-medium">No messages found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-500">
              <svg className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 px-4 pt-3 pb-1 font-medium">
                {results.length} result{results.length !== 1 ? 's' : ''} for "<span className="text-gray-600 dark:text-gray-300">{query}</span>"
              </p>
              {Object.values(grouped).map(({ room, messages }) => (
                <div key={room?._id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                  {/* Room header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${room?.type === 'group' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                      {room?.type === 'group' ? '#' : (getRoomDisplayName(room)?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{getRoomDisplayName(room)}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{messages.length} match{messages.length !== 1 ? 'es' : ''}</span>
                  </div>

                  {/* Messages in this room */}
                  {messages.map((msg) => (
                    <button
                      key={msg._id}
                      onClick={() => handleResultClick(msg)}
                      className="w-full flex gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition text-left border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <div className="shrink-0 mt-0.5">
                        {msg.sender?.avatar ? (
                          <img src={msg.sender.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-white">
                            {msg.sender?.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{msg.sender?.username}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(msg.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          <Highlight text={msg.content} query={query.trim()} />
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
