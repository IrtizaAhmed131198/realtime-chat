const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Message = require('../models/Message');
const Room = require('../models/Room');
const auth = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const populateMessage = (query) =>
  query
    .populate('sender', '-password')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } });

// GET /search — must be before /:roomId
router.get('/search', auth, async (req, res) => {
  try {
    const { q, roomId } = req.query;
    if (!q?.trim() || q.trim().length < 2) return res.json([]);

    let roomIds;
    if (roomId) {
      const room = await Room.findOne({ _id: roomId, members: req.user._id });
      if (!room) return res.status(403).json({ message: 'Access denied' });
      roomIds = [room._id];
    } else {
      const rooms = await Room.find({ members: req.user._id }).select('_id');
      roomIds = rooms.map((r) => r._id);
    }

    const messages = await Message.find({
      room: { $in: roomIds },
      content: { $regex: q.trim(), $options: 'i' },
      isDeleted: false,
      type: 'text',
    })
      .populate('sender', 'username avatar')
      .populate({ path: 'room', select: 'name type members', populate: { path: 'members', select: 'username avatar _id' } })
      .sort({ createdAt: -1 })
      .limit(40);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /upload — must be before /:roomId
router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  });
});

// GET /:roomId — fetch messages
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, members: req.user._id });
    if (!room) return res.status(403).json({ message: 'Access denied' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await populateMessage(
      Message.find({ room: req.params.roomId }).sort({ createdAt: -1 }).skip(skip).limit(limit)
    );

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /:messageId — edit message
router.patch('/:messageId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content required' });

    const message = await Message.findOne({ _id: req.params.messageId, sender: req.user._id });
    if (!message) return res.status(404).json({ message: 'Message not found or not authorized' });
    if (message.isDeleted) return res.status(400).json({ message: 'Cannot edit deleted message' });

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    const populated = await populateMessage(Message.findById(message._id));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:messageId — soft delete
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findOne({ _id: req.params.messageId, sender: req.user._id });
    if (!message) return res.status(404).json({ message: 'Message not found or not authorized' });

    message.isDeleted = true;
    message.content = '';
    await message.save();

    res.json({ _id: message._id, room: message.room, isDeleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /:messageId/react — toggle emoji reaction
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji required' });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const userId = req.user._id.toString();
    const reactionIdx = message.reactions.findIndex((r) => r.emoji === emoji);

    if (reactionIdx >= 0) {
      const userIdx = message.reactions[reactionIdx].users.findIndex((u) => u.toString() === userId);
      if (userIdx >= 0) {
        message.reactions[reactionIdx].users.splice(userIdx, 1);
        if (message.reactions[reactionIdx].users.length === 0) {
          message.reactions.splice(reactionIdx, 1);
        }
      } else {
        message.reactions[reactionIdx].users.push(req.user._id);
      }
    } else {
      message.reactions.push({ emoji, users: [req.user._id] });
    }

    await message.save();
    const populated = await populateMessage(Message.findById(message._id));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
