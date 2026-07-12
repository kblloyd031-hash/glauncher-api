// 🚀 Google Launcher - Hardened Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; 
const LATEST_APP_VERSION = "1.0.0";
const MIN_APP_VERSION = "1.0.0";

// 🚀 MASTER CONTROLS (The "One Line" Unlocks)
const MASTER_UNLOCK_LIST = ["your-email@gmail.com"]; // 👈 ADD EMAILS OR UIDs HERE TO UNLOCK SPECIFIC ACCS
const GLOBAL_PREMIUM_OVERRIDE = false;           // 👈 SET TO 'true' TO UNLOCK PREMIUM FOR EVERYONE

// --- TYPES ---
interface UserProfile {
  uid: string;
  email: string;
  isPremium: boolean;
  isBanned: boolean;
  devices: string[]; 
  firstSeen: string;
  lastSeen: string;
}

// --- API HANDLER ---
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/ping") return Response.json({ status: "online", time: Date.now() });

  if (path === "/app-config") {
    const uid = url.searchParams.get("uid") || "guest";
    const deviceId = url.searchParams.get("device") || "unknown";
    const email = url.searchParams.get("email") || "Guest User";

    const userKey = ["users", uid];
    const userEntry = await kv.get<UserProfile>(userKey);
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
      user.email = email; 
      
      const maxAllowed = (user.isPremium || GLOBAL_PREMIUM_OVERRIDE) ? 5 : 1;
      
      if (!user.devices.includes(deviceId) && uid !== "guest" && deviceId !== "unknown") {
        if (user.devices.length < maxAllowed) {
          user.devices.push(deviceId);
        } else {
          return Response.json({
            status: {
              isPremium: user.isPremium,
              isBlocked: true,
              blockReason: "Device limit reached. Please upgrade or reset your authorized devices."
            }
          });
        }
      }
      await kv.set(userKey, user);
    }

    // 🏆 MASTER LOGIC: Check if this user is in the unlock list or if global override is on
    const isUnlocked = user.isPremium || GLOBAL_PREMIUM_OVERRIDE || MASTER_UNLOCK_LIST.includes(kblloyd031@gmail.com) || MASTER_UNLOCK_LIST.includes(uid);

    return Response.json({
      maintenance: { active: false, message: "" },
      version: { latest: LATEST_APP_VERSION, min: MIN_APP_VERSION, url: "", force: false },
      status: {
        isPremium: isUnlocked,
        isBlocked: user.isBanned,
        isAppLocked: !isUnlocked, 
        blockReason: user.isBanned ? "Your access has been revoked by the administrator." : null
      },
      features: {
        showAds: !isUnlocked,
        enableAI: isUnlocked,
        enable4K: isUnlocked,
        canDownload: isUnlocked,
        allowMultiDevice: isUnlocked
      },
      messages: {
        homeBanner: isUnlocked ? "⭐ PREMIUM MEMBER" : "Google Launcher (Free Mode)",
      }
    });
  }

  // Admin Stats
  if (path === "/stats") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const users: UserProfile[] = [];
    for await (const entry of kv.list<UserProfile>({ prefix: ["users"] })) { users.push(entry.value); }
    return Response.json({
      summary: { total_accounts: users.length, premium_users: users.filter(u => u.isPremium).length },
      accounts: users.map(u => ({ email: u.email, uid: u.uid, premium: u.isPremium, last_active: u.lastSeen }))
    });
  }

  // Remote Control Actions
  if (path === "/admin") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const uid = url.searchParams.get("uid");
    const action = url.searchParams.get("action");
    if (!uid) return new Response("UID required");
    const userEntry = await kv.get<UserProfile>(["users", uid]);
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
