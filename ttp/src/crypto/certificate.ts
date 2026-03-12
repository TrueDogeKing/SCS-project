/**
 * Certificate generation utilities for TTP
 * Generates self-signed X.509 certificates for clients and servers
 */

import * as forge from "node-forge";
import { generateSHA256ID } from "./hash";
import { Certificate } from "./types";

export function generateCertificate(
  entityId: string,
  entityType: "CLIENT" | "SERVER",
  name: string,
  publicKeyPem: string,
  validityDays: number = 365
): Certificate {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;

  cert.serialNumber = generateSHA256ID(entityId).substring(0, 16);

  const attrs = [
    { name: "commonName", value: name },
    { name: "organizationName", value: "SCS Project TTP" },
    { name: "organizationalUnitName", value: entityType },
    { name: "countryName", value: "PL" },
  ];

  cert.setSubject(attrs);

  cert.setIssuer(attrs);

  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validityDays);

  cert.validity.notBefore = validFrom;
  cert.validity.notAfter = validUntil;

  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: false,
    },
    {
      name: "keyUsage",
      keyCertSign: false,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 2, // DNS
          value: `${name.toLowerCase()}.scs.local`,
        },
      ],
    },
  ]);

  const keys = forge.pki.rsa.generateKeyPair(2048);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certificatePem = forge.pki.certificateToPem(cert);

  const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes();
  const certificateDerBase64 = Buffer.from(certificateDer, "binary").toString("base64");

  // Calculate SHA-256 fingerprint
  const fingerprint = forge.md.sha256.create();
  fingerprint.update(certificateDer);
  const fingerprintHex = fingerprint.digest().toHex();

  return {
    pem: certificatePem,
    der: certificateDerBase64,
    fingerprint: fingerprintHex,
    subject: `CN=${name},O=SCS Project TTP,OU=${entityType},C=PL`,
    issuer: `CN=${name},O=SCS Project TTP,OU=${entityType},C=PL`,
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

export function verifyCertificateValidity(certificate: Certificate): boolean {
  const now = new Date();
  const validFrom = new Date(certificate.validFrom);
  const validUntil = new Date(certificate.validUntil);

  return now >= validFrom && now <= validUntil;
}
