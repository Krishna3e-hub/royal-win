/**
 * ROYAL WIN - AUTOMATED GAMING & UPI TELEGRAM BOT PLATFORM
 * Features:
 * 1. Pre-configured Telegram Bot Deposit & Withdrawal Approval
 * 2. Wingo 30s with Big/Small, Color & Numbers (Least-Payout-Wins Algorithm)
 * 3. Chicken Road Multiplier Game with Dynamic Risk Control
 * 4. Lucky Mines (3rd Game) with Smart House Protection
 * 5. Local JSON Database Persistence (Auto-saves balances & transactions)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= ROYAL WIN CONFIGURATION =================
const PORT = process.env.PORT || 3000;
const APP_NAME = 'Royal Win';
const TELEGRAM_BOT_TOKEN = '9226601129:AAG30duOIf-X_oQfbcWpNovFiXM1AKVPHtM';
const ADMIN_CHAT_ID = '7762718167';
const MERCHANT_UPI_ID = 'risabhkumarkushwaha@okhdfcbank';
const MERCHANT_NAME = 'Royal Win Official';

const SUPPORT_LINKS = {
    agent: 'https://t.me/Joce1991',
    customerService: 'https://t.me/AlianaMentor'
};

// ================= PERSISTENT DATABASE SETUP =================
const DB_FILE = path.join(__dirname, 'database.json');

let db = {
    users: {
        'player_1001': {
            id: 'player_1001',
            username: 'RoyalPlayer1001',
            phone: '9876543210',
            balance: 100.00,
            totalDeposited: 100.00,
            totalWithdrawn: 0.00,
            createdAt: new Date().toISOString()
        }
    },
    deposits: {},
    withdrawals: {},
    wingoHistory: [],
    betHistory: [],
    stats: {
        totalDepositsApproved: 0,
        totalWithdrawalsApproved: 0,
        houseProfit: 0
    }
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            db = { ...db, ...parsed };
            console.log('✅ Database loaded successfully.');
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error('Database load error:', err.message);
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
        console.error('Database save error:', err.message);
    }
}

loadDatabase();

// ================= TELEGRAM BOT INITIALIZATION =================
let bot = null;
try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('🤖 Royal Win Telegram Bot Active & Listening...');

    bot.on('polling_error', (err) => {
        console.error('Telegram Polling Warning:', err.message);
    });

    // Admin Bot Commands
    bot.onText(/\/start/, (msg) => {
        if (String(msg.chat.id) === String(ADMIN_CHAT_ID)) {
            bot.sendMessage(
                ADMIN_CHAT_ID,
                `👑 *Welcome to ${APP_NAME} Admin Panel*\n\n` +
                `✅ Bot is connected and monitoring deposits & withdrawals.\n\n` +
                `*Commands:*\n` +
                `/stats - View Platform Profit & Balance Stats\n` +
                `/pending - View Pending Deposit Requests`,
                { parse_mode: 'Markdown' }
            );
        }
    });

    bot.onText(/\/stats/, (msg) => {
        if (String(msg.chat.id) !== String(ADMIN_CHAT_ID)) return;
        const userCount = Object.keys(db.users).length;
        const text = `📊 *${APP_NAME} Live Statistics*\n\n` +
            `👥 *Total Users:* ${userCount}\n` +
            `💰 *Total Approved Deposits:* ₹${db.stats.totalDepositsApproved}\n` +
            `🏦 *Total Approved Withdrawals:* ₹${db.stats.totalWithdrawalsApproved}\n` +
            `📈 *Net House Game Profit:* ₹${db.stats.houseProfit.toFixed(2)}`;
        bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/pending/, (msg) => {
        if (String(msg.chat.id) !== String(ADMIN_CHAT_ID)) return;
        const pendingDeps = Object.values(db.deposits).filter(d => d.status === 'PENDING');
        if (pendingDeps.length === 0) {
            return bot.sendMessage(ADMIN_CHAT_ID, '✅ No pending deposits right now.');
        }
        pendingDeps.forEach(dep => {
            sendDepositTelegramAlert(dep);
        });
    });

} catch (error) {
    console.error('Failed to initialize Telegram Bot:', error.message);
}

function sendDepositTelegramAlert(deposit) {
    if (!bot) return;
    const message = `🔔 *NEW DEPOSIT REQUEST (${APP_NAME})*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *Order ID:* \`${deposit.id}\`\n` +
        `👤 *User ID:* \`${deposit.userId}\`\n` +
        `💵 *Amount:* *₹${deposit.amount}*\n` +
        `🔢 *UTR / Ref No:* \`${deposit.utr}\`\n` +
        `🏦 *UPI Paid To:* \`${MERCHANT_UPI_ID}\`\n` +
        `🕒 *Time:* ${deposit.timestamp}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 *Click below after verifying payment in your bank app:*`;

    bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `✅ Approve ₹${deposit.amount}`, callback_data: `dep_approve_${deposit.id}` },
                    { text: '❌ Reject', callback_data: `dep_reject_${deposit.id}` }
                ]
            ]
        }
    }).catch(err => console.error('Telegram Deposit Alert Error:', err.message));
}

function sendWithdrawalTelegramAlert(withdrawal) {
    if (!bot) return;
    const message = `🏧 *NEW WITHDRAWAL REQUEST (${APP_NAME})*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *Withdraw ID:* \`${withdrawal.id}\`\n` +
        `👤 *User ID:* \`${withdrawal.userId}\`\n` +
        `💸 *Amount:* *₹${withdrawal.amount}*\n` +
        `📲 *User UPI ID:* \`${withdrawal.upiId}\`\n` +
        `🕒 *Time:* ${withdrawal.timestamp}\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

    bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Mark Paid', callback_data: `wit_approve_${withdrawal.id}` },
                    { text: '❌ Reject & Refund', callback_data: `wit_reject_${withdrawal.id}` }
                ]
            ]
        }
    }).catch(err => console.error('Telegram Withdraw Alert Error:', err.message));
}

// Handle Admin Inline Button Clicks on Telegram
if (bot) {
    bot.on('callback_query', (query) => {
        const data = query.data || '';
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        if (String(chatId) !== String(ADMIN_CHAT_ID)) {
            return bot.answerCallbackQuery(query.id, { text: 'Unauthorized Admin!', show_alert: true });
        }

        if (data.startsWith('dep_approve_') || data.startsWith('dep_reject_')) {
            const parts = data.split('_');
            const action = parts[1] === 'approve' ? 'APPROVE' : 'REJECT';
            const depositId = parts[2];
            const result = handleDepositDecision(depositId, action);

            if (result.success) {
                const badge = action === 'APPROVE' ? '✅ APPROVED & CHIPS ADDED' : '❌ REJECTED';
                bot.editMessageText(`${query.message.text}\n\n*Status:* ${badge}`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
                bot.answerCallbackQuery(query.id, { text: badge });
            } else {
                bot.answerCallbackQuery(query.id, { text: result.error, show_alert: true });
            }
        }

        if (data.startsWith('wit_approve_') || data.startsWith('wit_reject_')) {
            const parts = data.split('_');
            const action = parts[1] === 'approve' ? 'APPROVE' : 'REJECT';
            const withdrawId = parts[2];
            const result = handleWithdrawalDecision(withdrawId, action);

            if (result.success) {
                const badge = action === 'APPROVE' ? '✅ PAID SUCCESSFULLY' : '❌ REJECTED & REFUNDED';
                bot.editMessageText(`${query.message.text}\n\n*Status:* ${badge}`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
                bot.answerCallbackQuery(query.id, { text: badge });
            } else {
                bot.answerCallbackQuery(query.id, { text: result.error, show_alert: true });
            }
        }
    });
}

// ================= CORE TRANSACTION HANDLERS =================

function handleDepositDecision(depositId, action) {
    const dep = db.deposits[depositId];
    if (!dep) return { success: false, error: 'Deposit ID not found' };
    if (dep.status !== 'PENDING') return { success: false, error: `Already ${dep.status}` };

    const user = db.users[dep.userId];
    if (!user) return { success: false, error: 'User not found' };

    if (action === 'APPROVE') {
        dep.status = 'APPROVED';
        user.balance = +(user.balance + dep.amount).toFixed(2);
        user.totalDeposited = +(user.totalDeposited + dep.amount).toFixed(2);
        db.stats.totalDepositsApproved += dep.amount;
        saveDatabase();

        io.to(dep.userId).emit('wallet_updated', {
            balance: user.balance,
            type: 'DEPOSIT_APPROVED',
            message: `🎉 ₹${dep.amount} Deposit Approved! Chips added to your wallet.`
        });
        io.to(dep.userId).emit('transactions_updated', getUserTransactions(dep.userId));
        return { success: true, status: 'APPROVED', balance: user.balance };
    } else {
        dep.status = 'REJECTED';
        saveDatabase();

        io.to(dep.userId).emit('wallet_updated', {
            balance: user.balance,
            type: 'DEPOSIT_REJECTED',
            message: `❌ Deposit of ₹${dep.amount} (UTR: ${dep.utr}) was rejected.`
        });
        io.to(dep.userId).emit('transactions_updated', getUserTransactions(dep.userId));
        return { success: true, status: 'REJECTED' };
    }
}

function handleWithdrawalDecision(withdrawId, action) {
    const wit = db.withdrawals[withdrawId];
    if (!wit) return { success: false, error: 'Withdrawal not found' };
    if (wit.status !== 'PENDING') return { success: false, error: `Already ${wit.status}` };

    const user = db.users[wit.userId];
    if (!user) return { success: false, error: 'User not found' };

    if (action === 'APPROVE') {
        wit.status = 'APPROVED';
        user.totalWithdrawn = +(user.totalWithdrawn + wit.amount).toFixed(2);
        db.stats.totalWithdrawalsApproved += wit.amount;
        saveDatabase();

        io.to(wit.userId).emit('wallet_updated', {
            balance: user.balance,
            type: 'WITHDRAW_APPROVED',
            message: `✅ Withdrawal of ₹${wit.amount} has been sent to ${wit.upiId}!`
        });
        io.to(wit.userId).emit('transactions_updated', getUserTransactions(wit.userId));
        return { success: true, status: 'APPROVED' };
    } else {
        wit.status = 'REJECTED';
        user.balance = +(user.balance + wit.amount).toFixed(2); // Refund balance
        saveDatabase();

        io.to(wit.userId).emit('wallet_updated', {
            balance: user.balance,
            type: 'WITHDRAW_REJECTED',
            message: `⚠️ Withdrawal of ₹${wit.amount} rejected. Amount refunded to wallet.`
        });
        io.to(wit.userId).emit('transactions_updated', getUserTransactions(wit.userId));
        return { success: true, status: 'REJECTED' };
    }
}

function getUserTransactions(userId) {
    const deps = Object.values(db.deposits)
        .filter(d => d.userId === userId)
        .map(d => ({ ...d, txType: 'DEPOSIT' }));
    const wits = Object.values(db.withdrawals)
        .filter(w => w.userId === userId)
        .map(w => ({ ...w, txType: 'WITHDRAW' }));
    return [...deps, ...wits].reverse().slice(0, 20);
}

// ================= REST API ENDPOINTS =================

app.get('/api/config', (req, res) => {
    res.json({
        appName: APP_NAME,
        upiId: MERCHANT_UPI_ID,
        merchantName: MERCHANT_NAME,
        support: SUPPORT_LINKS
    });
});

app.post('/api/auth/session', (req, res) => {
    let { userId, username } = req.body;
    if (!userId) userId = 'player_' + Math.floor(1000 + Math.random() * 9000);

    if (!db.users[userId]) {
        db.users[userId] = {
            id: userId,
            username: username || `Royal_${userId.slice(-4)}`,
            balance: 0.00,
            totalDeposited: 0.00,
            totalWithdrawn: 0.00,
            createdAt: new Date().toISOString()
        };
        saveDatabase();
    }

    res.json({
        user: db.users[userId],
        transactions: getUserTransactions(userId),
        myBets: db.betHistory.filter(b => b.userId === userId).slice(0, 20)
    });
});

app.post('/api/deposit', (req, res) => {
    const { userId, amount, utr } = req.body;
    const numAmount = parseFloat(amount);

    if (!userId || !db.users[userId]) return res.status(400).json({ error: 'User session invalid' });
    if (isNaN(numAmount) || numAmount < 100) return res.status(400).json({ error: 'Minimum deposit is ₹100' });
    if (!utr || !/^\d{12}$/.test(utr.trim())) {
        return res.status(400).json({ error: 'Please enter a valid 12-digit numeric UTR number' });
    }

    const cleanUtr = utr.trim();
    const duplicate = Object.values(db.deposits).find(d => d.utr === cleanUtr);
    if (duplicate) return res.status(400).json({ error: 'This UTR number has already been submitted!' });

    const depositId = 'DEP' + Date.now().toString().slice(-6);
    const depositRecord = {
        id: depositId,
        userId,
        amount: numAmount,
        utr: cleanUtr,
        status: 'PENDING',
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    db.deposits[depositId] = depositRecord;
    saveDatabase();

    // Send instant notification to Telegram Bot
    sendDepositTelegramAlert(depositRecord);

    res.json({
        success: true,
        message: 'Deposit request submitted! Admin is verifying your UTR.',
        deposit: depositRecord,
        transactions: getUserTransactions(userId)
    });
});

app.post('/api/withdraw', (req, res) => {
    const { userId, amount, upiId } = req.body;
    const numAmount = parseFloat(amount);

    if (!userId || !db.users[userId]) return res.status(400).json({ error: 'Invalid user' });
    const user = db.users[userId];

    if (isNaN(numAmount) || numAmount < 200) return res.status(400).json({ error: 'Minimum withdrawal is ₹200' });
    if (user.balance < numAmount) return res.status(400).json({ error: 'Insufficient wallet balance' });
    if (!upiId || !upiId.includes('@')) return res.status(400).json({ error: 'Enter a valid UPI ID (e.g. name@okaxis)' });

    user.balance = +(user.balance - numAmount).toFixed(2);
    const withdrawId = 'WIT' + Date.now().toString().slice(-6);
    const withdrawRecord = {
        id: withdrawId,
        userId,
        amount: numAmount,
        upiId: upiId.trim(),
        status: 'PENDING',
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    db.withdrawals[withdrawId] = withdrawRecord;
    saveDatabase();

    sendWithdrawalTelegramAlert(withdrawRecord);

    res.json({
        success: true,
        balance: user.balance,
        message: 'Withdrawal request submitted!',
        transactions: getUserTransactions(userId)
    });
});

// ================= GAME 1: WINGO 30s (LEAST-BET-WINS ENGINE) =================
/**
 * WINGO RULES & PAYOUTS:
 * - Numbers: 0 to 9 (9x payout)
 * - GREEN: 1, 3, 7, 9 (2x payout) | 5 (1.5x payout)
 * - RED: 2, 4, 6, 8 (2x payout) | 0 (1.5x payout)
 * - VIOLET: 0, 5 (4.5x payout)
 * - BIG: 5, 6, 7, 8, 9 (2x payout)
 * - SMALL: 0, 1, 2, 3, 4 (2x payout)
 *
 * HOUSE ALGORITHM:
 * Before announcing the result, the server tests all 10 outcomes (0 to 9),
 * calculates the exact payout liability for each outcome across ALL active bets,
 * and picks the outcome that pays out the LEAST money!
 */

