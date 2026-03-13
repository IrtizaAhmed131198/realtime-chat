const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const router = express.Router();

const populateRoom = (query) =>
  query.populate('members', '-password').populate('lastMessage');

// GET / — all rooms for current user
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await populateRoom(
      Room.find({ members: req.user._id }).sort({ updatedAt: -1 })
    );
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /private
router.post('/private', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    let room = await populateRoom(
      Room.findOne({ type: 'private', members: { $all: [req.user._id, userId], $size: 2 } })
    );

    if (!room) {
      room = await Room.create({ type: 'private', members: [req.user._id, userId] });
      room = await room.populate('members', '-password');
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /group
router.post('/group', auth, async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name || !members?.length)
      return res.status(400).json({ message: 'Name and members required' });

    const allMembers = [...new Set([req.user._id.toString(), ...members])];
    const room = await Room.create({ name, type: 'group', members: allMembers, admin: req.user._id });
    const populated = await room.populate('members', '-password');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /:roomId
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await populateRoom(
      Room.findOne({ _id: req.params.roomId, members: req.user._id })
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /:roomId — rename group (admin only)
router.patch('/:roomId', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required' });

    const room = await Room.findOne({ _id: req.params.roomId, type: 'group', admin: req.user._id });
    if (!room) return res.status(403).json({ message: 'Not authorized' });

    room.name = name.trim();
    await room.save();

    const updated = await populateRoom(Room.findById(room._id));
    req.app.get('io').to(req.params.roomId).emit('room:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /:roomId/members — add members (admin only)
router.post('/:roomId/members', auth, async (req, res) => {
  try {
    const { members } = req.body;
    if (!members?.length) return res.status(400).json({ message: 'Members required' });

    const room = await Room.findOne({ _id: req.params.roomId, type: 'group', admin: req.user._id });
    if (!room) return res.status(403).json({ message: 'Not authorized' });

    const newMembers = members.filter((id) => !room.members.map(String).includes(id));
    if (!newMembers.length) return res.status(400).json({ message: 'All users are already members' });

    room.members.push(...newMembers);
    await room.save();

    const updated = await populateRoom(Room.findById(room._id));
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('room:updated', updated);

    // Have new members join the socket room
    newMembers.forEach((userId) => {
      io.to(`user:${userId}`).emit('room:joined', updated);
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:roomId/members/:userId — remove member (admin only)
router.delete('/:roomId/members/:userId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, type: 'group', admin: req.user._id });
    if (!room) return res.status(403).json({ message: 'Not authorized' });
    if (req.params.userId === req.user._id.toString())
      return res.status(400).json({ message: 'Admin cannot remove themselves. Leave the group instead.' });

    room.members = room.members.filter((m) => m.toString() !== req.params.userId);
    await room.save();

    const updated = await populateRoom(Room.findById(room._id));
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('room:updated', updated);
    io.to(req.params.roomId).emit('room:member_removed', {
      roomId: req.params.roomId,
      userId: req.params.userId,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:roomId/leave — leave group
router.delete('/:roomId/leave', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, type: 'group', members: req.user._id });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // If admin is leaving, assign new admin or delete if no members left
    room.members = room.members.filter((m) => m.toString() !== req.user._id.toString());

    if (room.members.length === 0) {
      await Room.findByIdAndDelete(room._id);
      return res.json({ deleted: true, roomId: req.params.roomId });
    }

    if (room.admin?.toString() === req.user._id.toString()) {
      room.admin = room.members[0];
    }

    await room.save();
    const updated = await populateRoom(Room.findById(room._id));
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('room:updated', updated);
    io.to(req.params.roomId).emit('room:member_removed', {
      roomId: req.params.roomId,
      userId: req.user._id.toString(),
    });
    res.json({ left: true, roomId: req.params.roomId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
