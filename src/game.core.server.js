/*  ----------------------------- Key variables  -----------------------------   */

import fs from 'fs';

const FRAME_TIME = 45;
const MAX_HAND_SIZE = 10;
const cards = JSON.parse(fs.readFileSync('src/json/cards.json'));

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
	constructor(gameInstance) {
		this.instance = gameInstance; //Store the instance, if any
		this.server = this.instance !== undefined; //Store a flag if server

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
	};

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
	};

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
	handleServerInput(client, input, input_time, input_seq) {
		//Fetch which client this refers to out of the two
		const player_client = (client.userid == this.players.self.instance.userid) ? this.players.self : this.players.other;
		const player_other = (client.userid == this.players.self.instance.userid) ?  this.players.other : this.players.self;

		if (input) {
			//var c = input.length;
			try { var input_parts = input.split('.'); } catch(err) { var input_parts = input;} // handle input accordingly
			const target = [];

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

				if (this.board.check_win() !== undefined || (this.players.self.deck.length === 0 && this.players.self.hand.length === 0) || (this.players.self.deck.length === 0 && this.players.self.hand.length === 0) ){ //check for win
					console.log('The game was won');
					this.win = this.board.check_win() !== undefined ? this.board.check_win() : 1;
					
					//Update mmrs, via elo
					console.log('Existing MMRs >> ' + this.players.self.mmr + ' vs. ' + this.players.other.mmr);

					var host_prob = 1 / (1 + Math.pow(10, (-this.players.self.mmr - this.players.other.mmr )/400));
					var other_prob = 1 / (1 + Math.pow(10, (-this.players.other.mmr - this.players.self.mmr )/400));
					host_prob = this.win === 1 ? (1 - host_prob) : (- host_prob);
					other_prob = this.win === 1 ? (- other_prob) : (1 - other_prob);
					player_client.instance.send('s.m.' + Number(host_prob).toFixed(3));
					player_other.instance.send('s.m.' + Number(other_prob).toFixed(3));
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
		// Check for discard
		if (player.state.discarding > 0) {
			player.state.discarding--;
			return;
		}

		var cardEffects = [];
		for (var j = 0; j < cards.length; j++){
			if (cards[j].name === card){
				cardEffects = cards[j].effects;
			}
		}

		var conditionIf = new RegExp("^if$", "i"),
			conditionLeast = new RegExp("^least$", "i"),
			deal = new RegExp("^deal$|^damage$", "i"),     // ^x$ dictates explicit regex matching
			destroy = new RegExp("^destroy$|^remove$", "i"),
			draw = new RegExp("^draw$|^draws$", "i"),
			one = new RegExp("^a$|^1$", "i"),
			every = new RegExp("^all$|^every$", "i"),
			endTurn = new RegExp("^end$", "i"),
			targetSelf = new RegExp("^you$|^your$|^yours$", "i"),
			targetEnemy = new RegExp("^enemy$|^opponent$", "i"),
			freeze = new RegExp("^freeze$", "i"),
			thaw = new RegExp("^thaw$", "i"),
			shield = new RegExp("^shield$|^shields$", "i"),
			block = new RegExp("^block$", "i"),
			discard = new RegExp("^discard$", "i"),
			piece = new RegExp("^piece$|pieces$|pieces,$", "i"),
			hand = new RegExp("^hand$|^hands$", "i");
			//= new RegExp("", "i"),

		for (var i = 0; i < cardEffects.length; i++){
			var effect = cardEffects[i].split(' ');

			if (effect[0] && effect[0].match(endTurn)) { // End turn
				player.state.cards_to_play = 0;
				player.state.pieces_to_play = 0;
			} else if (effect[0] && effect[0].match(deal)) { // Dealing damage
				if (effect[1] && effect[1].match(one)){ // Damage one
					if (effect[4] && effect[4].match(targetSelf)){
						player.state.damagingS = 1;
					} else if (effect[4] && effect[4].match(targetEnemy)){
						player.state.damagingE = 1;
					} else {
						player.state.damagingA = 1;
					}
				} else if (effect[1] && effect[1].match(every)) { // Damage all
					for (var k = 0; k < 4; k++) {
						for (var l = 0; l < 4; l++) {
							if (this.board.state.shields[k][l] === 1) {
								this.board.state.shields[k][l] = 0;
							} else if (this.board.state.results[k][l] !== 0) {
								this.board.state.results[k][l] = 0;
							}
						}
					}
				} else { // else damage many
					if (effect[4] && effect[4].match(targetSelf)) {
						player.state.damagingS = effect[1];
					} else if (effect[4] && effect[4].match(targetEnemy)){
						player.state.damagingE = effect[1];
					} else {
						player.state.damagingA = effect[1];
					}
				}
			} else if (effect[0] && effect[0].match(destroy)) { // Destroying piece or shield
				if (effect[2] && effect[2].match(shield)){ //if shield
					if (effect[1] && effect[1].match(one)){
						player.state.deshielding = 1;
					} else if (effect[1] && effect[1].match(every)) { // Deshield all
						for (var k = 0; k < 4; k++) {
							for (var l = 0; l < 4; l++) {
								this.board.state.shields[k][l] = 0;
							}
						}
					} else { //else deshield many
						player.state.deshielding = effect[1];
					}
				} else { //
					if (effect[1] && effect[1].match(one)){
						if (effect[4] && effect[4].match(targetSelf)) {
							player.state.destroyingS = 1;
						}  else if (effect[4] && effect[4].match(targetEnemy)){
							player.state.destroyingE = 1;
						} else {
							player.state.destroyingA = 1;
						}
					} else if (effect[1] && effect[1].match(every)) { // Destroy all
						for (var k = 0; k < 4; k++){ 
							for (var l = 0; l < 4; l++){
								this.board.state.results[k][l] = 0;
								this.board.state.shields[k][l] = 0;
							}
						}
					} else { //else many
						if (effect[4] && effect[4].match(targetSelf)) {
							player.state.destroyingS = effect[1];
						} else if (effect[4] && effect[4].match(targetEnemy)){
							player.state.destroyingE = effect[1];
						} else {
							player.state.destroyingA = effect[1];
						}
					}
				}
			} else if (effect[0] && effect[0].match(draw)){ // Drawing cards
				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					if (player.deck.length > 0 && player.hand.length < MAX_HAND_SIZE) {
						player.hand.push(player.deck[0]);
						player.deck.splice(0, 1);
					} else {
					}
				} else { //else many
					for (var i = 0; i < effect[1]; i++) {
						if (player.deck.length > 0 && player.hand.length < MAX_HAND_SIZE) {
							player.hand.push(player.deck[0]);
							player.deck.splice(0, 1);
						}
					}
				}
			} else if (effect[0] && effect[0].match(freeze)){ // Freeze

				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					player.state.freezing = 1;
				} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
					for (var i = 0; i < 4; i++) {
						for (var j = 0; j < 4; j++) {
							if (this.board.state.results[i][j] === 0 && this.board.state.rock[i][j] === 0) {
								this.board.state.frost[i][j] = 4;
							}
						}
					}
				} else { //else many
					player.state.freezing = effect[1];
				}
			} else if (effect[0] && effect[0].match(thaw)){ // Thaw
				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					player.state.thawing = 1;
				} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
					for (var i = 0; i < 4; i++) {
						for (var j = 0; j < 4; j++) {
							if (this.board.state.frost[i][j] >= 1) {
								this.board.state.frost[i][j] = 0;
							}
						}
					}
				} else { //else many
					player.state.thawing = effect[1];
				}
			} else if (effect[0] && effect[0].match(block)){ // Block/Rock
				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					player.state.blocking = 1;
				} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
					for (var i = 0; i < 4; i++) {
						for (var j = 0; j < 4; j++) {
							if (this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0) {
								this.board.state.rock[i][j] = 6;
							}
						}
					}
				} else { //else many
					player.state.blocking = effect[1];
				}
			} else if (effect[0] && effect[0].match(shield)){ // Shielding
				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					player.state.shielding = 1;
				} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
					for (var i = 0; i < 4; i++) {
						for (var j = 0; j < 4; j++) {
							if (this.board.state.shields[i][j] === 0) {
								this.board.state.shields[i][j] = 1;
							}
						}
					}
				} else { //else many
					player.state.shielding = effect[1];
				}
			} else if (effect[0] && effect[0].match(discard)){ //Discarding
				if (effect[1] && effect[1].match(one)){ // Resolves 'a'
					player.state.discarding++;
				} else if (effect[1] && effect[1].match(every)) {
					player.hand = [];
				} else {
					player.state.discarding = player.state.discarding + effect[1]; // Discarding some
				}
			} else if (effect[0] && effect[0].match(targetSelf)){ //You / your
				if (effect[1] && effect[1].match(targetEnemy)){ // Your enemy
					if (effect[2] && effect[2].match(draw)){ // Your enemy draws
						if (effect[1] && effect[1].match(one)){ // Resolves 'a'
							if (enemy.deck.length > 0 && enemy.hand.length < MAX_HAND_SIZE) {
								enemy.hand.push(enemy.deck[0]);
								enemy.deck.splice(0, 1);
							}
						} else {
							for (var i = 0; i < effect[1]; i++) {
								if (enemy.deck.length > 0 && enemy.hand.length < MAX_HAND_SIZE) {
									enemy.hand.push(enemy.deck[0]);
									enemy.deck.splice(0, 1);
								}
							}
						}
					}
				}
			} else if (effect[0] && effect[0].match(conditionIf)){ // Resolves 'If you have the least... return to hand'
				if (effect[1] && effect[1].match(targetSelf)){ // Resolves 'you'
					if (effect[4] && effect[4].match(conditionLeast)) {
						if (effect[5] && effect[5].match(piece)) {
							var piece_counter = 0;
							for (var i = 0; i < 4; i++) {
								for (var j = 0; j < 4; j++) {
									piece_counter = piece_counter + this.board.state.results[i][j];
								}
							}
							console.log('here>>> ' + piece_counter);
							console.log(player === this.players.self);
							if (player === this.players.self && piece_counter < 0 || player !== this.players.self && piece_counter > 0){
								player.hand.push(createCard(card));
							}
						} else if (effect[3] && effect[3].match(shield)) { // You have the least shields
							player.hand.push(card);
						}
					}
				}
			}
		}
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
				if (this.state.frost[i][j] > 0) { this.state.frost[i][j]--};
				if (this.state.rock[i][j] > 0) { this.state.rock[i][j]--};
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
		this.deck = [],
		this.hand = [];

		var deck_temp = JSON.parse(fs.readFileSync('src/json/deck_p1.json'));
		deck_temp = shuffle(deck_temp);
		this.deck = createCardArray(deck_temp);
	}
}

export default GameCore;
