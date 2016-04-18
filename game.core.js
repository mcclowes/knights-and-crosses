//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server

/*  ----------------------------- Key variables  -----------------------------   */

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
var maxHandSize = 10,
	canvasWidth = 720,
	canvasHeight = 480;


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
function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}
 
var create_card_array = function(data) {
	cards = []
	for (var i = 0; i < data.length; i++) {
		cards.push(create_card(data[i]));
	}
	return cards;
}

var create_card = function(data) {
	card = new game_card(data.cardName);
	return card;
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

	/*this.laststate = {
		tu 	: 0,
		bo 	: 0,
		hp  : 0,
		hh  : 0,
		hd  : 0,
		cp  : 0,
		ch  : 0,
		cd  : 0,
		his : 0,
		cis : 0,
		t   : 0
	};*/

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

	//The speed at which the clients move.
	this.playerspeed = 120;

	//Set up some physics integration values
	this._pdt = 0.0001;                 //The physics update delta time
	this._pdte = new Date().getTime();  //The physics update last delta time
	//A local timer for precision on server and client
	this.local_time = 0.016;            //The local timer
	this._dt = new Date().getTime();    //The local timer delta
	this._dte = new Date().getTime();   //The local timer last frame time

	//Start a fast paced timer for measuring time easier
	this.create_timer();

	//Client specific initialisation
	if(!this.server) {
		//Create a keyboard handler
		this.keyboard = new THREEx.KeyboardState();
		//Create the default configuration settings
		this.client_create_configuration();
		//A list of recent server updates we interpolate across this is the buffer that is the driving factor for our networking
		this.server_updates = [];
		//Connect to the socket.io server!
		this.client_connect_to_server();
		//We start pinging the server to determine latency
		this.client_create_ping_timer();

		//Set their colors from the storage or locally
		this.color = localStorage.getItem('color') || '#cc8822' ;
		localStorage.setItem('color', this.color);
		this.players.self.color = this.color;

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
if( 'undefined' != typeof global ) {
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
	this.x = 0;
	this.y = 0;
	this.w = 400;
	this.h = 400;

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
	game.ctx.fillRect(0, 0, 400, 400);
	game.ctx.drawImage(this.boardImage,0,0,400,400);

	//Assign images
	this.p1PieceImage = new Image();
	this.p1PieceImage.src = "img/piece_p1.png";
	this.p2PieceImage = new Image();
	this.p2PieceImage.src = "img/piece_p2.png";
	this.frostImage = new Image();
	this.frostImage.src = "img/frost2.png";
	this.blockedImage = new Image();
	this.blockedImage.src = "img/rock3.png";
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
					game.ctx.drawImage(this.shieldImage, i*100, j*100, 100, 100);
				} else {
					game.ctx.drawImage(this.p1PieceImage, i*100, j*100, 100, 100);
				}
			} else if (this.board_state.results[i][j] == -1) {
				//needs to check for player
				if (this.board_state.shields[i][j] == 1) {
					game.ctx.drawImage(this.p2ShieldImage, i*100, j*100, 100, 100);
				} else {
					game.ctx.drawImage(this.p2PieceImage, i*100, j*100, 100, 100);
				}
			} else if (this.board_state.frost[i][j] == 2) {
				game.ctx.drawImage(this.frostImage, i*100, j*100, 100, 100);
			} else if (this.board_state.rock[i][j] == 3) {
				game.ctx.drawImage(this.blockedImage, i*100, j*100, 100, 100);
			} 
		}
	}
};

game_board.prototype.contains = function(mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between the shape's X and (X + Width) and its Y and (Y + Height)
	return (this.x <= mx) && (this.x + this.w >= mx) && (this.y <= my) && (this.y + this.h >= my);
};


/*  -----------------------------  The board classs  -----------------------------  */

var end_turn_button = function() {
	this.w = 100;
	this.h = 50;
	this.text = "End Turn";
};

end_turn_button.prototype.draw = function(){
	if (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1){ // players turn
		game.ctx.shadowBlur = 20;
		game.ctx.shadowColor="green";
	}		

	game.ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
	game.ctx.fillRect(450, canvasHeight/2, this.w, this.h);
	game.ctx.shadowBlur=0;

	game.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
	game.ctx.fillText(this.text, 460, canvasHeight/2 + 30);
};

