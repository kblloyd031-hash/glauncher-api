// Deno Deploy - main.ts
const kv = await Deno.openKv();

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/app-config") {
    const userId = url.searchParams.get("uid") || "unknown";
    const deviceId = url.searchParams.get("device") || "unknown";

    // 1. Fetch user from Database
    const userKey = ["users", userId];
    const userEntry = await kv.get(userKey);
    let userData = userEntry.value;

    if (!userData) {
      // 🆕 NEW USER: First time this Firebase account is seen
      userData = {
        userId: userId,
        devices: [deviceId], // Store the hardware ID
        isPremium: false,
        isBlocked: false,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        note: "Newly registered"
      };
      await kv.set(userKey, userData);
      console.log(`🆕 NEW REGISTRATION: User ${userId} on device ${deviceId}`);
    } else {
      // 🔄 RETURNING USER: Check for resharing
      userData.lastSeen = new Date().toISOString();
      
      // If the hardware ID is different, they shared their account!
      if (!userData.devices.includes(deviceId)) {
        console.warn(`🚨 RESHARE DETECTED: User ${userId} added new device ${deviceId}`);
        userData.devices.push(deviceId);
        userData.note = `Shared across ${userData.devices.length} devices`;
      }
      
      await kv.set(userKey, userData);
    }

    // 2. Security Check: Is this person banned?
    if (userData.isBlocked) {
      return new Response(JSON.stringify({ 
        blocked: true, 
        reason: "Your access has been revoked. Contact admin." 
      }), { status: 200 }); // Return 200 so the app can show the message
    }

    // 3. Return the Config (Controls the App)
    return new Response(JSON.stringify({
      maintenanceMode: true,
      isPremium: userData.isPremium,
      blocked: false,
      features: {
        enableHighQualitySniffing: true,
        premiumRequired: true // Forces premium check in the player
      },
      messages: {
        homeBanner: userData.isPremium ? "⭐ PREMIUM MEMBER" : "Welcome to Google Launcher",
        updateUrl: ""
      }
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Unauthorized", { status: 401 });
});
