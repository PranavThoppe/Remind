/**
 * Verification script for Nova Update Agent Phase 2 Nudges.
 * 
 * Usage: 
 * 1. Ensure you have AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, and ADMIN_SECRET_KEY.
 * 2. Run: node supabase/functions/nova-update-agent/test_nudges.js
 */

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const USER_ID = process.env.TEST_USER_ID; // Provide a valid user ID for testing

async function testAgent(scenarioName, query, reminder) {
    console.log(`\n--- Testing Scenario: ${scenarioName} ---`);
    const now = new Date();
    const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/nova-update-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET_KEY
            },
            body: JSON.stringify({
                query,
                user_id: USER_ID,
                client_date: clientDate,
                reminder
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error(`Error: ${data.error}`);
            if (data.details) console.error(`Details: ${data.details}`);
        } else {
            console.log(`Nova Response: "${data.message}"`);
        }
    } catch (err) {
        console.error(`Failed to call agent: ${err.message}`);
    }
}

async function runTests() {
    if (!SUPABASE_URL || !ADMIN_SECRET_KEY || !USER_ID) {
        console.error("Missing environment variables (SUPABASE_URL, ADMIN_SECRET_KEY, TEST_USER_ID)");
        process.exit(1);
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Scenario 1: Overdue Reminder
    await testAgent(
        "Overdue Reminder",
        "ACTION:INITIAL_ANALYSIS",
        {
            id: "test-id-overdue",
            title: "Overdue Task Example",
            date: yesterdayStr,
            time: "10:00",
            repeat: "none"
        }
    );

    // Scenario 2: Today Reminder (Temporal Coaching)
    await testAgent(
        "Today Reminder",
        "ACTION:INITIAL_ANALYSIS",
        {
            id: "test-id-today",
            title: "Plan the weekend hike",
            date: todayStr,
            time: "14:00",
            repeat: "none"
        }
    );

    // Scenario 3: Simple Today Reminder
    await testAgent(
        "Simple Today Reminder",
        "ACTION:INITIAL_ANALYSIS",
        {
            id: "test-id-simple",
            title: "Buy milk",
            date: todayStr,
            time: null,
            repeat: "none"
        }
    );
}

runTests();
