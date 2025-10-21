/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60/1000,
	maxHandSize = 10,
	canvasWidth = 720,
	canvasHeight = 800;

// Initialize audio
var clickSound = new Audio('src/assets/sound/class_tab_click.ogg');
var endTurnSound = new Audio('src/assets/sound/bar_button_A_press.ogg');

var cards = []; // Load cards (with jQuery)
$.ajax({
    url: "src/json/cards.json",
    async: false,
    dataType: 'json',
    success: function(json) {
        cards = json;
    }
});

/*  -----------------------------  Frame/Update Handling  -----------------------------   */

/***************************************************************************************
*    Title: requestAnimationFrame for Smart Animating
*    Author: Paul irish
*    Date: 22/02/2011
*    Availability: http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
***************************************************************************************/

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
// Array shuffle function
var shuffle = function(o){ for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o; }
 
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

// Fit text in box
var layout_text = function(canvas, x, y, w, h, text, font_size, spl) {
	var loutout_lines = function(ctx, mw, text) {
		// Pad text
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
		var both = lines.length * (font_size + spl);// Block of text height
		if (both >= h) {
			console.log('Too much text!');
		} else {
			var ly = (h - both)/2 + y + spl * lines.length;
			var lx = 0;
			for (var j = 0, ly; j < lines.length; ++j, ly+=font_size+spl) {
				lx = x + w / 2 - canvas.measureText(lines[j]).width / 2;
				game.ctx.fillStyle = 'rgba(0,0,0,1)';
				canvas.fillText(lines[j], lx, ly);
			}
		}
	}
}


/* --------------------- Handle Load and touch ----------------------- */

window.onload = function(){
	game = new game_core(); // Create game
	game.viewport = document.getElementById('viewport');
	game.viewport.width = game.world.width; //Adjust canvas size
	game.viewport.height = game.world.height;
	game.ctx = game.viewport.getContext('2d');//Fetch canvas

	// Handle mouse events
	game.ctx.canvas.addEventListener('selectstart', function(e) { e.preventDefault(); return false; }, false); // Prevent highlighting text
	// Handle mouse hovering/moving
	game.ctx.canvas.addEventListener('mousemove', onMouseUpdate, false);
	game.ctx.canvas.addEventListener('mouseenter', onMouseUpdate, false);

	function onMouseUpdate(e) {
	    game.players.self.mouseX = e.pageX;
	    game.players.self.mouseY = e.pageY;
	}

	game.ctx.canvas.addEventListener('click', function(e) { 
		if (game.players.self.host === true && game.turn === -1) { // not players turn
			return;
		} else if (game.players.self.host === false && game.turn === 1) { // not players turn (can condense)
			return;
		}

		var mx = event.clientX,
			my = event.clientY,
			shapes = [game.board];
			shapes = shapes.concat(game.end_turn_button, game.players.self.hand);

		for (var i = shapes.length - 1; i >= 0; i--) { // Check all clickable objects
		  	if (shapes[i].contains(mx, my)) {
		  		var input = '';

		  		if (shapes[i] === game.board) {
		  			if (game.players.self.state.pieces_to_play > 0 || game.players.self.state.destroyingA > 0 || game.players.self.state.destroyingE > 0 || game.players.self.state.destroyingS > 0 || game.players.self.state.damagingA > 0 || game.players.self.state.damagingE > 0 || game.players.self.state.damagingS > 0 || game.players.self.state.thawing > 0 || game.players.self.state.blocking > 0 || game.players.self.state.shielding > 0 || game.players.self.state.deshielding > 0) {
		  				input = 'sq-' + (100 + mx - game.board.x).toString()[0] + (100 + my - game.board.y).toString()[0];
		  				// Play click sound for board clicks
		  				clickSound.currentTime = 0;
		  				clickSound.play();
		  			}
		  		} else if (shapes[i] === game.end_turn_button) {
		  			input = 'en';
		  			// Play end turn sound
		  			endTurnSound.currentTime = 0;
		  			endTurnSound.play();
		  		} else {
		  			if (game.players.self.state.cards_to_play > 0 || game.players.self.state.discarding > 0) {
		  				input = 'ca-' + shapes[i].cardName;
		  				// Play click sound for card clicks
		  				clickSound.currentTime = 0;
		  				clickSound.play();
		  			}
		  		}
				// Process input
				game.input_seq += 1;
				//Send inputs
				var server_packet = 'i.' + input + '.' + game.local_time.toFixed(3).replace('.','-') + '.' + game.input_seq;
				game.socket.send( server_packet );

				return;
			}
		}
	}, true);

	game.update( new Date().getTime() ); //Start game update loop
}; //window.onload


