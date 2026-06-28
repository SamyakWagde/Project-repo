/**
 * Robust API Client with automatic JWT handling and token refreshing.
 */

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage item retrieval failed (disabled or blocked by sandbox):", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage item saving failed (disabled or blocked by sandbox):", e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage item removal failed (disabled or blocked by sandbox):", e);
    }
  }
};

const ACCESS_TOKEN_KEY = "burnout_access_token";
const REFRESH_TOKEN_KEY = "burnout_refresh_token";

let currentAccessToken = safeStorage.getItem(ACCESS_TOKEN_KEY) || "";
let currentRefreshToken = safeStorage.getItem(REFRESH_TOKEN_KEY) || "";

/**
 * Perform initial login/handshake to acquire JWT tokens if not present.
 */
export async function initializeAuthToken(): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const response = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Wearer" })
    });

    if (!response.ok) {
      throw new Error(`Auth handshake failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.accessToken && data.refreshToken) {
      currentAccessToken = data.accessToken;
      currentRefreshToken = data.refreshToken;
      safeStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      safeStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      return { accessToken: data.accessToken, refreshToken: data.refreshToken };
    }
    throw new Error("Invalid tokens received from handshake.");
  } catch (error) {
    console.error("Auth Handshake Error:", error);
    throw error;
  }
}

/**
 * Refresh the Access Token using the current Refresh Token.
 */
async function refreshAccessToken(): Promise<string> {
  const rToken = currentRefreshToken || safeStorage.getItem(REFRESH_TOKEN_KEY);
  if (!rToken) {
    // If no refresh token exists, we must re-init auth
    const authData = await initializeAuthToken();
    return authData.accessToken;
  }

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rToken })
    });

    if (!response.ok) {
      // Refresh failed (e.g. refresh token expired or invalid), perform initial handshake again
      console.warn("Refresh token expired or invalid. Re-initializing session...");
      const authData = await initializeAuthToken();
      return authData.accessToken;
    }

    const data = await response.json();
    if (data.accessToken) {
      currentAccessToken = data.accessToken;
      safeStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      if (data.refreshToken) {
        currentRefreshToken = data.refreshToken;
        safeStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      }
      return data.accessToken;
    }
    throw new Error("No access token returned in refresh response.");
  } catch (error) {
    console.error("Token refreshing failed:", error);
    // Fallback to fresh handshake
    const authData = await initializeAuthToken();
    return authData.accessToken;
  }
}

/**
 * Fetch wrapper that attaches JWT headers and automatically refreshes on 401.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Ensure we have an access token, or trigger quick handshake
  let token = currentAccessToken || safeStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    const authData = await initializeAuthToken();
    token = authData.accessToken;
  }

  // Set up request headers with bearer token
  const headers = new Headers(options.headers || {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers
  };

  let response = await fetch(url, fetchOptions);

  // If unauthorized (access token expired or invalid), attempt silent refresh
  if (response.status === 401) {
    console.log("Access token expired or unauthorized (401). Attempting automatic refresh...");
    try {
      const newToken = await refreshAccessToken();
      
      // Update headers with new token and retry the request
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      
      response = await fetch(url, {
        ...options,
        headers: retryHeaders
      });
    } catch (refreshErr) {
      console.error("Automatic refresh recovery failed:", refreshErr);
    }
  }

  return response;
}

/**
 * Check if the user is authenticated.
 */
export function getStoredTokens() {
  return {
    accessToken: currentAccessToken || safeStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: currentRefreshToken || safeStorage.getItem(REFRESH_TOKEN_KEY)
  };
}

/**
 * Clear security sessions (e.g. logout or testing refresh token expiration)
 */
export function clearAuthSession() {
  currentAccessToken = "";
  currentRefreshToken = "";
  safeStorage.removeItem(ACCESS_TOKEN_KEY);
  safeStorage.removeItem(REFRESH_TOKEN_KEY);
}
