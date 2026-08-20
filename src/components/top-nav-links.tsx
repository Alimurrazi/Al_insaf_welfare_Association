"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";

interface TopNavLinksProps {
  userId: string;
  role: Role;
}

const baseLinkClasses =
  "rounded-md px-3 py-2 text-base text-ink transition-colors hover:bg-accent-soft hover:text-accent";
const activeLinkClasses = "bg-accent-soft font-semibold text-accent";

// Split out as its own client component (rather than making the whole
// TopNav a client component) so only this piece needs usePathname() for
// active-page highlighting — the session lookup in TopNav stays server-side.
export function TopNavLinks({ userId, role }: TopNavLinksProps) {
  const pathname = usePathname();
  const ownLedgerHref = `/ledger/${userId}`;

  const isOwnLedger = pathname === ownLedgerHref;
  const isLedgerGrid = pathname === "/ledger" || (pathname.startsWith("/ledger/") && !isOwnLedger);

  const linkClass = (active: boolean) =>
    active ? `${baseLinkClasses} ${activeLinkClasses}` : baseLinkClasses;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-base">
      <Link
        href="/"
        className={`rounded-md px-3 py-2 font-display font-semibold text-ink transition-colors hover:bg-accent-soft hover:text-accent ${
          pathname === "/" ? activeLinkClasses : ""
        }`}
      >
        Al-Insaf
      </Link>
      <Link href={ownLedgerHref} className={linkClass(isOwnLedger)}>
        My Passbook
      </Link>
      <Link href="/ledger" className={linkClass(isLedgerGrid)}>
        Logbook
      </Link>
      <Link href="/expenses" className={linkClass(pathname === "/expenses")}>
        Expenses
      </Link>
      <Link href="/activity" className={linkClass(pathname === "/activity")}>
        Activity feed
      </Link>
      {role === "ADMIN" && (
        <>
          <Link href="/members" className={linkClass(pathname === "/members")}>
            Manage members
          </Link>
          <Link href="/deposits" className={linkClass(pathname === "/deposits")}>
            Manage deposits
          </Link>
          <Link href="/topups" className={linkClass(pathname === "/topups")}>
            Manage annual top-ups
          </Link>
        </>
      )}
    </nav>
  );
}
