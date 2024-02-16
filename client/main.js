var dice = [];
for (let i = 1; i <= 6; i++) {
	const image = new Image();
	image.classList.add("dice");
	image.src = `assets/dice_${i}.png`;
	image.width = 100;
	dice.push(image);
}

const socket = io();

socket.emit("gameStarted", JSON.parse(localStorage.getItem("room")));

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

const roll = () => {
	if (rollsLeft.textContent == 0) return;
	var diceToAsk = [];
	for (let i = 1; i <= 5; i++) {
		var die = document.querySelector(`#die${i}`);
		if (rollsLeft.textContent < 3) var dieFace = die.querySelector(".dice").src.split("_")[1].split(".")[0];
		if (die.classList.contains("locked")) diceToAsk.push({ locked: true, value: parseInt(dieFace) });
		else if (rollsLeft.textContent == 3) diceToAsk.push({ locked: false, value: "" });
		else diceToAsk.push({ locked: false, value: parseInt(dieFace) });
		if (die.classList.contains("locked")) continue;
		die.addEventListener("click", lockDie);
		die.style.cursor = "pointer";
		die.style.transform = `translateY(110%)`;
		die.style.transform += ` rotate(${Math.floor(180 + Math.random() * 180)}deg) `;
	}

	var diceFromServer;
	var scoreboxesFromServer;
	socket.emit("askDice", diceToAsk);
	socket.on("roll", function (data) {
		diceFromServer = data.dice;
		scoreboxesFromServer = data.scoreboxes;
	});

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
};

const lockDie = (e) => {
	parent = e.target.parentElement;
	if (!parent.classList.contains("die")) return;
	parent.classList.toggle("locked");
	if (parent.classList.contains("locked")) {
		parent.appendChild(lock.cloneNode());
	} else {
		parent.querySelector(".lock").remove();
	}
	const dice = document.querySelectorAll(".die");
	if (document.querySelector("#rollsLeft").textContent == 0) return;
	document.querySelector("#roll").disabled = document.querySelectorAll(".locked").length === dice.length;
};

const updateScoreBoxes = (scoreboxes) => {
	const boxes = document.querySelectorAll(".scoreBox");
	if (document.querySelectorAll(".dice").length === 0) {
		for (let i = 0; i < boxes.length - 2; i++) {
			if (boxes[i].classList.contains("played")) continue;
			boxes[i].firstChild.textContent = "";
		}
		return;
	}
	for (let i = 0; i < boxes.length - 2; i++) {
		if (boxes[i].classList.contains("played") || boxes[i].id == "bonus") continue;
		boxes[i].firstChild.textContent = scoreboxes[boxes[i].firstChild.id];
	}
};

const play = () => {
	const selected = document.querySelector(".selected");
	const scoreSpan = selected.firstChild;

	socket.emit("play", scoreSpan.id);

	selected.classList.add("played");
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

	updateTotals();
	updateScoreBoxes();
};

const updateTotals = () => {
	const boxes = document.querySelectorAll(".scoreBox:not(#bonus):not(#upperTotal):not(#lowerTotal)");
	const upper = document.querySelector("#upperTotal");
	const lower = document.querySelector("#lowerTotal");
	const total = document.querySelector("#p1Total");
	const bonus = document.querySelector("#bonus");
	socket.on("scores", function (data) {
		upper.innerHTML = data.upperTotal;
		lower.innerHTML = data.lowerTotal;
		total.innerHTML = data.grandTotal;
		if (data.bonus != null)
			bonus.firstChild.innerHTML = data.bonus;
		for (let i = 0; i < boxes.length; i++)
			if (data[boxes[i].firstChild.id] != null) boxes[i].firstChild.textContent = data[boxes[i].firstChild.id];
		setTimeout(checkGameOver(data), 100);
	});
};

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
}

const room = JSON.parse(localStorage.getItem("room"));
for (let player of room) {
	addPlayer(player.username)
}
