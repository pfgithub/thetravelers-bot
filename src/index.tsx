import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as humanizeDuration from "humanize-duration";

if (!process.argv[2]) throw new Error("Account not provided.");
let basedir = path.join(__dirname, "../accounts/", process.argv[2]);

import * as React from "react";
import { render, Box, useInput, Color, Text } from "ink";

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
    fs.readFileSync(path.join(basedir, "data/cookie.txt"), "utf-8"),
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
    return fs.readFileSync(path.join(basedir, "data/currentvisit"), "utf-8");
}
function setCurrentVisitPath(newPath: string) {
    fs.writeFileSync(path.join(basedir, "data/currentvisit"), newPath, "utf-8");
}

type HouseVisitState =
    | "cannot_reach"
    | "visited"
    | "looted"
    | "unavailable"
    | true;

function getVisitedHouses() {
    return JSON.parse(
        fs.readFileSync(
            path.join(basedir, "data/visitedhouses.json"),
            "utf-8",
        ) || "{}",
    ) as { [key: string]: HouseVisitState };
}
function setVisitedHouses(nvh: { [key: string]: HouseVisitState }) {
    fs.writeFileSync(
        path.join(basedir, "data/visitedhouses.json"),
        JSON.stringify(nvh, null, "\t"),
        "utf-8",
    );
}

type Logfiles =
    | "general"
    | "detail"
    | "sendrecv"
    | "recvunknown"
    | "unusualproximity"
    | "xperror"
    | "exejs"
    | "loginjson"
    | "gainxp";
