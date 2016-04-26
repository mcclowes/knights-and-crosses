// Seek server
var address 	= 'http://localhost',
	gameport 	= '3013';

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    	address = add;
    })
} catch(err) {

}

//for (var i = 0; i < 10; i++) {
	var clientio  = require('socket.io-client');
	var client    = clientio.connect(address + ':' + gameport);

	var	game_core		= require('./game.core.ai.js');
	// Make AI game
	var game = {};
	//game = new game_core();
	game = new game_core(10, 10, 1.5, 1.5, 1.3, 2, 4);
	
	if (game.mmr === undefined) {
		game.mmr = 0;
	} else {
		game.mmr++;
		console.log(game.mrr);
	}

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