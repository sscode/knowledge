"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LintButton } from "./lint-button";

const links = [
  { href: "/", label: "Query" },
  { href: "/ingest", label: "Ingest" },
  { href: "/wiki", label: "Wiki" },
  { href: "/manage", label: "Manage" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="topbar flex items-center gap-2 px-4 py-3 sm:px-6">
      <span className="brand-mark mr-3 rounded px-2 py-1 text-sm font-bold">
        KB2
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link rounded px-3 py-1.5 text-sm"
          data-active={isActive(pathname, link.href)}
        >
          {link.label}
        </Link>
      ))}
      <LintButton />
    </nav>
  );
}
