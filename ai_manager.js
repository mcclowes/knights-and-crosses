global.window = global.document = global;

var game = {};

var gameport        = process.env.PORT || 4004,
    address         = '',

    //io              = require('socket.io'),
    express         = require('express'),
    UUID            = require('node-uuid'),
    game_core		= require('./game.core.js'),

    verbose         = false,
    http            = require('http'),
    app             = express();

io = require('socket.io');

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    address = add;
    //start_ai_clients();
});
/*
var start_ai_clients = function() {
	window.console.log('Making a request to ' + address + ':' + gameport);
	try {
	    http.get('http://' + address + ':' + gameport, function(resp){
	       //window.console.log("Request made!", resp);
	    });
	} catch (err) {
	    window.console.log("Failed! " + err);
	}

	require('./game.core.js');

	window.console.log('got this far');

	loadGame();

	window.console.log('got this far');
}*/

var onload = function(){
	window.console.log('Starting load');
	window.console.log(io);
	//Create our game client instance.
	game = new game_core();
	//Adjust canvas size
	game.viewport.width = game.world.width;
	game.viewport.height = game.world.height;

	game.ctx = game.viewport.getContext('2d');//Fetch the rendering contexts
	game.ctx.font = '11px "Helvetica"'; //Set the draw style for the font

	//Start game update loop
	game.update( new Date().getTime() );
}; //window.onload

window.console.log('Freaky');
onload();