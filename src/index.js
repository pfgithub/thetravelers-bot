const fs = require("fs");

// jsdom setup
const { JSDOM, CookieJar } = require("jsdom");
const { Cookie } = require("tough-cookie");
const cookieJar = new CookieJar();

const header = Cookie.parse(
  "T=pz8P3+S6fK1sbHehMjnLRw==; darkmode=false; hover=true; autowalkpast=true; autowalkpasttime=29; notifAny=true; notifTraveler=false; notifCity=true; notifHouse=true; notifLevelup=false; supplyView=icon; __cfduid=dd8d66499b46ddffdd9c961d331521ae31578549703"
);

cookieJar.setCookie(header, "https://thetravelers.online/", (...a) =>
  console.log(...a)
);

console.log(cookieJar);
let { window: gwindow } = new JSDOM(
  `<!DOCTYPE html><html><head></head><body></body></html>i`,
  {
    url: "https://thetravelers.online/",
    cookieJar
  }
);
global.window = gwindow;
Object.assign(global.window, {
  JSON,
  encodeURIComponent,
  decodeURIComponent
});

//console.log(Object.keys(global.window).sort().join(", "));

const jQuery = require("jquery");
window.jQuery = jQuery;
window.$ = jQuery;
const signalr = require("signalr");
const generateWorldTile = require("./worldgen");
const makeBoard = require("./board");

const hubs = require("../data/hubs"); // or fetch and eval but that seems scary

let cookietext = `T=pz8P3+S6fK1sbHehMjnLRw==; darkmode=false; hover=true; autowalkpast=true; autowalkpasttime=29; notifAny=true; notifTraveler=false; notifCity=true; notifHouse=true; notifLevelup=false; supplyView=icon; __cfduid=dd8d66499b46ddffdd9c961d331521ae31578549703`;

async function request(url, args = {}) {
  let request = new window.XMLHttpRequest();
  request.open("POST", url, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.send(JSON.stringify(args));

  return new Promise((success, error) => {
    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.statusText === "OK") {
        success(JSON.parse(request.responseText).d);
      } else if (request.readyState === 4 && request.status === 200) {
        success(JSON.parse(request.responseText).d);
      } else if (request.readyState === 4) {
        error(JSON.parse(request.responseText));
      }
    };
  });

  let fetcher = await window.fetch("https://thetravelers.online" + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookietext
    },
    body: JSON.stringify(args)
  });

  return await fetcher.json();
}

let visitedHouses = {};
let knownHouses = {};
let gameBoard = makeBoard("#");

console.log("gwt", generateWorldTile);

function searchForHouse(sx, sy) {
  gameBoard.clear();
  let size = 100;

  // spiral instead of this
  for (let x = sx - size; x <= sx + size; x++) {
    for (let y = sy - size; y <= sy + size; y++) {
      if (gameBoard.get(x, -y) !== "#") continue;
      let tile = generateWorldTile(x, y);
      gameBoard.set(x, -y, tile);
      if (tile === "H" || tile === "C") {
        knownHouses[x + "|" + y] = { x, y, tile };
      }
    }
  }
}

let gamedata;

function dist(ax, ay, bx, by) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

String.prototype.hashCode = function() {
  var hash = 0,
    i,
    chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36).replace("-", "N");
};

let eventChoices = {
  "Nqiyaxk -> ": "check the back", // Ez1DP0S
  "Nqiyaxk -> Njlha1w -> ": "a plastic container" // 6U3PxAR
};

let currentVisitPath = "Nqiyaxk -> ";

let nxtdir = "nw";

