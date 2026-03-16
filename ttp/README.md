# SCS TTP - Trusted Third Party Service

The Trusted Third Party (TTP) component of the Secure Communication System. Issues X.509-like certificates, distributes session keys, and manages the entity registry. Built with Node.js/Bun and Express-like HTTP routing.

## Features

- **Certificate Generation**: Creates X.509-like certificates with fingerprints and validity dates
- **Entity Registry**: Maintains database of registered clients and servers with public keys
- **Key Distribution**: Generates and distributes AES-256 session keys encrypted for each party
- **Authentication Coordination**: Verifies certificates and authenticates clients on behalf of servers
- **Structured Logging**: Comprehensive event logging for all TTP operations
- **Certificate Validation**: Validates certificate expiration and validity

## Getting Started

### Prerequisites
- Bun or Node.js 20+
- npm or yarn

### Installation

```bash
cd ttp
bun install
```

### Development Server

```bash
bun dev
```

TTP runs on `http://localhost:3002` by default.

### Build for Production

```bash
npm run build
bun dev
```

## Project Structure

```
src/
├── index.ts                # TTP server entry point
├── crypto/
│   ├── rsa.ts             # RSA-4096 encryption/decryption with OAEP-SHA256
│   ├── certificate.ts     # X.509-like certificate generation
│   ├── hash.ts            # SHA-256 hashing and fingerprinting
│   ├── random.ts          # Cryptographically secure random generation
│   ├── index.ts           # Crypto interface
│   └── types.ts           # Type definitions
├── registry/
│   └── index.ts           # Entity registry management
├── routes/
│   ├── index.ts           # Route handlers (/register, /authenticate, /session-key)
│   └── types.ts           # Request/response type definitions
├── logs/
│   ├── index.ts           # Logging utilities
│   └── types.ts           # Log event type definitions
└── tests/
    └── api.test.ts        # API integration tests
```

## Cryptography

### Certificate Generation
- **Format**: X.509-like structure (not standard X.509)
- **Public Key**: Extracted from entity's RSA public key
- **Fingerprint**: SHA-256 hash of certificate (first 16 chars displayed)
- **Validity**: Default 365 days from issuance
- **Signature**: Self-signed by TTP (PEM format)

### RSA-4096-OAEP-SHA256
- Key encryption for session keys
- Padding: OAEP with SHA-256 hash
- Separate encrypted keys for client and server
- Client decrypts with private key in browser
- Server decrypts with private key in Node.js

### AES-256
- Session key generation: 32 random bytes
- Base64 encoding for transmission
- Same key shared between client and server

### Other
- **SHA-256**: Certificate fingerprinting and hashing
- **Random**: Cryptographically secure random generation

## API Endpoints

### Registration Endpoint

**POST `/register`**
Register a client or server with the TTP and receive a certificate

Request:
```json
{
  "id": "client_123",
  "type": "CLIENT",
  "name": "My Client App",
  "publicKey": "-----BEGIN PUBLIC KEY-----..."
}
```

Response:
```json
{
  "success": true,
  "entityId": "client_123",
  "certificate": {
    "pem": "-----BEGIN CERTIFICATE-----...",
    "fingerprint": "38cd23b0352ac9ce...",
    "validFrom": "2026-03-12T17:37:59.000Z",
    "validUntil": "2027-03-12T17:37:59.000Z"
  }
}
```

### Authentication Endpoint

**POST `/authenticate`**
Authenticate a client and verify both client and server certificates

Request:
```json
{
  "clientId": "client_001",
  "serverId": "server_001",
  "clientCertificate": "-----BEGIN CERTIFICATE-----..."
}
```

Response:
```json
{
  "success": true,
  "message": "Authentication successful",
  "clientId": "client_001",
  "serverId": "server_001",
  "status": "VERIFIED"
}
```

### Session Key Endpoint

**POST `/session-key`**
Generate AES-256 session key and encrypt for both parties

Request:
```json
{
  "clientId": "client_001",
  "serverId": "server_001"
}
```

Response:
```json
{
  "success": true,
  "message": "Session key generation successful",
  "clientId": "client_001",
  "serverId": "server_001",
  "clientSessionKey": "base64-encrypted-aes-key",
  "serverSessionKey": "base64-encrypted-aes-key"
}
```

##  Key Distribution Flow

