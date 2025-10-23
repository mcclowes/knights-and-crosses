# Next.js Migration Guide

This document describes the migration of Knights and Crosses from a traditional JavaScript application to a modern Next.js application.

## What Changed

### Project Structure

#### New Directories

- `pages/` - Next.js pages (React components)
  - `index.tsx` - Main game page
  - `deck-builder.tsx` - Deck builder tool
  - `ai-viewer.tsx` - AI viewer tool
  - `_app.tsx` - Global app wrapper
  - `_document.tsx` - HTML document structure

- `components/` - React components
  - `Game.tsx` - Main game component with canvas rendering

- `public/` - Static assets (served directly)
  - `assets/` - CSS, images, sounds
  - `json/` - Card data
  - `lib/` - Third-party libraries
  - `game.core.client.js` - Game client code

#### Modified Files

- `server.js` - Custom Next.js server with Socket.io integration
- `src/game.server.js` - Updated to work with Next.js custom server
- `package.json` - Updated scripts for Next.js
- `tsconfig.json` - Updated for Next.js TypeScript support
- `next.config.js` - Next.js configuration

### Key Changes

1. **Server Architecture**
   - Created custom Next.js server (`server.js`) that integrates Socket.io
   - Modified `GameServer` class to accept external server/io instances
   - Socket.io runs on the same port as Next.js (default: 3000)

2. **Client-Side**
   - Converted HTML pages to React components
   - Game client code (`game.core.client.js`) loaded as external script
   - Canvas rendering preserved in React component using refs
   - Socket.io client connects to the same server

3. **Static Assets**
   - Moved from `src/assets/` to `public/assets/`
   - Updated CSS image paths from relative (`../img/`) to absolute (`/assets/img/`)
   - All assets now served from `/public` directory

4. **Scripts**
   - `npm run dev` - Start development server
   - `npm run build` - Build for production
   - `npm start` - Start production server
   - `npm run start:old` - Start old server (deprecated)

## Running the Application

### Development

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

### Production

```bash
npm run build
npm start
```

## Routes

- `/` - Main game
- `/deck-builder` - Deck builder tool
- `/ai-viewer` - AI viewer tool

## Legacy Code

The following legacy JavaScript code remains unchanged:

- `src/game.core.client.js` - Game client logic
- `src/game.core.server.js` - Server-side game logic
- `src/game.core.ai.js` - AI logic
- `src/ai_manager.js` - AI management
- `public/lib/` - Third-party libraries (jQuery, dat.gui, etc.)

These files are loaded as scripts and work alongside the new Next.js architecture.

## Future Improvements

1. **Modernize Game Client**
   - Convert `game.core.client.js` to TypeScript
   - Replace jQuery with React state management
   - Use React hooks for game loop and event handling

2. **Code Quality**
   - Fix ESLint warnings
   - Add proper TypeScript types
   - Enable strict type checking

3. **Performance**
   - Lazy load game assets
   - Optimize bundle size
   - Add service worker for offline support

4. **Features**
   - Add React-based UI components
   - Improve mobile responsiveness
   - Add dark mode support

## Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` error:

```bash
PORT=3001 npm run dev
```

### Socket.io Connection Issues

Make sure the server is running before opening the game in your browser. The Socket.io client will automatically connect to the same host/port as the Next.js server.

### Build Errors

If you encounter build errors, try:

```bash
rm -rf .next node_modules
npm install
npm run build
```
