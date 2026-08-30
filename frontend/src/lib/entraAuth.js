import { PublicClientApplication } from '@azure/msal-browser';

const redirectUri = window.location.origin;

const createClient = (clientId, authority) => {
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
export const signInStaffWithMicrosoft = () => signIn(staffClient, 'staff');
