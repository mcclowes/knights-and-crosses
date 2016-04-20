var	game_core		= require('./game.core.ai.js');

global.window = global.document = global;

//console.log('Making a request to ' + address + ':' + gameport);

// Make AI game
var game = {};
game = new game_core();
game.update( new Date().getTime() );

//io = require('socket.io-client')('http://10.245.145.51:4004');