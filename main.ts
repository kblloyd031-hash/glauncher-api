// 🚀 Google Launcher - Hardened Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- ⚙️ CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; 
const LATEST_APP_VERSION = "1.0.0";
const MIN_APP_VERSION = "1.0.0";

// --- 🏆 INDIVIDUAL ACCESS LISTS (Email Based) ---
const ULTRA_PREMIUM_EMAILS = [
  "kblloyd031@gmail.com",
  "admin@googlelauncher.com"
]; 

const NORMAL_PREMIUM_EMAILS = [
  "tester@test.com"
];

// Hierarchy logic: Ultra gets everything. Premium gets no downloads.
const GLOBAL_PREMIUM_OVERRIDE = false;           

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/ping") return Response.json({ status: "online" });

  if (path === "/user-status") {
    const uid = url.searchParams.get("uid") || "guest";
    const deviceId = url.searchParams.get("device") || "unknown";
    const email = (url.searchParams.get("email") || "").toLowerCase().trim();

    const userKey = ["users", uid];
    const userEntry = await kv.get(userKey);
    let user = userEntry.value;

    if (!user) {
      user = { uid, email, isPremium: false, isUltra: false, devices: [deviceId], lastSeen: new Date().toISOString() };
      if (uid !== "guest") await kv.set(userKey, user);
    } else {
      user.lastSeen = new Date().toISOString();
      if (email && email !== "") user.email = email;
      await kv.set(userKey, user);
    }

    // 🏆 DECISION HIERARCHY
    const isUltra = ULTRA_PREMIUM_EMAILS.includes(user.email) || user.isUltra;
    const isPremium = isUltra || NORMAL_PREMIUM_EMAILS.includes(user.email) || user.isPremium || GLOBAL_PREMIUM_OVERRIDE;
    
    // Downloads only for Ultra
    const canDownload = isUltra;

    return Response.json({
      isPremium: isPremium,
      canDownload: canDownload,
      isBlocked: user.isBanned || false,
      isAppLocked: !isPremium,
      blockReason: user.isBanned ? "Account Revoked" : null
    });
  }

  if (path === "/app-config") {
    return Response.json({
      maintenance: { active: false, message: "" },
      version: { latest: LATEST_APP_VERSION, min: MIN_APP_VERSION, url: "", force: false },
      features: { showAds: true, enableAI: true, enable4K: true }
    });
  }

  // Admin Toggle Helper: /admin?email=user@mail.com&action=ultra&pw=admin
  if (path === "/admin") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const targetEmail = url.searchParams.get("email")?.toLowerCase();
    const action = url.searchParams.get("action");
    
    // Note: To use this admin endpoint easily, you'd need a secondary index on emails.
    // For now, these changes are best managed via the static arrays at the top of the script.
    return new Response(`Admin command received for ${targetEmail}`);
  }

  return new Response("Unauthorized", { status: 401 });
});
