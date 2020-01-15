import * as fs from "fs";
import * as path from "path";
import * as util from "util";

declare global {
    namespace NodeJS {
        interface Global {
            window: DOMWindow & {
                jQuery?: JQueryStatic;
                $?: JQueryStatic;
            };
        }
    }
}

// jsdom setup
import { JSDOM, CookieJar, DOMWindow } from "jsdom";
import { Cookie } from "tough-cookie";
const cookieJar = new CookieJar();

const header = Cookie.parse(
    "T=pz8P3+S6fK1sbHehMjnLRw==; darkmode=false; hover=true; autowalkpast=true; autowalkpasttime=29; notifAny=true; notifTraveler=false; notifCity=true; notifHouse=true; notifLevelup=false; supplyView=icon; __cfduid=dd8d66499b46ddffdd9c961d331521ae31578549703",
)!;

cookieJar.setCookie(header, "https://thetravelers.online/", (...a) =>
    console.log(...a),
);

console.log(cookieJar);
let { window: gwindow } = new JSDOM(
    `<!DOCTYPE html><html><head></head><body></body></html>i`,
    {
        url: "https://thetravelers.online/",
        cookieJar,
    },
);
global.window = gwindow;
Object.assign(global.window, {
    JSON,
    encodeURIComponent,
    decodeURIComponent,
});

//console.log(Object.keys(global.window).sort().join(", "));

import * as jQuery from "jquery";
global.window.jQuery = jQuery;
global.window.$ = jQuery;
import "signalr";
// @ts-ignore
import * as generateWorldTile from "./worldgen";
// @ts-ignore
import * as makeBoard from "./board";

require("../data/hubs");
// or fetch and eval but that seems scary

async function request(url: string, args: any = {}): Promise<string> {
    // @ts-ignore
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
}

function getCurrentVisitPath() {
    return fs.readFileSync(
        path.join(__dirname, "../data/currentvisit"),
        "utf-8",
    );
}
function setCurrentVisitPath(newPath: string) {
    fs.writeFileSync(
        path.join(__dirname, "../data/currentvisit"),
        newPath,
        "utf-8",
    );
}

function getVisitedHouses() {
    return JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "../data/visitedhouses.json"),
            "utf-8",
        ) || "{}",
    );
}
function setVisitedHouses(nvh: string) {
    fs.writeFileSync(
        path.join(__dirname, "../data/visitedhouses.json"),
        JSON.stringify(nvh, null, "\t"),
        "utf-8",
    );
}

type Logfiles = "general" | "gamestate" | "detail" | "sendrecv" | "recvunknown";
function log(logfile: Logfiles, ...message: any[]) {
    fs.appendFileSync(
        path.join("__dirname", "../logs", logfile + ".log"),
        new Date().toString() +
            " (" +
            new Date().getTime() +
            ") ================\n\n" +
            message
                .map(msg =>
                    typeof msg === "string"
                        ? msg
                        : util.inspect(msg, false, null, false),
                )
                .join(" ") +
            "\n\n=================== ",
        "utf-8",
    );
}

let knownHouses: { [key: string]: { x: number; y: number; tile: string } } = {};
let gameBoard = makeBoard("#");

function searchForHouse(sx: number, sy: number) {
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

let gamedata: { data: GameData };

// function dist(ax: number, ay: number, bx: number, by: number) {
//     return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
// }

function hashCode(str: string) {
    var hash = 0,
        i,
        chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36).replace("-", "N");
}

