"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { inputClasses } from "@/components/styles";

interface YearSelectProps {
  year: number;
  yearOptions: number[];
}

// A native <form method="GET"> submit wasn't reliably navigating in testing
// (the URL never updated), so this drives the year filter directly through
// the router instead — also applies immediately on change, no separate
// "View" button needed.
export function YearSelect({ year, yearOptions }: YearSelectProps) {
  const router = useRouter();

  return (
    <div className="relative">
      <select
        value={year}
        onChange={(e) => router.push(`/ledger?year=${e.target.value}`)}
        className={`${inputClasses} appearance-none py-2 pr-9`}
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            Year: {y}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
    </div>
  );
}
