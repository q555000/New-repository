const http = require('http');
const { Server } = require('socket.io');

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>54张计分版唬牌</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; background: #2c3e50; color: #fff; margin: 0; padding: 20px; }
        .card { display: inline-block; width: 55px; height: 80px; background: white; color: black; border-radius: 5px; 
                line-height: 80px; margin: 4px; font-weight: bold; cursor: pointer; user-select: none; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .card.red { color: #e74c3c; }
        .card.selected { border: 3px solid #e74c3c; transform: translateY(-10px); }
        #board { background: #27ae60; padding: 15px; border-radius: 10px; max-width: 650px; margin: 15px auto; }
        button { padding: 10px 18px; font-size: 15px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .btn-play { background: #3498db; color: white; }
        .btn-bs { background: #e74c3c; color: white; }
        .btn-next { background: #f39c12; color: white; }
        table { margin: 10px auto; border-collapse: collapse; width: 90%; background: rgba(0,0,0,0.2); }
        th, td { padding: 8px; border: 1px solid #555; }
    </style>
</head>
<body>
    <h1>54张扑克 · 回合积分版唬牌</h1>

    <div id="login">
        <input type="text" id="username" placeholder="输入你的名字">
        <button onclick="join()">加入游戏</button>
    </div>

    <div id="game" style="display:none;">
        <div id="board">
            <h2 id="roundTitle">第 1 回合</h2>
            <p id="msg" style="color: #f1c40f; font-weight: bold; font-size: 18px;"></p>
            <h3>当前必须出的点数: <span id="targetRank" style="font-size: 28px; color: #e74c3c;">-</span></h3>
            <p>桌面已有牌数: <span id="pileCount" style="font-size: 20px; color: #f39c12;">0</span> 张</p>
            <p id="lastAction"></p>
            <p id="turnInfo" style="font-size: 18px;"></p>
        </div>

        <button id="startBtn" onclick="startGame()">开始第一局</button>
        <button id="nextRoundBtn" class="btn-next" style="display:none;" onclick="nextRound()">进入下一回合</button>
        <br><br>

        <div>
            <h3>你的手牌 (<span id="handCount">0</span>张):</h3>
            <div id="hand"></div>
            <br>
            <button class="btn-play" onclick="playCards()">出牌</button>
            <button class="btn-bs" onclick="challenge()">质疑 (吹牛!)</button>
        </div>

        <h3>🏆 玩家积分排行榜</h3>
        <table>
            <thead>
                <tr>
                    <th>玩家</th>
                    <th>本局手牌</th>
                    <th>总积分 (剩牌扣分)</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody id="playerTable"></tbody>
        </table>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let selectedCards = [], myId = '';
        const rankNames = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: '小王', 15: '大王' };

        function getRankName(r) { return rankNames[r] || r; }

        function join() {
            const name = document.getElementById('username').value;
            if(!name) return alert('请输入名字');
            socket.emit('joinGame', name);
            document.getElementById('login').style.display = 'none';
            document.getElementById('game').style.display = 'block';
        }

        function startGame() { socket.emit('startGame'); }
        function nextRound() { socket.emit('nextRound'); }

        function toggleCard(el, card) {
            const idx = selectedCards.indexOf(card);
            if (idx > -1) {
                selectedCards.splice(idx, 1);
                el.classList.remove('selected');
            } else {
                selectedCards.push(card);
                el.classList.add('selected');
            }
        }

        function playCards() {
            if (selectedCards.length === 0) return alert('请选择要出的牌');
            socket.emit('playCards', selectedCards);
            selectedCards = [];
        }

        function challenge() { socket.emit('challenge'); }

        socket.on('connect', () => { myId = socket.id; });

        socket.on('yourHand', (hand) => {
            const handDiv = document.getElementById('hand');
            document.getElementById('handCount').innerText = hand.length;
            handDiv.innerHTML = '';
            hand.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'card' + (card === 15 || card === 14 ? ' red' : '');
                cardEl.innerText = getRankName(card);
                cardEl.onclick = () => toggleCard(cardEl, card);
                handDiv.appendChild(cardEl);
            });
        });

        socket.on('gameState', (state) => {
            document.getElementById('roundTitle'.innerText = \`第 \${state.roundCount} 回合\`);
            document.getElementById('targetRank').innerText = getRankName(state.currentTargetRank);
            document.getElementById('pileCount').innerText = state.discardPileCount;
            document.getElementById('msg').innerText = state.message || '';
            document.getElementById('lastAction').innerText = state.lastMove ? \`\${state.lastMove.playerName} 出了 \${state.lastMove.count} 张牌\` : '桌面已清空';
            
            const isMyTurn = state.turnPlayerId === myId;
            document.getElementById('turnInfo').innerText = state.roundActive 
                ? (isMyTurn ? '👉 轮到你了！' : '等待其他玩家出牌...') 
                : '🏁 本回合已结束';

            const tbody = document.getElementById('playerTable');
            tbody.innerHTML = '';
            state.players.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td>\${p.name}</td>
                    <td>\${p.cardCount} 张</td>
                    <td style="font-weight:bold; color:\${p.score >= 0 ? '#2ecc71' : '#e74c3c'}">\${p.score} 分</td>
                    <td>\${p.id === state.turnPlayerId && state.roundActive ? '🎲 出牌中' : '-'}</td>
                \`;
                tbody.appendChild(tr);
            });

            document.getElementById('startBtn').style.display = (!state.gameStarted) ? 'inline-block' : 'none';
            document.getElementById('nextRoundBtn').style.display = (state.gameStarted && !state.roundActive) ? 'inline-block' : 'none';
        });

        socket.on('errorMsg', (msg) => alert(msg));
    </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
});

const io = new Server(server);

let players = [];
let deck = [];
let discardPile = [];
let currentTargetRank = 1;
let turnIndex = 0;
let lastMove = null;
let gameStarted = false;
let roundActive = false;
let roundCount = 1;

function create54Deck() {
    let cards = [];
    for (let r = 1; r <= 13; r++) {
        for (let i = 0; i < 4; i++) cards.push(r);
    }
    cards.push(14, 15); // 14: 小王, 15: 大王
    return cards.sort(() => Math.random() - 0.5);
}

function startRound() {
    deck = create54Deck();
    discardPile = [];
    currentTargetRank = 1; 
    lastMove = null;
    roundActive = true;

    let cardCount = Math.floor(deck.length / players.length);
    let rem = deck.length % players.length; 

    players.forEach((p, idx) => {
        let start = idx * cardCount;
        p.hand = deck.slice(start, start + cardCount).sort((a, b) => a - b);
    });

    if (rem > 0) {
        discardPile = deck.slice(players.length * cardCount);
    }

    broadcastGameState(`第 ${roundCount} 回合开始！牌已发完（包含大小王共54张）。`);
}

function broadcastGameState(message = '') {
    io.emit('gameState', {
        players: players.map(p => ({ id: p.id, name: p.name, cardCount: p.hand.length, score: p.score })),
        turnPlayerId: players[turnIndex] ? players[turnIndex].id : null,
        currentTargetRank,
        discardPileCount: discardPile.length,
        lastMove: lastMove ? { playerName: lastMove.playerName, count: lastMove.count } : null,
        gameStarted,
        roundActive,
        roundCount,
        message
    });

    players.forEach(p => io.to(p.id).emit('yourHand', p.hand));
}

io.on('connection', (socket) => {
    socket.on('joinGame', (playerName) => {
        if (gameStarted && roundActive) {
            socket.emit('errorMsg', '当前回合进行中，请等待本局结束');
            return;
        }
        players.push({
            id: socket.id,
            name: playerName || `玩家 ${socket.id.substr(0, 4)}`,
            hand: [],
            score: 0
        });
        broadcastGameState(`${playerName} 加入了游戏`);
    });

    socket.on('startGame', () => {
        if (players.length < 2) return socket.emit('errorMsg', '至少需要 2 名玩家才能开始游戏');
        gameStarted = true;
        roundCount = 1;
        turnIndex = 0;
        startRound();
    });

    socket.on('nextRound', () => {
        if (!gameStarted || roundActive) return;
        roundCount++;
        turnIndex = (turnIndex + 1) % players.length;
        startRound();
    });

    socket.on('playCards', (selectedCards) => {
        if (!roundActive || players[turnIndex].id !== socket.id || !selectedCards.length) return;

        const player = players[turnIndex];
        selectedCards.forEach(card => {
            const idx = player.hand.indexOf(card);
            if (idx !== -1) player.hand.splice(idx, 1);
        });

        lastMove = {
            playerId: player.id,
            playerName: player.name,
            count: selectedCards.length,
            actualCards: selectedCards,
            claimedRank: currentTargetRank
        };

        discardPile.push(...selectedCards);

        if (player.hand.length === 0) {
            endRound(player);
            return;
        }

        turnIndex = (turnIndex + 1) % players.length;
        currentTargetRank = (currentTargetRank % 15) + 1;

        broadcastGameState(`${player.name} 出了 ${selectedCards.length} 张牌（声称是点数 ${currentTargetRank === 1 ? 'A' : currentTargetRank}）`);
    });

    socket.on('challenge', () => {
        if (!roundActive || !lastMove) return;

        const challenger = players.find(p => p.id === socket.id);
        const accused = players.find(p => p.id === lastMove.playerId);

        const isLiar = lastMove.actualCards.some(card => card !== lastMove.claimedRank);
        let loser = isLiar ? accused : challenger;

        loser.hand.push(...discardPile);
        loser.hand.sort((a, b) => a - b);

        const resultMsg = isLiar 
            ? `${challenger.name} 质疑成功！${accused.name} 说了谎，收下桌面 ${discardPile.length} 张牌！`
            : `${challenger.name} 质疑失败！${accused.name} 没说谎，${challenger.name} 收下桌面 ${discardPile.length} 张牌！`;

        discardPile = [];
        lastMove = null;

        const winner = players.find(p => p.hand.length === 0);
        if (winner) {
            endRound(winner);
            return;
        }

        turnIndex = players.findIndex(p => p.id === loser.id);
        broadcastGameState(resultMsg);
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length < 2) {
            gameStarted = false;
            roundActive = false;
        }
        broadcastGameState('有玩家离开了房间');
    });
});

function endRound(winner) {
    roundActive = false;
    let summaryMsg = `🎉 ${winner.name} 赢得了第 ${roundCount} 回合！结算：`;

    players.forEach(p => {
        if (p.id !== winner.id) {
            let penalty = p.hand.length;
            p.score -= penalty; 
            summaryMsg += `${p.name} (-${penalty}分) `;
        }
    });

    broadcastGameState(summaryMsg);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
