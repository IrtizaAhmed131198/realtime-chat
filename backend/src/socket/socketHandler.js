const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Room = require('../models/Room');

const onlineUsers = new Map();

const populateMessage = (query) =>
  query
    .populate('sender', '-password')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } });

const initSocket = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      socket.user = await User.findById(decoded.id).select('-password');
      if (!socket.user) return next(new Error('User not found'));
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('user:online', { userId, isOnline: true });

    const rooms = await Room.find({ members: userId });
    rooms.forEach((room) => socket.join(room._id.toString()));

    socket.emit('users:online', Array.from(onlineUsers.keys()));

    // Send message
    socket.on('message:send', async ({ roomId, content, replyTo, fileUrl, fileName, fileSize, type }) => {
      try {
        if (!content?.trim() && !fileUrl) return;
        const room = await Room.findOne({ _id: roomId, members: userId });
        if (!room) return;

        const message = await Message.create({
          room: roomId,
          sender: userId,
          content: content?.trim() || '',
          type: type || 'text',
          fileUrl: fileUrl || '',
          fileName: fileName || '',
          fileSize: fileSize || 0,
          replyTo: replyTo || null,
        });

        await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });

        const populated = await populateMessage(Message.findById(message._id));
        io.to(roomId).emit('message:new', populated);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Edit message
    socket.on('message:edit', async ({ messageId, content }) => {
      try {
        if (!content?.trim()) return;
        const message = await Message.findOne({ _id: messageId, sender: userId });
        if (!message || message.isDeleted) return;

        message.content = content.trim();
        message.isEdited = true;
        await message.save();

        const populated = await populateMessage(Message.findById(message._id));
        io.to(message.room.toString()).emit('message:edited', populated);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Delete message
    socket.on('message:delete', async ({ messageId }) => {
      try {
        const message = await Message.findOne({ _id: messageId, sender: userId });
        if (!message) return;

        message.isDeleted = true;
        message.content = '';
        await message.save();

        io.to(message.room.toString()).emit('message:deleted', { _id: messageId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // React to message
    socket.on('message:react', async ({ messageId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const reactionIdx = message.reactions.findIndex((r) => r.emoji === emoji);
        if (reactionIdx >= 0) {
          const userIdx = message.reactions[reactionIdx].users.findIndex((u) => u.toString() === userId);
          if (userIdx >= 0) {
            message.reactions[reactionIdx].users.splice(userIdx, 1);
            if (message.reactions[reactionIdx].users.length === 0) {
              message.reactions.splice(reactionIdx, 1);
            }
          } else {
            message.reactions[reactionIdx].users.push(userId);
          }
        } else {
          message.reactions.push({ emoji, users: [userId] });
        }

        await message.save();
        const populated = await populateMessage(Message.findById(message._id));
        io.to(message.room.toString()).emit('message:reacted', populated);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('room:join', (roomId) => socket.join(roomId));

    // Mark messages as read
    socket.on('messages:read', async ({ roomId }) => {
      try {
        await Message.updateMany(
          { room: roomId, sender: { $ne: userId }, readBy: { $not: { $elemMatch: { $eq: userId } } } },
          { $addToSet: { readBy: userId } }
        );
        io.to(roomId).emit('messages:read_update', { roomId, userId });
      } catch (err) {
        console.error('messages:read error:', err);
      }
    });

    socket.on('typing:start', ({ roomId }) => {
      socket.to(roomId).emit('typing:start', { userId, username: socket.user.username });
    });

    socket.on('typing:stop', ({ roomId }) => {
      socket.to(roomId).emit('typing:stop', { userId });
    });

    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      io.emit('user:online', { userId, isOnline: false });
    });
  });
};

module.exports = { initSocket };
