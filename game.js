// 상수 정의
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;

// 게임 상태
let game = {
    board: [],
    currentPlayer: BLACK, // 1: 흑, 2: 백
    scores: { 1: 2, 2: 2 },
    showHints: false,
    gameOver: false,
    mode: null, // 'solo' or 'dual'
    difficulty: null, // 'easy', 'normal', 'hard'
    aiPlayer: WHITE, // AI는 백색
    isAIThinking: false
};

// 8방향 (상, 하, 좌, 우, 대각선)
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// 위치 가중치 (전략적 평가용)
const POSITION_WEIGHTS = [
    [100, -20, 10,  5,  5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [  5,  -2,  1,  0,  0,  1,  -2,   5],
    [  5,  -2,  1,  0,  0,  1,  -2,   5],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10,  5,  5, 10, -20, 100]
];

// =========================
// 화면 전환 로직
// =========================

document.addEventListener('DOMContentLoaded', () => {
    // 솔로 모드 선택
    document.getElementById('soloMode').addEventListener('click', () => {
        document.getElementById('introScreen').style.display = 'none';
        document.getElementById('difficultyScreen').style.display = 'block';
    });

    // 듀얼 모드 선택
    document.getElementById('dualMode').addEventListener('click', () => {
        startGame('dual', null);
    });

    // 난이도 선택
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.addEventListener('click', () => {
            const difficulty = card.dataset.difficulty;
            startGame('solo', difficulty);
        });
    });
});

function startGame(mode, difficulty) {
    game.mode = mode;
    game.difficulty = difficulty;

    // 화면 전환
    document.getElementById('introScreen').style.display = 'none';
    document.getElementById('difficultyScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';

    // 플레이어 이름 설정
    if (mode === 'solo') {
        document.getElementById('player1Name').textContent = '플레이어 (흑)';
        let aiName = 'AI (백)';
        if (difficulty === 'easy') aiName += ' - 쉬움';
        else if (difficulty === 'normal') aiName += ' - 보통';
        else if (difficulty === 'hard') aiName += ' - 어려움';
        document.getElementById('player2Name').textContent = aiName;
    } else {
        document.getElementById('player1Name').textContent = '플레이어 1 (흑)';
        document.getElementById('player2Name').textContent = '플레이어 2 (백)';
    }

    init();
}

function backToIntro() {
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('difficultyScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('introScreen').style.display = 'block';

    game.mode = null;
    game.difficulty = null;
}

// =========================
// 게임 로직
// =========================

function init() {
    initBoard();
    renderBoard();
    updateUI();

    // AI 차례면 AI가 먼저 시작
    if (game.mode === 'solo' && game.currentPlayer === game.aiPlayer) {
        setTimeout(makeAIMove, 500);
    }
}

function initBoard() {
    game.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));

    // 초기 배치 (중앙 4개)
    const mid = BOARD_SIZE / 2;
    game.board[mid - 1][mid - 1] = WHITE;
    game.board[mid - 1][mid] = BLACK;
    game.board[mid][mid - 1] = BLACK;
    game.board[mid][mid] = WHITE;

    game.currentPlayer = BLACK;
    game.scores = { 1: 2, 2: 2 };
    game.gameOver = false;
    game.isAIThinking = false;
}

function renderBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            // 유효한 수 표시 (AI가 생각 중일 때는 표시 안함)
            if (game.showHints && !game.isAIThinking && isValidMove(row, col, game.currentPlayer)) {
                cell.classList.add('valid-move');
            }

            // 돌 배치
            const piece = game.board[row][col];
            if (piece !== EMPTY) {
                const disc = document.createElement('div');
                disc.className = `disc ${piece === BLACK ? 'black' : 'white'}`;
                cell.appendChild(disc);
            }

            cell.addEventListener('click', () => handleCellClick(row, col));
            boardElement.appendChild(cell);
        }
    }
}

