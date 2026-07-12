// 🚀 Google Launcher - Hardened Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; // 🔑 CHANGE THIS FOR SECURITY
const LATEST_APP_VERSION = "1.0.0";
const MIN_APP_VERSION = "1.0.0";

// --- TYPES ---
interface UserProfile {
  uid: string;
  email: string;
  isPremium: boolean;
  isBanned: boolean;
  devices: string[]; // List of Hardware IDs
  firstSeen: string;
  lastSeen: string;
}

// --- API HANDLER ---
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1️⃣ PUBLIC: Health Check
  if (path === "/ping") return Response.json({ status: "online", time: Date.now() });

  // 2️⃣ CORE: App Configuration & Gatekeeper
  // URL Params: uid, device, email
  if (path === "/app-config") {
    const uid = url.searchParams.get("uid") || "guest";
    const deviceId = url.searchParams.get("device") || "unknown";
    const email = url.searchParams.get("email") || "Guest User";

    const userKey = ["users", uid];
    const userEntry = await kv.get<UserProfile>(userKey);
    let user = userEntry.value;

    // 🔄 NEW USER REGISTRATION / TRACKING
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
      user.email = email; // Update email if changed
      
      // 🔒 HARDWARE LOCKING LOGIC
      const maxAllowed = user.isPremium ? 2 : 1;
      
      if (!user.devices.includes(deviceId) && uid !== "guest" && deviceId !== "unknown") {
        if (user.devices.length < maxAllowed) {
          user.devices.push(deviceId); // Add new authorized device
        } else {
          // Device limit reached! This prevents sharing.
          return Response.json({
            status: {
              isPremium: user.isPremium,
              isBlocked: true,
              blockReason: user.isPremium 
                ? "PREMIUM LIMIT: This account is already used on 2 other TV boxes." 
                : "FREE LIMIT: This account is locked to your first device. Pay for Premium to use this device."
            }
          });
        }
      }
      await kv.set(userKey, user);
    }

    // 🏆 FINAL CONFIGURATION (Enforced by Server)
    return Response.json({
      maintenance: { active: false, message: "" },
      version: { latest: LATEST_APP_VERSION, min: MIN_APP_VERSION, url: "", force: false },
      status: {
        isPremium: user.isPremium,
        isBlocked: user.isBanned,
        isAppLocked: !user.isPremium, // 🚀 LOCKS CORE ACTIONS BUT ALLOWS BROWSING
        blockReason: user.isBanned ? "Your access has been revoked by the administrator." : null
      },
      features: {
        showAds: !user.isPremium,
        enableAI: user.isPremium,
        enable4K: user.isPremium,
        canDownload: user.isPremium,
        allowMultiDevice: user.isPremium
      },
      messages: {
        homeBanner: user.isPremium ? "⭐ PREMIUM MEMBER" : "Google Launcher (Free Mode)",
      }
    });
  }

  // 3️⃣ ADMIN: Stats Dashboard (See Emails, Hardware, and Device Counts)
  // Usage: https://your-api.deno.dev/stats?pw=admin
  if (path === "/stats") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    
    const users: UserProfile[] = [];
    for await (const entry of kv.list<UserProfile>({ prefix: ["users"] })) {
      users.push(entry.value);
    }

    return Response.json({
      summary: {
        total_accounts: users.length,
        premium_users: users.filter(u => u.isPremium).length,
        total_copies_in_wild: users.reduce((acc, u) => acc + u.devices.length, 0)
      },
      accounts: users.map(u => ({
        email: u.email,
        uid: u.uid,
        devices: u.devices.length,
        hardware_ids: u.devices,
        premium: u.isPremium,
        banned: u.isBanned,
        last_active: u.lastSeen
      }))
    }, { headers: { "Content-Type": "application/json" } });
  }

  // 4️⃣ ADMIN: Remote Control Actions
  // Usage: /admin?pw=admin&uid=THE_ID&action=premium
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
    if (action === "reset") user.devices = []; // Unlocks all hardware slots

    await kv.set(["users", uid], user);
    return new Response(`Success: ${user.email} updated to ${action}`);
  }

  return new Response("Unauthorized", { status: 401 });
});
