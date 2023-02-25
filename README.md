# Knights and Crosses

Knights and Crosses is a networked competitive multiplayer TCG game.

## An Investigation Into The Use of Genetic AI in the Balancing of Competitive Multiplayer Games

In the increasingly profitable competitive multiplayer games industry, ensuring products are fun, challenging and fair can be key to a games success. Traditionally, measuring and improv- ing the balance of games has been costly in terms of both time and money, requiring many man-hours and large teams. Automated approaches to the process could improve game quality whilst offering ongoing time and money savings - a huge advantage to an ever-growing pool of game developers.

This code is part of a project aiming to highlight the potential for improving gameplay balance within multiplayer competitive games by automating the highlighting of potential balance issues. More specifically, the project explores how imbalances can be highlighted with data gathered by playing Artificial Intelligence agents against one another iteratively.

The project tests the proposed approach on the game implemented here - a two-player card game typical of the competitive multiplayer genre, developed for the purposes of this research. 

A Genetic Algorithm-improved Artificial Intelligence was developed to play this game. Through pitching pools of the AI against one another and recording metricised data about that gameplay, the information needed to analyse in-game cards was gath- ered. This data was used to draw conclusions about the games mechanics, enabling accurate manual game design changes.

Gathered data presents clear issues with the initial in-game tools, allowing adjustment of the mechanics accordingly. Over several rounds of this balancing process, a quantifiably more balanced ver- sion of the game had been achieved.

The success of the balancing process suggests that the proposed new approach to game balancing is viable. The clarity with which test data highlighted issues, combined with the speed in which this data was gathered, make the technique particularly effective.

## Running the code

Install dependencies
```
npm install
```

To mount the core game server, in the root directory run:

```
npm run start
```

This server will print its IP address to console. Visiting this address in the browser will allow human players to play the game. The server automatically handles matchmaking.

AI instances can also be created:

```
npm run create-ai
```

This creates a number of AI instances; the quantity can be manually altered within the ai_manager.js file.

## The Code

### The Server

The server utilises Express and Socket.io.js to listen for connections from human and AI clients respectively, at different ports. Upon receiving a connection request, the connection is made and the client is handled accordingly.

The server searches for any active games with free slots; if none exist, a new game is created. When games end, the server removes the game and places the players into new games.

The server also tracks a rating of AI instances, which is crucial to AI optimisation. The Elo Rating System is a system for rating and relatively ranking player proficiency (Glickman & Jones 1999) - in this case the AI. It works by awarding points for a win based on the assumed probability of a win. It is famously used in the game of Chess, but variations on the approach are used in many popular competitive multiplayer games such as Hearthstone, and previous research has examined its use as a evaluative tool in genetic algorithms (Cole et al. 2004). Because of the randomness involved in the game, it is important to rank the AI in a manner that accounts for the likelihood of each player having a few poor games, irrespective of their proficiency.

For a game between players A and B, with current ratings of RA and RB respectively, the probability Pplayer that player A will win is (Yliniemi & Tumer 2013):

PA = 1 (1) 1 + 10−(RA −RB )/400

Each win or loss alters the rating for each player by:

Rplayer ← Rplayer + K(S − Pplayer) (2)

K takes an arbitrary initial value of 55, reduced by 1 for each game played until it reaches a value of 25, S is 1 for a win and 0 for a loss, and Eplayer is the previous probability of victory for that player, as defined above.

### The AI

The AI instances were created, managed and made to evolve over a series of rounds of games via a simple GA implementation. This evolutionary process continued until variance between solutions became small.

The crossover mechanism generated new members of the population by taking input from two existing members, with selection weighted towards higher scoring AI instances. New AI instances inherited the first random x input variables, where 1 < x < 7, from their first parent, and the rest from the second. Additionally, there was a 20% chance of the child ‘mutating’ with all variables being randomly seeded instead.

The AI's evaluation function works by analysing the current board state, and calculates all potential board state changes based on card choices and piece placing, with all combinations compared; if no card will produce a positive outcome, no card is played. The evaluative calculation is a simple function of the pieces in each row, column and diagonal summed, with +1 for the AI’s own pieces and -1 for the AI’s opponent’s, with the AI’s variables modifying the calculation accordingly. The value of a chosen card is then be recorded and stored for game balance analysis.

Although this AI approach is inefficient and somewhat “brute force” in approach, the algo- rithm is adequate for the implemented game and operates extremely swiftly - a necessity given the real-time requirements of gaming AI. With only a small number of possible decisions each turn the AI only need play locally optimum moves, rather than strategising over many turns or attempting to predict the potential plays of the opponent - tasks that are more computationally demanding. The implemented solution is able to compute decisions and make plays almost in- stantaneously from a human perspective.

### The Client

The client-side is canvas based, fairly traditional implementation.

## Dependencies

See package.json for code dependencies.

## How To Play

Sigil: Crosses consists of two distinct but interacting gameplay elements. The core gameplay element - and the section which ultimately decides the victor - is a game of Tic-Tac-Toe played on a 4x4 grid. Each turn, each player places a piece on the grid, with the first to place four pieces along a single row, column, or diagonal of the grid winning the game.

The second gameplay element is a turn-based TCG, with each card affecting the state of the 4x4 game board. Each player has a deck of 20 cards, drawing one card from their respective decks each turn and using one card per turn. Each card has a distinct effect, including removing played pieces and blocking board positions, turning the solved game of Tic-Tac-Toe into an exciting and dynamic gameplay experience.

The class of each card determines how many of that card can be included in a deck: three of each basic card can be included, with two of each rare and only one of each elite card. Players are limited to 5 elite cards (25% of their deck). This limitation is a tool for ensuring powerful cards cannot be used too many times, and it is therefore a useful balancing tool.

Each card performs one of a variety of unique effects, including:
• Damage dealing to pieces
• Shielding, preventing damage to pieces • De-shielding
• Destroying pieces outright
• Blocking squares
• Drawing cards
• Discarding cards

The game begins with each player drawing three cards, before the first player’s turn begins. Each turn, each player can play a card and then a piece. Following each turn, the win conditions are checked for, before the next player’s turn begins.

In the centre of the image a 4x4 game board is visible, where the Tic Tac Toe game is played. Directly above and below the board are the cards of the opposing players.

## Cards

Currently 14 cards are included in the decks.

*Armour Up*:
- Basic
- Shield a piece, Draw a card

*Barrage*:
- Basic
- Damage all pieces, Discard 2 cards

*Bezerker*:
-Rare
- Discard a card, Deal 1 damage, If you have the least pieces, return this - card to your hand

*Boulder*:
- Rare
- Discard a card, Block a square

*Fire Blast*:
- Basic
- Deal 1 damage

*Floods*:
- Rare
- Destroy all pieces, End your turn

*Flurry*:
- Rare
- Deal 2 damage to your pieces, Deal 2 damage to enemy pieces

*Frost*:
- Basic
- Freeze all squares

*Ice Blast*:
- Basic
- Freeze a square

*Reckless*:
- Rare
- Your opponent draws 2 cards, Destroy a piece

*Sabotage*:
- Elite
- Remove 5 shields

*Sacrifice*:
- Rare
- Destroy a piece of yours, Draw 3 cards

*Summer*:
- Basic
- Thaw 1 square, Draw a card

*Taxes*:
- Rare
- Discard 2 cards, Shield 3 pieces

Note: All art assetts are (c) Max Clayton Clowes, 2016
