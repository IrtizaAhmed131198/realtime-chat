import { useState, useRef, useEffect } from 'react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ReplyPreview({ replyTo, isOwn }) {
  return (
    <div className={`text-xs px-2 py-1.5 rounded-lg mb-1.5 border-l-2 ${
      isOwn
        ? 'bg-blue-700/50 border-blue-300 text-blue-100'
        : 'bg-gray-100 dark:bg-gray-600 border-gray-400 text-gray-600 dark:text-gray-300'
    }`}>
      <p className="font-semibold mb-0.5">{replyTo.sender?.username}</p>
      <p className="truncate opacity-80">
        {replyTo.isDeleted ? 'Deleted message' : replyTo.content || replyTo.fileName || 'Attachment'}
      </p>
    </div>
  );
}

function EmojiPicker({ onSelect, onClose, isOwn }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-8 z-30 bg-white dark:bg-gray-700 rounded-2xl shadow-xl dark:shadow-gray-900 border border-gray-200 dark:border-gray-700 p-2 flex gap-1 ${isOwn ? 'right-0' : 'left-0'}`}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="text-xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default function MessageBubble({ message, isOwn, showSenderName, currentUserId, onReact, onEdit, onDelete, onReply }) {
  const [hovered, setHovered] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  const handleEditSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) onEdit(message._id, trimmed);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
    if (e.key === 'Escape') { setEditValue(message.content); setIsEditing(false); }
  };

  // Deleted state
  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="px-4 py-2 rounded-2xl text-sm italic text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
          This message was deleted
        </div>
      </div>
    );
  }

  const ActionBar = () => (
    <div className={`flex items-center gap-0.5 self-end mb-2 ${isOwn ? 'order-first mr-1' : 'order-last ml-1'}`}>
      {/* Emoji */}
      <div className="relative">
        <button
          onClick={() => setShowEmoji(true)}
          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition text-base leading-none"
          title="React"
        >😊</button>
        {showEmoji && (
          <EmojiPicker
            isOwn={isOwn}
            onSelect={(emoji) => onReact(message._id, emoji)}
            onClose={() => setShowEmoji(false)}
          />
        )}
      </div>

      {/* Reply */}
      <button
        onClick={() => onReply(message)}
        className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition"
        title="Reply"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      {/* Edit (own text messages only) */}
      {isOwn && message.type === 'text' && (
        <button
          onClick={() => { setEditValue(message.content); setIsEditing(true); }}
          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* Delete (own only) */}
      {isOwn && (
        <button
          onClick={() => onDelete(message._id)}
          className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-500 transition"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowEmoji(false); }}
    >
      {hovered && !isEditing && <ActionBar />}

      <div className={`flex flex-col max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSenderName && !isOwn && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1 font-medium">{message.sender?.username}</span>
        )}

        {/* Bubble */}
        <div className={`relative px-4 py-2.5 rounded-2xl text-sm break-words w-full ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-md border border-gray-100 dark:border-gray-600'
        }`}>
          {/* Reply preview */}
          {message.replyTo && <ReplyPreview replyTo={message.replyTo} isOwn={isOwn} />}

          {/* Inline edit mode */}
          {isEditing ? (
            <div>
              <textarea
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                className="w-full bg-blue-700 text-white text-sm rounded-lg p-2 outline-none resize-none min-w-[180px]"
              />
              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={handleEditSave}
                  className="text-xs bg-white text-blue-600 font-medium px-2.5 py-1 rounded-full hover:bg-blue-50 transition"
                >Save</button>
                <button
                  onClick={() => { setEditValue(message.content); setIsEditing(false); }}
                  className="text-xs bg-blue-700 text-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-800 transition"
                >Cancel</button>
              </div>
            </div>
          ) : message.type === 'image' && message.fileUrl ? (
            /* Image */
            <div>
              <img
                src={message.fileUrl}
                alt={message.fileName || 'image'}
                className="max-w-full rounded-xl max-h-52 object-cover cursor-pointer"
                onClick={() => window.open(message.fileUrl, '_blank')}
              />
              {message.content && <p className="mt-1.5 text-sm">{message.content}</p>}
            </div>
          ) : message.type === 'file' && message.fileUrl ? (
            /* File attachment */
            <a
              href={message.fileUrl}
              download={message.fileName}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-3 no-underline ${isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOwn ? 'bg-blue-700' : 'bg-gray-100 dark:bg-gray-600'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate max-w-[160px]">{message.fileName}</p>
                <p className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>{formatFileSize(message.fileSize)}</p>
              </div>
              <svg className={`w-4 h-4 shrink-0 ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          ) : (
            /* Text */
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {message.reactions.map((r) => {
              const reacted = r.users?.some((u) => (u._id || u)?.toString() === currentUserId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onReact(message._id, r.emoji)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition ${
                    reacted
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.users?.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Timestamp + edited + read receipts */}
        <span className="text-xs mt-1 px-1 text-gray-400 dark:text-gray-500 flex items-center gap-1">
          {formatTime(message.createdAt)}
          {message.isEdited && <span className="ml-1 italic opacity-70">· edited</span>}
          {isOwn && (
            <span className="ml-1">
              {message.readBy && message.readBy.length > 0 ? (
                // Double blue checkmarks = read
                <svg className="inline w-3.5 h-3.5 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M15.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L8.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                  <path d="M6.25 8.043l-.896-.897a.5.5 0 1 0-.708.708l.897.896.707-.707zm1 2.414.896.897a.5.5 0 0 0 .708 0l7-7a.5.5 0 0 0-.708-.708L8.5 10.293 7.854 9.646l-.604.811z"/>
                </svg>
              ) : (
                // Single gray checkmark = sent
                <svg className="inline w-3.5 h-3.5 text-gray-400 dark:text-gray-500" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              )}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
