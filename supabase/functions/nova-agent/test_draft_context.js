
const FETCH_URL = 'http://localhost:54321/functions/v1/nova-agent'; // Local Supabase URL
const USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_SECRET = 'bxWLD2nOAFTjbFxlG60jNmNn+djE+DgNpcLlfckyKNw=';

async function testDraftContext() {
    console.log("--- Step 1: Request initial draft ---");
    const res1 = await fetch(FETCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
            query: "Remind me to buy groceries tomorrow",
            user_id: USER_ID,
            client_date: "2026-03-14",
            conversation: []
        })
    });

    const data1 = await res1.json();
    const draft1 = data1.tool_calls?.[0]?.result?.draft;
    console.log("Draft 1:", JSON.stringify(draft1, null, 2));

    if (!draft1) {
        console.error("Failed to get draft 1");
        process.exit(1);
    }

    console.log("\n--- Step 2: Request modification (Add subtasks and time) ---");
    const conversation = [
        { role: 'user', content: "Remind me to buy groceries tomorrow" },
        {
            role: 'assistant',
            content: data1.message,
            panelType: 'draft',
            panelFields: draft1
        }
    ];

    const res2 = await fetch(FETCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
            query: "Actually make it for 5pm and add subtasks to buy milk and eggs",
            user_id: USER_ID,
            client_date: "2026-03-14",
            conversation: conversation
        })
    });

    const data2 = await res2.json();
    const draft2 = data2.tool_calls?.[0]?.result?.draft;
    console.log("Draft 2:", JSON.stringify(draft2, null, 2));

    if (draft2 && draft2.time === "17:00" && draft2.subtasks && draft2.subtasks.length === 2) {
        console.log("\n✅ SUCCESS: Draft 2 preserved context and applied changes correctly.");
    } else {
        console.log("\n❌ FAILURE: Draft 2 did not preserve context or apply changes correctly.");
        console.log("Expected Time: 17:00, Got:", draft2?.time);
        console.log("Expected Subtasks length: 2, Got:", draft2?.subtasks?.length);
    }
}

testDraftContext();
