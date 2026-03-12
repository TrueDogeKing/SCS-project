# SCS Project - Secure Communication System

A full-stack encrypted messaging system with end-to-end encryption, certificate-based authentication, and a Trusted Third Party (TTP) for secure key exchange.

## Project Structure

```
SCS-project/
├── server/          # Backend application server (Node.js/Bun)
├── ttp/            # Trusted Third Party service (Node.js/Bun)
├── client/         # React web client (Vite + TypeScript)
├── test-auth.ts    # Authentication flow tests
├── test-messaging.ts # Encrypted messaging tests
└── package.json    # Root package configuration
```

## Architecture Overview

### Three-Component System

1. **TTP (Trusted Third Party)** - Certificate authority and key distribution
   - Issues X.509-based certificates to clients and servers
   - Generates and distributes AES-256 session keys
   - Encrypts session keys with recipient's RSA public key
   - Runs on `http://localhost:3002`

2. **Server** - Application backend
   - Receives client authentication requests
   - Coordinates with TTP for key exchange
   - Stores and delivers encrypted messages
   - Runs on `http://localhost:3001`

3. **Client** - React browser application
   - Generates RSA-4096 key pairs in browser
   - Registers with TTP and authenticates with server
   - Encrypts messages with AES-256-GCM session key
   - Decrypts incoming messages
   - Runs on `http://localhost:5173` (development)

### Cryptography Stack

- **RSA-4096-OAEP-SHA256**: Asymmetric encryption for key exchange
- **AES-256-GCM**: Symmetric encryption for messages
- **SHA-256**: Hashing and certificate fingerprints
- **Randomly-generated IVs and Authentication Tags**: For GCM mode

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- Node.js 20+ (for some utilities)

### Installation

```bash
# Install all dependencies
bun install
```

Bun will automatically install dependencies for all packages in the monorepo.

### Development

Start all three services in separate terminals:

**Terminal 1 - TTP Service:**
```bash
cd ttp
bun dev
# Listening on http://localhost:3002
```

**Terminal 2 - Application Server:**
```bash
cd server
bun dev
# Listening on http://localhost:3001
```

**Terminal 3 - React Client:**
```bash
cd client
bun dev
# Listening on http://localhost:5173
```

## Testing

### Test Authentication Flow
```bash
bun run test-auth.ts
```
Tests TTP registration, client authentication, and certificate validation.

### Test Encrypted Messaging
```bash
bun run test-messaging.ts
```
Tests end-to-end encryption/decryption with AES-256-GCM and message delivery.

Run both tests from the project root in a shell/terminal where all three services are running.

## API Endpoints

### TTP Service (`/ttp`)

- **POST** `/register` - Register client or server
  ```json
  { "id": "client_123", "type": "CLIENT", "name": "My Client", "publicKey": "-----BEGIN PUBLIC KEY-----..." }
  ```

- **POST** `/authenticate` - Authenticate a client
  ```json
  { "clientId": "client_123", "serverId": "server_001", "clientCertificate": "..." }
  ```

- **POST** `/session-key` - Generate and return encrypted session keys
  ```json
  { "clientId": "client_123", "serverId": "server_001" }
  ```

### Server (`/server`)

- **POST** `/verify-client` - Multi-step client authentication
  ```json
  { "clientId": "client_123", "serverId": "server_001", "ttpUrl": "http://localhost:3002", "clientCertificate": "..." }
  ```

- **POST** `/message/send` - Send encrypted message
  ```json
  { "clientId": "client_123", "serverId": "server_001", "encryptedMessage": {...} }
  ```

- **POST** `/message/receive` - Retrieve encrypted messages
  ```json
  { "clientId": "client_123", "serverId": "server_001" }
  ```

- **GET** `/public-key` - Get server's public key for registration

## Security Features

### Key Exchange
1. Client generates RSA-4096 key pair in browser (Web Crypto API)
2. Client sends public key to TTP during registration
3. Client authenticates with server via TTP
4. TTP generates AES-256 session key
5. TTP encrypts session key with both client and server RSA public keys
6. Each party decrypts with their private key
7. Both client and server now share the same AES-256 session key

### Message Encryption
- Messages encrypted with AES-256-GCM using shared session key
- Random 16-byte IV for each message
- Authentication tag ensures integrity
- Client ID, Server ID, and timestamp included in ciphertext

### Certificate Validation
- TTP issues X.509-like certificates with fingerprints
- Certificates include validity dates
- Server validates certificate expiration before authentication

## Build & Deployment

### Server Build
```bash
cd server
bun run build
bun dev
```

### Client Build
```bash
cd client
bun run build
bun dev
# Output in dist/ folder
```

### TTP Build
```bash
cd ttp
bun run build
bun dev
```

## Project Scripts

### Root Level
- `bun install` - Install all dependencies

### Server
- `bun dev` - Start development server
- `bun run build` - Build TypeScript
- `bun test:crypto` - Test crypto utilities
- `bun test:api` - Run API tests

### Client
- `bun dev` - Start Vite development server
- `bun run build` - Build for production
- `bun preview` - Preview production build
- `bun lint` - Run ESLint

### TTP
- `bun dev` - Start development server
- `bun run build` - Build TypeScript

## Authentication Flow

```
Client Browser
     │
     ├─> Generate RSA-4096 key pair
     ├─> Register with TTP (send public key)
     │
     └─> Request authentication from server
         │   ├─> Server contacts TTP
         │   ├─> TTP verifies certificates
         │   ├─> TTP generates AES-256 key
         │   ├─> TTP encrypts key with client's RSA public key
         │   ├─> TTP encrypts key with server's RSA public key
         │   ├─> Server decrypts its copy with RSA private key
         │   └─> Server returns encrypted copy to client
         │
         └─> Client decrypts with RSA private key
             └─> Both now share AES-256 session key ✓
```

## Debugging

### Debug Logs
- Browser: Open DevTools (F12), check Console tab for `[DEBUG]` and `[ERROR]` messages
- Server/TTP: Check terminal output for structured logs with timestamps and event types

### Common Issues

**"bun not found":**
```powershell
# Refresh PowerShell PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**RSA decryption fails in browser:**
- Ensure TTP and Server are using `oaepHash: "sha256"`
- Browser Web Crypto API requires matching OAEP hash parameters
- Restart services after code changes

## Documentation Files

- `test-auth.ts` - Authentication flow implementation
- `test-messaging.ts` - End-to-end messaging example
- `server/src/routes/` - Server API route handlers
- `ttp/src/routes/` - TTP endpoint implementations
- `client/src/hooks/useClient.ts` - Main client logic

## Technologies Used

- **Runtime:** Bun, Node.js
- **Backend:** Express-like HTTP routing
- **Frontend:** React 18, TypeScript, Vite
- **Cryptography:** Node.js crypto, Web Crypto API
- **Styling:** CSS
- **Build:** TypeScript compiler, Vite

## License

Project for academic purposes (6th Semester - Functional Programming)

---

**Last Updated:** March 2026
