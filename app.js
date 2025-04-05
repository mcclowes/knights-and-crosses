/* ----------------------- Variables ------------------------- */

import { Server } from 'socket.io';
import { v4 as UUID } from 'uuid';
import express from 'express';
import http from 'http';
import dns from 'dns';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import game_server from './src/game.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.env.PORT || 3014;
let address = 'http://localhost';
const verbose = false;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* ----------------------- Find IP, start listening ------------------------- */

try {
    dns.lookup(os.hostname(), function (err, add, fam) {
        server.listen(port, add);
        address = add;
        //Log something so we know that it succeeded.
        console.log('Listening on ' + add + ':' + port );

        /* ----------------------- File request handling ------------------------- */

        app.get( '/', function( req, res ){
            console.log('Loading %s', join(__dirname, 'index.html'));
            res.sendFile('index.html', { root: __dirname });
        });

        app.get( '/*' , function( req, res, next ) {
            const file = req.params[0]; // Current file they have requested
            if(verbose) console.log('File requested : ' + file); //For debugging, we can track what files are requested.
            res.sendFile(join(__dirname, file)); //Send the requesting client the file.
        });
    })
} catch (err) {
    server.listen(port)
}

// Local version
console.log('Listening on ' + address + ':' + port );

/* ----------------------- Handle connection -----------------------  */

// Handle successful connection
io.on('connection', function (client) {
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