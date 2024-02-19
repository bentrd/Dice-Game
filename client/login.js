const socket = io();

const createGamePanel = () => {
    const createGamePanel = document.getElementById("createGamePanel");
    const panelButtons = document.getElementById("panelButtons");
    panelButtons.style.display = "none";
    createGamePanel.style.display = "flex";

    const playerListWrapper = document.querySelector(".playerListWrapper");
    playerListWrapper.style.display = "flex";

    const startGameButton = document.getElementById("startGameButton");
    startGameButton.style.display = "flex";

    const gameRoomID = document.getElementById("gameRoomIDCreate");
    const roomID = Math.random().toString(36).substring(2, 5).toUpperCase();
    gameRoomID.textContent = roomID;
}

const joinGamePanel = () => {
    const joinGamePanel = document.getElementById("joinGamePanel");
    const panelButtons = document.getElementById("panelButtons");
    panelButtons.style.display = "none";
    joinGamePanel.style.display = "flex";

    const playerListWrapper = document.querySelector(".playerListWrapper");
    playerListWrapper.style.display = "flex";
}

const createGame = () => {
    const gameRoomID = document.getElementById("gameRoomIDCreate");
    const username = document.getElementById("usernameCreate");
    const game = {
        roomID: gameRoomID.textContent,
        player: {
            username: username.value,
            socketID: socket.id
        }
    }
    console.log(game);
    socket.emit("createGame", game);
}

const joinGame = () => {
    const gameRoomID = document.getElementById("gameRoomIDJoin");
    const username = document.getElementById("usernameJoin");
    const game = {
        roomID: gameRoomID.value.toUpperCase(),
        player: {
            username: username.value,
            socketID: socket.id
        }
    }
    console.log(game);
    socket.emit("joinGame", game);
}

const startGame = () => {
    socket.emit("startGame", socket.id);
}

const addToPlayerList = (username) => {
    const playerList = document.querySelector(".playerList");
    const player = document.createElement("span");
    player.textContent = username;
    playerList.appendChild(player);
}

socket.on("playerJoined", function (players) {
    const playerList = document.querySelector(".playerList");
    playerList.innerHTML = "";
    document.getElementById("startGameButton").disabled = players.length < 2;
    if (players.length === 0) return;
    for (let player of players) {
        addToPlayerList(player);
    }
});

socket.on("startGame", function (sessionID, room) {
    console.log("game started");
    localStorage.removeItem("room");
    localStorage.removeItem("sessionID");
    localStorage.setItem("room", JSON.stringify(room));
    localStorage.setItem("sessionID", JSON.stringify(sessionID));
    window.location.href = "/game.html";
});