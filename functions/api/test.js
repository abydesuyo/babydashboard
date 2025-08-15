// Cloudflare Pages Function - GET /api/test (Development/Testing Only)
import { MongoClient } from "mongodb";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const testResults = {
    timestamp: new Date().toISOString(),
    environment: 'cloudflare-pages',
    tests: []
  };

  // Test 1: Environment variables
  testResults.tests.push({
    name: 'Environment Variables',
    status: env.MONGODB_URI ? 'PASS' : 'FAIL',
    details: {
      mongodb_uri: env.MONGODB_URI ? 'Set' : 'Missing'
    }
  });

  // Test 2: MongoDB SDK Import
  let mongoSdkStatus = 'PASS';
  let mongoSdkError = null;
  try {
    // Test if we can create a MongoClient instance
    new MongoClient('mongodb://test');
    // If we get here, the SDK loaded successfully
  } catch (error) {
    mongoSdkStatus = 'FAIL';
    mongoSdkError = error.message;
  }
  
  testResults.tests.push({
    name: 'MongoDB SDK Import',
    status: mongoSdkStatus,
    error: mongoSdkError
  });

  // Test 3: MongoDB Connection (if credentials are available)
  if (env.MONGODB_URI) {
    let mongoStatus = 'PASS';
    let mongoError = null;
    let connectionDetails = null;

    try {
      const client = new MongoClient(env.MONGODB_URI);
      await client.connect();
      const db = client.db("baby-dashboard");
      
      // Test basic database access
      await db.admin().ping();
      
      connectionDetails = {
        connected: true,
        databaseName: db.databaseName
      };
      
      await client.close();
    } catch (error) {
      mongoStatus = 'FAIL';
      mongoError = error.message;
    }

    testResults.tests.push({
      name: 'MongoDB Atlas Connection',
      status: mongoStatus,
      error: mongoError,
      details: connectionDetails
    });
  } else {
    testResults.tests.push({
      name: 'MongoDB Atlas Connection',
      status: 'SKIPPED',
      reason: 'Missing MONGODB_URI environment variable'
    });
  }

  // Test 4: Request Headers
  const authHeader = request.headers.get('Authorization');
  testResults.tests.push({
    name: 'Authorization Header',
    status: authHeader && authHeader.startsWith('Bearer ') ? 'PASS' : 'FAIL',
    details: {
      present: !!authHeader,
      format: authHeader ? (authHeader.startsWith('Bearer ') ? 'Correct' : 'Invalid') : 'Missing'
    }
  });

  // Overall status
  const overallStatus = testResults.tests.every(test => test.status === 'PASS' || test.status === 'SKIPPED') 
    ? 'ALL_TESTS_PASS' 
    : 'SOME_TESTS_FAIL';

  const response = {
    overall: overallStatus,
    summary: `${testResults.tests.filter(t => t.status === 'PASS').length} passed, ${testResults.tests.filter(t => t.status === 'FAIL').length} failed, ${testResults.tests.filter(t => t.status === 'SKIPPED').length} skipped`,
    ...testResults
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}