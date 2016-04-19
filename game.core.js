//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server

/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
var maxHandSize = 10,
	canvasWidth = 720,
	canvasHeight = 800;

var cards = [{"name":"Fire Blast","rarity":"Basic","effects":["Deal 1 damage"]},{"name":"Floods","rarity":"Rare","effects":["Destroy all pieces","End your turn"]},{"name":"Armour Up","rarity":"Basic","effects":["Shield a piece","Draw a card"]},{"name":"Flurry","rarity":"Rare","effects":["Deal 2 damage to your pieces","Deal 2 damage to enemy pieces"]},{"name":"Sabotage","rarity":"Elite","effects":["Remove 5 shields"]},{"name":"Summer","rarity":"Basic","effects":["Thaw 1 square","Draw a card"]},{"name":"Ice Blast","rarity":"Basic","effects":["Freeze a square"]},{"name":"Sacrifice","rarity":"Rare","effects":["Destroy a piece of yours","Draw 3 cards"]},{"name":"Boulder","rarity":"Rare","effects":["Discard a card","Block a square"]},{"name":"Frost","rarity":"Basic","effects":["Freeze all squares"]},{"name":"Taxes","rarity":"Rare","effects":["Discard 2 cards","Shield 3 pieces"]},{"name":"Barrage","rarity":"Basic","effects":["Damage all pieces","Discard 2 cards"]},{"name":"Bezerker","rarity":"Rare","effects":["Discard a card","Deal 1 damage","If you have the least pieces, return this card to your hand"]},{"name":"Reckless","rarity":"Rare","effects":["Your opponent draws 2 cards","Destroy a piece"]}]


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

// Array shuffle function
var shuffle = function(o){
	for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
}
 
// initialise an array of cards - e.g. for new hand or deck
var create_card_array = function(data) {
	var cards = []
	for (var i = 0; i < data.length; i++) {
		cards.push(create_card(data[i]));
	}

	return cards;
}

