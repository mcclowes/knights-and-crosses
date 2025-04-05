import { v4 as UUID } from 'uuid';
import './game.core.server.js';

const game_server = { games: {}, game_count: 0 };
const verbose = true;

/*  ----------------------------- Server Functions  -----------------------------   */

global.window = global.document = global;

//Displays logs
game_server.log = function() {
	if(verbose) console.log.apply(this,arguments);
};

game_server.fake_latency = 0;
game_server.local_time = 0;
game_server._dt = new Date().getTime();
game_server._dte = new Date().getTime();

setInterval(function(){
	game_server._dt = new Date().getTime() - game_server._dte;
	game_server._dte = new Date().getTime();
	game_server.local_time += game_server._dt/1000.0;
}, 4);

/*  ----------------------------- Message Handling  -----------------------------   */

// Forward message to message handler
game_server.onMessage = function(client,message) {
	game_server._onMessage(client, message);
};

// Handle message
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
	} else if (message_type == 'm') {    //take update mmr
		if (client.game.player_host.userid == client.userid) {
			client.game.player_client.mmr = message_parts[1];
		} else {
			client.game.player_host.mmr = message_parts[1];
		}
	} else if (message_type == 'w') {
		this.winGame(client.game.id);
	}
}; //game_server.onMessage

// Hande input
game_server.onInput = function(client, parts) {
	var input_commands = parts[1].split('-');
	var input_time = parts[2].replace('-','.');
	var input_seq = parts[3];

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
		
	this.games[ thegame.id ] = thegame; // Add game to game array
	this.game_count++; // Count

	thegame.gamecore = new game_core( thegame );
	thegame.gamecore.update( new Date().getTime() ); // Being server update loop

	// Ping player as host
	player.send('s.h.'+ String(thegame.gamecore.local_time).replace('.','-'));
	console.log('Server host at  ' + thegame.gamecore.local_time);
	player.game = thegame;
	player.hosting = true;
	
	this.log('Player ' + player.userid + ' created a game with id ' + player.game.id);
		
	return thegame; //return the game
}; //game_server.createGame

// End game in progress
game_server.endGame = function(gameid, userid) { //userid is leaving
	var thegame = this.games[gameid];

	if (thegame) {
		thegame.gamecore.stop_update(); //stop game updates (otherwise sockets crash)

		if (thegame.player_count > 1) { 					//if the game has two players, one is leaving
			if(userid == thegame.player_host.userid) { 		//the host left, oh snap. Lets try join another game
	            if(thegame.player_client) {
	                thegame.player_client.send('s.e'); 		//tell them the game is over
	                this.findGame(thegame.player_client); 	//now look for/create a new game.
	            }
	        } else { //the other (non host) player left
	            if(thegame.player_host) {
	                thegame.player_host.send('s.e'); 		//tell the client the game is ended
	                thegame.player_host.hosting = false; 	//i am no longer hosting, this game is going down
	                this.findGame(thegame.player_host);  	//now look for/create a new game.
	            }
	        }
	    }

		delete this.games[gameid];
		this.game_count--;
		this.log('Game removed. There are ' + this.game_count + ' games' );
	} else {
		this.log('Game not found.');
	}
}; //game_server.endGame

// If a player won...
game_server.winGame = function(gameid) { //userid is leaving
	var thegame = this.games[gameid];

	if (thegame) {
		thegame.gamecore.stop_update(); 		//stop game updates (otherwise sockets crash)
        thegame.player_client.send('s.e'); 		//tell them the game is over
        this.findGame(thegame.player_client); 	//now look for/create a new game.
        thegame.player_host.send('s.e'); 		//tell the client the game is ended
        thegame.player_host.hosting = false; 	//i am no longer hosting, this game is going down
        this.findGame(thegame.player_host);  	//now look for/create a new game.

		delete this.games[gameid];
		this.game_count--;
		this.log('Game removed. There are ' + this.game_count + ' games' );
	} else {
		this.log('Game not found.');
	}
};

game_server.startGame = function(game) {
	console.log('Starting game');
	game.player_client.send('s.j.' + game.player_host.userid);
	game.player_client.game = game;

	// Ready game
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
	if (this.game_count) { // Check there exists a game
		var joined_a_game = false;
		
		// Find an empty game
		for (var gameid in this.games) {
			if(!this.games.hasOwnProperty(gameid)) continue;
			var game_instance = this.games[gameid];

			//If the game is a player short
			if (game_instance.player_count < 2) {
				joined_a_game = true;

				//Add player
				game_instance.player_client = player;
				game_instance.gamecore.players.other.instance = player;
				game_instance.player_count++;

				this.startGame(game_instance);
			}
		}

		// No open games
		if(!joined_a_game) {
			this.createGame(player); // Create new
		}

	} else { // No games
		this.createGame(player); // Start first game
	}
}; //game_server.findGame

export default game_server;
