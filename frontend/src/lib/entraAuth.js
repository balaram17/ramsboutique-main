import { PublicClientApplication } from '@azure/msal-browser';

const popupRedirectUri = `${window.location.origin}/auth-popup.html`;
const staffRedirectUri = `${window.location.origin}/admin/login`;

const createClient = (clientId, authority, redirectUri = popupRedirectUri) => {
  if (!clientId || !authority) return null;
  return new PublicClientApplication({
    auth: { clientId, authority, redirectUri, postLogoutRedirectUri: redirectUri },
    cache: { cacheLocation: 'sessionStorage' },
  });
};

const customerClient = createClient(
  process.env.REACT_APP_ENTRA_EXTERNAL_CLIENT_ID,
  process.env.REACT_APP_ENTRA_EXTERNAL_AUTHORITY,
);
const staffClient = createClient(
import { PublicClientApplication } from '@azure/msal-browser';

const popupRedirectUri = `${window.location.origin}/auth-popup.html`;
const staffRedirectUri = `${window.location.origin}/admin/login`;

const createClient = (clientId, authority, redirectUri = popupRedirectUri) => {
  if (!clientId || !authority) return null;
  return new PublicClientApplication({
    auth: { clientId, authority, redirectUri, postLogoutRedirectUri: redirectUri },
    cache: { cacheLocation: 'sessionStorage' },
  });
};

const customerClient = createClient(
  process.env.REACT_APP_ENTRA_EXTERNAL_CLIENT_ID,
  process.env.REACT_APP_ENTRA_EXTERNAL_AUTHORITY,
);
const staffClient = createClient(
  process.env.REACT_APP_ENTRA_WORKFORCE_CLIENT_ID,
  process.env.REACT_APP_ENTRA_WORKFORCE_AUTHORITY,
  staffRedirectUri,
);

let customerReady;
let staffReady;

const signIn = async (client, kind) => {
  if (!client) throw new Error(`Microsoft ${kind} sign-in is not configured`);
  if (kind === 'customer') customerReady ||= client.initialize();
  else staffReady ||= client.initialize();
  await (kind === 'customer' ? customerReady : staffReady);
  const result = await client.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
  if (!result.idToken) throw new Error('Microsoft did not return an identity token');
  return result.idToken;
};

export const entraConfigured = {
  customer: Boolean(customerClient),
  staff: Boolean(staffClient),
};

export const signInCustomerWithMicrosoft = () => signIn(customerClient, 'customer');
export const signInStaffWithMicrosoft = async () => {
  if (!staffClient) throw new Error('Microsoft staff sign-in is not configured');
  staffReady ||= staffClient.initialize();
  await staffReady;
  await staffClient.loginRedirect({
    scopes: ['openid', 'profile', 'email'],
    prompt: 'select_account',
    redirectUri: staffRedirectUri,
  });
};

export const completeStaffMicrosoftRedirect = async () => {
  if (!staffClient) return null;
  staffReady ||= staffClient.initialize();
  await staffReady;
  const result = await staffClient.handleRedirectPromise();
  if (result?.account) staffClient.setActiveAccount(result.account);
  return result?.idToken || null;
};

export const signOutStaffWithMicrosoft = async () => {
  if (!staffClient) return false;
  staffReady ||= staffClient.initialize();
  await staffReady;
  const account = staffClient.getActiveAccount() || staffClient.getAllAccounts()[0];
  if (!account) return false;
  await staffClient.logoutRedirect({
    account,
    postLogoutRedirectUri: staffRedirectUri,
  });
  return true;
};  process.env.REACT_APP_ENTRA_WORKFORCE_CLIENT_ID,
  process.env.REACT_APP_ENTRA_WORKFORCE_AUTHORITY,
  staffRedirectUri,
);

let customerReady;
let staffReady;
let staffRedirectResult;

const signIn = async (client, kind) => {
  if (!client) throw new Error(`Microsoft ${kind} sign-in is not configured`);
  if (kind === 'customer') customerReady ||= client.initialize();
  else staffReady ||= client.initialize();
  await (kind === 'customer' ? customerReady : staffReady);
  const result = await client.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
  if (!result.idToken) throw new Error('Microsoft did not return an identity token');
  return result.idToken;
};

export const entraConfigured = {
  customer: Boolean(customerClient),
  staff: Boolean(staffClient),
};

export const signInCustomerWithMicrosoft = () => signIn(customerClient, 'customer');
export const signInStaffWithMicrosoft = async () => {
  if (!staffClient) throw new Error('Microsoft staff sign-in is not configured');
  staffReady ||= staffClient.initialize();
  await staffReady;
  await staffClient.loginRedirect({
    scopes: ['openid', 'profile', 'email'],
    prompt: 'select_account',
    redirectUri: staffRedirectUri,
  });
};

export const completeStaffMicrosoftRedirect = async () => {
  if (!staffClient) return null;
  staffReady ||= staffClient.initialize();
  await staffReady;
  staffRedirectResult ||= staffClient.handleRedirectPromise();
  const result = await staffRedirectResult;
  return result?.idToken || null;
};