let wingoPeriod = Number(new Date().toISOString().slice(0, 10).replace(/-/g, '') + '0001');
if (db.wingoHistory.length > 0) {
    wingoPeriod = Number(db.wingoHistory[0].period) + 1;
}
let wingoTimer = 30;
let activeWingoBets = [];

function getNumberAttributes(num) {
    const size = num >= 5 ? 'BIG' : 'SMALL';
    let color = 'RED';
    if (num === 0) color = 'RED_VIOLET';
    else if (num === 5) color = 'GREEN_VIOLET';
    else if ([1, 3, 7, 9].includes(num)) color = 'GREEN';
    return { number: num, color, size };
}

function calculatePayoutForBet(bet, candidateNum) {
    const attr = getNumberAttributes(candidateNum);
    const sel = bet.selection;
    const amt = bet.amount;

    // Color selections
    if (sel === 'GREEN') {
        if (attr.color === 'GREEN') return amt * 2;
        if (attr.color === 'GREEN_VIOLET') return amt * 1.5;
        return 0;
    }
    if (sel === 'RED') {
        if (attr.color === 'RED') return amt * 2;
        if (attr.color === 'RED_VIOLET') return amt * 1.5;
        return 0;
    }
    if (sel === 'VIOLET') {
        if (attr.color.includes('VIOLET')) return amt * 4.5;
        return 0;
    }

    // Size selections
    if (sel === 'BIG' && attr.size === 'BIG') return amt * 2;
    if (sel === 'SMALL' && attr.size === 'SMALL') return amt * 2;

    // Exact Number selections ('0' - '9')
    if (String(sel) === String(candidateNum)) return amt * 9;

    return 0;
}

