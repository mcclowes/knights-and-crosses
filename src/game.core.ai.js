
/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60 / 1000;

var fs = require('fs');
var results_file = 'src/json/card_data.json';
var cards = JSON.parse(fs.readFileSync('src/json/cards.json'));

/*  -----------------------------  Frame/Update Handling  -----------------------------   */

/***************************************************************************************
*    Title: requestAnimationFrame for Smart Animating
*    Author: Paul irish
*    Date: 22/02/2011
*    Availability: http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
***************************************************************************************/

// Manage frames/animation
( function () {
	var lastTime = 0;
	var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

	for ( var x = 0; x < vendors.length && !global.requestAnimationFrame; ++ x ) {
		global.requestAnimationFrame = global[ vendors[ x ] + 'RequestAnimationFrame' ];
		global.cancelAnimationFrame = global[ vendors[ x ] + 'CancelAnimationFrame' ] || global[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
	}

	if ( !global.requestAnimationFrame ) {
		global.requestAnimationFrame = function ( callback, element ) {
			var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
			var id = global.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
			lastTime = currTime + timeToCall;
			return id;
		};
	}

	if ( !global.cancelAnimationFrame ) {
		global.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
	}
}() );

/*  -----------------------------  Helper Functions  -----------------------------  */
// Array shuffle function
var shuffle = function(o){ for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o; }
// Scale number
var scale_number = function(base, exp) { if (base < 0) { return Number( - Math.pow(base, exp)); } else { return Number(Math.pow(base, exp)); } };

// Initialise an array of cards - e.g. for new hand or deck
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

var game_core = function(arg1, arg2, arg3, arg4, arg5, arg6, arg7, game_instance){
	this.player_card_value = arg1,
	this.enemy_card_value = arg2,
	this.center_mod = arg3,
	this.enemy_mod = arg4,
	this.shield_mod = arg5,
	this.freeze_mod = arg6,
	this.rock_mod = arg7;

	this.mmr;
	this.game_count;

	this.instance = game_instance; //Store instance (if arg)
	this.server = false; //Store a flag for not server

	this.board = new game_board();
	this.end_turn_button = new end_turn_button();
	this.turn = 1;

	// Create players
	this.players = {
		self : new game_player(this),
		other : new game_player(this)
	};
	
	//A local timer for precision
	this.local_time = 0.016;   
	this._dt = new Date().getTime();  
	this._dte = new Date().getTime();  

	//Client specific initialisation
	this.server_time = 0;
	this.laststate = {};

	//Client specific initialisation
	this.client_create_configuration(); 
	this.client_create_ping_timer();
}; //game_core.constructor

module.exports = global.game_core = game_core; // global as needed by manager


/*  -----------------------------  The board classs  -----------------------------  */

var game_board = function() {

	this.state = {
		results : [],
		frost   : [],
		rock    : [],
		shields : []
	}

	this.board_distance = 0;

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
};

// Decrement frost and rock array values
game_board.prototype.reduce_state = function(){
	for (var i = 0; i < 4; i++){
		for (var j = 0; j < 4; j++){
			if (this.state.frost[i][j] > 0) { this.state.frost[i][j]--};
			if (this.state.rock[i][j] > 0) { this.state.rock[i][j]--};
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
		var sum = this.state.results[i][0] + this.state.results[i][1] + this.state.results[i][2] + this.state.results[i][3];
		if (sum === 4 || sum === -4){
			return this.state.results[i][0];
		}
	}
};

game_board.prototype.checkCols = function(){
	for (var i = 0; i < 4; i++){
		var sum = this.state.results[0][i] + this.state.results[1][i] + this.state.results[2][i] + this.state.results[3][i];
		if (sum === 4 || sum === -4){
			return this.state.results[0][i];
		}
	}
};

game_board.prototype.checkDiagonals = function(){
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
};

/*  -----------------------------  Board State Checkers  -----------------------------  */

game_core.prototype.checkFreeSquare = function(){
	var space = 0;
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0) {
				space++;
			}
		}
	}
	return space;
}

