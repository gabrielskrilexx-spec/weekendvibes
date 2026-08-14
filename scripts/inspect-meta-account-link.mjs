const token = process.env.META_INSTAGRAM_TOKEN;
if (!token) throw new Error("META_INSTAGRAM_TOKEN is missing");
const base = "https://graph.facebook.com/v26.0";
const meResponse = await fetch(`${base}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
const me = await meResponse.json();
const accountsResponse = await fetch(`${base}/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(token)}`);
const accounts = await accountsResponse.json();
console.log(JSON.stringify({
  me: { status: meResponse.status, id: me.id, name: me.name, error: me.error?.message },
  accounts: {
    status: accountsResponse.status,
    data: (accounts.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
    })),
    error: accounts.error?.message,
  },
}, null, 2));