(async () => {
  let reqres = await request("/default.aspx/GetAutoLog");
  gamedata = JSON.parse(reqres);
  console.log("Game started.");
  //console.log(JSON.stringify(gamedata, null, "\t"));

  const $ = window.$;
  let conn = $.connection.logHub;
  let hub = $.connection.hub;
  //console.log(conn, hub);

  conn.client.getGameObject = jsonv => {
    try {
      nxtdir = nxtdir === "nw" ? "se" : "nw";
      send({ action: "setDir", dir: nxtdir, autowalk: false });
      console.log(JSON.stringify(jsonv));

      Object.assign(gamedata.data, jsonv);
      let json = gamedata.data;

      //process.stdout.write("\u001b[2J\u001b[0;0H")
      //process.stdout.write("\u001b[0;0H");

      if (json.state === "event") {
        send({ action: "event_choice", option: "__leave__" });
        json.state = "";
        return; //// !!!!!!!!!!!!!!!!!!!!!!!!

        process.stdout.write("\u001b[2J\u001b[0;0H");
        let evd = json.event_data;
        // if(evd.visited) do something
        let sd = evd.stage_data;
        let code = "" + sd.desc.hashCode();
        currentVisitPath += code + " -> ";
        let choices = {};
        Object.entries(sd.btns).forEach(([id, value]) => {
          choices[value.text] = id;
        });
        console.log("=========EVENT==========");
        console.log("= Title:", sd.title);
        console.log("= Description:", sd.desc);
        console.log("= VisitedDescription:", sd.visited);
        console.log("= HashCode:", code);
        console.log("= VisitPath:", currentVisitPath);
        console.log("= Choices:", choices);
        console.log("========================");

        console.log(evd);
        let choice = eventChoices[currentVisitPath];
        if (!choice) {
          console.log("Not sure what to do!");
          process.exit(1);
        }
        let choiceID = choices[choice];
        if (!choiceID) {
          console.log("Choice does not exist here");
          process.exit(1);
        }

        console.log("Making choice", choiceID, " (", choice, ")");
        send({ action: "event_choice", option: choiceID });

        return;
      }
      currentVisitPath = "";
      return; // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

      let [px, py] = [json.x, json.y];
      searchForHouse(px, py);
      //gameBoard.print();
      process.stdout.write("\u001b[J");

      console.log(json);

      let houses = Object.entries(knownHouses)
        .map(([, house]) => {
          if (visitedHouses[house.x + "|" + house.y]) return undefined;
          house.dist = dist(house.x, house.y, px, py);
          return house;
        })
        .filter(a => a);
      houses = houses.sort((a, b) => a.dist - b.dist);
      console.log("nearest houses;", houses);
      if (!houses[0]) {
        console.log("no houses");
        process.exit(0);
      }
      let target = houses[0];
      //if(!target) target = houses[0];
      let [tx, ty] = [target.x, target.y];
      let [dx, dy] = [tx - px, ty - py];
      let [sx, sy] = [dx, dy].map(n => Math.sign(n));
      let dirns = sy === 1 ? "n" : sy === -1 ? "s" : "";
      let direw = sx === 1 ? "e" : sx === -1 ? "w" : "";
      let fdir = dirns + direw;
      console.log("Walking", fdir, "to", target);
      send({ action: "setDir", dir: fdir, autowalk: false });
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  };
  conn.client.getGameObjectNoCountdown = json => console.log("ggonc", json);
  conn.client.raw = js => console.log("RAW", js);

  function send(msg) {
    console.log("SEND", JSON.stringify(msg));
    conn.server.fromClient(msg);
  }

  await new Promise(r => hub.start().done(r));

  send({ action: "setDir", dir: nxtdir, autowalk: false });

  /*
const client = new signalR.HubConnectionBuilder()
	.withUrl("https://thetravelers.online/signalr")
	.build();

client.on("send", d => console.log("send", d));

	await client.start();

	client.invoke("send", "Test");
	*/

  /*
const client = new signalR.client(
	"wss://thetravelers.online/signalr",
	["hub", "logHub"],
	undefined,
	undefined,
	{Cookie: cookietext}
);
console.log("client");

client.on("logHub", "getGameObject", (data) => console.log("getGameObject", data));
client.on("logHub", "getGameObjectNoCountdown", (data) => console.log("getGameObjectNoCountdown", data));
client.on("logHub", "raw", (data) => console.log("raw", data));
client.serviceHandlers.onError = (e) => console.log("signalr error", e);
*/
})();

setTimeout(() => process.exit(0), 1000 * 60 * 60); // every 1h
