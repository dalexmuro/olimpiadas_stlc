"use client";

export interface OAuthProviderButtonsProps {
  disabled?: boolean;
  onSelectProvider: (provider: "google" | "microsoft") => void;
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.17 7.17 0 0 1-10.67-3.77H1.4v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.39 14.32a7.21 7.21 0 0 1 0-4.64V6.59H1.4a12 12 0 0 0 0 10.82l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.4 6.59l3.99 3.09A7.15 7.15 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 21 21"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function OAuthProviderButtons({
  disabled = false,
  onSelectProvider,
}: OAuthProviderButtonsProps) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelectProvider("google")}
        className="btn btn--secondary w-full justify-center gap-2.5"
      >
        <GoogleIcon />
        <span>Continuar con Google</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelectProvider("microsoft")}
        className="btn btn--secondary w-full justify-center gap-2.5"
      >
        <MicrosoftIcon />
        <span>Continuar con Microsoft</span>
      </button>
    </div>
  );
}
