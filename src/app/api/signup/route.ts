import db from "@/app/lib/database";

interface SignupRequest {
    firstname: string;
    lastname: string;
    username: string;
    password: string;
}

export async function POST(req: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
        success: true,
        user: {
            id: 'test-user',
            username: 'test'
        }
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
