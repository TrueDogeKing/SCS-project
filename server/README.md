# SCS Server - Application Backend

The backend server component of the Secure Communication System. Handles client authentication, session management, and encrypted message delivery. Built with Node.js/Bun and Express-like HTTP routing.

## Features

- **Client Authentication**: Multi-step authentication flow coordinated with TTP
- **Session Management**: Creates and manages AES-256 session keys with clients
- **Message Storage**: Stores and retrieves encrypted messages for clients
- **RSA Key Management**: Generates and manages server-side RSA keys
- **Certificate Validation**: Validates client and server certificates from TTP
- **Structured Logging**: Comprehensive event logging for debugging and monitoring

## Getting Started

### Prerequisites
- Bun or Node.js 20+
- npm or yarn

### Installation

```bash
cd server
bun install
```

### Development Server

```bash
bun dev
```

Server runs on `http://localhost:3001` by default.

### Build for Production

```bash
npm run build
bun dev
```

## Project Structure

```
src/
├── index.ts                # Server entry point
├── keys.ts                 # RSA key management
├── crypto/
│   ├── rsa.ts             # RSA-4096 encryption/decryption with OAEP-SHA256
│   ├── aes.ts             # AES-256-GCM encryption/decryption
│   ├── hash.ts            # SHA-256 hashing
│   ├── random.ts          # Random number generation
│   ├── index.ts           # Crypto interface
│   ├── test.ts            # Crypto unit tests
│   └── types.ts           # Type definitions
├── auth/
│   └── index.ts           # Authentication utility functions
├── routes/
│   ├── index.ts           # Route handlers (public-key, verify-client, service-request)
│   ├── messages.ts        # Message routing (send, receive, server-to-client)
│   └── types.ts           # Request/response type definitions
├── session/
│   ├── index.ts           # Session creation and management
│   ├── messaging.ts       # Message storage and retrieval
│   └── types.ts           # Session type definitions
├── logs/
│   ├── index.ts           # Logging utilities
│   └── types.ts           # Log event type definitions
└── tests/
    └── api.test.ts        # API integration tests
```

## Cryptography

### RSA-4096-OAEP-SHA256
- Key generation: 4096-bit modulus
- Padding: OAEP with SHA-256 hash (browser compatible)
- Usage: Decrypting session keys from TTP
- Private key stored securely (file-based in dev, env var in prod)

### AES-256-GCM
- 256-bit symmetric key
- 16-byte random IV per message
- 128-bit authentication tag
- Usage: Encrypting/decrypting messages with clients

### Other
- **SHA-256**: Hashing for fingerprints and certificate validation
- **Random**: Cryptographically secure random number generation

## API Endpoints

### Public Endpoints

**GET `/public-key`**
Returns server's RSA public key for client registration
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----..."
}
```

**POST `/verify-client`**
Multi-step client authentication and session establishment
```json
Request:
{
  "clientId": "client_123",
  "serverId": "server_001",
  "clientCertificate": "...",
  "ttpUrl": "http://localhost:3002"
}

Response:
{
  "success": true,
  "verified": true,
  "clientSessionKey": "base64-encrypted-aes-key",
  "sessionKey": "base64-encrypted-aes-key"
}
```

**POST `/service-request`**
Legacy service request endpoint (placeholder implementation)
```json
{
  "clientId": "client_123",
  "serviceType": "MESSAGING",
  "clientCertificate": "..."
}
```

### Message Endpoints

**POST `/message/send`**
Send encrypted message to server
```json
{
  "clientId": "client_001",
  "serverId": "server_001",
  "encryptedMessage": {
    "from": "client_001",
    "to": "server_001",
    "ciphertext": "base64-encrypted-message",
    "iv": "base64-iv",
    "tag": "base64-auth-tag",
    "timestamp": "2026-03-12T17:37:59.000Z"
  }
}
```

**POST `/message/receive`**
Retrieve encrypted messages for client
```json
Request:
{
  "clientId": "client_001",
  "serverId": "server_001"
}