function selectLeastPayoutWinningNumber(bets) {
    // If no bets were placed in this round, return a completely random number
    if (!bets || bets.length === 0) {
        return Math.floor(Math.random() * 10);
    }

    let minPayout = Infinity;
    let bestCandidates = [];

    // Evaluate liability for each possible number 0 through 9
    for (let num = 0; num <= 9; num++) {
        let totalLiability = 0;
        for (const bet of bets) {
            totalLiability += calculatePayoutForBet(bet, num);
        }

        if (totalLiability < minPayout) {
            minPayout = totalLiability;
            bestCandidates = [num];
        } else if (totalLiability === minPayout) {
            bestCandidates.push(num);
        }
    }

    // Pick randomly among the tied lowest-payout numbers so pattern looks natural
    const chosenIndex = Math.floor(Math.random() * bestCandidates.length);
    return bestCandidates[chosenIndex];
}

setInterval(() => {
    wingoTimer--;

    if (wingoTimer <= 0) {
        // 1. Determine Winning Number using Least-Bet-Wins Algorithm
        const winningNum = selectLeastPayoutWinningNumber(activeWingoBets);
        const winAttr = getNumberAttributes(winningNum);

        let totalRoundCollection = 0;
        let totalRoundPayout = 0;

        // 2. Settle all active bets
        activeWingoBets.forEach(bet => {
            totalRoundCollection += bet.amount;
            const payout = +(calculatePayoutForBet(bet, winningNum)).toFixed(2);
            totalRoundPayout += payout;

            // Update bet history record
            const histItem = db.betHistory.find(b => b.id === bet.id);
            if (histItem) {
                histItem.status = payout > 0 ? 'WON' : 'LOST';
                histItem.winAmount = payout;
                histItem.resultNumber = winningNum;
            }

            if (payout > 0 && db.users[bet.userId]) {
                db.users[bet.userId].balance = +(db.users[bet.userId].balance + payout).toFixed(2);
                io.to(bet.userId).emit('wingo_personal_result', {
                    won: true,
                    period: wingoPeriod,
                    selection: bet.selection,
                    winAmount: payout,
                    balance: db.users[bet.userId].balance
                });
            } else if (db.users[bet.userId]) {
                io.to(bet.userId).emit('wingo_personal_result', {
                    won: false,
                    period: wingoPeriod,
                    selection: bet.selection,
                    winAmount: 0,
                    balance: db.users[bet.userId].balance
                });
            }
        });

        db.stats.houseProfit += (totalRoundCollection - totalRoundPayout);

        // 3. Save Period Result (Notice: No bet amounts/pools are exposed!)
        const roundRecord = {
            period: String(wingoPeriod),
            number: winningNum,
            color: winAttr.color,
            size: winAttr.size,
            time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        };

        db.wingoHistory.unshift(roundRecord);
        if (db.wingoHistory.length > 15) db.wingoHistory.pop();
        saveDatabase();

        // 4. Broadcast Public Result (Only period, number, color, size — NEVER bet pools)
        io.emit('wingo_round_end', {
            result: roundRecord,
            history: db.wingoHistory
        });

        // 5. Reset for next round
        activeWingoBets = [];
        wingoPeriod++;
        wingoTimer = 30;
    }

    // Broadcast Timer Tick (Without any bet pool data)
    io.emit('wingo_tick', {
        period: String(wingoPeriod),
        timer: wingoTimer,
        locked: wingoTimer <= 5
    });
}, 1000);

