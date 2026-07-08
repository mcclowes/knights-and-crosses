/*  ----------------------------- Key variables  -----------------------------   */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the new card effect system with a static import so that bundlers
// include the resolver file in serverless deployments (e.g. Vercel).
import { resolveCard as resolveCardNew } from './cards/card-resolver.js';
import { logger } from './server/utils/logger.js';

const FRAME_TIME = 45;
const MAX_HAND_SIZE = 10;

// Load JSON assets once at module load. The candidate paths cover dev, build,
// and serverless layouts. Previously these were read from disk (with verbose
// per-attempt logging) on every game/player construction — a hot-path cost and
// a source of log spam. Do it a single time here instead.
function loadJsonAsset(filename, label) {
	const candidatePaths = [
		path.join(__dirname, 'json', filename), // Development path
		path.join(__dirname, '..', 'src', 'json', filename), // Build path
		path.join(process.cwd(), 'src', 'json', filename), // Vercel path
		path.join(process.cwd(), 'public', 'json', filename), // Public fallback
	];
	for (const candidate of candidatePaths) {
		try {
			const data = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
			logger.debug(`[GameCore] Loaded ${label} from ${candidate} (${Array.isArray(data) ? data.length : '?'} entries)`);
			return data;
		} catch {
			// Try the next candidate path.
		}
	}
	logger.error(`[GameCore] Failed to load ${label} (${filename}) from any known path. cwd=${process.cwd()}`);
	return [];
}

const cards = loadJsonAsset('cards.json', 'cards');
const deckTemplate = loadJsonAsset('deck_p1.json', 'deck');

/*  -----------------------------  Frame/Update Handling  -----------------------------   */

// Server-side update mechanism
const updateInterval = FRAME_TIME;

/*  -----------------------------  Helper Functions  -----------------------------  */
// Array shuffle function
const shuffle = (array) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
};

// initialise an array of cards - e.g. for new hand or deck
const createCardArray = (data) => {
	return data.map(item => createCard(item));
};

//Initialise a card
const createCard = (data) => {
	//Depends on format of input data
	return data.cardName !== undefined ? new GameCard(data.cardName) : new GameCard(data);
};

/* ----------------------------- Game Core -----------------------------  */

class GameCore {
	constructor(gameInstance, storage = null) {
		this.instance = gameInstance; //Store the instance, if any
		this.server = this.instance !== undefined; //Store a flag if server
		this.storage = storage; // KV storage for serverless persistence

		this.board = new GameBoard();
		this.turn = 1;

		// Create players
		this.players = {
			self: new GamePlayer(this, this.instance.player_host),
			other: new GamePlayer(this, this.instance.player_client)
		};

		//A local timer for precision
		this.local_time = 0.016;
		this._dt = new Date().getTime();
		this._dte = new Date().getTime();
		this.input_seq = 0;

		//Client specific initialisation
		this.server_time = 0;
		this.laststate = {};
	}

