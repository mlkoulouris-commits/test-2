import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_SUPABASE_URL))
  response.cookies.delete('admin_authenticated')
  return response
}

