var express = require("express");
var app = express();
var serv = require("http").Server(app);

const mod = (n, m) => ((n % m) + m) % m;

app.use(express.static("client"));

serv.listen(2000);
console.log("Server started.");

var PLAYER_LIST = [];
var ROOMS = {};

var Player = (username) => {
	var self = {
		username: username,
		socketID: null,
		sessionID: generateSessionID(),
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
			upperTotal: 0,
			lowerTotal: 0,
			grandTotal: 0,
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

	var currentRoom;

	socket.on("createGame", function (game) {
		var player = Player(game.player.username);
		player.socketID = game.player.socketID;
		PLAYER_LIST.push(player);
		ROOMS[game.roomID] = {
			roomID: game.roomID,
			playerToPlay: player,
			players: [player],
		};
		console.log(ROOMS);
		socket.join(game.roomID);
		socket.emit(
			"playerJoined",
			ROOMS[game.roomID].players.map((v) => v.username)
		);
	});

	socket.on("joinGame", (game, cb) => {
		if (!ROOMS[game.roomID] || ROOMS[game.roomID].isPlaying) return cb("Room not found or game already started.");
		var player = Player(game.player.username);
		if (ROOMS[game.roomID].players.some((v) => v.username === player.username)) return cb("Username already taken.");
		player.socketID = game.player.socketID;
		PLAYER_LIST.push(player);
		ROOMS[game.roomID].players.push(player);
		socket.join(game.roomID);
		io.to(game.roomID).emit(
			"playerJoined",
			ROOMS[game.roomID].players.map((v) => v.username)
		);
	});

	socket.on("startGame", function (id) {
		var roomID = Object.keys(ROOMS).find((key) => ROOMS[key].players.some((v) => v.socketID === id));
		if (!roomID) return;
		var players = ROOMS[roomID].players;
		ROOMS[roomID].isPlaying = true;
		for (let player of players) io.to(player.socketID).emit("startGame", player.sessionID, ROOMS[roomID]);
	});

	socket.on("joinRoom", function (sessionID, roomID, cb) {
		var room = ROOMS[roomID];
		if (!room) return cb();
		var player = room.players.find((v) => v.sessionID === sessionID);
		if (!player) return cb();
		player.socketID = socket.id;
		socket.join(roomID);
		currentRoom = room;
	});

	socket.on("disconnect", function () {
		console.log("socket disconnection");
	});

	socket.on("askDice", function (data) {
		for (let die of data) if (die.locked == false) die.value = Math.floor(Math.random() * 6) + 1;
		var player = currentRoom.players.find((v) => v.sessionID == currentRoom.playerToPlay.sessionID);
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
		if (player.scores.sb5ok >= 50 && player.scorecard.sb5ok == 50) {
			player.scores.sb5ok += 100;
			player.scores.lowerTotal += 100;
			player.scores.grandTotal += 100;
			socket.emit("scores", player.scores);
		}
		io.to(currentRoom.roomID).emit("roll", { dice: values, scoreboxes: player.scorecard });
	});

	socket.on("lockDie", function (id) {
		const players = currentRoom.players;
		for (let player of players) {
			if (player.socketID == socket.id) continue;
			io.to(player.socketID).emit("lockDie", id);
		}
	});

	socket.on("play", function (id) {
		const player = currentRoom.players.find((v) => v.sessionID == currentRoom.playerToPlay.sessionID);
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

		currentRoom.playerToPlay = currentRoom.players[mod(currentRoom.players.indexOf(player) + 1, currentRoom.players.length)];

		io.to(currentRoom.roomID).emit("play", id);
		io.to(currentRoom.roomID).emit("scores", currentRoom, player, currentRoom.playerToPlay);
		if (checkGameOver(currentRoom)) {
			const winner = currentRoom.players.reduce((a, b) => (a.scores.grandTotal > b.scores.grandTotal ? a : b));
			io.to(currentRoom.roomID).emit("gameOver", winner);
			PLAYER_LIST = PLAYER_LIST.filter((v) => v.roomID != currentRoom.roomID);
			delete ROOMS[currentRoom.roomID];
		}
	});
});

const checkGameOver = (room) => room.players.every((v) => Object.values(v.scores).every((v) => v != null));

const generateSessionID = () => Math.random().toString(36).substring(2, 15);