/* ----------------------------- Game Core -----------------------------  */

var game_core = function(game_instance){
	this.instance = game_instance; //Store the instance, if any
	this.server = false; //Store a flag for not server
	this.world = { //Used in collision etc.
		width : canvasWidth,
		height : canvasHeight
	};

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
	this.client_create_configuration(); //Create the default configuration settings
	this.client_connect_to_server(); //Connect to the socket.io server!
	this.client_create_ping_timer(); //Ping the server to determine latency

	this.cardBack = new Image();
}; //game_core.constructor


/*  -----------------------------  The board classs  -----------------------------  */

var game_board = function() {
	this.w = 400;
	this.h = 400;
	this.x = canvasWidth / 2 - this.w / 2;
	this.y = canvasWidth / 2 - this.h / 2;

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

	//Assign images
	this.boardImage = new Image();
	this.boardImage.src = "src/assets/img/board.png";
	this.p1PieceImage = new Image();
	this.p1PieceImage.src = "src/assets/img/piece_p1.png";
	this.p2PieceImage = new Image();
	this.p2PieceImage.src = "src/assets/img/piece_p2.png";
	this.frostImage1 = new Image();
	this.frostImage1.src = "src/assets/img/frost1.png";
	this.frostImage2 = new Image();
	this.frostImage2.src = "src/assets/img/frost2.png";
	this.blockedImage1 = new Image();
	this.blockedImage1.src = "src/assets/img/rock1.png";
	this.blockedImage2 = new Image();
	this.blockedImage2.src = "src/assets/img/rock2.png";
	this.blockedImage3 = new Image();
	this.blockedImage3.src = "src/assets/img/rock3.png";
	this.p1ShieldImage = new Image();
	this.p1ShieldImage.src = "src/assets/img/piece_p1_shielded.png";
	this.p2ShieldImage = new Image();
	this.p2ShieldImage.src = "src/assets/img/piece_p2_shielded.png";
};

