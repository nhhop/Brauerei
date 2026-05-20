#include "WiFiSetupPortal.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <WiFi.h>

#ifndef BREWCTRL_SETUP_PWD
#define BREWCTRL_SETUP_PWD "brew-setup"
#endif

namespace BrewControl {
namespace {

constexpr char kSetupAP[] = "BrewControl-Setup";
constexpr char kSetupPwd[] = BREWCTRL_SETUP_PWD;
constexpr byte kDnsPort = 53;
const IPAddress kApIp(192, 168, 4, 1);

constexpr char kSetupHtml[] = R"HTML(<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BrewControl Setup</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:480px;margin:1em auto;padding:0 1em;color:#111}
 h1{font-size:1.25em}
 label{display:block;margin:.75em 0 .25em}
 input,select,button{font:inherit;padding:.4em;width:100%;box-sizing:border-box}
 button{margin-top:1em;padding:.6em;background:#333;color:#fff;border:0;border-radius:.25em}
 button:disabled{opacity:.5}
 #msg{margin-top:1em;color:#a00;min-height:1.2em}
 .row{display:flex;gap:.5em;align-items:flex-end}
 .row select{flex:1}
 .row button{width:auto;margin-top:0;padding:.4em .8em;background:#666}
</style></head>
<body>
<h1>BrewControl WiFi Setup</h1>
<label>Network</label>
<div class="row"><select id="ssid"></select><button type="button" id="scan">Rescan</button></div>
<label>Password</label>
<input type="password" id="pwd" autocomplete="off">
<button id="go">Connect</button>
<div id="msg"></div>
<script>
const $=id=>document.getElementById(id);
async function scan(){
 $('msg').textContent='Scanning...';
 $('ssid').innerHTML='';
 for (let i=0; i<30; i++){
  const r=await fetch('/api/scan');
  if (r.status===200){
   const nets=await r.json();
   nets.sort((a,b)=>b.rssi-a.rssi).forEach(n=>{
    const o=document.createElement('option');
    o.value=n.ssid;
    o.textContent=`${n.ssid} (${n.rssi} dBm)${n.open?' [open]':''}`;
    $('ssid').appendChild(o);
   });
   $('msg').textContent=nets.length?'':'No networks found';
   return;
  }
  await new Promise(res=>setTimeout(res,1000));
 }
 $('msg').textContent='Scan timed out';
}
$('scan').onclick=scan;
$('go').onclick=async()=>{
 $('go').disabled=true;
 $('msg').textContent='Saving...';
 const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({ssid:$('ssid').value,password:$('pwd').value})});
 if(r.ok){$('msg').textContent='Saved. Rebooting...';}
 else{$('msg').textContent='Error: '+await r.text();$('go').disabled=false;}
};
scan();
</script>
</body></html>)HTML";

}  // namespace

void WiFiSetupPortal::runUntilConfigured() {
  // AP_STA, not pure AP — WiFi.scanNetworks() needs STA capability,
  // calling it in pure AP mode crashes/resets on ESP32-Arduino.
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(kApIp, kApIp, IPAddress(255, 255, 255, 0));
  WiFi.softAP(kSetupAP, kSetupPwd);
  Serial.printf("Setup AP \"%s\" up at %s (pw: %s)\n",
                kSetupAP, WiFi.softAPIP().toString().c_str(), kSetupPwd);

  DNSServer dns;
  dns.start(kDnsPort, "*", kApIp);

  AsyncWebServer server(80);
  volatile bool done = false;

  server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
    req->send(200, "text/html", kSetupHtml);
  });

  // Async scan — blocking scanNetworks() from the AsyncTCP task crashes
  // S2 (single-core, WiFi driver and AsyncTCP collide). Client polls
  // /api/scan: 202 while running, 200 + JSON when results are ready.
  server.on("/api/scan", HTTP_GET, [](AsyncWebServerRequest* req) {
    int n = WiFi.scanComplete();
    if (n == WIFI_SCAN_RUNNING) {
      req->send(202, "application/json", "[]");
      return;
    }
    if (n < 0) {
      // No scan yet, or previous scan failed — kick off a fresh one.
      WiFi.scanNetworks(/*async=*/true);
      req->send(202, "application/json", "[]");
      return;
    }
    JsonDocument doc;
    JsonArray arr = doc.to<JsonArray>();
    for (int i = 0; i < n; ++i) {
      JsonObject o = arr.add<JsonObject>();
      o["ssid"] = WiFi.SSID(i);
      o["rssi"] = WiFi.RSSI(i);
      o["open"] = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
    }
    WiFi.scanDelete();
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  auto* connect = new AsyncCallbackJsonWebHandler(
      "/api/connect", [&done](AsyncWebServerRequest* req, JsonVariant& json) {
        const char* ssid = json["ssid"] | "";
        const char* password = json["password"] | "";
        if (!ssid[0]) {
          req->send(400, "text/plain", "missing ssid");
          return;
        }
        Preferences prefs;
        prefs.begin("brewctrl", false);
        prefs.putString("ssid", ssid);
        prefs.putString("password", password);
        prefs.end();
        req->send(200, "text/plain", "ok");
        done = true;
      });
  server.addHandler(connect);

  server.onNotFound([](AsyncWebServerRequest* req) { req->redirect("/"); });
  server.begin();

  while (!done) {
    dns.processNextRequest();
    delay(20);
  }
  delay(1000);  // let the HTTP response flush before the reboot
  ESP.restart();
}

}  // namespace BrewControl
