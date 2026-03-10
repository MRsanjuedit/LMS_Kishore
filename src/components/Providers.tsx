'use client';

import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import theme from '@/lib/theme';

// Emotion cache for SSR hydration compatibility with Next.js App Router
function EmotionCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => {
    const c = createCache({ key: 'mui' });
    c.compat = true;
    const prevInsert = c.insert;
    let inserted: string[] = [];
    c.insert = (...args) => {
      const serialized = args[1];
      if (!cache.inserted[serialized.name]) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    (c as typeof c & { flush: typeof flush }).flush = flush;
    return c as typeof c & { flush: () => string[] };
  });

  useServerInsertedHTML(() => {
    const names = cache.flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      if (cache.inserted[name] && typeof cache.inserted[name] === 'string') {
        styles += cache.inserted[name];
      }
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EmotionCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </EmotionCacheProvider>
  );
}
