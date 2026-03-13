const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    type: { type: String, enum: ['private', 'group'], default: 'private' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    avatar: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
