"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "connected" | "error">("idle")
  const router = useRouter()

  const handleSave = () => {
    // Simulate save action
    setStatus("connected")
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-black">Light Phone AI</h1>
          <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-50" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold text-black">Settings</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="light-phone-email">Light Phone Email</Label>
              <Input id="light-phone-email" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="light-phone-password">Light Phone Password</Label>
              <Input id="light-phone-password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave}>Save</Button>
          <p className="text-sm text-gray-500">
            These credentials are encrypted and used only to check your notes
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between text-sm text-gray-500">
          <p>Privacy</p>
          <p>Support</p>
        </div>
      </footer>
    </div>
  )
}
