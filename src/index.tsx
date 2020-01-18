import * as fs from "fs";
import * as path from "path";
import * as util from "util";

import * as React from "react";
import { render, Box, useInput, Color } from "ink";

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

type Logfiles =
    | "general"
    | "gamestate"
    | "detail"
    | "sendrecv"
    | "recvunknown"
    | "unusualproximity";
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

function searchForHouse(sx: number, sy: number, searchRadius: number) {
    gameBoard.clear();
    let size = searchRadius;

    // spiral instead of this
    console.log("Searching...");
    let start = new Date().getTime();
    for (let x = sx - size; x <= sx + size; x++) {
        for (let y = sy - size; y <= sy + size; y++) {
            if (Math.abs(x) - 20000 + 10 > 0) continue;
            if (Math.abs(y) - 20000 + 10 > 0) continue;
            if (gameBoard.get(x, -y) !== "#") continue;
            let tile = generateWorldTile(x, y);
            gameBoard.set(x, -y, tile);
            if (tile === "H" || tile === "C") {
                knownHouses[x + "|" + y] = { x, y, tile };
            }
        }
    }
    let end = new Date().getTime();
    console.log("Completed search in " + (end - start) + "ms");
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

type EventChoices = { [key: string]: string | undefined };

let eventChoicesFile = path.join(__dirname, "eventchoices.loot.json");
function getEventChoices(): EventChoices {
    return JSON.parse(fs.readFileSync(eventChoicesFile, "utf-8") || "{}");
}
function setEventChoices(nec: EventChoices) {
    fs.writeFileSync(
        eventChoicesFile,
        JSON.stringify(nec, null, "\t"),
        "utf-8",
    );
}
let eventNoLootChoicesFile = path.join(__dirname, "eventchoices.noloot.json");
function getEventNoLootChoices(): EventChoices {
    return JSON.parse(fs.readFileSync(eventNoLootChoicesFile, "utf-8") || "{}");
}
function setEventNoLootChoices(nec: EventChoices) {
    fs.writeFileSync(
        eventNoLootChoicesFile,
        JSON.stringify(nec, null, "\t"),
        "utf-8",
    );
}

let nxtdir = "nw";

function ChoicePicker(props: {
    visitPath: string;
    choices: Buttons | { text: string }[];
    onSelect: (choice: string) => void;
}) {
    // https://github.com/vadimdemedes/ink-select-input
    let choiceList = Array.isArray(props.choices)
        ? props.choices.sort().map((it, i) => ["" + i, it] as const)
        : Object.entries(props.choices).sort((a, b) =>
              a[1].text > b[1].text ? 1 : a[1].text < b[1].text ? -1 : 0,
          );
    let [selection, setSelection] = React.useState(0);
    useInput((_input, key) => {
        if (key.return) {
            props.onSelect(choiceList[selection][1].text);
        }
        if (key.downArrow) {
            setSelection(Math.min(selection + 1, choiceList.length - 1));
        }
        if (key.upArrow) {
            setSelection(Math.max(selection - 1, 0));
        }
    });
    return (
        <Box flexDirection="column">
            <Box>Path: {props.visitPath}</Box>
            {choiceList.map(([id, value], index) => {
                let sel = index === selection;
                return (
                    <Color white={!sel} whiteBright={sel} key={id}>
                        {sel ? "> " : "  "}
                        {value.text}
                    </Color>
                );
            })}
        </Box>
    );
}

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
    skills: {
        sp: number;
        level: number;
        next_level_xp: number;
        hp: number;
        max_hp: number;
        max_sp: number;
        dmg: number;
        max_carry: number;
        carry: number;
        skill_points: number;
        xp: number;
    };
    craft_queue?: { [key: string]: { item_id: string; remaining: number } };
    proximity?: { objs: { char: string; x: number; y: number }[] };
};
type Buttons = { [key: string]: { text: string } };

