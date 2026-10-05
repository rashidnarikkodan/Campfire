# 🔥 Internet Campfire

> A cozy, real-time spatial voice and text chat application centered around an interactive virtual campfire.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socketdotio)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Audio_Mesh-333333?style=flat-square&logo=webrtc)](https://webrtc.org/)

---

## 🌟 Overview

**Internet Campfire** brings people together around a digital hearth. Whether hanging out with friends, holding relaxed team huddles, or hosting late-night conversations, Internet Campfire pairs real-time peer-to-peer voice and text chat with an interactive, atmospheric soundscape and dynamic visual campfire.

---

## ✨ Features

- 🔥 **Dynamic Canvas Campfire**: Visual campfire animated on HTML5 Canvas that flickers, crackles, and dynamically glows based on voice activity and active conversation intensity.
- 🔊 **WebRTC Voice Chat**: Low-latency peer-to-peer voice mesh connected via real-time WebRTC signaling.
- 🌌 **Atmospheric Soundscapes**: Synthesized ambient campfire audio, starry night sky background animations, and custom soundscape controls powered by the Web Audio API.
- 💬 **Synchronized Real-time Chat**: Live text messaging integrated with room presence, user badges, and active speaker highlights.
- 🎛️ **Audio & Device Settings Modal**: Custom microphone gain controls, input device selectors, noise suppression toggles, and audio output management.
- 🛡️ **Room & Moderation Management**: Easy room creation, instant invite links, occupancy limits, user reporting, and room controls.
- 📱 **Progressive Web App (PWA)**: Installable on desktop and mobile devices with web app manifest and offline service worker support.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Real-time Client**: `socket.io-client` & WebRTC APIs
- **Graphics & Audio**: HTML5 Canvas 2D & Web Audio API

### **Backend**
- **Server**: Node.js & Express (`server.ts`)
- **WebSockets**: [Socket.IO](https://socket.io/) (Handling room management, messaging, signaling & moderation)
- **Transpiler / Runner**: `tsx`

---

## 🚀 Getting Started

### **Prerequisites**
- **Node.js**: v18.0.0 or higher
- **npm** (or `yarn` / `pnpm` / `bun`)

### **Installation**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rashidnarikkodan/internet-campfire.git
   cd internet-campfire
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or copy `.env.example` if available):
   ```env
   PORT=3000
   NODE_ENV=development
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open in Browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to start your campfire room!

---

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the custom Express + Socket.IO server with Next.js in hot-reloading development mode via `tsx`. |
| `npm run build` | Compiles the Next.js application for production. |
| `npm run start` | Runs the server in production mode (`NODE_ENV=production tsx server.ts`). |
| `npm run lint` | Runs ESLint to check for code style issues. |
| `npm run typecheck` | Performs TypeScript type checking without emitting files. |

---

## 📁 Project Architecture

```
internet-campfire/
├── public/                 # PWA icons, manifest.json & service worker
├── server.ts               # Custom Express server integrating Socket.IO & Next.js
├── src/
│   ├── app/                # Next.js App Router pages (Home, Room)
│   ├── components/         # Campfire canvas, VoiceBar, PeerList, ChatPanel, AudioSettings, StarryNight
│   ├── hooks/              # Custom hooks (useVoice, useSocket, useRoom, useChat, useFireIntensity)
│   ├── lib/                # Ambient audio synthesizer engine
│   ├── server/             # Socket.IO handlers (room, chat, signal, moderation)
│   └── store/              # Zustand state stores (roomStore, userStore, voiceStore)
├── package.json
└── README.md
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
