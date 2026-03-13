import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';

const COLORS = ['bg-blue-500','bg-purple-500','bg-green-500','bg-yellow-500','bg-red-500','bg-pink-500','bg-indigo-500'];
const getColor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];
const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';

function Alert({ type, message }) {
  if (!message) return null;
  const styles = type === 'success'
    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400';
  return (
    <div className={`border px-3 py-2 rounded-lg text-sm ${styles}`}>{message}</div>
  );
}

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  // Profile form
  const [profile, setProfile] = useState({ username: user.username, email: user.email });
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Avatar
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user.avatar || '');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/me/avatar', formData);
      updateUser(res.data);
      setAvatarPreview(res.data.avatar);
    } catch (err) {
      setAvatarPreview(user.avatar || '');
      setProfileStatus({ type: 'error', message: 'Avatar upload failed.' });
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileStatus({ type: '', message: '' });
    if (!profile.username.trim() || !profile.email.trim()) {
      setProfileStatus({ type: 'error', message: 'Username and email are required.' });
      return;
    }
    setProfileLoading(true);
    try {
      const res = await api.patch('/users/me', {
        username: profile.username,
        email: profile.email,
      });
      updateUser(res.data);
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err) {
      setProfileStatus({ type: 'error', message: err.response?.data?.message || 'Update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      setPasswordStatus({ type: 'error', message: 'All password fields are required.' });
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (passwords.newPass.length < 6) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    setPasswordLoading(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: passwords.current,
        newPassword: passwords.newPass,
      });
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      setPasswordStatus({ type: 'error', message: err.response?.data?.message || 'Password update failed.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Settings</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="relative w-24 h-24 rounded-full overflow-hidden focus:outline-none"
                title="Change avatar"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full ${getColor(user.username)} flex items-center justify-center text-white text-2xl font-bold`}>
                    {getInitials(user.username)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  {avatarLoading ? (
                    <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Click to change photo · Max 5MB</p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Profile info */}
          <form onSubmit={handleProfileSave} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Account Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <Alert type={profileStatus.type} message={profileStatus.message} />
            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Change password */}
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Change Password</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
              <input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <input
                type="password"
                value={passwords.newPass}
                onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            <Alert type={passwordStatus.type} message={passwordStatus.message} />
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 dark:hover:bg-gray-500 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <div className="pb-1" />
        </div>
      </div>
    </div>
  );
}
