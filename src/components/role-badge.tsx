import type { Role } from "@/generated/prisma/enums";

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-3 py-1 font-mono text-xs tracking-wide " +
        (role === "ADMIN" ? "bg-gold-soft text-gold" : "bg-accent-soft text-accent")
      }
    >
      {role}
    </span>
  );
}