let eventChoices: { [key: string]: string | undefined } = {
    "Nqiyaxk -> ": "check the back",
    "Nqiyaxk -> Njlha1w -> ": "a plastic container",
    "Npxhk2u -> ": "the kitchen",
    "Npxhk2u -> 4tv44d -> ": "an old note",
    "Npxhk2u -> 4tv44d -> gdmovk -> ": "the top floor",
    "Npxhk2u -> 4tv44d -> gdmovk -> oo15x8 -> ": "search",
    "Nkx66dg -> ": "enter",
    "Nkx66dg -> Ndng1cc -> ": "the back room",
    "Nkx66dg -> Ndng1cc -> ri4pqo -> ": "the closet",
    "Nkx66dg -> Ndng1cc -> ri4pqo -> N29f16l -> ": "search",
    "Nwbfckh -> ": "the highway",
    "Nwbfckh -> lxsdpw -> ": "the skyscraper",
    "Nwbfckh -> lxsdpw -> Nwvszfr -> ": "the corner",
    "Nwbfckh -> lxsdpw -> Nwvszfr -> bumptf -> ": "the body",
    // the desk requires some thing
    "Nwbfckh -> lxsdpw -> Nwvszfr -> bumptf -> [looting] -> bumptf -> ":
        "go back",
    "Nwbfckh -> lxsdpw -> Nwvszfr -> bumptf -> [looting] -> bumptf -> lxsdpw -> ":
        "the tent",
    "Nwbfckh -> lxsdpw -> Nwvszfr -> bumptf -> [looting] -> bumptf -> lxsdpw -> [looting] -> lxsdpw -> ":
        "leave",
    "Nrokoq0 -> ": "enter",
    "Nrokoq0 -> h14h96 -> ": "the bedroom",
    "Nrokoq0 -> h14h96 -> 9u7myh -> ": "leave", // maybe it isn't worth it to do this one
};

let nxtdir = "nw";

function estimateTime(px: number, py: number, lx: number, ly: number) {
    let straightTimeH = Math.abs(lx - px);
    let straightTimeV = Math.abs(ly - py);
    let diagonalTime = Math.min(straightTimeV, straightTimeH);
    straightTimeH -= diagonalTime;
    straightTimeV -= diagonalTime;
    return (diagonalTime + straightTimeH + straightTimeV) * 3;
}

function markVisited(x: number, y: number) {
    let vh = getVisitedHouses();
    vh[x + "|" + y] = true;
    setVisitedHouses(vh);
    log("general", "Marked", x, y, "as visited");
}

function appendCurrentVisitPath(pv: string) {
    let cvpath = getCurrentVisitPath();
    if (!cvpath.endsWith(pv)) cvpath += pv;
    setCurrentVisitPath(cvpath);
}

type LootItem = { count: number; data: { name: string } };
type LootContainer = { [key: string]: LootItem };
type DataBase = {
    username: string;
    x: number;
    y: number;
    supplies: LootContainer;
};

type GameEventData = {
    state: "event";
    event_data: {
        visited: boolean;
        stage_data: {
            title: string;
            desc: string;
            visited: string; // desc for visited
            btns: { [key: string]: { text: string } };
        };
    };
};
type GameLootingData = {
    state: "looting";
    loot: {
        items: LootContainer;
    };
};
type GameTravelData = { state: "travel" };
type GameData = DataBase & (GameLootingData | GameTravelData | GameEventData);

