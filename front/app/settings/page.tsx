"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "connected" | "error">("idle")

  const handleSave = () => {
    // Simulate save action
    setStatus("connected")
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-black">Light Phone AI</h1>
          <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-50">
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Navigation */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              <li>
                <a href="#" className="block px-3 py-2 text-sm font-medium text-black bg-gray-100 rounded">
                  Settings
                </a>
              </li>
              <li>
                <a href="#" className="block px-3 py-2 text-sm text-gray-600 hover:text-black hover:bg-gray-50 rounded">
                  Logs
                </a>
              </li>
              <li>
                <a href="#" className="block px-3 py-2 text-sm text-gray-600 hover:text-black hover:bg-gray-50 rounded">
                  Account
                </a>
              </li>
            </ul>
          </nav>

          {/* Main Content */}
          <main className="flex-1 max-w-md">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-black mb-1">Settings</h2>
              </div>

              {/* Connection Status */}
              {status !== "idle" && (
                <div
                  className={`p-3 rounded border ${
                    status === "connected"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <div className="text-sm">
                    {status === "connected" ? "✓ Connected to Light Phone" : "✗ Connection failed"}
                  </div>
                </div>
              )}

              {/* Form */}
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSave()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-black">
                    Light Phone Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-gray-300 focus:border-black focus:ring-black"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-black">
                    Light Phone Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-gray-300 focus:border-black focus:ring-black"
                    placeholder="••••••••"
                  />
                </div>

                <Button type="submit" className="bg-black text-white hover:bg-gray-800 border-0">
                  Save
                </Button>
              </form>

              <p className="text-xs text-gray-500">These credentials are encrypted and used only to check your notes</p>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="#" className="hover:text-black">
              Privacy
            </a>
            <a href="#" className="hover:text-black">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
