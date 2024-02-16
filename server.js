var express = require("express");
var app = express();
var serv = require("http").Server(app);

app.use(express.static("client"));

serv.listen(2000);
console.log("Server started.");

var PLAYER_LIST = {};
var ROOMS = {};

var Player = (username) => {
	var self = {
		username: username,
		socketId: null,
		scores: {
			sb1: null,
			sb2: null,
			sb3: null,
			sb4: null,
			sb5: null,
			sb6: null,
			sb3ok: null,
			sb4ok: null,
			sbf: null,
			sbss: null,
			sbls: null,
			sb5ok: null,
			sbc: null,
			bonus: null,
			upperTotal: null,
			lowerTotal: null,
			grandTotal: null,
		},
		scorecard: {
			sb1: null,
			sb2: null,
			sb3: null,
			sb4: null,
			sb5: null,
			sb6: null,
			sb3ok: null,
			sb4ok: null,
			sbf: null,
			sbss: null,
			sbls: null,
			sb5ok: null,
			sbc: null,
		},
	};
	return self;
};

var io = require("socket.io")(serv, {});

io.sockets.on("connection", function (socket) {
	console.log("socket connection");

	socket.on("gameStarted", function (room) {
		for (let player of room) PLAYER_LIST[socket.id] = player;
		console.log(PLAYER_LIST);
	});

	socket.on("createGame", function (game) {
		var player = Player(game.player.username);
		player.socketId = game.player.socketID;
		PLAYER_LIST[socket.id] = player;
		ROOMS[game.roomID] = [player];
		console.log(ROOMS);
		socket.emit(
			"playerJoined",
			ROOMS[game.roomID].map((v) => v.username)
		);
	});

	socket.on("joinGame", function (game) {
		var player = Player(game.player.username);
		player.socketId = game.player.socketID;
		PLAYER_LIST[socket.id] = player;
		if (!ROOMS[game.roomID]) return;
		ROOMS[game.roomID].push(player);
		console.log(ROOMS);
		io.emit(
			"playerJoined",
			ROOMS[game.roomID].map((v) => v.username)
		);
	});

	socket.on("startGame", function (id) {
		var room = Object.keys(ROOMS).find((key) => ROOMS[key].some((v) => v.socketId === id));
		if (!room) return;
		var players = ROOMS[room];
		for (let player of players) {
			io.to(player.socketId).emit(
				"startGame",
				players.map((v) => v.username),
				players
			);
		}
	});

	socket.on("disconnect", function () {
		console.log("socket disconnection");
		for (let room in ROOMS) {
			ROOMS[room] = ROOMS[room].filter((v) => v.socketId != socket.id);
			if (ROOMS[room].length === 0) {
				delete ROOMS[room];
				continue;
			}
			io.emit(
				"playerJoined",
				ROOMS[room].map((v) => v.username)
			);
		}
		delete PLAYER_LIST[socket.id];
		console.log(ROOMS);
	});

	socket.on("askDice", function (data) {
		for (let die of data) if (die.locked == false) die.value = Math.floor(Math.random() * 6) + 1;
		var player = PLAYER_LIST[socket.id];
		var values = data.map((v) => v.value);
		var dice = data.map((v) => v.value);

		for (let i = 1; i <= 6; i++) {
			player.scorecard["sb" + i] = dice.filter((v) => v === i).length * i;
		}

		player.scorecard["sb3ok"] = dice.some((v) => dice.filter((v2) => v2 === v).length >= 3)
			? dice.reduce((a, b) => a + b)
			: 0;
		player.scorecard["sb4ok"] = dice.some((v) => dice.filter((v2) => v2 === v).length >= 4)
			? dice.reduce((a, b) => a + b)
			: 0;
		player.scorecard["sbf"] =
			dice.some((v) => dice.filter((v2) => v2 === v).length === 3) &&
			dice.some((v) => dice.filter((v2) => v2 === v).length === 2)
				? 25
				: 0;
		const set = Array.from(new Set(dice.sort())).join("");
		player.scorecard["sbss"] = set.includes("1234") || set.includes("2345") || set.includes("3456") ? 30 : 0;
		player.scorecard["sbls"] = dice.sort().join("").includes("12345") || dice.sort().join("").includes("23456") ? 40 : 0;
		player.scorecard["sb5ok"] = dice.every((v) => v === dice[0]) ? 50 : 0;

		player.scorecard["sbc"] = dice.reduce((a, b) => a + b, 0);
		if (player.scorecard.sb5ok != 0 && player.scores.sb5ok != null) {
			player.scores.sb5ok += 100;
			player.scores.lowerTotal += 100;
			player.scores.grandTotal += 100;
			socket.emit("scores", player.scores);
		}
		socket.emit("roll", { dice: values, scoreboxes: player.scorecard });
	});

	socket.on("play", function (id) {
		var player = PLAYER_LIST[socket.id];
		player.scores[id] = player.scorecard[id];
		player.scorecard = {
			sb1: null,
			sb2: null,
			sb3: null,
			sb4: null,
			sb5: null,
			sb6: null,
			sb3ok: null,
			sb4ok: null,
			sbf: null,
			sbss: null,
			sbls: null,
			sb5ok: null,
			sbc: null,
		};

		var upperTotal = 0;
		var lowerTotal = 0;
		for (let i = 1; i <= 6; i++) {
			if (player.scores["sb" + i] != null) upperTotal += player.scores["sb" + i];
		}
		for (let i = 3; i <= 5; i++) {
			if (player.scores["sb" + i + "ok"] != null) lowerTotal += player.scores["sb" + i + "ok"];
		}
		if (player.scores.sbf != null) lowerTotal += player.scores.sbf;
		if (player.scores.sbss != null) lowerTotal += player.scores.sbss;
		if (player.scores.sbls != null) lowerTotal += player.scores.sbls;
		if (player.scores.sbc != null) lowerTotal += player.scores.sbc;
		if (upperTotal > 62) {
			player.scores.bonus = 35;
			upperTotal += 35;
		} else if (
			player.scores.sb1 != null &&
			player.scores.sb2 != null &&
			player.scores.sb3 != null &&
			player.scores.sb4 != null &&
			player.scores.sb5 != null &&
			player.scores.sb6 != null
		) {
			player.scores.bonus = 0;
		}

		player.scores.upperTotal = upperTotal;
		player.scores.lowerTotal = lowerTotal;
		player.scores.grandTotal = upperTotal + lowerTotal;

		socket.emit("scores", player.scores);
	});
});

// TODO:
// - Handle multiple players
