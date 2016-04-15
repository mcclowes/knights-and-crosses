//A window global for our game root variable.
var game = {};

//When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function(){
	//Create our game client instance.
	game = new game_core();
		//Fetch the viewport
		game.viewport = document.getElementById('viewport');
			
		//Adjust their size
		game.viewport.width = game.world.width;
		game.viewport.height = game.world.height;

		//Fetch the rendering contexts
		game.ctx = game.viewport.getContext('2d');
		//Set the draw style for the font
		game.ctx.font = '11px "Helvetica"';

		//window.console.log(game.ctx);
		// Handle clicking
		game.ctx.canvas.addEventListener('selectstart', function(e) { e.preventDefault(); return false; }, false);
		// Up, down, and move are for dragging
		game.ctx.canvas.addEventListener('click', function(e) {
			//var mouse = this.getMouse(e);
			//var mx = mouse.x;
			//var my = mouse.y;
			var mx = event.clientX,
				my = event.clientY;
			var shapes = [game.board];
			shapes = shapes.concat(game.players.self.hand, game.players.other.hand);
			//window.console.log(shapes);

			for (var i = shapes.length - 1; i >= 0; i--) {
				//window.console.log(shapes[i].contains(mx, my));
			  	if (shapes[i].contains(mx, my)) {
			  		input = '';
			  		if (shapes[i] == game.board) {
			  			input = 'sq-' + (100 + mx).toString()[0] + (100 + my).toString()[0];
			  		} else {
			  			input = 'ca-' + shapes[i].cardName;
			  		}
					var mySel = shapes[i];

					window.console.log('pushing clicked input > ' + input);

					game.input_seq += 1;

					game.players.self.inputs.push({
						inputs : input,
						time : game.local_time.fixed(3),
						seq : game.input_seq
					});

					var server_packet = 'i.';
						server_packet += input + '.';
						server_packet += game.local_time.toFixed(3).replace('.','-') + '.';
						server_packet += game.input_seq;

					//Go
					game.socket.send(  server_packet  );

					return;
				}
			}
		}, true);

		//Finally, start the loop
	game.update( new Date().getTime() );
}; //window.onload