type GameEventData = {
    state: "event";
    event_data: {
        visited: boolean;
        stage_data: {
            title: string;
            desc: string;
            visited: string; // desc for visited
            btns: Buttons;
        };
    };
};
type GameLootingData = {
    state: "looting";
    loot: {
        items: LootContainer;
        title: string;
        desc: string;
        visitdesc: string;
        visited: boolean;
    };
};
type GameTravelData = { state: "travel" };
type GameData = DataBase &
    (GameLootingData | GameTravelData | GameEventData | { state: "???" });

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

    let eventIgnore = false;
    let afkWalkDir: "n" | "s" | "nw" | undefined = undefined;

    let searchRadius = 100;

    conn.client.getGameObject = async (jsonv: GameData) => {
        if (eventIgnore) {
            return;
        }
        process.stdout.write("\u001b[2J\u001b[0;0H");
        try {
            // nxtdir = nxtdir === "nw" ? "se" : "nw";
            // send({ action: "setDir", dir: nxtdir, autowalk: false });
            log("sendrecv", "I< getGameObject:\n" + JSON.stringify(jsonv));

            let skilldata = { ...gamedata.data.skills };
            gamedata.data = { ...gamedata.data, ...jsonv };
            if (jsonv.skills)
                gamedata.data.skills = { ...skilldata, ...jsonv.skills };
            gamedata.data.proximity = jsonv.proximity;
            let json = gamedata.data;

            log("gamestate", JSON.stringify(json, null, "    "));

            let shouldAttemptLoot =
                json.skills.max_carry - json.skills.carry >= 25;

            console.log(
                `TheTravelers Bot
----------------
Username: ${json.username}
Current Location: ${json.x} x, ${json.y} y
Game State: ${json.state}
Level: ${json.skills.level}
Next Level XP: ${json.skills.xp}/${json.skills.next_level_xp} (${(
                    json.skills.xp / 634000
                ).toLocaleString("en-US", {
                    style: "percent",
                    minimumFractionDigits: 2,
                })}) (next level in ~${(json.skills.next_level_xp -
                    json.skills.xp) *
                    3}s) (lv100 in ~${(634000 - json.skills.xp) *
                    3}s) (current xp is estimated)
Skill Points: ${json.skills.skill_points}
Carry: ${json.skills.carry}/${json.skills.max_carry} (${(
                    json.skills.carry / json.skills.max_carry
                ).toLocaleString("en-US", {
                    style: "percent",
                    minimumFractionDigits: 2,
                })})
Crafting: ${util.inspect(json.craft_queue, false, null, true)}
Stamina: ${json.skills.sp}
Looting: ${shouldAttemptLoot}
Search Radius: ${searchRadius}
----------------`,
            );

            if (json.proximity) {
                let unusual = json.proximity.objs.some(
                    p => p.char !== "H" && p.char !== "C",
                );
                if (unusual) {
                    log("unusualproximity", json.proximity);
                }
            }

            if (json.skills.skill_points > 0) {
                send({
                    action: "skill_upgrade",
                    carry: 1,
                    dmg: 0,
                    hp: 0,
                    sp: 0,
                });
            }

            //process.stdout.write("\u001b[2J\u001b[0;0H")
            //process.stdout.write("\u001b[0;0H");

            if (json.state === "looting") {
                appendCurrentVisitPath(
                    "[" +
                        hashCode(json.loot.title + " " + json.loot.desc) +
                        "] -> ",
                );
                let exptActions = getEventChoices();
                let choice = exptActions[getCurrentVisitPath()];
                console.log("=== LOOT ===");
                console.log(json.loot);
                let loot = Object.entries(json.loot.items);
                let csupl = JSON.parse(
                    JSON.stringify(json.supplies),
                ) as LootContainer;
                log("detail", "FULL LOOT:", json.loot);
                log("detail", "CURRENT LOOT:", csupl);
                if (!choice) {
                    console.log("========== Not sure what to do =======");
                    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                    choice = "loot";
                    /*
                    eventIgnore = true;
                    let waiting: ((choice: string) => unknown)[] = [];
                    let app = render(
                        <ChoicePicker
                            visitPath={getCurrentVisitPath()}
                            choices={[{ text: "loot" }, { text: "leave" }]}
                            onSelect={choice => {
                                eventIgnore = false;
                                waiting.forEach(w => w(choice));
                            }}
                        />,
                    );
                    choice = await new Promise<string>(r =>
                        waiting.push(v => r(v)),
                    );
                    app.unmount();
                    */
                    exptActions[getCurrentVisitPath()] = choice;
                    setEventChoices(exptActions);
                }
                if (choice === "loot") {
                    console.log("========== LOOT CHANGE =======");
                    for (let [lname, lvalue] of loot) {
                        if (!csupl[lname]) {
                            console.log(
                                "+ NEW! " +
                                    lvalue.count +
                                    " " +
                                    lvalue.data.name,
                            );
                            csupl[lname] = lvalue;
                        } else {
                            console.log(
                                "+ " + lvalue.count + " " + lvalue.data.name,
                            );
                            csupl[lname].count += lvalue.count;
                        }
                    }
                    console.log("========== DROPPING UNNEEDED ITEMS =======");
                    for (let [lname, lvalue] of Object.entries(csupl)) {
                        if (
                            [
                                "bp_metal_detector",
                                "keycard_a",
                                "shovel",
                                "shovel_head",
                                "rusty_knife",
                            ].indexOf(lname) > -1
                        ) {
                            if (csupl[lname].count > 1) {
                                csupl[lname].count = 1;
                                console.log(
                                    "Dropping down to " +
                                        lvalue.count +
                                        " " +
                                        lname,
                                );
                            }
                        }
                    }
                } else if (choice === "leave") {
                    send({ action: "loot_change", option: "leave" });
                    return;
                } else {
                    console.log(
                        "========== Invalid Choice: " + choice + " =======",
                    );
                    process.exit(0);
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
                searchRadius = 100;
                markVisited(json.x, json.y);
                if (json.event_data.visited) {
                    log("general", "Got to location but it was visited");
                    send({ action: "event_choice", option: "__leave__" });
                    return;
                }
                json.skills.xp += 15;
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
                let visitPath = getCurrentVisitPath();
                console.log("=========EVENT==========");
                console.log("= Title:", sd.title);
                console.log("= Description:", sd.desc);
                console.log("= VisitedDescription:", sd.visited);
                console.log("= HashCode:", code);
                console.log("= VisitPath:", visitPath);
                console.log("= Choices:", choices);
                console.log("========================");

                log("detail", evd);
                let choicemaker = getEventChoices();
                let choice = choicemaker[visitPath];
                if (!shouldAttemptLoot) {
                    let noloot = getEventNoLootChoices();
                    if (noloot[visitPath]) {
                        choice = noloot[visitPath];
                        console.log("Taking no loot path");
                    } else {
                        console.log("No no-looting path available");
                    }
                }
                if (!choice) {
                    console.log("Not sure what to do!");
                    eventIgnore = true;
                    let waiting: ((choice: string) => unknown)[] = [];
                    let app = render(
                        <ChoicePicker
                            visitPath={getCurrentVisitPath()}
                            choices={sd.btns}
                            onSelect={choice => {
                                eventIgnore = false;
                                waiting.forEach(w => w(choice));
                            }}
                        />,
                    );
                    choice = await new Promise<string>(r =>
                        waiting.push(v => r(v)),
                    );
                    app.unmount();
                    choicemaker[getCurrentVisitPath()] = choice;
                    setEventChoices(choicemaker);
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
            if (json.state === "travel") {
                setCurrentVisitPath("");

                if (!shouldAttemptLoot && (false as true)) {
                    if (afkWalkDir) afkWalkDir = afkWalkDir === "n" ? "s" : "n";
                    if (!afkWalkDir) afkWalkDir = "nw";
                    console.log(
                        "Almost out of carry space. AFK walking: " + afkWalkDir,
                    );
                    send({
                        action: "setDir",
                        dir: afkWalkDir,
                        autowalk: false,
                    });
                    json.skills.xp++;
                    return;
                }
                if (afkWalkDir) afkWalkDir = undefined;

                let [px, py] = [json.x, json.y];
                searchForHouse(px, py, searchRadius);
                //gameBoard.print();
                process.stdout.write("\u001b[J");

                // console.log(json);

                let houses = Object.entries(knownHouses).map(([, house]) => ({
                    ...house,
                    dist: estimateTime(house.x, house.y, px, py),
                }));
                let vh = getVisitedHouses();
                houses = houses.filter(h => !vh[h.x + "|" + h.y]);
                houses = houses.sort((a, b) => a.dist - b.dist);

                log("detail", "nearest houses;", houses);
                if (!houses[0]) {
                    console.log("no houses");
                    send({
                        action: "setDir",
                        dir: "nw",
                        autowalk: false,
                    });
                    searchRadius *= 2;
                    return;
                }
                let target = houses[0];
                if (target.dist === 0) {
                    console.log("standing on house. moving off.");
                    send({
                        action: "setDir",
                        dir: "nw",
                        autowalk: false,
                    });
                    return;
                }
                searchRadius = 100;
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
                json.skills.xp++;
                if (Math.abs(dx) + Math.abs(dy) > 2 && json.skills.sp > 10) {
                    console.log("doublestep available");
                    send({ action: "doublestep", option: "add" });
                }
                return;
            }
            console.log("Uh oh! State is " + json.state);
            throw process.exit(1);
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
              }
            | { action: "loot_change"; option: "leave" }
            | { action: "doublestep"; option: "add" }
            | {
                  action: "skill_upgrade";
                  carry: number;
                  dmg: number;
                  hp: number;
                  sp: number;
              },
    ) {
        log("sendrecv", "i> \n" + JSON.stringify(msg));
        console.log("(sent)");
        conn.server.fromClient(msg);
    }

    await new Promise(r => hub.start().done(r));

    send({ action: "setDir", dir: nxtdir, autowalk: false });
})();

setTimeout(() => process.exit(0), 1000 * 60 * 60); // every 1h
