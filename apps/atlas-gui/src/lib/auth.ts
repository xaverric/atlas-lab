import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = process.env.NEXT_PUBLIC_OIDC_AUTHORITY || 'http://localhost:8080/realms/atlas';
const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'atlas-gui';
const redirectUri = typeof window !== 'undefined'
  ? `${window.location.origin}/callback`
  : 'http://localhost:3000/callback';

let userManager: UserManager | null = null;

export const getUserManager = () => {
  if (!userManager && typeof window !== 'undefined') {
    userManager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    });
  }
  return userManager!;
};