	checkFreeSquare() {
		let space = 0;
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if (this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0) {
					space++;
				}
			}
		}
		return space;
	}

	checkEnemySquare(player) {
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if ((this.players.self === player && this.board.state.results[i][j] === -1) || (this.players.self !== player && this.board.state.results[i][j] === 1)) {
					return true;
				} 
			}
		}
		return false;
	}

	checkSelfSquare(player) {
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if ((this.players.self === player && this.board.state.results[i][j] === 1) || (this.players.self !== player && this.board.state.results[i][j] === -1)) {
					return true;
				} 
			}
		}
		return false;
	}

	// Check that at least one shield exists
	checkShield() {
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if (this.board.state.shields[i][j] !== 0) {
					return true;
				}
			}
		}
		return false;
	}

	// Checks that there is a target to shield
	checkUnshielded() {
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if (this.board.state.shields[i][j] === 0 && this.board.state.results[i][j] !== 0) {
					return true;
				}
			}
		}
		return false;
	}

	checkFrozen() {
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				if (this.board.state.frost[i][j] !== 0) {
					return true;
				}
			}
		}
		return false;
	}

	//satisfy unsatisfyable effects
	satisfyPlayerStates(player) {
		if (player.state.cards_to_play > 0){
			if (player.hand.length <= 0) {
				player.state.cards_to_play--;
			} else {
				return true;
			}
		} else if (player.state.discarding > 0){
			if (player.hand.length <= 0) {
				player.state.discarding--;
			} else {
				return true;
			}
		} else if (player.state.freezing > 0){ // No place to freeze
			if (this.checkFreeSquare() <= 0) {
				player.state.freezing--;
			} else {
				return true;
			}
		} else if (player.state.thawing > 0){
			if(this.checkFrozen() === false){ // No frozen squares to target
				player.state.thawing--;
			} else {
				return true;
			}
		} else if (player.state.blocking > 0){
			if (this.checkFreeSquare() <= 0){ // No place to block
				player.state.blocking--;
			} else {
				return true;
			}
		} else if (player.state.shielding > 0){
			if (this.checkUnshielded() === false){ // Shielding
				player.state.shielding--;
			} else {
				return true;
			}
		} else if (player.state.deshielding > 0) {
			if (this.checkShield() === false){ // Deshielding
				player.state.deshielding--;
			} else {
				return true;
			}
		} else if (player.state.destroyingA > 0){
			if (this.checkEnemySquare(player) === false && this.checkSelfSquare(player) === false) {
				player.state.destroyingA--;
			} else {
				return true;
			}
		} else if (player.state.destroyingS > 0) {
			if (this.checkSelfSquare(player) === false) {
				player.state.destroyingS--;
			} else {
				return true;
			}
		} else if (player.state.destroyingE > 0){
			if (this.checkEnemySquare(player) === false) {
				player.state.destroyingE--;
			} else {
				return true;
			}
		} else if (player.state.damagingA > 0) {
			if (this.checkEnemySquare(player) === false && this.checkSelfSquare(player) === false) {
				player.state.damagingA--;
			} else {
				return true;
			}
		} else if (player.state.damagingS > 0){
			if (this.checkSelfSquare(player) === false) {
				player.state.damagingS--;
			} else {
				return true;
			}
		} else if (player.state.damagingE > 0) {
			if (this.checkEnemySquare(player) === false) {
				player.state.damagingE--;
			} else {
				return true;
			}
		} else if (player.state.pieces_to_play > 0){
			if (this.checkFreeSquare() === 0) { // Placing a piece
				player.state.pieces_to_play--;
			} else {
				return true;
			}
		} else {
			return true;
		}

		return false;
	}

	update(t) {
		this.lastframetime = t;
		this.serverUpdate();
		this.updateid = setTimeout(this.update.bind(this), updateInterval);
	}

	stopUpdate() { 
		clearTimeout(this.updateid);  
	}

	// Updates clients with new game state
	serverUpdate() {	
		this.server_time = this.local_time; 

		if (this.players.self && this.satisfyPlayerStates(this.players.self) === false) {
			//console.log('First player state satisfied.');
		}
		if (this.players.other && this.satisfyPlayerStates(this.players.other) === false) {
			//console.log('Second player state satisfied.');
		}

		this.tempstate = {
			tu 	: this.turn,
			bo 	: this.board.state,
			hp  : this.players.self.state,
			hh  : this.players.self.hand,  
			hd  : this.players.self.deck,               
			cp  : this.players.other.state,
			ch  : this.players.other.hand,  
			cd  : this.players.other.deck,             
			t   : this.server_time                      // current local time
		};

		this.laststate = this.tempstate;

		if (this.players.self.instance) { //Send the snapshot to the 'host' player
			this.players.self.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
		}
		if (this.players.other.instance) { //Send the snapshot to the 'client' player
			this.players.other.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
		}
	}

	//Handle server input (input into the server, from a client)
	handleServerInput(client, input, _input_time, _input_seq) {
		//Fetch which client this refers to out of the two
		const player_client = (client.userid == this.players.self.instance.userid) ? this.players.self : this.players.other;
		const player_other = (client.userid == this.players.self.instance.userid) ?  this.players.other : this.players.self;

		if (input) {
			//var c = input.length;
			let input_parts;
			try { input_parts = input.split('.'); } catch { input_parts = input; } // handle input accordingly
			let target = [];

			if (input_parts[0] == 'en' && player_client !== undefined && player_other !== undefined && ((player_client === this.players.self && this.turn === 1) || (player_client === this.players.other && this.turn === -1))) { //end turn
				this.turn = this.turn == 1 ? -1 : 1;
				//resets
				player_client.state = {
					cards_to_play 	: 0,
					pieces_to_play 	: 0,
					damagingA 		: 0,
					damagingE 		: 0,
					damagingS 		: 0,
					destroyingA 	: 0,
					destroyingE 	: 0,
					destroyingS 	: 0,
					discarding 		: 0,
					shielding 		: 0,
					deshielding 	: 0,
					freezing 		: 0,
					thawing 		: 0,
					blocking 		: 0
				}

				player_other.state = {
					cards_to_play 	: 1,
					pieces_to_play 	: 1,
					damagingA 		: 0,
					damagingE 		: 0,
					damagingS 		: 0,
					destroyingA 	: 0,
					destroyingE 	: 0,
					destroyingS 	: 0,
					discarding 		: 0,
					shielding 		: 0,
					deshielding 	: 0,
					freezing 		: 0,
					thawing 		: 0,
					blocking 		: 0
				}

				const boardWin = this.board.check_win();
				const selfDecked = this.players.self.deck.length === 0 && this.players.self.hand.length === 0;
				const otherDecked = this.players.other.deck.length === 0 && this.players.other.hand.length === 0;

				if (boardWin !== undefined || selfDecked || otherDecked) { // check for win
					// Winner in board terms: 1 = host (self), -1 = client (other).
					// On a deck-out with no completed line, the player who still
					// holds cards wins (previously this only ever checked `self`).
					this.win = boardWin !== undefined
						? boardWin
						: (selfDecked && !otherDecked ? -1 : 1);

					// Elo update (K-factor 32). Expected score uses the standard
					// (opponent - self)/400 exponent (previously (-self-other)/400,
					// which is incorrect).
					const K = 32;
					const selfRating = this.players.self.mmr;
					const otherRating = this.players.other.mmr;
					const expectedSelf = 1 / (1 + Math.pow(10, (otherRating - selfRating) / 400));
					const expectedOther = 1 / (1 + Math.pow(10, (selfRating - otherRating) / 400));
					const scoreSelf = this.win === 1 ? 1 : 0;
					const scoreOther = this.win === -1 ? 1 : 0;
					const selfTerm = scoreSelf - expectedSelf; // normalized (S - E), range [-1, 1]
					const otherTerm = scoreOther - expectedOther;

					// Persist the full Elo delta for Redis-backed player stats.
					this.players.self.mmrChange = K * selfTerm;
					this.players.other.mmrChange = K * otherTerm;

					// Wire protocol: send each player their own (S - E) term; the
					// legacy client applies its own decaying K-factor on screen.
					this.players.self.instance?.send('s.m.' + selfTerm.toFixed(3));
					this.players.other.instance?.send('s.m.' + otherTerm.toFixed(3));

					logger.debug(`[GameCore] Game won by ${this.win === 1 ? 'host' : 'client'}; Elo delta self=${this.players.self.mmrChange.toFixed(1)} other=${this.players.other.mmrChange.toFixed(1)}`);
				} else {
					this.board.reduce_state(); // Remove frost, and rocks
					// Draw card
					if (player_other.deck.length > 0 && player_other.hand.length < MAX_HAND_SIZE) {
						player_other.hand.push(player_other.deck[0]);
						player_other.deck.splice(0, 1);
					}
				}
			} else if (input_parts[0] == 'ca') { // Clicked card
				target = input_parts[1];
				for (var i = player_client.hand.length - 1; i >= 0; i--) {
					if (target === 'skip') {
						player_client.state.cards_to_play--;
					} else if (player_client.hand[i].cardName === target) {
						player_client.hand.splice(i, 1);
						player_client.state.cards_to_play = player_client.state.cards_to_play - 1;
						this.resolve_card(target, player_client, player_other);
						break;
					}
				}
			} else if (input_parts[0] == 'sq') { // Clicked square
				target = input_parts[1];
				this.resolve_square(target[0] - 1, target[1] - 1, player_client);
			} else if (input_parts[0] === 'dr') {
				if (player_client.deck.length > 0 && player_client.hand.length < MAX_HAND_SIZE) { // Draw
					player_client.hand.push(player_client.deck[0]);
					player_client.deck.splice(0, 1);
				} else if (player_client.deck.length > 0 && player_client.hand.length > MAX_HAND_SIZE) { // Overdraw
					player_client.deck.splice(0, 1);
				}
			}

			// Persist state to KV after mutation (critical for serverless)
			this.persistState();
		}
	}

	/**
	 * Persist game state to KV storage
	 * Called after every game state mutation for serverless persistence
	 */
	async persistState() {
		if (!this.storage || !this.instance) {
			return;
		}

		try {
			const gameState = this.serializeState();
			await this.storage.saveGameState(this.instance.id, gameState);
		} catch (error) {
			console.error('[GameCore] Error persisting state to KV:', error);
		}
	}

	resolve_square(row, col, player) {
		//console.log('Target square >>> ' + row + ', ' + col);
		if (this.board.state.results[row][col] !== 0 || this.board.state.frost[row][col] >= 1 || this.board.state.rock[row][col] >= 1){
			if (this.board.state.results[row][col] !== 0) { // Piece
				//console.log('Affecting a piece >>> ' + player.instance === this.players.self.instance );
				if (player.state.destroyingS > 0) { //Destroying self
					//console.log('destroyingS');
					//console.log(player);
					if (((player === this.players.self && this.board.state.results[row][col] === 1) || (player !== this.players.self && this.board.state.results[row][col] === -1))) {
						this.board.state.results[row][col] = 0;
						this.board.state.shields[row][col] = 0;
						player.state.destroyingS--;
					}
				} else if (player.state.destroyingE > 0) { //Destroying enemy
					if (((player === this.players.self && this.board.state.results[row][col] === -1) || (player !== this.players.self && this.board.state.results[row][col] === 1))) {
						this.board.state.results[row][col] = 0;
						this.board.state.shields[row][col] = 0;
						player.state.destroyingE--;
					}
				} else if (player.state.destroyingA > 0) { //Destroying any piece
					this.board.state.results[row][col] = 0;
					this.board.state.shields[row][col] = 0;
					player.state.destroyingA--;
				} else if (player.state.damagingS > 0) { //Damaging Self
					//console.log('damagingS');
					if (((player === this.players.self && this.board.state.results[row][col] === 1) || (player !== this.players.self && this.board.state.results[row][col] === -1))) {
						//console.log('NOOOO?!?!?!');
						if (this.board.state.shields[row][col] === 1) {
							this.board.state.shields[row][col] = 0;
						} else {
							this.board.state.results[row][col] = 0;
						}
						player.state.damagingS--;
					}
				} else if (player.state.damagingE > 0) { //Damaging Enemy
					if (((player === this.players.self && this.board.state.results[row][col] === -1) || (player !== this.players.self && this.board.state.results[row][col] === 1))) {
						if (this.board.state.shields[row][col] === 1) {
							this.board.state.shields[row][col] = 0;
						} else {
							this.board.state.results[row][col] = 0;
						}
						player.state.damagingE--;
					}
				} else if (player.state.damagingA > 0) { //Damaging any piece
					if (this.board.state.shields[row][col] === 1) {
						this.board.state.shields[row][col] = 0;
					} else {
						this.board.state.results[row][col] = 0;
					}
					player.state.damagingA--;
				} else if (player.state.shielding > 0) {
					this.board.state.shields[row][col] = 1;
					player.state.shielding--;
				} else if (player.state.deshielding > 0) {
					this.board.state.shields[row][col] = 0;
					player.state.deshielding--;
				}
			} else if (this.board.state.frost[row][col] >= 1 && player.state.thawing > 0) {
				this.board.state.frost[row][col] = 0;
				player.state.thawing--;
			} else if (this.board.state.rock[row][col] >= 1 && player.state.deblocking > 0) {
				this.board.state.rock[row][col] = 0;
				player.state.blocking--;
			}
		} else { // Cell is empty
			if (player.state.freezing > 0) {
				this.board.state.frost[row][col] = 4;
				player.state.freezing--;
			} else if (player.state.blocking > 0) {
				this.board.state.rock[row][col] = 6;
				player.state.blocking--;
			} else { //place piece
				if (this.board.state.results[row][col] === 0){ // check unoccupied
					player.state.pieces_to_play = player.state.pieces_to_play - 1;
					this.board.state.results[row][col] = this.turn;
					player.state = { // only pieces can be played
						cards_to_play 	: 0,
						pieces_to_play 	: player.state.pieces_to_play - 1,
						damagingA 		: 0,
						damagingE 		: 0,
						damagingS 		: 0,
						destroyingA 	: 0,
						destroyingE 	: 0,
						destroyingS 	: 0,
						discarding 		: 0,
						shielding 		: 0,
						deshielding 	: 0,
						freezing 		: 0,
						thawing 		: 0,
						blocking 		: 0
					}
				}
			}
		}
	}

	// Resolve card effects
	resolve_card(card, player, enemy) {
		// Use the new card effect system
		resolveCardNew(card, player, enemy, this.board, cards);
	}

	/**
	 * Serialize complete game state for storage in KV
	 * Returns a plain object that can be JSON.stringify'd
	 */
	serializeState() {
		return {
			// Board state
			board: {
				results: this.board.state.results,
				frost: this.board.state.frost,
				rock: this.board.state.rock,
				shields: this.board.state.shields
			},
			// Game meta
			turn: this.turn,
			local_time: this.local_time,
			server_time: this.server_time,
			input_seq: this.input_seq,
			// Player self (host)
			player_self: {
				userid: this.players.self.instance?.userid,
				playername: this.players.self.instance?.playername,
				mmr: this.players.self.mmr,
				state: this.players.self.state,
				hand: this.players.self.hand.map(card => ({ cardName: card.cardName })),
				deck: this.players.self.deck.map(card => ({ cardName: card.cardName })),
				discard: this.players.self.discard || []
			},
			// Player other (client)
			player_other: {
				userid: this.players.other.instance?.userid,
				playername: this.players.other.instance?.playername,
				mmr: this.players.other.mmr,
				state: this.players.other.state,
				hand: this.players.other.hand.map(card => ({ cardName: card.cardName })),
				deck: this.players.other.deck.map(card => ({ cardName: card.cardName })),
				discard: this.players.other.discard || []
			},
			// Timestamp for staleness detection
			savedAt: Date.now()
		};
	}

	/**
	 * Restore game state from serialized data
	 * Used when loading a game from KV storage
	 */
	deserializeState(state) {
		// Restore board state
		this.board.state.results = state.board.results;
		this.board.state.frost = state.board.frost;
		this.board.state.rock = state.board.rock;
		this.board.state.shields = state.board.shields;

		// Restore game meta
		this.turn = state.turn;
		this.local_time = state.local_time;
		this.server_time = state.server_time;
		this.input_seq = state.input_seq;

		// Restore player self state
		this.players.self.mmr = state.player_self.mmr;
		this.players.self.state = state.player_self.state;
		this.players.self.hand = createCardArray(state.player_self.hand);
		this.players.self.deck = createCardArray(state.player_self.deck);
		this.players.self.discard = state.player_self.discard || [];

		// Restore player other state
		this.players.other.mmr = state.player_other.mmr;
		this.players.other.state = state.player_other.state;
		this.players.other.hand = createCardArray(state.player_other.hand);
		this.players.other.deck = createCardArray(state.player_other.deck);
		this.players.other.discard = state.player_other.discard || [];

		console.log(`[GameCore] State restored from snapshot taken at ${new Date(state.savedAt).toISOString()}`);
	}
}

