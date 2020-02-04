"use strict";
const fs = require("fs");

function makeBoard(fill) {
    // it would be useful if board could center at 0,0 and expand infinitely
    let board = [];
    let limits;
    let reso = {
        clear: () => {
            board = [];
	    limits = undefined;
        },
        get: (x, y) => {
            if (!limits)
                return fill;
            if (x < limits.xmin ||
                x > limits.xmax ||
                y < limits.ymin ||
                y > limits.ymax)
                return fill;
            if (!board[Number(y)])
                return fill;
            let bval = board[Number(y)][Number(x)];
            return bval === undefined ? fill : bval;
        },
        set: (x, y, v) => {
            if (!limits)
                limits = {
                    xmin: Number(x),
                    ymin: Number(y),
                    xmax: Number(x),
                    ymax: Number(y),
                };
            if (x < limits.xmin)
                limits.xmin = Number(x);
            if (y < limits.ymin)
                limits.ymin = Number(y);
            if (x > limits.xmax)
                limits.xmax = Number(x);
            if (y > limits.ymax)
                limits.ymax = Number(y);
            if (!board[Number(y)])
                board[Number(y)] = [];
            board[Number(y)][Number(x)] = v;
        },
        forEach: visitor => {
            if (!limits)
                return;
            let ym = limits.ymin;
            let yma = limits.ymax;
            let xm = limits.xmin;
            let xma = limits.xmax;
            for (let y = ym; y <= yma; y++) {
                for (let x = xm; x <= xma; x++) {
                    visitor(reso.get(x, y), x, y);
                }
            }
        },
        copy: () => {
            let nb = makeBoard(fill);
            reso.forEach((v, x, y) => nb.set(x, y, v));
            return nb;
        },
        print: (printer = v => v) => {
            // ratelimit print
            let resst = "";
            if (!limits)
                return ("*no board to print*");
            let ylength = 0;
            for (let y = limits.ymin - 1; y <= limits.ymax + 1; y++) {
                ylength = Math.max(y.toString().length, ylength);
            }
            resst += (" ".repeat(ylength) +
                " .-" +
                "-".repeat(limits.xmax - limits.xmin + 3) +
                "-.") + "\n";
            for (let y = limits.ymin - 1; y <= limits.ymax + 1; y++) {
                let line = "";
                for (let x = limits.xmin - 1; x <= limits.xmax + 1; x++) {
                    line += printer(reso.get(x, y), x, y);
                }
                resst += (y.toString().padStart(ylength, " ") + " | " + line + " |") + "\n";
            }
            resst += (" ".repeat(ylength) +
                " '-" +
                "-".repeat(limits.xmax - limits.xmin + 3) +
                "-'") + "\n";
	    return resst
        },
    };
    return reso;
}

module.exports = makeBoard;
