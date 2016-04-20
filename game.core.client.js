
/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
var maxHandSize = 10,
	canvasWidth = 720,
	canvasHeight = 800,
	serverIP = 'http://10.245.145.51:4004';

// Card effect list
var cards = [{"name":"Fire Blast","rarity":"Basic","effects":["Deal 1 damage"]},{"name":"Floods","rarity":"Rare","effects":["Destroy all pieces","End your turn"]},{"name":"Armour Up","rarity":"Basic","effects":["Shield a piece","Draw a card"]},{"name":"Flurry","rarity":"Rare","effects":["Deal 2 damage to your pieces","Deal 2 damage to enemy pieces"]},{"name":"Sabotage","rarity":"Elite","effects":["Remove 5 shields"]},{"name":"Summer","rarity":"Basic","effects":["Thaw 1 square","Draw a card"]},{"name":"Ice Blast","rarity":"Basic","effects":["Freeze a square"]},{"name":"Sacrifice","rarity":"Rare","effects":["Destroy a piece of yours","Draw 3 cards"]},{"name":"Boulder","rarity":"Rare","effects":["Discard a card","Block a square"]},{"name":"Frost","rarity":"Basic","effects":["Freeze all squares"]},{"name":"Taxes","rarity":"Rare","effects":["Discard 2 cards","Shield 3 pieces"]},{"name":"Barrage","rarity":"Basic","effects":["Damage all pieces","Discard 2 cards"]},{"name":"Bezerker","rarity":"Rare","effects":["Discard a card","Deal 1 damage","If you have the least pieces return this card to your hand"]},{"name":"Reckless","rarity":"Rare","effects":["Your opponent draws 2 cards","Destroy a piece"]}]

var node = (typeof module !== 'undefined' && module.exports)

if (node) { // Handle node servers (primarily for AI instances)
	var io = require('socket.io-client');
	global.window = global.document = global;
}

//console.log(!node || this.server);

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

// Create a rounded clipping area
var roundedImage = function(x, y, width, height, radius){
	game.ctx.beginPath();
	game.ctx.moveTo(x + radius, y);
	game.ctx.lineTo(x + width - radius, y);
	game.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	game.ctx.lineTo(x + width, y + height - radius);
	game.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	game.ctx.lineTo(x + radius, y + height);
	game.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	game.ctx.lineTo(x, y + radius);
	game.ctx.quadraticCurveTo(x, y, x + radius, y);
	game.ctx.closePath();
}

// Draw text in box
// #TODO refactor this
var layout_text = function(canvas, x, y, w, h, text, font_size, spl) {
	var loutout_lines = function(ctx, mw, text) {
		// We give a little "padding" This should probably be an input param but for the sake of simplicity we will keep it this way
		mw = mw - 10;
		var words = text.split(' ');
		var new_line = words[0];
		var lines = [];
		for(var i = 1; i < words.length; ++i) {
		   if (ctx.measureText(new_line + " " + words[i]).width < mw) {
			   new_line += " " + words[i];
		   } else {
			   lines.push(new_line);
			   new_line = words[i];
		   }
		}
		lines.push(new_line);
		return lines;
	}

	if (canvas) {
		canvas.textAlign = "start"; 
		canvas.fillStyle = 'rgba(200, 180, 140, 0.8)';
		canvas.fillRect(x, y, w, h);
		// Paint text
		var lines = loutout_lines(canvas, w, text);
		// Block of text height
		var both = lines.length * (font_size + spl);
		if (both >= h) {
			// We won't be able to wrap the text inside the area the area is too small. We should inform the user  about this in a meaningful way
		} else {
			// We determine the y of the first line
			var ly = (h - both)/2 + y + spl * lines.length;
			var lx = 0;
			for (var j = 0, ly; j < lines.length; ++j, ly+=font_size+spl) {
				// We continue to centralize the lines
				lx = x + w / 2 - canvas.measureText(lines[j]).width / 2;
				game.ctx.fillStyle = 'rgba(0,0,0,1)';
				canvas.fillText(lines[j], lx, ly);
			}
		}
	}
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
	this.end_turn_button = new end_turn_button();
	this.turn = 1;

	//We create a player set, passing them to the game that is running them, as well
	this.players = {
		self : new game_player(this),
		other : new game_player(this)
	};
	//A local timer for precision on server and client
	this.local_time = 0.016;            //The local timer
	this._dt = new Date().getTime();    //The local timer delta
	this._dte = new Date().getTime();   //The local timer last frame time

	//Client specific initialisation
	this.client_create_configuration(); //Create the default configuration settings
	this.server_updates = []; //A list of recent server updates we interpolate across this is the buffer that is the driving factor for our networking
	this.client_connect_to_server(); //Connect to the socket.io server!
	this.client_create_ping_timer(); //We start pinging the server to determine latency
}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if ( 'undefined' != typeof global ) {
	module.exports = global.game_core = game_core;
}


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