/*  -----------------------------  The board class  -----------------------------  */

class GameBoard {
	constructor() {
		this.state = {
			results : [],
			frost 	: [],
			rock 	: [],
			shields : []
		}
		// initialise game board arrays
		for (var i = 0; i < 4; i++){
			this.state.results[i] = [];
			this.state.frost[i] = [];
			this.state.rock[i] = [];
			this.state.shields[i] = [];

			for (var j = 0; j < 4; j++){
				this.state.results[i][j] = 0;
				this.state.frost[i][j] = 0;
				this.state.rock[i][j] = 0;
				this.state.shields[i][j] = 0;
			}
		}
	}

	// Decrement frost and rock array values
	reduce_state() {
		for (var i = 0; i < 4; i++){
			for (var j = 0; j < 4; j++){
				if (this.state.frost[i][j] > 0) { this.state.frost[i][j]-- }
				if (this.state.rock[i][j] > 0) { this.state.rock[i][j]-- }
			}
		}
	}

	//Calls all win condition checks
	check_win() {
		if (this.checkRows() !== undefined){
			return this.checkRows();
		} else if (this.checkCols() !== undefined){
			return this.checkCols();
		} else if (this.checkDiagonals() !== undefined){
			return this.checkDiagonals();
		}
	}

	checkRows() {
		for (var i = 0; i < 4; i++){
			var sum = this.state.results[i][0] + this.state.results[i][1] + this.state.results[i][2] + this.state.results[i][3];
			if (sum === 4 || sum === -4){
				return this.state.results[i][0];
			}
		}
	}

