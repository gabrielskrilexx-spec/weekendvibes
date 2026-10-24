import type { User } from "../../drizzle/schema";

type AdminCandidate = Pick<User, "role" | "email"> | null | undefined;

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Server-only authorization policy for the administrative surface. */
export function isAdminUser(user: AdminCandidate): user is User {
  if (!user) return false;
  if (user.role === "admin") return true;
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && configuredAdminEmails().has(email));
}

export function isConfiguredAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && configuredAdminEmails().has(normalized));
}
