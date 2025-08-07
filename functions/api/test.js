// Cloudflare Pages Function - GET /api/test (Development/Testing Only)
import * as Realm from "realm-web";

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
    status: env.MONGODB_APP_ID && env.MONGODB_API_KEY ? 'PASS' : 'FAIL',
    details: {
      mongodb_app_id: env.MONGODB_APP_ID ? 'Set' : 'Missing',
      mongodb_api_key: env.MONGODB_API_KEY ? 'Set' : 'Missing'
    }
  });

  // Test 2: Realm SDK Import
  let realmSdkStatus = 'PASS';
  let realmSdkError = null;
  try {
    const testApp = new Realm.App({ id: 'test-app-id' });
    // If we get here, the SDK loaded successfully
  } catch (error) {
    realmSdkStatus = 'FAIL';
    realmSdkError = error.message;
  }
  
  testResults.tests.push({
    name: 'Realm SDK Import',
    status: realmSdkStatus,
    error: realmSdkError
  });

  // Test 3: MongoDB Connection (if credentials are available)
  if (env.MONGODB_APP_ID && env.MONGODB_API_KEY) {
    let mongoStatus = 'PASS';
    let mongoError = null;
    let connectionDetails = null;

    try {
      const app = new Realm.App({ id: env.MONGODB_APP_ID });
      const credentials = Realm.Credentials.apiKey(env.MONGODB_API_KEY);
      const user = await app.logIn(credentials);
      
      if (user && user.mongoClient) {
        const mongo = user.mongoClient("mongodb-atlas");
        const db = mongo.db("baby-dashboard");
        
        // Test basic database access
        const testCollection = db.collection("test");
        connectionDetails = {
          userId: user.id,
          isLoggedIn: user.isLoggedIn,
          mongoClientAvailable: !!user.mongoClient
        };
      } else {
        mongoStatus = 'FAIL';
        mongoError = 'Failed to get MongoDB client';
      }
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
      reason: 'Missing environment variables'
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