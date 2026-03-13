# Real-Time Chat App

A full-stack real-time chat application built with React, Node.js, Socket.IO, and MongoDB.

## Features

- User registration and login with JWT authentication
- Real-time messaging with Socket.IO
- Private and group conversations
- Online/offline presence indicators
- Typing indicators
- Message history with pagination

## Tech Stack

**Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT, bcryptjs

**Frontend:** React 18, Vite, Tailwind CSS, Socket.IO Client, Axios, React Router v6

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

## Setup

### 1. Clone and navigate

```bash
cd realtime-chat
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app

Navigate to [http://localhost:5173](http://localhost:5173)

## Environment Variables (backend/.env)

| Variable       | Description                        | Default                              |
|----------------|------------------------------------|--------------------------------------|
| PORT           | Server port                        | 5000                                 |
| MONGODB_URI    | MongoDB connection string          | mongodb://localhost:27017/chatapp    |
| JWT_SECRET     | JWT signing secret                 | (required in production)             |
| CLIENT_URL     | Frontend URL for CORS              | http://localhost:5173                |

## Scripts

| Directory | Command       | Description            |
|-----------|---------------|------------------------|
| backend   | `npm run dev` | Start with nodemon     |
| backend   | `npm start`   | Start production       |
| frontend  | `npm run dev` | Start Vite dev server  |
| frontend  | `npm run build` | Build for production |
