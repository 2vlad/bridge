"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const url = isRegister ? "/api/register" : "/api/login"
    const body = isRegister ? { email, password, name } : { email, password }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem("token", data.token)
      router.push("/settings")
    } else {
      const responseText = await res.text();
      let errorMessage = "An unknown error occurred.";
      try {
        const data = JSON.parse(responseText);
        errorMessage = data.message || responseText;
      } catch (e) {
        errorMessage = responseText;
      }
      setError(errorMessage);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold text-center text-black mb-2">Light Phone AI Tool</h1>
        <p className="text-sm text-gray-600 text-center mb-4">
          Adding Claude AI into notes app on your Light Phone. Connect your account. Start new note with '&lt;' in the beginning for AI to answer.
        </p>
        {isRegister && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <button type="submit" className="w-full bg-black text-white py-2 rounded">
          {isRegister ? "Register" : "Login"}
        </button>
        <div className="text-center text-xs text-gray-500">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button type="button" className="underline" onClick={() => setIsRegister(false)}>
                Login
              </button>
            </>
          ) : (
            <>
              No account?{' '}
              <button type="button" className="underline" onClick={() => setIsRegister(true)}>
                Register
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">Service is free and in beta.</p>
      </form>
    </div>
  )
}
