import type { Config, RegisterResponse, VerifyClientResponse } from "../types/response";

const DEFAULT_SERVER_URL = "http://localhost:3001";
const DEFAULT_TTP_URL = "http://localhost:3002";



export function getConfig(): Config {
  return {
    serverUrl: localStorage.getItem("serverUrl") || DEFAULT_SERVER_URL,
    ttpUrl: localStorage.getItem("ttpUrl") || DEFAULT_TTP_URL,
  };
}

export function saveConfig(config: Config) {
  localStorage.setItem("serverUrl", config.serverUrl);
  localStorage.setItem("ttpUrl", config.ttpUrl);
}

// --- TTP Endpoints ---

export async function registerWithTTP(
  ttpUrl: string,
  id: string,
  type: "CLIENT" | "SERVER",
  name: string,
  publicKey: string
): Promise<RegisterResponse> {
  const res = await fetch(`${ttpUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, type, name, publicKey }),
  });
  return res.json();
}

// --- Server Endpoints ---

export async function verifyClient(
  serverUrl: string,
  clientId: string,
  serverId: string,
  ttpUrl: string,
  clientCertificate?: string
): Promise<VerifyClientResponse> {
  const res = await fetch(`${serverUrl}/verify-client`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, serverId, ttpUrl, clientCertificate }),
  });
  return res.json();
}

export async function getServerPublicKey(serverUrl: string): Promise<string> {
  const res = await fetch(`${serverUrl}/public-key`);
  const data = await res.json();
  return data.publicKey;
}

export async function checkServerHealth(serverUrl: string): Promise<boolean> {
  try {
    const res = await fetch(serverUrl);
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkTTPHealth(ttpUrl: string): Promise<boolean> {
  try {
    const res = await fetch(ttpUrl);
    return res.ok;
  } catch {
    return false;
  }
}
