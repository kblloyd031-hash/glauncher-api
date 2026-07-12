// Deno Deploy - main.ts
Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Basic health check
  if (url.pathname === "/ping") {
    return new Response(JSON.stringify({ status: "online", time: Date.now() }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // The main config endpoint
  if (url.pathname === "/app-config") {
    const config = {
      maintenanceMode:true,
      minVersion: 1,
      features: {
        enableHighQualitySniffing: true,
        premiumRequired: false
      },
      messages: {
        homeBanner: "Welcome to Google Launcher",
        updateUrl: ""
      }
    };
    
    return new Response(JSON.stringify(config), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
});
