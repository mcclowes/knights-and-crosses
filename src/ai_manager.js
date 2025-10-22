import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import os from "os";
import { promisify } from "util";
import { io as clientio } from "socket.io-client";
import GameCore from "./game.core.ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lookup = promisify(dns.lookup);

// Configuration
const config = {
  address: "http://localhost",
  port: "3013",
  aiCount: 1,
};

// State
const aiSolutions = [];

// Get hostname IP address
const getHostIP = async () => {
  try {
    const { address } = await lookup(os.hostname());
    return address;
  } catch (err) {
    console.error("Failed to get host IP:", err);
    return config.address;
  }
};

// Create an AI instance
const createAIInstance = (index) => {
  const client = clientio.connect(`${config.address}:${config.port}`);
  const game = new GameCore(
    aiSolutions[index].playerCardValue,
    aiSolutions[index].enemyCardValue,
    aiSolutions[index].centerMod,
    aiSolutions[index].enemyMod,
    aiSolutions[index].shieldMod,
    aiSolutions[index].freezeMod,
    aiSolutions[index].rockMod,
  );

  // Initialize game properties
  game.mmr = game.mmr ?? 1;
  game.gameCount = game.gameCount ?? 0;
  game.socket = client;

  // Set up socket event handlers
  game.socket.on("connect", () => {
    game.players.self.state = "connecting";
  });

  game.socket.on("disconnect", game.client_ondisconnect.bind(game));
  game.socket.on(
    "onserverupdate",
    game.client_onserverupdate_recieved.bind(game),
  );
  game.socket.on("onconnected", game.client_onconnected.bind(game));
  game.socket.on("error", game.client_ondisconnect.bind(game));
  game.socket.on("message", game.client_onnetmessage.bind(game));

  game.update(new Date().getTime());
};

// Initialize all games
const initGames = () => {
  for (let i = 0; i < aiSolutions.length; i++) {
    createAIInstance(i);
  }
};

// Seed AI with random values
const seedRandomAI = () => {
  for (let i = 0; i < config.aiCount; i++) {
    aiSolutions.push({
      playerCardValue: Math.floor(Math.random() * 100) + 1,
      enemyCardValue: Math.floor(Math.random() * 100) + 1,
      centerMod: Math.floor(Math.random() * 20 + 11) / 10,
      enemyMod: Math.floor(Math.random() * 20 + 1) / 10,
      shieldMod: Math.floor(Math.random() * 20 + 11) / 10,
      freezeMod: Math.floor(Math.random() * 20 + 1) / 10,
      rockMod: Math.floor(Math.random() * 20 + 1) / 10,
    });
  }
  return initGames();
};

// Seed AI with specific values
const seedSetAI = (
  playerCardValue,
  enemyCardValue,
  centerMod,
  enemyMod,
  shieldMod,
  freezeMod,
  rockMod,
) => {
  for (let i = 0; i < config.aiCount; i++) {
    aiSolutions.push({
      playerCardValue,
      enemyCardValue,
      centerMod,
      enemyMod,
      shieldMod,
      freezeMod,
      rockMod,
    });
  }
  return initGames();
};

// Seed AI from JSON file
const seedAI = () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "json", "ai.json"), "utf8"),
  );
  for (const solution of data) {
    aiSolutions.push({
      playerCardValue: solution.player_card_value,
      enemyCardValue: solution.enemy_card_value,
      centerMod: solution.center_mod,
      enemyMod: solution.enemy_mod,
      shieldMod: solution.shield_mod,
      freezeMod: solution.freeze_mod,
      rockMod: solution.rock_mod,
    });
  }
  return initGames();
};

// Initialize the application
const init = async () => {
  config.address = await getHostIP();
  // Uncomment one of these to choose initialization method:
  // seedRandomAI();
  seedSetAI(80, 50, 1.2, 2.2, 1.5, 0.6, 0.8);
  // seedAI();
};

init().catch(console.error);

export { seedRandomAI, seedSetAI, seedAI };
