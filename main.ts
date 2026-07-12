// 🚀 Google Launcher - Hardened Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- ⚙️ CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; 
const LATEST_APP_VERSION = "1.0.0";
const MIN_APP_VERSION = "1.0.0";

// --- 🏆 MASTER UNLOCK LIST (One line to unlock anyone) ---
const MASTER_UNLOCK_LIST = ["kblloyd031@gmail."]; 
const GLOBAL_PREMIUM_OVERRIDE = false;           

// --- 📦 TYPES ---
interface UserProfile {
  uid: string;
  email: string;
  isPremium: boolean;
  isBanned: boolean;
  devices: string[]; 
  firstSeen: string;
  lastSeen: string;
}

// --- 🌐 API HANDLER ---
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/ping") return Response.json({ status: "online", time: Date.now() });

  // 1️⃣ ⚡ LIGHTWEIGHT: User Status (Call on every launch)
  if (path === "/user-status") {
    const uid = url.searchParams.get("uid") || "guest";
    const deviceId = url.searchParams.get("device") || "unknown";
    const email = (url.searchParams.get("email") || "Guest User").toLowerCase(); // Case-insensitive fix

    const userKey = ["users", uid];
    const userEntry = await kv.get(userKey);
    let user = userEntry.value;

    if (!user) {
      user = {
        uid,
        email,
        isPremium: false,
        isBanned: false,
        devices: uid !== "guest" && deviceId !== "unknown" ? [deviceId] : [],
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
      if (uid !== "guest") await kv.set(userKey, user);
    } else {
      user.lastSeen = new Date().toISOString();
      if (email !== "guest user") user.email = email;
      
      // Hardware Locking
      const isUnlockedTemp = user.isPremium || GLOBAL_PREMIUM_OVERRIDE || MASTER_UNLOCK_LIST.includes(user.email) || MASTER_UNLOCK_LIST.includes(uid);
      const maxAllowed = isUnlockedTemp ? 5 : 1;
      
      if (!user.devices.includes(deviceId) && uid !== "guest" && deviceId !== "unknown") {
        if (user.devices.length < maxAllowed) {
          user.devices.push(deviceId);
          await kv.set(userKey, user);
        } else {
          return Response.json({
            isPremium: isUnlockedTemp,
            isBlocked: true,
            isAppLocked: true,
            blockReason: `DEVICE LIMIT: Active on ${user.devices.length}/${maxAllowed} devices.`
          });
        }
      }
      await kv.set(userKey, user);
    }

    // FINAL DECISION (Combined Check)
    const isUnlocked = user.isPremium || GLOBAL_PREMIUM_OVERRIDE || MASTER_UNLOCK_LIST.includes(user.email) || MASTER_UNLOCK_LIST.includes(uid);

    return Response.json({
      isPremium: isUnlocked,
      isBlocked: user.isBanned,
      isAppLocked: !isUnlocked,
      blockReason: user.isBanned ? "Your access has been revoked by the administrator." : null
    });
  }

  // 2️⃣ 📦 HEAVY: App Configuration (Cached for 30 mins on Android)
  if (path === "/app-config") {
    return Response.json({
      maintenance: { active: false, message: "" },
      version: { latest: LATEST_APP_VERSION, min: MIN_APP_VERSION, url: "", force: false },
      features: {
        showAds: true,
        enableAI: true,
        enable4K: true,
        canDownload: true,
        allowMultiDevice: true
      },
      messages: {
        homeBanner: "Google Launcher Home",
      }
    });
  }

  // Admin Stats
  if (path === "/stats") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const users = [];
    for await (const entry of kv.list({ prefix: ["users"] })) { users.push(entry.value); }
    return Response.json({
      summary: { total_accounts: users.length, premium_users: users.filter(u => u.isPremium).length },
      accounts: users.map(u => ({ email: u.email, devices: u.devices.length, premium: u.isPremium, last_active: u.lastSeen }))
    });
  }

  // Remote Actions
  if (path === "/admin") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const uid = url.searchParams.get("uid");
    const action = url.searchParams.get("action");
    if (!uid) return new Response("UID required");
    const userEntry = await kv.get(["users", uid]);
    if (!userEntry.value) return new Response("User not found");
    const user = userEntry.value;
    if (action === "premium") user.isPremium = true;
    if (action === "free") user.isPremium = false;
    if (action === "ban") user.isBanned = true;
    if (action === "unban") user.isBanned = false;
    if (action === "reset") user.devices = [];
    await kv.set(["users", uid], user);
    return new Response(`Success: ${user.email} updated to ${action}`);
  }

  return new Response("Unauthorized", { status: 401 });
});