function handleCellClick(row, col) {
    if (game.gameOver || game.isAIThinking) return;

    // AI 모드에서 AI 차례면 클릭 무시
    if (game.mode === 'solo' && game.currentPlayer === game.aiPlayer) {
        return;
    }

    if (isValidMove(row, col, game.currentPlayer)) {
        makeMove(row, col, game.currentPlayer);
        nextTurn();
    }
}

function nextTurn() {
    // 다음 플레이어로 전환
    game.currentPlayer = game.currentPlayer === BLACK ? WHITE : BLACK;

    // 다음 플레이어가 둘 수 있는지 확인
    if (!hasValidMoves(game.currentPlayer)) {
        // 둘 수 없으면 다시 이전 플레이어로
        game.currentPlayer = game.currentPlayer === BLACK ? WHITE : BLACK;

        // 양쪽 모두 둘 수 없으면 게임 종료
        if (!hasValidMoves(game.currentPlayer)) {
            endGame();
            return;
        }
    }

    updateUI();
    renderBoard();

    // AI 차례면 AI가 수를 둠
    if (game.mode === 'solo' && game.currentPlayer === game.aiPlayer && !game.gameOver) {
        setTimeout(makeAIMove, 800);
    }
}

function isValidMove(row, col, player) {
    if (game.board[row][col] !== EMPTY) return false;

    const opponent = player === BLACK ? WHITE : BLACK;

    for (const [dx, dy] of DIRECTIONS) {
        let x = row + dx;
        let y = col + dy;
        let hasOpponent = false;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (game.board[x][y] === EMPTY) break;
            if (game.board[x][y] === opponent) {
                hasOpponent = true;
            } else if (game.board[x][y] === player) {
                if (hasOpponent) return true;
                break;
            }
            x += dx;
            y += dy;
        }
    }

    return false;
}

function makeMove(row, col, player) {
    game.board[row][col] = player;
    const opponent = player === BLACK ? WHITE : BLACK;

    // 각 방향으로 뒤집기
    for (const [dx, dy] of DIRECTIONS) {
        const toFlip = [];
        let x = row + dx;
        let y = col + dy;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (game.board[x][y] === EMPTY) break;
            if (game.board[x][y] === opponent) {
                toFlip.push([x, y]);
            } else if (game.board[x][y] === player) {
                // 뒤집기
                for (const [fx, fy] of toFlip) {
                    game.board[fx][fy] = player;
                    animateFlip(fx, fy);
                }
                break;
            }
            x += dx;
            y += dy;
        }
    }

    calculateScores();
}

function animateFlip(row, col) {
    setTimeout(() => {
        const cells = document.querySelectorAll('.cell');
        const index = row * BOARD_SIZE + col;
        const cell = cells[index];
        const disc = cell.querySelector('.disc');

        if (disc) {
            disc.classList.add('flipping');
            setTimeout(() => {
                disc.className = `disc ${game.board[row][col] === BLACK ? 'black' : 'white'}`;
            }, 300);
        }
    }, 50);
}

function hasValidMoves(player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMove(row, col, player)) {
                return true;
            }
        }
    }
    return false;
}

function getValidMoves(player) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMove(row, col, player)) {
                moves.push([row, col]);
            }
        }
    }
    return moves;
}

function calculateScores() {
    game.scores[BLACK] = 0;
    game.scores[WHITE] = 0;

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (game.board[row][col] === BLACK) {
                game.scores[BLACK]++;
            } else if (game.board[row][col] === WHITE) {
                game.scores[WHITE]++;
            }
        }
    }
}