//initialise a card
var create_card = function(data) {
	if (data.cardName !== undefined){
		var card = new game_card(data.cardName);
	} else {
		var card = new game_card(data);
	}
	return card;
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
var layout_text = function(canvas, x, y, w, h, text, font_size, spl) {
	// The painting properties Normally I would write this as an input parameter
	var Paint = {
		RECTANGLE_STROKE_STYLE : 'black',
		RECTANGLE_LINE_WIDTH : 1,
		VALUE_FONT : '12px Arial',
		VALUE_FILL_STYLE : 'red'
	}

	var split_lines = function(ctx, mw, font, text) {
		// We give a little "padding" This should probably be an input param but for the sake of simplicity we will keep it this way
		mw = mw - 10;
		// We setup the text font to the context (if not already)
		ctx2d.font = font;
		// We split the text by words 
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
	// Obtains the context 2d of the canvas It may return null
	ctx2d = canvas;
	if (ctx2d) {
		game.ctx.textAlign = "start"; 
		// draw rectangular
		ctx2d.fillStyle = 'rgba(200, 180, 140, 0.8)';
		ctx2d.fillRect(x, y, w, h);

		// Paint text
		var lines = split_lines(ctx2d, w, Paint.VALUE_FONT, text);
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
				lx = x + w / 2 - ctx2d.measureText(lines[j]).width / 2;
				// DEBUG 
				//window.console.log("ctx2d.fillText('"+ lines[j] +"', "+ lx +", " + ly + ")");
				game.ctx.fillStyle = 'rgba(0,0,0,1)';
				ctx2d.fillText(lines[j], lx, ly);
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
	if (this.server) { // if this is server side
		this.players = {
			self : new game_player(this, this.instance.player_host),
			other : new game_player(this, this.instance.player_client)
		};
	} else { // if this is client side - also handle visuals
		this.players = {
			self : new game_player(this),
			other : new game_player(this)
		};
	}
	//A local timer for precision on server and client
	this.local_time = 0.016;            //The local timer
	this._dt = new Date().getTime();    //The local timer delta
	this._dte = new Date().getTime();   //The local timer last frame time

	//Start a fast paced timer for measuring time easier
	this.create_timer();

	//Client specific initialisation
	if(!this.server) {
		this.client_create_configuration(); //Create the default configuration settings
		this.server_updates = []; //A list of recent server updates we interpolate across this is the buffer that is the driving factor for our networking
		this.client_connect_to_server(); //Connect to the socket.io server!
		this.client_create_ping_timer(); //We start pinging the server to determine latency

		//Make this only if requested
		if(String(window.location).indexOf('debug') != -1) {
			this.client_create_debug_gui();
		}
	} else { //server side
		this.server_time = 0;
		this.laststate = {};
	}

}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if ( 'undefined' != typeof global ) {
	module.exports = global.game_core = game_core;
}

/* Helper functions for the game code
	Here we have some common maths and game related code to make working with 2d vectors easy,
	as well as some helpers for rounding numbers to fixed point.
*/
// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
//copies a 2d vector like object from one to another
game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
//Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
//Subtract a 2d vector with another one and return the resulting vector
game_core.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
//Multiply a 2d vector with a scalar value and return the resulting vector
game_core.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };
//Simple linear interpolation
game_core.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
//Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };


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
	for (var i = 0; i < 4; i++){
		for (var j = 0; j < 4; j++){
			if (this.board_state.results[i][j] == 1) {
				//needs to check for player
				if (this.board_state.shields[i][j] == 1) {
					game.ctx.drawImage(this.p1ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					game.ctx.drawImage(this.p1PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.board_state.results[i][j] == -1) {
				if (this.board_state.shields[i][j] == 1) {
					game.ctx.drawImage(this.p2ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					game.ctx.drawImage(this.p2PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.board_state.frost[i][j] == 4 || this.board_state.frost[i][j] == 3) {
				game.ctx.drawImage(this.frostImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.frost[i][j] == 2 || this.board_state.frost[i][j] == 1) {
				game.ctx.drawImage(this.frostImage1, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 6 || this.board_state.rock[i][j] == 5) {
				game.ctx.drawImage(this.blockedImage3, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 4 || this.board_state.rock[i][j] == 3) {
				game.ctx.drawImage(this.blockedImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.board_state.rock[i][j] == 2 || this.board_state.rock[i][j] == 1) {
				game.ctx.drawImage(this.blockedImage1, i*100 + this.x, j*100 + this.y, 100, 100);
			} 
		}
	}
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
	}
	if (this.checkCols() !== undefined){
		return this.checkCols();
	}
	if (this.checkDiagonals() !== undefined){
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
	if ((self === true) && (game.players.self.player_state.cards_to_play > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
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
	window.console.log("Check card is playable");
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

	/*for (var i = 0; i < deck_temp.length; i++) {
		this.deck.push(new game_card(deck_temp[i]));
	}*/

	this.deck = create_card_array(deck_temp);

	//this.deck = JSON.parse('json/deck_p1.json'); //asign deck //var tempDeck = JSON.parse(eval("deck_p" + this.playerNo));

	//Our local history of inputs
	this.inputs = [];
}; //game_player.constructor

game_player.prototype.draw = function(){
	//Set the color for this player
	game.ctx.fillStyle = "black";
	game.ctx.fillText(this.state, 10, 10);
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
	this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016; // delta time

	this.lastframetime = t; //Store the last frame time

	//Update the game specifics
	if (!this.server) { // client
		//this.client_update(false);
	} else { // server
		this.server_update();
	}
	//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update


/*  -----------------------------  Shared between server and client.  -----------------------------  
	`item` is type game_player.
*/
game_core.prototype.endTurn = function( item ) {
	this.turn = this.turn === 1 ? -1 : 1;
}; // end turn

game_core.prototype.process_input = function( player ) {
	//It's possible to have recieved multiple inputs by now, so we process each one
	var x_dir = 0;
	var y_dir = 0;
	var ic = player.inputs.length;

	/*if (ic) {
		for(var j = 0; j < ic; ++j) {
			//don't process ones we already have simulated locally
			if (player.inputs[j].seq <= player.last_input_seq) continue;

			var input = player.inputs[j].inputs;
			window.console.log(input);
			var c = input.length;

			try {
				var input_parts = input.split('.');
			}
			catch(err) {
				var input_parts = input;
			}
			
			window.console.log("Input parts: " + input_parts);
			target = [];
			if (input_parts[0] == 'en') { //end turn

			} else if (input_parts[0] == 'ca') { // card
				target = input_parts[1];
				window.console.log('HMmmmm2 > ');
				//window.console.log(player.hand);
				for (var i = player.hand.length - 1; i >= 0; i--) {
					window.console.log('HMmmmm');
					if (player.hand[i].cardName === target) {
					   player.hand.splice(i, 1);
					   break;
					}
				}
			} else if (input_parts[0] == 'sq') { // square
				target = input_parts[1];
			}
		} //for each input command
	} //if we have inputs*/

	//we have a direction vector now, so apply the same physics as the client
	if(player.inputs.length) {
		//we can now clear the array since these have been processed
		player.last_input_time = player.inputs[ic-1].time;
		player.last_input_seq = player.inputs[ic-1].seq;
	}
	//give it back
	return;

}; //game_core.process_input


/*  -----------------------------  Server side functions  -----------------------------  
	These functions below are specific to the server side only,
	and usually start with server_* to make things clearer.

*/

//Makes sure things run smoothly and notifies clients of changes on the server side
game_core.prototype.server_update = function(){
	//Update the state of our local clock to match the timer
	this.server_time = this.local_time;
	//Make a snapshot of the current state, for updating the clients

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

	if ( this.laststate.tu !== this.tempstate.tu || // If values are different
		this.laststate.bo !== this.tempstate.bo ||
		this.laststate.hp !== this.tempstate.hp ||
		this.laststate.hh !== this.tempstate.hh ||
		this.laststate.hd !== this.tempstate.hd ||
		this.laststate.cp !== this.tempstate.cp ||
		this.laststate.ch !== this.tempstate.ch ||
		this.laststate.cd !== this.tempstate.cd ||
		this.tempstate.t - this.laststate.t >= 0.1) { // Time based refresh.... not ideal, arbitrary
			/*window.console.log("FFFFFFFSFSFSFSFFSFS");
			window.console.log(this.laststate.bo !== this.tempstate.bo);
			window.console.log(this.laststate.bo);
			window.console.log(this.tempstate.bo);*/

			this.laststate = this.tempstate;

			if (this.players.self.instance) { //Send the snapshot to the 'host' player
				this.players.self.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
			}
			if (this.players.other.instance) { //Send the snapshot to the 'client' player
				this.players.other.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
			}
	} else {
		//pass
	}
}; //game_core.server_update

//Handle server input (input into the server, from a client)
game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {
	window.console.log(input);
	//Fetch which client this refers to out of the two
	var player_client = (client.userid == this.players.self.instance.userid) ? this.players.self : this.players.other;
	var player_other = (client.userid == this.players.self.instance.userid) ?  this.players.other : this.players.self;

	if (input) {
		var c = input.length;

		try {
			var input_parts = input.split('.');
		} catch(err) {
			var input_parts = input;
		}
		
		target = [];
		if (input_parts[0] == 'en') { //end turn
			this.turn = this.turn == 1 ? -1 : 1;
			//resets
			player_client.player_state = {
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

			window.console.log(this.board.check_win());

			if (this.board.check_win() !== undefined){ //check for win
				this.win = this.board.check_win();
			} else {
				this.board.reduce_state();

				window.console.log('drawing card');
				if (player_other.deck.length > 0 && player_other.hand.length < maxHandSize) {
					player_other.hand.push(player_other.deck[0]);
					player_other.deck.splice(0, 1);
				} else {
					window.console.log("Hand full - " + player_other.deck.length + ", " + player_other.hand.length);
				}
			}
		} else if (input_parts[0] == 'ca') { // Clicked card
			target = input_parts[1];
			for (var i = player_client.hand.length - 1; i >= 0; i--) {
				if (player_client.hand[i].cardName === target) {
					player_client.hand.splice(i, 1);
					player_client.player_state.cards_to_play = player_client.player_state.cards_to_play - 1;
					this.resolve_card(target, player_client);
					break;
				}
			}
		} else if (input_parts[0] == 'sq') { // Clicked square
			target = input_parts[1];
			window.console.log(target);
			this.handle_card(target[0] - 1, target[1] - 1, player_client);

		} else if (input_parts[0] === 'dr') {
			window.console.log('drawing card');
			if (player_client.deck.length > 0 && player_client.hand.length < maxHandSize) {
				player_client.hand.push(player_client.deck[0]);
				player_client.deck.splice(0, 1);
			} else {
				window.console.log("Hand full - " + player_client.deck.length + ", " + player_client.hand.length);
			}
		}
	} //if we have inputs

	//Store the input on the player instance for processing in the physics loop
	player_client.inputs.push({
		inputs	:   input, 
		time	:   input_time, 
		seq		:   input_seq
	});
}; //game_core.handle_server_input

		/*results : [],
		frost 	: [],
		rock 	: [],
		shields : []*/

game_core.prototype.handle_card = function(row, col, player) {
	window.console.log('Target square >>> ' + row + ', ' + col);

	if (this.board.board_state.results[row][col] !== 0 || this.board.board_state.frost[row][col] >= 1 || this.board.board_state.rock[row][col] >= 1){
		window.console.log("The cell is occupied!");
		if (this.board.board_state.results[row][col] !== 0) { // Piece
			if (player.player_state.destroyingA > 0) { //Destroying enemy
				window.console.log('Destroying any piece');
				this.board.board_state.results[row][col] = 0;
				player.player_state.destroyingA--;
			} else if (player.player_state.destroyingE > 0) { //Destroying enemy
				if (this.board.board_state.results[row][col] !== this.currentPlayer) {
					window.console.log('Destroying an enemy');
					this.board.board_state.results[row][col] = 0;
					player.player_state.destroyingE--;
				}
			} else if (player.player_state.destroyingS > 0) { //Destroying
				if (this.board.board_state.results[row][col] === this.currentPlayer) {
					window.console.log('Destroying own piece');
					this.board.board_state.results[row][col] = 0;
					player.player_state.destroyingS--;
				}
			} else if (player.player_state.damagingA > 0) { //Damaging
				window.console.log('Damaging any');
				if (this.board.board_state.shields[row][col] === 1) {
					this.board.board_state.shields[row][col] = 0;
				} else {
					this.board.board_state.results[row][col] = 0;
				}
				player.player_state.damagingA--;
			} else if (player.player_state.damagingE > 0) { //Damaging
				if (this.board.board_state.results[row][col] !== this.currentPlayer) {
					window.console.log('Damaging enemy');
					if (this.board.board_state.shields[row][col] === 1) {
						this.board.board_state.shields[row][col] = 0;
					} else {
						this.board.board_state.results[row][col] = 0;
					}
					player.player_state.damagingE--;
				}
			} else if (player.player_state.damagingS > 0) { //Damaging
				if (this.board.board_state.results[row][col] === this.currentPlayer) {
					window.console.log('Damaging own piece');
					if (this.board.board_state.shields[row][col] === 1) {
						this.board.board_state.shields[row][col] = 0;
					} else {
						this.board.board_state.results[row][col] = 0;
					}
					player.player_state.damagingS--;
				}
			} else if (player.player_state.shielding > 0) {
				this.board.board_state.shields[row][col] = 1;
				player.player_state.shielding--;
			} else if (player.player_state.deshielding > 0) {
				this.board.board_state.shields[row][col] = 0;
				player.player_state.deshielding--;
			}
		} else if (this.board.board_state.frost[row][col] >= 1 && player.player_state.thawing > 0) {
			window.console.log ("Thawing out a square");
			this.board.board_state.frost[row][col] = 0;
			player.player_state.thawing -= 1;
		} else if (this.board.board_state.rock[row][col] >= 1 && player.player_state.deblocking > 0) {
			window.console.log ("Deblocking a square");
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
			}
		}
	}
};



/* -----------------------------  Client side functions  -----------------------------   
	These functions below are specific to the client side only,
	and usually start with client_* to make things clearer.
*/

game_core.prototype.client_handle_input = function(){ // change to client_handle_keyboard_input??
	//if(this.lit > this.local_time) return;
	//this.lit = this.local_time+0.5; //one second delay
	//This takes input from the client and keeps a record,
	//It also sends the input information to the server immediately as it is pressed. It also tags each input with a sequence number.
	var x_dir = 0,
		y_dir = 0,
		input = [];

	this.client_has_input = false;

	if(input.length) {
		//Update what sequence we are on now
		this.input_seq += 1;
		//Store the input state as a snapshot of what happened.
		this.players.self.inputs.push({
			inputs : input,
			time : this.local_time.fixed(3),
			seq : this.input_seq
		});

		//Send the packet of information to the server. The input packets are labelled with an 'i' in front.
		var server_packet = 'i.';
			server_packet += input.join('-') + '.';
			server_packet += this.local_time.toFixed(3).replace('.','-') + '.';
			server_packet += this.input_seq;
		//Go
		this.socket.send( server_packet );

		//Return the direction if needed
		return;
	} else {
		return;
	}
}; //game_core.client_handle_input

game_core.prototype.client_onserverupdate_recieved = function(data){
	//Lets clarify the information we have locally. One of the players is 'hosting' and
	//the other is a joined in client, so we name these host and client for making sure
	//the positions we get from the server are mapped onto the correct local sprites
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;
	var this_player = this.players.self;
	
	//Store the server time (this is offset by the latency in the network, by the time we get it)
	this.server_time = data.t;
	//Update our local offset time from the last server update
	this.client_time = this.server_time - (this.net_offset/1000);

	//window.console.log('Pre Parsed' + data.hh);

	data = JSON.parse(data);

	//window.console.log('JSON Parsed' + data.hh);

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

	this.client_update(true);
}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update = function(visual_change) {
	// Only do if something has changed?
	if (visual_change === true){
		this.ctx.clearRect(0,0,canvasWidth,canvasHeight); //Clear the screen area
		this.client_draw_info(); //draw help/information if required
		this.client_handle_input(); //Capture inputs from the player

		this.end_turn_button.draw();
		this.board.draw(); // Draw board
		this.players.other.draw(); // draw other player (post server update)
		this.players.self.draw(); //Draw self

		/*function getMousePos(canvas, evt) {
		    var rect = canvas.getBoundingClientRect();
		    return {
		      x: evt.clientX - rect.left,
		      y: evt.clientY - rect.top
		    };
		}

		var mouse_pos = getMousePos(this.ctx, e);
		var mx = event.clientX,
			my = event.clientY,
			shapes = [game.board];
		shapes = shapes.concat(game.end_turn_button, game.players.self.hand); // create array of all clickable objects

		for (var i = shapes.length - 1; i >= 0; i--) { // Check all clickable objects
		  	if (shapes[i].contains(mx, my)) {
		  		shapes[i].draw();
				break;
			}
		}*/
	}

	//Work out the fps average
	this.client_refresh_fps();
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
		this.last_ping_time = new Date().getTime() - this.fake_lag;
		this.socket.send('p.' + (this.last_ping_time) );

	}.bind(this), 1000);
}; //game_core.client_create_ping_timer

game_core.prototype.client_create_configuration = function() {
	this.show_help = false;             //Whether or not to draw the help text
	this.naive_approach = false;        //Whether or not to use the naive approach
	this.show_server_pos = false;       //Whether or not to show the server position
	this.show_dest_pos = false;         //Whether or not to show the interpolation goal
	this.client_predict = true;         //Whether or not the client is predicting input
	this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
	this.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
	this.client_smooth = 25;            //amount of smoothing to apply to client update dest

	this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
	this.net_ping = 0.001;              //The round trip time from here to the server,and back
	this.last_ping_time = 0.001;        //The time we last sent a ping
	this.fake_lag = 0;                //If we are simulating lag, this applies only to the input client (not others)
	this.fake_lag_time = 0;

	this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
	this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
	this.target_time = 0.01;            //the time where we want to be in the server timeline
	this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

	this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
	this.server_time = 0.01;            //The time the server reported it was at, last we heard from it
	
	this.dt = 0.016;                    //The time that the last frame took to run
	this.fps = 0;                       //The current instantaneous fps (1/this.dt)
	this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
	this.fps_avg = 0;                   //The current average fps displayed in the debug UI
	this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

	this.lit = 0;
	this.llt = new Date().getTime();

}; //game_core.client_create_configuration

game_core.prototype.client_create_debug_gui = function() {
	this.gui = new dat.GUI();

	var _playersettings = this.gui.addFolder('Your settings');

	//We want to know when we change our color so we can tell the server to tell the other clients for us
	this.colorcontrol.onChange(function(value) {
		this.players.self.color = value;
		localStorage.setItem('color', value);
		this.socket.send('c.' + value);
	}.bind(this));

	_playersettings.open();

	var _othersettings = this.gui.addFolder('Methods');
		_othersettings.add(this, 'naive_approach').listen();
		_othersettings.add(this, 'client_smoothing').listen();
		_othersettings.add(this, 'client_smooth').listen();
		_othersettings.add(this, 'client_predict').listen();

	var _debugsettings = this.gui.addFolder('Debug view');
		_debugsettings.add(this, 'show_help').listen();
		_debugsettings.add(this, 'fps_avg').listen();
		_debugsettings.add(this, 'show_server_pos').listen();
		_debugsettings.add(this, 'show_dest_pos').listen();
		_debugsettings.add(this, 'local_time').listen();
		_debugsettings.open();

	var _consettings = this.gui.addFolder('Connection');
		_consettings.add(this, 'net_latency').step(0.001).listen();
		_consettings.add(this, 'net_ping').step(0.001).listen();

	//When adding fake lag, we need to tell the server about it.
	var lag_control = _consettings.add(this, 'fake_lag').step(0.001).listen();
	lag_control.onChange(function(value){
		this.socket.send('l.' + value);
	}.bind(this));

	_consettings.open();

	var _netsettings = this.gui.addFolder('Networking');
		
		_netsettings.add(this, 'net_offset').min(0.01).step(0.001).listen();
		_netsettings.add(this, 'server_time').step(0.001).listen();
		_netsettings.add(this, 'client_time').step(0.001).listen();
		//_netsettings.add(this, 'oldest_tick').step(0.001).listen();

		_netsettings.open();
}; //game_core.client_create_debug_gui

game_core.prototype.client_reset_positions = function() {
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;

	//removed pos resets
}; //game_core.client_reset_positions

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
	//We are not the host
	this.players.self.host = false;
	//Update the local state
	this.players.self.state = 'connected.joined.waiting';

	//Make sure the positions match servers and other clients
	this.client_reset_positions();

}; //client_onjoingame

game_core.prototype.client_onhostgame = function(data) {
	//The server sends the time when asking us to host, but it should be a new game.
	//so the value will be really small anyway (15 or 16ms)
	var server_time = parseFloat(data.replace('-','.'));

	//Get an estimate of the current time on the server
	this.local_time = server_time + this.net_latency;

	//Set the flag that we are hosting, this helps us position respawns correctly
	this.players.self.host = true;

	//Update debugging information to display state
	this.players.self.state = 'hosting.waiting for a player';

	//Make sure we start in the correct place as the host.
	this.client_reset_positions();

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
		//Store a local reference to our connection to the server
		this.socket = io.connect();

		//When we connect, we are not 'connected' until we have a server id and are placed in a game by the server. The server sends us a message for that.
		this.socket.on('connect', function(){
			this.players.self.state = 'connecting';
		}.bind(this));

		//Sent when we are disconnected (network, server down, etc)
		this.socket.on('disconnect', this.client_ondisconnect.bind(this));
		//Sent each tick of the server simulation. This is our authoritive update
		this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
		//Handle when we connect to the server, showing state and storing id's.
		this.socket.on('onconnected', this.client_onconnected.bind(this));
		//On error we just show that we are not connected for now. Can print the data.
		this.socket.on('error', this.client_ondisconnect.bind(this));
		//On message from the server, we parse the commands and send it to the handlers
		this.socket.on('message', this.client_onnetmessage.bind(this));

}; //game_core.client_connect_to_server

game_core.prototype.client_refresh_fps = function() {
	//We store the fps for 10 frames, by adding it to this accumulator
	this.fps = 1/this.dt;
	this.fps_avg_acc += this.fps;
	this.fps_avg_count++;

	//When we reach 10 frames we work out the average fps
	if(this.fps_avg_count >= 10) {
		this.fps_avg = this.fps_avg_acc/10;
		this.fps_avg_count = 1;
		this.fps_avg_acc = this.fps;

	} //reached 10 frames

}; //game_core.client_refresh_fps

game_core.prototype.client_draw_info = function() {
	this.ctx.fillStyle = 'rgba(255,255,255,0.3)'; //We don't want this to be too distracting

	//They can hide the help with the debug GUI
	if(this.show_help) {
		this.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
		this.ctx.fillText('server_time : last known game time on server', 10 , 70);
		this.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
		this.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
		this.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
		this.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
		this.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
		this.ctx.fillText('This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);

	} //if this.show_help

	//Draw some information for the host
	if(this.players.self.host) {
		this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
		this.ctx.fillText('You are the host', 10 , 465);

	} //if we are the host

	//Reset the style back to full white.
	this.ctx.fillStyle = 'rgba(255,255,255,1)';

}; //game_core.client_draw_help

// Resolve card effects
game_core.prototype.resolve_card = function(card, player) {
	cardEffects = [];
	for (var j = 0; j < cards.length; j++){
		if (cards[j].name === card){
			cardEffects = cards[j].effects;
		}
	}

	var conditionIf = new RegExp("^if$", "i"),
		deal = new RegExp("^deal$|^damage$", "i");     // ^x$ dictates explicit regex matching
		destroy = new RegExp("^destroy$|^remove$", "i"),
		draw = new RegExp("^draw$|^draws$", "i"),
		one = new RegExp("^a$|^1$", "i"),
		every = new RegExp("^all$|^every$", "i"),
		endTurn = new RegExp("^end$", "i"),
		targetSelf = new RegExp("^your$|^yours$", "i"),
		targetEnemy = new RegExp("^enemy$|^opponent$", "i"),
		freeze = new RegExp("^freeze$", "i"),
		thaw = new RegExp("^thaw$", "i"),
		shield = new RegExp("^shield$|^shields$", "i"),
		block = new RegExp("^block$", "i"),
		discard = new RegExp("^discard$", "i"),
		hand = new RegExp("^hand$|^hands$", "i");
		//= new RegExp("", "i"),

	//window.console.log(card);
	//window.console.log(cardEffects);

	for (var i = 0; i < cardEffects.length; i++){
		window.console.log(card + ' -> ' + cardEffects[i]);
		var effect = cardEffects[i].split(' ');

		if (effect[0] && effect[0].match(endTurn)) { // End turn
			window.console.log("End turn");
			player.player_state.cards_to_play = 0;
			player.player_state.pieces_to_play = 0;
		} else if (effect[0] && effect[0].match(deal)) { // Dealing damage
			if (effect[1] && effect[1].match(one)){ // Damage one
				if (effect[4] && effect[4].match(targetSelf)){
					window.console.log("Target self");
					player.player_state.damagingS = 1;
				} else if (effect[4] && effect[4].match(targetEnemy)){
					window.console.log("Target enemy");
					player.player_state.damagingE = 1;
				} else {
					player.player_state.damagingA = 1;
				}
			} else if (effect[1] && effect[1].match(every)) { // Damage all
				window.console.log("Damaging all!");
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
					window.console.log("Target self");
					player.player_state.damagingS = effect[1];
				} else if (effect[4] && effect[4].match(targetEnemy)){
					window.console.log("Target enemy");
					player.player_state.damagingE = effect[1];
				} else {
					player.player_state.damagingA = effect[1];
				}
			}
		} else if (effect[0] && effect[0].match(destroy)) { // Destroying piece or shield
			if (effect[2] && effect[2].match(shield)){ //if shield
				if (effect[1] && effect[1].match(one)){
					window.console.log("deshield 1");
					player.player_state.deshielding = 1;
				} else if (effect[1] && effect[1].match(every)) { // Deshield all
					window.console.log("Unshielding all!");
					for (var k = 0; k < 4; k++) {
						for (var l = 0; l < 4; l++) {
							this.board.board_state.shields[k][l] = 0;
						}
					}
				} else { //else deshield many
					window.console.log("deshield lots");
					deshielding = effect[1];
				}
			} else { //
				if (effect[1] && effect[1].match(one)){
					if (effect[4] && effect[4].match(targetSelf)) {
						window.console.log("Target self");
						player.player_state.destroyingS = 1;
					}  else if (effect[4] && effect[4].match(targetEnemy)){
						window.console.log("Target enemy");
						player.player_state.destroyingE = 1;
					} else {
						window.console.log("Destroying one piece");
						player.player_state.destroyingA = 1;
					}
				} else if (effect[1] && effect[1].match(every)) { // Destroy all
					window.console.log('Destroy all pieces');
					for (var k = 0; k < 4; k++){ 
						for (var l = 0; l < 4; l++){
							this.board.board_state.results[k][l] = 0;
							this.board.board_state.shields[k][l] = 0;
						}
					}
				} else { //else many
					if (effect[4] && effect[4].match(targetSelf)) {
						window.console.log("Target self");
						player.player_state.destroyingS = effect[1];
					} else if (effect[4] && effect[4].match(targetEnemy)){
						window.console.log("Target enemy");
						player.player_state.destroyingE = effect[1];
					} else {
						player.player_state.destroyingA = effect[1];
					}
				}
			}
		} else if (effect[0] && effect[0].match(draw)){ // Drawing cards
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				window.console.log("Draw card");
				if (player.deck.length > 0 && player.hand.length < maxHandSize) {
					player.hand.push(player.deck[0]);
					player.deck.splice(0, 1);
				} else {
					window.console.log("Hand full - " + player.deck.length + ", " + player.hand.length);
				}
			} else { //else many
				window.console.log("Draw card");
				for (var i = 0; i < effect[1]; i++) {
					if (player.deck.length > 0 && player.hand.length < maxHandSize) {
						player.hand.push(player.deck[0]);
						player.deck.splice(0, 1);
					} else {
						window.console.log("Hand full - " + player.deck.length + ", " + player.hand.length);
					}
				}
			}
		} else if (effect[0] && effect[0].match(freeze)){ // Freeze
			window.console.log(effect[1]);
			window.console.log(effect[1].match(one));

			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				window.console.log("Doing a single frost... spoopy!");
				player.player_state.freezing = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				window.console.log("Freezing all!");
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
				window.console.log("Thawing a square");
				player.player_state.thawing = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				window.console.log("Thawing all squares");
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.frost[i][j] >= 1) {
							this.board.board_state.frost[i][j] = 0;
						}
					}
				}
			} else { //else many
				window.console.log("Thawing some squares");
				player.player_state.thawing = effect[1];
			}
		} else if (effect[0] && effect[0].match(block)){ // Block/Rock
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				window.console.log("Doing a single block");
				player.player_state.blocking = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				window.console.log("Blocking all!");
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
				window.console.log("Doing a shield");
				player.player_state.shielding = 1;
			} else if (effect[1] && effect[1].match(every)){ // Resolves 'all'
				window.console.log("Shielding all!");
				for (var i = 0; i < 4; i++) {
					for (var j = 0; j < 4; j++) {
						if (this.board.board_state.shields[i][j] === 0) {
							this.board.board_state.shields[i][j] = 1;
						}
					}
				}
			} else { //else many
				window.console.log("Shielding many!");
				player.player_state.shielding = effect[1];
			}
		} else if (effect[0] && effect[0].match(discard)){ //Discarding
			window.console.log("Discarding");
			if (effect[1] && effect[1].match(one)){ // Resolves 'a'
				player.player_state.discarding = 1;
			} else if (effect[1] && effect[1].match(every)) {
				window.console.log("Discarding all");
				player.hand = [];
			} else {
				player.player_state.discarding = effect[1]; // Discarding some
			}
		} else if (effect[0] && effect[0].match(targetSelf)){ //You / your
			if (effect[1] && effect[1].match(targetEnemy)){ // Your enemy
				if (effect[2] && effect[2].match(draw)){ // Your enemy draws
					window.console.log("Your enemy draws cards")
					var playerEnemy = 1; 
					if (effect[1] && effect[1].match(one)){ // Resolves 'a'
						window.console.log("Enemy draws 1");
						if (player.deck.length > 0 && player.hand.length < maxHandSize) {
							player.hand.push(player.deck[0]);
							player.deck.splice(0, 1);
						} else {
							window.console.log("Hand full - " + player.deck.length + ", " + player.hand.length);
						}
					} else {
						window.console.log("Enemy draws many");
						for (var i = 0; i < effect[1]; i++) {
							if (player.deck.length > 0 && player.hand.length < maxHandSize) {
								player.hand.push(player.deck[0]);
								player.deck.splice(0, 1);
							} else {
								window.console.log("Hand full - " + player.deck.length + ", " + player.hand.length);
							}
						}
					}
				}
			}
		} else if (effect[0] && effect[0].match(conditionIf)){ // ????
			window.console.log("Doing an if");
			if (effect[1] && effect[1].match(targetSelf)){ // Resolves 'a'
				if (effect[3] && effect[3].match(conditionLeast)) {
					if (effect[3] && effect[3].match(piece)) {
						
					} else if (effect[3] && effect[3].match(shield)) {
					
					}
				}
			}
		} else {
			//do nothing
		} 
	}

}
