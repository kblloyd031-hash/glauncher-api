// 🚀 Google Launcher - Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- ⚙️ CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; 
const LATEST_APP_VERSION = "1.0.0";
const MIN_APP_VERSION = "1.0.0";

// --- 🏆 1. FOREVER ACCESS (Never Expires) ---
const FOREVER_ULTRA = ["kblloyd031@gmail"]; 
const FOREVER_PREMIUM = ["kblloyd031@gmail.com"];

// --- ⏳ 2. TIMED ACCESS (Manage Days Directly Here) ---
// tier: "ultra" (downloads) or "premium" (no downloads)
const HARDCODED_TIMED_USERS = [
  { email: "tester@gmail.com", tier: "ultra", days: 30 },
  { email: "friend@gmail.com", tier: "premium", days: 7 },
  { email: "trial-user@yahoo.com", tier: "ultra", days: 1 },
];

interface UserProfile {
  email: string;
  uid: string;
  isPremium: boolean;
  isUltra: boolean;
  premiumUntil: string | null;
  ultraUntil: string | null;
  isBanned: boolean;
  devices: string[]; 
  firstSeen: string; // Used to calculate hardcoded days
  lastSeen: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/user-status") {
    const email = (url.searchParams.get("email") || "guest").toLowerCase().trim();
    const uid = url.searchParams.get("uid") || "unknown";
    const deviceId = url.searchParams.get("device") || "unknown";

    const userKey = ["users", email];
    const userEntry = await kv.get(userKey);
    let user = userEntry.value as UserProfile;

    // Initialize User if new
    if (!user) {
      user = { 
        email, uid, isPremium: false, isUltra: false, 
        premiumUntil: null, ultraUntil: null, 
        isBanned: false, devices: deviceId !== "unknown" ? [deviceId] : [], 
        firstSeen: new Date().toISOString(), 
        lastSeen: new Date().toISOString() 
      };
      if (email !== "guest") await kv.set(userKey, user);
    } else {
      user.lastSeen = new Date().toISOString();
      if (uid !== "unknown") user.uid = uid;
      if (!user.devices.includes(deviceId) && deviceId !== "unknown") user.devices.push(deviceId);
      await kv.set(userKey, user);
    }

    // 🕰️ CALCULATE EXPIRY
    const now = new Date();
    let isPremium = false;
    let isUltra = false;

    // Check Forever Lists
    if (FOREVER_ULTRA.includes(email)) { isPremium = true; isUltra = true; }
    if (FOREVER_PREMIUM.includes(email)) { isPremium = true; }

    // Check Hardcoded Timed List (Calculate from firstSeen)
    const timedConfig = HARDCODED_TIMED_USERS.find(u => u.email === email);
    if (timedConfig) {
        const startDate = new Date(user.firstSeen);
        const expiryDate = new Date(startDate.getTime() + (timedConfig.days * 24 * 60 * 60 * 1000));
        
        if (now < expiryDate) {
            if (timedConfig.tier === "ultra") { isPremium = true; isUltra = true; }
            if (timedConfig.tier === "premium") { isPremium = true; }
        }
    }

    // Check Database (URL Command) Expiries
    const dbUltraExpired = user.ultraUntil ? now > new Date(user.ultraUntil) : true;
    const dbPremiumExpired = user.premiumUntil ? now > new Date(user.premiumUntil) : true;
    if (!dbUltraExpired || user.isUltra) { isPremium = true; isUltra = true; }
    if (!dbPremiumExpired || user.isPremium) { isPremium = true; }

    return Response.json({
      isPremium: isPremium,
      canDownload: isUltra, 
      isBlocked: user.isBanned || false,
      isAppLocked: !isPremium,
      blockReason: user.isBanned ? "Account Revoked" : (isPremium ? null : "Subscription Expired")
    });
  }

  // Admin URL Command (Kept as a backup)
  if (path === "/admin") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const email = url.searchParams.get("email")?.toLowerCase().trim();
    const action = url.searchParams.get("action");
    const days = parseInt(url.searchParams.get("days") || "0");
    if (!email) return new Response("Missing email");
    const userEntry = await kv.get(["users", email]);
    const user = userEntry.value as UserProfile || { email, uid: "remote", devices: [], firstSeen: new Date().toISOString() };
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    if (action === "ultra") { user.ultraUntil = expiry.toISOString(); }
    else if (action === "premium") { user.premiumUntil = expiry.toISOString(); }
    else if (action === "ban") { user.isBanned = true; }
    else if (action === "unban") { user.isBanned = false; }
    await kv.set(["users", email], user);
    return new Response(`Updated ${email} to ${action} for ${days} days.`);
  }

  if (path === "/app-config") {
    return Response.json({ features: { showAds: true, enableAI: true, enable4K: true } });
  }

  return new Response("Unauthorized", { status: 401 });
});
