'use client';

import { ArrowDownLeft, ArrowUpRight, FileText, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: ArrowDownLeft },
  { href: '/expenses', label: 'Expenses', icon: ArrowUpRight },
  { href: '/invoices', label: 'Invoices', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const range = new URLSearchParams();
  for (const key of ['from', 'to']) {
    const value = params.get(key);
    if (value) range.set(key, value);
  }
  const suffix = range.toString() ? `?${range.toString()}` : '';

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={`${href}${suffix}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
              active && 'bg-muted font-medium text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
