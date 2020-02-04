const fs = require("fs");
const path = require("path");
const readline = require("readline");


((async () => {
	const rl = readline.createInterface({
		input: fs.createReadStream(path.join(__dirname, "./logs/gamestate.log")),
		console: false,
	});
	fs.unlinkSync(path.join(__dirname, "./logs/xpg.csv"));
	let outcsv = fs.createWriteStream(path.join(__dirname, "./logs/xpg.csv"));

	let lines = [];

	let i = 0;
	let log = 0;
	rl.on("line", (line) => {
		let lineStr = line;
		if(lineStr.startsWith("====")){
			i++

			log++
			if(log > 200 && lines.length){
				log = 0;

			let date = lines.shift();
			let text = lines.join("\n");

			let time = new Date(date).getTime();

			let xp = (JSON.parse(text.trim().split("`").join("")).skills.xp+","+(i+45698)+","+((i*1.5)+45698));

			if(xp){
				outcsv.write(time+","+xp+"\n");
					process.stdout.write("\r"+i+"/415038 : "+((new Date().getTime() - time)/1000/60/60).toFixed(2)+"h ago,"+xp+"xp");
				
			}

			}

			lines = [];
		}
		if(log > 199) lines.push(lineStr);
	});

}))()
