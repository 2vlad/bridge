"use client"

import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  const handleLogin = () => {
    router.push("/settings")
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Service Name */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black mb-3">Light Phone AI Tool   </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Adding OpenAI o4-mini into notes app on your Light Phone. Connect your account. Start new note with '&lt;' in the beginning for AI to answer.
          </p>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          <Button
            onClick={handleLogin}
            variant="outline"
            className="w-full h-11 bg-white text-black border-black hover:bg-black hover:text-white transition-colors"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Continue with Google
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center">Service is free and in beta.</p>
      </div>
    </div>
  )
}
