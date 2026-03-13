import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import ProfileModal from '../Profile/ProfileModal';
import GlobalSearchModal from './GlobalSearchModal';
import api from '../../api/api';

const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';

const COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-yellow-500','bg-red-500','bg-pink-500','bg-indigo-500'];
const getColor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];

function NewGroupModal({ allUsers, onClose, onCreated }) {
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMember = (id) => {
    setGroupMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { setError('Please enter a group name.'); return; }
    if (groupMembers.length === 0) { setError('Please select at least one member.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/rooms/group', { name: groupName.trim(), members: groupMembers });
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900 w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">New Group</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <input
          autoFocus
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">SELECT MEMBERS</p>
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-y-auto max-h-48 mb-4">
          {allUsers.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No users available</p>
          ) : (
            allUsers.map((u) => (
              <label
                key={u._id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={groupMembers.includes(u._id)}
                  onChange={() => toggleMember(u._id)}
                  className="w-4 h-4 accent-blue-600"
                />
                <div className={`w-7 h-7 rounded-full ${getColor(u.username)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {getInitials(u.username)}
                </div>
                <span className="text-sm text-gray-800 dark:text-gray-100">{u.username}</span>
              </label>
            ))
          )}
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? 'Creating...' : `Create${groupMembers.length > 0 ? ` (${groupMembers.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ selectedRoom, onRoomSelect, rooms, setRooms, onRoomCreated, unreadCounts = {} }) {
  const { user, logout } = useAuth();
  const { isOnline } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [tab, setTab] = useState('chats');

  useEffect(() => {
    api.get('/rooms').then((res) => setRooms(res.data)).catch(console.error);
    api.get('/users').then((res) => setAllUsers(res.data)).catch(console.error);
  }, []);

  const startPrivateChat = async (userId) => {
    try {
      const res = await api.post('/rooms/private', { userId });
      onRoomCreated(res.data);
      setTab('chats');
    } catch (err) {
      console.error(err);
    }
  };

  const getRoomName = (room) => {
    if (room.type === 'group') return room.name;
    const other = room.members?.find((m) => m._id !== user._id);
    return other?.username || 'Unknown';
  };

  const getRoomOnlineStatus = (room) => {
    if (room.type === 'group') return false;
    const other = room.members?.find((m) => m._id !== user._id);
    return other ? isOnline(other._id) : false;
  };

  const filteredRooms = rooms.filter((r) =>
    getRoomName(r).toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return (
    <>
      {showGroupModal && (
        <NewGroupModal
          allUsers={allUsers}
          onClose={() => setShowGroupModal(false)}
          onCreated={(room) => { onRoomCreated(room); setTab('chats'); }}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showGlobalSearch && (
        <GlobalSearchModal
          rooms={rooms}
          onClose={() => setShowGlobalSearch(false)}
          onRoomSelect={(room) => { onRoomSelect(room); setShowGlobalSearch(false); }}
        />
      )}

      <div className="w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 hover:opacity-80 transition text-left"
              title="Edit profile"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${getColor(user?.username)} flex items-center justify-center text-white text-sm font-bold`}>
                    {getInitials(user?.username)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{user?.username}</p>
                <p className="text-xs text-green-500">Online</p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1 rounded"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button onClick={logout} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1 rounded" title="Logout">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:ring-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="shrink-0 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-400 hover:text-blue-500 hover:border-blue-300 dark:hover:border-blue-400 transition"
              title="Search messages"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {['chats', 'users'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition flex items-center justify-center gap-1.5 ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'chats' && totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* New Group button — outside the scroll list */}
        {tab === 'chats' && (
          <button
            type="button"
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-gray-700 transition w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'chats' && (
            filteredRooms.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">No conversations yet</div>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room._id}
                  onClick={() => onRoomSelect(room)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left ${selectedRoom?._id === room._id ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full ${room.type === 'group' ? 'bg-purple-500' : getColor(getRoomName(room))} flex items-center justify-center text-white text-sm font-bold`}>
                      {room.type === 'group' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ) : getInitials(getRoomName(room))}
                    </div>
                    {getRoomOnlineStatus(room) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${unreadCounts[room._id] > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                      {getRoomName(room)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {room.type === 'group' ? `${room.members?.length} members` : (getRoomOnlineStatus(room) ? 'Online' : 'Offline')}
                    </p>
                  </div>
                  {unreadCounts[room._id] > 0 && (
                    <span className="shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {unreadCounts[room._id] > 99 ? '99+' : unreadCounts[room._id]}
                    </span>
                  )}
                </button>
              ))
            )
          )}

          {tab === 'users' && (
            filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">No users found</div>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u._id}
                  onClick={() => startPrivateChat(u._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full ${getColor(u.username)} flex items-center justify-center text-white text-sm font-bold`}>
                      {getInitials(u.username)}
                    </div>
                    {isOnline(u._id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{u.username}</p>
                    <p className={`text-xs ${isOnline(u._id) ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                      {isOnline(u._id) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </div>
    </>
  );
}
