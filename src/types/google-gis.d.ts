// Minimal ambient type declarations for the Google Identity Services (GIS) library
// Loaded dynamically from https://accounts.google.com/gsi/client

interface GoogleOAuth2CodeClient {
  requestCode(): void;
}

interface GoogleOAuth2CodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode?: "popup" | "redirect";
  hint?: string;
  code_challenge_method?: "S256" | "plain";
  code_challenge?: string;
  redirect_uri?: string;
  callback: (response: { code?: string; error?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initCodeClient(config: GoogleOAuth2CodeClientConfig): GoogleOAuth2CodeClient;
}

interface GoogleAccounts {
  oauth2: GoogleAccountsOAuth2;
}

interface Window {
  google?: {
    accounts?: GoogleAccounts;
  };
}
