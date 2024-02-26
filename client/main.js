var dice = [];
for (let i = 1; i <= 6; i++) {
	const image = new Image();
	image.classList.add("dice");
	image.src = `assets/dice_${i}.png`;
	image.width = 100;
	dice.push(image);
}

const mod = (n, m) => ((n % m) + m) % m;

var myTurn = false;

const socket = io();
const sessionID = JSON.parse(localStorage.getItem("sessionID"));
var room = JSON.parse(localStorage.getItem("room"));

socket.emit("joinRoom", sessionID, room.roomID);

const passTurn = () => {
	const room = JSON.parse(localStorage.getItem("room"));
	const player = room.players[room.playerToPlay];
	if (player.sessionID == sessionID) {
		document.querySelector("#roll").style.display = "block";
		document.querySelector("#play").style.display = "block";
		myTurn = true;
	} else {
		document.querySelector("#roll").style.display = "none";
		document.querySelector("#play").style.display = "none";
		myTurn = false;
	}
}
passTurn();

const scoreBoxes = document.querySelectorAll(".scoreBox");
for (let i = 0; i < scoreBoxes.length - 2; i++) {
	scoreBoxes[i].addEventListener("click", (e) => {
		const target = e.target.tagName === "SPAN" ? e.target.parentElement : e.target;
		if (target.classList.contains("played") || target.firstChild.textContent === "") return;
		target.classList.toggle("selected");
		document.querySelector("#play").disabled = !document.querySelector(".selected");
		for (let i = 0; i < scoreBoxes.length; i++) {
			if (scoreBoxes[i] !== target) {
				scoreBoxes[i].classList.remove("selected");
			}
		}
	});
}

const rollboard = document.querySelector(".rollboard .dice");
const rollsLeft = document.querySelector("#rollsLeft");
const lock = new Image();
lock.src = "assets/lock.svg";
lock.width = 50;
lock.classList.add("lock");

socket.on("roll", function (data) {
	if (rollsLeft.textContent == 0) return;
	for (let i = 1; i <= 5; i++) {
		var die = document.querySelector(`#die${i}`);
		if (die.classList.contains("locked")) continue;
		die.addEventListener("click", lockDie);
		die.style.cursor = "pointer";
		die.style.transform = `translateY(110%)`;
		die.style.transform += ` rotate(${Math.floor(180 + Math.random() * 180)}deg) `;
	}

	diceFromServer = data.dice;
	scoreboxesFromServer = data.scoreboxes;

	setTimeout(() => {
		for (let i = 1; i <= 5; i++) {
			const die = document.querySelector(`#die${i}`);
			if (die.classList.contains("locked")) continue;
			die.style.transform = "translateY(0) rotate(0deg) ";
		}

		for (let i = 0; i < diceFromServer.length; i++) {
			const die = document.querySelector(`#die${i + 1}`);
			if (die.classList.contains("locked")) continue;
			die.innerHTML = dice[diceFromServer[i] - 1].outerHTML;
		}

		document.querySelector("#roll").disabled = true;
		rollsLeft.textContent = parseInt(rollsLeft.textContent) - 1;
		if (rollsLeft.textContent > 0) {
			document.querySelector("#roll").disabled = false;
		}

		updateScoreBoxes(scoreboxesFromServer);
	}, 300);
});

const roll = () => {
	var diceToAsk = [];
	for (let i = 1; i <= 5; i++) {
		var die = document.querySelector(`#die${i}`);
		if (rollsLeft.textContent < 3) var dieFace = die.querySelector(".dice").src.split("_")[1].split(".")[0];
		if (die.classList.contains("locked")) diceToAsk.push({ locked: true, value: parseInt(dieFace) });
		else if (rollsLeft.textContent == 3) diceToAsk.push({ locked: false, value: "" });
		else diceToAsk.push({ locked: false, value: parseInt(dieFace) });
	}
	socket.emit("askDice", diceToAsk, sessionID);
};

const lockDie = (e) => {
	if (!myTurn) return;
	parent = e.target.parentElement;
	if (!parent.classList.contains("die")) return;
	socket.emit("lockDie", parent.id);
	parent.classList.toggle("locked");
	if (parent.classList.contains("locked")) parent.appendChild(lock.cloneNode());
	else parent.querySelector(".lock").remove();
	const dice = document.querySelectorAll(".die");
	document.querySelector("#roll").disabled = document.querySelectorAll(".locked").length === dice.length;
};

socket.on("lockDie", function (id) {
	const die = document.querySelector(`#${id}`);
	die.classList.toggle("locked");
	if (die.classList.contains("locked")) die.appendChild(lock.cloneNode());
	else die.querySelector(".lock").remove();
	const dice = document.querySelectorAll(".die");
	document.querySelector("#roll").disabled = document.querySelectorAll(".locked").length === dice.length;
});

const updateScoreBoxes = (scoreboxes) => {
	const boxes = document.querySelectorAll(".scoreBox");
	for (let i = 0; i < boxes.length - 2; i++) {
		if (boxes[i].classList.contains("played") || boxes[i].id == "bonus") continue;
		boxes[i].firstChild.textContent = scoreboxes[boxes[i].firstChild.id];
	}
};

const play = () => {
	const selected = document.querySelector(".selected");
	const scoreSpan = selected.firstChild;

	socket.emit("play", scoreSpan.id);
};

socket.on("play", (id) => {
	const selected = document.querySelector("#" + id).parentElement;
	selected.classList.remove("selected");
	document.querySelector("#play").disabled = true;
	document.querySelector("#roll").disabled = false;
	document.querySelector("#rollsLeft").textContent = 3;
	const dice = document.querySelectorAll(".die");
	for (let i = 0; i < dice.length; i++) {
		dice[i].innerHTML = "";
		dice[i].classList.remove("locked");
		dice[i].removeEventListener("click", lockDie);
		dice[i].style.cursor = "default";
	}
});

socket.on("scores", (room) => {
	localStorage.removeItem("room");
	localStorage.setItem("room", JSON.stringify(room));
	room = JSON.parse(localStorage.getItem("room"));
	const playerWhoPlayed = mod(room.playerToPlay - 1, room.players.length);
	const playerToPlay = room.playerToPlay;
	loadScorecard(room.players[playerWhoPlayed]);
	loadScorecard(room.players[playerToPlay]);
	passTurn();
});

const checkGameOver = (data) => {
	for (let score in data) {
		if (data[score] == null) return;
	}
	document.querySelector("#roll").disabled = true;
	document.querySelector("#play").disabled = true;
};

const addPlayer = (username) => {
	const playerTable = document.querySelector(".playerTable");
	const playerCard = `<div class="playerCard"><span>${username}</span><span class="playerScore" id="${username}Total">0</span></div>`;
	playerTable.innerHTML += playerCard;
};

for (let player of room.players) addPlayer(player.username);

const loadScorecard = (player) => {
	const scorecard = player.scores;
	const boxes = document.querySelectorAll(".scoreBox");
	for (let i = 0; i < boxes.length; i++)
		if (scorecard[boxes[i].firstChild.id] != null) {
			boxes[i].firstChild.textContent = scorecard[boxes[i].firstChild.id];
			boxes[i].classList.add("played");
		} else {
			boxes[i].firstChild.textContent = "";
			boxes[i].classList.remove("played");
		}
	document.querySelector(`#${player.username}Total`).textContent = player.scores.grandTotal;
};

for (let player of room.players) loadScorecard(player);

socket.on("gameOver", (winner) => {
	loadScorecard(winner);
	setTimeout(() => {
		alert(`${winner.username} wins!`);
		window.location.href = "/";
	}, 100);
});
