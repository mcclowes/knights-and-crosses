
/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60 / 1000; // run the local game at 16ms/ 60hz
var maxHandSize = 10,
	canvasWidth = 720,
	canvasHeight = 800;

// Card effect list
var cards = [{"name":"Fire Blast","rarity":"Basic","effects":["Deal 1 damage"]},{"name":"Floods","rarity":"Rare","effects":["Destroy all pieces","End your turn"]},{"name":"Armour Up","rarity":"Basic","effects":["Shield a piece","Draw a card"]},{"name":"Flurry","rarity":"Rare","effects":["Deal 2 damage to your pieces","Deal 2 damage to enemy pieces"]},{"name":"Sabotage","rarity":"Elite","effects":["Remove 5 shields"]},{"name":"Summer","rarity":"Basic","effects":["Thaw 1 square","Draw a card"]},{"name":"Ice Blast","rarity":"Basic","effects":["Freeze a square"]},{"name":"Sacrifice","rarity":"Rare","effects":["Destroy a piece of yours","Draw 3 cards"]},{"name":"Boulder","rarity":"Rare","effects":["Discard a card","Block a square"]},{"name":"Frost","rarity":"Basic","effects":["Freeze all squares"]},{"name":"Taxes","rarity":"Rare","effects":["Discard 2 cards","Shield 3 pieces"]},{"name":"Barrage","rarity":"Basic","effects":["Damage all pieces","Discard 2 cards"]},{"name":"Bezerker","rarity":"Rare","effects":["Discard a card","Deal 1 damage","If you have the least pieces return this card to your hand"]},{"name":"Reckless","rarity":"Rare","effects":["Your opponent draws 2 cards","Destroy a piece"]}]

//var node = (typeof module !== 'undefined' && module.exports)
/*
if (node) { // Handle node servers (primarily for AI instances)
	var io = require('socket.io-client');
	global.window = global.document = global;
}*/

/*  -----------------------------  WHat is this bit  -----------------------------   */

if ('undefined' != typeof(global)) frame_time = 45; //on server we run at 45ms, 22hz

// Manages frames/animation
( function () {
	var lastTime = 0;
	var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

	for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
		window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
		window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
	}

	if ( !window.requestAnimationFrame ) {
		window.requestAnimationFrame = function ( callback, element ) {
			var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
			var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
			lastTime = currTime + timeToCall;
			return id;
		};
	}

	if ( !window.cancelAnimationFrame ) {
		window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
	}
}() );

/*  -----------------------------  Helper Functions  -----------------------------  */

// Returns fixed point number, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
// Array shuffle function
var shuffle = function(o){ for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o; }
 
// initialise an array of cards - e.g. for new hand or deck
var create_card_array = function(data) {
	var cards = []
	for (var i = 0; i < data.length; i++) {
		cards.push(create_card(data[i]));
	}

	return cards;
}

//Initialise a card
var create_card = function(data) {
	//Depends on format of input data
	return data.cardName !== undefined ? new game_card(data.cardName) : new game_card(data);
}


/* ----------------------------- The game_core class (the main class) -----------------------------  */
//This gets created on both server and client. Server creates one for each game that is hosted, and client creates one for itself to play the game.

var game_core = function(game_instance){
	this.instance = game_instance; //Store the instance, if any
	this.server = this.instance !== undefined; //Store a flag if we are the server
	this.world = { //Used in collision etc.
		width : canvasWidth,
		height : canvasHeight
	};

	this.board = new game_board();
	this.turn = 1;

	//We create a player set, passing them to the game that is running them, as well
	this.players = {
		self : new game_player(this, this.instance.player_host),
		other : new game_player(this, this.instance.player_client)
	};
	//A local timer for precision on server and client
	this.local_time = 0.016;            //The local timer
	this._dt = new Date().getTime();    //The local timer delta
	this._dte = new Date().getTime();   //The local timer last frame time

	//Client specific initialisation
	this.server_time = 0;
	this.laststate = {};
}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if ( 'undefined' != typeof global ) {
	module.exports = global.game_core = game_core;
}

/*  -----------------------------  Play State Checkers  -----------------------------  */

