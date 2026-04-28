'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/hosts', label: 'Hosts' },
  { href: '/admin/members', label: 'Users' },
  { href: '/admin/wallet', label: 'Wallet' },
  { href: '/admin/earnings', label: 'Earnings' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-2xl px-4 py-2 text-sm transition ${
              active
                ? 'border border-orange-500/40 bg-orange-500/10 text-white'
                : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}