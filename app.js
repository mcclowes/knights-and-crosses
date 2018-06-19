/* ----------------------- Variables ------------------------- */

var io              = require('socket.io').listen(3013),
    UUID            = require('node-uuid'),
    port            = process.env.PORT || 3014,
    address         = 'http://localhost',
    express         = require('express'),
    verbose         = false,
    http            = require('http'),
    app             = express(),
    server          = http.createServer(app),
    game_server     = require('./src/game.server.js'),
    sio             = '';

/* ----------------------- Find IP, start listening ------------------------- */

try {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
        server.listen(port, add);
        address = add;
        //Log something so we know that it succeeded.
        console.log('Listening on ' + add + ':' + port );

        /* ----------------------- File request handling ------------------------- */

        app.get( '/', function( req, res ){
            console.log('Loading %s', __dirname + '/index.html');
            res.sendFile( 'index.html' , { root:__dirname });
        });

        app.get( '/*' , function( req, res, next ) {
            var file = req.params[0]; // Current file they have requested
            if(verbose) console.log('File requested : ' + file); //For debugging, we can track what files are requested.
            res.sendFile( __dirname + '/' + file ); //Send the requesting client the file.
        });

        sio = io.listen(server); // Handle socket.io file request
    })
} catch (err) {
    server.listen(port)
}

// Local version
console.log('Listening on ' + address + ':' + port );


/* ----------------------- Handle connection -----------------------  */

// Handle successful connection
io.sockets.on('connection', function (client) {
    client.userid = UUID(); //Generate new user ID
    client.emit('onconnected', { id: client.userid } ); // Ping successful connect
    console.log('Player ' + client.userid + ' connected');

    game_server.findGame(client);

    // Forward user messages to server
    client.on('message', function(m) {
        game_server.onMessage(client, m);
    });

    // Handle user disconnect
    client.on('disconnect', function () {
        console.log('Client ' + client.userid + 'disconnected');
        if ( client.game && client.game.id ) {
            game_server.endGame(client.game.id, client.userid); //player leaving -> destroy game
        }
    }); 
});