game_board.prototype.draw = function(){
	this.boardImage = new Image();
	this.boardImage.src = "img/board.png";
	game.ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
	game.ctx.fillRect(this.x, this.y, 400, 400);
	game.ctx.drawImage(this.boardImage, this.x, this.y, 400, 400);

	//Assign images
	this.p1PieceImage = new Image();
	this.p1PieceImage.src = "img/piece_p1.png";
	this.p2PieceImage = new Image();
	this.p2PieceImage.src = "img/piece_p2.png";
	this.frostImage1 = new Image();
	this.frostImage1.src = "img/frost1.png";
	this.frostImage2 = new Image();
	this.frostImage2.src = "img/frost2.png";
	this.blockedImage1 = new Image();
	this.blockedImage1.src = "img/rock1.png";
	this.blockedImage2 = new Image();
	this.blockedImage2.src = "img/rock2.png";
	this.blockedImage3 = new Image();
	this.blockedImage3.src = "img/rock3.png";
	this.p1ShieldImage = new Image();
	this.p1ShieldImage.src = "img/piece_p1_shielded.png";
	this.p2ShieldImage = new Image();
	this.p2ShieldImage.src = "img/piece_p2_shielded.png";

	//for each square, draw the relevant piece
	game.ctx.shadowBlur = 20;
	for (var i = 0; i < 4; i++){
		for (var j = 0; j < 4; j++){
			// Set 
			if (this.board_state.results[i][j] == 1) {
				//needs to check for player
				if (this.board_state.shields[i][j] == 1) {
					if ((game.players.self.player_state.deshielding > 0 || game.players.self.player_state.damagingA > 0 || game.players.self.player_state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p1ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					if ((game.players.self.player_state.shielding > 0 ) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) {
						game.ctx.shadowColor = "green";
					} else if (( game.players.self.player_state.damagingA > 0 || game.players.self.player_state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p1PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.board_state.results[i][j] == -1) {
				if (this.board_state.shields[i][j] == 1) {
					if ((game.players.self.player_state.deshielding > 0 || game.players.self.player_state.damagingA > 0 || game.players.self.player_state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p2ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					if ((game.players.self.player_state.shielding > 0 ) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) {
						game.ctx.shadowColor = "green";
					} else if (( game.players.self.player_state.damagingA > 0 || game.players.self.player_state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p2PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.board_state.frost[i][j] == 4 || this.board_state.frost[i][j] == 3) {
				if ((game.players.self.player_state.thawing > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.frostImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.frost[i][j] == 2 || this.board_state.frost[i][j] == 1) {
				if ((game.players.self.player_state.thawing > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.frostImage1, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 6 || this.board_state.rock[i][j] == 5) {
				if ((game.players.self.player_state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.blockedImage3, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 4 || this.board_state.rock[i][j] == 3) {
				if ((game.players.self.player_state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.blockedImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 2 || this.board_state.rock[i][j] == 1) {
				if ((game.players.self.player_state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.blockedImage1, i*100 + this.x, j*100 + this.y, 100, 100);
			} 
		}
	}
	game.ctx.shadowBlur = 0;
};

// Check if co-ordinates are within Board object
game_board.prototype.contains = function(mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between the shape's X and (X + Width) and its Y and (Y + Height)
	return (this.x <= mx) && (this.x + this.w >= mx) && (this.y <= my) && (this.y + this.h >= my);
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


/*  -----------------------------  End turn button classs  -----------------------------  */

var end_turn_button = function() {
	this.w = 100;
	this.h = 50;
	this.x = 20;
	this.text = "End Turn";
};

end_turn_button.prototype.draw = function(){
	if (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1){ // players turn
		game.ctx.shadowBlur = 20;
		game.ctx.shadowColor="green";
	}		

	game.ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
	game.ctx.fillRect(this.x, canvasHeight/2, this.w, this.h);
	game.ctx.shadowBlur=0;

	// Set faux rounded corners
	/*context.lineJoin = "round";
	context.lineWidth = cornerRadius;
	// Change origin and dimensions to match true size (a stroke makes the shape a bit larger)
	context.strokeRect(rectX+(cornerRadius/2), rectY+(cornerRadius/2), rectWidth-cornerRadius, rectHeight-cornerRadius);
	context.fillRect(rectX+(cornerRadius/2), rectY+(cornerRadius/2), rectWidth-cornerRadius, rectHeight-cornerRadius);*/

	game.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
	game.ctx.textAlign="center"; 
	game.ctx.fillText(this.text, 20 + this.w / 2, canvasHeight / 2 + 30);
	//game.ctx.textAlign="start"; 
};

end_turn_button.prototype.contains = function(mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between the shape's X and (X + Width) and its Y and (Y + Height)
	return  (this.x <= mx) && (this.x + this.w >= mx) && (canvasHeight/2 <= my) && (canvasHeight/2 + this.h >= my);
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

game_card.prototype.draw = function(self){ //draw card
	var cardEffects = [];

	for (var i = 0; i < cards.length; i++){
		if (cards[i].name === this.cardName){
			cardEffects = cards[i].effects;
		}
	}

	this.cardBody = new Image();
	this.cardBody.src = "img/card_" + this.cardName.toLowerCase().split(" ").join("_") + ".png"; //hmmm

	this.cardBack = new Image();
	this.cardBack.src = game.players.self.host === true ? "img/card_back2.png" : "img/card_back1.png";

	game.ctx.shadowBlur = 20;
	if ((self === true) && (game.players.self.player_state.discarding > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
		game.ctx.shadowColor = "red";
	} else if ((self === true) && (game.players.self.player_state.cards_to_play > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
		game.ctx.shadowColor = "green";
	} else {
		game.ctx.shadowColor = "black";
	}

	//Just makes the glow
	game.ctx.fillStyle = 'rgba(140,120,100,1)';
	//game.ctx.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
	roundedImage(this.pos.x, this.pos.y, this.size.x, this.size.y, 10);
	game.ctx.fill();

	//Clipping
	game.ctx.save();
	//roundedImage(this.pos.x, this.pos.y, this.size.x, this.size.y, 10);
	game.ctx.clip();
	
	if (self === true) {
		game.ctx.drawImage(this.cardBody, this.pos.x, this.pos.y, this.size.x, this.size.y);
	} else {
		game.ctx.drawImage(this.cardBack, this.pos.x, this.pos.y, this.size.x, this.size.y);
	}

	game.ctx.restore();
	game.ctx.shadowBlur = 0;
	if (self === true) {
		layout_text(game.ctx, this.pos.x + 10, this.pos.y + 10, this.size.x - 20, 40, this.cardName, 14, 2);
		layout_text(game.ctx, this.pos.x + 10, this.pos.y + this.size.y / 2, this.size.x - 20, this.size.y / 2 - 10, cardEffects.join('. ') + '.', 12, 2);
	}
}; 

game_card.prototype.contains = function(mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between the shape's X and (X + Width) and its Y and (Y + Height)
	return  (this.pos.x <= mx) && (this.pos.x + this.size.x >= mx) && (this.pos.y <= my) && (this.pos.y + this.size.y >= my);
};

//Check card can be played
game_card.prototype.checkPlayable = function(){
	console.log("Check card is playable");
	if (game.players.self.host === true && game.turn === -1) { // not players turn
		return false;
	} else if (game.players.self.host === false && game.turn === 1) { // not players turn (can condense)
		return false;
	} else {
		return true; // It's players turn
	}
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

	//Player arrays
	this.deck = [],
	this.hand = [];

	var deck_temp = ["Fire Blast", "Fire Blast", "Fire Blast", "Ice Blast", "Ice Blast", "Frost", "Summer", "Summer",  "Sabotage", "Armour Up", "Armour Up", "Taxes", "Flurry", "Sacrifice", "Boulder",  "Floods", "Floods", "Barrage", "Barrage", "Bezerker", "Bezerker", "Reckless"];
	deck_temp = shuffle(deck_temp);
	this.deck = create_card_array(deck_temp);
	//this.deck = JSON.parse('json/deck_p1.json'); //asign deck //var tempDeck = JSON.parse(eval("deck_p" + this.playerNo));
	//Our local history of inputs
	this.inputs = [];
}; //game_player.constructor

game_player.prototype.draw = function(){
	//Set the color for this player
	game.ctx.clearRect(0, 0, 120, 120); //Clear the screen area
	game.ctx.textAlign = "start"; 
	game.ctx.fillStyle = "black";
	game.ctx.fillText(this.state, 10, 10);
	//Draw player_state variables
	var key_counter = 0;
	for (var key in this.player_state) {
		if (this.player_state[key] > 0) {
			game.ctx.fillText(key + ": " + this.player_state[key], 10, 20 + 10 * key_counter);
			key_counter++;
		}
	}

	//draw drawn cards
	for (var i = 0; i < this.hand.length; i++) {
		this.hand[i].pos.x = canvasWidth / 2 - (this.hand[i].size.hx / 2 * (this.hand.length + 1)) + (this.hand[i].size.hx * i) ;

		if (game.players.self === this){
			this.hand[i].pos.y = 520;
			this.hand[i].draw(true);
		} else {
			this.hand[i].pos.y = 20;
			this.hand[i].draw(false);
		}
	}
}; //game_player.draw

/*  -----------------------------  Common Core Game functions  -----------------------------  
	These functions are shared between client and server, and are generic
	for the game state. The client functions are client_* and server functions
	are server_* so these have no prefix.
*/

//Main update loop
game_core.prototype.update = function(t) {
	this.lastframetime = t; //Store the last frame time
	//Update the game specifics
	this.client_update();

	//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update

//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() { 
	window.cancelAnimationFrame( this.updateid );  
};

/*  -----------------------------  Shared between server and client.  -----------------------------  
	`item` is type game_player.
*/
game_core.prototype.process_input = function( player ) {
	//It's possible to have recieved multiple inputs by now, so we process each one
	var x_dir = 0;
	var y_dir = 0;
	var ic = player.inputs.length;

	//we have a direction vector now, so apply the same physics as the client
	if(player.inputs.length) {
		//we can now clear the array since these have been processed
		player.last_input_time = player.inputs[ic-1].time;
		player.last_input_seq = player.inputs[ic-1].seq;
	}
	//give it back
	return;
}; //game_core.process_input

/* -----------------------------  Client side functions  ----------------------------- */

game_core.prototype.client_onserverupdate_recieved = function(data){
	//Lets clarify the information we have locally. One of the players is 'hosting' and the other is a joined in client, so we name these host and client for making sure
	//the positions we get from the server are mapped onto the correct local sprites
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;
	var this_player = this.players.self;
	
	this.server_time = data.t; //Store the server time (this is offset by the latency in the network, by the time we get it)
	this.client_time = this.server_time - (this.net_offset/1000); //Update our local offset time from the last server update

	data = JSON.parse(data);
	// Store server's last state
	this.turn = data.tu;
	this.board.board_state = data.bo;
	player_host.player_state = data.hp;
	player_host.hand = create_card_array(data.hh);
	player_host.deck = create_card_array(data.hd);            
	player_client.player_state = data.cp;
	player_client.hand = create_card_array(data.ch);
	player_client.deck = create_card_array(data.cd);         
	this.players.self.last_input_seq = data.his;    //'host input sequence', the last input we processed for the host
	this.players.other.last_input_seq = data.cis;   //'client input sequence', the last input we processed for the client
	this.server_time = data.t;   // our current local time on the server

	this.client_update();
}; //game_core.client_onserverupdate_recieved

//require('test_file.js');

game_core.prototype.client_update = function() {
	// Only do if something has changed?
	//console.log('hmmm' + !node || this.server);
	this.ctx.clearRect(0, 0, canvasWidth, canvasHeight); //Clear the screen area
	this.client_draw_info(); //draw help/information if required

	this.end_turn_button.draw();
	this.board.draw(); // Draw board
	this.players.other.draw(); // draw other player (post server update)
	this.players.self.draw(); //Draw self
}; //game_core.update_client

game_core.prototype.create_timer = function(){
	setInterval(function(){
		this._dt = new Date().getTime() - this._dte;
		this._dte = new Date().getTime();
		this.local_time += this._dt/1000.0;
	}.bind(this), 4);
}

game_core.prototype.client_create_ping_timer = function() {
	//Set a ping timer to 1 second, to maintain the ping/latency between
	//client and server and calculated roughly how our connection is doing
	setInterval(function(){
		this.last_ping_time = new Date().getTime();
		this.socket.send('p.' + (this.last_ping_time) );

	}.bind(this), 1000);
}; //game_core.client_create_ping_timer

game_core.prototype.client_create_configuration = function() {
	this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number

	this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
	this.net_ping = 0.001;              //The round trip time from here to the server,and back
	this.last_ping_time = 0.001;        //The time we last sent a ping

	this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients

	this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
	this.server_time = 0.01;            //The time the server reported it was at, last we heard from it

	this.lit = 0;
	this.llt = new Date().getTime();

}; //game_core.client_create_configuration

game_core.prototype.client_onreadygame = function(data) {
	var server_time = parseFloat(data.replace('-','.'));
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;

	this.local_time = server_time + this.net_latency;
	console.log('server time is about ' + this.local_time);
		
	//Update their information
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';

	this.players.self.state = 'YOU ' + this.players.self.state;
}; //client_onreadygame

game_core.prototype.client_onjoingame = function(data) {
	this.players.self.host = false; //We are not the host
	this.players.self.state = 'connected.joined.waiting'; // Update state
}; //client_onjoingame

game_core.prototype.client_onhostgame = function(data) {
	var server_time = parseFloat(data.replace('-','.')); //The server sends the time when asking us to host, but it should be a new game. so the value will be really small anyway (15 or 16ms)
	this.local_time = server_time + this.net_latency; //Get an estimate of the current time on the server
	this.players.self.host = true; //Flag self as host
	this.players.self.state = 'hosting.waiting for a player'; //Update debugging information to display state
}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {
	//The server responded that we are now in a game, this lets us store the information about ourselves and set the colors
	//to show we are now ready to be playing.
	this.players.self.id = data.id;
	this.players.self.state = 'connected';
	this.players.self.online = true;
}; //client_onconnected

game_core.prototype.client_onping = function(data) {
	this.net_ping = new Date().getTime() - parseFloat( data );
	this.net_latency = this.net_ping/2;

}; //client_onping

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
			} //subcommand
		break; //'s'
	} //command
				
}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function(data) {
	//When we disconnect, we don't know if the other player is connected or not, and since we aren't, everything goes to offline
	this.players.self.state = 'not-connected';
	this.players.self.online = false;
	this.players.other.state = 'not-connected';
}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function() {
	if (node) {
		console.log("shouldn't be here" + this.server);
		io = require('socket.io-client')(serverIP);
		//io = require('socket.io-client');
	}

	this.socket = io.connect(); //Store a local reference to our connection to the server
	console.log(this.socket);

	//When we connect, we are not 'connected' until we have a server id and are placed in a game by the server. The server sends us a message for that.
	this.socket.on('connect', function(){
		this.players.self.state = 'connecting';
	}.bind(this));

	this.socket.on('disconnect', this.client_ondisconnect.bind(this)); 					// Disconnected - e.g. network, server failed, etc.
	this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this)); 	// Tick of the server simulation - main update
	this.socket.on('onconnected', this.client_onconnected.bind(this)); 					// Connect to server - show state, store id
	this.socket.on('error', this.client_ondisconnect.bind(this)); 						// Error -> not connected for now
	this.socket.on('message', this.client_onnetmessage.bind(this)); 					// Parse message from server, send to handlers
}; //game_core.client_connect_to_server

game_core.prototype.client_draw_info = function() {
	if (this.players.self.host) {  // If host
		this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
		this.ctx.fillText('You are the host', 10 , 465);
	}
	this.ctx.fillStyle = 'rgba(255,255,255,1)'; //reset
}; //game_core.client_draw_help
