import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Shared Appfun Games profile field. Other Appfun apps can read the same Clerk metadata.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ screenName: typeof user.publicMetadata.appfunScreenName === "string" ? user.publicMetadata.appfunScreenName : "" });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  let input: unknown;
  try { input = (await request.json()).screenName; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const screenName = typeof input === "string" ? input.trim() : "";
  if (screenName.length < 2 || screenName.length > 24 || /[\u0000-\u001f\u007f]/.test(screenName)) {
    return NextResponse.json({ error: "Use 2–24 characters for your screen name." }, { status: 400 });
  }
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, { publicMetadata: { appfunScreenName: screenName } });
  return NextResponse.json({ screenName });
}
