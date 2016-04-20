// Seek server
var clientio  = require('socket.io-client');
var client    = clientio.connect('http://localhost:3013');

//client.emit('my event', 'hi');

var	game_core		= require('./game.core.ai.js');
// Make AI game
var game = {};
game = new game_core();
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
//io = require('socket.io-client')('http://10.245.145.51:4004');