function updateUI() {
    document.getElementById('player1Score').textContent = game.scores[BLACK];
    document.getElementById('player2Score').textContent = game.scores[WHITE];

    // 현재 플레이어 표시
    const turnDisc = document.querySelector('.current-turn-disc');
    const turnText = document.getElementById('turnText');

    if (game.currentPlayer === BLACK) {
        turnDisc.className = 'current-turn-disc black';
        turnText.textContent = game.mode === 'solo' ? '플레이어 차례' : '플레이어 1 차례';
    } else {
        turnDisc.className = 'current-turn-disc white';
        if (game.mode === 'solo') {
            turnText.textContent = game.isAIThinking ? 'AI 생각 중...' : 'AI 차례';
        } else {
            turnText.textContent = '플레이어 2 차례';
        }
    }

    // 활성 플레이어 하이라이트
    document.getElementById('player1Info').classList.toggle('active', game.currentPlayer === BLACK);
    document.getElementById('player2Info').classList.toggle('active', game.currentPlayer === WHITE);
}

function endGame() {
    game.gameOver = true;

    const gameOverDiv = document.getElementById('gameOver');
    const winnerText = document.getElementById('winnerText');
    const finalScores = document.getElementById('finalScores');

    if (game.scores[BLACK] > game.scores[WHITE]) {
        if (game.mode === 'solo') {
            winnerText.textContent = '🎉 플레이어 승리!';
        } else {
            winnerText.textContent = '🏆 플레이어 1 승리!';
        }
    } else if (game.scores[WHITE] > game.scores[BLACK]) {
        if (game.mode === 'solo') {
            winnerText.textContent = '🤖 AI 승리!';
        } else {
            winnerText.textContent = '🏆 플레이어 2 승리!';
        }
    } else {
        winnerText.textContent = '🤝 무승부!';
    }

    const p1Name = game.mode === 'solo' ? '플레이어' : '플레이어 1';
    const p2Name = game.mode === 'solo' ? 'AI' : '플레이어 2';
    finalScores.textContent = `${p1Name}: ${game.scores[BLACK]} vs ${p2Name}: ${game.scores[WHITE]}`;
    gameOverDiv.style.display = 'flex';
}

function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    init();
}

function toggleHint() {
    game.showHints = !game.showHints;
    const hintBtn = document.getElementById('hintBtn');

    if (game.showHints) {
        hintBtn.classList.add('active');
        hintBtn.textContent = '힌트 숨기기';
    } else {
        hintBtn.classList.remove('active');
        hintBtn.textContent = '힌트 표시';
    }

    renderBoard();
}

// =========================
// AI 로직
// =========================

function makeAIMove() {
    if (game.gameOver) return;

    game.isAIThinking = true;
    updateUI();

    let move;

    if (game.difficulty === 'easy') {
        move = getEasyAIMove();
    } else if (game.difficulty === 'normal') {
        move = getNormalAIMove();
    } else if (game.difficulty === 'hard') {
        move = getHardAIMove();
    }

    if (move) {
        setTimeout(() => {
            makeMove(move[0], move[1], game.aiPlayer);
            game.isAIThinking = false;
            nextTurn();
        }, 500);
    }
}

// 쉬움: 그리디 알고리즘 (가장 많은 돌을 뒤집는 수)
function getEasyAIMove() {
    const validMoves = getValidMoves(game.aiPlayer);
    if (validMoves.length === 0) return null;

    let bestMove = validMoves[0];
    let maxFlips = 0;

    for (const [row, col] of validMoves) {
        const flips = countFlips(row, col, game.aiPlayer);
        if (flips > maxFlips) {
            maxFlips = flips;
            bestMove = [row, col];
        }
    }

    return bestMove;
}

// 보통: Minimax 2-3수 예측
function getNormalAIMove() {
    const depth = 3;
    return minimaxMove(depth);
}

// 어려움: Minimax 4-5수 예측 + 위치 평가
function getHardAIMove() {
    const depth = 5;
    return minimaxMove(depth);
}

function countFlips(row, col, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let totalFlips = 0;

    for (const [dx, dy] of DIRECTIONS) {
        let x = row + dx;
        let y = col + dy;
        let flips = 0;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (game.board[x][y] === EMPTY) break;
            if (game.board[x][y] === opponent) {
                flips++;
            } else if (game.board[x][y] === player) {
                totalFlips += flips;
                break;
            }
            x += dx;
            y += dy;
        }
    }

    return totalFlips;
}

