var game = {};

var gameport        = process.env.PORT || 4004,
    address         = '192.168.1.2',

    http            = require('http'),
    io              = require('socket.io'),
    UUID            = require('node-uuid'),
    game_core		= require('./game.core.js');


console.log('Making a request to ' + address + ':' + gameport);

try {
    http.get('http://' + address + ':' + gameport, function(resp){
       console.log("Request made!"/*, resp*/);
    });
} catch (err) {
    console.log("Failed! " + err);
}
//Create our game client instance.
game = new game_core();

//Start game update loop
game.update( new Date().getTime() );