end_turn_button.prototype.contains = function(mx, my) {
	// All we have to do is make sure the Mouse X,Y fall in the area between the shape's X and (X + Width) and its Y and (Y + Height)
	return  (450 <= mx) && (450 + this.w >= mx) && (canvasHeight/2 <= my) && (canvasHeight/2 + this.h >= my);
};


/*  -----------------------------  Card class  -----------------------------  */

var game_card = function( card_name ) {
	this.cardName = card_name;
	this.cardEffects = [];
	this.cardImage = '';
	//this.owner = player.play;

	this.pos = { x:0, y:0 };
	this.size = { x:80, y:120, hx:40, hy:60 };
	this.color = 'rgba(255,255,255,0.7)';
	this.info_color = 'rgba(255,255,255,0.7)';
};

game_card.prototype.draw = function(self){ //draw card
	this.cardBody = new Image();
	//this.cardBody.src = "img/card_barrage.png";
	this.cardBody.src = "img/card_" + this.cardName.toLowerCase().split(" ").join("_") + ".png"; //hmmm

	this.cardBack = new Image();
	if (game.players.self.host === true) { // Based on host
		this.cardBack.src = "img/card_back1.png";
	} else {
		this.cardBack.src = "img/card_back2.png";
	}

	if ((self === true) && (game.players.self.player_state.cards_to_play > 0) && (game.players.self.host === true && game.turn === 1 || game.players.self.host === false && game.turn === -1)) { // players turn
		game.ctx.shadowBlur = 20;
		game.ctx.shadowColor="green";
	}	

	game.ctx.fillStyle = 'rgba(140,120,100,0.7)';;
	game.ctx.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.x);
	/*if (game.players.self = this.owner) {
		game.ctx.drawImage(this.cardBody, this.pos.x,this.pos.y, 60, 120);
	} else {
		game.ctx.drawImage(this.cardBack, this.pos.x,this.pos.y, 60, 120);
	}*/
	game.ctx.drawImage(this.cardBody, this.pos.x, this.pos.y, this.size.x, this.size.y);
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
	this.color = 'rgba(255,255,255,0.1)';
	this.info_color = 'rgba(255,255,255,0.1)';
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

	for (var i = 0; i < deck_temp.length; i++) {
		this.deck.push(new game_card(deck_temp[i]));
	}
	//window.console.log(this.deck)
	//this.deck = JSON.parse('json/deck_p1.json'); //asign deck //var tempDeck = JSON.parse(eval("deck_p" + this.playerNo));

	//Our local history of inputs
	this.inputs = [];
}; //game_player.constructor

