/**
 * Entity registry for TTP
 * Stores client and server information
 */

export interface RegisteredEntity {
  id: string; // SHA-256 based ID
  type: "CLIENT" | "SERVER";
  name: string;
  publicKey: string; // PEM format
  registeredAt: string; // ISO timestamp
}

export interface RegistryData {
  clients: Map<string, RegisteredEntity>;
  servers: Map<string, RegisteredEntity>;
}

/**
 * Create empty registry
 */
export function createRegistry(): RegistryData {
  return {
    clients: new Map(),
    servers: new Map(),
  };
}

/**
 * Register an entity (client or server)
 */
export function registerEntity(
  registry: RegistryData,
  entity: RegisteredEntity
): boolean {
  const map = entity.type === "CLIENT" ? registry.clients : registry.servers;

  if (map.has(entity.id)) {
    return false; // Entity already registered
  }

  map.set(entity.id, entity);
  return true;
}

/**
 * Get entity by ID
 */
export function getEntity(registry: RegistryData, id: string): RegisteredEntity | undefined {
  return registry.clients.get(id) || registry.servers.get(id);
}

/**
 * Get entity by type
 */
export function getEntitiesByType(
  registry: RegistryData,
  type: "CLIENT" | "SERVER"
): RegisteredEntity[] {
  const map = type === "CLIENT" ? registry.clients : registry.servers;
  return Array.from(map.values());
}

/**
 * Check if entity exists
 */
export function entityExists(registry: RegistryData, id: string): boolean {
  return registry.clients.has(id) || registry.servers.has(id);
}

/**
 * Update entity public key
 */
export function updateEntityPublicKey(
  registry: RegistryData,
  id: string,
  publicKey: string
): boolean {
  const entity = getEntity(registry, id);
  if (!entity) {
    return false;
  }

  entity.publicKey = publicKey;
  return true;
}
