# SCS Client - Secure Communication System React Frontend

React + TypeScript + Vite-based web client for the Secure Communication System. Handles RSA key generation, TTP registration, authentication, and end-to-end encrypted messaging using Web Crypto API.

## Features

- **RSA-4096 Key Generation**: Browser-based key pair generation using Web Crypto API
- **TTP Registration**: Register client with Trusted Third Party and receive X.509 certificates
- **Secure Authentication**: Multi-step authentication flow with certificate validation
- **AES-256-GCM Encryption**: End-to-end message encryption with authenticated encryption
- **Real-time Messaging**: Send and receive encrypted messages
- **Live Logging**: Event log showing all cryptographic operations
- **Configuration Panel**: Set custom server and TTP URLs

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- npm or yarn

### Installation

```bash
cd client
bun install
```

### Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output goes to `dist/` directory.

## Project Structure

```
src/
├── components/
│   ├── ConfigPanel.tsx      # Server/TTP URL configuration
│   ├── StatusBar.tsx        # Connection status display
│   ├── LogPanel.tsx         # Event log viewer
│   └── MessagingPanel.tsx   # Message sending/receiving UI
├── crypto/
│   ├── rsa.ts              # RSA-4096 key generation & encryption/decryption
│   ├── aes.ts              # AES-256-GCM message encryption/decryption  
│   └── index.ts            # Crypto interface
├── hooks/
│   └── useClient.ts        # Main client logic & state management
├── api/
│   └── index.ts            # HTTP requests to Server and TTP
├── App.tsx                 # Main React component
├── index.css               # Global styles
└── main.tsx                # React entry point
```

## Cryptography

### Web Crypto API
- **RSA-OAEP-SHA256**: Asymmetric encryption for session key decryption
- **AES-256-GCM**: Symmetric encryption for messages
- Key derivation and hashing done server-side

### Key Points
- Private key never leaves the browser
- RSA keys use OAEP padding with SHA-256 hash (must match server/TTP)
- Each message gets random IV and authentication tag
- All crypto operations async to avoid blocking UI

## API Communication

### TTP Endpoints
- `POST /register` - Register client and receive certificate
- `POST /authenticate` - Authenticate with server via TTP
- `POST /session-key` - Request encrypted session key

### Server Endpoints
- `GET /public-key` - Fetch server's public key
- `POST /verify-client` - Complete authentication flow
- `POST /message/send` - Send encrypted message
- `POST /message/receive` - Fetch encrypted messages

## Authentication Flow

1. **Generate Keys**: Browser creates RSA-4096 key pair (Web Crypto)
2. **Register**: Send public key to TTP, receive certificate
3. **Authenticate**: Request authentication from server via TTP
4. **Key Exchange**: TTP encrypts AES-256 session key with client's RSA public key
5. **Decrypt**: Client decrypts encrypted session key with RSA private key
6. **Ready**: Client and server now share AES-256 session key

##  Development

### Dependencies
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **ESLint**: Code linting

### Scripts

```bash
# Development server with HMR
bun run dev

# Build for production
bun run build

# Preview production build locally
bun run preview

# Run ESLint
bun run lint
```

##  Debugging

### Browser Console
Open DevTools (F12) and check the Console tab for debug logs:
- `[DEBUG]` - Cryptographic operation logs
- `[ERROR]` - Error details

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