game_player.prototype.draw = function(){
	//Set the color for this player
	game.ctx.fillStyle = this.color; //remove
	game.ctx.fillStyle = this.info_color;
	game.ctx.fillText(this.state, 10, 450);
	//draw drawn cards
	for (var i = 0; i < this.hand.length; i++) {
		this.hand[i].pos.x = canvasWidth/2 - (this.hand[i].size.x * this.hand.length / 2) + i * 30
		if (game.players.self === this){
			this.hand[i].pos.y = 400;
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
		this.client_update();
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
	if (this.turn === 1) {
		this.turn = -1;
	} else {
		this.turn = 1;
	}
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

	this.laststate = {
		//turn?
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

	//window.console.log(this.laststate);

	if (this.players.self.instance) { //Send the snapshot to the 'host' player
		this.players.self.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
	}
	if (this.players.other.instance) { //Send the snapshot to the 'client' player
		this.players.other.instance.emit( 'onserverupdate', JSON.stringify(this.laststate) );
	}

}; //game_core.server_update

//Handle server input (input into the server, from a client)
game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {
	window.console.log(input);
	//Fetch which client this refers to out of the two
	var player_client = (client.userid == this.players.self.instance.userid) ? this.players.self : this.players.other;

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
		} else if (input_parts[0] == 'ca') { // card
			target = input_parts[1];
			for (var i = player_client.hand.length - 1; i >= 0; i--) {
				window.console.log('Hmmmm ' + target + ' vs. ' + player_client.hand[i].cardName);
			    if (player_client.hand[i].cardName === target) {
			    	window.console.log('FOund the card ' + target);
					player_client.hand.splice(i, 1);
					player_client.player_state.cards_to_play = player_client.player_state.cards_to_play - 1; 
					break;
			    }
			}
		} else if (input_parts[0] == 'sq') { // square
			target = input_parts[1];
			player_client.player_state.pieces_to_play = player_client.player_state.pieces_to_play - 1;
			this.board.board_state.results[target[0] - 1][target[1] - 1] = this.turn;
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

	if( this.keyboard.pressed('esc') || this.keyboard.pressed('Q')) {
		input.push('q');
	} //left

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
	this.players.self.player_state = data.hp;
	this.players.self.hand = create_card_array(data.hh);
	this.players.self.deck = create_card_array(data.hd);            
	this.players.other.player_state = data.cp;
	this.players.other.hand = create_card_array(data.ch);
	this.players.other.deck = create_card_array(data.cd);         
	this.players.self.last_input_seq = data.his;    //'host input sequence', the last input we processed for the host
	this.players.other.last_input_seq = data.cis;   //'client input sequence', the last input we processed for the client
	this.server_time = data.t;   // our current local time on the server
}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update = function() {
	// Only do if something has changed?
	this.ctx.clearRect(0,0,canvasWidth,canvasHeight); //Clear the screen area
	this.client_draw_info(); //draw help/information if required
	this.client_handle_input(); //Capture inputs from the player

	this.end_turn_button.draw();
	this.board.draw(); // Draw board
	this.players.other.draw(); // draw other player (post server update)
	this.players.self.draw(); //Draw self

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

		this.colorcontrol = _playersettings.addColor(this, 'color');

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

	//Store their info colors for clarity. server is always blue
	player_host.info_color = '#2288cc';
	player_client.info_color = '#cc8822';
		
	//Update their information
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';

	this.players.self.state = 'YOU ' + this.players.self.state;

	//Make sure colors are synced up
	this.socket.send('c.' + this.players.self.color);
}; //client_onreadygame

game_core.prototype.client_onjoingame = function(data) {
	//We are not the host
	this.players.self.host = false;
	//Update the local state
	this.players.self.state = 'connected.joined.waiting';
	this.players.self.info_color = '#00bb00';

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
	this.players.self.info_color = '#cc0000';

	//Make sure we start in the correct place as the host.
	this.client_reset_positions();

}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {
	//The server responded that we are now in a game, this lets us store the information about ourselves and set the colors
	//to show we are now ready to be playing.
	this.players.self.id = data.id;
	this.players.self.info_color = '#cc0000';
	this.players.self.state = 'connected';
	this.players.self.online = true;
}; //client_onconnected

game_core.prototype.client_on_otherclientcolorchange = function(data) {
	this.players.other.color = data;

}; //game_core.client_on_otherclientcolorchange

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
				case 'c' : //other player changed colors
					this.client_on_otherclientcolorchange(commanddata); break;
			} //subcommand
		break; //'s'
	} //command
				
}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function(data) {
	//When we disconnect, we don't know if the other player is connected or not, and since we aren't, everything goes to offline
	this.players.self.info_color = 'rgba(255,255,255,0.1)';
	this.players.self.state = 'not-connected';
	this.players.self.online = false;

	this.players.other.info_color = 'rgba(255,255,255,0.1)';
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
	//We don't want this to be too distracting
	this.ctx.fillStyle = 'rgba(255,255,255,0.3)';

	//They can hide the help with the debug GUI
	if(this.show_help) {

		this.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
		this.ctx.fillText('server_time : last known game time on server', 10 , 70);
		this.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
		this.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
		this.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
		this.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
		this.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
		this.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);

	} //if this.show_help

	//Draw some information for the host
	if(this.players.self.host) {
		this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
		this.ctx.fillText('You are the host', 10 , 465);

	} //if we are the host

	//Reset the style back to full white.
	this.ctx.fillStyle = 'rgba(255,255,255,1)';

}; //game_core.client_draw_help
