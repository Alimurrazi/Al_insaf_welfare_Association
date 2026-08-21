"use client";

import { useEffect, useRef, useState } from "react";
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

function linkClass(active: boolean) {
  return active ? `${baseLinkClasses} ${activeLinkClasses}` : baseLinkClasses;
}

const MANAGE_PATHS = ["/members", "/deposits", "/topups"];

// The three admin-only screens are grouped behind one "Manage" menu instead
// of three top-level links — eight links across the header (five shared +
// three admin) was wrapping into a messy two-line header on phones; six
// (five shared + this one) fits far more often.
function ManageMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = MANAGE_PATHS.includes(pathname);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={linkClass(isActive)}
      >
        Manage ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 flex min-w-40 flex-col gap-1 rounded-md border border-line bg-surface p-2 shadow-md"
        >
          <Link
            href="/members"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={linkClass(pathname === "/members")}
          >
            Members
          </Link>
          <Link
            href="/deposits"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={linkClass(pathname === "/deposits")}
          >
            Deposits
          </Link>
          <Link
            href="/topups"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={linkClass(pathname === "/topups")}
          >
            Top-ups
          </Link>
        </div>
      )}
    </div>
  );
}

// Split out as its own client component (rather than making the whole
// TopNav a client component) so only this piece needs usePathname() for
// active-page highlighting — the session lookup in TopNav stays server-side.
export function TopNavLinks({ userId, role }: TopNavLinksProps) {
  const pathname = usePathname();
  const ownLedgerHref = `/ledger/${userId}`;

  const isOwnLedger = pathname === ownLedgerHref;
  const isLedgerGrid = pathname === "/ledger" || (pathname.startsWith("/ledger/") && !isOwnLedger);

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
      {role === "ADMIN" && <ManageMenu pathname={pathname} />}
    </nav>
  );
}
