#include "WiFiSetupPortal.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <WiFi.h>

#include "Hostname.h"

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
 input,button{font:inherit;padding:.4em;width:100%;box-sizing:border-box}
 button{padding:.6em;background:#333;color:#fff;border:0;border-radius:.25em}
 button:disabled{opacity:.5}
 #msg{margin-top:1em;color:#a00;min-height:1.2em}
 #scan{width:auto;margin-top:.5em;padding:.4em .8em;background:#666}
 .net{border-radius:.25em}
 .net:hover{background:#f0f0f0}
 .net.exp{background:#e8e8e8}
 .net-row{display:flex;align-items:center;gap:.5em;width:100%;text-align:left;background:none;color:inherit;border:0;padding:.5em;margin:0}
 .bars{display:inline-flex;align-items:flex-end;gap:1px;width:14px;flex:none}
 .bars i{display:block;width:3px;background:#bbb;border-radius:1px}
 .bars i.on{background:#333}
 .net-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .net-sub{font-size:.8em;color:#666;flex:none}
 .net-connect{display:flex;gap:.5em;padding:0 .5em .5em 2em}
 .net-connect input{flex:1;width:auto}
 .net-connect button{width:auto;padding:.4em .8em;margin:0}
 .manual-toggle{display:block;margin-top:.5em;padding:0;width:auto;background:none;color:#666;border:0;
  font-size:.85em;text-decoration:underline}
</style></head>
<body>
<h1>BrewControl WiFi Setup</h1>
<label>Network</label>
<div id="list"></div>
<button type="button" id="manualToggle" class="manual-toggle">Enter network manually</button>
<div id="manualRow" style="display:none">
 <input type="text" id="manualSsid" placeholder="Network name (SSID)" autocomplete="off">
 <div class="net-connect" style="padding-left:0">
  <input type="password" id="manualPwd" placeholder="WiFi password" autocomplete="off">
  <button type="button" id="manualGo">Connect</button>
 </div>
</div>
<button type="button" id="scan">Rescan</button>
<label>Hostname (optional, default "brewcontrol")</label>
<input type="text" id="host" autocomplete="off" placeholder="brewcontrol">
<div id="msg"></div>
<script>
const $=id=>document.getElementById(id);
function escHtml(s){
 return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Same 0-4 bucket breakpoints as the settings UI's signal-bar display.
function barCount(rssi){
 if(rssi>=-55)return 4;
 if(rssi>=-65)return 3;
 if(rssi>=-75)return 2;
 if(rssi>=-85)return 1;
 return 0;
}
function barsHtml(rssi){
 const n=barCount(rssi);
 let h='<span class="bars">';
 for(let i=1;i<=4;i++) h+=`<i class="${i<=n?'on':''}" style="height:${i*3+2}px"></i>`;
 return h+'</span>';
}

let nets=[];
let expanded=null;   // ssid of the expanded row, or null
let manualOpen=false;

function renderList(){
 const list=$('list');
 list.innerHTML=nets.length?'':'<div id="msg2" style="color:#666">No networks found</div>';
 nets.forEach(n=>{
  const div=document.createElement('div');
  div.className='net'+(expanded===n.ssid?' exp':'');
  div.innerHTML=`<button type="button" class="net-row" data-ssid="${escHtml(n.ssid)}">`+
   barsHtml(n.rssi)+
   `<span class="net-name">${escHtml(n.ssid)}</span>`+
   `<span class="net-sub">${n.open?'Open':'Secured'}</span></button>`;
  if(expanded===n.ssid){
   const row=document.createElement('div');
   row.className='net-connect';
   row.innerHTML=`<input type="password" id="rowpwd" autocomplete="off" `+
    `placeholder="${n.open?'No password needed':'WiFi password'}">`+
    `<button type="button" id="rowgo">Connect</button>`;
   div.appendChild(row);
  }
  list.appendChild(div);
 });
 list.querySelectorAll('.net-row').forEach(btn=>{
  btn.onclick=()=>{
   expanded=(expanded===btn.dataset.ssid)?null:btn.dataset.ssid;
   if(expanded){manualOpen=false;$('manualRow').style.display='none';}
   renderList();
  };
 });
 const rowgo=$('rowgo');
 if(rowgo) rowgo.onclick=()=>save(expanded,$('rowpwd').value);
}

async function scan(){
 $('msg').textContent='Scanning...';
 nets=[];
 renderList();
 for (let i=0; i<30; i++){
  const r=await fetch('/api/scan');
  if (r.status===200){
   const found=await r.json();
   // De-dupe by SSID (strongest wins), drop hidden/empty, sort by signal —
   // same as the settings UI's network list.
   const best=new Map();
   found.forEach(n=>{
    if(!n.ssid)return;
    const prev=best.get(n.ssid);
    if(!prev||n.rssi>prev.rssi)best.set(n.ssid,n);
   });
   nets=[...best.values()].sort((a,b)=>b.rssi-a.rssi);
   $('msg').textContent='';
   renderList();
   return;
  }
  await new Promise(res=>setTimeout(res,1000));
 }
 $('msg').textContent='Scan timed out';
}
function afterSaved(ssid,host){
 const url=`http://${host||'brewcontrol'}.local/`;
 const retrySecs=5;
 $('msg').innerHTML=`Saved. Board reboots and joins "${ssid}". Once this device is back on `+
  `that network, open <a href="${url}">${url}</a>.<div id="retry"></div>`;
 // Best-effort: if the OS switches this device back to the target network on
 // its own, redirect automatically once the board answers. The link above
 // is the guaranteed fallback if it doesn't.
 let attempt=0, countdown=retrySecs;
 const showCountdown=()=>{$('retry').textContent=`Next attempt in ${countdown}s (attempt ${attempt})`;};
 showCountdown();
 const countdownTimer=setInterval(()=>{countdown--;showCountdown();},1000);
 const timer=setInterval(async()=>{
  attempt++;
  countdown=retrySecs;
  showCountdown();
  try{
   await fetch(url,{mode:'no-cors'});
   clearInterval(timer);
   clearInterval(countdownTimer);
   location.href=url;
  }catch(e){/* not reachable yet */}
 },retrySecs*1000);
}
async function save(ssid,password){
 if(!ssid)return;
 $('msg').textContent='Saving...';
 const host=$('host').value;
 const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({ssid,password,hostname:host})});
 if(r.ok){afterSaved(ssid,host);}
 else{$('msg').textContent='Error: '+await r.text();}
}
$('scan').onclick=scan;
$('manualToggle').onclick=()=>{
 manualOpen=!manualOpen;
 $('manualRow').style.display=manualOpen?'block':'none';
 $('manualToggle').textContent=manualOpen?'Cancel':'Enter network manually';
 if(manualOpen){expanded=null;renderList();}
};
$('manualGo').onclick=()=>save($('manualSsid').value,$('manualPwd').value);
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
        String hostname = json["hostname"] | "";
        hostname.toLowerCase();
        if (!hostname.isEmpty() && !validHostname(hostname)) {
          req->send(400, "text/plain", "invalid hostname");
          return;
        }
        Preferences prefs;
        prefs.begin("brewctrl", false);
        prefs.putString("ssid", ssid);
        prefs.putString("password", password);
        if (!hostname.isEmpty()) prefs.putString("hostname", hostname);
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