function log(logfile: Logfiles, ...message: any[]) {
    fs.appendFileSync(
        path.join(basedir, "logs", logfile + ".log"),
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
    // console.log("Searching...");
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
    gameBoard.set(sx, -sy, "&");
    // console.log("Completed search in " + (end - start) + "ms");
}

let gamedata: { data: GameData };

// function dist(ax: number, ay: number, bx: number, by: number) {
//     return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
// }

function hashCode(str: string) {
    var hash = 0,
        i,
        chr;
    if (str.length === 0) return "" + hash;
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
type EventMap = {
    [key: string]: {
        views: number;
        type: string;
        data: any;
        options: string[];
        visits: { [key: string]: string[] }; // button name -> map key
        loot?: { [key: string]: number };
        latestView: number;
    };
};

let eventMapFile = path.join(__dirname, "eventmap.json");
function getEventMap(): EventMap {
    return JSON.parse(fs.readFileSync(eventMapFile, "utf-8") || "{}");
}
function setEventMap(nec: EventMap) {
    fs.writeFileSync(eventMapFile, JSON.stringify(nec, null, "\t"), "utf-8");
}

let prevLocationHash: string | undefined = undefined;
let prevChoice: string | undefined = undefined;
function saveDirection(
    currentLocationHash: string,
    choiceName: string,
    type: string,
    data: any,
    options: string[],
    loot: { id: string; name: string; count: number }[],
) {
    let evmap = getEventMap();
    if (prevLocationHash !== undefined) {
        if (!evmap[prevLocationHash].visits[prevChoice!])
            evmap[prevLocationHash].visits[prevChoice!] = [];
        let clist = evmap[prevLocationHash].visits[prevChoice!];
        if (clist.indexOf(currentLocationHash) === -1)
            clist.push(currentLocationHash);
    }
    if (!evmap[currentLocationHash]) {
        evmap[currentLocationHash] = {
            views: 1,
            type,
            data,
            options,
            visits: {},
            latestView: new Date().getTime(),
        };
    } else {
        let ev = evmap[currentLocationHash];
        if (!ev.views) ev.views = 0;
        ev.type = type;
        ev.views += 1;
        ev.data = data;
        ev.options = options;
        ev.latestView = new Date().getTime();
    }
    let ev = evmap[currentLocationHash];
    let lootJStr = JSON.stringify(loot);

    if (!ev.loot) ev.loot = {};
    if (ev.loot[lootJStr]) ev.loot[lootJStr] += 1;
    else ev.loot[lootJStr] = 1;

    prevLocationHash = currentLocationHash;
    prevChoice = choiceName;
    setEventMap(evmap);
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
    return diagonalTime + straightTimeH + straightTimeV;
}

function markVisited(x: number, y: number, visitReason: HouseVisitState) {
    let vh = getVisitedHouses();
    vh[x + "|" + y] = visitReason;
    setVisitedHouses(vh);
    log("general", "Marked", x, y, "as visited with reason " + visitReason);
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
    exe_js?: string;
    gained_xp?: number;
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
type Buttons = {
    [key: string]: {
        text: string;
        req_met?: boolean;
        req_is_now_locked?: boolean;
    };
};

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
type GameIntData = {
    state: "int";
};
type GameTravelData = { state: "travel" };
type GameData = DataBase &
    (
        | GameLootingData
        | GameTravelData
        | GameEventData
        | { state: "???" }
        | GameIntData
    );

(async () => {
    let reqres = await request("/default.aspx/GetAutoLog");
    gamedata = JSON.parse(reqres);
    log("general", "Game started.");
    //console.log(JSON.stringify(gamedata, null, "\t"));
    log("loginjson", JSON.stringify(gamedata, null, "\t"));

    // @ts-ignore
    const $ = window.$;
    let conn = $.connection.logHub;
    let hub = $.connection.hub;
    // console.log(conn, hub);

    let eventIgnore = false;
    let afkWalkDir: "n" | "s" | "nw" | undefined = undefined;

    let searchRadius = 100;
    let shouldAttemptLoot: boolean = true;
    let timeSinceLevelStart = 0;

    let xpEstimate = gamedata.data.skills.xp;
    let lastXpUpdate = new Date().getTime();

    let plusoneEstimate = gamedata.data.skills.xp;

    let logdata: (string | React.ReactElement<unknown>)[] = [];
    let renderInfo = () => {
        // return <Box></Box>;
        let json = gamedata.data;
        // ((m,l=m-1) => Math.ceil((2 * Math.pow(l, 2.75)) + (20 * l) + 20) * 3)(100)
        let xpfl = (m: number, l = m - 2) =>
            Math.ceil(2 * Math.pow(l, 2.75) + 20 * l + 20) * 3;
        // xp.js getNextLevelXP: function(l)
        let xpGoalNumbers = [100, 200, 300, 400];
        let xpGoalLvls = xpGoalNumbers.map(xpgn => xpfl(xpgn));
        let xpGoalI = xpGoalLvls.findIndex(m => m > xpEstimate);
        let xpGoal = xpGoalLvls[xpGoalI];
        let xpGoalLvl = xpGoalNumbers[xpGoalI];
        let lv100sec = (xpGoal - xpEstimate) * 1;
        let lv100sec15 = Math.round((xpGoal - xpEstimate) * 1 * (1 / 1.5)); // 1.5xp/3s, linear estimate counting xp given from visiting houses and cities
        return (
            <Box flexDirection="column">
                <Box>
                    {"\u001b[2J\u001b[0;0H"}
                    <Text bold={true}>TheTravelers Bot</Text>
                </Box>
                <Box>======================</Box>
                <Box>
                    <Color blueBright>Username:</Color> {json.username}
                </Box>
                <Box>
                    <Color blueBright>Current Location:</Color> {json.x} x,{" "}
                    {json.y} y
                </Box>
                <Box>
                    <Color blueBright>Game State:</Color> {json.state}
                </Box>
                <Box>
                    <Color blueBright>Level:</Color> {json.skills.level + 1}{" "}
                    (raw: {json.skills.level})
                </Box>
                <Box>
                    <Color blueBright>Next Level XP:</Color> {xpEstimate}/
                    {json.skills.next_level_xp} (next level in ~
                    {humanizeDuration(
                        (json.skills.next_level_xp -
                            xpEstimate -
                            timeSinceLevelStart) *
                            1000,
                    )}
                    ) (current xp is estimated)
                </Box>
                <Box>
                    <Color blueBright>Skill Points:</Color>{" "}
                    {json.skills.skill_points}
                </Box>
                <Box>
                    <Color blueBright>Carry:</Color> {json.skills.carry}/
                    {json.skills.max_carry}
                </Box>
                <Box>
                    <Color blueBright>Crafting:</Color>{" "}
                    {util.inspect(json.craft_queue, false, null, true)}
                </Box>
                <Box>
                    <Color blueBright>Stamina:</Color> {json.skills.sp}
                </Box>
                <Box>
                    <Color blueBright>Looting:</Color>{" "}
                    {util.format(shouldAttemptLoot, false, null, true)}
                </Box>
                <Box>
                    <Color blueBright>Search Radius:</Color> {searchRadius}
                </Box>
                <Box>
                    <Color blueBright>Level {xpGoalLvl}: (1xp/s)</Color>{" "}
                    {humanizeDuration((lv100sec - timeSinceLevelStart) * 1000)}{" "}
                    (
                    {(xpEstimate / xpGoal).toLocaleString("en-US", {
                        style: "percent",
                        minimumFractionDigits: 2,
                    })}
                    )
                </Box>
                <Box>
                    <Color blueBright>Level {xpGoalLvl} (1.5xp/s):</Color>{" "}
                    {humanizeDuration(
                        (lv100sec15 - timeSinceLevelStart) * 1000,
                    )}{" "}
                    (
                    {(xpEstimate / xpGoal).toLocaleString("en-US", {
                        style: "percent",
                        minimumFractionDigits: 2,
                    })}
                    )
                </Box>
                <Box>
                    <Color blueBright>Real XP:</Color> {json.skills.xp} (Last
                    updated:{" "}
                    {humanizeDuration(lastXpUpdate - new Date().getTime())} ago)
                </Box>
                <Box>
                    <Color blueBright>Time since level start:</Color>{" "}
                    {timeSinceLevelStart}
                </Box>
                <Box>======================</Box>
                <Box marginLeft={2} flexDirection="column">
                    {logdata.map(ld => (
                        <Box>
                            {typeof ld === "string"
                                ? ld.replace(/{{Seconds\|(.+?)}}/g, (_, a) =>
                                      humanizeDuration(
                                          (+a - timeSinceLevelStart) * 1000,
                                      ),
                                  )
                                : ld}
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    };

    let rend = render(renderInfo());

    function rerender() {
        rend.rerender(renderInfo());
    }

    function startCountdown() {}

    let printlog = (...message: any[]) => {
        logdata.push(
            message
                .map(msg =>
                    typeof msg === "string"
                        ? msg
                        : util.inspect(msg, false, null, true),
                )
                .join(" "),
        );
        rerender(); // nextTick()?
    };

    let printComponent = (component: React.ReactElement<unknown>) => {
        logdata.push(component);
        rerender();
        return () => {
            logdata = logdata.filter(v => v !== component);
            rerender();
        };
    };

    let lastXY = "";
    let currentXY = "";
    let walkOnly = false;
    let walkFailedCount = 0;

    let metalDetectorPing:
        | { x: number; y: number; stage: "equip" | "dig" | "reset" }
        | undefined;

    conn.client.getGameObject = async (jsonv: GameData) => {
        if (eventIgnore) {
            return;
        }
        // process.stdout.write("\u001b[2J\u001b[0;0H");
        try {
            // nxtdir = nxtdir === "nw" ? "se" : "nw";
            // send({ action: "setDir", dir: nxtdir, autowalk: false });
            log("sendrecv", "I< getGameObject:\n" + JSON.stringify(jsonv));

            let skilldata = { ...gamedata.data.skills };
            gamedata.data = { ...gamedata.data, ...jsonv };
            if (jsonv.skills)
                gamedata.data.skills = { ...skilldata, ...jsonv.skills };
            if (jsonv.exe_js) {
                let js = jsonv.exe_js;
                let rgxresult = /detector pings. \((.+?), (.+?)\)/.exec(js);
                if (rgxresult) {
                    let [x, y] = [+rgxresult[1], +rgxresult[2]];
                    metalDetectorPing = { x, y, stage: "equip" };
                } else {
                    log("exejs", "I< exeJS:\n" + jsonv.exe_js);
                }
            }
            if (jsonv.gained_xp) {
                log("gainxp", "" + jsonv.gained_xp);
            }
            plusoneEstimate++;
            if (jsonv.skills && jsonv.skills.xp) {
                log(
                    "xperror",
                    "actual: ",
                    jsonv.skills.xp,
                    "expected: ",
                    xpEstimate,
                );
                fs.appendFileSync(
                    path.join(basedir, "logs/xp.csv"),
                    new Date().getTime() +
                        "," +
                        jsonv.skills.xp +
                        "," +
                        xpEstimate +
                        "," +
                        plusoneEstimate +
                        "\n",
                    "utf-8",
                );
                xpEstimate = jsonv.skills.xp;
                lastXpUpdate = new Date().getTime();
            }
            gamedata.data.proximity = jsonv.proximity;
            let json = gamedata.data;
            lastXY = currentXY;
            currentXY = json.x + "|" + json.y;

            shouldAttemptLoot = json.skills.max_carry - json.skills.carry >= 25;

            logdata = [];
            timeSinceLevelStart = 0;
            startCountdown();
            rerender();

            if (json.proximity && json.proximity.objs) {
                let unusual = json.proximity.objs.some(
                    p => p.char !== "H" && p.char !== "C" && p.char !== "o",
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
                let loothash = hashCode(json.loot.title + " " + json.loot.desc);
                appendCurrentVisitPath("[" + loothash + "] -> ");
                let exptActions = getEventChoices();
                let choice = exptActions[getCurrentVisitPath()];
                printlog("=== LOOT ===");
                printlog(json.loot);
                let loot = Object.entries(json.loot.items);
                let csupl = JSON.parse(
                    JSON.stringify(json.supplies),
                ) as LootContainer;
                log("detail", "FULL LOOT:", json.loot);
                log("detail", "CURRENT LOOT:", csupl);
                if (!choice) {
                    printlog("========== Not sure what to do =======");
                    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                    //choice = "loot";

                    eventIgnore = true;
                    let waiting: ((choice: string) => unknown)[] = [];
                    let appunmount = printComponent(
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
                    appunmount();

                    exptActions[getCurrentVisitPath()] = choice;
                    setEventChoices(exptActions);
                }
                saveDirection(
                    loothash,
                    choice,
                    "loot",
                    json.loot,
                    ["loot", "leave"],
                    loot.map(([lname, lvalue]) => ({
                        id: lname,
                        name: lvalue.data.name,
                        count: lvalue.count,
                    })),
                );
                if (choice === "loot") {
                    printlog("========== LOOT CHANGE =======");
                    for (let [lname, lvalue] of loot) {
                        if (!csupl[lname]) {
                            printlog("+ NEW! " + lvalue.count + " " + lname);
                        } else {
                            printlog("+ " + lvalue.count + " " + lname);
                        }
                        send({
                            action: "loot_exchange",
                            which: true,
                            item: lname,
                            amount: lvalue.count,
                        });
                    }
                    printlog("========== DROPPING UNNEEDED ITEMS =======");
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
                                printlog(
                                    "Dropping down to " +
                                        lvalue.count +
                                        " " +
                                        lname,
                                );
                                send({
                                    action: "loot_exchange",
                                    which: false,
                                    item: lname,
                                    amount: lvalue.count,
                                });
                            }
                        }
                    }
                } else if (choice === "leave") {
                    //send({ action: "loot_change", option: "leave" });
                    send({ action: "loot_next" });
                    return;
                } else {
                    printlog("Error!");
                    printlog(
                        "========== Invalid Choice: " + choice + " =======",
                    );
                    printlog("Error!");
                    process.exit(1);
                }
                printlog("==========================");
                send({ action: "loot_next" });
                return;
            }

            if (json.state === "event") {
                searchRadius = 100;
                markVisited(
                    json.x,
                    json.y,
                    shouldAttemptLoot ? "looted" : "visited",
                );
                // if (json.event_data.visited) {
                //     log("general", "Got to location but it was visited");
                //     send({ action: "event_choice", option: "__leave__" });
                //     return;
                // }
                if (!json.event_data.visited) {
                    xpEstimate += 15;
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
                let visitPath = getCurrentVisitPath();
                printlog("=========EVENT==========");
                printlog("= Title:", sd.title);
                printlog("= Description:", sd.desc);
                printlog("= VisitedDescription:", sd.visited);
                printlog("= HashCode:", code);
                printlog("= VisitPath:", visitPath);
                printlog("= Choices:", sd.btns);
                printlog("========================");

                log("detail", evd);
                let choicemaker = getEventChoices();
                let choice = choicemaker[visitPath];
                if (!shouldAttemptLoot) {
                    let noloot = getEventNoLootChoices();
                    if (noloot[visitPath]) {
                        choice = noloot[visitPath];
                        printlog("Taking no loot path");
                    } else {
                        printlog("No no-looting path available");
                    }
                }
                if (!choice) {
                    printlog("Not sure what to do!");
                    eventIgnore = true;
                    let waiting: ((choice: string) => unknown)[] = [];
                    let appunmount = printComponent(
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
                    appunmount();
                    choicemaker[getCurrentVisitPath()] = choice;
                    setEventChoices(choicemaker);
                }
                let choiceID = choices[choice];
                if (choice == "__leave__") choiceID = choice;
                if (!choiceID) {
                    if (choices["leave"]) choiceID = choices["leave"];
                    else if (choices["exit event"])
                        choiceID = choices["exit event"];
                    else {
                        printlog("Error!");
                        printlog("Choice does not exist here");
                        printlog("Error!");
                        process.exit(1);
                    }
                }
                if (
                    sd.btns[choiceID].req_met === false ||
                    sd.btns[choiceID].req_is_now_locked === true
                ) {
                    appendCurrentVisitPath("lockedout");
                }

                printlog("Making choice", choiceID, " (", choice, ")");
                saveDirection(
                    code,
                    choice,
                    "event",
                    json.event_data,
                    Object.keys(choices),
                    [],
                );
                send({ action: "event_choice", option: choiceID });

                return;
            }
            if (json.state === "travel") {
                setCurrentVisitPath("");
                saveDirection("travel", "travel", "travel", {}, ["travel"], []);
                xpEstimate++;

                if (
                    metalDetectorPing &&
                    metalDetectorPing.x === json.x &&
                    metalDetectorPing.y === json.y
                ) {
                    printlog("metal detector");
                    send({ action: "equipment", option: "dig_with_shovel" });
                    metalDetectorPing = undefined;
                }
                send({ action: "equipment", option: "find_all" });

                /*if (lastXY === currentXY || walkOnly) {
                    printlog("Went nowhere. In walkOnly mode");
                    walkOnly = true;
                    if (afkWalkDir) afkWalkDir = afkWalkDir === "n" ? "s" : "n";
                    if (!afkWalkDir) afkWalkDir = "nw";
                    printlog("AFK walking: " + afkWalkDir);
                    send({
                        action: "setDir",
                        dir: afkWalkDir,
                        autowalk: false,
                    });
                    return;
                }*/
                if (afkWalkDir) afkWalkDir = undefined;

                let [px, py] = [json.x, json.y];
                printlog("Search started...");
                let startTime = new Date().getTime();
                searchForHouse(px, py, searchRadius);
                searchForHouse(px, py, 20);
                fs.writeFileSync(
                    path.join(basedir, "logs/map.txt"),
                    gameBoard.print((c: string) => c + " "),
                    "utf-8",
                );
                printlog(
                    "Search completed in " +
                        humanizeDuration(new Date().getTime() - startTime),
                );
                //gameBoard.print();
                process.stdout.write("\u001b[J");

                // printlog(json);

                let houses = Object.entries(knownHouses).map(([, house]) => ({
                    ...house,
                    dist: estimateTime(house.x, house.y, px, py),
                }));
                let vh = getVisitedHouses();
                houses = houses.filter(h => {
                    let visitState = vh[h.x + "|" + h.y];
                    if (!shouldAttemptLoot) return !visitState;
                    return !visitState || visitState === "visited";
                });
                houses = houses.sort((a, b) => a.dist - b.dist);

                log("detail", "nearest houses;", houses);
                if (!houses[0]) {
                    printlog("no houses");
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
                    markVisited(json.x, json.y, "unavailable");
                    printlog("standing on house. moving off.");
                    send({
                        action: "setDir",
                        dir: "nw",
                        autowalk: false,
                    });
                    return;
                }
                searchRadius = 100;

                if (lastXY === currentXY) {
                    walkFailedCount++;
                }
                if (walkFailedCount > 2) {
                    walkFailedCount = 0;
                    log(
                        "general",
                        "Walk failed more than 3 times, marking as unreachable",
                    );
                    markVisited(target.x, target.y, "cannot_reach");
                    printlog(
                        "Could not reach " +
                            target.x +
                            ", " +
                            target.y +
                            ". Marking as visited.",
                    );
                }

                //if(!target) target = houses[0];
                let [tx, ty] = [target.x, target.y];
                let [dx, dy] = [tx - px, ty - py];
                let [sx, sy] = [dx, dy].map(n => Math.sign(n));
                let dirns = sy === 1 ? "n" : sy === -1 ? "s" : "";
                let direw = sx === 1 ? "e" : sx === -1 ? "w" : "";
                let fdir = dirns + direw;
                printlog("Walking", fdir, "to", target);
                printlog("Time remaining: {{Seconds|" + target.dist + "}}");
                send({ action: "setDir", dir: fdir, autowalk: false });
                if (Math.abs(dx) + Math.abs(dy) > 2 && json.skills.sp > 10) {
                    printlog("doublestep available");
                    send({ action: "doublestep", option: "add" });
                }
                return;
            }
            if (json.state === "int") {
                printlog("in int");
                send({ action: "leave_int" });
                return;
            }
            printlog("Error!");
            printlog("Uh oh! State is " + json.state);
            printlog("Error!");
            throw process.exit(1);
        } catch (e) {
            printlog("Error!");
            printlog(e);
            printlog("Error!");
            process.exit(1);
        }
    };
    conn.client.getGameObjectNoCountdown = (json: any) => {
        if (json.loot_change) return;
        log("recvunknown", "ggonc", JSON.stringify(json));
    };
    conn.client.raw = (js: any) =>
        log("recvunknown", ".RAW", JSON.stringify(js));

    function send(
        msg:
            | { action: "setDir"; dir: string; autowalk: boolean }
            | { action: "event_choice"; option: string }
            | {
                  action: "loot_exchange";
                  which: true | false;
                  item: string;
                  amount: number;
              }
            //| { action: "loot_change"; option: "leave" }
            | { action: "loot_next" }
            | { action: "doublestep"; option: "add" }
            | {
                  action: "skill_upgrade";
                  carry: number;
                  dmg: number;
                  hp: number;
                  sp: number;
              }
            | {
                  action: "equipment";
                  option: "find_all" | "dig" | "dig_with_shovel";
              }
            | { action: "equip"; item: "metal_detector" | "shovel" }
            | { action: "leave_int" },
    ) {
        log("sendrecv", "i> \n" + JSON.stringify(msg));
        printlog("(sent)");
        conn.server.fromClient(msg);
    }

    await new Promise(r => hub.start().done(r));

    // send({ action: "setDir", dir: nxtdir, autowalk: false });

    send({
        action: "equip",
        item: "metal_detector",
    });
})();

setTimeout(() => process.exit(0), 1000 * 60 * 60); // every 1h