	checkCols() {
		for (var i = 0; i < 4; i++){
			var sum = this.state.results[0][i] + this.state.results[1][i] + this.state.results[2][i] + this.state.results[3][i];
			if (sum === 4 || sum === -4){
				return this.state.results[0][i];
			}
		}
	}

	checkDiagonals() {
		// Right-wards diagonal
		var sum = this.state.results[0][0] + this.state.results[1][1] + this.state.results[2][2] + this.state.results[3][3];
		if (sum === 4 || sum === -4){
			return this.state.results[1][1];
		}
		// Left-wards diagonal
		sum = this.state.results[0][3] + this.state.results[1][2] + this.state.results[2][1] + this.state.results[3][0];
		if (sum === 4 || sum === -4){
			return this.state.results[1][1];
		}
	}
}

/*  -----------------------------  Card class  -----------------------------  */

class GameCard {
	constructor(cardName) {
		this.cardName = cardName;
		this.cardImage = '';

		this.pos = { x:0, y:0 };
		this.size = { x:140, y:210, hx:0, hy:0 };
		this.size.hx = this.size.x/2;
		this.size.hy = this.size.y/2;
	}
}

/*  -----------------------------  The player class -----------------------------  */

class GamePlayer {
	constructor(gameInstance, playerInstance) {
		//Store the instance, if any
		this.instance = playerInstance;
		this.game = gameInstance;
		this.state = 'not-connected';
		this.id = '';
		this.mmr = 1;

		this.state = {
			cards_to_play 	: 0,
			pieces_to_play 	: 0,
			damagingA 		: 0,
			damagingE 		: 0,
			damagingS 		: 0,
			destroyingA 	: 0,
			destroyingE 	: 0,
			destroyingS 	: 0,
			discarding 		: 0,
			shielding 		: 0,
			deshielding 	: 0,
			freezing 		: 0,
			thawing 		: 0,
			blocking 		: 0
		}

		//Player arrays
		this.hand = [];

		// Build a fresh, shuffled deck from the template loaded once at startup.
		// slice() so we shuffle a copy and never mutate the shared template.
		this.deck = createCardArray(shuffle(deckTemplate.slice()));
	}
}

export default GameCore;