(async () => {
    let reqres = await request("/default.aspx/GetAutoLog");
    gamedata = JSON.parse(reqres);
    log("general", "Game started.");
    //console.log(JSON.stringify(gamedata, null, "\t"));

    // @ts-ignore
    const $ = window.$;
    let conn = $.connection.logHub;
    let hub = $.connection.hub;
    // console.log(conn, hub);

    conn.client.getGameObject = (jsonv: GameData) => {
        try {
            // nxtdir = nxtdir === "nw" ? "se" : "nw";
            // send({ action: "setDir", dir: nxtdir, autowalk: false });
            log("sendrecv", "I< getGameObject:\n" + JSON.stringify(jsonv));

            Object.assign(gamedata.data, jsonv);
            let json = gamedata.data;

            log("gamestate", JSON.stringify(json));

            //process.stdout.write("\u001b[2J\u001b[0;0H")
            //process.stdout.write("\u001b[0;0H");

            if (json.state === "looting") {
                appendCurrentVisitPath("[looting] -> ");
                /*
          {
	"action": "loot_change",
	"option": "change",
	"changes": {
		...: {
			"count": add here,
			"data": {...
          */
                console.log("========== LOOT CHANGE =======");
                let loot = Object.entries(json.loot.items);
                let csupl = JSON.parse(JSON.stringify(json.supplies));
                log("detail", "FULL LOOT:", json.loot);
                log("detail", "CURRENT LOOT:", csupl);
                console.log("========== GOT =======");
                for (let [lname, lvalue] of loot) {
                    if (!csupl[lname]) {
                        console.log(
                            "+ NEW! " + lvalue.count + " " + lvalue.data.name,
                        );
                        csupl[lname] = lvalue;
                    } else {
                        console.log(
                            "+ " + lvalue.count + " " + lvalue.data.name,
                        );
                        csupl[lname].count += lvalue.count;
                    }
                }
                console.log("==========================");
                send({
                    action: "loot_change",
                    option: "change",
                    changes: csupl,
                });
                return;
            }

            if (json.state === "event") {
                markVisited(json.x, json.y);
                if (json.event_data.visited) {
                    log("general", "Got to location but it was visited");
                    send({ action: "event_choice", option: "__leave__" });
                    return;
                }
                // json.state = "";
                // return; //// !!!!!!!!!!!!!!!!!!!!!!!!

                // process.stdout.write("\u001b[2J\u001b[0;0H");
                let evd = json.event_data;
                // if(evd.visited) do something
                let sd = evd.stage_data;
                let code = "" + hashCode(sd.desc);
                let addedVisitPath = code + " -> ";
                appendCurrentVisitPath(addedVisitPath);
                let choices: { [key: string]: string } = {};
                Object.entries(sd.btns).forEach(([id, value]) => {
                    choices[value.text] = id;
                });
                console.log("=========EVENT==========");
                console.log("= Title:", sd.title);
                console.log("= Description:", sd.desc);
                console.log("= VisitedDescription:", sd.visited);
                console.log("= HashCode:", code);
                console.log("= VisitPath:", getCurrentVisitPath());
                console.log("= Choices:", choices);
                console.log("========================");

                log("detail", evd);
                let choice = eventChoices[getCurrentVisitPath()];
                if (!choice) {
                    console.log("Not sure what to do!");
                    process.exit(1);
                    throw "never";
                }
                let choiceID = choices[choice];
                if (!choiceID) {
                    console.log("Choice does not exist here");
                    process.exit(1);
                    throw "never";
                }

                console.log("Making choice", choiceID, " (", choice, ")");
                send({ action: "event_choice", option: choiceID });

                return;
            }
            setCurrentVisitPath("");

            let [px, py] = [json.x, json.y];
            searchForHouse(px, py);
            //gameBoard.print();
            process.stdout.write("\u001b[J");

            // console.log(json);

            let vh = getVisitedHouses();

            let houses = Object.entries(knownHouses).flatMap(([, house]) => {
                if (vh[house.x + "|" + house.y]) return [];
                return [
                    {
                        ...house,
                        dist: estimateTime(house.x, house.y, px, py),
                    },
                ];
            });
            houses = houses.sort((a, b) => a.dist - b.dist);
            log("detail", "nearest houses;", houses);
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
            console.log("Time remaining: " + target.dist + "s");
            send({ action: "setDir", dir: fdir, autowalk: false });
        } catch (e) {
            console.log(e);
            process.exit(1);
        }
    };
    conn.client.getGameObjectNoCountdown = (json: any) =>
        log("recvunknown", "ggonc", JSON.stringify(json));
    conn.client.raw = (js: any) =>
        log("recvunknown", "RAW", JSON.stringify(js));

    function send(
        msg:
            | { action: "setDir"; dir: string; autowalk: boolean }
            | { action: "event_choice"; option: string }
            | {
                  action: "loot_change";
                  option: "change";
                  changes: LootContainer;
              },
    ) {
        log("sendrecv", "i> \n" + JSON.stringify(msg));
        conn.server.fromClient(msg);
    }

    await new Promise(r => hub.start().done(r));

    send({ action: "setDir", dir: nxtdir, autowalk: false });
})();

setTimeout(() => process.exit(0), 1000 * 60 * 60); // every 1h