game_core.prototype.checkFreeSquare = function(){
	var space = 0;
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.board_state.results[i][j] === 0 && this.board.board_state.frost[i][j] === 0 && this.board.board_state.rock[i][j] === 0) {
				space++;
			}
		}
	}
	return space;
}

game_core.prototype.checkEnemySquare = function(player){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if ((this.players.self === player && this.board.board_state.results[i][j] === 1) || (this.players.self === player && this.board.board_state.results[i][j] === -1)) {
				return true;
			} 
		}
	}
	return false;
}

game_core.prototype.checkSelfSquare = function(player){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if ((this.players.self === player && this.board.board_state.results[i][j] === -1) || (this.players.self === player && this.board.board_state.results[i][j] === 1)) {
				return true;
			} 
		}
	}
	return false;
}

// Check that at least one shield exists
game_core.prototype.checkShield = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.board_state.shields[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

// Checks that there is a target to shield
game_core.prototype.checkNoShield = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.board_state.shields[i][j] === 0 && this.board.board_state.results[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

game_core.prototype.checkFrozen = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.board_state.frost[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

//satisfy unsatisfyable effects
game_core.prototype.satisfy_player_states = function(player){
	if (player.player_state.cards_to_play > 0){
		if (player.hand.length <= 0) {
			player.player_state.cards_to_play--;
		} else {
			return true;
		}
	} else if (player.player_state.discarding > 0){
		if (player.hand.length <= 0) {
			player.player_state.discarding--;
		} else {
			return true;
		}
	} else if (player.player_state.freezing > 0){ // No place to freeze
		if (this.checkFreeSquare() <= 0) {
			player.player_state.freezing--;
		} else {
			return true;
		}
	} else if (player.player_state.thawing > 0){
		if(this.checkFrozen() === false){ // No frozen squares to target
			player.player_state.thawing--;
		} else {
			return true;
		}
	} else if (player.player_state.blocking > 0){
		if (this.checkFreeSquare() <= 0){ // No place to block
			player.player_state.blocking--;
		} else {
			return true;
		}
	} else if (player.player_state.shielding > 0){
		if (this.checkNoShield() === false){ // Shielding
			player.player_state.shielding--;
		} else {
			return true;
		}
	} else if (player.player_state.deshielding > 0) {
		if (this.checkShield() === false){ // Deshielding
			player.player_state.deshielding--;
		} else {
			return true;
		}
	} else if (player.player_state.destroyingA > 0){
		if (this.checkEnemySquare(player) === false && this.checkSelfSquare(player) === false) {
			player.player_state.destroyingA--;
		} else {
			return true;
		}
	} else if (player.player_state.destroyingS > 0) {
		if (this.checkSelfSquare(player) === false) {
			console.log('!!!!!!');
			player.player_state.destroyingS--;
		} else {
			return true;
		}
	} else if (player.player_state.destroyingE > 0){
		if (this.checkEnemySquare(player) === false) {
			player.player_state.destroyingE--;
		} else {
			return true;
		}
	} else if (player.player_state.damagingA > 0) {
		if (this.checkEnemySquare(player) === false && this.checkSelfSquare(player) === false) {
			console.log('!!!!!!!!!!!!!!!!!!!!');
			player.player_state.damagingA--;
		} else {
			return true;
		}
	} else if (player.player_state.damagingS > 0){
		if (this.checkSelfSquare(player) === false) {
			console.log('!!!!!!');
			player.player_state.damagingS--;
		} else {
			return true;
		}
	} else if (player.player_state.damagingE > 0) {
		if (this.checkEnemySquare(player) === false) {
			player.player_state.damagingE--;
		} else {
			return true;
		}
	} else if (player.player_state.pieces_to_play > 0){
		if (this.checkFreeSquare() === 0) { // Placing a piece
			player.player_state.pieces_to_play--;
		} else {
			return true;
		}
	} else {
		return true;
	}

	return false;
};


/*  -----------------------------  The board classs  -----------------------------  */

var game_board = function() {
	this.w = 400;
	this.h = 400;
	this.x = canvasWidth / 2 - this.w / 2;
	this.y = canvasWidth / 2 - this.h / 2;

	this.board_state = {
		results : [],
		frost 	: [],
		rock 	: [],
		shields : []
	}
	// initialise game board arrays
	for (var i = 0; i < 4; i++){
		this.board_state.results[i] = [];
		this.board_state.frost[i] = [];
		this.board_state.rock[i] = [];
		this.board_state.shields[i] = [];

		for (var j = 0; j < 4; j++){
			this.board_state.results[i][j] = 0;
			this.board_state.frost[i][j] = 0;
			this.board_state.rock[i][j] = 0;
			this.board_state.shields[i][j] = 0;
		}
	}
};

// Decrement frost and rock array values
game_board.prototype.reduce_state = function(){
	for (var i = 0; i < 4; i++){
		for (var j = 0; j < 4; j++){
			if (this.board_state.frost[i][j] > 0) { this.board_state.frost[i][j]--};
			if (this.board_state.rock[i][j] > 0) { this.board_state.rock[i][j]--};
		}
	}
};

//Calls all win condition checks
game_board.prototype.check_win = function(){
	if (this.checkRows() !== undefined){
		return this.checkRows();
	} else if (this.checkCols() !== undefined){
		return this.checkCols();
	} else if (this.checkDiagonals() !== undefined){
		return this.checkDiagonals();
	}
};

game_board.prototype.checkRows = function(){
	for (var i = 0; i < 4; i++){
		var sum = this.board_state.results[i][0] + this.board_state.results[i][1] + this.board_state.results[i][2] + this.board_state.results[i][3];
		if (sum === 4 || sum === -4){
			return this.board_state.results[i][0];
		}
	}
};

game_board.prototype.checkCols = function(){
	for (var i = 0; i < 4; i++){
		var sum = this.board_state.results[0][i] + this.board_state.results[1][i] + this.board_state.results[2][i] + this.board_state.results[3][i];
		if (sum === 4 || sum === -4){
			return this.board_state.results[0][i];
		}
	}
};

game_board.prototype.checkDiagonals = function(){
	// Right-wards diagonal
	var sum = this.board_state.results[0][0] + this.board_state.results[1][1] + this.board_state.results[2][2] + this.board_state.results[3][3];
	if (sum === 4 || sum === -4){
		return this.board_state.results[1][1];
	}
	// Left-wards diagonal
	sum = this.board_state.results[0][3] + this.board_state.results[1][2] + this.board_state.results[2][1] + this.board_state.results[3][0];
	if (sum === 4 || sum === -4){
		return this.board_state.results[1][1];
	}
};


/*  -----------------------------  Card class  -----------------------------  */

var game_card = function( card_name ) {
	this.cardName = card_name;
	this.cardImage = '';

	this.pos = { x:0, y:0 };
	this.size = { x:140, y:210, hx:0, hy:0 };
	this.size.hx = this.size.x/2;
	this.size.hy = this.size.y/2;
};

/*  -----------------------------  The player class -----------------------------  */
/*	A simple class to maintain state of a player on screen,
	as well as to draw that state when required.
*/

var game_player = function( game_instance, player_instance ) {
	//Store the instance, if any
	this.instance = player_instance; //dont need these?
	//this.game = game_instance; //??
	//Set up initial values for our state information
	this.state = 'not-connected';
	this.id = '';

	this.player_state = {
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

	var deck_temp = ["Armour Up", "Armour Up", "Armour Up", "Armour Up", "Armour Up", "Fire Blast", "Fire Blast", "Fire Blast", "Fire Blast", "Fire Blast"];
	//var deck_temp = ["Fire Blast", "Fire Blast", "Fire Blast", "Ice Blast", "Ice Blast", "Frost", "Summer", "Summer",  "Sabotage", "Armour Up", "Armour Up", "Taxes", "Flurry", "Sacrifice", "Boulder",  "Floods", "Floods", "Barrage", "Barrage", "Bezerker", "Bezerker", "Reckless"];
	//var deck_temp = ["Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Ice Blast", "Summer", "Armour Up", "Summer", "Armour Up", "Summer", "Armour Up", "Summer", "Armour Up", "Summer", "Armour Up", "Summer", "Armour Up", "Summer", "Armour Up"];
	deck_temp = shuffle(deck_temp);
	this.deck = create_card_array(deck_temp);
	//this.deck = JSON.parse('json/deck_p1.json'); //asign deck //var tempDeck = JSON.parse(eval("deck_p" + this.playerNo));
	//Our local history of inputs
	this.inputs = [];
}; //game_player.constructor

/*  -----------------------------  Common Core Game functions  -----------------------------  
	These functions are shared between client and server, and are generic
	for the game state. The client functions are client_* and server functions
	are server_* so these have no prefix.
*/

//Main update loop
game_core.prototype.update = function(t) {
	this.lastframetime = t; //Store the last frame time
	//Update the game specifics
	this.server_update();
	//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update

//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() { 
	window.cancelAnimationFrame( this.updateid );  
};


/*  -----------------------------  Server side functions  -----------------------------  
	These functions below are specific to the server side only,
	and usually start with server_* to make things clearer.

*/

//Makes sure things run smoothly and notifies clients of changes on the server side
game_core.prototype.server_update = function(){
	//Update the state of our local clock to match the timer
	this.server_time = this.local_time;
	//Make a snapshot of the current state, for updating the clients

	if (this.players.self && this.satisfy_player_states(this.players.self) === false) {
		console.log('something wasnt satisfying');
	}
	if (this.players.other && this.satisfy_player_states(this.players.other) === false) {
		console.log('something wasnt satisfying');
	}


	this.tempstate = {
		tu 	: this.turn,
		bo 	: this.board.board_state,
		hp  : this.players.self.player_state,
		hh  : this.players.self.hand,  
		hd  : this.players.self.deck,               
		cp  : this.players.other.player_state,
		ch  : this.players.other.hand,  
		cd  : this.players.other.deck,             
		his : this.players.self.last_input_seq,     //'host input sequence', the last input we processed for the host
		cis : this.players.other.last_input_seq,    //'client input sequence', the last input we processed for the client
		t   : this.server_time                      // our current local time on the server
	};

	this.laststate = this.tempstate;

	if (this.players.self.instance) { //Send the snapshot to the 'host' player
		this.players.self.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
	}
	if (this.players.other.instance) { //Send the snapshot to the 'client' player
		this.players.other.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
	}
}; //game_core.server_update

//Handle server input (input into the server, from a client)
game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {
	//Fetch which client this refers to out of the two
	var player_client = (client.userid == this.players.self.instance.userid) ? this.players.self : this.players.other;
	var player_other = (client.userid == this.players.self.instance.userid) ?  this.players.other : this.players.self;

	if (input) {
		//var c = input.length;
		try { var input_parts = input.split('.'); } catch(err) { var input_parts = input;} // handle input accordingly
		target = [];

		if (input_parts[0] == 'en' && player_client !== undefined && player_other !== undefined && ((player_client === this.players.self && this.turn === 1) || (player_client === this.players.other && this.turn === -1))) { //end turn
			this.turn = this.turn == 1 ? -1 : 1;
			//resets
			player_client.player_state = {
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

			player_other.player_state = {
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
				this.win = this.board.check_win();
				console.log("Win? >>> " + this.win);
				//send server message s.e.
				this.server.endGame(this.instance, this.players.self);
				this.server.endGame(this.instance, this.players.other);
				this.server.findGame(this.players.self);
				this.server.findGame(this.players.other);
				console.log('Game ended fully');
			} else {
				this.board.reduce_state();

				if (player_other.deck.length > 0 && player_other.hand.length < maxHandSize) {
					player_other.hand.push(player_other.deck[0]);
					player_other.deck.splice(0, 1);
				}
			}
		} else if (input_parts[0] == 'ca') { // Clicked card
			target = input_parts[1];
			for (var i = player_client.hand.length - 1; i >= 0; i--) {
				if (player_client.hand[i].cardName === target) {
					player_client.hand.splice(i, 1);
					player_client.player_state.cards_to_play = player_client.player_state.cards_to_play - 1;
					this.resolve_card(target, player_client, player_other);
					break;
				}
			}
		} else if (input_parts[0] == 'sq') { // Clicked square
			target = input_parts[1];
			this.resolve_square(target[0] - 1, target[1] - 1, player_client);
		} else if (input_parts[0] === 'dr') {
			if (player_client.deck.length > 0 && player_client.hand.length < maxHandSize) {
				player_client.hand.push(player_client.deck[0]);
				player_client.deck.splice(0, 1);
			}
		} /*else if (input_parts[0] === 'up') {
			console.log('updating stats');
			player_client.player_state = JSON.parse(input_parts[1])
		}*/
	} //if we have inputs
}; //game_core.handle_server_input

game_core.prototype.resolve_square = function(row, col, player) {
	//console.log('Target square >>> ' + row + ', ' + col);
	if (this.board.board_state.results[row][col] !== 0 || this.board.board_state.frost[row][col] >= 1 || this.board.board_state.rock[row][col] >= 1){
		if (this.board.board_state.results[row][col] !== 0) { // Piece
			//console.log('Affecting a piece >>> ' + player.instance === this.players.self.instance );
			if (player.player_state.destroyingS > 0) { //Destroying self
				//console.log('destroyingS');
				//console.log(player);
				if (((player === this.players.self && this.board.board_state.results[row][col] === 1) || (player !== this.players.self && this.board.board_state.results[row][col] === -1))) {
					this.board.board_state.results[row][col] = 0;
					this.board.board_state.shields[row][col] = 0;
					player.player_state.destroyingS--;
				}
			} else if (player.player_state.destroyingE > 0) { //Destroying enemy
				if (((player === this.players.self && this.board.board_state.results[row][col] === -1) || (player !== this.players.self && this.board.board_state.results[row][col] === 1))) {
					this.board.board_state.results[row][col] = 0;
					this.board.board_state.shields[row][col] = 0;
					player.player_state.destroyingE--;
				}
			} else if (player.player_state.destroyingA > 0) { //Destroying any piece
				this.board.board_state.results[row][col] = 0;
				this.board.board_state.shields[row][col] = 0;
				player.player_state.destroyingA--;
			} else if (player.player_state.damagingS > 0) { //Damaging Self
				//console.log('damagingS');
				if (((player === this.players.self && this.board.board_state.results[row][col] === 1) || (player !== this.players.self && this.board.board_state.results[row][col] === -1))) {
					//console.log('NOOOO?!?!?!');
					if (this.board.board_state.shields[row][col] === 1) {
						this.board.board_state.shields[row][col] = 0;
					} else {
						this.board.board_state.results[row][col] = 0;
					}
					player.player_state.damagingS--;
				}
			} else if (player.player_state.damagingE > 0) { //Damaging Enemy
				if (((player === this.players.self && this.board.board_state.results[row][col] === -1) || (player !== this.players.self && this.board.board_state.results[row][col] === 1))) {
					if (this.board.board_state.shields[row][col] === 1) {
						this.board.board_state.shields[row][col] = 0;
					} else {
						this.board.board_state.results[row][col] = 0;
					}
					player.player_state.damagingE--;
				}
			} else if (player.player_state.damagingA > 0) { //Damaging any piece
				if (this.board.board_state.shields[row][col] === 1) {
					this.board.board_state.shields[row][col] = 0;
				} else {
					this.board.board_state.results[row][col] = 0;
				}
				player.player_state.damagingA--;
			} else if (player.player_state.shielding > 0) {
				this.board.board_state.shields[row][col] = 1;
				player.player_state.shielding--;
			} else if (player.player_state.deshielding > 0) {
				this.board.board_state.shields[row][col] = 0;
				player.player_state.deshielding--;
			}
		} else if (this.board.board_state.frost[row][col] >= 1 && player.player_state.thawing > 0) {
			this.board.board_state.frost[row][col] = 0;
			player.player_state.thawing--;
		} else if (this.board.board_state.rock[row][col] >= 1 && player.player_state.deblocking > 0) {
			this.board.board_state.rock[row][col] = 0;
			player.player_state.blocking--;
		}
	} else { // Cell is empty
		if (player.player_state.freezing > 0) {
			this.board.board_state.frost[row][col] = 4;
			player.player_state.freezing--;
		} else if (player.player_state.blocking > 0) {
			this.board.board_state.rock[row][col] = 6;
			player.player_state.blocking--;
		} else { //place piece
			if (this.board.board_state.results[target[0] - 1][target[1] - 1] === 0){ // check unoccupied
				player.player_state.pieces_to_play = player.player_state.pieces_to_play - 1;
				this.board.board_state.results[target[0] - 1][target[1] - 1] = this.turn;
				player.player_state = { // only pieces can be played
					cards_to_play 	: 0,
					pieces_to_play 	: player.player_state.pieces_to_play - 1,
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
}; // resolve piece/ square

// Resolve card effects
game_core.prototype.resolve_card = function(card, player, enemy) {
	// Check for discard
	if (player.player_state.discarding > 0) {
		player.player_state.discarding--;
		return;
	}

	cardEffects = [];
	for (var j = 0; j < cards.length; j++){
		if (cards[j].name === card){
			cardEffects = cards[j].effects;
		}
	}

	var conditionIf = new RegExp("^if$", "i"),
		conditionLeast = new RegExp("^least$", "i"),
		deal = new RegExp("^deal$|^damage$", "i");     // ^x$ dictates explicit regex matching
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
		piece = new RegExp("^piece$|pieces$", "i"),
		hand = new RegExp("^hand$|^hands$", "i");
		//= new RegExp("", "i"),

	for (var i = 0; i < cardEffects.length; i++){
		var effect = cardEffects[i].split(' ');

		if (effect[0] && effect[0].match(endTurn)) { // End turn
			player.player_state.cards_to_play = 0;
			player.player_state.pieces_to_play = 0;
		} else if (effect[0] && effect[0].match(deal)) { // Dealing damage
			if (effect[1] && effect[1].match(one)){ // Damage one
				if (effect[4] && effect[4].match(targetSelf)){
					player.player_state.damagingS = 1;
				} else if (effect[4] && effect[4].match(targetEnemy)){
					player.player_state.damagingE = 1;
				} else {
					player.player_state.damagingA = 1;
				}
			} else if (effect[1] && effect[1].match(every)) { // Damage all
				for (var k = 0; k < 4; k++) {
					for (var l = 0; l < 4; l++) {
						if (this.board.board_state.shields[k][l] === 1) {
							this.board.board_state.shields[k][l] = 0;
						} else if (this.board.board_state.results[k][l] !== 0) {
							this.board.board_state.results[k][l] = 0;
						}
					}
				}
			} else { // else damage many
				if (effect[4] && effect[4].match(targetSelf)) {
					player.player_state.damagingS = effect[1];
				} else if (effect[4] && effect[4].match(targetEnemy)){
					player.player_state.damagingE = effect[1];
				} else {
					player.player_state.damagingA = effect[1];
				}
			}
		} else if (effect[0] && effect[0].match(destroy)) { // Destroying piece or shield
			if (effect[2] && effect[2].match(shield)){ //if shield
				if (effect[1] && effect[1].match(one)){
					player.player_state.deshielding = 1;
				} else if (effect[1] && effect[1].match(every)) { // Deshield all
					for (var k = 0; k < 4; k++) {
						for (var l = 0; l < 4; l++) {
							this.board.board_state.shields[k][l] = 0;
						}
					}
				} else { //else deshield many
					deshielding = effect[1];
				}
			} else { //
				if (effect[1] && effect[1].match(one)){
					if (effect[4] && effect[4].match(targetSelf)) {
						player.player_state.destroyingS = 1;
					}  else if (effect[4] && effect[4].match(targetEnemy)){
						player.player_state.destroyingE = 1;
					} else {
						player.player_state.destroyingA = 1;
					}
				} else if (effect[1] && effect[1].match(every)) { // Destroy all
					for (var k = 0; k < 4; k++){ 
						for (var l = 0; l < 4; l++){
							this.board.board_state.results[k][l] = 0;
							this.board.board_state.shields[k][l] = 0;
						}
					}
				} else { //else many
					if (effect[4] && effect[4].match(targetSelf)) {
						player.player_state.destroyingS = effect[1];
					} else if (effect[4] && effect[4].match(targetEnemy)){
						player.player_state.destroyingE = effect[1];
					} else {
						player.player_state.destroyingA = effect[1];
					}
				}
			}
		} else if (effect[0] && effect[0].match(draw)){ // Drawing cards
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				if (player.deck.length > 0 && player.hand.length < maxHandSize) {
					player.hand.push(player.deck[0]);
					player.deck.splice(0, 1);
				} else {
				}
			} else { //else many
				for (var i = 0; i < effect[1]; i++) {
					if (player.deck.length > 0 && player.hand.length < maxHandSize) {
						player.hand.push(player.deck[0]);
						player.deck.splice(0, 1);
					}
				}
			}
		} else if (effect[0] && effect[0].match(freeze)){ // Freeze

			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.freezing = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.results[i][j] === 0 && this.board.board_state.rock[i][j] === 0) {
							this.board.board_state.frost[i][j] = 4;
						}
					}
				}
			} else { //else many
				player.player_state.freezing = effect[1];
			}
		} else if (effect[0] && effect[0].match(thaw)){ // Thaw
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.thawing = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.frost[i][j] >= 1) {
							this.board.board_state.frost[i][j] = 0;
						}
					}
				}
			} else { //else many
				player.player_state.thawing = effect[1];
			}
		} else if (effect[0] && effect[0].match(block)){ // Block/Rock
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.blocking = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.results[i][j] === 0 && this.board.board_state.frost[i][j] === 0) {
							this.board.board_state.rock[i][j] = 6;
						}
					}
				}
			} else { //else many
				player.player_state.blocking = effect[1];
			}
		} else if (effect[0] && effect[0].match(shield)){ // Shielding
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.shielding = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.shields[i][j] === 0) {
							this.board.board_state.shields[i][j] = 1;
						}
					}
				}
			} else { //else many
				player.player_state.shielding = effect[1];
			}
		} else if (effect[0] && effect[0].match(discard)){ //Discarding
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.discarding++;
			} else if (effect[1] && effect[1].match(every)) {
				player.hand = [];
			} else {
				player.player_state.discarding = player.player_state.discarding + effect[1]; // Discarding some
			}
		} else if (effect[0] && effect[0].match(targetSelf)){ //You / your
			if (effect[1] && effect[1].match(targetEnemy)){ // Your enemy
				if (effect[2] && effect[2].match(draw)){ // Your enemy draws
					if (effect[1] && effect[1].match(one)){ // Resolves 'a'
						if (enemy.deck.length > 0 && enemy.hand.length < maxHandSize) {
							enemy.hand.push(enemy.deck[0]);
							enemy.deck.splice(0, 1);
						}
					} else {
						for (var i = 0; i < effect[1]; i++) {
							if (enemy.deck.length > 0 && enemy.hand.length < maxHandSize) {
								enemy.hand.push(enemy.deck[0]);
								enemy.deck.splice(0, 1);
							}
						}
					}
				}
			}
		} else if (effect[0] && effect[0].match(conditionIf)){ // Resolves 'If you have the least... return to hand'
			console.log("Doing an if");
			if (effect[1] && effect[1].match(targetSelf)){ // Resolves 'you'
				if (effect[4] && effect[4].match(conditionLeast)) {
					if (effect[5] && effect[5].match(piece)) {
						var piece_counter = 0;
						for (var i = 0; i < 4; i++) {
							for (var j = 0; j < 4; j++) {
								piece_counter = piece_counter + this.board.board_state.results[i][j];
							}
						}
						/*
						#TODO
						console.log(player + ' vs. ' + piece_counter)
						console.log(this.players.self + ' vs. ' ce_counter)

						if ((player.host === true && piece_counter > 0) || (player.host === false && piece_counter < 0)) { // if least
							player.hand.push(card);
						}*/
					} else if (effect[3] && effect[3].match(shield)) { // You have the least shields
						player.hand.push(card);
					}
				}
			}
		}
	}
}; // resolve card
