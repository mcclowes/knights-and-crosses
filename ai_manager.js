// Seek server
var address 	= 'http://localhost',
	gameport 	= '3013';

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    	address = add;
    })
} catch(err) {

}

//for (var i = 0; i < 2; i++) {
	var clientio  = require('socket.io-client');
	var client    = clientio.connect(address + ':' + gameport);

	var	game_core		= require('./game.core.ai.js');
	// Make AI game
	var game = {};
	//game = new game_core();
	game = new game_core(1, 1, 1.5, 1.5, 1.3, 0.2, 0.4);
	game.socket = client;
	game.socket.on('connect', function(){
		game.players.self.state = 'connecting';
	}.bind(game));

	game.socket.on('disconnect', game.client_ondisconnect.bind(game)); 					// Disconnected - e.g. network, server failed, etc.
	game.socket.on('onserverupdate', game.client_onserverupdate_recieved.bind(game)); 	// Tick of the server simulation - main update
	game.socket.on('onconnected', game.client_onconnected.bind(game)); 					// Connect to server - show state, store id
	game.socket.on('error', game.client_ondisconnect.bind(game)); 						// Error -> not connected for now
	game.socket.on('message', game.client_onnetmessage.bind(game)); 					// Parse message from server, send to handlers
	game.update( new Date().getTime() );
//}

/*
	// AI Manager
	//Initialise 100 AI instances with randomised game state variables 
	while (AI improvement improves from each round) {
		for (each AI) { 
			for (n times) {
				//Matchmake via the Elo Rating System, n times per AI instance 
				//Play game, using algorithm 2
				//Rank each AI using the Elo Rating System
			}
		}
		//Eliminate the lowest 25 instances
		//Create 25 new AI from the remaining AI, via genetic crossover method
	}
	return gathered data*/