```
Client → TTP: Register (send public key)
     TTP: Generate certificate
TTP → Client: Return certificate

Server → TTP: Register (send public key)
     TTP: Generate certificate
TTP → Server: Return certificate

Client → Server: Request authentication
Server → TTP: Contact TTP:/authenticate
     TTP: Verify client certificate
     TTP: Verify server certificate
TTP → Server: Authentication successful

Server → TTP: Contact TTP:/session-key
     TTP: Generate AES-256 key
     TTP: Encrypt with client's RSA public key → clientSessionKey
     TTP: Encrypt with server's RSA public key → serverSessionKey
TTP → Server: Return both encrypted keys

Server: Decrypt serverSessionKey with private key
Server: Store AES key for this client session
Server → Client: Return clientSessionKey (encrypted with client's public key)

Client: Decrypt clientSessionKey with private key
Client: Store AES key for this server session

✓ Both now share same AES-256 key, can communicate securely
```

##  Development

### Scripts

```bash
# Start development server
bun dev

# Run API tests
bun test:api

# Build TypeScript
bun run build

```

### Testing

Run API integration tests:
```bash
bun test:api
```

Tests verify:
- Entity registration
- Certificate generation
- Certificate validation
- Authentication flow
- Session key generation

##  Configuration

### Environment Variables (Optional)

```bash
# TTP configuration
TTP_PORT=3002
TTP_HOST=localhost
```

### Default Configuration
- Port: `3002`
- Host: `localhost`
- Certificate Validity: 365 days

##  Security Considerations

### Certificate Storage
- In-memory registry (not persistent)
- In production, use database with encryption
- Certificates signed with TTP's private key

### Private Key Management
- TTP's private key never shared
- Used only to sign certificates
- In production: store in HSM or vault

### Session Keys
- Randomly generated with cryptographic RNG
- Encrypted before transmission
- Never stored in plaintext
- Unique per client-server session

### Entity Verification
- Public keys validated during registration
- Certificates checked for expiration
- Fingerprints used to verify identity

##  Data Structures

### Certificate
```typescript
interface Certificate {
  pem: string;              // PEM-formatted certificate
  fingerprint: string;      // SHA-256 hash (hex)
  validFrom: string;        // ISO timestamp
  validUntil: string;       // ISO timestamp
}
```

### Registered Entity
```typescript
interface RegisteredEntity {
  id: string;
  type: "CLIENT" | "SERVER";
  name: string;
  publicKey: string;        // PEM format
  certificate: Certificate;
  registeredAt: string;     // ISO timestamp
}
```

### Registry
```typescript
interface RegistryData {
  clients: Map<string, RegisteredEntity>;
  servers: Map<string, RegisteredEntity>;
}
```

##  Debugging

### Logging

All operations logged with timestamps and structured data:
```
ℹ [17:34:44] REQUEST_RECEIVED: Registration request from CLIENT
✓ [17:34:44] CLIENT_REGISTERED: Client registered successfully
ℹ [17:34:44] AUTH_ATTEMPT: Authentication attempt for client_001
✓ [17:34:44] AUTH_SUCCESS: Authentication successful for client_001
ℹ [17:34:44] SESSION_KEY_GENERATED: Session key encrypted for both parties
```

### Debug Output

Look for in logs:
- `REQUEST_RECEIVED` - Endpoint request received
- `CLIENT_REGISTERED` / `SERVER_REGISTERED` - Registration success
- `AUTH_ATTEMPT` - Authentication started
- `AUTH_SUCCESS` / `AUTH_FAILED` - Authentication result
- `SESSION_KEY_GENERATED` - Session key created
- `ERROR` - Any cryptographic failures

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

### High Availability (Note)
Current implementation uses in-memory registry. For HA:
- Store registry in database (PostgreSQL, MongoDB, etc.)
- Use Redis for distributed certificate caching
- Implement TTP replication across multiple nodes
- Use HSM for private key storage

### Docker (Example)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

##  Related Components

- **Server** (`../server/`) - Application backend
- **Client** (`../client/`) - React browser client
- **Root** (`../`) - Project overview and general setup

##  Key Algorithms

### Certificate Generation
```
1. Extract public key from input
2. Generate random serial number
3. Create certificate structure
4. Compute SHA-256 fingerprint
5. Sign certificate (self-signed)
6. Return in PEM format
```

### Session Key Distribution
```
1. Generate 32 random bytes (AES-256 key)
2. Encrypt with client's RSA public key (OAEP-SHA256)
3. Encrypt with server's RSA public key (OAEP-SHA256)
4. Return both encrypted keys in response
5. Each party decrypts with their private key
```

---

**Last Updated:** March 2026
