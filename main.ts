// 🚀 Google Launcher - Master Control (Deno KV Powered)
const kv = await Deno.openKv();

// --- ⚙️ CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; 
const LATEST_APP_VERSION = "1.0.2"; 
const MIN_APP_VERSION = "4";       
const UPDATE_URL = "https://pub-532ae1cec0544157b46e07176dc7b9d2.r2.dev/app-debug.apk";

// --- 🏆 1. FOREVER ACCESS (Never Expires) ---
const FOREVER_ULTRA = ["kblloyd031@gmail.com"]; 
const FOREVER_PREMIUM = [""];

// --- ⏳ 2. TIMED ACCESS (Manage Days Directly Here) ---
const HARDCODED_TIMED_USERS = [
  { email: "anderskyandersky@gmail.com", tier: "ultra", days: 30 },
  { email: "dmuthui589@gmail.com", tier: "ultra", days: 14 },
  { email: "israelogari16@gmail.com", tier: "ultra", days: 14 },
  { email: "henryodhiambo2028@gmail.com", tier: "ultra", days: 14 },
  { email: "mokayadaniel56@gmail.com", tier: "ultra", days: 14 }
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
  firstSeen: string; 
  lastSeen: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // --- 📱 1. USER STATUS (Includes Offline Check Support) ---
  if (path === "/user-status") {
    const email = (url.searchParams.get("email") || "guest").toLowerCase().trim();
    const uid = url.searchParams.get("uid") || "unknown";
    const deviceId = url.searchParams.get("device") || "unknown";

    const userKey = ["users", email];
    const userEntry = await kv.get(userKey);
    let user = userEntry.value as UserProfile;

    if (!user) {
      user = { 
        email, uid, isPremium: false, isUltra: false, 
        premiumUntil: null, ultraUntil: null, 
        isBanned: false, devices: deviceId !== "unknown" ? [deviceId] : [], 
        firstSeen: new Date().toISOString(), 
        lastSeen: new Date().toISOString() 
      };
      if (email !== "guest") {
        await kv.set(userKey, user);
        if (uid !== "unknown") await kv.set(["uids", uid], email);
      }
    } else {
      user.lastSeen = new Date().toISOString();
      if (uid !== "unknown") {
        user.uid = uid;
        await kv.set(["uids", uid], email);
      }
      if (!user.devices.includes(deviceId) && deviceId !== "unknown") user.devices.push(deviceId);
      await kv.set(userKey, user);
    }

    const now = new Date();
    let isPremium = false;
    let isUltra = false;
    let expiryDate: Date | null = null;

    // A. Check Forever Lists (Expiry: 2099)
    if (FOREVER_ULTRA.includes(email)) { 
      isPremium = true; isUltra = true; 
      expiryDate = new Date("2099-12-31T23:59:59Z");
    } else if (FOREVER_PREMIUM.includes(email)) { 
      isPremium = true; 
      expiryDate = new Date("2099-12-31T23:59:59Z");
    }

    // B. Check Hardcoded Timed Users
    const timedConfig = HARDCODED_TIMED_USERS.find(u => u.email === email);
    if (timedConfig && !isUltra) {
        const startDate = new Date(user.firstSeen);
        const timedExpiry = new Date(startDate.getTime() + (timedConfig.days * 24 * 60 * 60 * 1000));
        if (now < timedExpiry) {
            isPremium = true;
            if (timedConfig.tier === "ultra") isUltra = true;
            if (!expiryDate || timedExpiry > expiryDate) expiryDate = timedExpiry;
        }
    }

    // C. Check Database Subscriptions
    const dbUltraExpiry = user.ultraUntil ? new Date(user.ultraUntil) : null;
    const dbPremiumExpiry = user.premiumUntil ? new Date(user.premiumUntil) : null;

    if (dbUltraExpiry && now < dbUltraExpiry) {
        isPremium = true; isUltra = true;
        if (!expiryDate || dbUltraExpiry > expiryDate) expiryDate = dbUltraExpiry;
    } else if (dbPremiumExpiry && now < dbPremiumExpiry) {
        isPremium = true;
        if (!expiryDate || dbPremiumExpiry > expiryDate) expiryDate = dbPremiumExpiry;
    }

    const finalTier = isUltra ? "ULTRA" : (isPremium ? "NORMAL" : null);

    return Response.json({
      isPremium: isPremium,
      canDownload: isUltra, 
      isBlocked: user.isBanned || false,
      isAppLocked: !isPremium,
      blockReason: user.isBanned ? "Account Revoked" : (isPremium ? null : "Subscription Expired"),
      tier: finalTier,
      expiryDate: expiryDate ? expiryDate.toISOString() : null
    });
  }

  // --- 💸 2. MANUAL VERIFICATION ---
  if (path === "/verify-paybill-payment" && req.method === "POST") {
    const { transactionCode, uid, planType } = await req.json();
    const code = transactionCode.toUpperCase().trim();

    // Check if code was pre-authorized via Admin
    const authEntry = await kv.get(["valid_codes", code]);
    if (authEntry.value) {
      const emailEntry = await kv.get(["uids", uid]);
      if (emailEntry.value) {
        const email = emailEntry.value as string;
        const userEntry = await kv.get(["users", email]);
        const user = userEntry.value as UserProfile;
        
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30); // Default 30 days

        if (planType === "ULTRA") user.ultraUntil = expiry.toISOString();
        else user.premiumUntil = expiry.toISOString();

        await kv.set(["users", email], user);
        await kv.delete(["valid_codes", code]); // Prevent reuse
        
        return Response.json({ success: true, message: "Unlocked successfully!" });
      }
    }
    return Response.json({ success: false, message: "Invalid or unauthorized code." });
  }

  // --- ⚙️ 3. APP CONFIG ---
  if (path === "/app-config") {
    return Response.json({ 
      maintenance: { active: false, message: "OK" },
      version: { latest: LATEST_APP_VERSION, min: MIN_APP_VERSION, url: UPDATE_URL, force: true },
      features: { showAds: true, enableAI: true, enable4K: true, canDownload: true },
      messages: { homeBanner: "Google Launcher Premium" }
    });
  }

  // --- 🔑 4. ADMIN TOOLS ---
  if (path === "/admin") {
    if (url.searchParams.get("pw") !== ADMIN_PASSWORD) return new Response("Forbidden", { status: 403 });
    const action = url.searchParams.get("action");
    const email = url.searchParams.get("email")?.toLowerCase().trim();
    const code = url.searchParams.get("code")?.toUpperCase().trim();
    
    // Action: Pre-authorize an M-Pesa code
    if (action === "add-code" && code) {
      await kv.set(["valid_codes", code], { addedAt: new Date().toISOString() });
      return new Response(`Code ${code} added to valid list.`);
    }

    // Action: Manage Users directly
    if (email) {
      const days = parseInt(url.searchParams.get("days") || "0");
      const userEntry = await kv.get(["users", email]);
      const user = userEntry.value as UserProfile || { email, uid: "remote", devices: [], firstSeen: new Date().toISOString() };
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      if (action === "ultra") user.ultraUntil = expiry.toISOString();
      else if (action === "premium") user.premiumUntil = expiry.toISOString();
      else if (action === "ban") user.isBanned = true;
      else if (action === "unban") user.isBanned = false;

      await kv.set(["users", email], user);
      return new Response(`Updated ${email} to ${action} for ${days} days.`);
    }
    return new Response("Missing parameters");
  }

  return new Response("Unauthorized", { status: 401 });
});
