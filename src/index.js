//const signalR = require("./signalr-client/signalR");
//const fetch = require("node-fetch");
//const signalR = require("@aspnet/signalr");
const {JSDOM, CookieJar} = require("jsdom");
const {Cookie} = require("tough-cookie");
const cookieJar = new CookieJar();

const header = Cookie.parse("T=pz8P3+S6fK1sbHehMjnLRw==; darkmode=false; hover=true; autowalkpast=true; autowalkpasttime=29; notifAny=true; notifTraveler=false; notifCity=true; notifHouse=true; notifLevelup=false; supplyView=icon; __cfduid=dd8d66499b46ddffdd9c961d331521ae31578549703");

cookieJar.setCookie(header, "https://thetravelers.online/", (...a) => console.log(...a));

console.log(cookieJar);
let {window: gwindow} = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>i`, {
	url: "https://thetravelers.online/",
	cookieJar
});
global.window = gwindow;
Object.assign(global.window, {
JSON, encodeURIComponent, decodeURIComponent
});

//console.log(Object.keys(global.window).sort().join(", "));

const jQuery = require("jquery");
window.jQuery = jQuery;
window.$ = jQuery;
const signalr = require("signalr");

const hubs = require("../data/hubs"); // or fetch and eval but that seems scary


let cookietext = `T=pz8P3+S6fK1sbHehMjnLRw==; darkmode=false; hover=true; autowalkpast=true; autowalkpasttime=29; notifAny=true; notifTraveler=false; notifCity=true; notifHouse=true; notifLevelup=false; supplyView=icon; __cfduid=dd8d66499b46ddffdd9c961d331521ae31578549703`;


async function request(url, args = {}){

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
		}

	});



let fetcher = await window.fetch("https://thetravelers.online" + url, {

	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"Cookie": cookietext,
	},
	body: JSON.stringify(args),

});

	return await fetcher.json();

}



let gamedata;

((async () => { 
	let reqres = await request("/default.aspx/GetAutoLog");
	gamedata = JSON.parse(reqres);
	console.log("Game started.");
	//console.log(JSON.stringify(gamedata, null, "\t"));

	const $ = window.$;
	let conn = $.connection.logHub;
	let hub = $.connection.hub;
//console.log(conn, hub);

	conn.client.getGameObject = (json) => console.log("getgameobject", json);
	conn.client.getGameObjectNoCountdown = (json) => console.log("ggonc", json);
	conn.client.raw = (js) => console.log("RAW", js);

	function send(msg){
		console.log("SEND", JSON.stringify(msg));
		conn.server.fromClient(msg);
	}

	await new Promise(r => hub.start().done(r));

	send({action: "setDir", dir: "nw", autowalk: true});

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


}))()