app.post('/api/wingo/bet', (req, res) => {
    const { userId, selection, amount } = req.body;
    const betAmount = parseFloat(amount);

    if (wingoTimer <= 5) {
        return res.status(400).json({ error: 'Betting is locked for the final 5 seconds!' });
    }
    if (!userId || !db.users[userId]) {
        return res.status(400).json({ error: 'Invalid user session' });
    }
    const user = db.users[userId];
    if (isNaN(betAmount) || betAmount < 10) {
        return res.status(400).json({ error: 'Minimum bet is ₹10' });
    }
    if (user.balance < betAmount) {
        return res.status(400).json({ error: 'Insufficient balance! Please deposit chips.' });
    }

    user.balance = +(user.balance - betAmount).toFixed(2);

    const betObj = {
        id: 'BET' + uuidv4().slice(0, 6).toUpperCase(),
        userId,
        game: 'WINGO',
        period: String(wingoPeriod),
        selection,
        amount: betAmount,
        status: 'PENDING',
        winAmount: 0,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    activeWingoBets.push(betObj);
    db.betHistory.unshift(betObj);
    if (db.betHistory.length > 200) db.betHistory.pop();
    saveDatabase();

    res.json({
        success: true,
        balance: user.balance,
        bet: betObj,
        myBets: db.betHistory.filter(b => b.userId === userId).slice(0, 20)
    });
});

// ================= GAME 2: CHICKEN ROAD (HOUSE-PROTECTED) =================

const CHICKEN_MULTIPLIERS = {
    EASY: [1.15, 1.35, 1.65, 2.05, 2.60, 3.40, 4.50],
    MEDIUM: [1.28, 1.70, 2.35, 3.30, 4.80, 7.20, 11.50],
    HARD: [1.50, 2.40, 4.00, 7.00, 12.50, 22.00, 40.00]
};

const chickenSessions = {};

app.post('/api/chicken/start', (req, res) => {
    const { userId, amount, difficulty = 'MEDIUM' } = req.body;
    const betAmount = parseFloat(amount);

    if (!userId || !db.users[userId]) return res.status(400).json({ error: 'Invalid user' });
    const user = db.users[userId];

    if (isNaN(betAmount) || betAmount < 10) return res.status(400).json({ error: 'Minimum bet is ₹10' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance!' });

    const multList = CHICKEN_MULTIPLIERS[difficulty] || CHICKEN_MULTIPLIERS.MEDIUM;
    user.balance = +(user.balance - betAmount).toFixed(2);
    db.stats.houseProfit += betAmount;
    saveDatabase();

    // House-Protected Trap Generation: Higher bets increase early fire trap probability
    let baseRisk = difficulty === 'HARD' ? 0.45 : difficulty === 'MEDIUM' ? 0.32 : 0.22;
    if (betAmount >= 500) baseRisk += 0.18;
    if (betAmount >= 1000) baseRisk += 0.20;

    const road = multList.map((_, idx) => {
        const stepRisk = baseRisk + (idx * 0.08);
        return Math.random() < stepRisk ? 'FIRE' : 'SAFE';
    });

    // Guarantee at least one trap so house is protected from max multiplier drain
    if (!road.includes('FIRE')) {
        const forcedTrapIndex = betAmount >= 200 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 6) + 1;
        road[forcedTrapIndex] = 'FIRE';
    }

    chickenSessions[userId] = {
        active: true,
        betAmount,
        difficulty,
        multipliers: multList,
        currentStep: -1,
        currentMultiplier: 1.0,
        road
    };

    res.json({
        success: true,
        balance: user.balance,
        multipliers: multList
    });
});

app.post('/api/chicken/step', (req, res) => {
    const { userId } = req.body;
    const session = chickenSessions[userId];
    if (!session || !session.active) return res.status(400).json({ error: 'No active Chicken Road game' });

    const nextStep = session.currentStep + 1;
    const outcome = session.road[nextStep];

    if (outcome === 'FIRE') {
        session.active = false;
        db.betHistory.unshift({
            id: 'CHK' + uuidv4().slice(0, 5).toUpperCase(),
            userId,
            game: 'CHICKEN_ROAD',
            period: `Step ${nextStep + 1}`,
            selection: session.difficulty,
            amount: session.betAmount,
            status: 'LOST',
            winAmount: 0,
            timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
        saveDatabase();

        return res.json({
            status: 'CRASHED',
            step: nextStep,
            road: session.road,
            balance: db.users[userId].balance
        });
    }

    session.currentStep = nextStep;
    session.currentMultiplier = session.multipliers[nextStep];
    const potentialWin = +(session.betAmount * session.currentMultiplier).toFixed(2);

    // If final step reached safely, auto-cashout
    if (nextStep >= session.multipliers.length - 1) {
        session.active = false;
        db.users[userId].balance = +(db.users[userId].balance + potentialWin).toFixed(2);
        db.stats.houseProfit -= potentialWin;
        saveDatabase();

        return res.json({
            status: 'MAX_WIN',
            step: nextStep,
            multiplier: session.currentMultiplier,
            winAmount: potentialWin,
            balance: db.users[userId].balance,
            road: session.road
        });
    }

    res.json({
        status: 'SAFE',
        step: nextStep,
        multiplier: session.currentMultiplier,
        potentialWin
    });
});

app.post('/api/chicken/cashout', (req, res) => {
    const { userId } = req.body;
    const session = chickenSessions[userId];
    if (!session || !session.active || session.currentStep < 0) {
        return res.status(400).json({ error: 'Complete at least 1 step before cashing out!' });
    }

    const winAmount = +(session.betAmount * session.currentMultiplier).toFixed(2);
    session.active = false;
    db.users[userId].balance = +(db.users[userId].balance + winAmount).toFixed(2);
    db.stats.houseProfit -= winAmount;

    db.betHistory.unshift({
        id: 'CHK' + uuidv4().slice(0, 5).toUpperCase(),
        userId,
        game: 'CHICKEN_ROAD',
        period: `${session.currentMultiplier}x`,
        selection: session.difficulty,
        amount: session.betAmount,
        status: 'WON',
        winAmount,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    saveDatabase();

    res.json({
        success: true,
        winAmount,
        balance: db.users[userId].balance,
        road: session.road
    });
});

// ================= GAME 3: ROYAL DICE DUEL (LEAST-BET-WINS INSTANT) =================
// Players pick LOW (1-3), EXACT 4, or HIGH (5-6). Server evaluates or applies house edge.
app.post('/api/dice/play', (req, res) => {
    const { userId, choice, amount } = req.body;
    const betAmount = parseFloat(amount);

    if (!userId || !db.users[userId]) return res.status(400).json({ error: 'Invalid user' });
    const user = db.users[userId];
    if (isNaN(betAmount) || betAmount < 10) return res.status(400).json({ error: 'Min bet is ₹10' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance' });

    user.balance = +(user.balance - betAmount).toFixed(2);

    // Smart House Protection: 70% chance to pick the side where player didn't bet
    const winChance = betAmount >= 200 ? 0.20 : 0.32;
    const playerWins = Math.random() < winChance;

    let diceRoll = 1;
    let payout = 0;

    if (playerWins) {
        if (choice === 'LOW') {
            diceRoll = [1, 2, 3][Math.floor(Math.random() * 3)];
            payout = +(betAmount * 1.95).toFixed(2);
        } else if (choice === 'HIGH') {
            diceRoll = [4, 5, 6][Math.floor(Math.random() * 3)];
            payout = +(betAmount * 1.95).toFixed(2);
        } else if (choice === 'JACKPOT_6') {
            diceRoll = 6;
            payout = +(betAmount * 5.0).toFixed(2);
        }
    } else {
        if (choice === 'LOW') {
            diceRoll = [4, 5, 6][Math.floor(Math.random() * 3)];
        } else if (choice === 'HIGH') {
            diceRoll = [1, 2, 3][Math.floor(Math.random() * 3)];
        } else {
            diceRoll = [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)];
        }
    }

    if (payout > 0) {
        user.balance = +(user.balance + payout).toFixed(2);
    }
    db.stats.houseProfit += (betAmount - payout);
    saveDatabase();

    res.json({
        success: true,
        diceRoll,
        won: payout > 0,
        winAmount: payout,
        balance: user.balance
    });
});

// ================= SOCKET.IO REAL-TIME CONNECTION =================
io.on('connection', (socket) => {
    socket.on('join_user', (userId) => {
        if (!userId) return;
        socket.join(userId);
        socket.emit('wingo_init', {
            period: String(wingoPeriod),
            timer: wingoTimer,
            locked: wingoTimer <= 5,
            history: db.wingoHistory
        });
    });
});

server.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`👑 ${APP_NAME} Server Running on http://localhost:${PORT}`);
    console.log(`💳 UPI ID Configured: ${MERCHANT_UPI_ID}`);
    console.log(`🤖 Telegram Admin Chat ID: ${ADMIN_CHAT_ID}`);
    console.log(`=================================================`);
});
