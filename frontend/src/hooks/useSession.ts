import { useState } from 'react';

export function useSession(): string {
  const [token] = useState<string>(() => {
    const stored = sessionStorage.getItem('streetart_session');
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem('streetart_session', fresh);
    return fresh;
  });
  return token;
}
