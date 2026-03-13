import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';

const COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-yellow-500','bg-red-500','bg-pink-500','bg-indigo-500'];
const getColor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];
const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';

function Avatar({ user, size = 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full overflow-hidden shrink-0`}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full ${getColor(user?.username)} flex items-center justify-center text-white font-bold`}>
          {getInitials(user?.username)}
        </div>
      )}
    </div>
  );
}

export default function GroupInfoModal({ room, onClose, onRoomUpdate, onLeave }) {
  const { user } = useAuth();
  const isAdmin = room.admin?._id === user._id || room.admin === user._id;

  const [groupName, setGroupName] = useState(room.name);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [allUsers, setAllUsers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const [removingId, setRemovingId] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const currentMembers = room.members || [];
  const nonMembers = allUsers.filter(
    (u) => !currentMembers.some((m) => m._id === u._id)
  );

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then((res) => setAllUsers(res.data)).catch(console.error);
    }
  }, [isAdmin]);

  const handleRename = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || groupName.trim() === room.name) return;
    setRenameError('');
    setRenameLoading(true);
    try {
      const res = await api.patch(`/rooms/${room._id}`, { name: groupName.trim() });
      onRoomUpdate(res.data);
    } catch (err) {
      setRenameError(err.response?.data?.message || 'Rename failed.');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setRemovingId(memberId);
    try {
      const res = await api.delete(`/rooms/${room._id}/members/${memberId}`);
      onRoomUpdate(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedNewMembers.length) return;
    setAddError('');
    setAddLoading(true);
    try {
      const res = await api.post(`/rooms/${room._id}/members`, { members: selectedNewMembers });
      onRoomUpdate(res.data);
      setSelectedNewMembers([]);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add members.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleLeave = async () => {
    setLeaveLoading(true);
    try {
      await api.delete(`/rooms/${room._id}/leave`);
      onLeave(room._id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLeaveLoading(false);
    }
  };

  const toggleNewMember = (id) => {
    setSelectedNewMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Group Info</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Group icon + name */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            {isAdmin ? (
              <form onSubmit={handleRename} className="flex gap-2 w-full mt-1">
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-semibold"
                />
                <button
                  type="submit"
                  disabled={renameLoading || groupName.trim() === room.name}
                  className="bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                >
                  {renameLoading ? '...' : 'Rename'}
                </button>
              </form>
            ) : (
              <p className="font-semibold text-gray-900 dark:text-white text-lg">{room.name}</p>
            )}
            {renameError && <p className="text-xs text-red-500">{renameError}</p>}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Members list */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Members · {currentMembers.length}
            </h3>
            <div className="space-y-1">
              {currentMembers.map((member) => {
                const memberId = member._id;
                const isRoomAdmin = room.admin?._id === memberId || room.admin === memberId;
                const isSelf = memberId === user._id;
                return (
                  <div key={memberId} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Avatar user={member} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {member.username}{isSelf ? ' (You)' : ''}
                      </p>
                      {isRoomAdmin && (
                        <span className="text-xs text-purple-600 font-medium">👑 Admin</span>
                      )}
                    </div>
                    {isAdmin && !isSelf && !isRoomAdmin && (
                      <button
                        onClick={() => handleRemoveMember(memberId)}
                        disabled={removingId === memberId}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition disabled:opacity-50"
                      >
                        {removingId === memberId ? '...' : 'Remove'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add members (admin only) */}
          {isAdmin && nonMembers.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Add Members</h3>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-y-auto max-h-40 mb-3">
                  {nonMembers.map((u) => (
                    <label
                      key={u._id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedNewMembers.includes(u._id)}
                        onChange={() => toggleNewMember(u._id)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <Avatar user={u} size="sm" />
                      <span className="text-sm text-gray-800 dark:text-gray-100">{u.username}</span>
                    </label>
                  ))}
                </div>
                {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
                <button
                  onClick={handleAddMembers}
                  disabled={!selectedNewMembers.length || addLoading}
                  className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
                >
                  {addLoading ? 'Adding...' : `Add${selectedNewMembers.length > 0 ? ` (${selectedNewMembers.length})` : ''}`}
                </button>
              </div>
            </>
          )}

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Leave group */}
          <button
            onClick={handleLeave}
            disabled={leaveLoading}
            className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-medium text-sm py-2.5 rounded-lg transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {leaveLoading ? 'Leaving...' : 'Leave Group'}
          </button>

          <div className="pb-1" />
        </div>
      </div>
    </div>
  );
}