function minimaxMove(depth) {
    const validMoves = getValidMoves(game.aiPlayer);
    if (validMoves.length === 0) return null;

    let bestMove = validMoves[0];
    let bestScore = -Infinity;

    for (const [row, col] of validMoves) {
        const boardCopy = copyBoard(game.board);
        simulateMove(boardCopy, row, col, game.aiPlayer);

        const score = minimax(boardCopy, depth - 1, false, -Infinity, Infinity);

        if (score > bestScore) {
            bestScore = score;
            bestMove = [row, col];
        }
    }

    return bestMove;
}

function minimax(board, depth, isMaximizing, alpha, beta) {
    if (depth === 0) {
        return evaluateBoard(board);
    }

    const player = isMaximizing ? game.aiPlayer : (game.aiPlayer === BLACK ? WHITE : BLACK);
    const moves = getValidMovesForBoard(board, player);

    if (moves.length === 0) {
        const opponent = player === BLACK ? WHITE : BLACK;
        const opponentMoves = getValidMovesForBoard(board, opponent);
        if (opponentMoves.length === 0) {
            return evaluateBoard(board);
        }
        return minimax(board, depth - 1, !isMaximizing, alpha, beta);
    }

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const [row, col] of moves) {
            const boardCopy = copyBoard(board);
            simulateMove(boardCopy, row, col, player);
            const score = minimax(boardCopy, depth - 1, false, alpha, beta);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const [row, col] of moves) {
            const boardCopy = copyBoard(board);
            simulateMove(boardCopy, row, col, player);
            const score = minimax(boardCopy, depth - 1, true, alpha, beta);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        return minScore;
    }
}

function evaluateBoard(board) {
    let score = 0;

    // 돌 개수 + 위치 가중치
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === game.aiPlayer) {
                score += 1 + POSITION_WEIGHTS[row][col];
            } else if (board[row][col] !== EMPTY) {
                score -= 1 + POSITION_WEIGHTS[row][col];
            }
        }
    }

    // 이동 가능성 (mobility)
    const aiMoves = getValidMovesForBoard(board, game.aiPlayer).length;
    const opponentMoves = getValidMovesForBoard(board, game.aiPlayer === BLACK ? WHITE : BLACK).length;
    score += (aiMoves - opponentMoves) * 2;

    return score;
}

function copyBoard(board) {
    return board.map(row => [...row]);
}

function simulateMove(board, row, col, player) {
    board[row][col] = player;
    const opponent = player === BLACK ? WHITE : BLACK;

    for (const [dx, dy] of DIRECTIONS) {
        const toFlip = [];
        let x = row + dx;
        let y = col + dy;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (board[x][y] === EMPTY) break;
            if (board[x][y] === opponent) {
                toFlip.push([x, y]);
            } else if (board[x][y] === player) {
                for (const [fx, fy] of toFlip) {
                    board[fx][fy] = player;
                }
                break;
            }
            x += dx;
            y += dy;
        }
    }
}

function getValidMovesForBoard(board, player) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (isValidMoveForBoard(board, row, col, player)) {
                moves.push([row, col]);
            }
        }
    }
    return moves;
}

function isValidMoveForBoard(board, row, col, player) {
    if (board[row][col] !== EMPTY) return false;

    const opponent = player === BLACK ? WHITE : BLACK;

    for (const [dx, dy] of DIRECTIONS) {
        let x = row + dx;
        let y = col + dy;
        let hasOpponent = false;

        while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (board[x][y] === EMPTY) break;
            if (board[x][y] === opponent) {
                hasOpponent = true;
            } else if (board[x][y] === player) {
                if (hasOpponent) return true;
                break;
            }
            x += dx;
            y += dy;
        }
    }

    return false;
}
