import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok:true, app:"OptiRoute", version:"3.1.0" });
}
