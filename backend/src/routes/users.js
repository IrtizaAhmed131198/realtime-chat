const express = require('express');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    cb(null, `avatar-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

// GET /me
router.get('/me', auth, (req, res) => res.json(req.user));

// PATCH /me — update username / email
router.patch('/me', auth, async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = {};

    if (username?.trim()) {
      if (username.trim().length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters' });
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.user._id } });
      if (taken) return res.status(400).json({ message: 'Username already taken' });
      updates.username = username.trim();
    }

    if (email?.trim()) {
      const taken = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: req.user._id } });
      if (taken) return res.status(400).json({ message: 'Email already in use' });
      updates.email = email.trim().toLowerCase();
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /me/password — change password
router.patch('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'All fields required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /me/avatar — upload avatar image
router.post('/me/avatar', auth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    const updated = await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl }, { new: true }).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /search
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        { $or: [{ username: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] },
      ],
    }).select('-password').limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET / — all users except self
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
