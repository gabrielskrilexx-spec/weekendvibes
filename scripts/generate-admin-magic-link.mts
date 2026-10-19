import { getUserByOpenId, issueAdminMagicLink } from "../server/db";
import { ENV } from "../server/_core/env";

const baseUrl = process.env.MAGIC_LINK_BASE_URL ?? "http://localhost:3000";
const requestedOpenId = process.env.ADMIN_MAGIC_LINK_OPEN_ID ?? ENV.ownerOpenId;

if (process.env.NODE_ENV === "production" && !process.env.MAGIC_LINK_BASE_URL) {
  throw new Error("MAGIC_LINK_BASE_URL is required in production");
}
if (!requestedOpenId) throw new Error("OWNER_OPEN_ID is required");

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
  throw new Error("MAGIC_LINK_BASE_URL must use HTTPS in production");
}

const user = await getUserByOpenId(requestedOpenId);
if (!user || user.role !== "admin") throw new Error("configured user is not an admin");

const { token, expiresAt } = await issueAdminMagicLink(user.openId, 5 * 60_000);
const link = new URL("/api/auth/magic-link", parsedBaseUrl);
link.searchParams.set("token", token);
link.searchParams.set("redirect_to", "/admin");

console.log(`Admin magic link (expires ${expiresAt.toISOString()}):`);
console.log(link.toString());
