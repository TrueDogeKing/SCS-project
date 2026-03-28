import { getServerPublicKey } from "./keys.js";

export interface RegisterResponse {
  success: boolean;
  message?: string;
  error?: string;
  entityId?: string;
  certificate?: {
    pem: string;
    fingerprint: string;
    validFrom: string;
    validUntil: string;
  };
}

/**
 * Register the server with the TTP and obtain a certificate.
 */
export async function registerServerWithTTP(
  ttpUrl: string,
  serverId: string,
  serverName: string
): Promise<RegisterResponse> {
  const publicKey = getServerPublicKey();
  const res = await fetch(`${ttpUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: serverId,
      type: "SERVER",
      name: serverName,
      publicKey,
    }),
  });
  return res.json() as Promise<RegisterResponse>;
}
