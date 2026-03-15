const FETCH_URL = 'http://localhost:54321/functions/v1/nova-agent'; // Local Supabase URL
const USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_SECRET = 'bxWLD2nOAFTjbFxlG60jNmNn+djE+DgNpcLlfckyKNw=';

async function testSubtaskMerging() {
    console.log("--- Step 1: Initial Draft ---");
    const res1 = await fetch(FETCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
            query: "Remind me to go shopping tomorrow",
            user_id: USER_ID,
            client_date: "2026-03-14",
            conversation: []
        })
    });

    const data1 = await res1.json();
    const draft1 = data1.tool_calls?.[0]?.result?.draft;
    console.log("Initial Title:", draft1?.title);

    console.log("\n--- Step 2: Add Subtasks A and B ---");
    const conversation2 = [
        { role: 'user', content: "Remind me to go shopping tomorrow" },
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
            query: "add subtasks to buy apples and bread",
            user_id: USER_ID,
            client_date: "2026-03-14",
            conversation: conversation2
        })
    });

    const data2 = await res2.json();
    const draft2 = data2.tool_calls?.[0]?.result?.draft;
    console.log("Subtasks after Step 2:", draft2?.subtasks?.map(s => s.title));

    console.log("\n--- Step 3: Add Subtask C (Testing Merge) ---");
    const conversation3 = [
        ...conversation2,
        { role: 'user', content: "add subtasks to buy apples and bread" },
        {
            role: 'assistant',
            content: data2.message,
            panelType: 'draft',
            panelFields: draft2
        }
    ];

    const res3 = await fetch(FETCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
            query: "actually also add milk to that list",
            user_id: USER_ID,
            client_date: "2026-03-14",
            conversation: conversation3
        })
    });

    const data3 = await res3.json();
    const draft3 = data3.tool_calls?.[0]?.result?.draft;
    const subtaskTitles = draft3?.subtasks?.map(s => s.title) || [];
    console.log("Subtasks after Step 3:", subtaskTitles);

    const hasApples = subtaskTitles.some(t => t.toLowerCase().includes('apples'));
    const hasBread = subtaskTitles.some(t => t.toLowerCase().includes('bread'));
    const hasMilk = subtaskTitles.some(t => t.toLowerCase().includes('milk'));

    if (hasApples && hasBread && hasMilk) {
        console.log("\n✅ SUCCESS: Subtasks were successfully merged iteratively.");
    } else {
        console.log("\n❌ FAILURE: Subtask merging failed.");
        console.log("Missing:", [!hasApples && 'apples', !hasBread && 'bread', !hasMilk && 'milk'].filter(Boolean).join(', '));
    }
}

testSubtaskMerging();
