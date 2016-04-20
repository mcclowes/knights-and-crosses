/*  -----------------------------  Helper Functions  -----------------------------  */

// Returns fixed point number, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
// Array shuffle function
var shuffle = function(o){ for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o; }
 
// initialise an array of cards - e.g. for new hand or deck
var create_card_array = function(data) {
	var cards = []
	for (var i = 0; i < data.length; i++) {
		cards.push(create_card(data[i]));
	}

	return cards;
}

//Initialise a card
var create_card = function(data) {
	//Depends on format of input data
	return data.cardName !== undefined ? new game_card(data.cardName) : new game_card(data);
}

// Create a rounded clipping area
var roundedImage = function(x, y, width, height, radius){
	game.ctx.beginPath();
	game.ctx.moveTo(x + radius, y);
	game.ctx.lineTo(x + width - radius, y);
	game.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	game.ctx.lineTo(x + width, y + height - radius);
	game.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	game.ctx.lineTo(x + radius, y + height);
	game.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	game.ctx.lineTo(x, y + radius);
	game.ctx.quadraticCurveTo(x, y, x + radius, y);
	game.ctx.closePath();
}

// Draw text in box
// #TODO refactor this
var layout_text = function(canvas, x, y, w, h, text, font_size, spl) {
	var loutout_lines = function(ctx, mw, text) {
		// We give a little "padding" This should probably be an input param but for the sake of simplicity we will keep it this way
		mw = mw - 10;
		var words = text.split(' ');
		var new_line = words[0];
		var lines = [];
		for(var i = 1; i < words.length; ++i) {
		   if (ctx.measureText(new_line + " " + words[i]).width < mw) {
			   new_line += " " + words[i];
		   } else {
			   lines.push(new_line);
			   new_line = words[i];
		   }
		}
		lines.push(new_line);
		return lines;
	}

	if (canvas) {
		canvas.textAlign = "start"; 
		canvas.fillStyle = 'rgba(200, 180, 140, 0.8)';
		canvas.fillRect(x, y, w, h);
		// Paint text
		var lines = loutout_lines(canvas, w, text);
		// Block of text height
		var both = lines.length * (font_size + spl);
		if (both >= h) {
			// We won't be able to wrap the text inside the area the area is too small. We should inform the user  about this in a meaningful way
		} else {
			// We determine the y of the first line
			var ly = (h - both)/2 + y + spl * lines.length;
			var lx = 0;
			for (var j = 0, ly; j < lines.length; ++j, ly+=font_size+spl) {
				// We continue to centralize the lines
				lx = x + w / 2 - canvas.measureText(lines[j]).width / 2;
				game.ctx.fillStyle = 'rgba(0,0,0,1)';
				canvas.fillText(lines[j], lx, ly);
			}
		}
	}
}