game_board.prototype.draw = function(){
	game.ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
	game.ctx.fillRect(this.x, this.y, 400, 400);
	game.ctx.drawImage(this.boardImage, this.x, this.y, 400, 400);

	//for each square, draw the relevant piece
	game.ctx.shadowBlur = 20;
	for (var i = 0; i < 4; i++){
		for (var j = 0; j < 4; j++){
			// Set 
			if (this.state.results[i][j] == 1) {
				//needs to check for player
				if (this.state.shields[i][j] == 1) {
					if ((game.players.self.state.deshielding > 0 || game.players.self.state.damagingA > 0 || game.players.self.state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p1ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					if ((game.players.self.state.shielding > 0 ) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) {
						game.ctx.shadowColor = "green";
					} else if (( game.players.self.state.damagingA > 0 || game.players.self.state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p1PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.state.results[i][j] == -1) {
				if (this.state.shields[i][j] == 1) {
					if ((game.players.self.state.deshielding > 0 || game.players.self.state.damagingA > 0 || game.players.self.state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p2ShieldImage, i*100 + this.x, j*100 + this.y, 100, 100);
				} else {
					if ((game.players.self.state.shielding > 0 ) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) {
						game.ctx.shadowColor = "green";
					} else if (( game.players.self.state.damagingA > 0 || game.players.self.state.destroyingA > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
						game.ctx.shadowColor = "red";
					} else {
						game.ctx.shadowColor = "black";
					}
					game.ctx.drawImage(this.p2PieceImage, i*100 + this.x, j*100 + this.y, 100, 100);
				}
			} else if (this.state.frost[i][j] == 4 || this.state.frost[i][j] == 3) {
				if ((game.players.self.state.thawing > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.frostImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.state.frost[i][j] == 2 || this.state.frost[i][j] == 1) {
				if ((game.players.self.state.thawing > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.frostImage1, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.state.rock[i][j] == 6 || this.state.rock[i][j] == 5) {
				if ((game.players.self.state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.blockedImage3, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.state.rock[i][j] == 4 || this.state.rock[i][j] == 3) {
				if ((game.players.self.state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
					game.ctx.shadowColor = "red";
				} else {
					game.ctx.shadowColor = "black";
				}
				game.ctx.drawImage(this.blockedImage2, i*100 + this.x, j*100 + this.y, 100, 100);
			} else if (this.state.rock[i][j] == 2 || this.state.rock[i][j] == 1) {
				if ((game.players.self.state.deblocking > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
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
	return (this.x <= mx) && (this.x + this.w >= mx) && (this.y <= my) && (this.y + this.h >= my);
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

	game.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
	game.ctx.textAlign="center"; 
	game.ctx.fillText(this.text, 20 + this.w / 2, canvasHeight / 2 + 30);
	//game.ctx.textAlign="start"; 
};

end_turn_button.prototype.contains = function(mx, my) {
	return  (this.x <= mx) && (this.x + this.w >= mx) && (canvasHeight/2 <= my) && (canvasHeight/2 + this.h >= my);
};


/*  -----------------------------  Card class  -----------------------------  */

var game_card = function( card_name ) {
	this.cardName = card_name;
	//this.cardImage = '';
	this.cardImage = new Image();
	this.cardImage.src = "src/assets/img/card_" + this.cardName.toLowerCase().split(" ").join("_") + ".png"; //hmmm

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

	game.ctx.shadowBlur = 20;
	if ((self === true) && (game.players.self.state.discarding > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
		game.ctx.shadowColor = "red";
	} else if ((self === true) && (game.players.self.state.cards_to_play > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
		game.ctx.shadowColor = "green";
	} else {
		game.ctx.shadowColor = "black";
	}

	//Just makes the glow
	game.ctx.fillStyle = 'rgba(140,120,100,1)';
	roundedImage(this.pos.x, this.pos.y, this.size.x, this.size.y, 10);
	game.ctx.fill();

	//Clipping
	game.ctx.save();
	game.ctx.clip();
	
	if (self === true) {
		game.ctx.drawImage(this.cardImage, this.pos.x, this.pos.y, this.size.x, this.size.y);
	} else {
		game.cardBack.src = game.players.self.host === true ? "src/assets/img/card_back2.png" : "src/assets/img/card_back1.png";
		game.ctx.drawImage(game.cardBack, this.pos.x, this.pos.y, this.size.x, this.size.y);
	}

	game.ctx.restore();
	game.ctx.shadowBlur = 0;
	if (self === true) {
		layout_text(game.ctx, this.pos.x + 10, this.pos.y + 10, this.size.x - 20, 40, this.cardName, 14, 2);
		layout_text(game.ctx, this.pos.x + 10, this.pos.y + this.size.y / 2, this.size.x - 20, this.size.y / 2 - 10, cardEffects.join('. ') + '.', 12, 2);
	}
}; 

game_card.prototype.contains = function(mx, my) {
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

var game_player = function( game_instance, player_instance ) {
	this.instance = player_instance;
	this.state = 'not-connected';
	this.id = '';

	this.mmr = 1;
	this.game_count = 0;

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
	this.deck = [];
	this.hand = [];

	// Load deck synchronously
	var deck_temp = [];
	$.ajax({
		url: "src/json/deck_p1.json",
		async: false,
		dataType: 'json',
		success: function(json) {
			deck_temp = json;
		}
	});
	
	deck_temp = shuffle(deck_temp);
	this.deck = create_card_array(deck_temp);

	this.mouseX = null;
	this.mouseY = null;
}; //game_player.constructor

game_player.prototype.draw = function(){
	game.ctx.clearRect(0, 0, 120, 120); //Clear the screen area
	game.ctx.textAlign = "start"; 
	game.ctx.fillStyle = "black";
	game.ctx.fillText(this.state, 10, 10);
	
	// Draw player name
	if (this.name) {
		game.ctx.fillText(this.name, 10, 30);
	}
	
	//Draw state variables
	var key_counter = 0;
	for (var key in this.state) {
		if (this.state[key] > 0) {
			game.ctx.fillText(key + ": " + this.state[key], 10, 40 + 10 * key_counter);
			key_counter++;
		}
	}

	// Draw drawn cards
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
	// Re-draw card if mouse is over
	if (this.mouseX !== undefined && this.mouseY !== undefined){
		for (var i = this.hand.length - 1; i >= 0; i--) { // Check all clickable objects
			if (this.hand[i].contains(this.mouseX, this.mouseY)) {
				this.hand[i].draw(true);
				return;
			}
		}
	}
}; //game_player.draw

/* -----------------------------  Player Client side functions  ----------------------------- */
//Main update loop
game_core.prototype.update = function(t) {
	this.lastframetime = t; //Store the last frame time
	//Update the game specifics
	this.client_update();

	//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update

// Cancel game update loop
game_core.prototype.stop_update = function() { 
	window.cancelAnimationFrame( this.updateid );  
};

// Hand update from server
game_core.prototype.client_onserverupdate_recieved = function(data){
	var player_host = this.players.self.host ?  this.players.self : this.players.other;
	var player_client = this.players.self.host ?  this.players.other : this.players.self;
	var this_player = this.players.self;
	
	this.server_time = data.t;
	this.client_time = this.server_time - (this.net_offset/1000);

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
	this.server_time = data.t;   // time
}; //game_core.client_onserverupdate_recieved

// Update view
game_core.prototype.client_update = function() {
	this.ctx.clearRect(0, 0, canvasWidth, canvasHeight); //Clear canvas

	this.end_turn_button.draw();
	this.board.draw(); // Draw board
	this.players.other.draw(); // draw other player (post server update)
	this.players.self.draw(); //Draw self
};

// Setup a timer
game_core.prototype.create_timer = function(){
	setInterval(function(){
		this._dt = new Date().getTime() - this._dte;
		this._dte = new Date().getTime();
		this.local_time += this._dt/1000.0;
	}.bind(this), 4);
}

// Ping server at interval
game_core.prototype.client_create_ping_timer = function() {
	setInterval(function(){
		this.last_ping_time = new Date().getTime();
		this.socket.send('p.' + (this.last_ping_time) );
	}.bind(this), 1000);
};

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
	if (this.mmr === undefined) {this.mmr = 1;}
	console.log('Connected, with mmr > ' + this.mmr);
	this.socket.send( 'm.' + this.mmr );

	var server_time = parseFloat(data.replace('-','.'));
	var player_host = this.players.self.host ? this.players.self : this.players.other;
	var player_client = this.players.self.host ? this.players.other : this.players.self;

	this.local_time = server_time + this.net_latency;
	console.log('server time is about ' + this.local_time);
		
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';

	this.players.self.state = 'YOU ' + this.players.self.state;
};

// Handle joining a game
game_core.prototype.client_onjoingame = function(data) {
	this.players.self.host = false; //Player not the host
	this.players.self.state = 'connected.joined.waiting'; // Update state
};

// Handle opening a game
game_core.prototype.client_onhostgame = function(data) {
	var server_time = parseFloat(data.replace('-','.')); 
	this.local_time = server_time + this.net_latency; //Estimate of the current time on the server
	this.players.self.host = true; //Flag self as host
	this.players.self.state = 'hosting.waiting for a player'; //Update debugging information to display state
};

// Handle connect to game
game_core.prototype.client_onconnected = function(data) {
	this.players.self.id = data.id;
	this.players.self.state = 'connected';
	this.players.self.online = true;
	
	// Set player name from localStorage or server data
	const savedName = localStorage.getItem('playerName');
	if (savedName) {
		this.players.self.name = savedName;
		this.socket.emit('setname', savedName);
	} else {
		this.players.self.name = data.name;
	}
	
	// Hide name input if it's still visible
	const nameInput = document.getElementById('name-input');
	if (nameInput) {
		nameInput.style.display = 'none';
	}
};

// Handle server ping
game_core.prototype.client_onping = function(data) {
	this.net_ping = new Date().getTime() - parseFloat( data );
	this.net_latency = this.net_ping/2;
};

// Takes message from server and handles
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
					if(commands[3]){commanddata = Number(commanddata + '.' + commands[3]).toFixed(3);}
					this.mmr = Number(this.mmr + Number(55 - this.game_count).toFixed(0) * Number(commanddata).toFixed(0)).toFixed(0);
					this.game_count++;
					if (this.game_count > 30) { this.game_count = 30; }; 
					if (this.players.self.host === true) {
						console.log('W SENT');
						this.socket.send( 'w' );
					}
					break;
				case 'n' : //name update
					if (this.players.self.id === commanddata) {
						this.players.self.name = commanddata;
					} else {
						this.players.other.name = commanddata;
					}
					break;
			}
		break;
	}			
}; //client_onnetmessage

// Handle socket disconnect (non-end game)
game_core.prototype.client_ondisconnect = function(data) {
	this.players.self.state = 'not-connected';
	this.players.self.online = false;
	this.players.other.state = 'not-connected';
}; //client_ondisconnect

// Handle connecting to a server
game_core.prototype.client_connect_to_server = function() {
	this.socket = io.connect(); // Server socket

	this.socket.on('connect', function(){
		this.players.self.state = 'connecting';
	}.bind(this));

	//Bind other socket handlers
	this.socket.on('disconnect', this.client_ondisconnect.bind(this)); 					// Disconnected - e.g. network, server failed, etc.
	this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this)); 	// Tick of the server simulation - main update
	this.socket.on('onconnected', this.client_onconnected.bind(this)); 					// Connect to server - show state, store id
	this.socket.on('error', this.client_ondisconnect.bind(this)); 						// Error -> not connected for now
	this.socket.on('message', this.client_onnetmessage.bind(this)); 					// Parse message from server, send to handlers
}; //game_core.client_connect_to_server

// Draw player status
game_core.prototype.client_draw_info = function() {
	if (this.players.self.host) {  // If host
		this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
		this.ctx.fillText('You are hosting', 10 , 465);
	}
	this.ctx.fillStyle = 'rgba(255,255,255,1)'; //reset
};

// Function to set player name
game_core.prototype.setPlayerName = function(name) {
	this.players.self.name = name;
	localStorage.setItem('playerName', name);
	this.socket.emit('setname', name);
};

// Function to set player name from UI
window.setPlayerName = function() {
	const nameInput = document.getElementById('player-name');
	const name = nameInput.value.trim();
	if (name) {
		if (game && game.socket) {
			game.setPlayerName(name);
			document.getElementById('name-input').style.display = 'none';
		} else {
			// If game isn't initialized yet, store the name and wait for connection
			localStorage.setItem('playerName', name);
			document.getElementById('name-input').style.display = 'none';
		}
	}
};