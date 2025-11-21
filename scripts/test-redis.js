#!/usr/bin/env node

/**
 * Test script for Redis connection
 * Usage: node scripts/test-redis.js
 *
 * Requires KV_URL environment variable to be set in .env.local
 */

import { config } from 'dotenv';
import { RedisGameStorage } from '../src/server/storage/RedisGameStorage.js';

// Load environment variables
config({ path: '.env.local' });

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...\n');

  // Check if KV_URL is set
  if (!process.env.KV_URL) {
    console.error('❌ Error: KV_URL environment variable is not set!');
    console.log('\nPlease add your Redis connection URL to .env.local:');
    console.log('KV_URL=redis://default:password@hostname:port\n');
    console.log('Get it from: https://vercel.com/mcclowes/knights-and-crosses/integrations/redis');
    process.exit(1);
  }

  console.log('✓ KV_URL found:', process.env.KV_URL.replace(/:[^:@]+@/, ':****@'));

  const storage = new RedisGameStorage();

  try {
    // Test 1: Connection
    console.log('\n📡 Test 1: Connecting to Redis...');
    await storage.connect();
    console.log('✅ Connected successfully!');

    // Test 2: Health check
    console.log('\n🏥 Test 2: Running health check...');
    const healthy = await storage.healthCheck();
    if (healthy) {
      console.log('✅ Health check passed!');
    } else {
      console.log('❌ Health check failed!');
      process.exit(1);
    }

    // Test 3: Write test data
    console.log('\n✍️  Test 3: Writing test data...');
    const testGame = {
      id: 'test-game-' + Date.now(),
      player_host: { userid: 'test-user-1' },
      player_client: null,
      player_count: 1,
      active: true,
    };
    await storage.saveGame(testGame);
    console.log('✅ Test game saved!');

    // Test 4: Read test data
    console.log('\n📖 Test 4: Reading test data...');
    const retrieved = await storage.getGame(testGame.id);
    if (retrieved && retrieved.id === testGame.id) {
      console.log('✅ Test game retrieved successfully!');
      console.log('   Game ID:', retrieved.id);
      console.log('   Player Count:', retrieved.playerCount);
    } else {
      console.log('❌ Failed to retrieve test game!');
      process.exit(1);
    }

    // Test 5: Get all games
    console.log('\n📋 Test 5: Getting all active games...');
    const allGames = await storage.getAllGames();
    console.log(`✅ Found ${allGames.length} active game(s)`);

    // Test 6: Clean up
    console.log('\n🧹 Test 6: Cleaning up test data...');
    await storage.deleteGame(testGame.id);
    console.log('✅ Test game deleted!');

    // Test 7: Player stats
    console.log('\n👤 Test 7: Testing player stats...');
    const testUserId = 'test-user-' + Date.now();
    const defaultStats = await storage.getPlayerStats(testUserId);
    console.log('✅ Default stats retrieved:', {
      mmr: defaultStats.mmr,
      totalGames: defaultStats.totalGames,
    });

    await storage.updatePlayerStats(testUserId, 25, true);
    const updatedStats = await storage.getPlayerStats(testUserId);
    console.log('✅ Stats updated:', {
      mmr: updatedStats.mmr,
      wins: updatedStats.wins,
      totalGames: updatedStats.totalGames,
    });

    // Close connection
    console.log('\n🔌 Closing connection...');
    await storage.client.quit();
    console.log('✅ Connection closed');

    console.log('\n🎉 All tests passed! Redis integration is working correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    console.error('\nFull error:', error);

    // Try to close connection if it exists
    if (storage.client) {
      try {
        await storage.client.quit();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    process.exit(1);
  }
}

// Run tests
testRedisConnection();