Response:
{
  "success": true,
  "messages": [
    {
      "from": "...",
      "to": "...",
      "ciphertext": "...",
      "iv": "...",
      "tag": "...",
      "timestamp": "..."
    }
  ]
}
```

**POST `/message/send-to-client`**
Server sends message to client (for testing)
```json
{
  "clientId": "client_001",
  "serverId": "server_001",
  "encryptedMessage": {...}
}
```

## 🔄 Authentication Flow

```
Client Request
     │
     └─> /verify-client
         │
         ├─> Verify client certificate locally
         ├─> Contact TTP:/authenticate
         │   └─> TTP verifies both parties
         │
         ├─> Contact TTP:/session-key
         │   ├─> TTP generates AES-256 key
         │   ├─> TTP encrypts with client's RSA public
         │   └─> TTP encrypts with server's RSA public
         │
         ├─> Decrypt server's copy with RSA private key
         ├─> Create session with decrypted AES key
         │
         └─> Return encrypted client key to browser
            (client decrypts with its private key)
```

## 🛠️ Development

### Scripts

```bash
# Start development server
bun dev

# Run crypto tests
bun test:crypto

# Run API tests
bun test:api

# Build TypeScript
bun run build

```

### Testing

Run crypto unit tests:
```bash
bun test:crypto
```

Run API integration tests (requires TTP running):
```bash
bun test:api
```

## 📝 Configuration

### Environment Variables (Optional)

```bash
# Server configuration
SERVER_PORT=3001
SERVER_HOST=localhost

# TTP URL for authentication
TTP_URL=http://localhost:3002

# Key management
SERVER_KEY_PATH=path/to/private/key.pem  # Overwrites default
```

### Default Configuration
- Port: `3001`
- Host: `localhost`
- TTP URL: `http://localhost:3002`
- RSA Key: Generated and stored at startup (in-memory)

## 🔐 Security Considerations

### Session Keys
- Generated per client-server pair
- Encrypted with both parties' RSA public keys
- Decrypted only with private keys
- Never transmitted in plaintext

### Private Keys
- Server's private key never shared
- Client's private key never sent to server
- Only encrypted session keys exchanged

### Message Integrity
- AES-256-GCM provides authenticated encryption
- Any tampering detected during decryption
- Invalid authentication tag rejects message

### Certificate Validation
- TTP creates certificates with fingerprints
- Server validates certificate validity dates
- Expired certificates rejected

## 🐛 Debugging

### Logging

All operations logged with timestamps and structured data:
```
ℹ [17:37:59] REQUEST_RECEIVED: Client verification request initiated
✓ [17:37:59] AUTH_SUCCESS: Authentication successful for client_123
✗ [17:37:59] DECRYPTION_FAILED: Failed to decrypt server session key
```

### Debug Output

Look for in logs:
- `VERIFY_REQUEST` - Client verification started
- `VERIFICATION_STEP` - Each step of auth flow
- `SESSION_ESTABLISHED` - Session created with AES key
- `AUTH_SUCCESS` / `AUTH_FAILED` - Final auth result
- `DECRYPTION_FAILED` - Crypto operation errors

## 📊 Data Structures

### Session
```typescript
interface Session {
  id: string;
  clientId: string;
  serverId: string;
  aesKey: string;           // Base64-encoded AES-256 key
  createdAt: Date;
  expiresAt?: Date;
}
```

### Encrypted Message
```typescript
interface EncryptedMessage {
  from: string;
  to: string;
  ciphertext: string;       // Base64-encoded
  iv: string;               // Base64-encoded
  tag: string;              // Base64-encoded
  timestamp: string;
}
```

## 🚀 Deployment

### Building
```bash
bun run build
```
Outputs compiled JavaScript to `dist/` directory.

### Running Production Server
```bash
bun dev
```

### Docker (Example)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## 📚 Related Components

- **TTP** (`../ttp/`) - Trusted Third Party for certificate issuance and key distribution
- **Client** (`../client/`) - React browser client
- **Root** (`../`) - Project overview and general setup

---

**Last Updated:** March 2026
