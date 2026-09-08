import api from './api';

const fromBase64url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64url = (value) => {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const creationOptions = (publicKey) => ({
  ...publicKey,
  challenge: fromBase64url(publicKey.challenge),
  user: { ...publicKey.user, id: fromBase64url(publicKey.user.id) },
  excludeCredentials: (publicKey.excludeCredentials || []).map((item) => ({
    ...item, id: fromBase64url(item.id),
  })),
});

const requestOptions = (publicKey) => ({
  ...publicKey,
  challenge: fromBase64url(publicKey.challenge),
  allowCredentials: (publicKey.allowCredentials || []).map((item) => ({
    ...item, id: fromBase64url(item.id),
  })),
});

const serializeCredential = (credential) => ({
  id: credential.id,
  rawId: toBase64url(credential.rawId),
  type: credential.type,
  authenticatorAttachment: credential.authenticatorAttachment,
  clientExtensionResults: credential.getClientExtensionResults(),
  response: credential.response.attestationObject ? {
    attestationObject: toBase64url(credential.response.attestationObject),
    clientDataJSON: toBase64url(credential.response.clientDataJSON),
    transports: credential.response.getTransports?.() || [],
  } : {
    authenticatorData: toBase64url(credential.response.authenticatorData),
    clientDataJSON: toBase64url(credential.response.clientDataJSON),
    signature: toBase64url(credential.response.signature),
    userHandle: credential.response.userHandle ? toBase64url(credential.response.userHandle) : null,
  },
});

export const isMobileDevice = () => (
  navigator.userAgentData?.mobile === true
  || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
);

export const hasPlatformAuthenticator = async () => {
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (_) {
    return false;
  }
};

export const enrollAdminPasskey = async () => {
  const { data } = await api.post('/auth/webauthn/admin/register/options');
  const credential = await navigator.credentials.create({ publicKey: creationOptions(data.publicKey) });
  if (!credential) throw new Error('Fingerprint registration was cancelled');
  return api.post('/auth/webauthn/admin/register/verify', {
    challenge_id: data.challenge_id,
    credential: serializeCredential(credential),
  });
};

export const loginAdminWithPasskey = async () => {
  const { data } = await api.post('/auth/webauthn/admin/login/options');
  const credential = await navigator.credentials.get({ publicKey: requestOptions(data.publicKey) });
  if (!credential) throw new Error('Fingerprint verification was cancelled');
  const result = await api.post('/auth/webauthn/admin/login/verify', {
    challenge_id: data.challenge_id,
    credential: serializeCredential(credential),
  });
  return result.data;
};
