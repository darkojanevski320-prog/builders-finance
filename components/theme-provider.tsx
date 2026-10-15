'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/** Adds or removes the `dark` class on <html> and remembers the choice in localStorage. */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange {...props} />;
}