game_core.prototype.checkEnemySquare = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if ((this.players.self.host === true && this.board.state.results[i][j] === 1) || (this.players.self.host === false && this.board.state.results[i][j] === -1)) {
				return true;
			} 
		}
	}
	return false;
}

game_core.prototype.checkSelfSquare = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if ((this.players.self.host === true && this.board.state.results[i][j] === -1) || (this.players.self.host === false && this.board.state.results[i][j] === 1)) {
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
			if (this.board.state.shields[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

// Checks that there is a target to shield
game_core.prototype.checkUnshielded = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.state.shields[i][j] === 0 && this.board.state.results[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

game_core.prototype.checkFrozen = function(){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			if (this.board.state.frost[i][j] !== 0) {
				return true;
			}
		}
	}
	return false;
};

/*  -----------------------------  AI Evaluation functions  -----------------------------  */

game_core.prototype.evaluate_square = function(x, y) {
	var square = this.board.state.results[x][y];
	square = square * 10;

	if (this.board.state.shields[x][y] > 0) {
		square = square * this.shield_mod;
	}

	if (x === 1 || x === 2) { // If in the middle 4
		if (y === 1 || y === 2) {
			square = square * this.center_mod;
		}
	}

	if ( (this.players.self.host === true && square < 0) || (this.players.self.host === false && square > 0) ) {
		square = this.enemy_mod * square;
	} else if (square === 0){
		if (this.board.state.frost[x][y] > 0) { //frozen
			if (this.board.state.frost[x][y] % 2 === 0) { //self
				square = this.players.self.host === true ? this.freeze_mod : (- this.freeze_mod);
			} else {
				square = this.players.self.host === true ? (- this.freeze_mod) : this.freeze_mod;
			}
		} else if (this.board.state.rock[x][y] > 0) { // blocked
			if (this.board.state.rock[x][y] % 2 === 0) { //self
				square = this.players.self.host === true ? this.rock_mod : (- this.rock_mod);
			} else {
				square = this.players.self.host === true ? (- this.rock_mod) : this.rock_mod;
			}
		} 
	}

	//console.log('Square > ' + square);
	return Number(square).toFixed(0);
};

// Move else where
game_core.prototype.checkDistance = function(){ //If host, + is good, if other, - is good
	var row1 = Number(this.evaluate_square(0,0)) + Number(this.evaluate_square(0,1)) + Number(this.evaluate_square(0,2)) + Number(this.evaluate_square(0,3)),
		row2 = Number(this.evaluate_square(1,0)) + Number(this.evaluate_square(1,1)) + Number(this.evaluate_square(1,2)) + Number(this.evaluate_square(1,3)),
		row3 = Number(this.evaluate_square(2,0)) + Number(this.evaluate_square(2,1)) + Number(this.evaluate_square(2,2)) + Number(this.evaluate_square(2,3)),
		row4 = Number(this.evaluate_square(3,0)) + Number(this.evaluate_square(3,1)) + Number(this.evaluate_square(3,2)) + Number(this.evaluate_square(3,3)),
		col1 = Number(this.evaluate_square(0,0)) + Number(this.evaluate_square(1,0)) + Number(this.evaluate_square(2,0)) + Number(this.evaluate_square(3,0)),
		col2 = Number(this.evaluate_square(0,1)) + Number(this.evaluate_square(1,1)) + Number(this.evaluate_square(2,1)) + Number(this.evaluate_square(3,1)),
		col3 = Number(this.evaluate_square(0,2)) + Number(this.evaluate_square(1,2)) + Number(this.evaluate_square(2,2)) + Number(this.evaluate_square(3,2)),
		col4 = Number(this.evaluate_square(0,3)) + Number(this.evaluate_square(1,3)) + Number(this.evaluate_square(2,3)) + Number(this.evaluate_square(3,3)),
		dia1 = Number(this.evaluate_square(0,0)) + Number(this.evaluate_square(1,1)) + Number(this.evaluate_square(2,2)) + Number(this.evaluate_square(3,3)),
		dia2 = Number(this.evaluate_square(0,3)) + Number(this.evaluate_square(1,2)) + Number(this.evaluate_square(2,1)) + Number(this.evaluate_square(3,0));

	row1 = Number(scale_number(row1, 2));
	row2 = Number(scale_number(row2, 2));
	row3 = Number(scale_number(row3, 2));
	row4 = Number(scale_number(row4, 2));
	col1 = Number(scale_number(col1, 2));
	col2 = Number(scale_number(col2, 2));
	col3 = Number(scale_number(col3, 2));
	col4 = Number(scale_number(col4, 2));
	dia1 = Number(scale_number(dia1, 2));
	dia2 = Number(scale_number(dia2, 2));

	
	value = row1 + row2 + row3 + row4 + col1 + col2 + col3 + col4 + dia1 + dia2;
	//console.log('Calculating >>>>> ' + value + ' >>>>> ' + row1 + ' ' + row2 + ' ' + row3 + ' ' + row4 + ' ' + col1 + ' ' + col2 + ' ' + col3 + ' ' + col4 + ' ' + dia1 + ' ' + dia2);
	return value;
};

game_core.prototype.choose_square = function(moves){
	for (var i = 0; i < 4; i++) {
		for (var j = 0; j < 4; j++) {
			var temp_count = 0;
			var temp_flag = 0;

			if (((this.players.self.state.destroyingA > 0 || this.players.self.state.damagingA > 0) && this.board.state.results[i][j] !== 0 ) ||
				((this.players.self.state.destroyingS > 0 || this.players.self.state.damagingS > 0) && ((this.players.self.host === true && this.board.state.results[i][j] === 1 ) || (this.players.self.host === false && this.board.state.results[i][j] === -1 ) ) ) ||
				((this.players.self.state.destroyingE > 0 || this.players.self.state.damagingE > 0) && ((this.players.self.host === true && this.board.state.results[i][j] === -1 ) || (this.players.self.host === false && this.board.state.results[i][j] === 1 ) ) ) ||
				(this.players.self.state.freezing > 0 && this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0 ) ||
				(this.players.self.state.thawing > 0 && this.board.state.frost[i][j] > 0) ||
				(this.players.self.state.blocking > 0 && this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0 ) ||
				(this.players.self.state.shielding > 0 && this.board.state.shields[i][j] === 0 && this.board.state.results[i][j] !== 0) ||
				(this.players.self.state.deshielding > 0 && this.board.state.shields[i][j] > 0) ||
				(this.players.self.state.pieces_to_play > 0 && this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0 ) )  {

				var temp_state = this.board.state;

				if (this.players.self.state.freezing > 0 ) { // placing frost
					if ( this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0 ){
						temp_state.frost[i][j] = 4; //1/-1
					} else {
						continue;
					}
				} else if (this.players.self.state.thawing > 0) { // placing frost
					if (this.board.state.frost[i][j] > 0) {
						temp_count = temp_state.frost[i][j];
						temp_state.frost[i][j] = 0; //1/-1
					} else {
						continue;
					}
				} else if (this.players.self.state.blocking > 0 ) { // Placing rock
					if (this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0 ) {
						temp_state.rock[i][j] = 6;
					} else {
						continue;
					}
				} else if (this.players.self.state.shielding > 0 ) { // Placing shield
					if (this.board.state.shields[i][j] === 0 && this.board.state.results[i][j] !== 0) {
						temp_state.shields[i][j] = 1;
					} else {
						continue;
					}
				} else if (this.players.self.state.deshielding > 0 ) { // Deshielding
					if (this.board.state.shields[i][j] > 0) {
						temp_state.shields[i][j] = 0;
					} else {
						continue;
					}
				} else if (this.players.self.state.destroyingA > 0){
					if (this.board.state.results[i][j] !== 0 ) {
						temp_count = temp_state.shields[i][j];
						temp_flag = temp_state.results[i][j];
						temp_state.results[i][j] = 0;
						temp_state.shields[i][j] = 0;
					} else {
						continue;
					}
				} else if (this.players.self.state.destroyingS > 0){
					if ((this.players.self.host === true && this.board.state.results[i][j] === 1 ) || (this.players.self.host === false && this.board.state.results[i][j] === -1 ) ) {
						temp_count = temp_state.shields[i][j];
						temp_state.results[i][j] = 0;
						temp_state.shields[i][j] = 0;
					} else {
						continue;
					}
				} else if (this.players.self.state.destroyingE > 0){
					if ((this.players.self.host === true && this.board.state.results[i][j] === -1 ) || (this.players.self.host === false && this.board.state.results[i][j] === 1 ) ) {
						temp_count = temp_state.shields[i][j];
						temp_state.results[i][j] = 0;
						temp_state.shields[i][j] = 0;
					} else {
						continue;
					}
				} else if (this.players.self.state.damagingA > 0){
					if (this.board.state.results[i][j] !== 0 ) {
						temp_count = temp_state.shields[i][j];
						temp_flag = temp_state.results[i][j];
						if (temp_state.shields[i][j] === 1){
							temp_state.shields[i][j] = 0;
						}
						else {
							temp_state.results[i][j] = 0;
						}
					} else {
						continue;
					}
				} else if (this.players.self.state.damagingS > 0){
					if ((this.players.self.host === true && this.board.state.results[i][j] === 1 ) || (this.players.self.host === false && this.board.state.results[i][j] === -1 ) ) {
						temp_count = temp_state.shields[i][j];
						if (temp_state.shields[i][j] === 1){
							temp_state.shields[i][j] = 0;
						}
						else {
							temp_state.results[i][j] = 0;
						}
					} else {
						continue;
					}
				} else if (this.players.self.state.damagingE > 0) {
					if ((this.players.self.host === true && this.board.state.results[i][j] === -1 ) || (this.players.self.host === false && this.board.state.results[i][j] === 1 ) ) {
						temp_count = temp_state.shields[i][j];
						if (temp_state.shields[i][j] === 1){
							temp_state.shields[i][j] = 0;
						}
						else {
							temp_state.results[i][j] = 0;
						}
					} else {
						continue;
					}
				} else if (this.players.self.state.pieces_to_play > 0) { // Placing a piece
					if (this.board.state.results[i][j] === 0 && this.board.state.frost[i][j] === 0 && this.board.state.rock[i][j] === 0) {
						temp_state.results[i][j] = this.players.self.host === true ? 1 : -1; //1/-1
					} else {
						continue;
					}
				} 
				
				var dist = this.checkDistance();
				//console.log(dist);
				
				if (    (   this.players.self.host === true && ( (moves !== undefined && (dist >= moves.distance || moves.distance === undefined)) || moves === undefined) /*&& dist >= this.board.board_distance*/) || 
						(   this.players.self.host === false && ( (moves !== undefined && (dist <= moves.distance || moves.distance === undefined)) || moves === undefined) /*&& dist <= this.board.board_distance*/) 
					) {
					moves = {
						x : i,
						y : j,
						distance : dist
					};
				}

				// Reverse things
				if (this.players.self.state.freezing > 0) { // placing frost
					temp_state.frost[i][j] = 0; 
				} else if (this.players.self.state.thawing > 0) { // placing frost
					temp_state.frost[i][j] = temp_count; //1/-1
				} else if (this.players.self.state.blocking > 0) { // Placing rock
					temp_state.rock[i][j] = 0;
				} else if (this.players.self.state.shielding > 0) { // Placing rock
					temp_state.shields[i][j] = 0;
				} else if (this.players.self.state.deshielding > 0) { // Placing rock
					temp_state.shields[i][j] = 1;
				} else if (this.players.self.state.destroyingA > 0) {
					temp_state.results[i][j] = temp_flag;
					temp_state.shields[i][j] = temp_count;
				} else if (this.players.self.state.destroyingS > 0) {
					temp_state.results[i][j] = this.players.self.host === true ? 1 : -1;
					temp_state.shields[i][j] = temp_count;
				} else if (this.players.self.state.destroyingE > 0) {
					temp_state.results[i][j] = this.players.self.host === true ? -1 : 1;
					temp_state.shields[i][j] = temp_count;
				} else if (this.players.self.state.damagingA > 0) {
					temp_state.results[i][j] = temp_flag;
					temp_state.shields[i][j] = temp_count;
				} else if (this.players.self.state.damagingS > 0) {
					temp_state.shields[i][j] = temp_count;
					temp_state.results[i][j] = this.players.self.host === true ? 1 : -1;
				} else if (this.players.self.state.damagingE > 0) {
					temp_state.shields[i][j] = temp_count;
					temp_state.results[i][j] = this.players.self.host === true ? -1 : 1;
				} else if (this.players.self.state.pieces_to_play > 0) { // Placing a piece
					temp_state.results[i][j] = 0;
				}
			}
		}
	}

	return moves;
}

game_core.prototype.resolve_card = function(card, player, enemy) {
	// Check for discard
	if (player.state.discarding > 0) {
		player.state.discarding--;
		return;
	}

	cardEffects = [];
	for (var j = 0; j < cards.length; j++){
		if (cards[j].name === card.cardName){
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
			//do nothing
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
			//dont
		} else if (effect[0] && effect[0].match(targetSelf)){ //You / your
			if (effect[1] && effect[1].match(targetEnemy)){ // Your enemy
				// don't draw
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

game_core.prototype.evaluate_game_state = function() {
	//temp_move only resolves to one depth

	// seperate choose square into two functions - one that tests and reverses and one that just makes the move without reversing
	/*while (this.players.self.state.cards_to_play !== 0 && this.players.self.state.damagingA && this.players.self.state.damagingE && this.players.self.state.damagingS && this.players.self.state.destroyingA && this.players.self.state.destroyingE && this.players.self.state.destroyingS && this.players.self.state.discarding && this.players.self.state.shielding && this.players.self.state.deshielding && this.players.self.state.freezing && this.players.self.state.thawing && this.players.self.state.blocking) {
		temp_move = this.choose_square();
	}*/
	
	temp_move = this.choose_square();

	//console.log(this.players.self.state);
	board_score = temp_move === undefined ? 0 : Number(temp_move.distance);

	if (this.players.self.host === false) {
		board_score = - board_score;
	}
	player_hand_value = this.players.self.hand.length * this.player_card_value;
	enemy_hand_value = this.players.other.hand.length * this.enemy_card_value;
	state_score = board_score + player_hand_value + enemy_hand_value;

	//console.log('does this f(ing work? ' + board_score + ' + ' + player_hand_value + ' + ' + enemy_hand_value + ' = ' + state_score);

	return state_score;
};

game_core.prototype.choose_card = function(best) {
	temp_state = {
		cards_to_play   : this.players.self.state.cards_to_play,
		pieces_to_play  : this.players.self.state.pieces_to_play,
		damagingA       : this.players.self.state.damagingA,
		damagingE       : this.players.self.state.damagingE,
		damagingS       : this.players.self.state.damagingS,
		destroyingA     : this.players.self.state.destroyingA,
		destroyingE     : this.players.self.state.destroyingE,
		destroyingS     : this.players.self.state.destroyingS,
		discarding      : this.players.self.state.discarding,
		shielding       : this.players.self.state.shielding,
		deshielding     : this.players.self.state.deshielding,
		freezing        : this.players.self.state.freezing,
		thawing         : this.players.self.state.thawing,
		blocking        : this.players.self.state.blocking
	}

	var starting_value = Number(this.evaluate_game_state());

	var card_selection = {
		card    : undefined,
		score   : starting_value
	}

	//for card in hand
	for (var i = 0; i < this.players.self.hand.length; i++){
		//console.log('Trying out ' + this.players.self.hand[i].cardName);
		this.resolve_card(this.players.self.hand[i], this.players.self, this.players.other);
		//console.log(this.players.self.state);
		temp_score = Number(this.evaluate_game_state());

		if ((best === true && temp_score >= card_selection.score) || (best === false && temp_score <= card_selection.score)) {
			card_selection = {
				card : i,
				score: temp_score
			}
		}

		this.players.self.state = {
			cards_to_play   : temp_state.cards_to_play,
			pieces_to_play  : temp_state.pieces_to_play,
			damagingA       : temp_state.damagingA,
			damagingE       : temp_state.damagingE,
			damagingS       : temp_state.damagingS,
			destroyingA     : temp_state.destroyingA,
			destroyingE     : temp_state.destroyingE,
			destroyingS     : temp_state.destroyingS,
			discarding      : temp_state.discarding,
			shielding       : temp_state.shielding,
			deshielding     : temp_state.deshielding,
			freezing        : temp_state.freezing,
			thawing         : temp_state.thawing,
			blocking        : temp_state.blocking
		}
	}

	if (card_selection.card !== undefined && best === true) {
		console.log(this.players.self.id + ' playing ' + this.players.self.hand[card_selection.card].cardName + ' for >>> ' + (card_selection.score - starting_value));
		var content = JSON.parse(fs.readFileSync(results_file));
		for ( var i = 0; i < content.length; i++ ) {
			if (content[i].name === this.players.self.hand[card_selection.card].cardName) {
				content[i].count++;
				content[i].total = content[i].total + (card_selection.score - starting_value);
				if (content[i].min > (card_selection.score - starting_value)) {
					content[i].min = (card_selection.score - starting_value);
				}
				if (content[i].max < (card_selection.score - starting_value)) {
					content[i].max = (card_selection.score - starting_value);
				}
			}
		}
		fs.writeFileSync(results_file, JSON.stringify(content));
	}

	return card_selection.card;
}

/*  -----------------------------  End turn button classs  -----------------------------  */

var end_turn_button = function() {
	this.w = 100;
	this.h = 50;
	this.x = 20;
	this.text = "End Turn";
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

var game_player = function( game_instance, player_instance ) {
	this.instance = player_instance;
	this.game = game_instance;
	this.state = 'not-connected';
	this.id = '';

	this.state = {
		cards_to_play   : 0,
		pieces_to_play  : 0,
		damagingA       : 0,
		damagingE       : 0,
		damagingS       : 0,
		destroyingA     : 0,
		destroyingE     : 0,
		destroyingS     : 0,
		discarding      : 0,
		shielding       : 0,
		deshielding     : 0,
		freezing        : 0,
		thawing         : 0,
		blocking        : 0
	}

	//Player arrays
	this.deck = [],
	this.hand = [];

	var deck_temp = JSON.parse(fs.readFileSync('src/json/deck_p1.json'));
	deck_temp = shuffle(deck_temp);
	this.deck = create_card_array(deck_temp);
}; //game_player.constructor


/* -----------------------------  AI Client functions  ----------------------------- */

//Main update loop
game_core.prototype.update = function(t) {
	if (t - this.lastframetime > 1000 || this.lastframetime === undefined) {
		this.lastframetime = t; //Store the last frame time
		//Update the game specifics
		this.client_update();
	}

	//schedule the next update
	this.updateid = global.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update

//Cancel game update
game_core.prototype.stop_update = function() { 
	global.cancelAnimationFrame( this.updateid );  
};

// Handle server update
game_core.prototype.client_onserverupdate_recieved = function(data){
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;
	var this_player = this.players.self;
	
	this.server_time = data.t; //Store the server time
	this.client_time = this.server_time - (this.net_offset / 1000); //Update local offset time from the last server update

	data = JSON.parse(data);
	// Store server's last state
	this.turn = data.tu;
	this.board.state = data.bo;
	player_host.state = data.hp;
	player_host.hand = create_card_array(data.hh);
	player_host.deck = create_card_array(data.hd);            
	player_client.state = data.cp;
	player_client.hand = create_card_array(data.ch);
	player_client.deck = create_card_array(data.cd);         
	this.server_time = data.t;   // sever time
}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update = function() {
	if ((this.players.self.host === true && this.turn === -1) || (this.players.self.host === false && this.turn === 1) || this.players.self.state === 'hosting.waiting for a player') { // not players turn
		return;
	}

	var input = '';

	//console.log(this.players.self.state.cards_to_play > 0);
	if ( this.players.self.state.cards_to_play > 0 || this.players.self.state.discarding > 0) {
		var card_choice = this.players.self.state.discarding > 0 ? this.choose_card(false) : this.choose_card(true);

		if (card_choice === undefined) { 
			input = 'ca-skip';
		} else if (this.players.self.hand[card_choice]){
			input = 'ca-' + this.players.self.hand[card_choice].cardName;
		}
	} else if ( this.players.self.state.pieces_to_play > 0 || this.players.self.state.destroyingA > 0 || this.players.self.state.destroyingE > 0 || this.players.self.state.destroyingS > 0 || this.players.self.state.damagingA > 0 || this.players.self.state.damagingE > 0 || this.players.self.state.damagingS > 0 || this.players.self.state.freezing > 0 || this.players.self.state.thawing > 0 || this.players.self.state.blocking > 0 || this.players.self.state.shielding > 0 || this.players.self.state.deshielding > 0) {
		//console.log('resolving effect');
		var moves = undefined;
		moves = this.choose_square(moves);
		if (moves === undefined) { return; } //make sure it is better than the current board state too?
		input = 'sq-' + (moves.x + 1) + (moves.y + 1);

	} else if (input === '') { // If no action possible...
		input = 'en';
	}
	// Process and send input
	this.input_seq += 1;
	var server_packet = 'i.' + input + '.' + this.local_time.toFixed(3).replace('.','-') + '.' + this.input_seq;
	this.socket.send( server_packet );

	return;

	// AI Psuedo code
	/*while no player has won: 
		//Calculate current game state 
		for (card in hand) {
			//Calculate card value based on resulting game state
			//Track highest card value 
		}
		if (maximum card value > 0 ) {
			//Play card of highest value 
		} else {
			//Do not play a card
		}
		//resolve card effect for maximum resultant game state Place piece to maximise win condition
		//Store card’s effective value
		//End turn()
	*/
}; //game_core.update_client

// Setup a timer
game_core.prototype.create_timer = function(){
	setInterval(function(){
		this._dt = new Date().getTime() - this._dte;
		this._dte = new Date().getTime();
		this.local_time += this._dt / 1000.0;
	}.bind(this), 4);
}

// Ping server at interval
game_core.prototype.client_create_ping_timer = function() {
	setInterval(function(){
		this.last_ping_time = new Date().getTime();
		this.socket.send('p.' + (this.last_ping_time) );

	}.bind(this), 1000);
}; //game_core.client_create_ping_timer

// Setup client
game_core.prototype.client_create_configuration = function() {
	this.input_seq = 0;                 
	this.net_latency = 0.001;           
	this.net_ping = 0.001;              
	this.last_ping_time = 0.001;        
	this.net_offset = 100;              
	this.client_time = 0.01;            
	this.server_time = 0.01;
	this.lit = 0;
	this.llt = new Date().getTime();
};

// Handle readying a game
game_core.prototype.client_onreadygame = function(data) {
	console.log('Connected, with mmr > ' + this.mmr);
	this.socket.send( 'm.' + this.mmr ); // Tell server this player's mmr

	var server_time = parseFloat(data.replace('-','.'));
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;

	this.local_time = server_time + this.net_latency;
		
	//Update information
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';
	this.players.self.state = 'YOU ' + this.players.self.state;
}; 

// Handle opening a game
game_core.prototype.client_onjoingame = function(data) {
	this.players.self.host = false; //Not the host
	this.players.self.state = 'connected.joined.waiting'; // Update state
};

game_core.prototype.client_onhostgame = function(data) {
	var server_time = parseFloat(data.replace('-','.'));
	this.local_time = server_time + this.net_latency; 
	this.players.self.host = true; //Flag self as host
	this.players.self.state = 'hosting.waiting for a player';
};

// Handle connect to game
game_core.prototype.client_onconnected = function(data) { // Ping ready
	this.players.self.id = data.id;
	this.players.self.state = 'connected';
	this.players.self.online = true;
};

// Handle server ping
game_core.prototype.client_onping = function(data) {
	this.net_ping = new Date().getTime() - parseFloat( data );
	this.net_latency = this.net_ping/2;
};

// Handle message from server
game_core.prototype.client_onnetmessage = function(data) {
	var commands = data.split('.');
	var command = commands[0];
	var subcommand = commands[1] || null;
	var commanddata = commands[2] || null;

	switch(command) {
		case 's': //server message
			switch(subcommand) {
				case 'h' : //host a game requested
					this.client_onhostgame(commanddata); break;
				case 'j' : //join a game requested
					this.client_onjoingame(commanddata); break;
				case 'r' : //ready a game requested
					this.client_onreadygame(commanddata); break;
				case 'e' : //end game requested
					this.client_ondisconnect(commanddata); break;
				case 'p' : //server ping
					this.client_onping(commanddata); break;
				case 'm' : //update mmr
					if(commands[3]){ commanddata = Number(commanddata + '.' + commands[3]).toFixed(3); }

					console.log('components ' +  commanddata + ' >>>> ' + this.mmr + ' + ' +  (55 - this.game_count) + ' * ' + commanddata + ' = ' + ( this.mmr + ((55 - this.game_count) * commanddata)));

					this.mmr = this.mmr + ((55 - this.game_count) * commanddata);

					console.log('New mmr = ' + this.mmr);
					this.game_count++;
					if (this.game_count > 30) { this.game_count = 30; }; 
					//update data file
					var ai_results = JSON.parse(fs.readFileSync('json/ai.json'));
					for ( var i = 0; i < ai_results.length; i++ ) {
						//console.log(ai_results[i].player_card_value + ' vs. ' +  this.player_card_value);
						if (ai_results[i].player_card_value === this.player_card_value &&
							ai_results[i].enemy_card_value === this.enemy_card_value &&
							ai_results[i].center_mod === this.center_mod &&
							ai_results[i].enemy_mod === this.enemy_mod &&
							ai_results[i].shield_mod === this.shield_mod &&
							ai_results[i].freeze_mod === this.freeze_mod &&
							ai_results[i].rock_mod === this.rock_mod ) {
							console.log("Found it");
							ai_results[i].mmr = this.mmr;
							fs.writeFileSync('json/ai.json', JSON.stringify(ai_results));
							break;
						}
					}
					ai_results.push({
						player_card_value: this.player_card_value, 
						enemy_card_value: this.enemy_card_value, 
						center_mod: this.center_mod, 
						enemy_mod: this.enemy_mod, 
						shield_mod: this.shield_mod, 
						freeze_mod: this.freeze_mod, 
						rock_mod: this.rock_mod, 
						mmr: this.mmr
					});
					fs.writeFileSync('json/ai.json', JSON.stringify(ai_results));
					if (this.players.self.host === true) {
						console.log('W SENT');
						this.socket.send( 'w' );
					}
					break;
			} //subcommand
		break; //'s'
	} //command
				
}; //client_onnetmessage

// Handle socket disconnect (non-end game)
game_core.prototype.client_ondisconnect = function(data) {
	this.players.self.state = 'not-connected';
	this.players.self.online = false;
	this.players.other.state = 'not-connected';
}; //client_ondisconnect