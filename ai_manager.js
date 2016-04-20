var gameport        = process.env.PORT || 4004,
	address         = '192.168.1.2',
	game_core		= require('./game.core.js');

global.window = global.document = global;

//console.log('Making a request to ' + address + ':' + gameport);
/*
try {
	http.get('http://' + address + ':' + gameport, function(resp){
		console.log("Request made!", resp);
		//Create our game client instance.
	});
} catch (err) {
	console.log("Failed! " + err);
}*/

var ai_game_list = []

for (var i = 0; i < 3; i++) {
	var game = {};

	game = new game_core();

	//Start game update loop
	game.update( new Date().getTime() );

	ai_game_list.push(game);
}