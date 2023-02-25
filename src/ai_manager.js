var address 		= 'http://localhost', 			// Set IP
	port 			= '3013', 						// Set Port
	fs 				= require('fs'),
	game_core 		= require('./game.core.ai.js'),
	clientio  		= require('socket.io-client'),
	ai_count 		= 1, 							// Set no. AI instances
	ai_solutions 	= [];

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    	address = add;
    })
} catch(err) {
	console.log(err);
}

// Create an ai instance
const create_ai_instance = (i) => {
	var client = clientio.connect(address + ':' + port);
	// Make AI game
	var game = {};
	game = new game_core(
		ai_solutions[i].player_card_value,
		ai_solutions[i].enemy_card_value,
		ai_solutions[i].center_mod,
		ai_solutions[i].enemy_mod,
		ai_solutions[i].shield_mod,
		ai_solutions[i].freeze_mod,
		ai_solutions[i].rock_mod
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

const init_games = () => {
	//Initialise games
	for (var i = 0; i < ai_solutions.length; i++) {
		//Create ai instance
		(function(x) {
			create_ai_instance(x);
		})(i);
	}
};

// Seed and initialise AI randomly
const seed_random_ai = () => {
	// Randomly seed the AI
	for (var i = 0; i < ai_count; i++) {
		ai_solutions.push({
			player_card_value : Math.floor((Math.random() * 100) + 1), // 10),	player_card_value = 1, // Default initialised AI variables
			enemy_card_value : Math.floor((Math.random() * 100) + 1), // 10), 	enemy_card_value = 1,
			center_mod : Math.floor((Math.random() * 20) + 11) / 10, // 1.5), 	center_mod = 1.5,
			enemy_mod : Math.floor((Math.random() * 20) + 1) / 10, // 1.5), 	enemy_mod = 1.5,
			shield_mod : Math.floor((Math.random() * 20) + 11) / 10, // 1.3), 	shield_mod = 1.3,
			freeze_mod : Math.floor((Math.random() * 20) + 1) / 10, // 2), 	freeze_mod = 0.2,
			rock_mod : Math.floor((Math.random() * 20) + 1) / 10 // 4	rock_mod = 0.4;
		}); 
	}

	return init_games();
};

// Seed and initialise AI from input values
const seed_set_ai = (arg1, arg2, arg3, arg4, arg5, arg6, arg7) => {
	for (var i = 0; i < ai_count; i++) {
		ai_solutions.push({
			player_card_value : arg1,
			enemy_card_value : arg2,
			center_mod : arg3,
			enemy_mod : arg4,
			shield_mod : arg5,
			freeze_mod : arg6,
			rock_mod : arg7,
		}); 
	}

	return init_games();
};

// Seed and initialise AI from JSON input
const seed_ai = () => {
	var data = JSON.parse(fs.readFileSync('./json/ai.json'));
	for (var i = 0; i < data.length; i++) {
		(function(solution){
			ai_solutions.push({
				player_card_value : solution.player_card_value,
				enemy_card_value : solution.enemy_card_value,
				center_mod : solution.center_mod,
				enemy_mod : solution.enemy_mod,
				shield_mod : solution.shield_mod,
				freeze_mod : solution.freeze_mod,
				rock_mod : solution.rock_mod
			});
		})(data[i]);
	}

	return init_games();
};

//seed_random_ai();

seed_set_ai(80, 50, 1.2, 2.2, 1.5, 0.6, 0.8);

//seed_ai(); 