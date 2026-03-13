import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/api';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export default function MessageInput({ onSend, roomId, replyTo, onCancelReply }) {
  const [value, setValue] = useState('');
  const [file, setFile] = useState(null); // { raw, preview, isImage }
  const [uploading, setUploading] = useState(false);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef(null);

  const handleTyping = () => {
    if (!socket) return;
    if (!isTypingRef.current) { socket.emit('typing:start', { roomId }); isTypingRef.current = true; }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId });
      isTypingRef.current = false;
    }, 1500);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = IMAGE_TYPES.includes(f.type);
    setFile({ raw: f, preview: isImage ? URL.createObjectURL(f) : null, isImage });
    e.target.value = '';
  };

  const clearFile = () => {
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setFile(null);
  };

  const stopTyping = () => {
    if (socket) { socket.emit('typing:stop', { roomId }); isTypingRef.current = false; }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim() && !file) return;
    stopTyping();

    if (file) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file.raw);
        const res = await api.post('/messages/upload', formData);
        onSend({
          content: value.trim(),
          replyTo: replyTo?._id,
          fileUrl: res.data.fileUrl,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
          type: file.isImage ? 'image' : 'file',
        });
        clearFile();
      } catch (err) {
        console.error('Upload failed', err);
      } finally {
        setUploading(false);
      }
    } else {
      onSend({ content: value.trim(), replyTo: replyTo?._id });
    }
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  useEffect(() => () => {
    clearTimeout(typingTimeoutRef.current);
    if (file?.preview) URL.revokeObjectURL(file.preview);
  }, []);

  const canSend = (value.trim() || file) && !uploading;

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 px-3 py-2 mb-2 rounded-r-lg">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{replyTo.sender?.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {replyTo.isDeleted ? 'Deleted message' : replyTo.content || replyTo.fileName || 'Attachment'}
            </p>
          </div>
          <button onClick={onCancelReply} className="text-gray-400 hover:text-gray-600 ml-3 shrink-0 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* File preview */}
      {file && (
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2 mb-2 border border-gray-200 dark:border-gray-600">
          {file.isImage ? (
            <img src={file.preview} alt="preview" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">{file.raw.name}</p>
          <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-600 focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-gray-700 transition">
          {/* Attach button */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition shrink-0"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <textarea
            value={value}
            onChange={(e) => { setValue(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={file ? 'Add a caption...' : 'Type a message...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 dark:placeholder-gray-400 outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: '24px' }}
          />

          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-white translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
