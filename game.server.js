var game_server = module.exports = { games : {}, game_count:0 },
	UUID        = require('node-uuid'),
	verbose     = true;

/*  ----------------------------- Server Functions  -----------------------------   */

//Since we are sharing code with the browser, we are going to include some values to handle that.
global.window = global.document = global;

//Import shared game library code.
require('./game.core.server.js');

//A simple wrapper for logging so we can toggle it, and augment it for clarity.
game_server.log = function() {
	if(verbose) console.log.apply(this,arguments);
};

game_server.fake_latency = 0;
game_server.local_time = 0;
game_server._dt = new Date().getTime();
game_server._dte = new Date().getTime();

//a local queue of messages we delay if faking latency
game_server.messages = [];

setInterval(function(){
	game_server._dt = new Date().getTime() - game_server._dte;
	game_server._dte = new Date().getTime();
	game_server.local_time += game_server._dt/1000.0;
}, 4);

/*  ----------------------------- Message Handling  -----------------------------   */

game_server.onMessage = function(client,message) {
	game_server._onMessage(client, message);
};

game_server._onMessage = function(client, message) {
	var message_parts = message.split('.'); //Cut the message up into sub components
	var message_type = message_parts[0]; //The first is always the type of message
	var other_client = (client.game.player_host.userid == client.userid) ? client.game.player_client : client.game.player_host;

	if (message_type == 'i') { //Input handler will forward this
		this.onInput(client, message_parts);
	} else if (message_type == 'p') {
		client.send('s.p.' + message_parts[1]);
	} else if (message_type == 'r') {    //A client is asking for lag simulation
		this.fake_latency = parseFloat(message_parts[1]);
	} else if (message_type == 'm') {    //A client is asking for lag simulation
		if (client.game.player_host.userid == client.userid) {
			client.game.player_client.mmr = message_parts[1];
		} else {
			client.game.player_host.mmr = message_parts[1];
		}
	}
}; //game_server.onMessage

game_server.onInput = function(client, parts) {
	//The input commands come in like u-l, so we split them up into separate commands, and then update the players
	var input_commands = parts[1].split('-');
	var input_time = parts[2].replace('-','.');
	var input_seq = parts[3];

	//the client should be in a game, so we can tell that game to handle the input
	if(client && client.game && client.game.gamecore) {
		client.game.gamecore.handle_server_input(client, input_commands, input_time, input_seq);
	}

}; //game_server.onInput

/*  ----------------------------- Managing games  -----------------------------   */

//Define some required functions
game_server.createGame = function(player) {
	//Create a new game instance
	var thegame = {
		id: UUID(),                  //generate a new id for the game
		player_host: player,         //so we know who initiated the game
		player_client: null,         //nobody else joined yet, since its new
		player_count: 1              //for simple checking of state
	};
		
	this.games[ thegame.id ] = thegame; //Store it in the list of game
	this.game_count++; //Keep track

	//Create a new game core instance, this actually runs the
	//game code like collisions and such.
	thegame.gamecore = new game_core( thegame );
	thegame.gamecore.update( new Date().getTime() ); //Start updating the game loop on the server

	//tell the player that they are now the host
	//s=server message, h=you are hosting
	player.send('s.h.'+ String(thegame.gamecore.local_time).replace('.','-'));
	console.log('server host at  ' + thegame.gamecore.local_time);
	player.game = thegame;
	player.hosting = true;
	
	this.log('player ' + player.userid + ' created a game with id ' + player.game.id);
		
	return thegame; //return the game
}; //game_server.createGame

// End game in progress
game_server.endGame = function(gameid, userid) { //userid is leaving
	var thegame = this.games[gameid];

	if (thegame) {
		thegame.gamecore.stop_update(); //stop game updates (otherwise sockets crash)

		if (thegame.player_count > 1) { //if the game has two players, one is leaving
			thegame.player_client.send('s.e'); //tell them the game is over
			thegame.player_host.send('s.e'); //tell the client the game is ended
			thegame.player_host.hosting = false; //I am no longer hosting, this game is going down
		}

		delete this.games[gameid];
		this.game_count--;
		this.log('Game removed. There are ' + this.game_count + ' games' );
	} else {
		this.log('Game not found.');
	}
}; //game_server.endGame

game_server.startGame = function(game) {
	console.log('Starting game');
	//so a game has 2 players and wants to begin the host already knows they are hosting, tell the other client they are joining a game s=server message, j=you are joining, send them the host id
	game.player_client.send('s.j.' + game.player_host.userid);
	game.player_client.game = game;

	//now we tell both that the game is ready to start clients will reset their positions in this case.
	game.player_client.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));
	game.player_host.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));
	game.gamecore.players.self.player_state.cards_to_play = 1;
	game.gamecore.players.self.player_state.pieces_to_play = 1;

	//make players draw cards
	for (var i = 0; i < 3; i++) {
		var server_packet = 'i.dr.' + this.local_time.toFixed(3).replace('.','-') + '.' + game.input_seq;
		game_server._onMessage(game.player_client, server_packet);
		game_server._onMessage(game.player_host, server_packet);
	}

	game.active = true; // Flag for update loop
}; //game_server.startGame

game_server.findGame = function(player) {
	this.log('looking for a game. We have : ' + this.game_count);
	if (this.game_count) { //so there are games active, lets see if one needs another player
		var joined_a_game = false;
		//Check the list of games for an open game
		for (var gameid in this.games) {
			//only care about our own properties.
			if(!this.games.hasOwnProperty(gameid)) continue;
			//get the game we are checking against
			var game_instance = this.games[gameid];

			//If the game is a player short
			if (game_instance.player_count < 2) {
				//someone wants us to join!
				joined_a_game = true;
				//increase the player count and store the player as the client of this game
				game_instance.player_client = player;
				game_instance.gamecore.players.other.instance = player;
				game_instance.player_count++;

				//start running the game on the server, //which will tell them to respawn/start
				this.startGame(game_instance);
			} //if less than 2 players
		} //for all games

		//now if we didn't join a game, we must create one
		if(!joined_a_game) {
			this.createGame(player);
		} //if no join already

	} else { //if there are any games at all
		//no games? create one!
		this.createGame(player);
	}
}; //game_server.findGame
