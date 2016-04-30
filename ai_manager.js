var address 		= 'http://localhost', // Set IP
	gameport 		= '3013', // Set Port
	fs 				= require('fs'),
	game_core 		= require('./game.core.ai.js'),
	clientio  		= require('socket.io-client'),
	ai_count 		= 10, // Set no. AI instances
	ai_solutions 	= [];

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    	address = add;
    })
} catch(err) {
	console.log(err);
}

// Randomly seed the AI
for (var i = 0; i < ai_count; i++) {
	ai_solutions.push([
		Math.floor((Math.random() * 20) + 1), // 10),	player_card_value = 1, // Default initialised AI variables
		Math.floor((Math.random() * 20) + 1), // 10), 	enemy_card_value = 1,
		Math.floor((Math.random() * 20) + 11) / 10, // 1.5), 	center_mod = 1.5,
		Math.floor((Math.random() * 20) + 1) / 10, // 1.5), 	enemy_mod = 1.5,
		Math.floor((Math.random() * 20) + 11) / 10, // 1.3), 	shield_mod = 1.3,
		Math.floor((Math.random() * 20) + 1), // 2), 	freeze_mod = 0.2,
		Math.floor((Math.random() * 20) + 1), // 4	rock_mod = 0.4;
		1
	]);
}

create_game = function(i) {
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
		ai_solutions[i][7],
		ai_solutions[i][8]
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

//Initialise games
for (var i = 0; i < ai_count; i++) {
	//Socket for AI
	create_game(i);
}



