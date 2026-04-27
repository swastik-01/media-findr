/**
 * AWS Cognito Auth Client
 * 
 * Replaces Firebase Auth. Uses AWS Amplify for Google Sign-In via Cognito.
 * All auth state is managed through Cognito User Pools.
 */

import { Amplify } from "aws-amplify";
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
  confirmSignUp,
  type SignInInput,
} from "aws-amplify/auth";

// Configure Amplify with Cognito
const cognitoConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN || "",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: [window.location.origin + "/dashboard"],
          redirectSignOut: [window.location.origin + "/"],
          responseType: "code",
          providers: ["Google"],
        },
      },
    },
  },
};

console.log("[DEBUG] Cognito Config:", {
  userPoolId: cognitoConfig.Auth.Cognito.userPoolId,
  clientId: cognitoConfig.Auth.Cognito.userPoolClientId,
  domain: cognitoConfig.Auth.Cognito.loginWith?.oauth?.domain,
});

Amplify.configure(cognitoConfig);

/**
 * Sign in with Google via Cognito Hosted UI
 */
export async function cognitoSignInWithGoogle() {
  await signInWithRedirect({ provider: "Google" });
}

/**
 * Sign in with email + password
 */
export async function cognitoSignInWithEmail(email: string, password: string) {
  const result = await signIn({ username: email, password });
  return result;
}

/**
 * Sign up with email + password
 */
export async function cognitoSignUp(
  email: string,
  password: string,
  name: string,
) {
  const result = await signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        name,
      },
    },
  });
  return result;
}

/**
 * Confirm sign up with verification code
 */
export async function cognitoConfirmSignUp(email: string, code: string) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

/**
 * Sign out
 */
export async function cognitoSignOut() {
  await signOut();
}

/**
 * Get the current authenticated user. Returns null if not signed in.
 */
export async function cognitoGetCurrentUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the JWT ID token for API calls.
 * This is what we send to the FastAPI backend in the Authorization header.
 */
export async function cognitoGetIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch {
    return null;
  }
}

/**
 * Get user attributes (email, name, sub) from the current session.
 */
export async function cognitoGetUserAttributes() {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) return null;

    // Parse JWT payload
    const payload = idToken.payload;

    // Build display name from available claims
    // Google Sign-In puts the name into given_name/family_name, not always 'name'
    const givenName = (payload.given_name as string) || "";
    const familyName = (payload.family_name as string) || "";
    const cognitoName = (payload.name as string) || "";
    
    let displayName = cognitoName;
    if (!displayName && givenName) {
      displayName = familyName ? `${givenName} ${familyName}` : givenName;
    }

    return {
      sub: payload.sub as string,
      email: (payload.email as string) || "",
      name: displayName,
      given_name: givenName,
      family_name: familyName,
    };
  } catch {
    return null;
  }
}
