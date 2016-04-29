// Seek server
var address 	= 'http://localhost',
	gameport 	= '3013',
	game_core 	= require('./game.core.ai.js'),
	clientio  	= require('socket.io-client');

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    	address = add;
    })
} catch(err) {
	console.log(err);
}

var ai_count = 2,
	ai_solutions = [];

// Randomly seed the AI
for (var i = 0; i < ai_count; i++) {
	ai_solutions.push([
		(Math.random() * 20) + 1, // 10
		(Math.random() * 20) + 1, // 10, 
		((Math.random() * 20) + 1 ) / 10, // 1.5, 
		((Math.random() * 20) + 1 ) / 10, // 1.5, 
		((Math.random() * 20) + 1 ) / 10, // 1.3, 
		(Math.random() * 20) + 1, // 2, 
		(Math.random() * 20) + 1, // 4
	]);
}

for (var i = 0; i < ai_count; i++) {
	//Socket for AI
	var client = clientio.connect(address + ':' + gameport);

	// Make AI game
	var game = {};
	game = new game_core(
		ai_solutions[i][0],
		ai_solutions[i][1],
		ai_solutions[i][2],
		ai_solutions[i][3],
		ai_solutions[i][4],
		ai_solutions[i][5],
		ai_solutions[i][6],
		ai_solutions[i][7]
	);
	
	if (game.mmr === undefined) { game.mmr = 1; }
	if (game.game_count === undefined) { game.game_count = 0; }

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
}